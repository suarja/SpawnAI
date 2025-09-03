"use strict";
/**
 * Code Generation and AI Types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerationStatus = exports.SecurityLevel = exports.AppType = void 0;
var AppType;
(function (AppType) {
    AppType["WEB_APP"] = "web";
    AppType["API"] = "api";
    AppType["SCRIPT"] = "script";
    AppType["CLI_TOOL"] = "cli";
    AppType["MICROSERVICE"] = "microservice";
})(AppType || (exports.AppType = AppType = {}));
var SecurityLevel;
(function (SecurityLevel) {
    SecurityLevel["LOW"] = "low";
    SecurityLevel["MEDIUM"] = "medium";
    SecurityLevel["HIGH"] = "high";
})(SecurityLevel || (exports.SecurityLevel = SecurityLevel = {}));
var GenerationStatus;
(function (GenerationStatus) {
    GenerationStatus["PENDING"] = "pending";
    GenerationStatus["GENERATING"] = "generating";
    GenerationStatus["VALIDATING"] = "validating";
    GenerationStatus["COMPLETED"] = "completed";
    GenerationStatus["FAILED"] = "failed";
})(GenerationStatus || (exports.GenerationStatus = GenerationStatus = {}));
//# sourceMappingURL=generation.js.map