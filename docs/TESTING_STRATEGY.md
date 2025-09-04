# SpawnAI Testing Strategy

## Philosophy: Deployment-Driven Testing

SpawnAI follows a **deployment-driven development** methodology where testing focuses on:

1. **Functional over comprehensive** - Test what actually works in production
2. **Integration over unit** - Test real component interactions 
3. **Autonomous features** - Each feature tested independently
4. **Fast feedback loops** - Quick tests that validate core functionality

## Testing Architecture

### Primary Approach: Integration Testing
- **Focus:** End-to-end user workflows and API contracts
- **Coverage:** Complete request/response cycles with realistic data
- **Speed:** All test suites complete in <1 second
- **Reliability:** Zero flaky tests, consistent results

### Mocking Strategy
External services are mocked with realistic behavior to ensure fast, reliable tests:

```typescript
// E2B SDK Mock - Simulates real sandbox behavior
jest.mock('@e2b/code-interpreter', () => ({
  Sandbox: {
    create: jest.fn().mockResolvedValue({
      getInfo: jest.fn().mockResolvedValue({
        sandboxId: 'mock-sandbox-id',
        hostname: 'mock-host.e2b.dev'
      }),
      kill: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));
```

### Test Organization
```
apps/orchestrator/src/__tests__/
├── integration.test.ts    # Feature integration tests
└── [future-features]/     # Feature-specific test suites
```

## Testing Commands

```bash
# Run all tests
pnpm test

# Run tests with coverage  
pnpm test -- --coverage

# Type checking + linting
pnpm type-check && pnpm lint
```

## Autonomous Feature Testing Pattern

Each new feature follows this testing approach:

1. **Create feature-specific integration test**
2. **Mock external dependencies** (APIs, databases)
3. **Test complete user workflows** (happy path + error scenarios)
4. **Validate production compatibility**
5. **Ensure autonomous deployment capability**

## Quality Standards

- **Test Speed:** <1 second for complete test suites
- **Zero Flaky Tests:** Consistent, deterministic results
- **Production Validated:** Real integrations confirmed working
- **Coverage Focus:** User workflows over code coverage metrics

## Tools & Configuration

- **Framework:** Jest with TypeScript support
- **API Testing:** Supertest for Express.js endpoints
- **Mocking:** Jest mocks optimized for external services
- **CI Ready:** Automated testing pipeline compatible

---

*For specific feature test results and implementation status, see individual feature specifications in `/docs/features/`*