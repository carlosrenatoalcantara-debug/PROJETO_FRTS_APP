#!/bin/bash

echo "=========================================="
echo "TESTING SISTEMA FRTS APP"
echo "=========================================="

# Test 1: Backend health
echo -e "\n[1] Testing Backend Health..."
HEALTH=$(curl -s http://localhost:3000/api/health 2>&1)
if echo "$HEALTH" | grep -q "ok"; then
    echo "✓ Backend responding"
else
    echo "✗ Backend not responding"
    exit 1
fi

# Test 2: Fetch existing project
echo -e "\n[2] Testing EV Project Fetch..."
PROJECT=$(curl -s http://localhost:3000/api/projetos-ev/proj-ev-teste-1 2>&1)
if echo "$PROJECT" | grep -q "proj-ev-teste-1"; then
    echo "✓ Project found"
    
    # Check for required fields
    echo "  Checking calculos_nbr fields..."
    
    FIELDS=("corrente_projeto_a" "bitola_cabo_mm2" "disjuntor_a" "dr_ma" "dps_kv" "dps_capacidade_a" "tempo_seccionamento_s")
    
    for field in "${FIELDS[@]}"; do
        if echo "$PROJECT" | grep -q "\"$field\""; then
            echo "    ✓ $field"
        else
            echo "    ✗ $field (MISSING)"
        fi
    done
else
    echo "✗ Project not found"
fi

# Test 3: Frontend
echo -e "\n[3] Testing Frontend..."
FRONTEND=$(curl -s http://localhost:3006 2>&1)
if echo "$FRONTEND" | grep -q "<html\|<!DOCTYPE"; then
    echo "✓ Frontend responding on port 3006"
else
    echo "? Frontend status unclear"
fi

echo -e "\n=========================================="
echo "Tests Complete"
echo "=========================================="
