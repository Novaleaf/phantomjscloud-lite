"use strict";
///// <reference path="../../../typings/all.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const _ = tslib_1.__importStar(require("lodash"));
const luxon = require("luxon");
const reflection = require("./reflection");
const stringHelper = require("./str-helper");
const json5 = require("json5");
/** awesome json parse and stringify capabilities */
var jsonX;
(function (jsonX) {
    /** a forgiving JSON parser.  Allows for comments, unquoted keys, trailing commas, etc.   see: https://www.npmjs.com/package/json5
        *
                            * Converts a JavaScript Object Notation (JSON) string into an object.
                            * @param text A valid JSON string.
                            * @param reviver A function that transforms the results. This function is called for each member of the object.
                            * If a member contains nested objects, the nested objects are transformed before the parent object is.
                            */
    jsonX.parse = json5.parse.bind(json5);
    /** parses your object using ```json5```, then attempts to parse string values in your object.  failed parse() calls will return the original string for that variable */
    function parseRecursive(textOrObj, reviver) {
        if (typeof (textOrObj) === "string") {
            try {
                textOrObj = jsonX.parse(textOrObj, reviver);
            }
            catch (ex) {
                return textOrObj;
            }
        }
        _.forOwn(textOrObj, (value, key, obj) => {
            if (typeof (value) === "string") {
                obj[key] = parseRecursive(value, reviver);
            }
        });
        return textOrObj;
    }
    jsonX.parseRecursive = parseRecursive;
    function stringify(value, ...args) {
        let options;
        if (reflection.getType(args[0]) === reflection.Type.object) {
            options = args[0];
        }
        else {
            options = {
                replacer: args[0],
                space: _.defaultTo(args[1], "\t"),
                quote: args[2],
            };
        }
        return json5.stringify(value, options);
    }
    jsonX.stringify = stringify;
    function inspectStringify(obj, options) {
        const outputJson = inspectParse(obj, options);
    }
    jsonX.inspectStringify = inspectStringify;
    /** debug inspection helper. outputs human readable JSON (but won't round-trip with .parse()).  handles circular references gracefully */
    function inspectParse(obj, options) {
        options = Object.assign({ maxArrayElements: 10, maxDepth: 1, summarizeLength: 120 }, options);
        return _inspectParse_internal(obj, options, []);
    }
    jsonX.inspectParse = inspectParse;
    /** internal helper to do actual parse work */
    function _inspectParse_internal(obj, parentOptions, 
    /** for internal recursive use, tracking circular references. */
    parentSeenObjects) {
        let myOptions = _.clone(parentOptions);
        try {
            myOptions.maxDepth--;
            // ! circular reference detection
            /** cache of all objects to check for circular references.   see https://stackoverflow.com/questions/14962018/detecting-and-fixing-circular-references-in-javascript */
            const seenObjects = _.clone(parentSeenObjects);
            if (_.isObject(obj)) {
                if (parentSeenObjects.indexOf(obj) !== -1) {
                    return `[CIRCULAR REFERENCE type=${reflection.getTypeName(obj)}]`;
                }
                seenObjects.push(obj);
            }
            // ! output string value of node if possible
            const Type = reflection.Type;
            const type = reflection.getType(obj);
            switch (type) {
                case Type.boolean:
                case Type.number:
                case Type.null:
                    return obj;
                case Type.undefined:
                    return "[UNDEFINED]";
                case Type.string:
                    return stringHelper.summarize(obj, myOptions.summarizeLength);
                case Type.Date:
                    const asDate = obj;
                    const ago = luxon.DateTime.fromJSDate(asDate).until(luxon.DateTime.utc()).toDuration(undefined).toFormat("hh:mm:ss.SS");
                    //numHelper.format((Date.now()-asDate.getTime())/1000)
                    return `${asDate.toISOString()} (-${ago})`;
                case Type.Error:
                    const errOptions = Object.assign({}, myOptions, { maxDepth: myOptions.maxDepth + 1 });
                    return _inspectParse_internal(JSON.stringify(obj), errOptions, seenObjects);
                case Type.function:
                    const asFunction = obj;
                    let funcStr = asFunction.toString();
                    funcStr = stringHelper.removeAfter(funcStr, ")", true);
                    funcStr = "[FUNCTION " + stringHelper.removeBefore(funcStr, "function ") + "]";
                    return stringHelper.summarize(funcStr, myOptions.summarizeLength);
                case Type.RegExp:
                    const asRegEx = obj;
                    return stringHelper.summarize(asRegEx.toString(), myOptions.summarizeLength);
                case Type.classCtor:
                    return `[CLASS ${reflection.getTypeName(obj)}]`;
                default:
                    return `[INSPECT_TYPE_NOT_HANDLED  type=${Type[type]}]`;
                case Type.Array:
                case Type.object:
                    //for these cases, we need to recursively walk them.   see below
                    break;
            }
            // ! the obj is an array, or object
            if (myOptions.maxDepth < 0) {
                //at max depth.  output typename
                if (type === Type.Array) {
                    const asArray = obj;
                    return `[ARRAY len=${asArray.length}]`;
                }
                else {
                    return `[OBJECT typeName="${reflection.getTypeName(obj)}"]`;
                }
            }
            //recursivly walk children
            if (_.isArray(obj) === true) {
                const objArray = obj;
                const toReturn = [];
                if (objArray.length <= myOptions.maxArrayElements) {
                    //output all
                    for (let i = 0; i < objArray.length; i++) {
                        toReturn.push(_inspectParse_internal(objArray[i], myOptions, seenObjects));
                    }
                }
                else {
                    //output top and bottom
                    //top half
                    let halfMax = Math.round(myOptions.maxArrayElements / 2);
                    for (let i = 0; i < halfMax; i++) {
                        toReturn.push(_inspectParse_internal(objArray[i], myOptions, seenObjects));
                    }
                    //missing middle
                    toReturn.push(`[ARRAY_TRUNCATED len=${objArray.length}]`);
                    //bottom half
                    for (let i = 0; i < halfMax; i++) {
                        const index = objArray.length - halfMax + i;
                        if (index < objArray.length) {
                            toReturn.push(_inspectParse_internal(objArray[i], myOptions, seenObjects));
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
            }
            else {
                //loop through object
                let functs = [];
                let toReturn = {};
                _.forIn(obj, (value, key) => {
                    const val = _inspectParse_internal(value, myOptions, seenObjects);
                    //reduce verbosity of functions in the object
                    if (myOptions.aggrigateFunctions === true && (typeof val === "string") && val.indexOf("[FUNCTION") === 0) {
                        let results = /^\[FUNCTION\s*([\S\s]{1,})\]$/.exec(val);
                        if (results != null) {
                            let funcDetails = results[1];
                            if (funcDetails.indexOf(key) === 0) {
                                //name of func is name as key, so don't display the redundant key
                                functs.push(results[1]);
                            }
                            else {
                                //function name is different display key
                                functs.push(`${key}=${results[1]}`);
                            }
                        }
                        else {
                            //didnt' work, report it normally
                            toReturn[key] = val;
                        }
                    }
                    else {
                        toReturn[key] = val;
                    }
                });
                if (functs.length > 0) {
                    toReturn[`[FUNCTIONS count=${functs.length}]`] = functs.join(", ");
                }
                return toReturn;
            }
        }
        catch (_err) {
            const err = _err;
            return `[ERROR_PARSING name="${err.name}", message="${stringHelper.summarize(err.message, myOptions.summarizeLength)}"]`;
        }
    } //end fcn
    /** replace a branch of your JSON object.  good for pruning nested hiearchies, for example when wanting to decrease verbosity sent to user (before doing a JSON.stringify() )
        *
        * works on array children too
    *
    * @example
    let tree = { a:[{aa:0, ab:1}], b:{ ba:"hi", bb:"there"}};
    replaceNodes(tree, ["a.aa", "b.ba"],"*REMOVED*");
    // tree = {a[aa:"*REMOVED*",ab:1], b:{ ba:"*REMOVED", bb:"there"}};
        */
    function replaceNodes(targetObject, 
    /** example:  'a.b.c.d' will remove the d node, replacing it (with null by default, effectively deleting)*/
    nodeHiearchyStrings, replaceWith = null, replaceEmptyLeafNodes = false) {
        /** recursive helper for walking through the current hiearchy, replacing as it goes*/
        function currentNodeProcessor(previousNode, nodeName, hiearchyIndex, hiearchy) {
            if (previousNode == null || _.isString(previousNode)) {
                //if our previous node is null (or a string), nothing to do.
                return;
            }
            if (hiearchyIndex === (hiearchy.length - 1)) {
                //the node is the last node in our hiearchy,
                //so we are on the node to remove.remove it and we are done
                if (previousNode[nodeName] != null || replaceEmptyLeafNodes === true) {
                    previousNode[nodeName] = replaceWith;
                }
                return;
            }
            //walk down the hiearchy
            let thisNode = previousNode[nodeName];
            let nextHiearchyIndex = hiearchyIndex + 1;
            let nextNodeName = hiearchy[nextHiearchyIndex];
            if (_.isArray(thisNode) === true && _.isString(thisNode) === false) {
                //walk each element in the array automatically
                _.forEach(thisNode, (element) => {
                    currentNodeProcessor(element, nextNodeName, nextHiearchyIndex, hiearchy);
                });
                return;
            }
            else {
                currentNodeProcessor(thisNode, nextNodeName, nextHiearchyIndex, hiearchy);
            }
        }
        //loop through all nodeHiearchyStrings to remove, removing the leaf.
        _.forEach(nodeHiearchyStrings, (hiearchyString) => {
            if (hiearchyString == null) {
                return;
            }
            let hiearchy = hiearchyString.split(".");
            if (hiearchy.length < 1) {
                return;
            }
            currentNodeProcessor(targetObject, hiearchy[0], 0, hiearchy);
        });
    }
    jsonX.replaceNodes = replaceNodes;
})(jsonX = exports.jsonX || (exports.jsonX = {}));
//# sourceMappingURL=serialization.js.map