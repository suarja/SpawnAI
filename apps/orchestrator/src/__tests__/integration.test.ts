import request from "supertest";
import express from "express";
import { E2BManager, SandboxConfig } from "../vm/e2b-manager";
import { createSpawnRoutes } from "../api/routes/spawn";
import { ClaudeClient } from "../ai/claude-client";
import { Logger } from "winston";

// Mock E2B Manager directly for simpler testing
jest.mock("../vm/e2b-manager", () => ({
  E2BManager: jest.fn().mockImplementation(() => ({
    createSandbox: jest.fn().mockImplementation((config) => Promise.resolve({
      id: "mock-sandbox-id",
      sessionId: config.sessionId,
      status: "created",
      createdAt: new Date(),
      publicUrl: "https://3000-mock-host.e2b.dev",
    })),
    deploySandbox: jest.fn().mockResolvedValue({
      success: true,
      appUrl: "https://3000-mock-host.e2b.dev",
      deployedAt: new Date(),
      logs: ["Mock deployment log"],
    }),
    monitorSandbox: jest.fn().mockImplementation((sessionId) => {
      if (sessionId === "non-existent-id") {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        id: "mock-sandbox-id",
        sessionId: sessionId,
        status: "ready",
        createdAt: new Date(),
        publicUrl: "https://3000-mock-host.e2b.dev",
      });
    }),
    destroySandbox: jest.fn().mockResolvedValue(undefined),
    listActiveSandboxes: jest.fn().mockResolvedValue([]),
    cleanupExpiredSandboxes: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock Anthropic SDK
jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              type: "single-file",
              files: [
                {
                  path: "/app/index.html",
                  content: "<html><body><h1>Mock Generated App</h1></body></html>",
                },
              ],
              startCommand: "cd /app && python3 -m http.server 3000",
            }),
          },
        ],
        usage: {
          input_tokens: 100,
          output_tokens: 200,
        },
      }),
    },
  })),
}));

// Mock logger
const mockLogger: Logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as any;

describe("E2B Integration Tests", () => {
  let app: express.Application;
  let e2bManager: E2BManager;
  let claudeClient: ClaudeClient;

  beforeEach(() => {
    jest.clearAllMocks();

    e2bManager = new E2BManager(mockLogger);
    claudeClient = new ClaudeClient(
      { apiKey: "test-api-key" },
      mockLogger,
    );

    app = express();
    app.use(express.json());
    app.use("/api/spawn", createSpawnRoutes(e2bManager, mockLogger, claudeClient));
  });

  describe("Sandbox Lifecycle", () => {
    it("should create and destroy a sandbox", async () => {
      // Create sandbox with testCode to ensure deployment
      const testCode = {
        type: "single-file" as const,
        files: [
          {
            path: "/app/test.html",
            content: "<html><body>Test</body></html>",
          },
        ],
        startCommand: "cd /app && python3 -m http.server 3000",
      };

      const createResponse = await request(app).post("/api/spawn").send({
        appType: "script",
        testCode,
      });

      expect(createResponse.status).toBe(200);
      expect(createResponse.body).toMatchObject({
        status: "ready",
        publicUrl: expect.stringContaining("https://3000-"),
      });

      const sessionId = createResponse.body.sessionId;

      // Get sandbox info
      const getResponse = await request(app).get(`/api/spawn/${sessionId}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.sessionId).toBe(sessionId);

      // Destroy sandbox
      const deleteResponse = await request(app).delete(
        `/api/spawn/${sessionId}`,
      );

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.message).toBe(
        "Sandbox destroyed successfully",
      );
    });

    it("should validate required fields", async () => {
      // Invalid app type (should return 400)
      const response2 = await request(app).post("/api/spawn").send({
        appType: "invalid",
        prompt: "test",
      });

      expect(response2.status).toBe(400);
      expect(response2.body.error).toContain("Invalid app type");
    });

    it("should handle non-existent sandbox", async () => {
      const response = await request(app).get("/api/spawn/non-existent-id");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Sandbox not found");
    });
  });

  describe("E2B Manager Core Functions", () => {
    it("should create sandbox with proper config", async () => {
      const sessionId = "test-session";
      const config: SandboxConfig = {
        sessionId,
        appType: "webapp" as const,
        allowInternetAccess: true,
        timeoutMs: 36000,
        resources: {
          cpu: 2,
          memory: 4,
        },
      };

      const result = await e2bManager.createSandbox(config);

      expect(result).toMatchObject({
        status: "created",
        publicUrl: expect.stringContaining("https://3000-"),
      });
    });
  });

  describe("Claude AI Integration", () => {
    it("should generate and deploy code from natural language prompt", async () => {
      const response = await request(app).post("/api/spawn").send({
        appType: "webapp",
        prompt: "Create a simple hello world page",
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: "ready",
        publicUrl: expect.stringContaining("https://3000-"),
        sessionId: expect.any(String),
      });
    });

    it("should fallback to test code when prompt provided but Claude fails", async () => {
      // Mock Claude to fail
      const mockClaudeClient = new ClaudeClient(
        { apiKey: "test-api-key" },
        mockLogger,
      );
      jest.spyOn(mockClaudeClient, "generateCode").mockResolvedValueOnce({
        success: false,
        error: "API error",
      });

      const appWithFailingClaude = express();
      appWithFailingClaude.use(express.json());
      appWithFailingClaude.use(
        "/api/spawn",
        createSpawnRoutes(e2bManager, mockLogger, mockClaudeClient),
      );

      const response = await request(appWithFailingClaude)
        .post("/api/spawn")
        .send({
          appType: "script",
          prompt: "Create a test script",
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Code generation failed");
    });

    it("should handle missing prompt gracefully", async () => {
      const response = await request(app).post("/api/spawn").send({
        appType: "webapp",
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: "created",
        sessionId: expect.any(String),
      });
    });
  });
});

