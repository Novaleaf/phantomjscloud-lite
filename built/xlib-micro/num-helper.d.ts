/** max for a signed 8bit integer. (127) */
export declare let INT8_MAX: number;
/** min for a signed 8bit integer. (-128) */
export declare let INT8_MIN: number;
/** max for a signed 16bit integer. (32767) */
export declare let INT16_MAX: number;
export declare let INT16_MIN: number;
export declare let INT32_MAX: number;
export declare let INT32_MIN: number;
/** largest exact integer supported in javascript.  2^53.  (53 bit mantissa) after this, floating point rounding will occur
from http://stackoverflow.com/questions/307179/what-is-javascripts-max-int-whats-the-highest-integer-value-a-number-can-go-t */
export declare let INT_MAX: number;
/** largest exact integer supported in javascript.  2^53.  (53 bit mantissa) after this, floating point rounding will occur
from http://stackoverflow.com/questions/307179/what-is-javascripts-max-int-whats-the-highest-integer-value-a-number-can-go-t */
export declare let INT_MIN: number;
/**
 * formats values into strings using special heuristics to guess what is user friendly.
 * @param num
 */
export declare function format(value: number, /** default=5 */ significantDigits?: number, separatorChar?: string): string;
/** fast hash a int32, not very great spread */
export declare function hash(input: number): number;
/**
 * ensure that the value specified is a number and is finite.
 * @param x
 */
export declare function isReal(x: number): boolean;
export declare function randomFloat(min_inc?: number, max_exc?: number): number;
export declare function randomInt(min_inc?: number, max_exc?: number): number;
export declare function randomBool(/** the probability that true will be returned.  default 0.5 (50%) */ trueChance?: number): boolean;
export declare function round(value: number, 
/** default = 0.  round(123.456,10)=>0;    round(123.456,2)=>100;   round(123.456,-2)=>123.46;   round(123.456,0)=>123;   round(123.456,-10)=>123.456;
*/
digitsOrNegativeForDecimals?: number): number;
/** check that two nombers are close enough to eachother.     all parameters are combined when calculating, IE:   ```maxValue =  ( ( input * ( 1 + percentTollerance ) )  + spreadTollerance ) ```*/
export declare function aboutEqual(input: number, checkAgainst: number, 
/** how many percent different the two numbers can be
 *
 * Default is ```0```, meaning this parameter is ignored */
percentTollerance: number, 
/** a fixed spread tollerance that the numbers should be within
 *
 * Default is ```0```, meaning this parameter is ignored */
spreadTollerance?: number): boolean;
/** randomize order of elements in this array */
export declare function randomizeArray(myArray: Array<any>): void;
/**
 *  create a random number output as a string, with the specified number of digits.
 * @param minDigits
 * @param maxDigits set to minDigits if not specified
 * @param radix
 */
export declare function randomIntDigits(digits: number, radix?: number): string;
/**
 *  count number of digits in a number
 * @param value
 * @param countDecimals
 */
export declare function countDigits(value: number, /** default false, count only the whole digits */ countDecimals?: boolean): number;
/** how the clamp function should process the input (what kind of result should be returned) */
export declare enum ClampType {
    /** value not set, an error */
    none = 0,
    /** if value is below min, returns min.  likewise for above max */
    clamp = 1,
    /** if value is below min, loops over to max (or vice-versa) */
    loop = 2,
    /** oscillate the returned value between min/max range */
    bounce = 3,
    /** return the remainder (amount value lies beyond min/max range), not the clamped value.
    if inside clamp range, returns zero.  if below min, returns negative.  if above range, returns positive. */
    remainder = 4
}
/**
 *  clamp a number to be within the range specified
 */
export declare function clamp(value: number, min_inc: number, max_inc: number, /** defaults to "clamp" */ clampType?: ClampType): number;
/** interpolate between values
base implementation works for numbers.  override .update() to extend functionality to other types */
export declare class Interpolator {
    start: number;
    min: number;
    max: number;
    rate: number;
    isBounce: boolean;
    isEnabled: boolean;
    current: number;
    startRate: number;
    private clampType;
    constructor(start: number, min: number, max: number, rate: number, isBounce: boolean, isEnabled?: boolean);
    update(elapsedMs: number): number;
}
/** truncate a float to int.   negative number safe, and fast performance */
export declare function toInt(value: number): number;
/**
 * a string with a separator for every number digit group (more than 4 digits)
 * @param num
 */
export declare function toStringDigitGroupings(num: number, 
/** default comma */
separatorChar?: string, 
/** if true, decimals will have digits grouped with a space.  default=false */
groupDecimalsWithSpace?: boolean): string;
/** parses the value into an integer. */
export declare function parseIntEx(toParse: any, /** invalid strings are returned as this (default=NaN) */ invalidResult?: number, radix?: number): number;
/** parses the value into a float. */
export declare function parseFloatEx(toParse: any, /** invalid strings are returned as this (default=NaN) */ invalidResult?: number, /** the default parseFloat implementation allows for trailing text.  specifying isStrict=TRUE makes only numbers + "Infinity" allowed to be parsed.   */ isStrict?: boolean): number;
export declare function parseBoolean(toParse: string | number, invalidResult?: boolean, throwOnInvalid?: boolean): boolean;
//# sourceMappingURL=num-helper.d.ts.map