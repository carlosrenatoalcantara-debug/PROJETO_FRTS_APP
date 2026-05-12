#!/bin/bash

API_URL="https://projetofrtsapp-production.up.railway.app"

echo "🚀 TESTE FINAL COMPLETO - SISTEMA DE UNIFILAR"
echo "=============================================="
echo ""

testesPassaram=0
testesFalharam=0
testNum=1

# ═══════════════════════════════════════════════════════════════════════════════
# TESTES FV - TODOS OS MÓDULOS + INVERSORES
# ═══════════════════════════════════════════════════════════════════════════════

echo "📊 TESTES FV (Módulo + Inversor)"
echo "================================"

MODULOS=(
  "440|DAH 440W"
  "585|DAH 585W"
  "570|ZN Shine 570W"
  "540|Risen 540W"
)

INVERSORES=(
  "2.25|SAJ M2"
  "25|Growatt Mid"
  "20|Goodwe"
  "30|Solis 30K"
)

for modulo_data in "${MODULOS[@]}"; do
  IFS="|" read -r potencia modulo <<< "$modulo_data"
  for inversor_data in "${INVERSORES[@]}"; do
    IFS="|" read -r potencia_inv inversor <<< "$inversor_data"
    echo -n "  [$testNum] $modulo + $inversor: "

    response=$(curl -s -X POST \
      -H "Content-Type: application/json" \
      -d "{\"paineis\": $potencia, \"strings\": [{\"id\": 1}], \"inversor\": {\"potenciaKW\": $potencia_inv, \"modelo\": \"$inversor\"}}" \
      "$API_URL/api/unifilar/fv/gerar" 2>&1)

    if echo "$response" | grep -q "<svg"; then
      echo "✅"
      ((testesPassaram++))
    else
      echo "❌"
      ((testesFalharam++))
    fi
    ((testNum++))
  done
done

# ═══════════════════════════════════════════════════════════════════════════════
# TESTES EV - TODOS OS CARREGADORES + TENSÕES
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "⚡ TESTES EV (Carregador + Tensão)"
echo "=================================="

CARREGADORES=(
  "7.4|CVBE MO"
  "7|EVE 0074B"
  "7|EVE 0074C"
  "11|EVE 0110C"
  "22|EVE 0220B"
  "7.4|SOLPLANET"
)

TENSOES=("monofasico" "trifasico")

for carregador_data in "${CARREGADORES[@]}"; do
  IFS="|" read -r potencia carregador <<< "$carregador_data"
  for tensao in "${TENSOES[@]}"; do
    echo -n "  [$testNum] $carregador ($potencia kW, $tensao): "

    response=$(curl -s -X POST \
      -H "Content-Type: application/json" \
      -d "{\"potencia_carregador\": $potencia, \"tensao\": \"$tensao\", \"disjuntor\": {\"corrente\": \"32A\"}, \"dr\": {\"corrente\": \"30mA\"}}" \
      "$API_URL/api/unifilar/ev/gerar" 2>&1)

    if echo "$response" | grep -q "<svg"; then
      echo "✅"
      ((testesPassaram++))
    else
      echo "❌"
      ((testesFalharam++))
    fi
    ((testNum++))
  done
done

# ═══════════════════════════════════════════════════════════════════════════════
# RESUMO FINAL
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "📋 RESUMO FINAL"
echo "==============="
total=$((testesPassaram + testesFalharam))

echo "✅ Passaram: $testesPassaram/$total"
echo "❌ Falharam: $testesFalharam/$total"

if [ $total -gt 0 ]; then
  taxa=$((testesPassaram * 100 / total))
  echo "📈 Taxa de sucesso: $taxa%"
fi

echo ""
echo "🎯 COBERTURA COMPLETA"
echo "====================="
echo "Combinações FV: $((${#MODULOS[@]} * ${#INVERSORES[@]})) (4 módulos × 4 inversores)"
echo "Combinações EV: $((${#CARREGADORES[@]} * ${#TENSOES[@]})) (6 carregadores × 2 tensões)"
echo "Total de cenários testados: $total"

echo ""
if [ $testesFalharam -eq 0 ]; then
  echo "🎉 SUCESSO TOTAL!"
  echo "════════════════"
  echo "✨ Sistema de unifilar 100% operacional"
  echo "✨ FV: 16 combinações funcionando"
  echo "✨ EV: 12 combinações funcionando"
  echo "✨ Total: 28 cenários testados com sucesso"
else
  echo "⚠️  $testesFalharam testes falharam"
fi
