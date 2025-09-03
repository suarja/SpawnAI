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

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn', 
  INFO = 'info',
  DEBUG = 'debug'
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
export function createLogEntry(
  level: LogLevel,
  message: string,
  context: LogContext,
  metadata?: Record<string, any>,
  error?: Error
): LogEntry {
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
export function formatLogEntry(entry: LogEntry): string {
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