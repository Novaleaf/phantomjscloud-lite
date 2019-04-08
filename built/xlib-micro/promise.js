"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/** https://github.com/petkaantonov/bluebird  Bluebird is a fully featured promise library with focus on innovative features and performance
 * global.Promise is aliased to this.
 */
const bluebird = require("bluebird");
/** helper to avoid throws in your code (so in dev time, avoid triggering "break on all exceptions").
    * **VERY** useful in codepaths that reject during normal operation, but not very useful otherwise.
    *
    * will await the promise to fulfill/reject, then return a resolved bluebird promise so you can inspect the error or obtain the results.
    @example
    const awaitInspect = xlib.promise.awaitInspect;
    const {toInspect} = await awaitInspect(yourClass.asyncMethod());
if(toInspect.isFulfilled()){
    const value = toInspect.value();
    //do stuff with value
}else{
    const err = toInspect.reason();
    //do stuff with err
}
 */
function awaitInspect(promise) {
    let toInspect = bluebird.resolve(promise);
    let results = { toInspect };
    // let tryToReturn = {
    // 	the
    // };
    let toReturn = CreateExposedPromise();
    toInspect.then((result) => {
        toReturn.fulfill(results);
    }, (err) => {
        toReturn.fulfill(results);
    });
    // toInspect.finally( () => {
    // 	toReturn.fulfill( results );
    // } );
    return toReturn;
}
exports.awaitInspect = awaitInspect;
function CreateExposedPromise(...args) {
    const tags = args[0];
    const callback = args[1];
    let fulfiller;
    let rejector;
    let toReturn = new bluebird(function (fulfill, reject) {
        fulfiller = fulfill;
        rejector = reject;
        if (callback != null) {
            callback.apply(toReturn, arguments);
        }
    });
    toReturn.fulfill = fulfiller;
    toReturn.reject = rejector;
    toReturn.tags = tags;
    return toReturn;
}
exports.CreateExposedPromise = CreateExposedPromise;
var _BluebirdRetryInternals;
(function (_BluebirdRetryInternals) {
})(_BluebirdRetryInternals = exports._BluebirdRetryInternals || (exports._BluebirdRetryInternals = {}));
/**
 *  The ```bluebird-retry``` module:  https://www.npmjs.com/package/bluebird-retry
utility for retrying a bluebird promise until it succeeds
This very simple library provides a function for retrying an asynchronous operation until it succeeds. An "asynchronous operation" is embodied by a function that returns a promise or returns synchronously.

It supports regular intervals and exponential backoff with a configurable limit, as well as an overall timeout for the operation that limits the number of retries.

The bluebird library supplies the promise implementation.

Basic Usage
let Promise = require('bluebird');
let retry = require('bluebird-retry');

let count = 0;
function myfunc() {
    console.log('myfunc called ' + (++count) + ' times');
    if (count < 3) {
        return bb.reject(new Error('fail the first two times'));
    } else {
        return bb.resolve('succeed the third time');
    }
}

retry(myfunc).done(function(result) {
    console.log(result);
});
 */
exports.retry = require("bluebird-retry");
//# sourceMappingURL=promise.js.map