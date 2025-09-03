/**
 * Shared Types for SpawnAI
 * Main export file for all type definitions
 */
export * from './vm';
export * from './generation';
export * from './deployment';
export * from './security';
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
    stack?: string;
}
export interface ResponseMetadata {
    timestamp: Date;
    requestId: string;
    version: string;
    executionTime?: number;
}
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
export interface Session {
    id: string;
    userId?: string;
    createdAt: Date;
    expiresAt: Date;
    metadata: Record<string, any>;
}
export interface SpawnAIEvent {
    id: string;
    type: EventType;
    payload: any;
    timestamp: Date;
    sessionId?: string;
}
export declare enum EventType {
    VM_STATUS_CHANGED = "vm.status.changed",
    GENERATION_PROGRESS = "generation.progress",
    DEPLOYMENT_STATUS_CHANGED = "deployment.status.changed",
    SECURITY_SCAN_COMPLETED = "security.scan.completed",
    APP_HEALTH_CHANGED = "app.health.changed"
}
//# sourceMappingURL=index.d.ts.map