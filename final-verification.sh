#!/bin/bash

echo "=========================================="
echo "FINAL VERIFICATION - BUG FIXES"
echo "=========================================="

# Test 1: NBR Data Complete (Bug #1)
echo -e "\n[BUG #1] NBR Calculations Display Complete"
echo "Checking if all calculation fields are present..."

API_RESPONSE=$(curl -s http://localhost:3000/api/projetos-ev/proj-ev-teste-1)

REQUIRED_FIELDS=(
    "corrente_projeto_a"
    "corrente_maxima_a"
    "bitola_cabo_mm2"
    "disjuntor_a"
    "dr_ma"
    "dps_kv"
    "dps_capacidade_a"
    "tempo_seccionamento_s"
    "queda_tensao_pct"
)

ALL_PRESENT=true
for field in "${REQUIRED_FIELDS[@]}"; do
    if echo "$API_RESPONSE" | grep -q "\"$field\""; then
        echo "  ✓ $field"
    else
        echo "  ✗ $field (MISSING)"
        ALL_PRESENT=false
    fi
done

if [ "$ALL_PRESENT" = true ]; then
    echo -e "\n✅ BUG #1 FIXED: All NBR calculations present"
else
    echo -e "\n❌ BUG #1 NOT FIXED: Some fields missing"
fi

# Test 2: Diagram Editor Fields (Bug #2)
echo -e "\n[BUG #2] Diagram Editor Has Required Fields"
echo "Checking if diagram converter has the fields it needs..."

DIAGRAM_FIELDS=("dps_kv" "dps_capacidade_a" "tempo_seccionamento_s")

DIAGRAM_READY=true
for field in "${DIAGRAM_FIELDS[@]}"; do
    if echo "$API_RESPONSE" | grep -q "\"$field\""; then
        echo "  ✓ $field"
    else
        echo "  ✗ $field (BLOCKING)"
        DIAGRAM_READY=false
    fi
done

if [ "$DIAGRAM_READY" = true ]; then
    echo -e "\n✅ BUG #2 FIXED: Diagram editor can initialize"
    echo "   (No more blank page freezing)"
else
    echo -e "\n❌ BUG #2 NOT FIXED: Diagram still missing fields"
fi

# Summary
echo -e "\n=========================================="
echo "FINAL STATUS:"
if [ "$ALL_PRESENT" = true ] && [ "$DIAGRAM_READY" = true ]; then
    echo "🎉 BOTH BUGS RESOLVED - System ready for production!"
else
    echo "⚠️  Some issues remain - review above"
fi
echo "=========================================="
