/** color strings for console use.  also used by logger */
export import Chalk = require("chalk");
/** remove ansi characters from string.  also used by logger. */
export import stripAnsi = require("strip-ansi");
/**
 * escapes strings for html presentation.
 * firstly decodeUriComponent's the string, then html escapes it
 * @param value
 * @param disableAutoUriDecode
 */
export declare function htmlEscapeEscapedUserInput(value: string): string;
/**
 * converts escaped string back to the encudeUriComponent value
 * @param value
 */
export declare function htmlUnescapeEscapedUserInput(value: string): string;
/**
 *  sanitizes strings by escaping most non-alphanumerics
 * @param value
 */
export declare function escapeUserInput(value: string): string;
/**
 *  unsanitizes strings sanitized via .sanitizeUserInput();
 * @param value
 */
export declare function unescapeUserInput(value: string): string;
/** does the string contain characters larger than a single byte */
export declare function isUnicodeDoubleByte(str: string): boolean;
/**
 * basic, simple check if the string has been encoded via encodeURIComponent() or encodeURI()
 * may return false-positives, but never false-negatives.
 * @param value
 */
export declare function isEncodedMaybe(value: string): boolean;
export declare function count(target: string, subStrToCount: string, ignoreCase?: boolean, startingPosition?: number, /**default false.  if true, we allow overlapping finds, such as "aa" in the string "aaa" would return 2*/ allowOverlaps?: boolean): number;
export declare function indexOf(target: string, toFind: string, ignoreCase?: boolean, startingPosition?: number): number;
/** if the target is encapsulated by prefix/suffix, returns the unencapsulated version
otherwise, returns the target (non modified)
*/
export declare function between(target: string, prefix: string, suffix: string, ignoreCase?: boolean, trimFirst?: boolean): string;
/** if the string is longer than the maxLength, creates a summary (first + last) and returns it (ommiting the middle) */
export declare function summarize(str: string | any, /** default = 100 */ maxLength?: number): string;
/** converts a string to something that can be used as a machine-readable id.
input is converted to lowercase, alphanumeric with underscore (or your choosen 'whitespaceChar').
example:  "  (hi)   world!" ==> "hi_world"
the rules: maximum of 1 underscore at a time, and won't prefix/suffix with underscores (or your chosen 'whitespaceChar'*/
export declare function toId(str: string, whitespaceChar?: string): string;
export declare function ipV4toInt(ip: string): number;
export declare function intToIpV4(int: number): string;
export declare function capitalize(str: string): string;
export declare function repeat(toRepeate: string, numberOfTimes: number): string;
export declare function replaceAll(target: string, strToFind: string, replaceWith: string, ignoreCase?: boolean): string;
export declare function insertAt(target: string, toInsert: string, insertPosition: number): string;
export declare function remove(target: string, ...textToRemove: Array<string>): string;
export declare function removePrefix(target: string, ...prefixToRemove: Array<string>): string;
export declare function removeSuffix(target: string, ...suffixToRemove: Array<string>): string;
export declare function removeAfter(target: string, textToFind: string, keepFindText?: boolean, /** search from back if true*/ lastIndexOf?: boolean): string;
export declare function removeBefore(target: string, textToFind: string, keepFindText?: boolean, /** search from back if true*/ lastIndexOf?: boolean): string;
export declare function endsWith(target: string, toFind: string): boolean;
export declare function isNullOrEmpty(str: string): boolean;
/** removes any leading bit-order-marker from utf8 strings */
export declare function tryRemoveBom(str: string): string;
/** escape a string for use as a literal match in a regex expression
copied from http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
*/
export declare function escapeRegExp(str: string): string;
/** returns a 32bit integer.  same algorithm as used with java, so output should match */
export declare function hash(input: string): number;
//# sourceMappingURL=str-helper.d.ts.map