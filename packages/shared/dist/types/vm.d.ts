/**
 * VM Configuration and Management Types
 */
export interface VMResources {
    cpu: number;
    memory: string;
    storage: string;
    networkBandwidth?: string;
}
export interface VMConfig {
    id?: string;
    resources: VMResources;
    runtime: 'node' | 'python' | 'go' | 'java' | 'rust';
    timeout: number;
    region?: string;
    tags?: Record<string, string>;
}
export interface VM {
    id: string;
    config: VMConfig;
    status: VMStatus;
    ipAddress?: string;
    ports: number[];
    createdAt: Date;
    expiresAt: Date;
    lastHeartbeat?: Date;
}
export declare enum VMStatus {
    CREATING = "creating",
    RUNNING = "running",
    STOPPED = "stopped",
    DESTROYING = "destroying",
    ERROR = "error"
}
export interface VMMetrics {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkIn: number;
    networkOut: number;
    timestamp: Date;
}
//# sourceMappingURL=vm.d.ts.map