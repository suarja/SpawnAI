/**
 * VM Configuration and Management Types
 */

export interface VMResources {
  cpu: number;
  memory: string; // e.g., "4g", "512m"
  storage: string; // e.g., "10g", "1g"
  networkBandwidth?: string;
}

export interface VMConfig {
  id?: string;
  resources: VMResources;
  runtime: 'node' | 'python' | 'go' | 'java' | 'rust';
  timeout: number; // hours
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

export enum VMStatus {
  CREATING = 'creating',
  RUNNING = 'running',
  STOPPED = 'stopped',
  DESTROYING = 'destroying',
  ERROR = 'error'
}

export interface VMMetrics {
  cpuUsage: number; // percentage
  memoryUsage: number; // percentage  
  diskUsage: number; // percentage
  networkIn: number; // bytes
  networkOut: number; // bytes
  timestamp: Date;
}