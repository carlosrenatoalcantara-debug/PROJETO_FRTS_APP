#!/bin/bash

# Script completo de teste de datasheets
# Aguarda API, depois testa módulos e inversores

API_URL="https://projetofrtsapp-production.up.railway.app"
MODULOS_PATH="/c/Users/Forte Solar/OneDrive/Área de Trabalho/Modulo"
INVERSORES_PATH="/c/Users/Forte Solar/OneDrive/Área de Trabalho/inversor"

echo "🚀 TESTE AUTOMÁTICO COMPLETO DE DATASHEETS"
echo "=========================================="
echo ""

# Aguardar API ficar online
echo "⏳ Aguardando API ficar online..."
for i in {1..120}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -m 3 "$API_URL/api/health" 2>/dev/null)
  if [ "$STATUS" = "200" ]; then
    echo "✅ API online! Iniciando testes..."
    break
  fi
  sleep 3
done

# Função para testar um PDF
test_pdf() {
  local file=$1
  local type=$2
  local name=$(basename "$file")

  echo ""
  echo "📄 Testando: $name"

  RESULT=$(curl -s -X POST \
    -F "pdf=@$file" \
    "$API_URL/api/datasheet/extrair-datasheet" 2>/dev/null)

  # Verificar se tem resposta
  if echo "$RESULT" | grep -q "modelo\|fabricante"; then
    echo "  ✅ Sucesso!"

    # Extrair campos principais
    echo "$RESULT" | grep -o '"modelo":"[^"]*"' && \
    echo "$RESULT" | grep -o '"fabricante":"[^"]*"' && \
    echo "$RESULT" | grep -o '"potencia_wp":[0-9]*' && \
    echo "$RESULT" | grep -o '"qualityScore":[0-9]*'
  else
    echo "  ❌ Erro: $(echo "$RESULT" | grep -o '"erro":"[^"]*"' || echo 'Resposta vazia')"
  fi
}

# Testar módulos (primeiros 3)
echo ""
echo "📦 TESTANDO MÓDULOS"
echo "==================="
ls "$MODULOS_PATH"/*.pdf 2>/dev/null | head -3 | while read pdf; do
  test_pdf "$pdf" "modulo"
done

# Testar inversores (primeiros 3)
echo ""
echo "⚡ TESTANDO INVERSORES"
echo "===================="
ls "$INVERSORES_PATH"/*.pdf 2>/dev/null | head -3 | while read pdf; do
  test_pdf "$pdf" "inversor"
done

echo ""
echo "✅ Testes concluídos!"
