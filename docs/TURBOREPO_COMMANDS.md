# Turborepo Setup Commands - SpawnAI

## Quick Setup with create-turbo

### Step 1: Create Turborepo
```bash
# Go to parent directory
cd ..

# Create new turborepo (interactive)
npx create-turbo@latest
# When prompted:
# - Name: SpawnAI-monorepo
# - Package manager: pnpm
# - Template: basic (or default)

# OR non-interactive (if you want to skip prompts)
npx create-turbo@latest SpawnAI-monorepo --package-manager pnpm
```

### Step 2: Move to existing project
```bash
# Copy generated files to existing SpawnAI directory
cp -r SpawnAI-monorepo/* SpawnAI/
cp SpawnAI-monorepo/.gitignore SpawnAI/
cp SpawnAI-monorepo/.env.example SpawnAI/ 2>/dev/null || true

# Clean up temporary directory
rm -rf SpawnAI-monorepo

# Go back to SpawnAI directory
cd SpawnAI
```

### Step 3: Install dependencies
```bash
# Install all workspace dependencies
pnpm install
```

### Step 4: Verify setup
```bash
# Build all packages
pnpm build

# Run development mode
pnpm dev

# Test specific app/package
pnpm --filter web dev
pnpm --filter docs dev
```

## Generated Structure
After running create-turbo, you'll get:
```
SpawnAI/
├── apps/
│   ├── docs/          # Documentation app (Next.js)
│   └── web/           # Web app (Next.js)
├── packages/
│   ├── eslint-config/ # Shared ESLint config
│   ├── typescript-config/ # Shared TypeScript config
│   └── ui/            # Shared UI components
├── turbo.json         # Turborepo configuration
├── pnpm-workspace.yaml # PNPM workspace config
├── package.json       # Root package.json
└── README.md
```

## Customize for SpawnAI

### Step 5: Rename/adapt apps
```bash
# Remove default apps and create orchestrator
rm -rf apps/web apps/docs

# Create orchestrator app
mkdir -p apps/orchestrator/src
cd apps/orchestrator

# Create package.json for orchestrator
cat > package.json << 'EOF'
{
  "name": "orchestrator",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "lint": "eslint src --ext .ts,.tsx",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4.19.2",
    "axios": "^1.7.2",
    "dockerode": "^4.0.2",
    "@anthropic-ai/sdk": "^0.24.3",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.12.7",
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "eslint": "^8.57.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2",
    "tsx": "^4.7.3",
    "typescript": "^5.4.5"
  }
}
EOF

# Create TypeScript config
cat > tsconfig.json << 'EOF'
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
EOF

# Create basic index.ts
cat > src/index.ts << 'EOF'
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'orchestrator',
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`🚀 SpawnAI Orchestrator running on port ${port}`);
});
EOF

cd ../..
```

### Step 6: Update root scripts
```bash
# Update root package.json scripts
cat > package.json << 'EOF'
{
  "name": "spawnai",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "test": "turbo test",
    "type-check": "turbo type-check",
    "dev:orchestrator": "turbo dev --filter=orchestrator",
    "build:orchestrator": "turbo build --filter=orchestrator",
    "test:orchestrator": "turbo test --filter=orchestrator"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "turbo": "^2.0.0"
  },
  "packageManager": "pnpm@9.0.0",
  "engines": {
    "node": ">=18"
  }
}
EOF
```

### Step 7: Update turbo.json
```bash
cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "type-check": {
      "dependsOn": ["^type-check"]
    }
  }
}
EOF
```

## Final Commands

### Install and test
```bash
# Install all dependencies
pnpm install

# Build everything
pnpm build

# Start orchestrator in dev mode
pnpm dev:orchestrator

# Test (in another terminal)
curl http://localhost:3001/health
```

## Ready to Code!
Your monorepo is now set up with:
- ✅ Turborepo for build orchestration
- ✅ PNPM workspaces
- ✅ TypeScript configuration
- ✅ ESLint/Prettier setup
- ✅ Orchestrator app ready for development
- ✅ Shared packages for types and configs

Next: Start implementing VM management, Claude API integration, and security features in the orchestrator.