"use strict";
/**
 * Security and Certificate Types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityCategory = exports.SecuritySeverity = exports.ScanStatus = exports.SecurityScanType = exports.CertificateStatus = exports.CertificateType = void 0;
var CertificateType;
(function (CertificateType) {
    CertificateType["SELF_SIGNED"] = "self-signed";
    CertificateType["LETS_ENCRYPT"] = "lets-encrypt";
    CertificateType["CUSTOM"] = "custom";
})(CertificateType || (exports.CertificateType = CertificateType = {}));
var CertificateStatus;
(function (CertificateStatus) {
    CertificateStatus["PENDING"] = "pending";
    CertificateStatus["VALID"] = "valid";
    CertificateStatus["EXPIRED"] = "expired";
    CertificateStatus["REVOKED"] = "revoked";
    CertificateStatus["ERROR"] = "error";
})(CertificateStatus || (exports.CertificateStatus = CertificateStatus = {}));
var SecurityScanType;
(function (SecurityScanType) {
    SecurityScanType["CODE_ANALYSIS"] = "code-analysis";
    SecurityScanType["DEPENDENCY_CHECK"] = "dependency-check";
    SecurityScanType["CONTAINER_SCAN"] = "container-scan";
    SecurityScanType["NETWORK_SCAN"] = "network-scan";
})(SecurityScanType || (exports.SecurityScanType = SecurityScanType = {}));
var ScanStatus;
(function (ScanStatus) {
    ScanStatus["PENDING"] = "pending";
    ScanStatus["SCANNING"] = "scanning";
    ScanStatus["COMPLETED"] = "completed";
    ScanStatus["FAILED"] = "failed";
})(ScanStatus || (exports.ScanStatus = ScanStatus = {}));
var SecuritySeverity;
(function (SecuritySeverity) {
    SecuritySeverity["CRITICAL"] = "critical";
    SecuritySeverity["HIGH"] = "high";
    SecuritySeverity["MEDIUM"] = "medium";
    SecuritySeverity["LOW"] = "low";
    SecuritySeverity["INFO"] = "info";
})(SecuritySeverity || (exports.SecuritySeverity = SecuritySeverity = {}));
var SecurityCategory;
(function (SecurityCategory) {
    SecurityCategory["VULNERABILITY"] = "vulnerability";
    SecurityCategory["MALWARE"] = "malware";
    SecurityCategory["CONFIGURATION"] = "configuration";
    SecurityCategory["COMPLIANCE"] = "compliance";
    SecurityCategory["BEST_PRACTICES"] = "best-practices";
})(SecurityCategory || (exports.SecurityCategory = SecurityCategory = {}));
//# sourceMappingURL=security.js.map