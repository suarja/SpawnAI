#!/bin/bash
# Script de test pour l'intégration Claude AI + E2B
# Teste le flux complet : prompt → code → déploiement → app fonctionnelle

set -e

echo "🧪 Test de l'intégration Claude AI + E2B"
echo "========================================"

# Configuration
API_BASE="http://localhost:3001"
TESTS_DIR="/tmp/spawnai-tests"
mkdir -p "$TESTS_DIR"

# Fonction utilitaire pour tester un endpoint
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="${5:-200}"
    
    echo ""
    echo "📋 Test: $name"
    echo "   Endpoint: $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$API_BASE$endpoint")
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$API_BASE$endpoint")
    fi
    
    status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    if [ "$status" = "$expected_status" ]; then
        echo "   ✅ Statut: $status"
        echo "$body" | jq . > "$TESTS_DIR/response_${name// /_}.json"
        echo "   📄 Réponse sauvée dans: $TESTS_DIR/response_${name// /_}.json"
        return 0
    else
        echo "   ❌ Statut attendu: $expected_status, reçu: $status"
        echo "   📄 Réponse: $body"
        return 1
    fi
}

# 1. Test de santé générale
test_endpoint "Health Check" "GET" "/health"

# 2. Vérification du statut de l'API
echo ""
echo "🔍 Vérification du statut Claude AI..."
test_endpoint "API Status" "GET" "/api/status"

# Vérifier si Claude est activé
claude_status=$(curl -s "$API_BASE/api/status" | jq -r '.claude.status')
if [ "$claude_status" != "ready" ]; then
    echo ""
    echo "⚠️  ATTENTION: Claude AI n'est pas activé (status: $claude_status)"
    echo "   Vérifiez que CLAUDE_API_KEY est bien définie dans apps/orchestrator/.env"
    echo ""
    echo "   Pour continuer les tests sans Claude (fallback vers testCode):"
    read -p "   Continuer quand même ? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 3. Test de création d'app avec prompt (webapp)
echo ""
echo "🎨 Test: Webapp avec prompt Claude"
webapp_data='{
  "appType": "webapp",
  "prompt": "Create a simple calculator with basic operations (add, subtract, multiply, divide). Use clean HTML and CSS with a calculator layout."
}'

if test_endpoint "Webapp Creation" "POST" "/api/spawn" "$webapp_data"; then
    webapp_session=$(cat "$TESTS_DIR/response_Webapp_Creation.json" | jq -r '.sessionId')
    webapp_url=$(cat "$TESTS_DIR/response_Webapp_Creation.json" | jq -r '.publicUrl // empty')
    
    echo "   📱 Session ID: $webapp_session"
    if [ -n "$webapp_url" ]; then
        echo "   🌐 URL: $webapp_url"
        
        # Test de l'app déployée
        echo "   🔗 Test de l'app déployée..."
        if curl -s --max-time 10 "$webapp_url" > /dev/null; then
            echo "   ✅ App accessible"
        else
            echo "   ⚠️  App pas encore prête (normal, peut prendre quelques secondes)"
        fi
    fi
fi

# 4. Test de création d'API avec prompt
echo ""
echo "🔌 Test: API avec prompt Claude"
api_data='{
  "appType": "api",
  "prompt": "Create a simple REST API for managing a todo list. Include endpoints: GET /todos, POST /todos, DELETE /todos/:id. Use in-memory storage."
}'

if test_endpoint "API Creation" "POST" "/api/spawn" "$api_data"; then
    api_session=$(cat "$TESTS_DIR/response_API_Creation.json" | jq -r '.sessionId')
    api_url=$(cat "$TESTS_DIR/response_API_Creation.json" | jq -r '.publicUrl // empty')
    
    echo "   📱 Session ID: $api_session"
    if [ -n "$api_url" ]; then
        echo "   🌐 URL: $api_url"
    fi
fi

# 5. Test de création de script avec prompt
echo ""
echo "📜 Test: Script avec prompt Claude"
script_data='{
  "appType": "script",
  "prompt": "Create a Python script that analyzes a log file and generates a simple HTML report showing error count, warning count, and most frequent error messages."
}'

if test_endpoint "Script Creation" "POST" "/api/spawn" "$script_data"; then
    script_session=$(cat "$TESTS_DIR/response_Script_Creation.json" | jq -r '.sessionId')
    script_url=$(cat "$TESTS_DIR/response_Script_Creation.json" | jq -r '.publicUrl // empty')
    
    echo "   📱 Session ID: $script_session"
    if [ -n "$script_url" ]; then
        echo "   🌐 URL: $script_url"
    fi
fi

# 6. Test de fallback sans prompt (testCode)
echo ""
echo "🔄 Test: Fallback sans prompt (testCode)"
fallback_data='{
  "appType": "webapp"
}'

test_endpoint "Fallback Creation" "POST" "/api/spawn" "$fallback_data"

# 7. Listage des sandboxes actives
echo ""
echo "📊 Liste des sandboxes actives"
test_endpoint "List Sandboxes" "GET" "/api/spawn"

# 8. Nettoyage (optionnel)
echo ""
read -p "🧹 Nettoyer les sandboxes créées pour les tests ? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧹 Nettoyage des sandboxes..."
    
    # Nettoyer chaque session créée
    for session in webapp_session api_session script_session; do
        session_id=$(eval echo \$$session)
        if [ -n "$session_id" ] && [ "$session_id" != "null" ]; then
            echo "   🗑️  Suppression de la session: $session_id"
            test_endpoint "Delete $session" "DELETE" "/api/spawn/$session_id" "" "200"
        fi
    done
    
    # Cleanup manuel
    test_endpoint "Manual Cleanup" "POST" "/api/spawn/cleanup"
fi

echo ""
echo "✅ Tests terminés !"
echo "📁 Détails dans: $TESTS_DIR/"
echo ""
echo "🚀 Intégration Claude AI + E2B testée avec succès !"