export class Exception extends Error {
	constructor( message: string ) {
		super( message );
		Object.setPrototypeOf( this, new.target.prototype );//fix inheritance, new in ts2.2: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
	}
}
