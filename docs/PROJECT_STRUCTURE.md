# SpawnAI - Project Structure

## Recommended Architecture: Monorepo

```
SpawnAI/
├── docs/                           # Documentation
│   ├── PRD.md
│   ├── BACKLOG.md
│   └── PROJECT_STRUCTURE.md
├── packages/                       # Monorepo packages
│   ├── orchestrator/              # Core orchestration engine (START HERE)
│   │   ├── src/
│   │   │   ├── vm/                # VM management
│   │   │   │   ├── provisioner.ts
│   │   │   │   ├── lifecycle.ts
│   │   │   │   └── monitor.ts
│   │   │   ├── ai/                # Claude integration
│   │   │   │   ├── client.ts
│   │   │   │   ├── prompts.ts
│   │   │   │   └── validator.ts
│   │   │   ├── security/          # SSL/Security
│   │   │   │   ├── certificates.ts
│   │   │   │   ├── isolation.ts
│   │   │   │   └── scanner.ts
│   │   │   ├── deployment/        # App deployment
│   │   │   │   ├── deployer.ts
│   │   │   │   ├── process-manager.ts
│   │   │   │   └── health-check.ts
│   │   │   ├── api/              # REST API
│   │   │   │   ├── routes/
│   │   │   │   └── middleware/
│   │   │   └── index.ts          # Main entry point
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── frontend/                  # React UI (Phase 2)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   └── services/
│   │   └── package.json
│   └── shared/                    # Shared types/utilities
│       ├── src/
│       │   ├── types/
│       │   └── utils/
│       └── package.json
├── infrastructure/                 # Infrastructure as Code
│   ├── terraform/
│   ├── docker/
│   └── k8s/
├── scripts/                       # Build/deployment scripts
├── package.json                   # Root package.json
└── README.md
```

## Phase 1 Focus: Orchestrator Package

### Core Modules

#### 1. VM Management (`packages/orchestrator/src/vm/`)
```typescript
// provisioner.ts
interface VMConfig {
  resources: {
    cpu: number;
    memory: string;
    storage: string;
  };
  runtime: 'node' | 'python' | 'go';
  timeout: number; // hours
}

class VMProvisioner {
  async create(config: VMConfig): Promise<VM>;
  async destroy(vmId: string): Promise<void>;
  async list(): Promise<VM[]>;
}
```

#### 2. Claude Integration (`packages/orchestrator/src/ai/`)
```typescript
// client.ts
interface GenerationRequest {
  description: string;
  appType: 'web' | 'api' | 'script';
  runtime: string;
}

class ClaudeClient {
  async generateApp(request: GenerationRequest): Promise<GeneratedApp>;
  async validateCode(code: string): Promise<ValidationResult>;
}
```

#### 3. Security Layer (`packages/orchestrator/src/security/`)
```typescript
// certificates.ts
class CertificateManager {
  async generate(domain: string): Promise<Certificate>;
  async install(vmId: string, cert: Certificate): Promise<void>;
  async renew(certId: string): Promise<Certificate>;
}
```

#### 4. Deployment Engine (`packages/orchestrator/src/deployment/`)
```typescript
// deployer.ts
class AppDeployer {
  async deploy(vm: VM, app: GeneratedApp): Promise<DeploymentResult>;
  async healthCheck(deploymentId: string): Promise<HealthStatus>;
  async getLogs(deploymentId: string): Promise<string[]>;
}
```

## Testing Strategy for Phase 1

### Test Environment Setup
```bash
# Local development with Docker Compose
docker-compose up -d  # Redis, PostgreSQL, test containers

# Run orchestrator tests
cd packages/orchestrator
npm test

# Integration tests with real VMs (limited)
npm run test:integration
```

### Test Scenarios
1. **VM Lifecycle**: Create → Deploy → Monitor → Destroy
2. **Code Generation**: Simple app types with validation
3. **Security**: Certificate generation and installation
4. **Error Handling**: Network failures, timeouts, invalid code

## Development Workflow

### 1. Setup Monorepo
```bash
# Root level
npm init -y
npm install -D lerna typescript @types/node

# Initialize Lerna
npx lerna init
```

### 2. Create Orchestrator Package
```bash
mkdir -p packages/orchestrator/src/{vm,ai,security,deployment,api}
cd packages/orchestrator
npm init -y
npm install express axios docker-compose-remote-api
npm install -D @types/express jest ts-jest
```

### 3. Development Commands
```bash
# Root level commands
npm run dev:orchestrator     # Start orchestrator in dev mode
npm run test:orchestrator    # Run orchestrator tests
npm run build:all           # Build all packages
npm run docker:build        # Build Docker images
```

## Why This Structure?

### Advantages
1. **Modular**: Clear separation of concerns
2. **Testable**: Each module can be tested independently
3. **Scalable**: Easy to add new packages (frontend, mobile, etc.)
4. **Maintainable**: Well-organized codebase
5. **Deployable**: Each package can have its own deployment strategy

### Focus on Orchestrator First
- Most complex and critical component
- Provides immediate value for testing
- Can be developed/tested independently
- Forms the foundation for other components

## Next Steps

1. **Initialize monorepo structure**
2. **Create orchestrator package with basic VM management**
3. **Implement simple Docker-based VM provisioning**
4. **Add Claude API integration for basic code generation**
5. **Test end-to-end: Request → Generate → Deploy → Access**

This approach allows us to start simple, test early, and build confidence in the core mechanics before adding UI complexity.