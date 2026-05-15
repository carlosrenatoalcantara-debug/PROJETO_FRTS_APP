# FRTS APP - BUG TRACKER & RESOLUTION GUIDE

## Critical Blocking Issue

### Issue #1: HTTP Response Missing DPS Fields
**Status**: 🔴 **BLOCKING** - Prevents diagram editor from initializing  
**Severity**: CRITICAL  
**Reported**: 2026-05-15  
**Components**: Backend API, Express response serialization

---

## Problem Description

### Symptoms
- Diagram editor displays blank white page (freezing effect)
- Frontend cannot render diagram because required fields are undefined
- Project calculations display incomplete (missing DPS information)

### Evidence & Test Results

**Data Pipeline Analysis**:

| Stage | DPS Fields Present | Status |
|-------|-------------------|--------|
| memory-storage.json file | ✓ YES | Verified |
| memoryStore object | ✓ YES | Verified |
| Controller variable `p` | ? UNKNOWN | Not tested |
| HTTP `res.json()` output | ✗ NO | **CONFIRMED MISSING** |

**Test Results** (May 15, 2026):
```bash
$ ./test-system.sh

[2] Testing EV Project Fetch...
✓ Project found
  Checking calculos_nbr fields...
    ✓ corrente_projeto_a
    ✓ bitola_cabo_mm2
    ✓ disjuntor_a
    ✓ dr_ma
    ✗ dps_kv (MISSING)
    ✗ dps_capacidade_a (MISSING)
    ✗ tempo_seccionamento_s (MISSING)
```

### Affected Fields
1. `calculos_nbr.dps_kv` - DPS voltage rating (should be 275 or 420)
2. `calculos_nbr.dps_capacidade_a` - DPS capacity in amps (should be 52)
3. `calculos_nbr.tempo_seccionamento_s` - Auto switch-off time in seconds (should be 0.4)

### Impact Chain
```
Missing DPS fields in API response
    ↓
Frontend InteractiveDiagram.jsx gets undefined values
    ↓
reactFlowHelpers.converterCalculosParaNodesEdges() fails silently
    ↓
React Flow cannot initialize nodes for diagram editor
    ↓
Diagram renders as blank white page
    ↓
User sees "freezing" effect when clicking "Editar Diagrama"
```

---

## Root Cause Analysis

### What We Know
1. **Source code is correct**: memoryStorage.js lines 123-125 define DPS fields
2. **Data file is correct**: memory-storage.json contains DPS values
3. **In-memory object is correct**: `memoryStore.findProjetoEV()` returns objects with DPS fields
4. **HTTP response is WRONG**: API response from `res.json(p)` doesn't include these fields

### Hypothesis
Something in the Express response pipeline is **filtering out fields with underscores or specific field names**.

Possible causes (in priority order):
1. **Mongoose schema validation** - Even though using memory storage, Mongoose model might be applied
2. **Custom JSON replacer** - Express or middleware using `JSON.stringify(obj, replacer)` that filters fields
3. **Mongoose `toJSON()` method** - Model might have toJSON method that removes certain fields
4. **Response middleware** - Custom middleware modifying response before sending
5. **Node.js/Express version issue** - Version-specific behavior filtering fields

---

## Investigation Checklist

### ✓ Already Checked
- [x] Memory storage file contains DPS fields
- [x] memoryStore returns objects with DPS fields  
- [x] Backend has correct source code with DPS fields
- [x] Test data in memory-storage.js includes DPS values
- [x] No obvious toJSON methods in models
- [x] No custom JSON replacer in error handler

### ⏳ Still Need to Check
- [ ] ProjetoEV Mongoose schema for `select: false` on any fields
- [ ] All middleware in src/middleware/ directory
- [ ] Express configuration in src/server.js for JSON handling
- [ ] Any `JSON.stringify()` calls with custom replacers
- [ ] Response interceptors or wrappers around `res.json()`
- [ ] Mongoose instance methods on memory storage objects
- [ ] Express.json() config that might filter fields
- [ ] Whether res.json() is being overridden anywhere
- [ ] Backend logs showing what the controller is sending

---

## Resolution Steps

### Step 1: Enable Debug Logging
Add logging to controller right before response:

```javascript
export const buscarProjetoEV = async (req, res) => {
  // ... existing code ...
  
  // DEBUG: Log exact data before response
  const beforeJSON = JSON.stringify(p.calculos_nbr || {});
  console.log('BEFORE res.json:', beforeJSON);
  console.log('Has dps_kv?', beforeJSON.includes('dps_kv'));
  
  res.json(p);  // This is where fields disappear
}
```

**Expected output**: Should show `"dps_kv":275` in the logged string.

### Step 2: Check Response Handling
Add middleware to capture actual response:

```javascript
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    console.log('RESPONSE SENT:', JSON.stringify(data.calculos_nbr || {}).slice(0, 100));
    return originalJson(data);
  };
  next();
});
```

**Expected output**: Should show actual JSON being sent to client.

### Step 3: Search for Field Filtering
```bash
grep -r "select\|toJSON\|JSON.stringify.*replacer" backend/src/
grep -r "dps" backend/src/models/
grep -r "field.*filter\|omit\|exclude" backend/src/
```

### Step 4: Check Mongoose Model Options
Verify ProjetoEV schema doesn't have `select: false`:

```javascript
// In ProjetoEV.js - schema should be like:
const schema = new mongoose.Schema({
  calculos_nbr: {
    dps_kv: Number,        // ← Should NOT have select: false
    dps_capacidade_a: Number,
    // ... other fields
  }
});

// NOT like this (which hides the field):
dps_kv: { type: Number, select: false },
```

### Step 5: Verify Memory Store Returns Complete Objects
```bash
node -e "
const {memoryStore} = require('./src/config/memoryStorage.js');
const p = memoryStore.findProjetoEV('proj-ev-teste-1');
console.log(Object.keys(p.calculos_nbr));
// Should include: dps_kv, dps_capacidade_a, tempo_seccionamento_s
"
```

---

## Quick Fix (If Found)

Once the field-filtering source is identified, common fixes:

### Fix #1: Remove select: false
```javascript
// Change this:
dps_kv: { type: Number, select: false }

// To this:
dps_kv: Number
```

### Fix #2: Add fields to toJSON replacer
```javascript
res.json = (data) => {
  const json = {
    ...data,
    calculos_nbr: {
      ...data.calculos_nbr,
      dps_kv: data.calculos_nbr.dps_kv,
      dps_capacidade_a: data.calculos_nbr.dps_capacidade_a,
      tempo_seccionamento_s: data.calculos_nbr.tempo_seccionamento_s
    }
  };
  return res.json(json);
};
```

### Fix #3: Configure Express JSON properly
```javascript
app.use(express.json({
  replacer: null,  // Don't filter fields
  space: null      // Normal formatting
}));
```

---

## Testing Confirmation

After fix, verify with:

```bash
./test-system.sh

# Expected output:
# ✓ dps_kv
# ✓ dps_capacidade_a  
# ✓ tempo_seccionamento_s
```

Then test diagram editor:
1. Go to frontend http://localhost:3006
2. Navigate to project "Casa João Silva - Carregador EV"
3. Click "Editar Diagrama" button
4. Should see diagram with drag-able blocks (not blank page)

---

## Related Files

**Backend Controllers**:
- `src/controllers/projetosEVController.js` (lines 34-75) - buscarProjetoEV function

**Models**:
- `src/models/ProjetoEV.js` - Schema definition for calculations

**Storage**:
- `src/config/memoryStorage.js` - Lines 123-125 have DPS test data
- `data/memory-storage.json` - Actual data file with DPS values

**Frontend**:
- `src/components/diagram/utils/reactFlowHelpers.js` (line 63-64) - Expects DPS fields

**Middleware/Config**:
- `src/server.js` - Express configuration
- `src/middleware/` - Any response middleware

---

## Notes for Development

- Multiple node processes may be running - ensure clean restart
- Backend uses --watch mode which auto-restarts on file changes
- Frontend on port 3006, Backend on port 3000
- In-memory storage auto-saves to `backend/data/memory-storage.json`
- MongoDB connection unavailable - system runs entirely in-memory

---

## Status Timeline

- **2026-05-13**: Initial bug report - diagram editor freezing
- **2026-05-15 14:30**: Root cause identified - missing DPS fields in API response
- **2026-05-15 16:45**: Data pipeline verified - fields exist in storage but not in HTTP response
- **2026-05-15 17:00**: Investigation ongoing - response serialization issue suspected
- **PENDING**: Resolution - Awaiting identification of field-filtering source

