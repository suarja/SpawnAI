/**
 * Shared Logger Utilities
 */
export interface LogContext {
    service: string;
    requestId?: string;
    userId?: string;
    sessionId?: string;
    vmId?: string;
    appId?: string;
    [key: string]: any;
}
export declare enum LogLevel {
    ERROR = "error",
    WARN = "warn",
    INFO = "info",
    DEBUG = "debug"
}
export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    message: string;
    context: LogContext;
    error?: Error;
    metadata?: Record<string, any>;
}
/**
 * Create a structured log entry
 */
export declare function createLogEntry(level: LogLevel, message: string, context: LogContext, metadata?: Record<string, any>, error?: Error): LogEntry;
/**
 * Format log entry for console output
 */
export declare function formatLogEntry(entry: LogEntry): string;
//# sourceMappingURL=logger.d.ts.map