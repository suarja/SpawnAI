/**
 * Shared Utilities for SpawnAI
 * Main export file for all utility functions
 */
export * from './logger';
export * from './validators';
export declare function generateId(): string;
export declare function sleep(ms: number): Promise<void>;
export declare function retry<T>(fn: () => Promise<T>, retries?: number, delay?: number): Promise<T>;
export declare function isValidUrl(url: string): boolean;
export declare function sanitizeFilename(filename: string): string;
export declare function formatBytes(bytes: number): string;
export declare function formatDuration(ms: number): string;
export declare function deepClone<T>(obj: T): T;
export declare function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>;
export declare function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>;
//# sourceMappingURL=index.d.ts.map