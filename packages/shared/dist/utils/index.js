"use strict";
/**
 * Shared Utilities for SpawnAI
 * Main export file for all utility functions
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.sleep = sleep;
exports.retry = retry;
exports.isValidUrl = isValidUrl;
exports.sanitizeFilename = sanitizeFilename;
exports.formatBytes = formatBytes;
exports.formatDuration = formatDuration;
exports.deepClone = deepClone;
exports.omit = omit;
exports.pick = pick;
// Logger utilities
__exportStar(require("./logger"), exports);
// Validation utilities
__exportStar(require("./validators"), exports);
// Common utility functions
function generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function retry(fn, retries = 3, delay = 1000) {
    return fn().catch(async (error) => {
        if (retries > 0) {
            await sleep(delay);
            return retry(fn, retries - 1, delay * 2);
        }
        throw error;
    });
}
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
}
function sanitizeFilename(filename) {
    return filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
}
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    else {
        return `${seconds}s`;
    }
}
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
function omit(obj, keys) {
    const result = { ...obj };
    keys.forEach(key => delete result[key]);
    return result;
}
function pick(obj, keys) {
    const result = {};
    keys.forEach(key => {
        if (key in obj) {
            result[key] = obj[key];
        }
    });
    return result;
}
//# sourceMappingURL=index.js.map