# Recherche Marché & Specs Techniques 2025

## État du Marché Septembre 2025

### Tendances Générales
- **Pay-per-use généralisé** : Tous les acteurs adoptent le modèle "ne payez que ce que vous utilisez"
- **Edge computing dominant** : V8 isolates et containers éphémères deviennent la norme
- **GPU à la demande** : Accès instantané aux H100/A100 pour charges ML/AI
- **Serverless containers** : Fusion entre containers et fonctions serverless

### Nouveaux Entrants 2025
- **Cloudflare Containers** : Beta juin 2025, containers serverless avec sidecars programmables
- **Modal Scale-Up** : Scaling à "centaines de GPU en secondes" avec système container Rust
- **Railway Evolution** : Passage à un modèle utilisation-based plus granulaire

## Analyse Technique des Providers

### 1. Serverless "Classique" (Pour comparaison)

#### AWS Lambda
```yaml
Specs 2025:
  Memory: 128MB - 10GB
  Runtime: 15 minutes max
  Storage: 512MB gratuit + jusqu'à 10GB (/tmp)
  Cold start: ~100-500ms
  
Pricing:
  Compute: $0.0000166667 par GB-s
  Requests: $0.20 par million
  Storage: $0.0000000309 par GB-s
  Free tier: 400,000 GB-s + 1M requêtes/mois
```

#### Google Cloud Run
```yaml
Specs 2025:
  Memory: 128MB - 8GB  
  Runtime: 15 minutes max
  Concurrency: 1-80 requêtes/container
  Cold start: ~200ms
  
Pricing:
  CPU: $0.00002400 par vCPU-s
  Memory: $0.00000250 par GB-s
  Requests: $0.40 par million
  Free tier: 180,000 vCPU-s + 360,000 GB-s/mois
```

### 2. Edge Computing Platforms

#### Cloudflare Workers
```yaml
Specs 2025:
  Memory: 128MB (limit strict)
  CPU Time: Jusqu'à 5 minutes (nouveau!)
  Cold start: <5ms (V8 isolates)
  Régions: 275+ locations worldwide
  
Pricing:
  $5/mois : 10M requêtes
  $0.50 par million requêtes additionnelles
  CPU time: $0.02 par 100,000 GB-s
  
Nouveauté 2025:
  Cloudflare Containers (beta juin):
    - Multi-requests par container
    - Sidecars programmables avec Durable Objects
    - 4GB RAM, half vCPU par container
```

#### Deno Deploy
```yaml
Specs 2025:
  Memory: 512MB max
  Runtime: Basé sur CPU time réel (pas wall-clock)
  Cold start: <50ms (V8 isolates)
  Deployment: <1GB source code total
  
Pricing:
  Gratuit: 100,000 requêtes/mois
  Pro $20/mois: 5M requêtes + $0.50/M additional
  
Limitations:
  CPU time counting: Uniquement temps CPU actif
  (10ms code + 500ms I/O + 10ms = 20ms facturé)
```

### 3. Container-as-a-Service Modernes

#### Fly.io
```yaml
Specs 2025:
  Technology: Firecracker MicroVMs
  Scaling: Instant launch, pay-per-second
  Régions: 35 régions mondiales
  Storage: Ephémère + volumes persistants
  
Pricing:
  CPU: Usage-based par seconde
  Memory: Usage-based par heure  
  Bandwidth: Par région
  Storage: Par heure d'utilisation
  
Architecture:
  - Hardware-virtualized containers
  - Docker workflow avec VMs
  - Multi-région automatique
  
Limitations:
  - Pas de Redis/MongoDB managé
  - Coûts multi-région imprévisibles
  - Complexité networking inter-régions
```

#### Railway
```yaml
Specs 2025:
  Technology: Containers Docker/Nixpacks
  Billing: Pay-per-minute utilisation réelle
  Scaling: Auto-scale basé sur demande
  
Pricing:
  Hobby: $5/mois (inclut $5 usage)
  Pro: Usage-based pur
  CPU/Memory: Facturation % utilisation
  
Features:
  - Service discovery automatique
  - Support tout protocole
  - Build auto Nixpacks
  
Limitations:
  - Pas de BYOC (own cloud account)
  - Crédit $5 consommé rapidement
  - Build process parfois limité
```

### 4. AI/ML Spécialisées

#### Modal
```yaml
Specs 2025:
  GPU: A100, H100, B200 en secondes
  Scaling: Centaines de GPUs instantanément
  Technology: Container system Rust custom
  Parallelism: Milliers de containers simultanés
  
Pricing:
  Free: $30 compute/mois
  GPU B200: $6.25/heure (burst workloads)
  CPU: Pay-per-cycle réel
  
Features:
  - Fan-out parallélisme massif
  - Drivers GPU pré-installés
  - Scale 0→100+ en <10s
  
Limitations:
  - Contrôle GPU limité (fully managed)
  - Plateforme récente (2023), écosystème en dev
```

#### Replicate
```yaml
Specs 2025:
  GPU: T4 ($0.000225/s), A40 ($0.005800/s)
  CPU: $0.000100/s
  Models: Public (shared) vs Private (dédié)
  
Pricing:
  Public: Share queue, cold starts possibles
  Private: Dédié, paiement setup + idle + active
  
Features:
  - Cog: Containers ML standardisés
  - Scale automatique sur demande
  - Pay-only-when-running
  
Limitations:
  - Public models: queue partagée
  - Private: paiement même idle time
  - Focus ML uniquement
```

## Comparatif pour SpawnAI Use Case

### Critères SpawnAI
1. **Génération app complète** (pas juste fonctions)
2. **Durée de vie 2-72h** 
3. **Exposition HTTP directe**
4. **Intégration Claude API**
5. **Coût <$1 par session**

### Analyse par Provider

| Provider | Viabilité | Coût/session | Limitations SpawnAI |
|----------|-----------|--------------|-------------------|
| **AWS Lambda** | ❌ | $0.20-0.50 | 15min max, pas d'exposition directe |
| **Cloud Run** | ⚠️ | $0.30-0.80 | 15min max, mais concurrency OK |
| **Cloudflare Workers** | ❌ | $0.05-0.15 | 128MB RAM insuffisant pour app complète |
| **Deno Deploy** | ❌ | $0.10-0.25 | 512MB limit, pas container docker |
| **Fly.io** | ✅ | $0.50-1.50 | Parfait mais complexité networking |
| **Railway** | ✅ | $0.30-1.00 | Simple, idéal pour MVP |
| **Modal** | ⚠️ | $1.00-3.00 | Overkill pour web apps simples |
| **Replicate** | ❌ | $0.50-2.00 | Focalisé ML, pas web apps |

### Recommandations Techniques 2025

#### Option 1 : Railway (MVP Recommandé)
```yaml
Avantages:
  - Setup ultra-simple
  - Docker support natif
  - Billing transparent
  - Perfect pour prototyping

Architecture SpawnAI:
  Frontend → Railway API → Railway Container (Claude + Generated App)
  
Coût estimé:
  - $0.30-0.80 par session 2h
  - Predictible, pas de surprises
```

#### Option 2 : Fly.io (Production Scale)
```yaml
Avantages:
  - Scaling global instantané
  - MicroVMs security
  - Pay-per-second précis
  - Multi-région built-in

Architecture SpawnAI:
  Frontend → Fly API → Fly Machine (Claude + App)
  
Coût estimé:
  - $0.50-1.20 par session
  - Variable selon région/usage
```

#### Option 3 : Hybrid (Optimal)
```yaml
MVP: Railway pour simplicité développement
Scale: Migration Fly.io pour global reach

Timeline:
  Mois 1-3: Railway MVP
  Mois 4-6: Migration Fly.io
  Mois 6+: Multi-cloud (Railway backup)
```

### Code Examples Concrets

#### Railway Deployment
```javascript
// railway.json
{
  "build": {
    "builder": "DOCKERFILE"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "cronSchedule": null
  }
}

// Dockerfile SpawnAI
FROM node:18-alpine
RUN npm install -g @anthropic-ai/claude-cli
COPY . /app
WORKDIR /app
RUN npm install
EXPOSE 3000
CMD ["node", "spawn-server.js"]
```

#### Fly.io Deployment  
```toml
# fly.toml
app = "spawn-ai-${SESSION_ID}"

[build]
  image = "spawn-ai-runtime:latest"

[[services]]
  http_checks = []
  internal_port = 3000
  protocol = "tcp"

[[services.ports]]
  handlers = ["http"]
  port = 80

[[services.ports]]
  handlers = ["tls", "http"]
  port = 443

[env]
  SESSION_ID = "${SESSION_ID}"
  CLAUDE_API_KEY = "${CLAUDE_API_KEY}"
```

#### Modal (Pour référence AI-heavy)
```python
import modal

app = modal.App("spawn-ai")

@app.function(
    image=modal.Image.debian_slim().pip_install("anthropic"),
    cpu=2,
    memory=4096,
    timeout=3600  # 1h max
)
def generate_app(prompt: str, session_id: str):
    import anthropic
    client = anthropic.Anthropic()
    
    # Generate app code
    response = client.completions.create(
        prompt=prompt,
        model="claude-3-sonnet-20240229"
    )
    
    # Deploy generated code
    # ... logic here
    
    return f"https://{session_id}.spawn-ai.app"
```

## Nouvelles Technologies Émergentes 2025

### 1. WebAssembly (WASM) Serverless
- **Spin (Fermyon)** : WASM serverless avec cold start <1ms
- **Wasmtime** : Runtime WASM optimisé containers
- **Potentiel** : Alternative V8 isolates avec meilleures performances

### 2. Unikernels & Library OS
- **Nanos** : Unikernels pour containers ultra-légers  
- **OSv** : OS optimisé single-application
- **Avantage** : Boot time <100ms, empreinte mémoire réduite

### 3. Edge AI Inference
- **Cloudflare AI Workers** : Inference edge avec Workers AI
- **Vercel AI Functions** : AI edge functions intégrées
- **Nouveau paradigm** : AI processing près utilisateurs

## Conclusions & Recommandations SpawnAI

### Architecture Recommandée 2025
```yaml
MVP Phase (Mois 1-6):
  Platform: Railway
  Stack: Node.js + Docker + Claude API
  Coût: ~$0.50/session
  Simplicité: Maximum

Scale Phase (Mois 6-12):  
  Platform: Fly.io
  Stack: Même + multi-région
  Coût: ~$0.80/session  
  Global: 35 régions

Future (2026+):
  Platform: Cloudflare Containers (post-beta)
  Stack: Edge-native + WASM
  Coût: ~$0.20/session
  Performance: <50ms cold start global
```

### Killer Features à Développer
1. **Instant Deploy** : 0→app en <60s (vs 3-5min concurrents)
2. **Global Edge** : App accessible depuis 35+ régions
3. **Auto-Destroy** : Sécurité par design, pas de data leak
4. **Cost Transparency** : Prix exact affiché avant génération

Le marché 2025 offre des opportunités techniques excellentes pour SpawnAI, avec Railway comme choix MVP parfait et Fly.io pour le scaling global.