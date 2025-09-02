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
User Interface (React/PWA) → API Gateway → Orchestrator → Ephemeral VM (Claude + Generated App)
```

### Key Components
- **Frontend**: Single-page React app with chat interface
- **Backend**: Node.js/Express with Redis queue system  
- **Infrastructure**: Docker containers on cloud VMs (Railway/AWS)
- **AI Integration**: Claude API for code generation
- **Provisioning**: Automated VM creation with Terraform/Ansible

## Development Commands

### Frontend Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production  
npm run build

# Run linting
npm run lint

# Run type checking
npm run type-check
```

### Backend Development
```bash
# Start backend server
npm run server

# Run database migrations
npm run db:migrate

# Seed development data
npm run db:seed

# Run API tests
npm run test:api
```

### Infrastructure
```bash
# Deploy development environment
npm run deploy:dev

# Deploy production environment  
npm run deploy:prod

# Monitor system health
npm run monitor

# View logs
npm run logs
```

## Key Technical Decisions

### Technology Stack
- **Frontend**: React + Vite + TailwindCSS + Socket.io
- **Backend**: Node.js + Express + PostgreSQL + Redis
- **Infrastructure**: Docker + Railway/AWS + Terraform
- **AI**: Anthropic Claude API with optimized prompts

### Security & Isolation
- Docker containerization with strict resource limits
- Network isolation with minimal port exposure
- Automatic VM destruction after timeout
- Code analysis before execution

### Scalability Approach
- Horizontal scaling through VM provisioning
- Queue-based request handling
- Stateless application design
- Cost optimization through ephemeral architecture

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

## Common Tasks

### Adding New App Templates
1. Create prompt template in `src/prompts/`
2. Add validation rules in `src/validation/`
3. Update UI selection in `src/components/AppTypeSelector.tsx`
4. Test generation pipeline end-to-end

### Infrastructure Monitoring
- Check VM provisioning success rates
- Monitor Claude API latency and costs
- Track resource utilization per session
- Alert on security anomalies

### Marketing Alignment
When building features, always consider:
- Does this maintain our "anti-beautiful" positioning?
- Are we staying true to ephemeral/personal-use philosophy?
- Will this feature support our contrarian marketing message?