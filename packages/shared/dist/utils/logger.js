"use strict";
/**
 * Shared Logger Utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = void 0;
exports.createLogEntry = createLogEntry;
exports.formatLogEntry = formatLogEntry;
var LogLevel;
(function (LogLevel) {
    LogLevel["ERROR"] = "error";
    LogLevel["WARN"] = "warn";
    LogLevel["INFO"] = "info";
    LogLevel["DEBUG"] = "debug";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * Create a structured log entry
 */
function createLogEntry(level, message, context, metadata, error) {
    return {
        timestamp: new Date(),
        level,
        message,
        context,
        metadata,
        error
    };
}
/**
 * Format log entry for console output
 */
function formatLogEntry(entry) {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase();
    const service = entry.context.service;
    let formatted = `[${timestamp}] ${level} [${service}] ${entry.message}`;
    if (entry.context.requestId) {
        formatted += ` (req: ${entry.context.requestId})`;
    }
    if (entry.error) {
        formatted += `\\n  Error: ${entry.error.message}`;
        if (entry.error.stack) {
            formatted += `\\n  Stack: ${entry.error.stack}`;
        }
    }
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
        formatted += `\\n  Metadata: ${JSON.stringify(entry.metadata, null, 2)}`;
    }
    return formatted;
}
//# sourceMappingURL=logger.js.map