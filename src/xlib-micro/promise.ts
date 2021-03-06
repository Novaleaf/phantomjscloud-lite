
/** https://github.com/petkaantonov/bluebird  Bluebird is a fully featured promise library with focus on innovative features and performance
 * global.Promise is aliased to this.
 */
import bluebird = require( "bluebird" );


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

export function awaitInspect<T>( promise: PromiseLike<T> ): bluebird<{ toInspect: bluebird<T>; }> {

	let toInspect = bluebird.resolve( promise );

	let results = { toInspect };


	// let tryToReturn = {

	// 	the

	// };


	let toReturn = CreateExposedPromise<{ toInspect: bluebird<T>; }>();

	toInspect.then( ( result ) => {
		toReturn.fulfill( results );
	}, ( err ) => {
		toReturn.fulfill( results );
	} );

	// toInspect.finally( () => {
	// 	toReturn.fulfill( results );
	// } );

	return toReturn;

}


/** inversion of control (IoC) to let the caller specify work that will be done by the async method.     values can be a promise, function (sync or async), or result */
export type IocCallback<TArgs = void, TResults = any> = Promise<TResults> | ( ( args: TArgs ) => Promise<TResults> ) | ( ( args: TArgs ) => TResults ) | TResults;


// /** Reactive Extensions https://github.com/Reactive-Extensions/RxJS
// ...is a set of libraries to compose asynchronous and event-based programs using observable collections and Array#extras style composition in JavaScript
//  * global.Rx is aliased to this.
//  */
// export import rx = require( "rx" );
// global[ "Rx" ] = rx;
// rx.config.Promise = bluebird;

/** gets a promise which includes the "fulfill()" and "reject()" methods to allow external code to fullfill it.*/
export function CreateExposedPromise<TReturn = void>(): IExposedPromise<TReturn, never>;
export function CreateExposedPromise<TReturn = void, TTags = void>( tags: TTags,
	callback?: ( fulfill: ( resultOrThenable?: TReturn | PromiseLike<TReturn> ) => void, reject: ( error: any ) => void ) => void,
): IExposedPromise<TReturn, TTags>;
export function CreateExposedPromise<TReturn = void, TTags = void>( ...args: Array<any> ): IExposedPromise<TReturn, TTags> {
	const tags = args[ 0 ] as TTags;
	const callback = args[ 1 ];
	let fulfiller: ( resultOrThenable?: TReturn | PromiseLike<TReturn> ) => void;
	let rejector: ( error: any ) => void;

	let toReturn: IExposedPromise<TReturn, TTags> = <any>new bluebird<TReturn>( function ( fulfill, reject ) {
		fulfiller = fulfill;
		rejector = reject;
		if ( callback != null ) {
			callback.apply( toReturn, arguments );
		}
	} );

	toReturn.fulfill = fulfiller;
	toReturn.reject = rejector;
	toReturn.tags = tags;

	return toReturn;
}

export interface IExposedPromise<TReturn = void, TTags = never> extends bluebird<TReturn> {
	fulfill: ( resultOrThenable?: TReturn | PromiseLike<TReturn> ) => void;
	reject: ( error: Error ) => void;
	/** custom data for tracking state you might need, such as informing if the promise is being executed */
	tags?: TTags;
}


export namespace _BluebirdRetryInternals {
	export interface IOptions {
		/**  initial wait time between attempts in milliseconds(default 1000)*/
		interval?: number;
		/**  if specified, increase interval by this factor between attempts*/
		backoff?: number;
		/** if specified, maximum amount that interval can increase to*/
		max_interval?: number;
		/** total time to wait for the operation to succeed in milliseconds*/
		timeout?: number;
		/** maximum number of attempts to try the operation*/
		max_tries?: number;

		/** to be used as bluebird's Filtered Catch. func will be retried only if the predicate expectation is met, it will otherwise fail immediately. */
		predicate?: any;
		/** to throw the last thrown error instance rather then a timeout error. */
		throw_original?: boolean;
		/**  if specified, is used as the this context when calling func */
		context?: any;
		/** if specified, is passed as arguments to func */
		args?: any;
	}
	/**
	 *  Stopping
The library also supports stopping the retry loop before the timeout occurs by throwing a new instance of retry.StopError from within the called function.

For example:

let retry = require('bluebird-retry');
let i = 0;
let err;
let swing = function() {
    i++;
    console.log('strike ' + i);
    if (i == 3) {
        throw new retry.StopError('yer out');
    }
    throw new Error('still up at bat');
};

retry(swing, {timeout: 10000})
.catch(function(e) {
    console.log(e.message)
});
Will display:

strike 1
strike 2
strike 3
yer out
The StopError constructor accepts one argument. If it is invoked with an instance of Error, then the promise is rejected with that error argument. Otherwise the promise is rejected with the StopError itself.*

	 */
	// tslint:disable-next-line: no-unnecessary-class
	export declare class StopError {
		constructor(
			/** The StopError constructor accepts one argument. If it is invoked with an instance of Error, then the promise is rejected with that error argument. Otherwise the promise is rejected with the StopError itself.*/
			message?: string | Error );
	}

	export interface IRetryStatic {
		<TValue>( fn: () => PromiseLike<TValue>, options?: IOptions ): bluebird<TValue>;
		/** Stopping
The library also supports stopping the retry loop before the timeout occurs by throwing a new instance of retry.StopError from within the called function.
		The StopError constructor accepts one argument. If it is invoked with an instance of Error, then the promise is rejected with that error argument. Otherwise the promise is rejected with the StopError itself.*/
		StopError: typeof StopError;
	}
}
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
export const retry: _BluebirdRetryInternals.IRetryStatic = require( "bluebird-retry" );


declare function require( ...args: any[] ): any;

