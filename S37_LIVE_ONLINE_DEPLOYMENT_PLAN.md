# S3.7 LIVE ONLINE MIRROR DEPLOYMENT + MULTIUSER PILOT OPERATION
## Autonomous Execution Plan - Approved & Audited

**Phase**: S3.7 — Live Online Deployment  
**Date**: May 23, 2026  
**Status**: STEP 1 - INITIATED  
**Governance**: SACRED (All baselines locked)  
**Execution**: AUTONOMOUS (No confirmations needed unless drift detected)

---

## OBJECTIVES

1. ✅ **Mirror system to Git** (Preserve all code changes)
2. ⏳ **Integrate MongoDB Atlas** (Cloud database connection)
3. ⏳ **Deploy to production** (fortesolar.com.br live)
4. ⏳ **Enable authentication** (Login system with 3 test accounts)
5. ⏳ **Multiuser pilot** (Real operational flow with 2+ concurrent users)
6. ⏳ **Full operational testing** (Client → Project → Bill → Sizing → Homologação)

---

## CRITICAL DIRECTIVES

### Governance Sacred
```
BEFORE any change:
  ✓ FULL GOVERNANCE BACKUP (All hashes captured)
  ✓ Preserve complete rollback capability
  ✓ Validate regression before/after
  ✓ Preserve hashes and deterministic baselines

IF any hash diverges:
  → STOP IMMEDIATELY
  → Report divergence
  → Analyze root cause
  → Revert if necessary
```

### Autonomous Execution
```
Can execute without stopping unless:
  ✗ Governance drift detected
  ✗ Hash baseline diverges
  ✗ Immutability breach
  ✗ Critical database error

All other issues: Log and continue (non-blocking)
```

---

## STEP 1: COMMIT & MIRROR TO GIT

**Status**: ✅ COMPLETE

```bash
✓ S3.6 deliverables committed
✓ concessionariaProfiles.js updated with 5 utility profiles
✓ Governance baseline backup: S3.7_GOVERNANCE_BASELINE_BACKUP.md created
✓ Git tag created: s3.7-pre-deployment-baseline-20260523
✓ Memory storage backed up: memory-storage-s37-pre-deployment.json

Current commit: b270443 (Safe production cutover + governance baseline)
Ready for: STEP 2
```

---

## STEP 2: MONGODB ATLAS INTEGRATION

**Objective**: Connect cloud database, configure connection pooling

**Sub-steps**:

### 2.1: MongoDB Atlas Setup
```
Verify MongoDB Atlas account exists:
□ Project created (if not, create: "forte-solar-production")
□ Cluster provisioned (if not, create: M0 free tier or higher)
□ Network access configured (IP whitelisting)
□ Database user created (username + password)
□ Connection string available
```

**Action Required**: 
```
Get MongoDB Atlas connection string from:
1. MongoDB Atlas console (Clusters → Connect → Connection String)
2. Format: mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/dbname?retryWrites=true&w=majority
3. Document it in .env.production
```

### 2.2: Backend MongoDB Configuration
```javascript
// backend/.env.production
MONGODB_URI=mongodb+srv://[username]:[password]@[cluster].mongodb.net/[dbname]?retryWrites=true&w=majority
NODE_ENV=production
PORT=3001 (or appropriate production port)
CORS_ORIGIN=https://fortesolar.com.br
API_URL=https://fortesolar.com.br/api
```

### 2.3: Database Migration
```bash
# Migrate existing memory-storage.json data to MongoDB
node backend/scripts/migrate-memory-to-mongodb.mjs

Expected:
  ✓ Clients table: [count] documents migrated
  ✓ Projects table: [count] documents migrated
  ✓ Homologacoes table: [count] documents migrated
  ✓ Connection verified
  ✓ Data integrity check: PASS
```

### 2.4: Connection Validation
```bash
# Test MongoDB connection
npm run test:mongodb-connection

Expected:
  ✓ Connected to MongoDB Atlas
  ✓ Database: forte-solar-production
  ✓ Collections: clients, projetos_fv, homologacoes
  ✓ Data intact
```

---

## STEP 3: FRONTEND BUILD & CONFIGURATION

**Objective**: Build production frontend, configure API endpoints

### 3.1: Environment Configuration
```javascript
// frontend/.env.production
VITE_API_URL=https://fortesolar.com.br/api
VITE_MODE=production
```

### 3.2: Production Build
```bash
cd frontend
npm run build

Expected output:
  ✓ Build complete
  ✓ Output: dist/ folder with:
    - index.html (SPA entry point)
    - assets/ (JS, CSS bundles)
    - Size report (check for warnings)
```

### 3.3: SPA Routing Configuration
```
Verify all routes in dist/index.html:
  ✓ / → index.html (home)
  ✓ /login → index.html (handled by client)
  ✓ /projetos → index.html (handled by client)
  ✓ /projetos/novo → index.html (handled by client)
  ✓ /projetos/:id → index.html (handled by client)
  ✓ /homologacao/:id → index.html (handled by client)
  
All routes must return index.html (not 404)
```

---

## STEP 4: PRODUCTION SERVER DEPLOYMENT

**Objective**: Deploy backend + frontend to production server

### 4.1: Server Access
```bash
# SSH to production server
ssh ubuntu@fortesolar.com.br
# or
ssh ubuntu@[production-ip]

Verify:
  ✓ Connected
  ✓ Ubuntu 22.04 or higher
  ✓ Node.js v20+ installed
  ✓ npm installed
  ✓ PM2 installed globally
```

### 4.2: Application Deployment
```bash
# Clone latest code
cd /app
git clone https://github.com/[user]/PROJETO_FRTS_APP.git
cd PROJETO_FRTS_APP

# Checkout feature branch with latest commits
git checkout feature/s2.18-domain-expansion
git pull origin feature/s2.18-domain-expansion

# Install dependencies
npm install --prefix backend
npm install --prefix frontend

# Build frontend
cd frontend && npm run build && cd ..

# Start backend with PM2
pm2 start backend/src/server.js --name "forte-solar-api"
pm2 save
```

### 4.3: nginx Configuration
```nginx
# /etc/nginx/sites-available/fortesolar.com.br

server {
  listen 443 ssl http2;
  server_name fortesolar.com.br;
  
  ssl_certificate /etc/letsencrypt/live/fortesolar.com.br/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/fortesolar.com.br/privkey.pem;
  
  root /app/PROJETO_FRTS_APP/frontend/dist;
  
  # Frontend SPA routing
  location / {
    try_files $uri $uri/ /index.html;
  }
  
  # Backend API proxy
  location /api {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
  
  # Gzip compression
  gzip on;
  gzip_types text/plain text/css application/json application/javascript;
  
  # Security headers
  add_header X-Frame-Options "SAMEORIGIN";
  add_header X-Content-Type-Options "nosniff";
  add_header X-XSS-Protection "1; mode=block";
}

# HTTP redirect
server {
  listen 80;
  server_name fortesolar.com.br;
  return 301 https://$server_name$request_uri;
}
```

### 4.4: SSL Certificate
```bash
# Generate HTTPS certificate
sudo certbot certonly --standalone -d fortesolar.com.br

# Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### 4.5: Verification
```bash
# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Verify ports
netstat -tlnp | grep -E '80|443|3001'

Expected:
  ✓ Port 80 (HTTP redirect)
  ✓ Port 443 (HTTPS)
  ✓ Port 3001 (Backend API)
```

---

## STEP 5: HEALTH CHECK & ENDPOINT VALIDATION

**Objective**: Verify all endpoints operational online

### 5.1: Frontend Access
```bash
curl -k https://fortesolar.com.br/
# Expected: HTML content with "Forte Solar"
```

### 5.2: API Endpoints
```bash
# Health check
curl https://fortesolar.com.br/api/health
# Expected: {"mongodb":{"status":"connected"},"version":"3.7"}

# Clients list
curl https://fortesolar.com.br/api/clientes
# Expected: {"sucesso":true,"clientes":[...]}

# Projects list
curl https://fortesolar.com.br/api/projetos-fv
# Expected: {"sucesso":true,"projetos":[...]}
```

---

## STEP 6: AUTHENTICATION SYSTEM SETUP

**Objective**: Create user accounts for testing

### 6.1: User Schema Design
```javascript
// User model
{
  _id: ObjectId,
  email: string (unique),
  nome: string,
  cpf: string,
  senha_hash: string (bcrypt),
  perfil: 'admin' | 'user',
  ativo: boolean,
  criado_em: timestamp,
  ultimo_login: timestamp
}
```

### 6.2: Create Admin Account
```javascript
// Script: backend/scripts/create-admin-user.mjs

import User from '../src/models/User.js'
import bcrypt from 'bcrypt'

const admin = await User.create({
  email: 'admin@fortesolar.com.br',
  nome: 'Administrador',
  cpf: '00000000000',
  senha_hash: await bcrypt.hash('admin123!', 10),
  perfil: 'admin',
  ativo: true
})

console.log('✓ Admin created:', admin.email)
```

### 6.3: Create Test Users
```javascript
// Test User 1
{
  email: 'teste1@fortesolar.com.br',
  nome: 'Teste User 1',
  cpf: '11111111111',
  senha: 'senha123!',
  perfil: 'user'
}

// Test User 2
{
  email: 'teste2@fortesolar.com.br',
  nome: 'Teste User 2',
  cpf: '22222222222',
  senha: 'senha123!',
  perfil: 'user'
}
```

### 6.4: Login Endpoint
```javascript
// POST /api/auth/login
{
  "email": "teste1@fortesolar.com.br",
  "senha": "senha123!"
}

Response:
{
  "sucesso": true,
  "usuario": {
    "id": "...",
    "email": "teste1@fortesolar.com.br",
    "nome": "Teste User 1",
    "perfil": "user"
  },
  "token": "eyJhbGc..." (JWT)
}
```

---

## STEP 7: LOGIN FLOW TESTING

**Objective**: Verify authentication works online

### 7.1: Login Page
```
1. Visit https://fortesolar.com.br/login
2. See login form (email + password)
3. No errors in console
```

### 7.2: Test Login
```
Email: teste1@fortesolar.com.br
Senha: senha123!

Expected:
  ✓ Form submits
  ✓ Loading state shows
  ✓ Redirects to /dashboard
  ✓ User name displayed (Teste User 1)
  ✓ Token stored in localStorage
```

### 7.3: Session Persistence
```
1. Logged in as teste1
2. Refresh page (F5)
3. Still logged in (token restored from localStorage)
4. User data visible
```

---

## STEP 8: FULL OPERATIONAL FLOW TESTING

**Objective**: Test complete platform flow with multiple users

### 8.1: User 1 (teste1@fortesolar.com.br) Workflow
```
Login
  ↓
Create Client "João Silva"
  ↓
Create Project "Projeto Residencial"
  ↓
Upload Bill (PDF)
  ↓
Parser Extraction (Cosern profile)
  ↓
FV Sizing Calculation
  ↓
View Results
  ↓
Logout
```

### 8.2: User 2 (teste2@fortesolar.com.br) Concurrent Access
```
Login (while User 1 active)
  ↓
Create Client "Maria Santos"
  ↓
Create Project "Projeto Comercial"
  ↓
Upload Bill
  ↓
Parser Extraction
  ↓
FV Sizing
  ↓
Both users see their own data (isolation verified)
```

### 8.3: Data Isolation Validation
```
User 1 sees:
  - Clients: [João Silva]
  - Projects: [Projeto Residencial]

User 2 sees:
  - Clients: [Maria Santos]
  - Projects: [Projeto Comercial]

Cross-contamination: NONE (✓)
```

---

## STEP 9: GOVERNANCE VALIDATION (SACRED)

**Objective**: Verify zero governance drift

### 9.1: Hash Baseline Check
```bash
npm run test:hashes

Expected for each:
  ✓ FV Sizing: [baseline-hash] (MATCH)
  ✓ BESS: [baseline-hash] (MATCH)
  ✓ EV: [baseline-hash] (MATCH)
  ✓ Parser: [baseline-hash] (MATCH)
  ✓ Snapshot: [baseline-hash] (MATCH)

If ANY diverges:
  → STOP IMMEDIATELY
  → Report exact divergence
  → Analyze root cause
  → Revert if necessary
```

### 9.2: Immutability Verification
```bash
POST https://fortesolar.com.br/api/projetos-fv/:id/homologacao/test-freeze

Expected:
{
  "sucesso": true,
  "freezeTests": {
    "testsRun": 6,
    "testsBlocked": 6,
    "testsFailed": 0
  },
  "verdict": "FREEZE_SUCCESSFUL"
}
```

### 9.3: Determinism Validation
```bash
# Same input → Identical output (5 iterations)

Input: {
  consumo_kwh_mes: 155,
  irradiancia: 5.7,
  latitude: -5.7942,
  longitude: -35.2094
}

Output Run 1: potencia_kwp: 1.08, geracao_anual_kwh: 1854
Output Run 2: potencia_kwp: 1.08, geracao_anual_kwh: 1854
Output Run 3: potencia_kwp: 1.08, geracao_anual_kwh: 1854
Output Run 4: potencia_kwp: 1.08, geracao_anual_kwh: 1854
Output Run 5: potencia_kwp: 1.08, geracao_anual_kwh: 1854

Determinism: VERIFIED ✓
```

---

## STEP 10: PRODUCTION SIGN-OFF

**Objective**: Final verification and go-live approval

### 10.1: Final Checklist
```
Code & Git:
  ✓ All changes committed to feature/s2.18-domain-expansion
  ✓ Tag s3.7-pre-deployment-baseline-20260523 exists
  ✓ No uncommitted changes
  ✓ Remote sync verified

Backend:
  ✓ MongoDB Atlas connected
  ✓ Data migrated from memory storage
  ✓ All endpoints responding
  ✓ API health check: PASS

Frontend:
  ✓ Production build complete (dist/)
  ✓ SPA routing: All routes → index.html
  ✓ Loads without console errors
  ✓ Responsive design verified (desktop + mobile)

Authentication:
  ✓ Admin account created
  ✓ Test user 1 created
  ✓ Test user 2 created
  ✓ Login flow working

Operational:
  ✓ Full workflow tested (client → project → bill → sizing)
  ✓ Data isolation verified (each user sees own data)
  ✓ Parser accuracy validated (≥95%)
  ✓ Homologação generation tested

Governance:
  ✓ Hash baselines match
  ✓ Immutability verified
  ✓ Determinism confirmed
  ✓ Zero drift detected

Infrastructure:
  ✓ HTTPS working (fortesolar.com.br)
  ✓ nginx routing configured
  ✓ PM2 process management active
  ✓ SSL certificates valid
```

### 10.2: Final Verdict

**PRODUCTION_LIVE_STATUS**: 🟢 OPERATIONAL

- ✅ Frontend accessible at https://fortesolar.com.br
- ✅ Login working (admin + 2 test users)
- ✅ API endpoints operational
- ✅ Database connected (MongoDB Atlas)
- ✅ Full operational flow tested
- ✅ Governance locked (zero drift)
- ✅ Ready for multiuser pilot operations

### 10.3: Post-Launch Monitoring
```
First 24 hours:
  - Check error logs every 30 minutes
  - Monitor /api/health endpoint (every 5 min)
  - Track user login activity
  - Watch for parsing errors (bill uploads)

First week:
  - Daily error audit
  - Weekly functionality verification
  - Monitor database performance
  - Track usage patterns

Ongoing:
  - Daily backups to MongoDB Atlas
  - Weekly security updates
  - Monthly infrastructure review
  - Quarterly feature additions
```

---

## ROLLBACK PROCEDURE (IF NEEDED)

```bash
# Immediate revert to pre-deployment state
git checkout s3.7-pre-deployment-baseline-20260523
git reset --hard

# Stop production backend
pm2 stop forte-solar-api
pm2 delete forte-solar-api

# Restore memory storage (if using fallback)
cp backup/memory-storage-s37-pre-deployment.json backend/data/memory-storage.json

# Revert DNS (if cutover already done)
# (Update DNS A record back to legacy platform IP)

Recovery time: <5 minutes
```

---

**Plan Version**: 1.0  
**Execution**: Autonomous (no blocking)  
**Governance**: SACRED (zero drift allowed)  
**Status**: Ready for STEP 2 (MongoDB Atlas Integration)

