# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SpawnAI is a contrarian approach to AI-powered application generation. Unlike competitors (Bolt, Claude Code, Lovable) that promise scalable, beautiful applications, SpawnAI deliberately creates "ugly but functional" ephemeral apps for personal use only.

### Core Philosophy
- Brutal honesty over marketing hype
- Personal utility over sharing/collaboration  
- Ephemeral solutions (24-72h lifespan) over permanent apps
- Simple chat interface over complex IDE integration

## Architecture

### High-Level System Design
```
User Interface (React/PWA) → API Gateway → Orchestrator → E2B Sandbox (Claude + Generated App)
```

### Current Monorepo Structure
```
SpawnAI/
├── apps/orchestrator/              # Main backend service
│   ├── src/
│   │   ├── vm/                    # E2B sandbox management
│   │   ├── ai/                    # Claude API integration
│   │   ├── security/              # Security & validation
│   │   ├── deployment/            # App deployment
│   │   └── api/                   # REST API routes
├── packages/
│   ├── shared/                    # Types & utilities
│   ├── eslint-config/             # Shared linting
│   └── typescript-config/         # Shared TS configs
└── docs/
    ├── features/                  # Feature specifications
    ├── architecture/              # Technical architecture
    └── research/                  # Market research
```

### Key Components
- **Frontend**: Single-page React app with chat interface (future)
- **Backend**: Node.js/Express orchestrator with Redis queue
- **Infrastructure**: E2B sandboxes with automatic HTTPS
- **AI Integration**: Claude API with optimized prompts
- **Isolation**: Native E2B sandbox security and resource limits

## Development Commands

### Development Commands

#### Setup and Installation
```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Type checking across monorepo
pnpm type-check

# Linting across monorepo
pnpm lint
```

#### Orchestrator Development
```bash
# Start orchestrator in development mode
pnpm dev:orchestrator

# Build orchestrator
pnpm build:orchestrator

# Run orchestrator tests
pnpm test:orchestrator
```

#### E2B Integration Testing
```bash
# Test E2B connectivity
pnpm test:e2b

# Run orchestration tests
pnpm test:orchestration

# Monitor E2B usage
pnpm monitor:e2b
```

#### Health Checks
```bash
# Check orchestrator health
curl http://localhost:3001/health

# Check API status
curl http://localhost:3001/api/status
```

## Key Technical Decisions

### Technology Stack
- **Frontend**: React + Vite + TailwindCSS + Socket.io
- **Backend**: Node.js + Express + PostgreSQL + Redis
- **Infrastructure**: E2B Sandboxes (replacing DigitalOcean VMs)
- **AI**: Anthropic Claude API with optimized prompts
- **Architecture**: Monorepo with Turborepo + PNPM workspaces

### Security & Isolation
- E2B sandboxes with native isolation and security
- Automatic resource limits (CPU, RAM, storage)
- Network isolation with HTTPS endpoints
- Code analysis before execution
- Auto-cleanup after timeout (1h hobby, 24h pro)

### Scalability Approach
- E2B sandbox scaling (20 concurrent hobby, 100 pro)
- Queue-based request handling with Redis
- Stateless application design
- Cost optimization: <$0.10/session vs target $0.50

### E2B Integration Specifics
- **Internet Access**: Default enabled, controllable via `allowInternetAccess`
- **Public URLs**: Automatic HTTPS endpoints (`https://3000-[id].e2b.dev`)
- **Session Limits**: 1h (hobby) / 24h (pro) aligning with ephemeral philosophy
- **Resource Control**: Built-in CPU, RAM, storage limits
- **Template**: Using 'anthropic-claude-code' for optimized AI generation

## Business Model Integration

### Pricing Strategy
- Pay-per-spawn model ($2-5 per app)
- Time-based extensions (+$1/day)
- No subscription or recurring fees

### Success Metrics
- Time to app creation (target: <3 minutes)
- User satisfaction on utility (target: >80%)
- Cost per successful generation (target: <$0.50)

## Critical Constraints

### Ephemeral Nature
- All generated applications must auto-destruct
- No permanent data storage in generated apps
- Single-user access only (no sharing features)

### Honest Marketing
- Never oversell capabilities in UI/documentation
- Prominently display limitations
- Celebrate "ugly but functional" results

### Resource Management
- Strict VM resource limits
- Automatic cleanup of abandoned sessions  
- Cost monitoring and alerting

## Development Methodology: Deployment-Driven Development

### Core Philosophy
SpawnAI follows **deployment-driven development** with minimal testable steps:

1. **Build smallest working feature** (autonomous and testable)
2. **Add minimal regression-prevention tests** (after implementation, not before)
3. **Deploy and validate in production** 
4. **Document completion and next step**
5. **Move to next autonomous feature**

### Feature Development Pattern

#### Implementation Phase
```bash
# 1. Implement smallest functional feature
git checkout -b feat/feature-name
# Code the minimal working implementation
git commit -m "feat(component): implement [feature] - smallest functional feature"
```

#### Testing Phase  
```bash
# 2. Add minimal tests AFTER implementation
# Focus: Integration tests over unit tests
# Coverage: Just enough to prevent regression
git commit -m "test: add minimal testing for [feature]"
```

#### Documentation Phase
```bash
# 3. Update documentation and roadmap
git commit -m "docs: update roadmap and feature specifications"
```

### Testing Philosophy

**✅ DO:**
- Integration tests for real workflows
- Test critical paths only
- Add tests AFTER feature implementation
- Focus on autonomous feature validation
- Prevent regression, not comprehensive coverage

**❌ DON'T:**
- Write tests before implementation (not TDD)
- Aim for high test coverage percentages
- Create extensive unit test suites
- Over-engineer test infrastructure

**Example - E2B Integration Testing:**
```typescript
// Good: Minimal integration test covering critical path
it('should create and destroy sandbox lifecycle', async () => {
  const response = await request(app).post('/api/spawn').send({...})
  expect(response.status).toBe(200)
  // Test real E2B integration, not mocked behavior
})

// Avoid: Extensive unit testing
// Don't test every method, parameter combination, edge case
```

### Current Development Status

**✅ COMPLETED FEATURES:**
- **Feature #1**: E2B Orchestration Engine (commits: `fe79f4c5` → `db955a6f`)
  - Production-ready E2B sandbox management
  - REST API with 4 integration tests
  - Real deployment validation (<60s capability)

**🎯 NEXT FEATURE:**
- **Feature #2**: Claude AI Integration  
  - Implement `src/ai/claude-client.ts`
  - Connect to existing E2B pipeline
  - 2-3 integration tests for prompt→code→deploy

### Common Tasks

#### Adding New Features
1. **Identify smallest autonomous feature** that provides user value
2. **Implement core functionality** without over-engineering
3. **Add minimal integration tests** to prevent regression
4. **Validate in production environment** with real services
5. **Update roadmap** and mark feature complete

#### Infrastructure Monitoring
- E2B sandbox success rates (target: >95%)
- Claude API latency and costs (target: <$0.10/session)
- Resource utilization per session
- Error rates and failure modes

#### Marketing Alignment
Every feature should maintain SpawnAI's contrarian positioning:
- **"Ugly but functional"** - No polished UIs until core works
- **Ephemeral by design** - All apps self-destruct
- **Personal use only** - No collaboration features
- **Deployment-driven** - Working features over perfect code

## Important Instruction Reminders
- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User
- NEVER add Claude attribution or co-author lines to git commits. Keep commit messages clean without AI attribution
- for each feature check the requirements, specs and testing guide in the docs