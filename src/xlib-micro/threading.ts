
import axios = require( "axios" );


import luxon = require( "luxon" );
import _ = require( "lodash" );
import promise = require( "./promise" );
import bb = require( "bluebird" );
import ex = require( "./exception" );
import numHelper = require( "./num-helper" );

import log = require( "./log-helper" );

/** required arguments when constructing a new autoscaler */

export interface IAutoscalerOptions {
	/** minimum parallel requests (maxActive) you allow, regardless of how long the autoscaler has been idle.  should be 1 or more.
	*/
	minParallel: number;
	/** optional.  set a max to number of parallel requests (maxActive) no matter how active the calls
		* @default undefined (no limit)
	*/
	maxParallel?: number;
	/** if we get a "TOO_BUSY" rejection (from the ```failureListener```), how long we should wait before trying to expand our maxActive again. */
	busyGrowDelayMs: number;
	/** when we are at max parallel and still able to successfully submit requests (not getting "TOO_BUSY" errors), how long to delay before increasing our maxActive by 1. */
	growDelayMs: number;
	/** when we are under our max parallel, how long before our max should decrease by 1 .   Also, when we are consistently getting "TOO_BUSY" rejections, we will decrease our maxActive by 1 this often.  pass null to never decay (not recomended).*/
	idleOrBusyDecreaseMs: number;
	/** optional.  when we first get a "TOO_BUSY" rejection, we will reduce maxActive by this amount.  interval to check if we should penalize resets after ```busyWaitMs```
     * Note: when too busy, we also reduce maxActive via the ```decayDelayMs``` parameter every so often (as set by decayDelayMs)..   set to 0 to have no penalty except that set by decayDelayMs
		* @default 1
	 */
	busyExtraPenalty?: number;


	// /** while there is pending work, how often to wakeup and see if we can submit more.  should be less than half of grow/decay delayMs
	//  * @default 1/10th of the minimum of  grow/decay delayMs
	//  */
	// heartbeatMs?: number,
}


export class RetryException extends ex.Exception {
	constructor( public statePtr: IRetryState, message: string ) {
		super( message );
	}

}

export class RetryTimeoutException extends RetryException { }


export interface IRetryOptions {

	/** exponential factor.  to bias retries towards taking more time. see [[delayHandler]] for details
	 * @default 1
	*/
	expFactor?: number;


	/** maximum number of attempts.  exceeding this will cause a ```RetryException``` to be thrown
	 * @default null (not used)
	 */
	maxRetries?: number | null;

	/** Duration Object or number of milliseconds. 
	 * 
	 * maximum time to wait (all attempts combined). exceeding this will cause a ```RetryException``` to be thrown . 
	 * @default ```60 seconds```
	 * */
	totalTimeout?: luxon.Duration | number;


	/** Duration Object or number of milliseconds. 
			 * @default ```60 seconds```
	 * 
	 * if a try exceeds this, it will be considered failed.   If your invocation function supports aborting, be sure you also set the [[abortHandler]] property
	 */
	tryTimeout?: luxon.Duration | number;

	/**  Duration Object or number of milliseconds. 
	 * @default ```0ms```
	 * 
	 *  how long to wait on the first retry, and the minimum wait for all retries.  Defaults to zero, though also see the [[maxJitter]] property*/
	baseWait?: luxon.Duration | number;

	/**  Duration Object or number of milliseconds. 
	 * @default ```5 seconds```
	 * 
	 *  the maximum to ever wait between each try. */
	maxWait?: luxon.Duration | number;

	/**  Duration Object or number of milliseconds.   
	 * @Default of ```100ms```
	 * 
	 * on each retry we add a random amount of extra time delay, the amount ranging from zero to this supplied ```maxJitter``` amount.
	 * 
	 * Jitter helps remove pathological cases of resource contention by smoothing out loads.
	 */
	maxJitter?: luxon.Duration | number;

	/** Optional.  Allows aborting a timed-out request.  
	 * 
	 * ***performance note:*** We do not retry until the abortHandler's returned promise resolves. */
	abortHandler?: ( err: RetryTimeoutException, ) => Promise<void>;

	/** Optional.  Allows interecepting the invocation function's response and manually decide if a failure occured.
	 * 
	 * return a rejected promise to retry
	 * 
	 * return a resolved promise to complete the invoke request. */
	responseHandler?: <TResult>( result: TResult, state: IRetryState ) => Promise<TResult>;
	/** Optional.  Allows interecepting the invocation function's error response and manually decide if a failure occured. 
	 * 
	 * return a rejected promise to retry
	 * 
	 * return a resolved promise to complete the invoke request.
	*/
	responseErrorHandler?: <TResult> ( err: Error, state: IRetryState ) => Promise<TResult>;


	/** Optional.  allows overriding the algorithm computing how long to wait between retries.  
	 * 
	 * default is ```nextSleep = min(waitCap,randBetween(baseWait,lastSleep*(try^expFactor))) + randBetween(0,maxJitter)``` which is loosely based on this article: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/ */
	delayHandler?: ( state: IRetryState ) => luxon.Duration | number;

}
/** state for this current [[Retry]].[[Retry.invoke]]() attempt */
export interface IRetryState {
	/** time that .invoke() was called */
	invokeTime: luxon.DateTime;
	/** the current, or next try.  the first try is ```1``` */
	try: number;
	/** the time the latest try started */
	tryStart: luxon.DateTime;

	/** the amount of time we last slept.   on the first try will be zero. */
	lastSleep: luxon.Duration;

	/** options passed to the [[Retry]] object ctor */
	options: IRetryOptions;

	/** the retry object associated */
	retryObject: Retry<any, any>;

}


/** helper class that wraps a ```workerFunc``` and if that fails when you invoke it, will retry as needed.   
 * 
 * By default, will retry at a semi-random time between ```options.baseWait``` and ```options.maxWait```, increasingly biased towards ```maxWait``` the more retry attempts fail.   You can configure your own custom retry logic by overriding the ```options.delayHandler```  */
export class Retry<TWorkerFunc extends ( ...args: any[] ) => Promise<TResult>, TResult>{

	constructor( public options: IRetryOptions,
		private workerFunc: TWorkerFunc ) {

		const rand = numHelper.randomInt;
		// tslint:disable-next-line: no-unbound-method
		const min = Math.min;

		//apply defaults
		options = {
			expFactor: 1,
			maxJitter: 100,
			baseWait: 0,
			totalTimeout: luxon.Duration.fromObject( { seconds: 60 } ),
			maxWait: luxon.Duration.fromObject( { seconds: 5 } ),
			tryTimeout: luxon.Duration.fromObject( { seconds: 60 } ),
			/** default is ```nextSleep = min(waitCap,randBetween(baseWait,lastSleep*(try^expFactor))) + randBetween(0,maxJitter)``` 
			 * which is loosely based on this article: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/ */
			delayHandler: ( s ) => min( s.options.maxWait.valueOf(), rand( s.options.baseWait.valueOf(), s.lastSleep.valueOf() * ( Math.pow( s.try, s.options.expFactor ) ) ) ) + rand( 0, s.options.maxJitter.valueOf() ),
			...options
		};
		this.options = options;

	}


	// public async invoke( ...args: TArgs[] ): Promise<TResult> {


	// }

	/** invoke the workerFunc passed via the constructor, and retries as needed. */
	public invoke: TWorkerFunc = async function __invoke( this: Retry<TWorkerFunc, TResult>, ...args: any[] ) {

		const state: IRetryState = {
			lastSleep: luxon.Duration.fromMillis( 0 ),
			options: this.options,
			retryObject: this,
			invokeTime: luxon.DateTime.utc(),
			tryStart: null,
			try: 0,
		};


		//loop trys until we either have a valid return or an explicit abort.
		while ( true ) {
			if ( state.try > this.options.maxRetries ) {
				throw new RetryException( state, "max tries exceeded" );
			}
			state.try++;

			const timeoutMs = Math.min( this.options.totalTimeout.valueOf() - luxon.DateTime.utc().diff( state.invokeTime ).valueOf(), this.options.tryTimeout.valueOf() );
			if ( timeoutMs < 0 ) {
				throw new RetryTimeoutException( state, `timeout exceeded on try ${ state.try }.  timeLeft=${ timeoutMs }.  totalTimeout=${ this.options.totalTimeout.valueOf() }, startTime=${ state.invokeTime.toISOTime() }` );
			}


			const tryTimeoutMessage = "try timeout exceeded";
			try {
				state.tryStart = luxon.DateTime.utc();
				let invokeResult = await bb.resolve( this.workerFunc( ...args ) ).timeout( timeoutMs, new RetryTimeoutException( state, tryTimeoutMessage ) );
				if ( this.options.responseHandler != null ) {
					//let user filter the result
					invokeResult = await this.options.responseHandler( invokeResult, state );
				}
				return invokeResult;
			} catch ( _err ) {
				const err = _err as Error;
				//could fail due to timeout, or error in the invoked function.
				if ( err instanceof RetryTimeoutException && err.statePtr === state && err.message === tryTimeoutMessage ) {
					//this try timed out.
					if ( this.options.abortHandler != null ) {
						//allow graceful abort
						await this.options.abortHandler( err );
					}
				}
				//allow user handling of whatever error
				if ( this.options.responseHandler != null ) {
					const toReturn = await this.options.responseErrorHandler<TResult>( err, state );
					//valid toReturn.  if the above promise was rejected, await would throw.
					return toReturn;
				}

				//if here, an error.  retry
				const delayMs = this.options.delayHandler( state ).valueOf();

				//make sure our next try time doesn't exceed our totalTimeout
				const nextRetryTime = luxon.DateTime.utc().plus( { milliseconds: delayMs } );
				const minTimeThatWillElapse = nextRetryTime.diff( state.invokeTime );
				if ( minTimeThatWillElapse.valueOf() > this.options.totalTimeout.valueOf() ) {
					throw new RetryTimeoutException( state, `options.totalTimeout would be exceeded upon next try attempt, so aborting now (try=${ state.try }).` );
				}

				await bb.delay( delayMs );
				continue;
			}

		}

	} as any;


}

/** while this is probably only useful+used by the ```net.RemoteHttpEndpoint``` class, this is a generic autoscaler implementation,
	* meaning that it will scale requests to a ```backendWorker``` function, gradually increasing activeParallel requests over time.   Requests exceeding activeParallel will be queued in a FIFO fashion.
	*
	the only requirement is that the target ```backendWorker``` function  return a promise,
    * and you specify a ```failureListener``` function that can tell the difference between a failure and a need for backing off.
    */
export class Autoscaler<TWorkerFunc extends ( ...args: Array<any> ) => Promise<any>, TError extends Error>{

	constructor(
		private options: IAutoscalerOptions,
		private backendWorker: TWorkerFunc,
		/** will be used to intercept failures (promise rejections) from the ```backendWorker``` function.  should return "FAIL" if it's a normal failure (to be returned to the caller) or "TOO_BUSY" if the request should be retried  */
		private failureListener: ( ( err: TError ) => "FAIL" | "TOO_BUSY" ),
	) {

		//apply defaults
		this.options = {
			busyExtraPenalty: 1,
			//heartbeatMs: Math.min( options.growDelayMs, options.idleOrBusyDecreaseMs ) / 10,
			...options
		};

		if ( this.options.minParallel < 1 ) {
			throw new Error( "minParallel needs to be 1 or more" );
		}

		this.metrics = { activeCount: 0, tooBusyWaitStart: new Date( 0 ), lastGrow: new Date( 0 ), lastMax: new Date( 0 ), maxActive: options.minParallel, lastDecay: new Date( 0 ), lastTooBusy: new Date( 0 ) };


	}

	private metrics: {
		/** the max number of active parallel requests we currently allow.   increases and decreases based on the growDelayMs and decayDelayMs */
		maxActive: number;
		/** time in which we decided to stop growing (based on options.busyWaitMs ) */
		tooBusyWaitStart: Date;
		/** the current number of parallel requests active in our backendWorker */
		activeCount: number;
		/** the last time we grew our maxActive count  */
		lastGrow: Date;
		/** the last time we were at our maxActive count */
		lastMax: Date;
		/** the last time we got a "TOO_BUSY" rejection from the backendWorker.  note that this could happen while in a options.busyWaitMs interval, if the backend is sufficently overwhelmed */
		lastTooBusy: Date;
		/** the last time we decayed our maxActive */
		lastDecay: Date;
	};

	private pendingCalls: Array<{ args: Array<any>; requesterPromise: promise.IExposedPromise<any>; }> = [];

	private activeCalls: Array<{ args: Array<any>; requesterPromise: promise.IExposedPromise<any>; activeMonitorPromise: bb<any>; }> = [];

	public toJson() {
		return { pendingCalls: this.pendingCalls.length, activeCalls: this.activeCalls.length, metrics: this.metrics, options: this.options };
	}

	/** submit a request to the backend worker.
	 *
	 * **Important note**: to avoid "unhandled promise rejections" you need to make sure the returned Promise has a catch() applied to it.
	 * **NOT** just store the promise in an array to inspect later.  This is because if the request fails, the returned promise gets rejected, and if the Promise internal logic doesn't see a .catch() it will show the global "unhandled rejected promse" soft error message.
	 */
	public submitRequest: TWorkerFunc =
		//a worker with generic input/return args, cast to our specific worker function's sig
		( async ( ...args: Array<any> ): Promise<any> => {
			const requesterPromise = promise.CreateExposedPromise<any>();
			this.pendingCalls.push( { args, requesterPromise } );
			this._tryCallBackend();
			return requesterPromise;
		} ) as any;


	private _lastTryCallTime = new Date();
	private _tryCallBackend() {
		const now = new Date();
		try {
			while ( true ) {

				// ! /////////////  do housekeeping ///////////////////

				//check if we have to abort for various reasons
				if ( this.pendingCalls.length === 0 ) {
					//nothing to do
					return;
				}
				if ( this.metrics.activeCount >= this.metrics.maxActive ) {
					//make note that we are at our limit of requests
					this.metrics.lastMax = now;
				}
				if ( this.options.maxParallel != null && this.metrics.activeCount >= this.options.maxParallel ) {
					//at our hard limit of parallel requests
					return;
				}
				if ( this.metrics.activeCount >= this.metrics.maxActive //we are at our max...
					&& ( this.metrics.lastGrow.getTime() + this.options.growDelayMs < now.getTime() ) //we haven't grew recently...
					&& ( this.metrics.tooBusyWaitStart.getTime() + this.options.busyGrowDelayMs < now.getTime() ) //we are not in a options.busyWaitMs interval (haven't recieved a "TOO_BUSY" rejection recently...)
				) {
					//time to grow
					this.metrics.maxActive++;
					this.metrics.lastGrow = now;
				}
				const lastTryMsAgo = now.getTime() - this._lastTryCallTime.getTime();
				if ( this.options.idleOrBusyDecreaseMs != null && this.metrics.lastDecay.getTime() + ( this.options.idleOrBusyDecreaseMs + lastTryMsAgo ) < now.getTime() ) {
					//havent decayed recently
					if (
						( this.metrics.lastMax.getTime() + ( this.options.idleOrBusyDecreaseMs + lastTryMsAgo ) < now.getTime() ) //havent been at max recently
						|| ( this.metrics.lastTooBusy.getTime() + this.options.idleOrBusyDecreaseMs > now.getTime() ) //OR we have gotten "TOO_BUSY" rejections since our last decay, so backoff
					) {
						//time to reduce our maxActive
						const reduceCount = 1 + Math.round( ( now.getTime() - this.metrics.lastMax.getTime() ) / this.options.idleOrBusyDecreaseMs );//accumulating decays in case the autoScaler has been idle
						log.throwCheck( reduceCount >= 0 );
						this.metrics.maxActive = Math.max( this.options.minParallel, this.metrics.maxActive - reduceCount );
						//pretend we are at max, to properly delay growing.
						this.metrics.lastMax = now;
						this.metrics.lastDecay = now;
					}

				}

				if ( this.metrics.activeCount >= this.metrics.maxActive ) {
					//we are at our maxActive, wait for a free slot
					return;
				}

				// ! ////////// Done with housekeeping and didn't early abort.   time to call the backend  /////////////////

				const { args, requesterPromise } = this.pendingCalls.shift();
				const activeMonitorPromise = bb.resolve( this.backendWorker( ...args ) )
					.then( ( result ) => {
						requesterPromise.fulfill( result );
					}, ( _err ) => {
						//failure, see what to do about it
						let verdict = this.failureListener( _err );
						switch ( verdict ) {
							case "FAIL":
								requesterPromise.reject( _err );
								break;
							case "TOO_BUSY":
								const tooBusyNow = new Date();
								this.metrics.lastTooBusy = tooBusyNow;
								//apply special backoffPenaltyCount options, if they exist
								if ( this.options.busyExtraPenalty != null && this.metrics.tooBusyWaitStart.getTime() + this.options.busyGrowDelayMs < tooBusyNow.getTime() ) {
									//this is a "fresh" backoff.
									//we have exceeded backend capacity and been notified with a "TOO_BUSY" failure.  reduce our maxParallel according to the options.backoffPenaltyCount
									this.metrics.maxActive = Math.max( this.options.minParallel, this.metrics.maxActive - this.options.busyExtraPenalty );

									//set our "fresh" tooBusy time
									this.metrics.tooBusyWaitStart = tooBusyNow;
								}
								//put request in front to try again
								this.pendingCalls.unshift( { args, requesterPromise } );
								break;
						}
						return Promise.resolve();
					} )
					.finally( () => {
						//remove this from actives array
						this.metrics.activeCount--;
						_.remove( this.activeCalls, ( activeCall ) => activeCall.requesterPromise === requesterPromise );
						//try another pass
						this._tryCallBackend();
					} );

				this.metrics.activeCount++;
				this.activeCalls.push( { args, requesterPromise, activeMonitorPromise } );
			}

		} catch ( _err ) {
			log.error( _err );
		} finally {
			this._lastTryCallTime = now;
			if ( this.pendingCalls.length > 0 && this.metrics.activeCount >= this.metrics.maxActive ) {
				//we have pending work, try again at minimum our next potential grow interval
				clearTimeout( this._heartbeatHandle ); //only 1 pending callback, regardless of how many calls there were
				this._heartbeatHandle = setTimeout( () => { this._tryCallBackend(); }, this.options.growDelayMs );
			}
		}
	}
	private _heartbeatHandle: any;
}
