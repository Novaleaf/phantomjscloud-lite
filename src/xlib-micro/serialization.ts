///// <reference path="../../../typings/all.d.ts" />

// import * as reflection from "./reflection";
// import * as diagnostics from "./diagnostics";

// import * as stringHelper from "./_util/stringhelper";
import * as bb from "bluebird";
import * as _ from "lodash";
import luxon = require( "luxon" );
import numHelper = require( "./num-helper" );
import reflection = require( "./reflection" );
import stringHelper = require( "./str-helper" );


import json5 = require( "json5" );

/** awesome json parse and stringify capabilities */
export namespace jsonX {

	/** a forgiving JSON parser.  Allows for comments, unquoted keys, trailing commas, etc.   see: https://www.npmjs.com/package/json5
		*
							* Converts a JavaScript Object Notation (JSON) string into an object.
							* @param text A valid JSON string.
							* @param reviver A function that transforms the results. This function is called for each member of the object.
							* If a member contains nested objects, the nested objects are transformed before the parent object is.
							*/
	export const parse: ( text: string, reviver?: ( key: any, value: any ) => any ) => any = json5.parse.bind( json5 );


	/** parses your object using ```json5```, then attempts to parse string values in your object.  failed parse() calls will return the original string for that variable */
	export function parseRecursive(
		textOrObj: any,
		reviver?: ( key: any, value: any ) => any
	): any {


		if ( typeof ( textOrObj ) === "string" ) {
			try {
				textOrObj = parse( textOrObj, reviver );
			} catch ( ex ) {
				return textOrObj;
			}
		}
		_.forOwn( textOrObj, ( value, key, obj ) => {
			if ( typeof ( value ) === "string" ) {
				obj[ key ] = parseRecursive( value, reviver );
			}
		} );

		return textOrObj;
	}


	/**
			* Converts a JavaScript value to a JSON5 string, optionally replacing values if a replacer function is specified, or optionally including only the specified properties if a replacer array is specified.
			* @param value The value to convert to a JSON5 string.
			* @param replacer A function that alters the behavior of the stringification process, or an array of String and Number objects that serve as a whitelist for selecting/filtering the properties of the value object to be included in the JSON5 string. If this value is null or not provided, all properties of the object are included in the resulting JSON5 string.
			* @param space A String or Number object that's used to insert white space into the output JSON5 string for readability purposes. If this is a Number, it indicates the number of space characters to use as white space; this number is capped at 10 (if it is greater, the value is just 10). Values less than 1 indicate that no space should be used. If this is a String, the string (or the first 10 characters of the string, if it's longer than that) is used as white space. If this parameter is not provided (or is null), no white space is used. If white space is used, trailing commas will be used in objects and arrays.  @default "\t"
		 * @param quote  A String representing the quote character to use when serializing strings.
			*/
	export function stringify( value: any,
		replacer?: ( key: string, value: any ) => any | Array<number | string>,
		space?: string | number,
		quote?: string,
	): string;
	export function stringify( value: any, options?: {
		replacer?: ( key: string, value: any ) => any | Array<number | string>;
		space?: string | number;
		quote?: string;
	} ): string;
	export function stringify( value: any, ...args: Array<any> ) {
		let options: {
			replacer?: ( key: string, value: any ) => any | Array<number | string>;
			space?: string | number;
			quote?: string;
		};

		if ( reflection.getType( args[ 0 ] ) === reflection.Type.object ) {
			options = args[ 0 ];
		} else {
			options = {
				replacer: args[ 0 ],
				space: _.defaultTo( args[ 1 ], "\t" ),
				quote: args[ 2 ],
			};
		}
		return json5.stringify( value, options );
	}


	export interface IInspectOptions {
		/** how far down the object structure you wish to inspect.  No values deeper than the depth will be shown.  @default 1 (show current object's values, no children)*/ maxDepth?: number;
		/** maximum array elements you want to display for each array. (half at top, half at bottom)  @default 10 */maxArrayElements?: number;
		/** when we reach maxDepth, the length we summarize the values to.  @default 120 */summarizeLength?: number;

		aggrigateFunctions?: boolean;
	}
	export function inspectStringify( obj: any, options?: IInspectOptions
	) {
		const outputJson = inspectParse( obj, options );

	}
	/** debug inspection helper. outputs human readable JSON (but won't round-trip with .parse()).  handles circular references gracefully */
	export function inspectParse( obj: any, options?: IInspectOptions
	) {

		options = { maxArrayElements: 10, maxDepth: 1, summarizeLength: 120, ...options };

		return _inspectParse_internal( obj, options, [] );
	}
	/** internal helper to do actual parse work */
	function _inspectParse_internal( obj: any, parentOptions: IInspectOptions,
		/** for internal recursive use, tracking circular references. */
		parentSeenObjects: any,
	): any {
		let myOptions = _.clone( parentOptions );
		try {
			myOptions.maxDepth--;
			// ! circular reference detection
			/** cache of all objects to check for circular references.   see https://stackoverflow.com/questions/14962018/detecting-and-fixing-circular-references-in-javascript */
			const seenObjects = _.clone( parentSeenObjects );
			if ( _.isObject( obj ) ) {
				if ( parentSeenObjects.indexOf( obj ) !== -1 ) {
					return `[CIRCULAR REFERENCE type=${ reflection.getTypeName( obj ) }]`;
				}
				seenObjects.push( obj );
			}

			// ! output string value of node if possible
			const Type = reflection.Type;
			const type = reflection.getType( obj );
			switch ( type ) {
				case Type.boolean:
				case Type.number:
				case Type.null:
					return obj;
				case Type.undefined:
					return "[UNDEFINED]";
				case Type.string:
					return stringHelper.summarize( obj, myOptions.summarizeLength );
				case Type.Date:
					const asDate = obj as Date;
					const ago = luxon.DateTime.fromJSDate( asDate ).until( luxon.DateTime.utc() ).toDuration( undefined ).toFormat( "hh:mm:ss.SS" );
					//numHelper.format((Date.now()-asDate.getTime())/1000)
					return `${ asDate.toISOString() } (-${ ago })`;

				case Type.Error:
					const errOptions = { ...myOptions, maxDepth: myOptions.maxDepth + 1 };
					return _inspectParse_internal( JSON.stringify( obj ), errOptions, seenObjects );
				case Type.function:
					const asFunction = obj as Function;
					let funcStr = asFunction.toString();
					funcStr = stringHelper.removeAfter( funcStr, ")", true );
					funcStr = "[FUNCTION " + stringHelper.removeBefore( funcStr, "function " ) + "]";
					return stringHelper.summarize( funcStr, myOptions.summarizeLength );
				case Type.RegExp:
					const asRegEx = obj as RegExp;
					return stringHelper.summarize( asRegEx.toString(), myOptions.summarizeLength );
				case Type.classCtor:
					return `[CLASS ${ reflection.getTypeName( obj ) }]`;
				default:
					return `[INSPECT_TYPE_NOT_HANDLED  type=${ Type[ type ] }]`;
				case Type.Array:
				case Type.object:
					//for these cases, we need to recursively walk them.   see below

					break;
			}

			// ! the obj is an array, or object


			if ( myOptions.maxDepth < 0 ) {
				//at max depth.  output typename
				if ( type === Type.Array ) {
					const asArray = obj as Array<any>;
					return `[ARRAY len=${ asArray.length }]`;
				} else {
					return `[OBJECT typeName="${ reflection.getTypeName( obj ) }"]`;
				}
			}


			//recursivly walk children
			if ( _.isArray( obj ) === true ) {
				const objArray = obj as Array<any>;
				const toReturn = [];
				if ( objArray.length <= myOptions.maxArrayElements ) {
					//output all
					for ( let i = 0; i < objArray.length; i++ ) {
						toReturn.push( _inspectParse_internal( objArray[ i ], myOptions, seenObjects ) );
					}
				} else {
					//output top and bottom

					//top half
					let halfMax = Math.round( myOptions.maxArrayElements / 2 );
					for ( let i = 0; i < halfMax; i++ ) {
						toReturn.push( _inspectParse_internal( objArray[ i ], myOptions, seenObjects ) );
					}
					//missing middle
					toReturn.push( `[ARRAY_TRUNCATED len=${ objArray.length }]` );
					//bottom half
					for ( let i = 0; i < halfMax; i++ ) {
						const index = objArray.length - halfMax + i;
						if ( index < objArray.length ) {
							toReturn.push( _inspectParse_internal( objArray[ i ], myOptions, seenObjects ) );
						}
					}
				}
				// for ( let i = 0; i < objArray.length && i < maxArrayElements; i++ ) {
				// 	toReturn.push( inspect( objArray[ i ], maxDepth, maxArrayElements, summarizeLength ) );
				// }
				// if ( objArray.length > maxArrayElements ) {
				// 	toReturn.push( `*maxArrayElements reached.  len=${ objArray.length }*` );
				// }


				return toReturn;
			} else {
				//loop through object
				let functs: Array<string> = [];
				let toReturn: { [ key: string ]: any; } = {};
				_.forIn( obj, ( value, key ) => {
					const val = _inspectParse_internal( value, myOptions, seenObjects );

					//reduce verbosity of functions in the object
					if ( myOptions.aggrigateFunctions === true && ( typeof val === "string" ) && val.indexOf( "[FUNCTION" ) === 0 ) {
						let results = /^\[FUNCTION\s*([\S\s]{1,})\]$/.exec( val );
						if ( results != null ) {
							let funcDetails = results[ 1 ];
							if ( funcDetails.indexOf( key ) === 0 ) {
								//name of func is name as key, so don't display the redundant key
								functs.push( results[ 1 ] );
							} else {
								//function name is different display key
								functs.push( `${ key }=${ results[ 1 ] }` );
							}
						} else {
							//didnt' work, report it normally
							toReturn[ key ] = val;
						}

					} else {
						toReturn[ key ] = val;
					}
				} );
				if ( functs.length > 0 ) {
					toReturn[ `[FUNCTIONS count=${ functs.length }]` ] = functs.join( ", " );
				}

				return toReturn;
			}


		} catch ( _err ) {
			const err = _err as Error;
			return `[ERROR_PARSING name="${ err.name }", message="${ stringHelper.summarize( err.message, myOptions.summarizeLength ) }"]`;
		}


	}  //end fcn


	/** replace a branch of your JSON object.  good for pruning nested hiearchies, for example when wanting to decrease verbosity sent to user (before doing a JSON.stringify() )
		*
		* works on array children too
	*
	* @example
	let tree = { a:[{aa:0, ab:1}], b:{ ba:"hi", bb:"there"}};
	replaceNodes(tree, ["a.aa", "b.ba"],"*REMOVED*");
	// tree = {a[aa:"*REMOVED*",ab:1], b:{ ba:"*REMOVED", bb:"there"}};
		*/
	export function replaceNodes( targetObject: any,
		/** example:  'a.b.c.d' will remove the d node, replacing it (with null by default, effectively deleting)*/
		nodeHiearchyStrings: Array<string>, replaceWith: any = null, replaceEmptyLeafNodes: boolean = false ) {

		/** recursive helper for walking through the current hiearchy, replacing as it goes*/
		function currentNodeProcessor( previousNode: any, nodeName: string, hiearchyIndex: number, hiearchy: Array<string> ) {

			if ( previousNode == null || _.isString( previousNode ) ) {
				//if our previous node is null (or a string), nothing to do.
				return;
			}


			if ( hiearchyIndex === ( hiearchy.length - 1 ) ) {
				//the node is the last node in our hiearchy,
				//so we are on the node to remove.remove it and we are done
				if ( previousNode[ nodeName ] != null || replaceEmptyLeafNodes === true ) {
					previousNode[ nodeName ] = replaceWith;
				}
				return;
			}

			//walk down the hiearchy
			let thisNode = previousNode[ nodeName ];
			let nextHiearchyIndex = hiearchyIndex + 1;
			let nextNodeName = hiearchy[ nextHiearchyIndex ];
			if ( _.isArray( thisNode ) === true && _.isString( thisNode ) === false ) {
				//walk each element in the array automatically
				_.forEach( thisNode, ( element ) => {
					currentNodeProcessor( element, nextNodeName, nextHiearchyIndex, hiearchy );
				} );
				return;
			} else {
				currentNodeProcessor( thisNode, nextNodeName, nextHiearchyIndex, hiearchy );
			}

		}


		//loop through all nodeHiearchyStrings to remove, removing the leaf.
		_.forEach( nodeHiearchyStrings, ( hiearchyString ) => {
			if ( hiearchyString == null ) {
				return;
			}

			let hiearchy = hiearchyString.split( "." );

			if ( hiearchy.length < 1 ) {
				return;
			}

			currentNodeProcessor( targetObject, hiearchy[ 0 ], 0, hiearchy );

		} );
	}
}
