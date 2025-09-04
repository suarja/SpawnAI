import { Router, Request, Response } from 'express'
import { E2BManager, SandboxConfig, GeneratedCode } from '../../vm/e2b-manager'
import { Logger } from 'winston'
import { v4 as uuidv4 } from 'uuid'

export interface CreateSandboxRequest {
  appType: 'webapp' | 'api' | 'script'
  allowInternetAccess?: boolean
  timeoutMs?: number
  testCode?: GeneratedCode // For testing purposes
}

export interface CreateSandboxResponse {
  sessionId: string
  sandboxId: string
  status: string
  publicUrl?: string
  estimatedTime: number
}

export interface SandboxStatusResponse {
  sessionId: string
  sandboxId: string
  status: string
  publicUrl?: string
  error?: string
  createdAt: Date
}

/**
 * Spawn API Routes
 * Handles sandbox lifecycle management endpoints
 */
export function createSpawnRoutes(e2bManager: E2BManager, logger: Logger): Router {
  const router = Router()

  /**
   * POST /api/spawn
   * Create a new sandbox and optionally deploy test code
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { appType, allowInternetAccess = true, timeoutMs = 3600000, testCode }: CreateSandboxRequest = req.body

      // Validate input
      if (!appType || !['webapp', 'api', 'script'].includes(appType)) {
        return res.status(400).json({
          error: 'Invalid app type. Must be webapp, api, or script'
        })
      }

      const sessionId = uuidv4()
      logger.info('Creating new sandbox session', { sessionId, appType })

      // Create sandbox configuration
      const config: SandboxConfig = {
        sessionId,
        appType,
        allowInternetAccess,
        timeoutMs,
        resources: {
          cpu: 1,
          memory: 2 // GB
        }
      }

      // Create the sandbox
      const sandbox = await e2bManager.createSandbox(config)

      let deploymentResult = null
      if (testCode) {
        logger.info('Deploying test code to sandbox', { sessionId })
        deploymentResult = await e2bManager.deploySandbox(sandbox, testCode)
        
        if (!deploymentResult.success) {
          logger.error('Test code deployment failed', { 
            sessionId, 
            error: deploymentResult.error 
          })
        }
      }

      const response: CreateSandboxResponse = {
        sessionId,
        sandboxId: sandbox.id,
        status: deploymentResult?.success ? 'ready' : 'created',
        publicUrl: deploymentResult?.success ? deploymentResult.appUrl : sandbox.publicUrl,
        estimatedTime: testCode ? 45 : 10 // seconds
      }

      logger.info('Sandbox created successfully', {
        sessionId,
        sandboxId: sandbox.id,
        status: response.status
      })

      res.json(response)

    } catch (error) {
      logger.error('Failed to create sandbox', { 
        error: error instanceof Error ? error.message : error 
      })
      res.status(500).json({
        error: 'Failed to create sandbox',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  /**
   * GET /api/spawn/:sessionId
   * Get sandbox status and information
   */
  router.get('/:sessionId', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params

      if (!sessionId) {
        return res.status(400).json({
          error: 'Session ID is required'
        })
      }

      logger.debug('Getting sandbox status', { sessionId })

      const sandbox = await e2bManager.monitorSandbox(sessionId)
      
      if (!sandbox) {
        return res.status(404).json({
          error: 'Sandbox not found',
          sessionId
        })
      }

      const response: SandboxStatusResponse = {
        sessionId: sandbox.sessionId,
        sandboxId: sandbox.id,
        status: sandbox.status,
        publicUrl: sandbox.publicUrl,
        error: sandbox.error,
        createdAt: sandbox.createdAt
      }

      res.json(response)

    } catch (error) {
      logger.error('Failed to get sandbox status', { 
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : error 
      })
      res.status(500).json({
        error: 'Failed to get sandbox status',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  /**
   * DELETE /api/spawn/:sessionId
   * Destroy a sandbox and cleanup resources
   */
  router.delete('/:sessionId', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params

      if (!sessionId) {
        return res.status(400).json({
          error: 'Session ID is required'
        })
      }

      logger.info('Destroying sandbox', { sessionId })

      await e2bManager.destroySandbox(sessionId)

      res.json({
        message: 'Sandbox destroyed successfully',
        sessionId
      })

    } catch (error) {
      logger.error('Failed to destroy sandbox', { 
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : error 
      })
      res.status(500).json({
        error: 'Failed to destroy sandbox',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  /**
   * GET /api/spawn
   * List all active sandboxes
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      logger.debug('Listing active sandboxes')

      const sandboxes = await e2bManager.listActiveSandboxes()

      res.json({
        count: sandboxes.length,
        sandboxes: sandboxes.map(sb => ({
          sessionId: sb.sessionId,
          sandboxId: sb.id,
          status: sb.status,
          publicUrl: sb.publicUrl,
          createdAt: sb.createdAt
        }))
      })

    } catch (error) {
      logger.error('Failed to list sandboxes', { 
        error: error instanceof Error ? error.message : error 
      })
      res.status(500).json({
        error: 'Failed to list sandboxes',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  /**
   * POST /api/spawn/:sessionId/deploy
   * Deploy code to an existing sandbox
   */
  router.post('/:sessionId/deploy', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params
      const { code }: { code: GeneratedCode } = req.body

      if (!sessionId) {
        return res.status(400).json({
          error: 'Session ID is required'
        })
      }

      if (!code || !code.files || code.files.length === 0) {
        return res.status(400).json({
          error: 'Code with files is required'
        })
      }

      logger.info('Deploying code to existing sandbox', { 
        sessionId, 
        fileCount: code.files.length 
      })

      // Get sandbox instance
      const sandbox = await e2bManager.monitorSandbox(sessionId)
      if (!sandbox) {
        return res.status(404).json({
          error: 'Sandbox not found',
          sessionId
        })
      }

      // Deploy the code
      const deploymentResult = await e2bManager.deploySandbox(sandbox, code)

      if (deploymentResult.success) {
        logger.info('Code deployed successfully', { 
          sessionId, 
          appUrl: deploymentResult.appUrl 
        })
        res.json({
          success: true,
          appUrl: deploymentResult.appUrl,
          deployedAt: deploymentResult.deployedAt,
          logs: deploymentResult.logs
        })
      } else {
        logger.error('Code deployment failed', { 
          sessionId, 
          error: deploymentResult.error 
        })
        res.status(500).json({
          success: false,
          error: deploymentResult.error,
          deployedAt: deploymentResult.deployedAt,
          logs: deploymentResult.logs
        })
      }

    } catch (error) {
      logger.error('Failed to deploy code', { 
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : error 
      })
      res.status(500).json({
        error: 'Failed to deploy code',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  /**
   * POST /api/spawn/cleanup
   * Cleanup expired sandboxes (admin endpoint)
   */
  router.post('/cleanup', async (req: Request, res: Response) => {
    try {
      logger.info('Starting manual cleanup of expired sandboxes')
      
      await e2bManager.cleanupExpiredSandboxes()
      
      const activeSandboxes = await e2bManager.listActiveSandboxes()
      
      res.json({
        message: 'Cleanup completed',
        activeSandboxCount: activeSandboxes.length
      })

    } catch (error) {
      logger.error('Failed to cleanup sandboxes', { 
        error: error instanceof Error ? error.message : error 
      })
      res.status(500).json({
        error: 'Failed to cleanup sandboxes',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  return router
}

/**
 * Helper function to create test code for different app types
 */
export function createTestCode(appType: 'webapp' | 'api' | 'script'): GeneratedCode {
  switch (appType) {
    case 'webapp':
      return {
        type: 'single-file',
        files: [{
          path: '/app/index.html',
          content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SpawnAI Test App</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f0f0f0; }
        .container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        .status { color: #28a745; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 SpawnAI Test App</h1>
        <p class="status">✅ Sandbox is running successfully!</p>
        <p>This is a simple test webapp deployed to an E2B sandbox.</p>
        <p>Generated at: <strong>${new Date().toISOString()}</strong></p>
    </div>
</body>
</html>`
        }],
        startCommand: 'cd /app && python3 -m http.server 3000'
      }

    case 'api':
      return {
        type: 'multi-file',
        files: [
          {
            path: '/app/server.js',
            content: `const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: '🚀 SpawnAI API Test',
    status: 'running',
    timestamp: new Date().toISOString(),
    sandbox: 'e2b'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

app.post('/echo', (req, res) => {
  res.json({ echo: req.body, received: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(\`SpawnAI test API running on port \${port}\`);
});`
          }
        ],
        startCommand: 'cd /app && node server.js',
        dependencies: ['express']
      }

    case 'script':
      return {
        type: 'single-file',
        files: [{
          path: '/app/script.py',
          content: `#!/usr/bin/env python3
"""
SpawnAI Test Script
"""
import json
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

def generate_report():
    report = {
        "title": "SpawnAI Script Test Report",
        "status": "success",
        "timestamp": datetime.now().isoformat(),
        "sandbox_info": {
            "type": "e2b",
            "python_version": f"{os.sys.version}",
            "working_directory": os.getcwd()
        }
    }
    return report

if __name__ == "__main__":
    # Generate and save report
    report = generate_report()
    
    with open('/app/output.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    # Create a simple HTML page to display results
    html_content = f'''<!DOCTYPE html>
<html>
<head><title>SpawnAI Script Results</title></head>
<body>
    <h1>🚀 SpawnAI Script Results</h1>
    <pre>{json.dumps(report, indent=2)}</pre>
</body>
</html>'''
    
    with open('/app/index.html', 'w') as f:
        f.write(html_content)
    
    print("Script completed successfully!")
    print(f"Report saved to output.json")
`
        }],
        startCommand: 'cd /app && python3 script.py && python3 -m http.server 3000'
      }

    default:
      throw new Error(`Unsupported app type: ${appType}`)
  }
}