/**
 * Code Generation and AI Types
 */
export interface GenerationRequest {
    id?: string;
    description: string;
    appType: AppType;
    runtime: string;
    framework?: string;
    features?: string[];
    constraints?: GenerationConstraints;
}
export declare enum AppType {
    WEB_APP = "web",
    API = "api",
    SCRIPT = "script",
    CLI_TOOL = "cli",
    MICROSERVICE = "microservice"
}
export interface GenerationConstraints {
    maxFiles?: number;
    maxLinesPerFile?: number;
    excludePackages?: string[];
    requiredPackages?: string[];
    security?: SecurityLevel;
}
export declare enum SecurityLevel {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high"
}
export interface GeneratedApp {
    id: string;
    request: GenerationRequest;
    files: GeneratedFile[];
    entryPoint: string;
    buildCommand?: string;
    runCommand?: string;
    dependencies: Record<string, string>;
    devDependencies?: Record<string, string>;
    status: GenerationStatus;
    createdAt: Date;
    metadata: AppMetadata;
}
export interface GeneratedFile {
    path: string;
    content: string;
    language: string;
    size: number;
}
export declare enum GenerationStatus {
    PENDING = "pending",
    GENERATING = "generating",
    VALIDATING = "validating",
    COMPLETED = "completed",
    FAILED = "failed"
}
export interface AppMetadata {
    estimatedComplexity: 'simple' | 'medium' | 'complex';
    technologies: string[];
    warnings?: string[];
    recommendations?: string[];
}
//# sourceMappingURL=generation.d.ts.map