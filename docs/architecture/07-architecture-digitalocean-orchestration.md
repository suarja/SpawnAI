# Architecture DigitalOcean + Orchestration Éphémère - SpawnAI

## Vue d'ensemble Architecture

### Principe Central
**"Simplicité maximale + Vitesse de production + Apps individuelles éphémères"**

```
User Chat → Orchestrator → DigitalOcean Droplet → Generated App → Auto-Destruction
    ↓           ↓              ↓                    ↓              ↓
  <3s         <10s           <60s                 2-72h          <5s
```

## 1. Infrastructure DigitalOcean Optimisée

### Specs DigitalOcean 2025 (Données MCP)

#### Droplets Recommandés pour SpawnAI
```yaml
Tier 1 - Apps Légères (JS/HTML/CSS):
  Size: s-1vcpu-1gb ($6/mois, $0.00893/h)
  RAM: 1GB, CPU: 1vCPU, Disk: 25GB
  Régions: 12 disponibles
  Coût session 2h: ~$0.018

Tier 2 - Apps Node.js/Python:
  Size: s-2vcpu-2gb ($18/mois, $0.02679/h)  
  RAM: 2GB, CPU: 2vCPU, Disk: 60GB
  Régions: 12 disponibles
  Coût session 2h: ~$0.054

Tier 3 - Apps Complexes:
  Size: s-2vcpu-4gb ($24/mois, $0.03571/h)
  RAM: 4GB, CPU: 2vCPU, Disk: 80GB  
  Régions: 12 disponibles
  Coût session 2h: ~$0.071
```

#### Régions Stratégiques
```yaml
Primaires (Latence optimisée):
  - nyc3: New York (US East)
  - sfo3: San Francisco (US West) 
  - ams3: Amsterdam (Europe)
  - sgp1: Singapore (Asia)

Secondaires (Coûts optimisés):
  - fra1: Frankfurt (Europe Central)
  - lon1: London (Europe West)
  - tor1: Toronto (America North)
```

### API DigitalOcean via MCP

#### Création Droplet Automatisée
```javascript
// Orchestrator Service
const createEphemeralDroplet = async (sessionId, appType) => {
  const dropletConfig = {
    name: `spawn-${sessionId}`,
    region: selectOptimalRegion(userLocation),
    size: getDropletSize(appType), // s-1vcpu-1gb | s-2vcpu-2gb
    image: 'spawn-ai-base', // Image pré-configurée
    tags: [`session:${sessionId}`, 'ephemeral', `ttl:${Date.now() + TTL}`],
    user_data: generateCloudInitScript(sessionId)
  }
  
  const droplet = await digitalocean.dropletCreate(dropletConfig)
  
  // Schedule auto-destruction
  scheduleDestruction(sessionId, droplet.id, TTL)
  
  return droplet
}

// Cloud-init script pour setup rapide
const generateCloudInitScript = (sessionId) => `
#!/bin/bash
# Install Docker si pas déjà fait
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Pull image SpawnAI runtime
docker pull spawn-ai/runtime:latest

# Start orchestrator container
docker run -d --name spawn-${sessionId} \
  -p 80:3000 \
  -e SESSION_ID=${sessionId} \
  -e CLAUDE_API_KEY=${process.env.CLAUDE_API_KEY} \
  -e ORCHESTRATOR_URL=${process.env.ORCHESTRATOR_URL} \
  --restart unless-stopped \
  spawn-ai/runtime:latest

# Health check endpoint
echo "Droplet ready for session ${sessionId}"
`
```

## 2. Orchestrateur Central (Cœur Technique)

### Architecture Orchestrateur
```yaml
Components:
  - Session Manager: Lifecycle des apps éphémères  
  - Resource Allocator: Sélection droplets optimaux
  - Queue Processor: Jobs async avec Redis/BullMQ
  - Health Monitor: Surveillance droplets + cleanup
  - Cost Tracker: Facturation temps réel
  - Security Manager: Isolation + firewalls
```

### State Machine Sessions
```javascript
// États des sessions éphémères
const SessionStates = {
  REQUESTED: 'requested',     // User a demandé création
  PROVISIONING: 'provisioning', // Droplet en création
  GENERATING: 'generating',   // Claude génère le code
  DEPLOYING: 'deploying',     // App en cours de déploiement
  RUNNING: 'running',         // App accessible
  DESTROYING: 'destroying',   // Nettoyage en cours
  DESTROYED: 'destroyed'      // Session terminée
}

// Transitions autorisées
const transitions = {
  [SessionStates.REQUESTED]: [SessionStates.PROVISIONING],
  [SessionStates.PROVISIONING]: [SessionStates.GENERATING, SessionStates.DESTROYING],
  [SessionStates.GENERATING]: [SessionStates.DEPLOYING, SessionStates.DESTROYING],
  [SessionStates.DEPLOYING]: [SessionStates.RUNNING, SessionStates.DESTROYING],
  [SessionStates.RUNNING]: [SessionStates.DESTROYING],
  [SessionStates.DESTROYING]: [SessionStates.DESTROYED]
}
```

### Queue System Avancé
```javascript
// BullMQ Jobs pour orchestration
const queues = {
  provision: new Queue('provision-droplet', { redis: redisConfig }),
  generate: new Queue('generate-app', { redis: redisConfig }),
  deploy: new Queue('deploy-app', { redis: redisConfig }),
  cleanup: new Queue('cleanup-session', { redis: redisConfig })
}

// Provision Worker
queues.provision.process(async (job) => {
  const { sessionId, userPrompt, appType } = job.data
  
  try {
    // 1. Créer droplet DigitalOcean
    const droplet = await createEphemeralDroplet(sessionId, appType)
    
    // 2. Attendre que droplet soit ready
    await waitForDropletReady(droplet.id, 120000) // 2min max
    
    // 3. Enqueue génération code
    await queues.generate.add('generate-code', {
      sessionId,
      dropletIP: droplet.networks.v4[0].ip_address,
      userPrompt,
      appType
    })
    
    // 4. Update session state
    await updateSessionState(sessionId, SessionStates.GENERATING)
    
  } catch (error) {
    // Cleanup on failure
    await queues.cleanup.add('failed-provision', { sessionId })
    throw error
  }
})

// Generate Worker  
queues.generate.process(async (job) => {
  const { sessionId, dropletIP, userPrompt, appType } = job.data
  
  // 1. Call Claude API pour génération
  const appCode = await generateAppWithClaude(userPrompt, appType)
  
  // 2. Deploy sur droplet via SSH/API
  await deployToDroplet(dropletIP, appCode, sessionId)
  
  // 3. Update session
  await updateSessionState(sessionId, SessionStates.RUNNING)
  
  // 4. Schedule auto-destruction
  await queues.cleanup.add('auto-cleanup', 
    { sessionId }, 
    { delay: getSessionTTL(appType) }
  )
})
```

### Health Monitoring
```javascript
// Monitoring système pour droplets éphémères
const healthChecker = {
  // Check toutes les 30s
  interval: 30000,
  
  async checkDropletHealth(dropletId, sessionId) {
    try {
      const droplet = await digitalocean.dropletGet(dropletId)
      const healthCheck = await axios.get(`http://${droplet.ip}/health`, {
        timeout: 5000
      })
      
      if (healthCheck.status !== 200) {
        await this.handleUnhealthyDroplet(dropletId, sessionId)
      }
      
      return true
    } catch (error) {
      console.error(`Droplet ${dropletId} health check failed:`, error)
      await this.handleUnhealthyDroplet(dropletId, sessionId) 
      return false
    }
  },
  
  async handleUnhealthyDroplet(dropletId, sessionId) {
    // Tenter redémarrage container
    await this.restartDropletContainer(dropletId, sessionId)
    
    // Si échec, destroy et notifier user
    setTimeout(async () => {
      if (!await this.checkDropletHealth(dropletId, sessionId)) {
        await queues.cleanup.add('health-failure', { sessionId, dropletId })
      }
    }, 60000) // 1min grace period
  }
}

// Auto-cleanup scheduler
const cleanupScheduler = {
  async scheduleDestruction(sessionId, dropletId, ttl) {
    await queues.cleanup.add('scheduled-cleanup', 
      { sessionId, dropletId }, 
      { 
        delay: ttl,
        removeOnComplete: true,
        removeOnFail: false
      }
    )
  },
  
  async immediateCleanup(sessionId) {
    await queues.cleanup.add('immediate-cleanup', { sessionId }, {
      priority: 1000 // High priority
    })
  }
}
```

## 3. Modélisation Base de Données

### Schema PostgreSQL
```sql
-- Sessions éphémères tracking
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255),
  prompt TEXT NOT NULL,
  app_type VARCHAR(50) NOT NULL, -- 'webapp', 'script', 'api'
  state VARCHAR(20) NOT NULL DEFAULT 'requested',
  
  -- Infrastructure
  droplet_id BIGINT,
  droplet_ip INET,
  region VARCHAR(10),
  size VARCHAR(20),
  
  -- URLs et accès
  app_url VARCHAR(255),
  admin_token VARCHAR(64),
  
  -- Timing
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  expires_at TIMESTAMP,
  destroyed_at TIMESTAMP,
  
  -- Coûts
  estimated_cost DECIMAL(10,4),
  actual_cost DECIMAL(10,4),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  INDEX idx_sessions_state (state),
  INDEX idx_sessions_expires (expires_at),
  INDEX idx_sessions_droplet (droplet_id)
);

-- Droplets pool management
CREATE TABLE droplets_pool (
  droplet_id BIGINT PRIMARY KEY,
  region VARCHAR(10) NOT NULL,
  size VARCHAR(20) NOT NULL,
  ip_address INET NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'available', 'in_use', 'draining'
  
  -- Session association
  current_session_id UUID REFERENCES sessions(id),
  
  -- Lifecycle
  created_at TIMESTAMP DEFAULT NOW(),
  last_health_check TIMESTAMP,
  scheduled_destruction TIMESTAMP,
  
  -- Costs tracking
  hourly_cost DECIMAL(8,5) NOT NULL,
  total_cost DECIMAL(10,4) DEFAULT 0,
  
  INDEX idx_droplets_status (status),
  INDEX idx_droplets_region (region),
  INDEX idx_droplets_destruction (scheduled_destruction)
);

-- Logs et debugging
CREATE TABLE session_logs (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  level VARCHAR(10) NOT NULL, -- 'info', 'warn', 'error'
  event VARCHAR(50) NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_logs_session (session_id),
  INDEX idx_logs_level (level),
  INDEX idx_logs_created (created_at)
);

-- Cost tracking pour facturation
CREATE TABLE cost_tracking (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  resource_type VARCHAR(20) NOT NULL, -- 'droplet', 'bandwidth', 'claude_api'
  resource_id VARCHAR(100),
  
  -- Coûts détaillés  
  unit_cost DECIMAL(10,6) NOT NULL,
  quantity DECIMAL(12,6) NOT NULL,
  total_cost DECIMAL(10,4) NOT NULL,
  
  -- Période
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_costs_session (session_id),
  INDEX idx_costs_resource (resource_type)
);
```

### Requêtes Optimisées
```javascript
// Sessions queries
const sessionQueries = {
  async createSession(userPrompt, appType, userId) {
    const ttl = getSessionTTL(appType) // 2h, 24h, 72h
    const estimatedCost = calculateEstimatedCost(appType, ttl)
    
    const session = await db.query(`
      INSERT INTO sessions (user_id, prompt, app_type, expires_at, estimated_cost)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [userId, userPrompt, appType, new Date(Date.now() + ttl), estimatedCost])
    
    return session.rows[0]
  },
  
  async getActiveSession(sessionId) {
    return await db.query(`
      SELECT s.*, d.ip_address, d.status as droplet_status
      FROM sessions s
      LEFT JOIN droplets_pool d ON s.droplet_id = d.droplet_id  
      WHERE s.id = $1 AND s.state NOT IN ('destroyed')
    `, [sessionId])
  },
  
  async getExpiringSessions(bufferMinutes = 5) {
    return await db.query(`
      SELECT * FROM sessions 
      WHERE expires_at <= NOW() + INTERVAL '${bufferMinutes} minutes'
      AND state = 'running'
    `)
  },
  
  async updateSessionState(sessionId, newState, metadata = {}) {
    await db.query(`
      UPDATE sessions 
      SET state = $2, metadata = metadata || $3::jsonb,
          ${newState === 'running' ? 'started_at = NOW(),' : ''}
          ${newState === 'destroyed' ? 'destroyed_at = NOW(),' : ''}
      WHERE id = $1
    `, [sessionId, newState, JSON.stringify(metadata)])
  }
}

// Cost tracking queries  
const costQueries = {
  async trackDropletUsage(sessionId, dropletId, hourlyRate) {
    await db.query(`
      INSERT INTO cost_tracking (session_id, resource_type, resource_id, unit_cost, quantity, total_cost, started_at)
      VALUES ($1, 'droplet', $2, $3, 1, $3, NOW())
    `, [sessionId, dropletId.toString(), hourlyRate])
  },
  
  async finalizeSessionCosts(sessionId) {
    // Calculate actual costs based on usage
    const costs = await db.query(`
      UPDATE cost_tracking 
      SET ended_at = NOW(),
          quantity = EXTRACT(EPOCH FROM (NOW() - started_at)) / 3600,
          total_cost = unit_cost * (EXTRACT(EPOCH FROM (NOW() - started_at)) / 3600)
      WHERE session_id = $1 AND ended_at IS NULL
      RETURNING total_cost
    `, [sessionId])
    
    const totalCost = costs.rows.reduce((sum, row) => sum + parseFloat(row.total_cost), 0)
    
    // Update session with actual cost
    await db.query(`
      UPDATE sessions SET actual_cost = $2 WHERE id = $1
    `, [sessionId, totalCost])
    
    return totalCost
  }
}
```

## 4. Intégrations Front/Back Optimisées

### Frontend Real-time Updates
```javascript
// WebSocket client pour updates temps réel
class SpawnAIClient {
  constructor(sessionId) {
    this.sessionId = sessionId
    this.ws = new WebSocket(`wss://api.spawn-ai.com/sessions/${sessionId}`)
    this.setupEventHandlers()
  }
  
  setupEventHandlers() {
    this.ws.onmessage = (event) => {
      const update = JSON.parse(event.data)
      this.handleStateUpdate(update)
    }
  }
  
  handleStateUpdate(update) {
    const { state, progress, message, metadata } = update
    
    switch (state) {
      case 'provisioning':
        this.showProgress('Creating server...', 20)
        this.showEstimatedCost(metadata.estimatedCost)
        break
        
      case 'generating':
        this.showProgress('AI generating your app...', 50) 
        this.showLogs(metadata.claudeLogs)
        break
        
      case 'deploying':
        this.showProgress('Deploying app...', 80)
        break
        
      case 'running':
        this.showSuccess(`App ready! ${metadata.appUrl}`)
        this.showProgress('Complete', 100)
        this.startDestructionCountdown(metadata.expiresAt)
        break
        
      case 'destroying':
        this.showInfo('Cleaning up resources...')
        break
        
      case 'destroyed':
        this.showComplete('Session ended')
        this.showFinalCost(metadata.actualCost)
        break
    }
  }
  
  startDestructionCountdown(expiresAt) {
    const countdown = setInterval(() => {
      const remaining = new Date(expiresAt) - new Date()
      if (remaining <= 0) {
        clearInterval(countdown)
        this.showInfo('Session expired')
      } else {
        this.updateCountdown(remaining)
      }
    }, 1000)
  }
}

// Usage
const client = new SpawnAIClient(sessionId)
```

### Backend API Optimisé
```javascript
// Express API avec validation et rate limiting
const app = express()

// Rate limiting par IP/user
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15min
  max: 5, // 5 sessions max par 15min
  message: 'Too many sessions created, try again later'
})

// Create session endpoint
app.post('/api/sessions', rateLimiter, async (req, res) => {
  try {
    const { prompt, appType, userId } = req.body
    
    // Validation
    if (!prompt || prompt.length > 2000) {
      return res.status(400).json({ error: 'Invalid prompt' })
    }
    
    if (!['webapp', 'script', 'api'].includes(appType)) {
      return res.status(400).json({ error: 'Invalid app type' })
    }
    
    // Check user limits
    const activeCount = await getUserActiveSessions(userId)
    if (activeCount >= 3) {
      return res.status(429).json({ error: 'Too many active sessions' })
    }
    
    // Create session
    const session = await sessionQueries.createSession(prompt, appType, userId)
    
    // Start provisioning
    await queues.provision.add('create-droplet', {
      sessionId: session.id,
      userPrompt: prompt,
      appType
    })
    
    res.json({ 
      sessionId: session.id,
      estimatedCost: session.estimated_cost,
      estimatedTime: getEstimatedTime(appType)
    })
    
  } catch (error) {
    console.error('Session creation error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
})

// Session status endpoint
app.get('/api/sessions/:id', async (req, res) => {
  try {
    const session = await sessionQueries.getActiveSession(req.params.id)
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }
    
    res.json({
      id: session.id,
      state: session.state,
      appUrl: session.app_url,
      expiresAt: session.expires_at,
      estimatedCost: session.estimated_cost,
      actualCost: session.actual_cost
    })
    
  } catch (error) {
    res.status(500).json({ error: 'Error fetching session' })
  }
})
```

## 5. Estimation Coûts Apps Simples

### Modèle de Coût Détaillé

#### Apps JS/HTML/CSS Simples
```yaml
Configuration:
  Droplet: s-1vcpu-1gb ($0.00893/h)
  Durée moyenne: 2h
  Claude API: ~$0.02 par génération
  
Coût par session:
  Infrastructure: $0.018 (2h × $0.00893)
  Claude API: $0.020
  Overhead (5%): $0.002
  Total: $0.040
  
Prix utilisateur: $0.15 (marge 275%)
```

#### Apps Node.js/Express
```yaml
Configuration:
  Droplet: s-2vcpu-2gb ($0.02679/h)  
  Durée moyenne: 4h
  Claude API: ~$0.05 par génération
  
Coût par session:
  Infrastructure: $0.107 (4h × $0.02679)
  Claude API: $0.050
  Overhead (5%): $0.008
  Total: $0.165
  
Prix utilisateur: $0.50 (marge 200%)
```

#### Apps Full-Stack Complexes
```yaml
Configuration:
  Droplet: s-2vcpu-4gb ($0.03571/h)
  Durée moyenne: 24h  
  Claude API: ~$0.10 par génération
  
Coût par session:
  Infrastructure: $0.857 (24h × $0.03571)
  Claude API: $0.100
  Overhead (10%): $0.096
  Total: $1.053
  
Prix utilisateur: $2.50 (marge 137%)
```

### Optimisations Coûts
```javascript
// Dynamic pricing basé sur usage réel
const calculateDynamicPricing = (sessionData) => {
  const {
    actualDuration,
    dropletSize, 
    cpuUsage,
    memoryUsage,
    claudeTokens
  } = sessionData
  
  // Base cost
  const infraCost = getDropletHourlyRate(dropletSize) * (actualDuration / 3600)
  const aiCost = (claudeTokens / 1000) * 0.003 // $0.003 per 1K tokens
  
  // Usage modifiers
  const cpuModifier = cpuUsage > 80 ? 1.2 : cpuUsage < 30 ? 0.8 : 1.0
  const memoryModifier = memoryUsage > 80 ? 1.2 : memoryUsage < 30 ? 0.8 : 1.0
  
  const adjustedCost = (infraCost + aiCost) * cpuModifier * memoryModifier
  
  return {
    baseCost: infraCost + aiCost,
    adjustedCost,
    userPrice: adjustedCost * getPricingMultiplier(dropletSize)
  }
}
```

## 6. Code Examples Concrets

### DigitalOcean API Integration
```javascript
// Service pour gestion droplets éphémères
class DigitalOceanEphemeralService {
  constructor(token) {
    this.token = token
    this.baseURL = 'https://api.digitalocean.com/v2'
  }
  
  async createEphemeralDroplet(sessionId, config) {
    const dropletSpec = {
      name: `spawn-${sessionId}`,
      region: config.region,
      size: config.size,
      image: config.image || 'spawn-ai-base-2025',
      tags: [
        `session:${sessionId}`,
        'ephemeral',
        `ttl:${config.expiresAt}`,
        'spawn-ai'
      ],
      monitoring: true,
      user_data: this.generateUserData(sessionId, config)
    }
    
    try {
      const response = await fetch(`${this.baseURL}/droplets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dropletSpec)
      })
      
      if (!response.ok) {
        throw new Error(`DO API Error: ${response.statusText}`)
      }
      
      const { droplet } = await response.json()
      
      // Store in database
      await this.trackDroplet(droplet, sessionId)
      
      return droplet
      
    } catch (error) {
      console.error('Droplet creation failed:', error)
      throw error
    }
  }
  
  generateUserData(sessionId, config) {
    return `#!/bin/bash
# SpawnAI Droplet Setup
export SESSION_ID="${sessionId}"
export ORCHESTRATOR_URL="${config.orchestratorURL}"
export CLAUDE_API_KEY="${config.claudeAPIKey}"

# Install dependencies
apt-get update
apt-get install -y docker.io curl jq

# Download SpawnAI runtime
docker pull spawn-ai/runtime:latest

# Start container
docker run -d --name spawn-runtime \\
  --restart=unless-stopped \\
  -p 80:3000 \\
  -e SESSION_ID=$SESSION_ID \\
  -e ORCHESTRATOR_URL=$ORCHESTRATOR_URL \\
  -e CLAUDE_API_KEY=$CLAUDE_API_KEY \\
  spawn-ai/runtime:latest

# Setup health checks
echo "*/1 * * * * curl -f http://localhost/health || docker restart spawn-runtime" | crontab -

# Auto-destruction script
cat > /usr/local/bin/auto-destruct.sh << 'EOF'
#!/bin/bash
EXPIRES_AT="${config.expiresAt}"
while true; do
  if [ $(date +%s) -gt $EXPIRES_AT ]; then
    curl -X POST $ORCHESTRATOR_URL/sessions/$SESSION_ID/destroyed
    sudo poweroff
    break
  fi
  sleep 300 # Check every 5min
done
EOF

chmod +x /usr/local/bin/auto-destruct.sh
nohup /usr/local/bin/auto-destruct.sh &

# Signal ready
sleep 30
curl -X POST $ORCHESTRATOR_URL/sessions/$SESSION_ID/ready
`
  }
  
  async destroyEphemeralDroplet(dropletId, sessionId) {
    try {
      // Graceful shutdown d'abord
      await this.gracefulShutdown(dropletId)
      
      // Attendre 30s pour cleanup
      await new Promise(resolve => setTimeout(resolve, 30000))
      
      // Destroy droplet
      await fetch(`${this.baseURL}/droplets/${dropletId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.token}` }
      })
      
      // Update database
      await this.markDropletDestroyed(dropletId, sessionId)
      
    } catch (error) {
      console.error(`Failed to destroy droplet ${dropletId}:`, error)
      throw error
    }
  }
}
```

### Container Orchestration
```javascript
// Runtime container pour apps générées
class SpawnAIRuntime {
  constructor(sessionId, orchestratorURL) {
    this.sessionId = sessionId
    this.orchestratorURL = orchestratorURL
    this.appProcess = null
    this.healthInterval = null
  }
  
  async generateAndDeploy(userPrompt, appType) {
    try {
      // 1. Generate code avec Claude
      await this.reportProgress('generating', 30)
      const appCode = await this.callClaudeAPI(userPrompt, appType)
      
      // 2. Validate et prepare code
      await this.reportProgress('validating', 60)
      const validatedCode = await this.validateAndSanitize(appCode)
      
      // 3. Write files
      await this.writeAppFiles(validatedCode, appType)
      
      // 4. Install dependencies si nécessaire
      if (appType === 'webapp' && validatedCode.packageJson) {
        await this.installDependencies()
      }
      
      // 5. Start app
      await this.reportProgress('deploying', 90)
      await this.startApp(appType)
      
      // 6. Setup health monitoring
      this.startHealthMonitoring()
      
      await this.reportProgress('running', 100)
      
    } catch (error) {
      await this.reportError(error.message)
      throw error
    }
  }
  
  async callClaudeAPI(prompt, appType) {
    const systemPrompt = this.getSystemPrompt(appType)
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.CLAUDE_API_KEY,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    
    const data = await response.json()
    return this.parseClaudeResponse(data.content[0].text)
  }
  
  getSystemPrompt(appType) {
    const prompts = {
      script: `Generate a simple, functional script based on the user's request. 
        Focus on utility over aesthetics. Include error handling.
        Return only code, no explanations.`,
        
      webapp: `Generate a simple, functional web application.
        Use only HTML, CSS, and vanilla JavaScript.
        Make it work, don't worry about beauty.
        Include basic error handling.
        Structure as: { html: "...", css: "...", js: "..." }`,
        
      api: `Generate a simple API using Node.js and Express.
        Focus on functionality over documentation.
        Include basic error handling and validation.
        Structure as: { server: "...", package: "..." }`
    }
    
    return prompts[appType] || prompts.script
  }
  
  async startApp(appType) {
    switch (appType) {
      case 'webapp':
        // Serve static files
        this.appProcess = spawn('python3', ['-m', 'http.server', '3000'], {
          cwd: '/app/generated'
        })
        break
        
      case 'api':
        // Start Node.js server
        this.appProcess = spawn('node', ['server.js'], {
          cwd: '/app/generated'
        })
        break
        
      case 'script':
        // Run script once, then serve results
        const result = await this.runScript()
        await this.serveResults(result)
        break
    }
    
    // Wait for app to be ready
    await this.waitForAppReady()
  }
  
  async waitForAppReady(timeout = 60000) {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      try {
        const response = await fetch('http://localhost:3000')
        if (response.ok) return true
      } catch (e) {
        // Continue waiting
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    throw new Error('App failed to start within timeout')
  }
  
  startHealthMonitoring() {
    this.healthInterval = setInterval(async () => {
      try {
        const health = await this.checkAppHealth()
        await this.reportHealth(health)
      } catch (error) {
        await this.reportError(`Health check failed: ${error.message}`)
      }
    }, 30000) // Every 30s
  }
  
  async reportProgress(state, progress) {
    await fetch(`${this.orchestratorURL}/sessions/${this.sessionId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, progress })
    })
  }
}
```

## 7. Monitoring et Alerting

### Système de Monitoring
```javascript
// Monitoring service pour sessions éphémères
class EphemeralMonitoring {
  constructor() {
    this.metrics = new Map()
    this.alerts = []
  }
  
  startMonitoring() {
    // Check expired sessions every minute
    setInterval(() => this.cleanupExpiredSessions(), 60000)
    
    // Check droplet health every 2 minutes  
    setInterval(() => this.checkDropletsHealth(), 120000)
    
    // Cost monitoring every 15 minutes
    setInterval(() => this.monitorCosts(), 900000)
    
    // System health every 5 minutes
    setInterval(() => this.systemHealthCheck(), 300000)
  }
  
  async cleanupExpiredSessions() {
    const expiredSessions = await sessionQueries.getExpiringSessions(5)
    
    for (const session of expiredSessions) {
      try {
        await queues.cleanup.add('expired-session', {
          sessionId: session.id,
          dropletId: session.droplet_id
        }, { priority: 100 })
        
        console.log(`Scheduled cleanup for expired session ${session.id}`)
      } catch (error) {
        console.error(`Failed to schedule cleanup for session ${session.id}:`, error)
      }
    }
  }
  
  async monitorCosts() {
    const activeSessions = await db.query(`
      SELECT s.id, s.created_at, d.hourly_cost,
             EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 3600 as runtime_hours
      FROM sessions s
      JOIN droplets_pool d ON s.droplet_id = d.droplet_id
      WHERE s.state = 'running'
    `)
    
    for (const session of activeSessions.rows) {
      const currentCost = session.runtime_hours * session.hourly_cost
      
      // Alert si coût dépasse estimation de 150%
      if (currentCost > session.estimated_cost * 1.5) {
        await this.sendCostAlert(session.id, currentCost, session.estimated_cost)
      }
    }
  }
  
  async sendAlert(type, message, metadata = {}) {
    const alert = {
      type,
      message,
      metadata,
      timestamp: new Date(),
      id: crypto.randomUUID()
    }
    
    this.alerts.push(alert)
    
    // Send to monitoring system (Discord, Slack, etc)
    await this.sendToDiscord(alert)
    
    // Store in database for analysis
    await db.query(`
      INSERT INTO system_alerts (type, message, metadata)
      VALUES ($1, $2, $3)
    `, [type, message, JSON.stringify(metadata)])
  }
}
```

## Conclusion Architecture

### Avantages DigitalOcean pour SpawnAI
- **Coûts predictibles** : $0.006-0.036/heure selon droplet size
- **API complète** : Création/destruction automatisée
- **14 régions mondiales** : Latence optimisée globalement  
- **Monitoring intégré** : Health checks natifs
- **Simplicité** : Moins de complexité que AWS/GCP

### KPIs Cibles
- **Time to App** : <90 secondes (provision + generate + deploy)
- **Success Rate** : >95% des sessions aboutissent
- **Cost per Session** : $0.04-1.20 selon complexité
- **User Satisfaction** : >80% apps fonctionnent comme attendu

### Scaling Strategy
1. **MVP** : 1 région (NYC3), queue simple
2. **Scale** : 4 régions, load balancing intelligent  
3. **Global** : 10+ régions, edge optimization

## 8. Exposition HTTPS Sécurisée

### Défis Techniques SSL/HTTPS pour Apps Éphémères

L'exposition sécurisée d'applications éphémères présente des défis uniques :
- **Certificats temporaires** : Durée de vie 2-72h vs certificats 90 jours
- **DNS dynamique** : Sous-domaines `${sessionId}.spawn-ai.com` 
- **Provisioning rapide** : SSL ready en <30 secondes
- **Cleanup automatique** : Révocation à la destruction

### Solutions Analysées (Recherche 2025)

#### Option A : DigitalOcean Load Balancer (Recommandé MVP)

**Avantages Validés**
```yaml
Prix: $12/mois fixe pour load balancer
SSL: Let's Encrypt intégré gratuit + renouvellement auto
Performance: SSL termination décharge CPU droplets  
Simplicité: Configuration via API DO
Support: HTTP/2 natif, health checks SSL
```

**Architecture**
```javascript
// Configuration automatique Load Balancer DO
const createLoadBalancerWithSSL = async (sessionId, dropletIP) => {
  const lbConfig = {
    name: `lb-spawn-${sessionId}`,
    algorithm: 'round_robin',
    status: 'active',
    forwarding_rules: [{
      entry_protocol: 'https',
      entry_port: 443,
      target_protocol: 'http', 
      target_port: 3000,
      certificate_id: '', // Auto-generated Let's Encrypt
      tls_passthrough: false
    }, {
      entry_protocol: 'http',
      entry_port: 80,
      target_protocol: 'https',
      target_port: 443,
      redirect_http_to_https: true
    }],
    droplet_ids: [dropletIP],
    region: 'nyc3',
    // Let's Encrypt automatique
    enable_backend_keepalive: true
  }
  
  // Créer Load Balancer
  const lb = await digitalocean.loadBalancerCreate(lbConfig)
  
  // Ajouter certificat Let's Encrypt automatique
  await digitalocean.certificateCreateLetsEncrypt({
    name: `cert-${sessionId}`, 
    dns_names: [`${sessionId}.spawn-ai.com`],
    type: 'lets_encrypt'
  })
  
  // Associer au Load Balancer
  await digitalocean.loadBalancerUpdate(lb.id, {
    forwarding_rules: [{
      ...lbConfig.forwarding_rules[0],
      certificate_id: `cert-${sessionId}`
    }]
  })
  
  return `https://${sessionId}.spawn-ai.com`
}
```

**Coûts**
```yaml
Load Balancer: $12/mois = $0.016/heure
Sessions simultanées: ~30 max avant saturation
Coût par session: $0.016 × 2h = $0.032
Let's Encrypt: Gratuit
Total SSL: $0.032 par session 2h
```

#### Option B : Wildcard avec acme.sh (Scale économique)

**Avantages Validés** 
```yaml
Coût: $0 infrastructure SSL
Flexibilité: Wildcards *.spawn-ai.com
Outils matures: nginx-proxy/acme-companion
DNS-01: Support DigitalOcean DNS API
```

**Implémentation**
```bash
# Docker Compose avec nginx-proxy + acme-companion
version: '3.8'
services:
  nginx-proxy:
    image: nginxproxy/nginx-proxy:alpine
    ports:
      - "80:80"
      - "443:443" 
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro
      - certs:/etc/nginx/certs:ro
      - vhost:/etc/nginx/vhost.d
      - html:/usr/share/nginx/html
    
  acme-companion:
    image: nginxproxy/acme-companion
    volumes:
      - certs:/etc/nginx/certs:rw
      - vhost:/etc/nginx/vhost.d
      - html:/usr/share/nginx/html
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - NGINX_PROXY_CONTAINER=nginx-proxy
      - ACME_CHALLENGE=DNS-01
      - ACMESH_DNS_API_CONFIG={"DNS_API":"dns_dgon","DO_API_KEY":"xxx"}

  # Session droplet proxy
  session-proxy:
    image: nginx:alpine
    environment:
      - VIRTUAL_HOST=${sessionId}.spawn-ai.com
      - LETSENCRYPT_HOST=${sessionId}.spawn-ai.com
    volumes:
      - ./nginx-session.conf:/etc/nginx/nginx.conf
```

**Script acme.sh Automation**
```javascript
// Générateur certificat wildcard
const generateWildcardSSL = async () => {
  const acmeConfig = {
    domain: '*.spawn-ai.com',
    dns_provider: 'dns_dgon', // DigitalOcean
    api_key: process.env.DO_API_KEY,
    challenge: 'dns-01'
  }
  
  // Générer certificat wildcard
  const certResult = await execCommand(`
    acme.sh --issue --dns ${acmeConfig.dns_provider} \
    -d ${acmeConfig.domain} \
    --key-file /certs/wildcard.key \
    --cert-file /certs/wildcard.crt \
    --ca-file /certs/ca.crt
  `)
  
  // Auto-renewal setup
  await execCommand(`
    echo "0 0 * * * acme.sh --cron --home /acme.sh" | crontab -
  `)
  
  return {
    certificate: '/certs/wildcard.crt',
    privateKey: '/certs/wildcard.key',
    validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  }
}
```

#### Option C : NGINX Native ACME (2025 Innovation)

**Nouveau Module nginx**
```nginx
# Configuration NGINX avec ACME natif
server {
    listen 443 ssl http2;
    server_name ${sessionId}.spawn-ai.com;
    
    # ACME automatique (2025)
    acme_certificate ${sessionId}.spawn-ai.com;
    acme_challenge_dir /var/www/acme-challenge;
    
    ssl_certificate auto;
    ssl_certificate_key auto;
    
    location / {
        proxy_pass http://droplet-${sessionId}:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Comparaison Solutions SSL

| Critère | DO Load Balancer | Wildcard acme.sh | NGINX Native |
|---------|------------------|-------------------|--------------|
| **Coût Setup** | $12/mois | $0 | $0 |
| **Coût/Session** | $0.032 | $0.001 | $0.001 |
| **Complexité** | Faible | Moyenne | Faible |
| **Time to SSL** | 60s | 120s | 45s |  
| **Wildcards** | ❌ | ✅ | ✅ |
| **Auto-renewal** | ✅ | ✅ | ✅ |
| **Maturité** | Stable | Mature | Beta |

### Architecture Réseau Sécurisée

#### DNS Dynamique
```javascript
// Service DNS pour sous-domaines éphémères
class DNSManager {
  async createSessionDNS(sessionId, dropletIP) {
    // Option A: Load Balancer IP
    if (useLoadBalancer) {
      const lbIP = await this.getLoadBalancerIP()
      return await this.createDNSRecord(`${sessionId}.spawn-ai.com`, lbIP)
    }
    
    // Option B: Direct droplet IP  
    return await this.createDNSRecord(`${sessionId}.spawn-ai.com`, dropletIP)
  }
  
  async createDNSRecord(subdomain, ip) {
    await digitalocean.domainRecordCreate('spawn-ai.com', {
      type: 'A',
      name: subdomain.replace('.spawn-ai.com', ''),
      data: ip,
      ttl: 300 // 5min pour changements rapides
    })
    
    // Schedule cleanup
    this.scheduleRecordCleanup(subdomain, Date.now() + SESSION_TTL)
  }
  
  async cleanupDNSRecord(subdomain) {
    const records = await digitalocean.domainRecordList('spawn-ai.com')
    const recordToDelete = records.find(r => 
      r.name === subdomain.replace('.spawn-ai.com', '')
    )
    
    if (recordToDelete) {
      await digitalocean.domainRecordDelete('spawn-ai.com', recordToDelete.id)
    }
  }
}
```

#### Firewall Rules Sécurisées
```javascript
// Configuration firewall pour droplets éphémères
const createSecureFirewall = async (sessionId) => {
  const firewallRules = {
    name: `fw-spawn-${sessionId}`,
    inbound_rules: [
      {
        protocol: 'tcp',
        ports: '22',
        sources: { addresses: ['10.0.0.0/8'] } // SSH interne seulement
      },
      {
        protocol: 'tcp', 
        ports: '80',
        sources: { addresses: ['0.0.0.0/0'] } // HTTP public
      },
      {
        protocol: 'tcp',
        ports: '443', 
        sources: { addresses: ['0.0.0.0/0'] } // HTTPS public
      }
    ],
    outbound_rules: [
      {
        protocol: 'tcp',
        ports: '443',
        destinations: { addresses: ['0.0.0.0/0'] } // HTTPS sortant
      },
      {
        protocol: 'tcp',
        ports: '53',
        destinations: { addresses: ['0.0.0.0/0'] } // DNS
      }
    ]
  }
  
  const firewall = await digitalocean.firewallCreate(firewallRules)
  
  // Auto-cleanup
  setTimeout(async () => {
    await digitalocean.firewallDelete(firewall.id)
  }, SESSION_TTL)
  
  return firewall
}
```

### Monitoring SSL/HTTPS

```javascript
// Health checks SSL pour sessions éphémères
class SSLMonitoring {
  async checkCertificateHealth(sessionURL) {
    try {
      const cert = await this.getCertificateInfo(sessionURL)
      
      const checks = {
        isValid: cert.valid,
        expiresIn: cert.validTo - Date.now(),
        issuer: cert.issuer,
        subject: cert.subject
      }
      
      // Alert si expire dans <7 jours (sessions longues)
      if (checks.expiresIn < 7 * 24 * 60 * 60 * 1000) {
        await this.sendCertificateAlert(sessionURL, checks)
      }
      
      return checks
    } catch (error) {
      await this.reportSSLError(sessionURL, error)
      return { isValid: false, error: error.message }
    }
  }
  
  async getCertificateInfo(url) {
    const response = await fetch(url, { 
      method: 'HEAD',
      // Force SSL validation
      agent: new https.Agent({ rejectUnauthorized: true })
    })
    
    return response.socket.getPeerCertificate()
  }
}
```

### Recommandation Finale SSL

#### MVP (0-1000 sessions/mois)
```yaml
Solution: DigitalOcean Load Balancer
Coût: $12/mois fixe + $0 certificats
Avantages: Simplicité maximale, SSL natif, support DO
Inconvénients: Coût fixe même avec peu de traffic
```

#### Scale (1000+ sessions/mois) 
```yaml
Solution: Wildcard acme.sh + nginx-proxy
Coût: $0 infrastructure SSL + complexité dev
Avantages: Économies importantes, flexibilité wildcard
Migration: Automatisée depuis Load Balancer
```

L'architecture DigitalOcean offre le meilleur équilibre **simplicité/performance/coût** pour réaliser la vision SpawnAI d'apps éphémères individuelles.
