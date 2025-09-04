# Feature #1: E2B Orchestration Engine - Implementation Guide

## Architecture Overview

The E2B Orchestration Engine follows a modular architecture with clear separation of concerns:

```
Orchestrator Service
├── API Layer (Express routes)
├── Session Manager (Business logic)
├── E2B Manager (Sandbox operations)  
├── Claude Client (AI integration)
├── Cost Tracker (Billing & usage)
└── WebSocket Server (Real-time updates)
```

## Code Structure

### Directory Organization

```
apps/orchestrator/src/
├── api/
│   ├── routes/
│   │   ├── spawn.ts           # Session CRUD operations
│   │   ├── health.ts          # Health checks
│   │   └── index.ts           # Route aggregation
│   └── middleware/
│       ├── auth.ts            # Authentication middleware
│       ├── validation.ts      # Request validation
│       └── rate-limit.ts      # Rate limiting
├── orchestrator/
│   ├── session-manager.ts     # Core session orchestration
│   ├── workflow.ts            # Generation workflow engine
│   └── cleanup.ts             # Session cleanup jobs
├── vm/
│   ├── e2b-manager.ts         # E2B SDK integration
│   ├── deployment.ts          # App deployment logic
│   └── monitoring.ts          # Resource monitoring
├── ai/
│   ├── claude-client.ts       # Claude API integration
│   ├── prompt-templates.ts    # Optimized prompts per app type
│   ├── code-validator.ts      # Generated code validation
│   └── cost-estimator.ts      # Claude API cost tracking
├── billing/
│   ├── cost-tracker.ts        # Usage and cost tracking
│   ├── resource-limits.ts     # Quota enforcement
│   └── metrics.ts             # Usage analytics
├── websocket/
│   ├── server.ts              # WebSocket server setup
│   ├── events.ts              # Event handling
│   └── rooms.ts               # Session room management
├── database/
│   ├── models/                # Database models
│   │   ├── session.ts         # Session data model
│   │   ├── usage.ts           # Usage metrics model
│   │   └── index.ts           # Model exports
│   └── migrations/            # Database migrations
├── config/
│   ├── database.ts            # Database configuration
│   ├── e2b.ts                 # E2B SDK configuration
│   ├── claude.ts              # Claude API configuration
│   └── server.ts              # Server configuration
└── utils/
    ├── logger.ts              # Structured logging
    ├── errors.ts              # Custom error classes
    └── validators.ts          # Data validation helpers
```

## Key Components Implementation

### 1. E2B Manager (`vm/e2b-manager.ts`)

```typescript
import { Sandbox } from '@e2b/code-interpreter'
import { SandboxConfig, SandboxInstance, DeploymentResult } from '@spawnai/shared'
import { Logger } from '../utils/logger'

export class E2BManager {
  private activeSandboxes = new Map<string, Sandbox>()
  private logger = Logger.getLogger('E2BManager')

  async createSandbox(config: SandboxConfig): Promise<SandboxInstance> {
    this.logger.info('Creating E2B sandbox', { sessionId: config.sessionId, appType: config.appType })
    
    try {
      const sandbox = await Sandbox.create('anthropic-claude-code', {
        envs: {
          SESSION_ID: config.sessionId,
          APP_TYPE: config.appType,
          ANTHROPIC_API_KEY: process.env.CLAUDE_API_KEY
        },
        allowInternetAccess: config.allowInternetAccess,
        timeoutMs: config.timeoutMs
      })

      this.activeSandboxes.set(config.sessionId, sandbox)
      
      return {
        id: sandbox.id,
        sessionId: config.sessionId,
        status: 'created',
        createdAt: new Date(),
        host: sandbox.getHost(),
        publicUrl: this.getPublicUrl(sandbox.id, 3000)
      }
    } catch (error) {
      this.logger.error('Failed to create sandbox', { error, sessionId: config.sessionId })
      throw new Error(`Sandbox creation failed: ${error.message}`)
    }
  }

  async deploySandbox(sandbox: SandboxInstance, code: GeneratedCode): Promise<DeploymentResult> {
    const sandboxInstance = this.activeSandboxes.get(sandbox.sessionId)
    if (!sandboxInstance) {
      throw new Error('Sandbox not found')
    }

    this.logger.info('Deploying code to sandbox', { 
      sessionId: sandbox.sessionId, 
      type: code.type 
    })

    try {
      // Write files to sandbox
      for (const file of code.files) {
        await sandboxInstance.filesystem.write(file.path, file.content)
        if (file.executable) {
          await sandboxInstance.commands.run(`chmod +x ${file.path}`)
        }
      }

      // Install dependencies if needed
      if (code.dependencies?.length) {
        await this.installDependencies(sandboxInstance, code.dependencies)
      }

      // Build the application
      if (code.buildCommand) {
        const buildResult = await sandboxInstance.commands.run(code.buildCommand, {
          timeoutMs: 120000 // 2 minutes
        })
        
        if (buildResult.exitCode !== 0) {
          throw new Error(`Build failed: ${buildResult.stderr}`)
        }
      }

      // Start the application
      const startCommand = code.startCommand || this.getDefaultStartCommand(code)
      const startResult = await sandboxInstance.commands.run(
        `nohup ${startCommand} > app.log 2>&1 & echo $!`,
        { timeoutMs: 30000 }
      )

      if (startResult.exitCode !== 0) {
        throw new Error(`Application start failed: ${startResult.stderr}`)
      }

      // Wait for app to be ready
      await this.waitForAppReady(sandboxInstance, 3000)

      return {
        success: true,
        appUrl: this.getPublicUrl(sandbox.id, 3000),
        deployedAt: new Date(),
        logs: [startResult.stdout, startResult.stderr].filter(Boolean)
      }

    } catch (error) {
      this.logger.error('Deployment failed', { error, sessionId: sandbox.sessionId })
      return {
        success: false,
        error: error.message,
        deployedAt: new Date(),
        logs: []
      }
    }
  }

  private async installDependencies(sandbox: Sandbox, dependencies: string[]): Promise<void> {
    // Check if package.json exists or needs to be created
    const hasPackageJson = await sandbox.filesystem.exists('/app/package.json')
    
    if (!hasPackageJson && dependencies.some(dep => !dep.startsWith('python'))) {
      // Create package.json for Node.js dependencies
      const packageJson = {
        name: 'spawned-app',
        version: '1.0.0',
        dependencies: dependencies.reduce((acc, dep) => {
          acc[dep] = 'latest'
          return acc
        }, {} as Record<string, string>)
      }
      
      await sandbox.filesystem.write('/app/package.json', JSON.stringify(packageJson, null, 2))
    }

    // Install Node.js dependencies
    const nodeDeps = dependencies.filter(dep => !dep.startsWith('python'))
    if (nodeDeps.length > 0) {
      await sandbox.commands.run('cd /app && npm install', { timeoutMs: 180000 })
    }

    // Install Python dependencies
    const pythonDeps = dependencies.filter(dep => dep.startsWith('python:'))
    if (pythonDeps.length > 0) {
      const pipPackages = pythonDeps.map(dep => dep.replace('python:', '')).join(' ')
      await sandbox.commands.run(`pip install ${pipPackages}`, { timeoutMs: 180000 })
    }
  }

  private async waitForAppReady(sandbox: Sandbox, port: number, maxWaitMs: number = 30000): Promise<void> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitMs) {
      try {
        const result = await sandbox.commands.run(`curl -s -o /dev/null -w "%{http_code}" http://localhost:${port}`)
        if (result.stdout.trim() !== '000') { // Any HTTP response means app is ready
          return
        }
      } catch (error) {
        // Ignore curl errors, keep retrying
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2s between checks
    }
    
    throw new Error(`Application failed to start within ${maxWaitMs}ms`)
  }

  getPublicUrl(sandboxId: string, port: number): string {
    return `https://${port}-${sandboxId}.e2b.dev`
  }

  async destroySandbox(sessionId: string): Promise<void> {
    const sandbox = this.activeSandboxes.get(sessionId)
    if (sandbox) {
      try {
        await sandbox.kill()
        this.activeSandboxes.delete(sessionId)
        this.logger.info('Sandbox destroyed', { sessionId })
      } catch (error) {
        this.logger.error('Failed to destroy sandbox', { error, sessionId })
        throw error
      }
    }
  }
}
```

### 2. Session Manager (`orchestrator/session-manager.ts`)

```typescript
import { SessionResult, Session, CreateSessionRequest } from '@spawnai/shared'
import { E2BManager } from '../vm/e2b-manager'
import { ClaudeClient } from '../ai/claude-client'
import { CostTracker } from '../billing/cost-tracker'
import { WebSocketServer } from '../websocket/server'
import { DatabaseService } from '../database/service'

export class SessionManager {
  constructor(
    private e2bManager: E2BManager,
    private claudeClient: ClaudeClient,
    private costTracker: CostTracker,
    private wsServer: WebSocketServer,
    private db: DatabaseService
  ) {}

  async createSession(request: CreateSessionRequest): Promise<SessionResult> {
    const sessionId = this.generateSessionId()
    
    try {
      // Create session record
      const session = await this.db.sessions.create({
        id: sessionId,
        userId: request.userId,
        prompt: request.prompt,
        appType: request.appType,
        status: 'creating',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.getSessionTimeout(request.appType)),
        estimatedCost: this.estimateSessionCost(request.appType)
      })

      // Start session workflow asynchronously
      this.executeSessionWorkflow(session).catch(error => {
        this.handleSessionError(sessionId, error)
      })

      return {
        sessionId,
        status: 'creating',
        estimatedCost: session.estimatedCost,
        estimatedTime: this.getEstimatedTime(request.appType)
      }

    } catch (error) {
      throw new Error(`Failed to create session: ${error.message}`)
    }
  }

  private async executeSessionWorkflow(session: Session): Promise<void> {
    try {
      // Update status: generating
      await this.updateSessionStatus(session.id, 'generating', 'Generating code with AI...')

      // Generate code with Claude
      const generatedCode = await this.claudeClient.generateCode(session.prompt, session.appType)
      
      // Validate generated code
      const validation = await this.claudeClient.validateCode(generatedCode.files[0]?.content || '')
      if (!validation.valid) {
        throw new Error(`Generated code validation failed: ${validation.errors.join(', ')}`)
      }

      // Update status: deploying
      await this.updateSessionStatus(session.id, 'deploying', 'Creating secure environment...')

      // Create E2B sandbox
      const sandbox = await this.e2bManager.createSandbox({
        sessionId: session.id,
        appType: session.appType,
        allowInternetAccess: true,
        timeoutMs: this.getSessionTimeout(session.appType),
        resources: { cpu: 1, memory: 2 }
      })

      // Deploy code to sandbox
      const deployment = await this.e2bManager.deploySandbox(sandbox, generatedCode)
      
      if (!deployment.success) {
        throw new Error(`Deployment failed: ${deployment.error}`)
      }

      // Update session as ready
      await this.db.sessions.update(session.id, {
        status: 'ready',
        appUrl: deployment.appUrl,
        sandboxId: sandbox.id
      })

      // Notify via WebSocket
      this.wsServer.notifySessionUpdate(session.id, {
        status: 'ready',
        appUrl: deployment.appUrl,
        message: 'Your app is ready! 🚀'
      })

      // Start cost tracking
      await this.costTracker.trackSessionStart(session.id, {
        sessionId: session.id,
        appType: session.appType,
        allowInternetAccess: true,
        timeoutMs: this.getSessionTimeout(session.appType),
        resources: { cpu: 1, memory: 2 }
      })

    } catch (error) {
      await this.handleSessionError(session.id, error)
    }
  }

  private async updateSessionStatus(sessionId: string, status: string, message?: string): Promise<void> {
    await this.db.sessions.update(sessionId, { status })
    this.wsServer.notifySessionUpdate(sessionId, { status, message })
  }

  private async handleSessionError(sessionId: string, error: Error): Promise<void> {
    await this.db.sessions.update(sessionId, {
      status: 'error',
      errorMessage: error.message
    })

    this.wsServer.notifySessionError(sessionId, {
      error: error.message,
      recoverable: this.isRecoverableError(error)
    })

    // Cleanup any created resources
    try {
      await this.e2bManager.destroySandbox(sessionId)
    } catch (cleanupError) {
      // Log but don't throw cleanup errors
      console.error('Cleanup failed:', cleanupError)
    }
  }
}
```

### 3. Claude Client (`ai/claude-client.ts`)

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { GeneratedCode, ValidationResult } from '@spawnai/shared'
import { PromptTemplates } from './prompt-templates'

export class ClaudeClient {
  private client: Anthropic
  private prompts = new PromptTemplates()

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY
    })
  }

  async generateCode(prompt: string, appType: string): Promise<GeneratedCode> {
    const systemPrompt = this.prompts.getSystemPrompt(appType)
    const optimizedPrompt = await this.optimizePrompt(prompt, appType)

    const response = await this.client.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: optimizedPrompt }
      ]
    })

    const generatedContent = response.content[0].text
    return this.parseGeneratedCode(generatedContent, appType)
  }

  private parseGeneratedCode(content: string, appType: string): GeneratedCode {
    switch (appType) {
      case 'webapp':
        return {
          type: 'single-file',
          files: [{ path: '/app/index.html', content }],
          startCommand: 'cd /app && python3 -m http.server 3000'
        }
        
      case 'api':
        try {
          const parsed = JSON.parse(content)
          return {
            type: 'multi-file',
            files: Object.entries(parsed).map(([path, content]) => ({
              path: `/app/${path}`,
              content: content as string
            })),
            startCommand: 'cd /app && node server.js',
            dependencies: ['express']
          }
        } catch {
          // Fallback to single file if JSON parsing fails
          return {
            type: 'single-file',
            files: [{ path: '/app/server.js', content }],
            startCommand: 'cd /app && node server.js',
            dependencies: ['express']
          }
        }
        
      case 'script':
        return {
          type: 'single-file',
          files: [{ path: '/app/script.js', content }],
          startCommand: 'cd /app && node script.js > output.txt && python3 -m http.server 3000'
        }
        
      default:
        throw new Error(`Unsupported app type: ${appType}`)
    }
  }
}
```

## Database Schema

### Sessions Table
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255),
  prompt TEXT NOT NULL,
  app_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'creating',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  app_url VARCHAR(500),
  sandbox_id VARCHAR(255),
  error_message TEXT,
  estimated_cost DECIMAL(10,4) DEFAULT 0,
  actual_cost DECIMAL(10,4),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_expires_at (expires_at)
);
```

### Usage Metrics Table
```sql
CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id),
  start_time TIMESTAMP DEFAULT NOW(),
  end_time TIMESTAMP,
  cpu_seconds INTEGER DEFAULT 0,
  memory_gb_seconds DECIMAL(10,4) DEFAULT 0,
  storage_gb DECIMAL(10,4) DEFAULT 0,
  actual_cost DECIMAL(10,4) DEFAULT 0,
  plan VARCHAR(20) DEFAULT 'hobby',
  INDEX idx_session_id (session_id),
  INDEX idx_start_time (start_time)
);
```

## Configuration

### Environment Variables
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/spawnai
REDIS_URL=redis://localhost:6379

# E2B Configuration
E2B_API_KEY=your_e2b_api_key
E2B_PLAN=hobby # or 'pro'

# Claude API
CLAUDE_API_KEY=your_claude_api_key

# Server
PORT=3001
NODE_ENV=development
LOG_LEVEL=info

# Session Configuration
DEFAULT_SESSION_TIMEOUT_MS=3600000 # 1 hour
PRO_SESSION_TIMEOUT_MS=86400000    # 24 hours
MAX_CONCURRENT_SESSIONS=20         # hobby limit
```

## Error Handling Strategy

### Error Classification
```typescript
export enum ErrorType {
  USER_ERROR = 'user_error',      // Invalid input, quota exceeded
  API_ERROR = 'api_error',        // External service failures
  SYSTEM_ERROR = 'system_error',  // Internal application errors
  RESOURCE_ERROR = 'resource_error' // Resource limits, timeouts
}

export class SpawnAIError extends Error {
  constructor(
    public type: ErrorType,
    message: string,
    public recoverable: boolean = false,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'SpawnAIError'
  }
}
```

### Recovery Mechanisms
- Automatic retry for transient API failures (max 3 attempts)
- Fallback to simpler prompts if complex generation fails
- Resource cleanup on any error to prevent resource leaks
- User notification with clear next steps

## Performance Optimizations

### Caching Strategy
- Cache frequently used prompt templates
- Redis cache for session status queries
- Cache E2B sandbox creation metadata
- CDN caching for static assets

### Resource Management
- Connection pooling for database
- Rate limiting per user/IP
- Resource monitoring and alerting
- Automatic cleanup of expired sessions

This implementation guide provides the detailed foundation needed to build the E2B orchestration engine with production-ready code examples and configurations.