import ex = require("./exception");
export declare enum LOGLEVEL {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}
export declare let logLevel: LOGLEVEL;
export declare function throwCheck(testCondition: boolean, message?: string, ...otherArgs: any[]): void;
export declare function debug(message: string, ...otherArgs: any[]): void;
export declare function warn(message: string, ...otherArgs: any[]): void;
export declare function error(message: string, ...otherArgs: any[]): ex.Exception;
//# sourceMappingURL=log-helper.d.ts.map