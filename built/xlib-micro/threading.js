"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const luxon = require("luxon");
const _ = require("lodash");
const promise = require("./promise");
const bb = require("bluebird");
const ex = require("./exception");
const numHelper = require("./num-helper");
const log = require("./log-helper");
class RetryException extends ex.Exception {
    constructor(statePtr, message) {
        super(message);
        this.statePtr = statePtr;
    }
}
exports.RetryException = RetryException;
class RetryTimeoutException extends RetryException {
}
exports.RetryTimeoutException = RetryTimeoutException;
/** helper class that wraps a ```workerFunc``` and if that fails when you invoke it, will retry as needed.
 *
 * By default, will retry at a semi-random time between ```options.baseWait``` and ```options.maxWait```, increasingly biased towards ```maxWait``` the more retry attempts fail.   You can configure your own custom retry logic by overriding the ```options.delayHandler```  */
class Retry {
    constructor(options, workerFunc) {
        this.options = options;
        this.workerFunc = workerFunc;
        // public async invoke( ...args: TArgs[] ): Promise<TResult> {
        // }
        /** invoke the workerFunc passed via the constructor, and retries as needed. */
        this.invoke = async function __invoke(...args) {
            const state = {
                lastSleep: luxon.Duration.fromMillis(0),
                options: this.options,
                retryObject: this,
                invokeTime: luxon.DateTime.utc(),
                tryStart: null,
                try: 0,
            };
            //loop trys until we either have a valid return or an explicit abort.
            while (true) {
                if (state.try > this.options.maxRetries) {
                    throw new RetryException(state, "max tries exceeded");
                }
                state.try++;
                const timeoutMs = Math.min(this.options.totalTimeout.valueOf() - luxon.DateTime.utc().diff(state.invokeTime).valueOf(), this.options.tryTimeout.valueOf());
                if (timeoutMs < 0) {
                    throw new RetryTimeoutException(state, `timeout exceeded on try ${state.try}.  timeLeft=${timeoutMs}.  totalTimeout=${this.options.totalTimeout.valueOf()}, startTime=${state.invokeTime.toISOTime()}`);
                }
                const tryTimeoutMessage = "try timeout exceeded";
                try {
                    state.tryStart = luxon.DateTime.utc();
                    let invokeResult = await bb.resolve(this.workerFunc(...args)).timeout(timeoutMs, new RetryTimeoutException(state, tryTimeoutMessage));
                    if (this.options.responseHandler != null) {
                        //let user filter the result
                        invokeResult = await this.options.responseHandler(invokeResult, state);
                    }
                    return invokeResult;
                }
                catch (_err) {
                    const err = _err;
                    //could fail due to timeout, or error in the invoked function.
                    if (err instanceof RetryTimeoutException && err.statePtr === state && err.message === tryTimeoutMessage) {
                        //this try timed out.
                        if (this.options.abortHandler != null) {
                            //allow graceful abort
                            await this.options.abortHandler(err);
                        }
                    }
                    //allow user handling of whatever error
                    if (this.options.responseHandler != null) {
                        const toReturn = await this.options.responseErrorHandler(err, state);
                        //valid toReturn.  if the above promise was rejected, await would throw.
                        return toReturn;
                    }
                    //if here, an error.  retry
                    const delayMs = this.options.delayHandler(state).valueOf();
                    //make sure our next try time doesn't exceed our totalTimeout
                    const nextRetryTime = luxon.DateTime.utc().plus({ milliseconds: delayMs });
                    const minTimeThatWillElapse = nextRetryTime.diff(state.invokeTime);
                    if (minTimeThatWillElapse.valueOf() > this.options.totalTimeout.valueOf()) {
                        throw new RetryTimeoutException(state, `options.totalTimeout would be exceeded upon next try attempt, so aborting now (try=${state.try}).`);
                    }
                    await bb.delay(delayMs);
                    continue;
                }
            }
        };
        const rand = numHelper.randomInt;
        // tslint:disable-next-line: no-unbound-method
        const min = Math.min;
        //apply defaults
        options = Object.assign({ expFactor: 1, maxJitter: 100, baseWait: 0, totalTimeout: luxon.Duration.fromObject({ seconds: 60 }), maxWait: luxon.Duration.fromObject({ seconds: 5 }), tryTimeout: luxon.Duration.fromObject({ seconds: 60 }), 
            /** default is ```nextSleep = min(waitCap,randBetween(baseWait,lastSleep*(try^expFactor))) + randBetween(0,maxJitter)```
             * which is loosely based on this article: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/ */
            delayHandler: (s) => min(s.options.maxWait.valueOf(), rand(s.options.baseWait.valueOf(), s.lastSleep.valueOf() * (Math.pow(s.try, s.options.expFactor)))) + rand(0, s.options.maxJitter.valueOf()) }, options);
        this.options = options;
    }
}
exports.Retry = Retry;
/** while this is probably only useful+used by the ```net.RemoteHttpEndpoint``` class, this is a generic autoscaler implementation,
    * meaning that it will scale requests to a ```backendWorker``` function, gradually increasing activeParallel requests over time.   Requests exceeding activeParallel will be queued in a FIFO fashion.
    *
    the only requirement is that the target ```backendWorker``` function  return a promise,
    * and you specify a ```failureListener``` function that can tell the difference between a failure and a need for backing off.
    */
class Autoscaler {
    constructor(options, backendWorker, 
    /** will be used to intercept failures (promise rejections) from the ```backendWorker``` function.  should return "FAIL" if it's a normal failure (to be returned to the caller) or "TOO_BUSY" if the request should be retried  */
    failureListener) {
        this.options = options;
        this.backendWorker = backendWorker;
        this.failureListener = failureListener;
        this.pendingCalls = [];
        this.activeCalls = [];
        /** submit a request to the backend worker.
         *
         * **Important note**: to avoid "unhandled promise rejections" you need to make sure the returned Promise has a catch() applied to it.
         * **NOT** just store the promise in an array to inspect later.  This is because if the request fails, the returned promise gets rejected, and if the Promise internal logic doesn't see a .catch() it will show the global "unhandled rejected promse" soft error message.
         */
        this.submitRequest = 
        //a worker with generic input/return args, cast to our specific worker function's sig
        (async (...args) => {
            const requesterPromise = promise.CreateExposedPromise();
            this.pendingCalls.push({ args, requesterPromise });
            this._tryCallBackend();
            return requesterPromise;
        });
        this._lastTryCallTime = new Date();
        //apply defaults
        this.options = Object.assign({ busyExtraPenalty: 1 }, options);
        if (this.options.minParallel < 1) {
            throw new Error("minParallel needs to be 1 or more");
        }
        this.metrics = { activeCount: 0, tooBusyWaitStart: new Date(0), lastGrow: new Date(0), lastMax: new Date(0), maxActive: options.minParallel, lastDecay: new Date(0), lastTooBusy: new Date(0) };
    }
    toJson() {
        return { pendingCalls: this.pendingCalls.length, activeCalls: this.activeCalls.length, metrics: this.metrics, options: this.options };
    }
    _tryCallBackend() {
        const now = new Date();
        try {
            while (true) {
                // ! /////////////  do housekeeping ///////////////////
                //check if we have to abort for various reasons
                if (this.pendingCalls.length === 0) {
                    //nothing to do
                    return;
                }
                if (this.metrics.activeCount >= this.metrics.maxActive) {
                    //make note that we are at our limit of requests
                    this.metrics.lastMax = now;
                }
                if (this.options.maxParallel != null && this.metrics.activeCount >= this.options.maxParallel) {
                    //at our hard limit of parallel requests
                    return;
                }
                if (this.metrics.activeCount >= this.metrics.maxActive //we are at our max...
                    && (this.metrics.lastGrow.getTime() + this.options.growDelayMs < now.getTime()) //we haven't grew recently...
                    && (this.metrics.tooBusyWaitStart.getTime() + this.options.busyGrowDelayMs < now.getTime()) //we are not in a options.busyWaitMs interval (haven't recieved a "TOO_BUSY" rejection recently...)
                ) {
                    //time to grow
                    this.metrics.maxActive++;
                    this.metrics.lastGrow = now;
                }
                const lastTryMsAgo = now.getTime() - this._lastTryCallTime.getTime();
                if (this.options.idleOrBusyDecreaseMs != null && this.metrics.lastDecay.getTime() + (this.options.idleOrBusyDecreaseMs + lastTryMsAgo) < now.getTime()) {
                    //havent decayed recently
                    if ((this.metrics.lastMax.getTime() + (this.options.idleOrBusyDecreaseMs + lastTryMsAgo) < now.getTime()) //havent been at max recently
                        || (this.metrics.lastTooBusy.getTime() + this.options.idleOrBusyDecreaseMs > now.getTime()) //OR we have gotten "TOO_BUSY" rejections since our last decay, so backoff
                    ) {
                        //time to reduce our maxActive
                        const reduceCount = 1 + Math.round((now.getTime() - this.metrics.lastMax.getTime()) / this.options.idleOrBusyDecreaseMs); //accumulating decays in case the autoScaler has been idle
                        log.throwCheck(reduceCount >= 0);
                        this.metrics.maxActive = Math.max(this.options.minParallel, this.metrics.maxActive - reduceCount);
                        //pretend we are at max, to properly delay growing.
                        this.metrics.lastMax = now;
                        this.metrics.lastDecay = now;
                    }
                }
                if (this.metrics.activeCount >= this.metrics.maxActive) {
                    //we are at our maxActive, wait for a free slot
                    return;
                }
                // ! ////////// Done with housekeeping and didn't early abort.   time to call the backend  /////////////////
                const { args, requesterPromise } = this.pendingCalls.shift();
                const activeMonitorPromise = bb.resolve(this.backendWorker(...args))
                    .then((result) => {
                    requesterPromise.fulfill(result);
                }, (_err) => {
                    //failure, see what to do about it
                    let verdict = this.failureListener(_err);
                    switch (verdict) {
                        case "FAIL":
                            requesterPromise.reject(_err);
                            break;
                        case "TOO_BUSY":
                            const tooBusyNow = new Date();
                            this.metrics.lastTooBusy = tooBusyNow;
                            //apply special backoffPenaltyCount options, if they exist
                            if (this.options.busyExtraPenalty != null && this.metrics.tooBusyWaitStart.getTime() + this.options.busyGrowDelayMs < tooBusyNow.getTime()) {
                                //this is a "fresh" backoff.
                                //we have exceeded backend capacity and been notified with a "TOO_BUSY" failure.  reduce our maxParallel according to the options.backoffPenaltyCount
                                this.metrics.maxActive = Math.max(this.options.minParallel, this.metrics.maxActive - this.options.busyExtraPenalty);
                                //set our "fresh" tooBusy time
                                this.metrics.tooBusyWaitStart = tooBusyNow;
                            }
                            //put request in front to try again
                            this.pendingCalls.unshift({ args, requesterPromise });
                            break;
                    }
                    return Promise.resolve();
                })
                    .finally(() => {
                    //remove this from actives array
                    this.metrics.activeCount--;
                    _.remove(this.activeCalls, (activeCall) => activeCall.requesterPromise === requesterPromise);
                    //try another pass
                    this._tryCallBackend();
                });
                this.metrics.activeCount++;
                this.activeCalls.push({ args, requesterPromise, activeMonitorPromise });
            }
        }
        catch (_err) {
            log.error(_err);
        }
        finally {
            this._lastTryCallTime = now;
            if (this.pendingCalls.length > 0 && this.metrics.activeCount >= this.metrics.maxActive) {
                //we have pending work, try again at minimum our next potential grow interval
                clearTimeout(this._heartbeatHandle); //only 1 pending callback, regardless of how many calls there were
                this._heartbeatHandle = setTimeout(() => { this._tryCallBackend(); }, this.options.growDelayMs);
            }
        }
    }
}
exports.Autoscaler = Autoscaler;
//# sourceMappingURL=threading.js.map