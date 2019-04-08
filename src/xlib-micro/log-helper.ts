import ex = require( "./exception" );


export enum LOGLEVEL {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
	NONE = 4,
}
export let logLevel: LOGLEVEL = LOGLEVEL.DEBUG;


class LogThrowException extends ex.Exception { }


export function throwCheck( testCondition: boolean, message: string = "testCondition failed.  Please check source code for details.", ...otherArgs: any[] ): void {
	if ( testCondition === true ) {
		return;
	}
	if ( testCondition !== false ) {
		throw new ex.Exception( "first parameter must be a boolean (to assert must evaluate to true or false)" );
	}
	if ( otherArgs != null && otherArgs.length > 0 ) {
		message += JSON.stringify( otherArgs );
	}
	// tslint:disable-next-line: no-console
	console.error( "throwCheck: " + message );

	throw new LogThrowException( message );

}

export function debug( message: string, ...otherArgs: any[] ): void {
	if ( logLevel > LOGLEVEL.DEBUG ) {
		return;
	}
	if ( otherArgs != null && otherArgs.length > 0 ) {
		message += JSON.stringify( otherArgs );
	}
	// tslint:disable-next-line: no-console
	console.debug( "debug: " + message );
}
export function warn( message: string, ...otherArgs: any[] ): void {
	if ( logLevel > LOGLEVEL.WARN ) {
		return;
	}
	if ( otherArgs != null && otherArgs.length > 0 ) {
		message += JSON.stringify( otherArgs );
	}
	// tslint:disable-next-line: no-console
	console.warn( "warn: " + message );
}
export function error( message: string, ...otherArgs: any[] ): ex.Exception {
	if ( logLevel > LOGLEVEL.ERROR ) {
		return undefined;
	}
	if ( otherArgs != null && otherArgs.length > 0 ) {
		message += JSON.stringify( otherArgs );
	}
	// tslint:disable-next-line: no-console
	console.error( "error: " + message );
	return new ex.Exception( message );
}
