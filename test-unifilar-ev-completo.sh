#!/bin/bash

API_URL="https://projetofrtsapp-production.up.railway.app"

echo "🚀 TESTE AUTÔNOMO - GERADOR DE UNIFILAR EV"
echo "=========================================="
echo ""

testesPassaram=0
testesFalharam=0
testNum=1

# Arrays de carregadores
CARREGADORES=(
  "7.4|CVBE MO 220V 7.4KW"
  "7|EVE 0074B"
  "7|EVE 0074C"
  "11|EVE 0110C"
  "22|EVE 0220B"
  "7.4|SOLPLANET EV 7.4kW"
)

# Arrays de tensões
TENSOES=("monofasico" "trifasico")

echo "⚡ TESTES EV - Carregadores + Configurações"
echo "=========================================="

for carregador_data in "${CARREGADORES[@]}"; do
  IFS="|" read -r potencia modelo <<< "$carregador_data"
  for tensao in "${TENSOES[@]}"; do
    echo -n "  [$testNum] $modelo ($potencia kW, $tensao): "

    response=$(curl -s -X POST \
      -H "Content-Type: application/json" \
      -d "{\"potencia_carregador\": $potencia, \"tensao\": \"$tensao\", \"disjuntor\": {\"corrente\": \"32A\"}, \"dr\": {\"corrente\": \"30mA\"}}" \
      "$API_URL/api/unifilar/ev/gerar" 2>&1)

    if echo "$response" | grep -q "<svg"; then
      size=$(echo "$response" | wc -c)
      echo "✅ SVG ($size bytes)"
      ((testesPassaram++))
    else
      echo "❌ Erro"
      ((testesFalharam++))
    fi
    ((testNum++))
  done
done

# Resumo
echo ""
echo "📋 RESUMO"
echo "========="
total=$((testesPassaram + testesFalharam))
taxa=$(echo "scale=1; ($testesPassaram * 100) / $total" | bc)

echo "✅ Passaram: $testesPassaram/$total"
echo "❌ Falharam: $testesFalharam/$total"
echo "📈 Taxa de sucesso: $taxa%"

echo ""
echo "🎯 COBERTURA"
echo "============"
echo "Carregadores testados: ${#CARREGADORES[@]}"
echo "Configurações: ${#TENSOES[@]}"
echo "Total de cenários: $((${#CARREGADORES[@]} * ${#TENSOES[@]}))"

echo ""
if [ $testesFalharam -eq 0 ]; then
  echo "🎉 TODOS OS TESTES PASSARAM!"
  echo "✨ Sistema pronto para projetos EV!"
else
  echo "⚠️  Alguns testes falharam"
fi
