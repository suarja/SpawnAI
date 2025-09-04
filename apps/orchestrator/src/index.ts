import express from 'express';
import dotenv from 'dotenv';
import { createLogger, format, transports } from 'winston';
import { E2BManager } from './vm/e2b-manager';
import { ClaudeClient } from './ai/claude-client';
import { createSpawnRoutes } from './api/routes/spawn';

// Load environment variables
dotenv.config();

// Setup logger
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'orchestrator' },
  transports: [
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' }),
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

const app = express();
const port = process.env.PORT || 3001;

// Initialize E2B Manager
const e2bManager = new E2BManager(logger);

// Initialize Claude AI Client (optional)
let claudeClient: ClaudeClient | undefined;
if (process.env.CLAUDE_API_KEY) {
  claudeClient = new ClaudeClient({
    apiKey: process.env.CLAUDE_API_KEY
  }, logger);
  logger.info('Claude AI client initialized');
} else {
  logger.warn('CLAUDE_API_KEY not found - AI generation disabled');
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'orchestrator',
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// API routes
app.get('/api/status', (req, res) => {
  res.json({
    service: 'SpawnAI Orchestrator',
    status: 'running',
    features: {
      e2bSandboxManagement: 'ready',
      claudeIntegration: claudeClient ? 'ready' : 'disabled',
      security: 'planned',
      deployment: 'planned'
    },
    e2b: {
      apiKey: process.env.E2B_API_KEY ? 'configured' : 'missing',
      activeSandboxes: e2bManager.listActiveSandboxes?.length || 0
    },
    claude: {
      apiKey: process.env.CLAUDE_API_KEY ? 'configured' : 'missing',
      status: claudeClient ? 'ready' : 'disabled'
    }
  });
});

// Spawn API routes - AI-powered sandbox lifecycle management
app.use('/api/spawn', createSpawnRoutes(e2bManager, logger, claudeClient));

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  logger.info(`🚀 SpawnAI Orchestrator running on port ${port}`);
  logger.info('Environment:', process.env.NODE_ENV || 'development');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
