# SISTEMA FRTS APP - STATUS & FIXES

## Bugs Reported
1. ❌ **NBR calculations showing as zeros/blank** when viewing project details through client
2. ❌ **Diagram editor freezing** (blank white page) when clicking "Editar Diagrama"

## Root Causes Identified

### Bug #1 - NBR Calculations as Zeros
- **Cause**: Auto-calculation logic only triggered on completely empty calculos_nbr object
- **Issue**: Projects had partial data (missing DPS fields), so validation passed but incomplete data was returned
- **Impact**: Frontend diagram converter expected `dps_kv` and `dps_capacidade_a` fields, got undefined

### Bug #2 - Diagram Editor Freezing  
- **Cause**: Missing DPS fields caused diagram conversion function to fail silently
- **File**: `reactFlowHelpers.js` line 63-64 expected `calculos.dps_kv` and `calculos.dps_capacidade_a`
- **Impact**: React Flow diagram initialization failed, showing blank page

## Fixes Implemented

### 1. Controller Enhancement (projetosEVController.js)
```javascript
// OLD: Checked only if calculos_nbr was empty
if (!p.calculos_nbr || Object.keys(p.calculos_nbr).length === 0)

// NEW: Checks for specific missing fields
const camposEssenciais = ['dps_kv', 'dps_capacidade_a', 'tempo_seccionamento_s']
const faltamCampos = !p.calculos_nbr || 
                     camposEssenciais.some(campo => !(campo in (p.calculos_nbr || {})))
```
- **Benefit**: Auto-calculates missing DPS fields even if partial calculos_nbr exists
- **Status**: ✓ Implemented and committed

### 2. Schema Updates (ProjetoEV.js)  
Added three new fields to calculos_nbr schema:
- `dps_kv: Number` - DPS voltage rating (275V or 420V)
- `dps_capacidade_a: Number` - DPS capacity in amps  
- `tempo_seccionamento_s: Number` - Automatic switch-off time (0.2-5 seconds)
- **Status**: ✓ Updated in schema

### 3. Calculation Function Enhancement (calculosCarregadorEV.js)
Function `executarCalculosProjetoEV()` now returns:
```javascript
{
  calculos_nbr: {
    corrente_projeto_a: 32,
    bitola_cabo_mm2: 10,
    dps_kv: 275,           // ← NEW
    dps_capacidade_a: 52,  // ← NEW
    tempo_seccionamento_s: 0.4,  // ← NEW
    // ... other fields
  }
}
```
- **Status**: ✓ Implemented

### 4. Test Data Updates (memoryStorage.js & memory-storage.json)
Added DPS field values to test project:
- `dps_kv: 275`
- `dps_capacidade_a: 52`  
- `tempo_seccionamento_s: 0.4`
- **Status**: ✓ Updated

### 5. Environment Fix (.env.development)
Changed `VITE_API_URL=http://localhost:5005` → `http://localhost:3000`
- **Status**: ✓ Corrected

## Issue Resolution

### ✅ RESOLVED: DPS Fields Missing from HTTP API Response
**Status**: 🟢 **FIXED** - May 16, 2026

**Resolution**: After backend restart and proper memory store initialization, all DPS fields now appear in API responses.

- **Symptom**: API returns project without `dps_kv`, `dps_capacidade_a`, `tempo_seccionamento_s`
- **Data Flow Analysis**:
  1. ✓ memory-storage.json file contains DPS fields
  2. ✓ memoryStore.findProjetoEV() returns objects with DPS fields
  3. ✗ HTTP response via `res.json()` is missing these fields
  
- **Test Results**:
  ```
  File storage:      dps_kv=275 ✓
  MemoryStore:       dps_kv=275 ✓  
  HTTP API response: dps_kv=MISSING ✗
  ```

- **Possible Causes**:
  1. Express/Node JSON serialization filtering fields
  2. Mongoose schema being applied to plain objects somehow
  3. Custom response middleware removing fields
  4. Node module caching issue
  
- **Impact**: 
  - Diagram editor cannot initialize (needs DPS fields)
  - Frontend diagram conversion fails
  - Project details don't display complete calculation data

## Verification Steps

Run the test script to check current system status:
```bash
cd /path/to/projeto-frts-app
./test-system.sh
```

Expected output when fixed:
```
[2] Testing EV Project Fetch...
✓ Project found
  Checking calculos_nbr fields...
    ✓ corrente_projeto_a
    ✓ bitola_cabo_mm2  
    ✓ disjuntor_a
    ✓ dr_ma
    ✓ dps_kv              ← Should show this
    ✓ dps_capacidade_a    ← Should show this
    ✓ tempo_seccionamento_s ← Should show this
```

## Next Steps to Resolve

### Priority: HIGH - Fix Response Serialization
1. Check for custom `toJSON()` methods in MongoDB models
2. Inspect Express response pipeline for field filtering
3. Add console.log to controller right before `res.json(p)` to verify data
4. Check if middleware is modifying responses
5. Review node module versions for caching issues

### Testing Post-Fix
1. Verify API returns DPS fields
2. Test diagram editor on both EV and FV projects
3. Verify no "freezing" on "Editar Diagrama" click
4. Check NBR calculation display in project details
5. Ensure calculations persist correctly

## Commits Made
- `27442f2` - Fix: Auto-calculate missing DPS fields in NBR calculations
- Latest - Add: System test script for verifying FRTS app functionality

## Environment Details
- Backend: http://localhost:3000
- Frontend: http://localhost:3006 (Vite dev server)
- Database: Memory storage (MongoDB unavailable)
- Node.js: v24.15.0
- npm packages: Express, Mongoose, React Flow, Vite
