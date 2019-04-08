"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ex = require("./exception");
var LOGLEVEL;
(function (LOGLEVEL) {
    LOGLEVEL[LOGLEVEL["DEBUG"] = 0] = "DEBUG";
    LOGLEVEL[LOGLEVEL["INFO"] = 1] = "INFO";
    LOGLEVEL[LOGLEVEL["WARN"] = 2] = "WARN";
    LOGLEVEL[LOGLEVEL["ERROR"] = 3] = "ERROR";
    LOGLEVEL[LOGLEVEL["NONE"] = 4] = "NONE";
})(LOGLEVEL = exports.LOGLEVEL || (exports.LOGLEVEL = {}));
exports.logLevel = LOGLEVEL.DEBUG;
class LogThrowException extends ex.Exception {
}
function throwCheck(testCondition, message = "testCondition failed.  Please check source code for details.", ...otherArgs) {
    if (testCondition === true) {
        return;
    }
    if (testCondition !== false) {
        throw new ex.Exception("first parameter must be a boolean (to assert must evaluate to true or false)");
    }
    if (otherArgs != null && otherArgs.length > 0) {
        message += JSON.stringify(otherArgs);
    }
    // tslint:disable-next-line: no-console
    console.error("throwCheck: " + message);
    throw new LogThrowException(message);
}
exports.throwCheck = throwCheck;
function debug(message, ...otherArgs) {
    if (exports.logLevel > LOGLEVEL.DEBUG) {
        return;
    }
    if (otherArgs != null && otherArgs.length > 0) {
        message += JSON.stringify(otherArgs);
    }
    // tslint:disable-next-line: no-console
    console.debug("debug: " + message);
}
exports.debug = debug;
function warn(message, ...otherArgs) {
    if (exports.logLevel > LOGLEVEL.WARN) {
        return;
    }
    if (otherArgs != null && otherArgs.length > 0) {
        message += JSON.stringify(otherArgs);
    }
    // tslint:disable-next-line: no-console
    console.warn("warn: " + message);
}
exports.warn = warn;
function error(message, ...otherArgs) {
    if (exports.logLevel > LOGLEVEL.ERROR) {
        return undefined;
    }
    if (otherArgs != null && otherArgs.length > 0) {
        message += JSON.stringify(otherArgs);
    }
    // tslint:disable-next-line: no-console
    console.error("error: " + message);
    return new ex.Exception(message);
}
exports.error = error;
//# sourceMappingURL=log-helper.js.map