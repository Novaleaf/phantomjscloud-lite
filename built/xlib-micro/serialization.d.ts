/** awesome json parse and stringify capabilities */
export declare namespace jsonX {
    /** a forgiving JSON parser.  Allows for comments, unquoted keys, trailing commas, etc.   see: https://www.npmjs.com/package/json5
        *
                            * Converts a JavaScript Object Notation (JSON) string into an object.
                            * @param text A valid JSON string.
                            * @param reviver A function that transforms the results. This function is called for each member of the object.
                            * If a member contains nested objects, the nested objects are transformed before the parent object is.
                            */
    const parse: (text: string, reviver?: (key: any, value: any) => any) => any;
    /** parses your object using ```json5```, then attempts to parse string values in your object.  failed parse() calls will return the original string for that variable */
    function parseRecursive(textOrObj: any, reviver?: (key: any, value: any) => any): any;
    /**
            * Converts a JavaScript value to a JSON5 string, optionally replacing values if a replacer function is specified, or optionally including only the specified properties if a replacer array is specified.
            * @param value The value to convert to a JSON5 string.
            * @param replacer A function that alters the behavior of the stringification process, or an array of String and Number objects that serve as a whitelist for selecting/filtering the properties of the value object to be included in the JSON5 string. If this value is null or not provided, all properties of the object are included in the resulting JSON5 string.
            * @param space A String or Number object that's used to insert white space into the output JSON5 string for readability purposes. If this is a Number, it indicates the number of space characters to use as white space; this number is capped at 10 (if it is greater, the value is just 10). Values less than 1 indicate that no space should be used. If this is a String, the string (or the first 10 characters of the string, if it's longer than that) is used as white space. If this parameter is not provided (or is null), no white space is used. If white space is used, trailing commas will be used in objects and arrays.  @default "\t"
         * @param quote  A String representing the quote character to use when serializing strings.
            */
    function stringify(value: any, replacer?: (key: string, value: any) => any | Array<number | string>, space?: string | number, quote?: string): string;
    function stringify(value: any, options?: {
        replacer?: (key: string, value: any) => any | Array<number | string>;
        space?: string | number;
        quote?: string;
    }): string;
    interface IInspectOptions {
        /** how far down the object structure you wish to inspect.  No values deeper than the depth will be shown.  @default 1 (show current object's values, no children)*/ maxDepth?: number;
        /** maximum array elements you want to display for each array. (half at top, half at bottom)  @default 10 */ maxArrayElements?: number;
        /** when we reach maxDepth, the length we summarize the values to.  @default 120 */ summarizeLength?: number;
        aggrigateFunctions?: boolean;
    }
    function inspectStringify(obj: any, options?: IInspectOptions): void;
    /** debug inspection helper. outputs human readable JSON (but won't round-trip with .parse()).  handles circular references gracefully */
    function inspectParse(obj: any, options?: IInspectOptions): any;
    /** replace a branch of your JSON object.  good for pruning nested hiearchies, for example when wanting to decrease verbosity sent to user (before doing a JSON.stringify() )
        *
        * works on array children too
    *
    * @example
    let tree = { a:[{aa:0, ab:1}], b:{ ba:"hi", bb:"there"}};
    replaceNodes(tree, ["a.aa", "b.ba"],"*REMOVED*");
    // tree = {a[aa:"*REMOVED*",ab:1], b:{ ba:"*REMOVED", bb:"there"}};
        */
    function replaceNodes(targetObject: any, 
    /** example:  'a.b.c.d' will remove the d node, replacing it (with null by default, effectively deleting)*/
    nodeHiearchyStrings: Array<string>, replaceWith?: any, replaceEmptyLeafNodes?: boolean): void;
}
//# sourceMappingURL=serialization.d.ts.map