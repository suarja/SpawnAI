# Feature #1: E2B Orchestration Engine - Technical Specification

## Problem Statement

SpawnAI needs a robust orchestration engine that can receive user prompts, generate code using Claude API, deploy applications in secure isolated environments, and provide HTTPS endpoints for generated apps within 60 seconds.

The orchestration engine is the core component that transforms user ideas into functional, accessible web applications through automated AI-powered development and deployment.

## Success Criteria

### Performance Targets
- **Time to Live App**: <60 seconds from prompt to accessible HTTPS URL
- **Success Rate**: >95% successful generations for valid prompts
- **Cost Per Session**: <$0.10 average (vs $0.50 target ceiling)
- **Concurrent Sessions**: Support 20 concurrent (hobby) / 100 concurrent (pro)
- **Session Reliability**: <1% unexpected failures

### Functional Requirements
- Generate working applications from natural language prompts
- Support multiple app types: webapp, API, script
- Provide secure HTTPS endpoints automatically
- Handle session lifecycle (create, monitor, destroy)
- Integrate with Claude API for code generation
- Implement cost tracking and resource management

## Technical Requirements

### Core Components

#### 1. E2B Sandbox Manager (`src/vm/e2b-manager.ts`)
```typescript
interface E2BSandboxManager {
  createSandbox(config: SandboxConfig): Promise<SandboxInstance>
  deploySandbox(sandbox: SandboxInstance, code: GeneratedCode): Promise<DeploymentResult>
  monitorSandbox(sandboxId: string): Promise<SandboxStatus>
  destroySandbox(sandboxId: string): Promise<void>
  getPublicUrl(sandboxId: string, port: number): string
  listActiveSandboxes(): Promise<SandboxInstance[]>
}

interface SandboxConfig {
  sessionId: string
  appType: 'webapp' | 'api' | 'script'
  allowInternetAccess: boolean
  timeoutMs: number
  resources: {
    cpu: number
    memory: number
  }
}
```

#### 2. Claude AI Integration (`src/ai/claude-client.ts`)
```typescript
interface ClaudeClient {
  generateCode(prompt: string, appType: string): Promise<GeneratedCode>
  validateCode(code: string): Promise<ValidationResult>
  optimizePrompt(userPrompt: string, appType: string): Promise<string>
}

interface GeneratedCode {
  type: 'single-file' | 'multi-file'
  files: Array<{
    path: string
    content: string
    executable?: boolean
  }>
  startCommand?: string
  buildCommand?: string
  dependencies?: string[]
}
```

#### 3. Session Orchestrator (`src/orchestrator/session-manager.ts`)
```typescript
interface SessionManager {
  createSession(prompt: string, appType: string): Promise<SessionResult>
  getSession(sessionId: string): Promise<Session>
  listSessions(userId?: string): Promise<Session[]>
  extendSession(sessionId: string, additionalTime: number): Promise<void>
  destroySession(sessionId: string): Promise<void>
}

interface Session {
  id: string
  userId?: string
  prompt: string
  appType: string
  status: 'creating' | 'generating' | 'deploying' | 'ready' | 'error' | 'expired'
  createdAt: Date
  expiresAt: Date
  appUrl?: string
  sandboxId?: string
  errorMessage?: string
  estimatedCost: number
  actualCost?: number
}
```

#### 4. Cost Management (`src/billing/cost-tracker.ts`)
```typescript
interface CostTracker {
  trackSessionStart(sessionId: string, config: SandboxConfig): Promise<void>
  updateSessionCost(sessionId: string, usage: UsageMetrics): Promise<void>
  calculateSessionCost(sessionId: string): Promise<number>
  getUsageSummary(timeframe: TimeRange): Promise<UsageSummary>
  checkResourceLimits(userId?: string): Promise<ResourceStatus>
}

interface UsageMetrics {
  cpuSeconds: number
  memoryGbSeconds: number
  storageGb: number
  durationSeconds: number
}
```

## Dependencies

### External Services
- **E2B API**: Sandbox creation and management
- **Anthropic Claude API**: Code generation
- **Redis**: Session state and queue management
- **PostgreSQL**: Persistent data storage

### Internal Packages
- `@spawnai/shared`: Types and utilities
- Express.js server framework
- WebSocket for real-time updates

### E2B SDK Integration
```bash
# Required E2B packages
npm install @e2b/code-interpreter @e2b/sdk
```

## Constraints

### E2B Limitations
- **Session Duration**: 1h (hobby) / 24h (pro plan)
- **Concurrent Limits**: 20 (hobby) / 100 (pro plan)
- **Resource Limits**: Standard CPU/RAM (hobby), customizable (pro)
- **Cost Model**: Per-second billing (~$0.000014/vCPU/second)

### Technical Constraints
- Generated code must be self-contained (minimal external dependencies)
- Applications must run on standard ports (3000, 8000, 8080)
- No persistent data storage in generated apps
- Limited to supported runtimes (Node.js, Python, basic HTTP servers)

### Security Constraints
- All code executed in isolated E2B sandboxes
- No access to host filesystem outside sandbox
- Network access controllable per session
- Resource usage monitoring and limits

## API Contracts

### REST Endpoints

#### Create Session
```http
POST /api/spawn
Content-Type: application/json

{
  "prompt": "Build me a simple todo app",
  "appType": "webapp",
  "userId": "optional-user-id"
}

Response:
{
  "sessionId": "uuid",
  "status": "creating",
  "estimatedCost": 0.065,
  "estimatedTime": 45
}
```

#### Get Session Status
```http
GET /api/spawn/{sessionId}

Response:
{
  "sessionId": "uuid",
  "status": "ready",
  "appUrl": "https://3000-abc123.e2b.dev",
  "expiresAt": "2024-01-15T14:30:00Z",
  "actualCost": 0.043
}
```

#### Extend Session
```http
POST /api/spawn/{sessionId}/extend
{
  "additionalHours": 2
}

Response:
{
  "sessionId": "uuid",
  "newExpiresAt": "2024-01-15T16:30:00Z",
  "additionalCost": 0.032
}
```

### WebSocket Events

#### Client → Server
```typescript
interface ClientEvents {
  'session_subscribe': { sessionId: string }
  'session_unsubscribe': { sessionId: string }
  'session_destroy': { sessionId: string }
}
```

#### Server → Client
```typescript
interface ServerEvents {
  'session_update': {
    sessionId: string
    status: string
    message?: string
    appUrl?: string
    progress?: number
  }
  'session_error': {
    sessionId: string
    error: string
    recoverable: boolean
  }
  'session_expired': {
    sessionId: string
    finalCost: number
  }
}
```

## Security Considerations

### Input Validation
- Prompt length limits (max 2000 characters)
- App type validation against allowed values
- Rate limiting per IP/user
- Malicious code pattern detection

### E2B Sandbox Security
- Internet access controlled per session
- Resource limits enforced automatically
- Isolated filesystem and network
- Auto-cleanup after timeout

### Code Generation Security
- Static analysis of generated code before deployment
- Blacklist of dangerous functions/modules
- Sandboxed execution environment
- No access to sensitive host resources

### API Security
- Authentication for session management
- Rate limiting on creation endpoints
- Input sanitization and validation
- CORS configuration for web clients

## Performance Requirements

### Response Times
- Session creation: <2 seconds
- Code generation: <15 seconds
- App deployment: <30 seconds
- Status queries: <100ms

### Throughput
- 20 concurrent sessions (hobby plan)
- 100 concurrent sessions (pro plan)
- 1000+ status queries per second
- WebSocket support for 500+ concurrent connections

### Resource Usage
- Memory: <512MB per session management
- CPU: <1 vCPU for orchestrator
- Storage: <1GB for temporary files
- Network: <100MB/s aggregate bandwidth

## Error Handling

### Error Categories
1. **User Errors**: Invalid prompts, quota exceeded
2. **API Errors**: Claude API failures, E2B service issues
3. **System Errors**: Database connections, internal failures
4. **Resource Errors**: Memory/CPU limits, timeout exceeded

### Recovery Strategies
- Automatic retry for transient failures
- Fallback prompt templates for generation failures
- Session cleanup on unrecoverable errors
- User notification with clear error messages

### Monitoring
- Error rate tracking per error type
- Performance metrics collection
- Cost tracking and alerting
- Health checks for all dependencies

This specification provides the foundation for implementing the E2B orchestration engine as the core component of SpawnAI's "ugly but functional" app generation platform.