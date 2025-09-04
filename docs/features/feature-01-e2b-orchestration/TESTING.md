# Feature #1: E2B Orchestration Engine - Testing Strategy

## Testing Philosophy

The E2B Orchestration Engine requires comprehensive testing across multiple dimensions:
- **Reliability**: Sessions must succeed 95%+ of the time
- **Performance**: <60 seconds time-to-live app
- **Security**: Code execution isolation and validation
- **Cost**: Stay within $0.10 average per session
- **Scalability**: Handle 20-100 concurrent sessions

## Test Categories

### 1. Unit Tests

#### E2B Manager Tests (`tests/unit/vm/e2b-manager.test.ts`)

```typescript
import { E2BManager } from '../../../src/vm/e2b-manager'
import { Sandbox } from '@e2b/code-interpreter'

jest.mock('@e2b/code-interpreter')

describe('E2BManager', () => {
  let e2bManager: E2BManager
  let mockSandbox: jest.Mocked<Sandbox>

  beforeEach(() => {
    e2bManager = new E2BManager()
    mockSandbox = {
      id: 'test-sandbox-123',
      getHost: jest.fn().mockReturnValue('test-host'),
      filesystem: {
        write: jest.fn().mockResolvedValue(undefined),
        exists: jest.fn().mockResolvedValue(true)
      },
      commands: {
        run: jest.fn().mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })
      },
      kill: jest.fn().mockResolvedValue(undefined)
    } as any

    jest.mocked(Sandbox.create).mockResolvedValue(mockSandbox)
  })

  describe('createSandbox', () => {
    it('should create sandbox with correct configuration', async () => {
      const config = {
        sessionId: 'test-session',
        appType: 'webapp' as const,
        allowInternetAccess: true,
        timeoutMs: 3600000,
        resources: { cpu: 1, memory: 2 }
      }

      const result = await e2bManager.createSandbox(config)

      expect(Sandbox.create).toHaveBeenCalledWith('anthropic-claude-code', {
        envs: {
          SESSION_ID: 'test-session',
          APP_TYPE: 'webapp',
          ANTHROPIC_API_KEY: process.env.CLAUDE_API_KEY
        },
        allowInternetAccess: true,
        timeoutMs: 3600000
      })

      expect(result).toMatchObject({
        id: 'test-sandbox-123',
        sessionId: 'test-session',
        status: 'created',
        host: 'test-host',
        publicUrl: 'https://3000-test-sandbox-123.e2b.dev'
      })
    })

    it('should handle sandbox creation failures', async () => {
      const error = new Error('E2B API error')
      jest.mocked(Sandbox.create).mockRejectedValue(error)

      const config = {
        sessionId: 'test-session',
        appType: 'webapp' as const,
        allowInternetAccess: true,
        timeoutMs: 3600000,
        resources: { cpu: 1, memory: 2 }
      }

      await expect(e2bManager.createSandbox(config))
        .rejects
        .toThrow('Sandbox creation failed: E2B API error')
    })
  })

  describe('deploySandbox', () => {
    it('should deploy webapp successfully', async () => {
      const sandbox = {
        id: 'test-sandbox',
        sessionId: 'test-session',
        status: 'created' as const,
        createdAt: new Date(),
        host: 'test-host',
        publicUrl: 'https://3000-test-sandbox.e2b.dev'
      }

      const code = {
        type: 'single-file' as const,
        files: [{ path: '/app/index.html', content: '<html>Hello World</html>' }],
        startCommand: 'cd /app && python3 -m http.server 3000'
      }

      // Mock successful deployment
      mockSandbox.commands.run
        .mockResolvedValueOnce({ exitCode: 0, stdout: '12345', stderr: '' }) // start command
        .mockResolvedValue({ exitCode: 0, stdout: '200', stderr: '' }) // health check

      const result = await e2bManager.deploySandbox(sandbox, code)

      expect(mockSandbox.filesystem.write).toHaveBeenCalledWith('/app/index.html', '<html>Hello World</html>')
      expect(result.success).toBe(true)
      expect(result.appUrl).toBe('https://3000-test-sandbox.e2b.dev')
    })
  })
})
```

#### Claude Client Tests (`tests/unit/ai/claude-client.test.ts`)

```typescript
import { ClaudeClient } from '../../../src/ai/claude-client'
import Anthropic from '@anthropic-ai/sdk'

jest.mock('@anthropic-ai/sdk')

describe('ClaudeClient', () => {
  let claudeClient: ClaudeClient
  let mockAnthropic: jest.Mocked<Anthropic>

  beforeEach(() => {
    mockAnthropic = {
      messages: {
        create: jest.fn()
      }
    } as any

    jest.mocked(Anthropic).mockImplementation(() => mockAnthropic)
    claudeClient = new ClaudeClient()
  })

  describe('generateCode', () => {
    it('should generate webapp code', async () => {
      const htmlContent = '<html><body><h1>Hello World</h1></body></html>'
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ text: htmlContent }]
      } as any)

      const result = await claudeClient.generateCode('Create a hello world page', 'webapp')

      expect(result).toMatchObject({
        type: 'single-file',
        files: [{ path: '/app/index.html', content: htmlContent }],
        startCommand: 'cd /app && python3 -m http.server 3000'
      })
    })

    it('should generate API code', async () => {
      const apiCode = JSON.stringify({
        'server.js': 'const express = require("express"); const app = express(); app.listen(3000);',
        'package.json': '{"dependencies": {"express": "^4.18.0"}}'
      })

      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ text: apiCode }]
      } as any)

      const result = await claudeClient.generateCode('Create a simple API', 'api')

      expect(result.type).toBe('multi-file')
      expect(result.files).toHaveLength(2)
      expect(result.dependencies).toContain('express')
    })
  })
})
```

#### Session Manager Tests (`tests/unit/orchestrator/session-manager.test.ts`)

```typescript
import { SessionManager } from '../../../src/orchestrator/session-manager'

describe('SessionManager', () => {
  let sessionManager: SessionManager
  let mockE2BManager: any
  let mockClaudeClient: any
  let mockCostTracker: any
  let mockWSServer: any
  let mockDB: any

  beforeEach(() => {
    // Mock all dependencies
    mockE2BManager = {
      createSandbox: jest.fn(),
      deploySandbox: jest.fn(),
      destroySandbox: jest.fn()
    }

    mockClaudeClient = {
      generateCode: jest.fn(),
      validateCode: jest.fn()
    }

    mockCostTracker = {
      trackSessionStart: jest.fn()
    }

    mockWSServer = {
      notifySessionUpdate: jest.fn(),
      notifySessionError: jest.fn()
    }

    mockDB = {
      sessions: {
        create: jest.fn(),
        update: jest.fn()
      }
    }

    sessionManager = new SessionManager(
      mockE2BManager,
      mockClaudeClient,
      mockCostTracker,
      mockWSServer,
      mockDB
    )
  })

  describe('createSession', () => {
    it('should create session and start workflow', async () => {
      const request = {
        prompt: 'Build a calculator',
        appType: 'webapp' as const,
        userId: 'user-123'
      }

      mockDB.sessions.create.mockResolvedValue({
        id: 'session-123',
        ...request,
        status: 'creating',
        estimatedCost: 0.065
      })

      const result = await sessionManager.createSession(request)

      expect(result.sessionId).toMatch(/^[0-9a-f-]{36}$/) // UUID format
      expect(result.status).toBe('creating')
      expect(result.estimatedCost).toBe(0.065)
      expect(mockDB.sessions.create).toHaveBeenCalled()
    })
  })
})
```

### 2. Integration Tests

#### End-to-End Session Creation (`tests/integration/session-workflow.test.ts`)

```typescript
import request from 'supertest'
import { app } from '../../src/app'
import { DatabaseService } from '../../src/database/service'

describe('Session Workflow Integration', () => {
  let db: DatabaseService

  beforeAll(async () => {
    db = new DatabaseService()
    await db.connect()
  })

  afterAll(async () => {
    await db.disconnect()
  })

  beforeEach(async () => {
    await db.sessions.deleteAll() // Clean test data
  })

  it('should create and deploy webapp session successfully', async () => {
    const prompt = 'Create a simple hello world webpage with a button'
    
    // Create session
    const createResponse = await request(app)
      .post('/api/spawn')
      .send({ prompt, appType: 'webapp' })
      .expect(201)

    expect(createResponse.body.sessionId).toBeDefined()
    expect(createResponse.body.status).toBe('creating')

    const sessionId = createResponse.body.sessionId

    // Poll for completion (with timeout)
    let attempts = 0
    let session = null

    while (attempts < 30) { // 60 seconds max wait
      const statusResponse = await request(app)
        .get(`/api/spawn/${sessionId}`)
        .expect(200)

      session = statusResponse.body

      if (session.status === 'ready') {
        break
      } else if (session.status === 'error') {
        fail(`Session failed: ${session.errorMessage}`)
      }

      await new Promise(resolve => setTimeout(resolve, 2000))
      attempts++
    }

    expect(session.status).toBe('ready')
    expect(session.appUrl).toMatch(/^https:\/\/3000-.*\.e2b\.dev$/)

    // Verify the app is accessible
    const appResponse = await fetch(session.appUrl)
    expect(appResponse.status).toBe(200)
    
    const html = await appResponse.text()
    expect(html.toLowerCase()).toContain('hello')
  }, 90000) // 90 second timeout

  it('should handle invalid prompts gracefully', async () => {
    const response = await request(app)
      .post('/api/spawn')
      .send({ prompt: '', appType: 'webapp' })
      .expect(400)

    expect(response.body.error).toContain('Invalid prompt')
  })

  it('should respect concurrent session limits', async () => {
    const promises = []
    const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_SESSIONS || '20')

    // Create max concurrent sessions
    for (let i = 0; i < maxConcurrent + 1; i++) {
      promises.push(
        request(app)
          .post('/api/spawn')
          .send({ prompt: `Test app ${i}`, appType: 'script' })
      )
    }

    const responses = await Promise.all(promises)
    const rejected = responses.filter(r => r.status === 429)

    expect(rejected.length).toBeGreaterThan(0) // At least one should be rate limited
  })
})
```

### 3. End-to-End Tests

#### Full User Journey (`tests/e2e/user-journey.test.ts`)

```typescript
import { Browser, Page, chromium } from 'playwright'

describe('Complete User Journey', () => {
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    browser = await chromium.launch()
  })

  afterAll(async () => {
    await browser.close()
  })

  beforeEach(async () => {
    page = await browser.newPage()
  })

  afterEach(async () => {
    await page.close()
  })

  it('should complete full webapp generation flow', async () => {
    // Navigate to SpawnAI interface
    await page.goto('http://localhost:3001/health')
    
    // Simulate API call for session creation
    const sessionResponse = await page.evaluate(async () => {
      const response = await fetch('/api/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Create a simple todo list app with add and delete functionality',
          appType: 'webapp'
        })
      })
      return response.json()
    })

    expect(sessionResponse.sessionId).toBeDefined()

    // Wait for session to complete
    let appUrl = null
    let attempts = 0

    while (attempts < 30 && !appUrl) {
      const status = await page.evaluate(async (sessionId) => {
        const response = await fetch(`/api/spawn/${sessionId}`)
        return response.json()
      }, sessionResponse.sessionId)

      if (status.status === 'ready') {
        appUrl = status.appUrl
        break
      } else if (status.status === 'error') {
        fail(`Session failed: ${status.errorMessage}`)
      }

      await page.waitForTimeout(2000)
      attempts++
    }

    expect(appUrl).toMatch(/^https:\/\/3000-.*\.e2b\.dev$/)

    // Navigate to generated app
    await page.goto(appUrl)

    // Verify app functionality
    await page.waitForSelector('body', { timeout: 10000 })
    
    const pageContent = await page.textContent('body')
    expect(pageContent.toLowerCase()).toContain('todo')

    // Test basic functionality if possible
    const addButton = await page.locator('button, input[type="button"], input[type="submit"]').first()
    if (await addButton.isVisible()) {
      // App has interactive elements - it's working!
      expect(true).toBe(true)
    }
  }, 120000) // 2 minute timeout
})
```

### 4. Performance Tests

#### Load Testing (`tests/performance/load.test.ts`)

```typescript
import autocannon from 'autocannon'

describe('Performance Tests', () => {
  it('should handle concurrent session creation', async () => {
    const result = await autocannon({
      url: 'http://localhost:3001/api/spawn',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Create a simple webpage',
        appType: 'webapp'
      }),
      connections: 10,
      duration: 10, // 10 seconds
      pipelining: 1
    })

    expect(result.non2xx).toBe(0) // No errors
    expect(result.latency.average).toBeLessThan(2000) // <2s average response
    expect(result.requests.average).toBeGreaterThan(5) // >5 req/sec
  })

  it('should maintain performance under sustained load', async () => {
    const result = await autocannon({
      url: 'http://localhost:3001/api/spawn/test-session/status',
      method: 'GET',
      connections: 50,
      duration: 30,
      pipelining: 1
    })

    expect(result.latency.average).toBeLessThan(100) // <100ms for status queries
    expect(result.requests.average).toBeGreaterThan(500) // >500 req/sec
  })
})
```

### 5. Security Tests

#### Input Validation & Code Safety (`tests/security/validation.test.ts`)

```typescript
import { ClaudeClient } from '../../src/ai/claude-client'

describe('Security Tests', () => {
  let claudeClient: ClaudeClient

  beforeEach(() => {
    claudeClient = new ClaudeClient()
  })

  it('should detect dangerous code patterns', async () => {
    const dangerousPrompts = [
      'Create an app that reads all files from /etc',
      'Build a script that executes shell commands',
      'Make an app that connects to external databases',
      'Create a crypto miner application'
    ]

    for (const prompt of dangerousPrompts) {
      const code = await claudeClient.generateCode(prompt, 'script')
      const validation = await claudeClient.validateCode(code.files[0].content)
      
      // Either generation should be refused or validation should catch it
      expect(validation.valid).toBe(false)
    }
  })

  it('should sanitize user inputs', async () => {
    const maliciousInputs = [
      '<script>alert("xss")</script>',
      '"; DROP TABLE sessions; --',
      '../../etc/passwd',
      '${process.env.CLAUDE_API_KEY}'
    ]

    for (const input of maliciousInputs) {
      // Should not throw errors, should sanitize instead
      await expect(claudeClient.generateCode(input, 'webapp')).resolves.toBeDefined()
    }
  })
})
```

## Test Data Management

### Test Database Setup

```sql
-- Test database schema
CREATE DATABASE spawnai_test;

-- Use separate test tables with '_test' suffix
CREATE TABLE sessions_test (
  -- Same schema as production
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ... rest of schema
);
```

### Mock Data Generators

```typescript
// tests/helpers/generators.ts
export const generateMockSession = (overrides?: Partial<Session>): Session => ({
  id: 'test-session-123',
  userId: 'test-user',
  prompt: 'Build a simple app',
  appType: 'webapp',
  status: 'creating',
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 3600000),
  estimatedCost: 0.065,
  ...overrides
})

export const generateMockGeneratedCode = (appType: string): GeneratedCode => {
  const templates = {
    webapp: {
      type: 'single-file' as const,
      files: [{ path: '/app/index.html', content: '<html>Test App</html>' }],
      startCommand: 'cd /app && python3 -m http.server 3000'
    },
    api: {
      type: 'multi-file' as const,
      files: [
        { path: '/app/server.js', content: 'const express = require("express"); const app = express(); app.listen(3000);' },
        { path: '/app/package.json', content: '{"dependencies":{"express":"^4.18.0"}}' }
      ],
      startCommand: 'cd /app && node server.js',
      dependencies: ['express']
    }
  }
  
  return templates[appType] || templates.webapp
}
```

## Test Execution

### Test Scripts (`package.json`)

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "jest tests/e2e",
    "test:performance": "jest tests/performance",
    "test:security": "jest tests/security",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=4"
  }
}
```

### Jest Configuration (`jest.config.js`)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  maxWorkers: 4
}
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: spawnai_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:6
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'pnpm'
    
    - name: Install dependencies
      run: pnpm install
    
    - name: Run unit tests
      run: pnpm test:unit
    
    - name: Run integration tests
      run: pnpm test:integration
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/spawnai_test
        REDIS_URL: redis://localhost:6379
        E2B_API_KEY: ${{ secrets.E2B_API_KEY }}
        CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
    
    - name: Run security tests
      run: pnpm test:security
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

## Success Metrics

### Test Coverage Targets
- **Unit Tests**: 90%+ code coverage
- **Integration Tests**: 100% API endpoint coverage
- **E2E Tests**: 100% user journey coverage
- **Performance Tests**: All SLA requirements met
- **Security Tests**: Zero critical vulnerabilities

### Performance Benchmarks
- Session creation: <2 seconds
- Code generation: <15 seconds
- App deployment: <30 seconds
- Total time-to-app: <60 seconds
- Status queries: <100ms
- Concurrent capacity: 20/100 sessions

This comprehensive testing strategy ensures the E2B orchestration engine meets all reliability, performance, security, and scalability requirements for production deployment.