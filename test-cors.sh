#!/bin/bash

# Script para validar CORS após deploy

API_URL="https://projetofrtsapp-production.up.railway.app"
FRONTEND_URL="https://projeto-frts-app.vercel.app"

echo "🔍 Testando CORS e endpoints..."
echo ""

# Test 1: Health check
echo "1️⃣ Health Check:"
curl -s -H "Origin: $FRONTEND_URL" \
  -H "Access-Control-Request-Method: GET" \
  -w "\nStatus: %{http_code}\n\n" \
  "$API_URL/api/health"

# Test 2: GET equipamentos (deve ter CORS)
echo "2️⃣ GET /api/equipamentos (com CORS):"
curl -s -H "Origin: $FRONTEND_URL" \
  -w "\nStatus: %{http_code}\n\n" \
  "$API_URL/api/equipamentos?tipo=inversor&ativo=true"

# Test 3: Check CORS headers
echo "3️⃣ CORS Headers Response:"
curl -s -I -H "Origin: $FRONTEND_URL" \
  "$API_URL/api/health" | grep -i "access-control"

echo ""
echo "✅ Testes concluídos!"
