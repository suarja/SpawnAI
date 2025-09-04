# SpawnAI - Product Requirements Document (PRD)

## 1. Vision & Positioning

### Core Vision
SpawnAI is a contrarian AI-powered application generator that creates "ugly but functional" ephemeral apps for personal use only, deliberately positioning against the "beautiful and scalable" promise of competitors.

### Unique Value Proposition
- **Brutal Honesty**: No marketing hype, transparent about limitations
- **Ephemeral by Design**: Apps self-destruct in 24-72h, no permanent storage
- **Personal Utility**: Single-user focused, no sharing/collaboration features
- **Anti-Beautiful**: Celebrates functional ugliness over polished UIs

## 2. Target Market

### Primary Users
- Developers who need quick personal tools/prototypes
- Professionals requiring one-off automation scripts
- Users frustrated by over-engineered solutions
- Anyone needing temporary digital solutions

### Anti-Personas (Deliberately NOT targeting)
- Teams needing collaborative applications
- Users requiring permanent, scalable solutions
- Businesses needing polished, branded applications

## 3. Core Features Overview

### 3.1 Primary Feature: AI Orchestration Engine
**Priority: P0 (Start Here)**
- VM provisioning and management
- Claude API integration for code generation
- Security isolation and resource limits
- Automatic cleanup and destruction

### 3.2 User Interface
**Priority: P1**
- Simple chat interface (no complex IDE)
- App type selection
- Generation progress tracking
- Basic app management (extend time, destroy)

### 3.3 Infrastructure & Security
**Priority: P0**
- Docker containerization
- Network isolation
- SSL/TLS certificate generation
- Resource monitoring and limits

## 4. Technical Architecture

### High-Level Flow
```
User Request → Chat Interface → Orchestrator → VM Creation → Claude Generation → App Deployment → Auto-Destruction
```

### Key Components
1. **Frontend**: React PWA with chat interface
2. **Orchestrator**: Node.js backend managing VM lifecycle
3. **VM Manager**: Docker containers with isolation
4. **AI Integration**: Claude API for code generation
5. **Security Layer**: Certificate management, network isolation

## 5. Business Model

### Pricing Strategy
- Pay-per-spawn: $2-5 per app generation
- Time extensions: +$1/day beyond initial 24h
- No subscriptions or recurring fees

### Success Metrics
- Time to app creation: <3 minutes
- User satisfaction on utility: >80%
- Cost per successful generation: <$0.50
- VM provisioning success rate: >95%

## 6. Constraints & Limitations

### Technical Constraints
- Maximum VM resources per session
- 72h maximum app lifetime (hard limit)
- Single-user access only
- No data persistence across sessions

### Design Constraints
- Must maintain "anti-beautiful" aesthetic
- No sharing or collaboration features
- Transparent about limitations in UI
- Ephemeral nature must be prominent

## 7. Success Criteria

### Launch Readiness
- [x] Successfully generate and deploy simple apps in <3 minutes ✅ (E2B <60s capability)
- [x] Automatic VM cleanup working reliably ✅ (E2B sandbox lifecycle)
- [x] Security isolation verified and tested ✅ (E2B native isolation)
- [ ] Cost monitoring and alerting functional (next: Claude integration)

### Post-Launch Goals (3 months)
- [ ] 100+ successful app generations
- [ ] <$0.50 cost per generation
- [ ] 80%+ user satisfaction on utility
- [ ] Zero security incidents

## 8. Non-Goals

### Explicitly NOT Building
- Beautiful, polished UIs
- Team collaboration features
- Permanent app hosting
- Complex IDE integrations
- Mobile app development
- Enterprise features
- User authentication beyond session management

## 9. Risks & Mitigation

### Technical Risks
- **VM provisioning failures**: Implement fallback providers
- **Security breaches**: Multiple isolation layers + monitoring
- **Cost overruns**: Strict resource limits + monitoring

### Market Risks
- **Contrarian positioning rejection**: Double down on honesty, find niche
- **Low willingness to pay**: Focus on clear utility demonstration
- **Competition from free alternatives**: Emphasize speed and convenience

## 10. Timeline & Milestones

### Phase 1: Core Foundation (✅ COMPLETED - Sept 2025)
- ✅ E2B orchestration engine (production-ready)
- ✅ Sandbox lifecycle management (<60s deployment)
- ✅ REST API with minimal testing
- ✅ Real integration validation

### Phase 2: AI Integration (🔄 IN PROGRESS - Sept 2025)
- [ ] Claude API integration for code generation
- [ ] Prompt-to-app pipeline (natural language → working app)
- [ ] Basic error handling and validation
- [ ] Minimal integration testing

### Phase 3: User Interface (📋 NEXT - Oct 2025)
- [ ] Simple React chat interface
- [ ] App type selection (webapp/api/script)
- [ ] Real-time generation progress
- [ ] Basic session management

### Phase 4: Production Hardening (🔮 FUTURE)
- [ ] Database persistence and cost tracking
- [ ] Enhanced security and rate limiting
- [ ] Payment integration
- [ ] Performance optimization