# Architecture Technique Détaillée - SpawnAI

## Vue d'ensemble Simplifiée

### Flow Utilisateur
```
1. User → Chat interface simple
2. API → Queue job (Redis)  
3. Orchestrator → Provision container
4. Container → Claude API → Generate code
5. Container → Expose HTTP port
6. User → Access generated app via URL
```

## 1. Comparaison Infrastructure

### Option A : Cloudflare Workers (Idéal mais limité)

#### Avantages
- **Éphémère par nature** : Parfait pour le concept SpawnAI
- **Cold start ultra-rapide** : <100ms
- **Scaling automatique** : 0 à 1000+ instances
- **Coût variable** : Pay-per-request

#### Limitations pour SpawnAI
- **Mémoire limitée** : 128MB max (insuffisant pour Claude + app complexe)
- **Durée d'exécution** : 30s max (trop court pour génération)
- **Pas de ports TCP** : Uniquement HTTP requests
- **Pas de persistance** : Impossible de maintenir état entre appels

#### Verdict : **Non viable** pour génération complète d'apps

### Option B : VPS + Docker (Recommandé)

#### Architecture
```
Load Balancer → API Gateway → Container Orchestrator → Pool de VPS → Docker Containers
```

#### Avantages
- **Flexibilité complète** : Ressources ajustables
- **Persistance temporaire** : Maintien état pendant session
- **Exposition ports** : HTTP/HTTPS direct
- **Intégration Claude** : Pas de limitations API

#### Stratégie Cold Start
1. **Pool de VPS warm** : 2-3 serveurs pré-démarrés
2. **Images Docker pré-configurées** : Claude CLI + runtime préinstallés
3. **Container start time** : <30s au lieu de 2-3 minutes

## 2. Interface Utilisateur Optimisée

### Architecture Frontend
```javascript
// Ultra-simple : Une seule page
interface SpawnUI {
  chat: ChatInterface,
  progress: ProgressBar,
  appLink: string | null,
  status: 'idle' | 'generating' | 'ready' | 'error'
}
```

### Communication Temps Réel

#### WebSockets vs Polling
```javascript
// Polling simple (recommandé pour MVP)
const pollStatus = () => {
  setInterval(async () => {
    const status = await fetch(`/api/status/${sessionId}`)
    updateProgress(status.progress)
    if (status.ready) showAppLink(status.url)
  }, 2000)
}

// WebSockets (v2)
const ws = new WebSocket('/ws/session/${sessionId}')
ws.onmessage = (event) => {
  const update = JSON.parse(event.data)
  updateProgress(update)
}
```

### États Interface
1. **Idle** : Chat input actif
2. **Queued** : "En attente..." (barre 10%)
3. **Provisioning** : "Création serveur..." (30%)
4. **Generating** : "Claude génère le code..." (60%)
5. **Deploying** : "Déploiement..." (90%)
6. **Ready** : Bouton vers l'app + countdown destruction

## 3. Orchestration Container Détaillée

### Architecture Orchestrateur
```yaml
Orchestrator Service:
  - Queue Manager (Redis/BullMQ)
  - Container Lifecycle Manager
  - Health Monitor
  - Resource Allocator
```

### Provisioning Flow
```bash
# 1. Receive job from queue
# 2. Find available VPS from pool
ssh user@vps-pool-1 "docker run -d --name spawn-${sessionId} \
  -p ${dynamicPort}:3000 \
  -e CLAUDE_API_KEY=${key} \
  -e SESSION_ID=${sessionId} \
  spawn-ai-runtime"

# 3. Wait for container ready
curl -f http://vps-pool-1:${dynamicPort}/health

# 4. Proxy setup (nginx/traefik)
# 5. Return URL to user
```

### Communication Inter-Services
```javascript
// Container → Orchestrator
const reportProgress = (progress) => {
  fetch(`${ORCHESTRATOR_URL}/sessions/${SESSION_ID}/progress`, {
    method: 'POST',
    body: JSON.stringify({ progress, logs })
  })
}

// Orchestrator → Frontend
app.get('/api/status/:sessionId', (req, res) => {
  const status = getContainerStatus(req.params.sessionId)
  res.json(status)
})
```

## 4. Container Runtime Optimisé

### Image Docker Pré-configurée
```dockerfile
FROM node:18-alpine

# Claude CLI pré-installé
RUN npm install -g @anthropic-ai/claude-cli

# Runtime pré-configuré
COPY ./runtime ./app
WORKDIR /app
RUN npm install

# Scripts optimisés
COPY ./scripts /scripts
RUN chmod +x /scripts/*

EXPOSE 3000
CMD ["/scripts/spawn-app.sh"]
```

### Script Génération
```bash
#!/bin/bash
# /scripts/spawn-app.sh

# 1. Signal starting
curl -X POST $ORCHESTRATOR_URL/sessions/$SESSION_ID/progress \
  -d '{"progress": 30, "status": "generating"}'

# 2. Call Claude API
claude-cli generate-app \
  --prompt="$USER_PROMPT" \
  --template=webapp \
  --output=/app/generated

# 3. Signal deploying  
curl -X POST $ORCHESTRATOR_URL/sessions/$SESSION_ID/progress \
  -d '{"progress": 90, "status": "deploying"}'

# 4. Start generated app
cd /app/generated && npm start &

# 5. Health check ready
curl -X POST $ORCHESTRATOR_URL/sessions/$SESSION_ID/progress \
  -d '{"progress": 100, "status": "ready"}'
```

## 5. Gestion Sécurité & Réseau

### Isolation Container
```yaml
# Docker security
docker run \
  --network=isolated \
  --memory=1g \
  --cpus=0.5 \
  --read-only \
  --tmpfs /tmp \
  --security-opt no-new-privileges
```

### Exposition Sécurisée
```nginx
# Nginx reverse proxy
server {
  listen 443 ssl;
  server_name ${sessionId}.spawn-ai.com;
  
  location / {
    proxy_pass http://vps-pool:${containerPort};
    proxy_timeout 30s;
  }
  
  # Auto-SSL avec Let's Encrypt
  ssl_certificate /etc/letsencrypt/live/${sessionId}.spawn-ai.com/fullchain.pem;
}
```

### Auto-Destruction
```javascript
// Cleanup job
const scheduleDestruction = (sessionId, ttl = 24 * 60 * 60) => {
  setTimeout(() => {
    // 1. Stop container
    exec(`docker stop spawn-${sessionId}`)
    
    // 2. Remove SSL cert
    exec(`certbot delete --cert-name ${sessionId}.spawn-ai.com`)
    
    // 3. Clean database
    db.sessions.delete(sessionId)
    
    // 4. Release VPS slot
    releaseVPSSlot(getVPSForSession(sessionId))
  }, ttl * 1000)
}
```

## 6. Stack Technique Final

### MVP Recommandé
```yaml
Frontend:
  - React + Vite (build rapide)
  - TailwindCSS (styling minimal)
  - Polling API (simplicité)

Backend:
  - Node.js + Fastify (performance)
  - Redis + BullMQ (queue jobs)
  - PostgreSQL (sessions metadata)

Infrastructure:  
  - Hetzner/DigitalOcean (VPS pool)
  - Docker + docker-compose
  - Nginx (reverse proxy)
  - Let's Encrypt (SSL auto)

Monitoring:
  - Prometheus + Grafana
  - Logs → Loki
  - Alerting → Discord webhook
```

### Coûts Estimés
```
3 VPS (4GB RAM) : $30/mois
Load balancer : $10/mois  
Monitoring : $20/mois
SSL/Domain : $10/mois
Claude API : Variable (~$100-500/mois)
Total fixe : ~$70/mois + variable
```

## 7. Optimisations Performance

### Cache Strategy
```javascript
// Cache réponses Claude fréquentes
const cacheKey = `claude:${hashPrompt(userPrompt)}`
const cachedResult = await redis.get(cacheKey)
if (cachedResult) {
  return JSON.parse(cachedResult)
}

// Cache 1h pour prompts similaires
await redis.setex(cacheKey, 3600, JSON.stringify(result))
```

### Pool Management
```javascript
// Maintain 2-3 warm VPS slots
const maintainWarmPool = () => {
  const availableSlots = getAvailableVPS()
  if (availableSlots.length < 2) {
    provisionNewVPS()
  }
}

// Health check toutes les 30s
setInterval(maintainWarmPool, 30000)
```

## 8. Timeline Implémentation

### Phase 1 (Semaines 1-4) : MVP Core
- Interface chat basique
- Orchestrateur simple (1 VPS)
- Container + Claude integration
- Nginx reverse proxy

### Phase 2 (Semaines 5-8) : Production Ready  
- Pool de VPS (3 serveurs)
- Monitoring + alerting
- SSL automation
- Optimisations performance

### Phase 3 (Semaines 9-12) : Scale
- Load balancing
- Multi-région
- Analytics + métriques business
- Optimisations coûts