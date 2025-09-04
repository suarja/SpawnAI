import { Sandbox } from "@e2b/code-interpreter";
import { Logger } from "winston";
import { v4 as uuidv4 } from "uuid";
import "dotenv/config";

/**
 * E2B-specific types extending the shared VM types
 */
export interface SandboxConfig {
  sessionId: string;
  appType: "webapp" | "api" | "script";
  allowInternetAccess: boolean;
  timeoutMs: number;
  resources: {
    cpu: number;
    memory: number;
  };
}

export interface SandboxInstance {
  id: string;
  sessionId: string;
  status: "created" | "deploying" | "ready" | "error" | "destroyed";
  createdAt: Date;
  host?: string;
  publicUrl?: string;
  error?: string;
}

export interface GeneratedCode {
  type: "single-file" | "multi-file";
  files: Array<{
    path: string;
    content: string;
    executable?: boolean;
  }>;
  startCommand?: string;
  buildCommand?: string;
  dependencies?: string[];
}

export interface DeploymentResult {
  success: boolean;
  appUrl?: string;
  error?: string;
  deployedAt: Date;
  logs: string[];
}

/**
 * E2B Sandbox Manager
 * Handles creation, deployment, and lifecycle management of E2B sandboxes
 */
export class E2BManager {
  private activeSandboxes = new Map<string, Sandbox>();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Create a new E2B sandbox with the specified configuration
   */
  async createSandbox(config: SandboxConfig): Promise<SandboxInstance> {
    this.logger.info("Creating E2B sandbox", {
      sessionId: config.sessionId,
      appType: config.appType,
    });

    try {
      // Create sandbox using the correct E2B SDK syntax
      const sandbox = await Sandbox.create({
        apiKey: process.env.E2B_API_KEY,
        timeoutMs: config.timeoutMs || 300000, // 5 minutes default
      });
      const sandboxInfo = await sandbox.getInfo();
      this.activeSandboxes.set(config.sessionId, sandbox);

      const instance: SandboxInstance = {
        id: sandboxInfo.sandboxId,
        sessionId: config.sessionId,
        status: "created",
        createdAt: new Date(),
        host: `${sandboxInfo.sandboxId}.e2b.dev`,
        publicUrl: this.getPublicUrl(sandboxInfo.sandboxId, 3000),
      };

      this.logger.info("E2B sandbox created successfully", {
        sessionId: config.sessionId,
        sandboxId: sandboxInfo.sandboxId,
        host: instance.host,
      });

      return instance;
    } catch (error) {
      this.logger.error("Failed to create sandbox", {
        error: error instanceof Error ? error.message : error,
        sessionId: config.sessionId,
      });
      throw new Error(
        `Sandbox creation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Deploy generated code to an existing sandbox
   */
  async deploySandbox(
    sandbox: SandboxInstance,
    code: GeneratedCode,
  ): Promise<DeploymentResult> {
    const sandboxInstance = this.activeSandboxes.get(sandbox.sessionId);
    if (!sandboxInstance) {
      throw new Error("Sandbox not found");
    }

    this.logger.info("Deploying code to sandbox", {
      sessionId: sandbox.sessionId,
      type: code.type,
      fileCount: code.files.length,
    });

    try {
      // Create app directory using correct E2B file API
      await sandboxInstance.files.makeDir("/app");

      // Write files to sandbox using correct E2B file API
      for (const file of code.files) {
        await sandboxInstance.files.write(file.path, file.content);
        if (file.executable) {
          await sandboxInstance.runCode(
            `import subprocess; subprocess.run(['chmod', '+x', '${file.path}'])`,
          );
        }
        this.logger.debug("File written to sandbox", {
          sessionId: sandbox.sessionId,
          path: file.path,
        });
      }

      // Install dependencies if needed
      if (code.dependencies?.length) {
        await this.installDependencies(sandboxInstance, code.dependencies);
      }

      // Build the application
      if (code.buildCommand) {
        this.logger.info("Building application", {
          sessionId: sandbox.sessionId,
        });
        const buildResult = await sandboxInstance.runCode(code.buildCommand);

        if (buildResult.error) {
          throw new Error(`Build failed: ${buildResult.error}`);
        }
      }

      // Start the application
      const startCommand =
        code.startCommand || this.getDefaultStartCommand(code);
      this.logger.info("Starting application", {
        sessionId: sandbox.sessionId,
        command: startCommand,
      });

      const startResult = await sandboxInstance.runCode(
        `import subprocess
import os
os.chdir('/app')
subprocess.Popen('${startCommand}', shell=True)`,
      );

      if (startResult.error) {
        throw new Error(`Application start failed: ${startResult.error}`);
      }

      // Wait for app to be ready
      await this.waitForAppReady(sandboxInstance, 3000);

      const result: DeploymentResult = {
        success: true,
        appUrl: this.getPublicUrl(sandbox.id, 3000),
        deployedAt: new Date(),
        logs: [
          ...startResult.logs.stdout.filter(Boolean),
          ...startResult.logs.stderr.filter(Boolean),
        ],
      };

      this.logger.info("Application deployed successfully", {
        sessionId: sandbox.sessionId,
        appUrl: result.appUrl,
      });

      return result;
    } catch (error) {
      this.logger.error("Deployment failed", {
        error: error instanceof Error ? error.message : error,
        sessionId: sandbox.sessionId,
      });
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown deployment error",
        deployedAt: new Date(),
        logs: [],
      };
    }
  }

  /**
   * Install dependencies in the sandbox
   */
  private async installDependencies(
    sandbox: Sandbox,
    dependencies: string[],
  ): Promise<void> {
    // Check if package.json exists or needs to be created
    const files = await sandbox.files.list("/app");
    const hasPackageJson = files.some((f) => f.name === "package.json");

    if (
      !hasPackageJson &&
      dependencies.some((dep) => !dep.startsWith("python"))
    ) {
      // Create package.json for Node.js dependencies
      const packageJson = {
        name: "spawned-app",
        version: "1.0.0",
        dependencies: dependencies.reduce(
          (acc, dep) => {
            acc[dep] = "latest";
            return acc;
          },
          {} as Record<string, string>,
        ),
      };

      await sandbox.files.write(
        "/app/package.json",
        JSON.stringify(packageJson, null, 2),
      );
    }

    // Install Node.js dependencies
    const nodeDeps = dependencies.filter((dep) => !dep.startsWith("python"));
    if (nodeDeps.length > 0) {
      const installResult = await sandbox.runCode(`
import subprocess
import os
os.chdir('/app')
result = subprocess.run(['npm', 'install'], capture_output=True, text=True)
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr)
`);
      if (installResult.error) {
        throw new Error(`npm install failed: ${installResult.error}`);
      }
    }

    // Install Python dependencies
    const pythonDeps = dependencies.filter((dep) => dep.startsWith("python:"));
    if (pythonDeps.length > 0) {
      const pipPackages = pythonDeps
        .map((dep) => dep.replace("python:", ""))
        .join(" ");
      const pipResult = await sandbox.runCode(`
import subprocess
result = subprocess.run(['pip', 'install', '${pipPackages}'], capture_output=True, text=True)
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr)
`);
      if (pipResult.error) {
        throw new Error(`pip install failed: ${pipResult.error}`);
      }
    }
  }

  /**
   * Wait for the application to be ready by checking HTTP response
   */
  private async waitForAppReady(
    sandbox: Sandbox,
    port: number,
    maxWaitMs: number = 30000,
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const result = await sandbox.runCode(`
import requests
import time
try:
    response = requests.get(f'http://localhost:${port}', timeout=5)
    print(f'Status: {response.status_code}')
    if response.status_code < 500:  # Any successful response
        print('App is ready!')
except Exception as e:
    print(f'Not ready yet: {e}')
`);
        if (result.logs && result.logs.stdout.includes("App is ready!")) {
          return;
        }
      } catch (error) {
        // Ignore errors, keep retrying
      }

      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s between checks
    }

    throw new Error(`Application failed to start within ${maxWaitMs}ms`);
  }

  /**
   * Get the default start command based on the code type
   */
  private getDefaultStartCommand(code: GeneratedCode): string {
    if (code.files.some((f) => f.path.includes(".html"))) {
      return "cd /app && python3 -m http.server 3000";
    }
    if (
      code.files.some(
        (f) => f.path.includes(".js") && f.path.includes("server"),
      )
    ) {
      return "cd /app && node server.js";
    }
    if (code.files.some((f) => f.path.includes(".py"))) {
      return "cd /app && python3 server.py";
    }
    // Default fallback
    return "cd /app && python3 -m http.server 3000";
  }

  /**
   * Generate public URL for the sandbox on a specific port
   */
  getPublicUrl(sandboxId: string, port: number): string {
    return `https://${port}-${sandboxId}.e2b.dev`;
  }

  /**
   * Monitor sandbox status and resource usage
   */
  async monitorSandbox(sessionId: string): Promise<SandboxInstance | null> {
    const sandbox = this.activeSandboxes.get(sessionId);
    if (!sandbox) {
      return null;
    }

    try {
      // Basic health check - try to run a simple command
      const result = await sandbox.runCode('print("health_check")');
      const status = result.error ? "error" : "ready";
      const sandboxInfo = await sandbox.getInfo();
      return {
        id: sandboxInfo.sandboxId,
        sessionId,
        status,
        createdAt: new Date(), // In production, this should be stored
        publicUrl: this.getPublicUrl(sandboxInfo.sandboxId, 3000),
      };
    } catch (error) {
      this.logger.warn("Sandbox health check failed", {
        sessionId,
        error: error instanceof Error ? error.message : error,
      });
      return {
        id: "",
        sessionId,
        status: "error",
        createdAt: new Date(),
        error: error instanceof Error ? error.message : "Health check failed",
      };
    }
  }

  /**
   * Destroy a sandbox and cleanup resources
   */
  async destroySandbox(sessionId: string): Promise<void> {
    const sandbox = this.activeSandboxes.get(sessionId);
    if (sandbox) {
      const sandboxInfo = await sandbox.getInfo();
      try {
        await sandbox.kill();
        this.activeSandboxes.delete(sessionId);
        this.logger.info("Sandbox destroyed", {
          sessionId,
          sandboxId: sandboxInfo.sandboxId,
        });
      } catch (error) {
        this.logger.error("Failed to destroy sandbox", {
          error: error instanceof Error ? error.message : error,
          sessionId,
        });
        throw error;
      }
    } else {
      this.logger.warn("Attempted to destroy non-existent sandbox", {
        sessionId,
      });
    }
  }

  /**
   * List all active sandboxes
   */
  async listActiveSandboxes(): Promise<SandboxInstance[]> {
    const instances: SandboxInstance[] = [];

    for (const [sessionId, sandbox] of this.activeSandboxes.entries()) {
      const instance = await this.monitorSandbox(sessionId);
      if (instance) {
        instances.push(instance);
      }
    }

    return instances;
  }

  /**
   * Cleanup expired sandboxes (called periodically)
   */
  async cleanupExpiredSandboxes(): Promise<void> {
    this.logger.info("Starting cleanup of expired sandboxes");

    // In production, this would check database for expired sessions
    // For now, we'll implement basic cleanup based on timeout
    const now = Date.now();
    const expiredSessions: string[] = [];

    // This is a simplified implementation - in production we'd store creation times
    for (const sessionId of this.activeSandboxes.keys()) {
      try {
        const sandbox = await this.monitorSandbox(sessionId);
        if (sandbox?.status === "error") {
          expiredSessions.push(sessionId);
        }
      } catch (error) {
        expiredSessions.push(sessionId);
      }
    }

    // Cleanup expired sessions
    for (const sessionId of expiredSessions) {
      try {
        await this.destroySandbox(sessionId);
        this.logger.info("Cleaned up expired sandbox", { sessionId });
      } catch (error) {
        this.logger.error("Failed to cleanup expired sandbox", {
          sessionId,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    this.logger.info("Cleanup completed", {
      cleanedUp: expiredSessions.length,
    });
  }
}

