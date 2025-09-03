/**
 * Shared Validation Utilities
 */
import { VMConfig, GenerationRequest, DeploymentRequest } from '../types';
/**
 * Validation result interface
 */
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}
export interface ValidationError {
    field: string;
    code: string;
    message: string;
    value?: any;
}
/**
 * Validate VM Configuration
 */
export declare function validateVMConfig(config: VMConfig): ValidationResult;
/**
 * Validate Generation Request
 */
export declare function validateGenerationRequest(request: GenerationRequest): ValidationResult;
/**
 * Validate Deployment Request
 */
export declare function validateDeploymentRequest(request: DeploymentRequest): ValidationResult;
//# sourceMappingURL=validators.d.ts.map