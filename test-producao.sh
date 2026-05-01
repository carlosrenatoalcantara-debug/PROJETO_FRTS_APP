#!/bin/bash

# Script para testar a API em produção após MongoDB ficar disponível
# Uso: ./test-producao.sh

API_URL="https://projetofrtsapp-production.up.railway.app"
FRONTEND_URL="https://projeto-frts-app.vercel.app"

echo "🧪 Iniciando testes de produção..."
echo "API: $API_URL"
echo "Frontend: $FRONTEND_URL"
echo ""

# Teste 1: Health Check
echo "✅ Teste 1: Health Check"
curl -s "$API_URL/api/health" | jq '.' || echo "❌ Falhou"
echo ""

# Teste 2: CRM Funis (Funnels)
echo "✅ Teste 2: CRM Funis"
curl -s "$API_URL/api/crm/funis" | jq '.' || echo "❌ Falhou"
echo ""

# Teste 3: CRM Leads
echo "✅ Teste 3: CRM Leads"
curl -s "$API_URL/api/crm/leads" | jq '.' || echo "❌ Falhou"
echo ""

# Teste 4: CORS Headers (verificar se Vercel está permitida)
echo "✅ Teste 4: CORS Headers"
curl -s -H "Origin: $FRONTEND_URL" \
     -H "Access-Control-Request-Method: GET" \
     -o /dev/null -w "\nStatus: %{http_code}\n" \
     "$API_URL/api/health"
echo ""

# Teste 5: MongoDB Conexão
echo "✅ Teste 5: MongoDB Responsivo"
if curl -s "$API_URL/api/crm/leads" | jq -e '.' > /dev/null 2>&1; then
    echo "✅ MongoDB está respondendo"
else
    echo "❌ MongoDB ainda não acessível"
fi
echo ""

echo "🎉 Testes concluídos!"
