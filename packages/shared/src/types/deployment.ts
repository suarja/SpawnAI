/**
 * Deployment and App Lifecycle Types
 */

export interface DeploymentRequest {
  vmId: string;
  app: GeneratedApp;
  ssl?: boolean;
  customDomain?: string;
  envVars?: Record<string, string>;
}

export interface DeploymentResult {
  id: string;
  vmId: string;
  appId: string;
  url: string;
  status: DeploymentStatus;
  port: number;
  ssl: boolean;
  createdAt: Date;
  expiresAt: Date;
  healthCheck?: HealthCheckConfig;
  logs: LogEntry[];
}

export enum DeploymentStatus {
  PENDING = 'pending',
  BUILDING = 'building',
  DEPLOYING = 'deploying', 
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  FAILED = 'failed'
}

export interface HealthCheckConfig {
  path: string;
  interval: number; // seconds
  timeout: number; // seconds
  retries: number;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  responseTime?: number;
  statusCode?: number;
  error?: string;
}

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: 'build' | 'runtime' | 'system';
  message: string;
  metadata?: Record<string, any>;
}

// Import GeneratedApp from generation.ts
import { GeneratedApp } from './generation';