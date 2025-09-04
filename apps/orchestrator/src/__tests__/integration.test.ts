import request from 'supertest';
import express from 'express';
import { E2BManager } from '../vm/e2b-manager';
import { createSpawnRoutes } from '../api/routes/spawn';
import { Logger } from 'winston';

// Mock E2B SDK
jest.mock('@e2b/code-interpreter', () => ({
  Sandbox: {
    create: jest.fn().mockResolvedValue({
      getInfo: jest.fn().mockResolvedValue({
        sandboxId: 'mock-sandbox-id',
        hostname: 'mock-host.e2b.dev'
      }),
      kill: jest.fn().mockResolvedValue(undefined),
      files: {
        write: jest.fn().mockResolvedValue(undefined),
      },
    }),
  },
}));

// Mock logger
const mockLogger: Logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as any;

describe('E2B Integration Tests', () => {
  let app: express.Application;
  let e2bManager: E2BManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    e2bManager = new E2BManager(mockLogger);
    
    app = express();
    app.use(express.json());
    app.use('/api/spawn', createSpawnRoutes(e2bManager, mockLogger));
  });

  describe('Sandbox Lifecycle', () => {
    it('should create and destroy a sandbox', async () => {
      // Create sandbox
      const createResponse = await request(app)
        .post('/api/spawn')
        .send({
          appType: 'script',
          prompt: 'Create a hello world script'
        });

      expect(createResponse.status).toBe(200);
      expect(createResponse.body).toMatchObject({
        status: 'created',
        publicUrl: expect.stringContaining('https://3000-')
      });

      const sessionId = createResponse.body.sessionId;

      // Get sandbox info
      const getResponse = await request(app)
        .get(`/api/spawn/${sessionId}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.sessionId).toBe(sessionId);

      // Destroy sandbox
      const deleteResponse = await request(app)
        .delete(`/api/spawn/${sessionId}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.message).toBe('Sandbox destroyed successfully');
    });

    it('should validate required fields', async () => {
      // Invalid app type (should return 400)
      const response2 = await request(app)
        .post('/api/spawn')
        .send({
          appType: 'invalid',
          prompt: 'test'
        });

      expect(response2.status).toBe(400);
      expect(response2.body.error).toContain('Invalid app type');
    });

    it('should handle non-existent sandbox', async () => {
      const response = await request(app)
        .get('/api/spawn/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Sandbox not found');
    });
  });

  describe('E2B Manager Core Functions', () => {
    it('should create sandbox with proper config', async () => {
      const sessionId = 'test-session';
      const config = { 
        appType: 'webapp' as const,
        prompt: 'Create a test app'
      };

      const result = await e2bManager.createSandbox(sessionId, config);
      
      expect(result).toMatchObject({
        status: 'created',
        publicUrl: expect.stringContaining('https://3000-')
      });
    });

  });
});