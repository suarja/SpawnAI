/**
 * Shared Types for SpawnAI
 * Main export file for all type definitions
 */

// VM Types
export * from './vm';

// Generation Types  
export * from './generation';

// Deployment Types
export * from './deployment';

// Security Types
export * from './security';

// Common API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ResponseMetadata;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string; // only in development
}

export interface ResponseMetadata {
  timestamp: Date;
  requestId: string;
  version: string;
  executionTime?: number;
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Session and Authentication
export interface Session {
  id: string;
  userId?: string; // nullable for anonymous sessions
  createdAt: Date;
  expiresAt: Date;
  metadata: Record<string, any>;
}

// Event Types for Real-time Updates
export interface SpawnAIEvent {
  id: string;
  type: EventType;
  payload: any;
  timestamp: Date;
  sessionId?: string;
}

export enum EventType {
  VM_STATUS_CHANGED = 'vm.status.changed',
  GENERATION_PROGRESS = 'generation.progress',
  DEPLOYMENT_STATUS_CHANGED = 'deployment.status.changed',
  SECURITY_SCAN_COMPLETED = 'security.scan.completed',
  APP_HEALTH_CHANGED = 'app.health.changed'
}