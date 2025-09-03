"use strict";
/**
 * Deployment and App Lifecycle Types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentStatus = void 0;
var DeploymentStatus;
(function (DeploymentStatus) {
    DeploymentStatus["PENDING"] = "pending";
    DeploymentStatus["BUILDING"] = "building";
    DeploymentStatus["DEPLOYING"] = "deploying";
    DeploymentStatus["RUNNING"] = "running";
    DeploymentStatus["STOPPING"] = "stopping";
    DeploymentStatus["STOPPED"] = "stopped";
    DeploymentStatus["FAILED"] = "failed";
})(DeploymentStatus || (exports.DeploymentStatus = DeploymentStatus = {}));
//# sourceMappingURL=deployment.js.map