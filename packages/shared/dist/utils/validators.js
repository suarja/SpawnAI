"use strict";
/**
 * Shared Validation Utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateVMConfig = validateVMConfig;
exports.validateGenerationRequest = validateGenerationRequest;
exports.validateDeploymentRequest = validateDeploymentRequest;
/**
 * Validate VM Configuration
 */
function validateVMConfig(config) {
    const errors = [];
    // Validate resources
    if (!config.resources) {
        errors.push({
            field: 'resources',
            code: 'REQUIRED',
            message: 'Resources configuration is required'
        });
    }
    else {
        // Validate CPU
        if (!config.resources.cpu || config.resources.cpu < 1 || config.resources.cpu > 8) {
            errors.push({
                field: 'resources.cpu',
                code: 'INVALID_RANGE',
                message: 'CPU must be between 1 and 8',
                value: config.resources.cpu
            });
        }
        // Validate memory format
        const memoryRegex = /^\\d+(m|g)$/i;
        if (!config.resources.memory || !memoryRegex.test(config.resources.memory)) {
            errors.push({
                field: 'resources.memory',
                code: 'INVALID_FORMAT',
                message: 'Memory must be in format like "4g" or "512m"',
                value: config.resources.memory
            });
        }
        // Validate storage format
        const storageRegex = /^\\d+(m|g)$/i;
        if (!config.resources.storage || !storageRegex.test(config.resources.storage)) {
            errors.push({
                field: 'resources.storage',
                code: 'INVALID_FORMAT',
                message: 'Storage must be in format like "10g" or "1g"',
                value: config.resources.storage
            });
        }
    }
    // Validate runtime
    const validRuntimes = ['node', 'python', 'go', 'java', 'rust'];
    if (!config.runtime || !validRuntimes.includes(config.runtime)) {
        errors.push({
            field: 'runtime',
            code: 'INVALID_CHOICE',
            message: `Runtime must be one of: ${validRuntimes.join(', ')}`,
            value: config.runtime
        });
    }
    // Validate timeout
    if (!config.timeout || config.timeout < 1 || config.timeout > 72) {
        errors.push({
            field: 'timeout',
            code: 'INVALID_RANGE',
            message: 'Timeout must be between 1 and 72 hours',
            value: config.timeout
        });
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}
/**
 * Validate Generation Request
 */
function validateGenerationRequest(request) {
    const errors = [];
    // Validate description
    if (!request.description || request.description.trim().length < 10) {
        errors.push({
            field: 'description',
            code: 'TOO_SHORT',
            message: 'Description must be at least 10 characters long',
            value: request.description
        });
    }
    if (request.description && request.description.length > 1000) {
        errors.push({
            field: 'description',
            code: 'TOO_LONG',
            message: 'Description must not exceed 1000 characters',
            value: request.description?.length
        });
    }
    // Validate app type
    const validAppTypes = ['web', 'api', 'script', 'cli', 'microservice'];
    if (!request.appType || !validAppTypes.includes(request.appType)) {
        errors.push({
            field: 'appType',
            code: 'INVALID_CHOICE',
            message: `App type must be one of: ${validAppTypes.join(', ')}`,
            value: request.appType
        });
    }
    // Validate runtime
    if (!request.runtime || request.runtime.trim().length === 0) {
        errors.push({
            field: 'runtime',
            code: 'REQUIRED',
            message: 'Runtime is required',
            value: request.runtime
        });
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}
/**
 * Validate Deployment Request
 */
function validateDeploymentRequest(request) {
    const errors = [];
    // Validate VM ID
    if (!request.vmId || request.vmId.trim().length === 0) {
        errors.push({
            field: 'vmId',
            code: 'REQUIRED',
            message: 'VM ID is required',
            value: request.vmId
        });
    }
    // Validate app
    if (!request.app) {
        errors.push({
            field: 'app',
            code: 'REQUIRED',
            message: 'Generated app is required'
        });
    }
    // Validate custom domain format if provided
    if (request.customDomain) {
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\\.[a-zA-Z]{2,}$/;
        if (!domainRegex.test(request.customDomain)) {
            errors.push({
                field: 'customDomain',
                code: 'INVALID_FORMAT',
                message: 'Invalid domain format',
                value: request.customDomain
            });
        }
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}
//# sourceMappingURL=validators.js.map