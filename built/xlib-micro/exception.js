"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Exception extends Error {
    constructor(message) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype); //fix inheritance, new in ts2.2: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
    }
}
exports.Exception = Exception;
//# sourceMappingURL=exception.js.map