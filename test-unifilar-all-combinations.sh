#!/bin/bash

# Script de teste autônomo do gerador de unifilar
# Testa TODAS as combinações de módulo + inversor e carregador EV + inversor

API_URL="https://projetofrtsapp-production.up.railway.app"

echo "🚀 TESTE AUTÔNOMO - GERADOR DE UNIFILAR"
echo "========================================"
echo ""

testesPassaram=0
testesFalharam=0
testNum=1

# Arrays de dados
MODULOS=(
  "DAH 440W|440"
  "DAH 585W|585"
  "ZN Shine 570W|570"
  "Risen 540W|540"
)

INVERSORES=(
  "SAJ M2-2.25K|2.25"
  "Growatt Mid 25KTL3-X|25"
  "Goodwe 20KT|20"
  "Solis 30K|30"
)

CARREGADORES=(
  "Placeholder EV|7"
)

# Função para testar unifilar FV
test_unifilar_fv() {
  local modulo=$1
  local potencia=$2
  local inversor=$3
  local potencia_inv=$4

  echo -n "  [$testNum] $modulo + $inversor: "

  local payload=$(cat <<EOF
{
  "paineis": $potencia,
  "strings": [{"id": 1, "paineis": 10}],
  "inversor": {"potenciaKW": $potencia_inv, "modelo": "$inversor"},
  "tensao_rede": 220
}
EOF
)

  local response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "$API_URL/api/unifilar/gerar-fv" 2>&1)

  if echo "$response" | grep -q "<svg"; then
    echo "✅ SVG gerado ($(echo "$response" | wc -c) bytes)"
    ((testesPassaram++))
  else
    echo "❌ Erro: $(echo "$response" | head -c 50)"
    ((testesFalharam++))
  fi
  ((testNum++))
}

# Função para testar unifilar EV
test_unifilar_ev() {
  local carregador=$1
  local pot_carr=$2
  local inversor=$3
  local potencia_inv=$4

  echo -n "  [$testNum] $carregador + $inversor: "

  local payload=$(cat <<EOF
{
  "carregador": {"modelo": "$carregador", "potenciaKW": $pot_carr},
  "inversor": {"modelo": "$inversor", "potenciaKW": $potencia_inv},
  "tensao_rede": 220
}
EOF
)

  local response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "$API_URL/api/unifilar/gerar-ev" 2>&1)

  if echo "$response" | grep -q "<svg"; then
    echo "✅ SVG gerado ($(echo "$response" | wc -c) bytes)"
    ((testesPassaram++))
  else
    echo "❌ Erro"
    ((testesFalharam++))
  fi
  ((testNum++))
}

# Testar FV
echo "📊 TESTES FV (Módulo + Inversor)"
echo "================================"
for modulo_data in "${MODULOS[@]}"; do
  IFS="|" read -r modulo potencia <<< "$modulo_data"
  for inversor_data in "${INVERSORES[@]}"; do
    IFS="|" read -r inversor potencia_inv <<< "$inversor_data"
    test_unifilar_fv "$modulo" "$potencia" "$inversor" "$potencia_inv"
  done
done

echo ""
echo "⚡ TESTES EV (Carregador + Inversor)"
echo "==================================="
for carregador_data in "${CARREGADORES[@]}"; do
  IFS="|" read -r carregador pot_carr <<< "$carregador_data"
  for inversor_data in "${INVERSORES[@]}"; do
    IFS="|" read -r inversor potencia_inv <<< "$inversor_data"
    test_unifilar_ev "$carregador" "$pot_carr" "$inversor" "$potencia_inv"
  done
done

# Resumo
echo ""
echo "📋 RESUMO"
echo "==========="
total=$((testesPassaram + testesFalharam))
taxa=$(echo "scale=1; ($testesPassaram * 100) / $total" | bc)

echo "✅ Passaram: $testesPassaram"
echo "❌ Falharam: $testesFalharam"
echo "📊 Total: $total"
echo "📈 Taxa de sucesso: $taxa%"

echo ""
echo "🎯 COBERTURA"
echo "============="
echo "Combinações FV: $((${#MODULOS[@]} * ${#INVERSORES[@]}))"
echo "Combinações EV: $((${#CARREGADORES[@]} * ${#INVERSORES[@]}))"
echo "Total de cenários: $((${#MODULOS[@]} * ${#INVERSORES[@]} + ${#CARREGADORES[@]} * ${#INVERSORES[@]}))"

[ $testesFalharam -eq 0 ] && echo "" && echo "🎉 TODOS OS TESTES PASSARAM!" && exit 0 || exit 1
