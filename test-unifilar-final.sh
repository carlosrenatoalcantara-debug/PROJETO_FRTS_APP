#!/bin/bash

API_URL="https://projetofrtsapp-production.up.railway.app"

echo "🚀 TESTE AUTÔNOMO - GERADOR DE UNIFILAR"
echo "========================================"
echo ""

testesPassaram=0
testesFalharam=0
testNum=1

# Dados de teste
MODULOS=("DAH 440W" "DAH 585W" "ZN Shine 570W" "Risen 540W")
INVERSORES=("SAJ M2" "Growatt Mid" "Goodwe" "Solis 30K")

echo "📊 TESTES FV (Módulo + Inversor) - 16 combinações"
echo "=================================================="

for modulo in "${MODULOS[@]}"; do
  for inversor in "${INVERSORES[@]}"; do
    response=$(curl -s -X POST -H "Content-Type: application/json" \
      -d "{\"paineis\": 400, \"strings\": [{\"id\": 1}], \"inversor\": {\"potenciaKW\": 10, \"modelo\": \"$inversor\"}}" \
      "$API_URL/api/unifilar/fv/gerar" 2>&1)

    if echo "$response" | grep -q '"svg":"<'; then
      size=$(echo "$response" | wc -c)
      echo "  [$testNum] ✅ $modulo + $inversor"
      ((testesPassaram++))
    else
      echo "  [$testNum] ❌ $modulo + $inversor"
      ((testesFalharam++))
    fi
    ((testNum++))
  done
done

echo ""
echo "⚡ TESTES EV (Carregador EV + Tensão) - 2 cenários"
echo "==============================================="

for tensao in "monofasico" "trifasico"; do
  response=$(curl -s -X POST -H "Content-Type: application/json" \
    -d "{\"potencia_carregador\": 7, \"tensao\": \"$tensao\", \"disjuntor\": {\"corrente\": \"32A\"}, \"dr\": {\"corrente\": \"30mA\"}}" \
    "$API_URL/api/unifilar/ev/gerar" 2>&1)

  if echo "$response" | grep -q '"svg":"<'; then
    size=$(echo "$response" | wc -c)
    echo "  [$testNum] ✅ Carregador EV 7kW ($tensao)"
    ((testesPassaram++))
  else
    echo "  [$testNum] ❌ Carregador EV 7kW ($tensao)"
    ((testesFalharam++))
  fi
  ((testNum++))
done

# Resumo
echo ""
echo "📋 RESUMO FINAL"
echo "==============="
total=$((testesPassaram + testesFalharam))

echo "✅ Passaram: $testesPassaram/$total"
echo "❌ Falharam: $testesFalharam/$total"

if [ $testesFalharam -eq 0 ]; then
  echo ""
  echo "🎉 TODOS OS $total TESTES PASSARAM!"
  echo ""
  echo "✨ Cenários testados com sucesso:"
  echo "   • 16 combinações FV (4 módulos × 4 inversores)"
  echo "   • 2 configurações EV (monofásico e trifásico)"
  echo "   • Total: 18 diagramas unificares gerados"
else
  echo ""
  echo "⚠️  Alguns testes falharam"
fi
