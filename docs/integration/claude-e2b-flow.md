# Intégration Claude AI + E2B - Documentation Technique

## Vue d'ensemble

L'intégration Claude AI + E2B permet la génération d'applications fonctionnelles à partir de prompts en langage naturel. Le flux complet prend moins de 60 secondes et coûte environ $0.0014 par génération.

## Architecture des Modules

### 1. ClaudeClient (`src/ai/claude-client.ts`)
**Responsabilité :** Génération de code à partir de prompts en langage naturel

**Méthodes principales :**
- `generateCode(request: CodeGenerationRequest)` - Génère du code structuré
- `validateCode(code: GeneratedCode)` - Valide la sécurité du code généré
- `calculateCost(inputTokens, outputTokens)` - Calcule le coût de génération

**Configuration :**
- Modèle : Claude 3 Haiku (optimisé coût/performance)
- Temperature : 0.1 (génération consistente)
- Max tokens : 4096

### 2. E2BManager (`src/vm/e2b-manager.ts`)
**Responsabilité :** Gestion du cycle de vie des sandboxes E2B

**Méthodes principales :**
- `createSandbox(config: SandboxConfig)` - Crée un sandbox E2B
- `deploySandbox(sandbox, code: GeneratedCode)` - Déploie le code dans le sandbox
- `destroySandbox(sessionId)` - Nettoie les ressources

**Configuration :**
- Template : 'anthropic-claude-code' 
- Timeout : 30s pour démarrage app
- Resources : CPU 1 core, RAM 2GB

### 3. SpawnRoutes (`src/api/routes/spawn.ts`)
**Responsabilité :** Orchestration du flux Claude → E2B

**Points d'intégration critiques :**
```typescript
// 1. Génération Claude
if (prompt && claudeClient) {
  const genResult = await claudeClient.generateCode({ prompt, appType });
  if (genResult.success) {
    generatedCode = genResult.code;
    deploymentResult = await e2bManager.deploySandbox(sandbox, genResult.code);
  }
}

// 2. Fallback vers testCode
else if (testCode) {
  deploymentResult = await e2bManager.deploySandbox(sandbox, testCode);
}
```

## Flux de Données Détaillé

### Phase 1 : Réception du prompt
```
POST /api/spawn
{
  "appType": "webapp|api|script",
  "prompt": "Create a calculator with basic operations"
}
```

### Phase 2 : Génération Claude AI
```
User Prompt → System Prompt + Context → Claude API → Structured Code Response
```

**Templates de prompt par type :**
- **webapp** : HTML/CSS/JS avec serveur HTTP simple
- **api** : Node.js + Express avec endpoints REST
- **script** : Python avec génération de rapport HTML

**Format de réponse Claude :**
```json
{
  "type": "single-file|multi-file",
  "files": [
    {
      "path": "/app/index.html",
      "content": "<!DOCTYPE html>..."
    }
  ],
  "startCommand": "cd /app && python3 -m http.server 3000",
  "dependencies": ["express"]
}
```

### Phase 3 : Déploiement E2B
```
Structured Code → File Creation → Dependency Install → App Start → Health Check
```

**Étapes de déploiement :**
1. Création du répertoire `/app`
2. Écriture des fichiers générés
3. Installation des dépendances (npm/pip selon le type)
4. Démarrage de l'application
5. Vérification de santé sur port 3000
6. Génération URL publique : `https://3000-{sandboxId}.e2b.dev`

## Métriques de Performance Mesurées

### Test : Calculatrice webapp (prompt: 107 caractères)
- **Génération Claude :** 7.4s
- **Tokens :** 317 input, 1040 output
- **Coût :** $0.0014 
- **Déploiement E2B :** ~30s
- **Total :** <40s pour app fonctionnelle
- **URL finale :** `https://3000-irzn9yw8gmx4zemcgy6nz.e2b.dev`

### Optimisations appliquées
- **Modèle Haiku** : Plus rapide et économique que Sonnet
- **Template E2B Claude** : Environnement pré-optimisé
- **Prompts structurés** : Réduction des tokens d'entrée
- **Validation sécurité** : Patterns dangereux détectés

## Configuration Requise

### Variables d'environnement
```bash
# apps/orchestrator/.env
CLAUDE_API_KEY="sk-ant-api03-..."  # Requis pour génération AI
E2B_API_KEY="e2b_..."              # Requis pour sandboxes
PORT=3001
NODE_ENV=development
```

### Dépendances critiques
```json
{
  "@anthropic-ai/sdk": "^0.24.3",
  "@e2b/code-interpreter": "^0.0.5",
  "winston": "^3.11.0",
  "uuid": "^9.0.1"
}
```

## Gestion d'Erreurs et Fallbacks

### 1. Claude API indisponible
- **Détection :** `process.env.CLAUDE_API_KEY` missing
- **Fallback :** Mode testCode avec templates pré-définis
- **Logging :** "Claude AI generation disabled"

### 2. Génération Claude échoue
- **Détection :** `genResult.success === false`
- **Action :** Return 500 avec détails erreur
- **Retry :** Non implémenté (génération unique par requête)

### 3. Déploiement E2B timeout
- **Détection :** App pas ready après 30s
- **Cause commune :** Dépendances manquantes, port déjà utilisé
- **Debug :** Logs détaillés dans sandbox

### 4. Validation sécurité échoue
- **Patterns détectés :** `eval()`, `exec()`, `rm -rf`, path traversal
- **Action :** Rejet avec détails patterns dangereux

## Points d'Extension

### Nouveaux types d'apps
1. Ajouter template prompt dans `getSystemPrompt()`
2. Définir commande start par défaut dans `getDefaultStartCommand()`
3. Ajouter validation spécifique si nécessaire

### Optimisations futures
- **Cache Claude responses** pour prompts similaires
- **Parallel deployment** de plusieurs fichiers
- **Health check avancé** avec retry intelligent
- **Cost optimization** avec modèle switching dynamique

## Logs et Monitoring

### Événements clés loggés
```json
{
  "level": "info",
  "message": "Code generated successfully",
  "appType": "webapp",
  "fileCount": 1,
  "inputTokens": 317,
  "outputTokens": 1040,
  "estimatedCost": 0.0014
}
```

### Métriques à surveiller
- Taux de succès génération Claude
- Temps moyen déploiement E2B  
- Coût moyen par type d'app
- Taux d'erreur validation sécurité

## Validation Production

✅ **Test réussi :** Prompt "calculatrice" → App fonctionnelle déployée  
✅ **Performance :** <60s objectif respecté  
✅ **Coût :** <$0.10/session respecté ($0.0014 mesuré)  
✅ **Sécurité :** Validation patterns dangereux active  
✅ **Fallback :** Mode testCode opérationnel sans Claude

**Status :** Phase 2 (AI Integration) - PRODUCTION READY 🚀