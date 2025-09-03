# SpawnAI Monorepo Setup Commands

## Prerequisites
```bash
# Install pnpm globally
npm install -g pnpm

# Verify installation
pnpm --version
```

## Option 1: Manual Setup (Recommended)

### 1. Initialize root package.json
```bash
# In the SpawnAI root directory
pnpm init
```

### 2. Create monorepo structure
```bash
# Create directories
mkdir -p apps/orchestrator
mkdir -p packages/shared
mkdir -p packages/ui

# Create workspace configuration
cat > pnpm-workspace.yaml << EOF
packages:
  - "apps/*"
  - "packages/*"
EOF
```

### 3. Configure Turborepo
```bash
# Install Turborepo
pnpm add -D turbo

# Create turbo.json
cat > turbo.json << EOF
{
  "\$schema": "https://turbo.build/schema.json",
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
      "dependsOn": ["build"]
    },
    "type-check": {
      "dependsOn": ["build"]
    }
  }
}
EOF
```

### 4. Update root package.json
```bash
# Edit package.json to add scripts
cat > package.json << EOF
{
  "name": "spawnai",
  "version": "0.1.0",
  "description": "Contrarian AI-powered ephemeral app generator",
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
    "turbo": "^2.0.0",
    "typescript": "^5.4.5",
    "@types/node": "^20.12.7"
  },
  "packageManager": "pnpm@9.0.0",
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=9.0.0"
  }
}
EOF
```

### 5. Setup orchestrator app
```bash
cd apps/orchestrator

# Initialize orchestrator package
cat > package.json << EOF
{
  "name": "orchestrator",
  "version": "0.1.0",
  "description": "SpawnAI orchestration engine",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src --ext .ts",
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
    "eslint": "^8.57.0",
    "@typescript-eslint/eslint-plugin": "^7.7.1",
    "@typescript-eslint/parser": "^7.7.1",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2",
    "tsx": "^4.7.3",
    "typescript": "^5.4.5"
  }
}
EOF

# Create TypeScript config
cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
EOF

# Create basic source structure
mkdir -p src/{vm,ai,security,deployment,api}
touch src/index.ts

# Go back to root
cd ../..
```

### 6. Setup shared package
```bash
cd packages/shared

# Initialize shared package
cat > package.json << EOF
{
  "name": "@spawnai/shared",
  "version": "0.1.0",
  "description": "Shared types and utilities for SpawnAI",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.4.5"
  }
}
EOF

# Create TypeScript config
cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

mkdir -p src/types
touch src/index.ts

cd ../..
```

### 7. Install dependencies
```bash
# Install all dependencies
pnpm install

# Install orchestrator dependencies
pnpm --filter orchestrator install

# Install shared dependencies  
pnpm --filter @spawnai/shared install
```

### 8. Create basic files
```bash
# Create basic orchestrator entry point
cat > apps/orchestrator/src/index.ts << EOF
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'orchestrator' });
});

app.listen(port, () => {
  console.log(\`🚀 Orchestrator running on port \${port}\`);
});
EOF

# Create shared types
cat > packages/shared/src/index.ts << EOF
export interface VMConfig {
  resources: {
    cpu: number;
    memory: string;
    storage: string;
  };
  runtime: 'node' | 'python' | 'go';
  timeout: number; // hours
}

export interface GenerationRequest {
  description: string;
  appType: 'web' | 'api' | 'script';
  runtime: string;
}

export interface DeploymentResult {
  id: string;
  url: string;
  status: 'pending' | 'running' | 'failed';
  createdAt: Date;
}
EOF

# Create environment file template
cat > apps/orchestrator/.env.example << EOF
PORT=3001
ANTHROPIC_API_KEY=your_api_key_here
NODE_ENV=development
EOF
```

## Option 2: Using create-turbo (Alternative)
```bash
# If you prefer the official generator
cd ..
npx create-turbo@latest SpawnAI-temp
# Follow prompts:
# - Choose pnpm as package manager
# - Choose TypeScript template

# Then move files to your existing directory
cp -r SpawnAI-temp/* SpawnAI/
rm -rf SpawnAI-temp
```

## Verification Commands
```bash
# Test the setup
pnpm build
pnpm dev:orchestrator

# In another terminal, test the health endpoint
curl http://localhost:3001/health
```

## Next Steps
After running these commands, you'll have a fully functional monorepo with:
- ✅ PNPM workspace configuration
- ✅ Turborepo for build orchestration and caching
- ✅ TypeScript configuration
- ✅ Basic orchestrator app structure
- ✅ Shared types package
- ✅ Development scripts ready

You can then continue with implementing the VM management, Claude API integration, and other core features.