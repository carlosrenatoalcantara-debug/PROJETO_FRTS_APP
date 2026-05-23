# S3.6 DEPLOYMENT & VALIDATION PLAN
## Safe Production Cutover + Knowledge Preservation

**Status**: READY FOR EXECUTION  
**Target**: Production readiness verdict within 7 days  
**Governance**: Sacred (hash validation on every milestone)

---

## INFRASTRUCTURE REQUIREMENTS

### Staging Environment (Required)
- **Hostname**: staging.fortesolar.com.br (or internal IP:5003)
- **OS**: Ubuntu Server 22.04 LTS
- **Node.js**: v20.x LTS
- **Memory**: 2GB RAM minimum
- **Storage**: 20GB SSD
- **Database**: Memory storage (fallback) OR MongoDB Atlas
- **SSL**: HTTPS enabled via Let's Encrypt/certbot
- **Process Manager**: PM2 (auto-restart, logging)
- **Reverse Proxy**: nginx (routing, SSL termination)

### Production Environment (Post-validation)
- **Hostname**: fortesolar.com.br
- **OS**: Ubuntu Server 22.04 LTS
- **Node.js**: v20.x LTS
- **Memory**: 4GB RAM minimum
- **Storage**: 50GB SSD
- **Database**: MongoDB Atlas (primary) + memory-storage.json (fallback)
- **Backups**: Daily automated snapshots
- **CDN**: (optional) CloudFlare or AWS CloudFront
- **Monitoring**: Sentry, NewRelic, or similar
- **Logging**: Centralized logging (ELK stack or equivalent)

---

## DEPLOYMENT CHECKLIST

### Phase 1: Pre-Deployment (Days 1-2)

- [ ] **1.1 Infrastructure provisioning**
  - [ ] Staging server provisioned (VPS provider)
  - [ ] Production server provisioned (VPS provider)
  - [ ] SSH access configured
  - [ ] Security groups configured
  - [ ] IP whitelisting configured

- [ ] **1.2 Domain & DNS**
  - [ ] staging.fortesolar.com.br DNS A record configured
  - [ ] Production fortesolar.com.br DNS configured (currently pointing to legacy)
  - [ ] DNS TTL lowered to 300s (for faster cutover)

- [ ] **1.3 SSL Certificates**
  - [ ] Staging: certbot HTTPS certificate for staging.fortesolar.com.br
  - [ ] Production: certbot HTTPS certificate for fortesolar.com.br
  - [ ] Auto-renewal configured

- [ ] **1.4 Dependencies Installation**
  - [ ] Ubuntu system updates: `sudo apt update && sudo apt upgrade`
  - [ ] Node.js LTS installed: `sudo apt install nodejs npm`
  - [ ] PM2 installed globally: `npm install -g pm2`
  - [ ] nginx installed: `sudo apt install nginx`
  - [ ] certbot installed: `sudo apt install certbot python3-certbot-nginx`

- [ ] **1.5 Repository Setup**
  - [ ] Git cloned: `git clone <repo> /app/forte-solar`
  - [ ] Dependencies installed: `npm install` (both backend + frontend)
  - [ ] Legacy backup branch: `git checkout legacy-backup-s36-20260523`

### Phase 2: Staging Deployment (Days 2-3)

- [ ] **2.1 Backend Configuration**
  ```bash
  # Copy environment template
  cp backend/.env.example backend/.env.staging
  
  # Edit with staging values
  nano backend/.env.staging
  # KEY VALUES:
  # NODE_ENV=staging
  # MONGODB_URI=mongodb+srv://... (if available) OR memory fallback
  # PORT=5003
  # API_URL=https://staging.fortesolar.com.br/api
  # CORS_ORIGIN=https://staging.fortesolar.com.br
  ```

- [ ] **2.2 Frontend Build & Configuration**
  ```bash
  # Build with staging API endpoint
  cd frontend
  VITE_API_URL=https://staging.fortesolar.com.br/api npm run build
  
  # Output: frontend/dist/ with index.html + assets
  # Verify SPA routing: All routes return index.html
  ```

- [ ] **2.3 nginx Configuration**
  ```nginx
  # /etc/nginx/sites-available/staging.fortesolar.com.br
  
  server {
    listen 443 ssl http2;
    server_name staging.fortesolar.com.br;
    
    ssl_certificate /etc/letsencrypt/live/.../fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/.../privkey.pem;
    
    root /app/forte-solar/frontend/dist;
    
    # Frontend SPA routing
    location / {
      try_files $uri $uri/ /index.html;
    }
    
    # Backend API proxy
    location /api {
      proxy_pass http://localhost:5003;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection 'upgrade';
      proxy_set_header Host $host;
      proxy_cache_bypass $http_upgrade;
    }
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json;
  }
  
  # Redirect HTTP → HTTPS
  server {
    listen 80;
    server_name staging.fortesolar.com.br;
    return 301 https://$server_name$request_uri;
  }
  ```

- [ ] **2.4 PM2 Ecosystem Configuration**
  ```javascript
  // /app/forte-solar/ecosystem.config.js
  module.exports = {
    apps: [{
      name: 'forte-solar-backend',
      script: './backend/src/server.js',
      env: {
        NODE_ENV: 'staging',
        PORT: 5003
      },
      instances: 'max',
      exec_mode: 'cluster',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }]
  };
  ```

- [ ] **2.5 Application Startup**
  ```bash
  # Start backend via PM2
  pm2 start ecosystem.config.js
  pm2 save
  sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
  
  # Enable nginx
  sudo systemctl enable nginx
  sudo systemctl reload nginx
  
  # Verify logs
  pm2 logs
  tail -f /var/log/nginx/error.log
  ```

- [ ] **2.6 Health Check**
  ```bash
  # Backend health
  curl -k https://staging.fortesolar.com.br/api/health
  # Expected: {"mongoose":{"connection":{"readyState":0}},"memory_storage_active":true}
  
  # Frontend
  curl -k https://staging.fortesolar.com.br/ | grep -q "Forte Solar" && echo "✓ Frontend OK"
  
  # API endpoint
  curl -k https://staging.fortesolar.com.br/api/clientes | grep -q "sucesso" && echo "✓ API OK"
  ```

### Phase 3: Operational Testing (Days 3-4)

#### 3.1 Complete Operational Flow (CRITICAL)

**Login/Authentication**
```
→ User clicks "Criar Projeto"
→ Frontend loads project wizard
→ State persists in memory
```

**Client Creation**
```
POST /api/clientes
Body: {
  nome: "João Silva",
  cpf_cnpj: "12345678900",
  email: "joao@example.com",
  telefone: "(84) 98765-4321",
  endereco: "Rua A, 123",
  cidade: "Natal",
  estado: "RN"
}
Response: {"sucesso": true, "cliente": {...}, "id": "cliente-xyz"}
```

**Project Creation**
```
POST /api/projetos-fv
Body: {
  clienteId: "cliente-xyz",
  nome: "Projeto Residencial Natal",
  endereco: "Rua A, 123",
  estado: "RN",
  concessionaria: "Cosern"
}
Response: {"sucesso": true, "projetoId": "proj-fv-1", "status": "rascunho"}
```

**Bill Upload & Parsing**
```
POST /api/bills/upload
Body: FormData { file: <PDF BINARY> }
Expected:
- PDF text extraction ✓
- Field regex matching (Cosern profile) ✓
- 12-position array imputation ✓
- consumo_12_meses populated ✓
- dados_estimados flag set ✓
Response: {"sucesso": true, "fatura": {...}, "confianca_extracao": 95}
```

**FV Sizing Calculation**
```
POST /api/engenharia/fv
Body: {
  consumo_kwh_mes: 155,
  irradiancia_kwh_m2_dia: 5.7,
  latitude: -5.7942,
  longitude: -35.2094
}
Expected:
- potencia_kwp calculated ✓
- num_paineis estimated ✓
- num_strings configured ✓
- geracao_anual_kwh projected ✓
- irr, vpl, payback calculated ✓
Response: {
  "potencia_kwp": 1.08,
  "geracao_anual_kwh": 1854,
  "num_paineis": 2,
  "irr": 30.2,
  "payback_anos": 4.2,
  "vpl_25anos": 45000
}
```

**Engineering Freeze**
```
POST /api/projetos-fv/:id/homologacao/test-freeze
Body: {
  cliente: {...},
  unidade: {...},
  consumo: {...},
  projeto: {...},
  concessionariaProfile: {...}
}
Expected:
- DTO creation ✓
- Deep freeze applied ✓
- 6 immutability attacks all blocked ✓
- Data integrity verified ✓
Response: {
  "sucesso": true,
  "homologacaoDTO": {...frozen...},
  "freezeTests": {
    "testsRun": 6,
    "testsBlocked": 6,
    "testsFailed": 0
  },
  "verdict": "FREEZE_SUCCESSFUL"
}
```

**Homologação Package Generation**
```
POST /api/projetos-fv/:id/homologacao/memorial
Expected: 11-section memorial descritivo generated ✓

POST /api/projetos-fv/:id/homologacao/carta
Expected: Utility letter generated ✓
```

**Persistence Validation**
```
1. Create project with full data
2. Restart backend: pm2 restart
3. Query project: GET /api/projetos-fv/:id
4. Verify all data persists ✓
```

#### 3.2 Governance Validation (SACRED)

```bash
# FV Sizing Hash Validation
node -e "
  const sizing = require('./backend/src/services/fvSizingService.js');
  const result = sizing.calcularDimensionamento({...});
  const hash = crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex');
  console.log('FV Hash:', hash);
"

# Compare against S3.4 baseline
# Expected: IDENTICAL (zero drift)
# If differs: STOP, investigate immediately
```

#### 3.3 Parser Accuracy Validation

- [ ] Test with 5 real Cosern bills (different customer types)
- [ ] Verify UC code extraction accuracy: 100%
- [ ] Verify consumption array completeness: 100%
- [ ] Verify confidence scores: ≥90%
- [ ] Log sample extractions for audit

#### 3.4 User Flow Validation

- [ ] Test on desktop Chrome/Firefox/Safari
- [ ] Test on mobile (iOS Safari, Android Chrome)
- [ ] Test slow network (throttle to 3G)
- [ ] Verify SPA routing (client-side navigation)
- [ ] Verify form validation and error handling

### Phase 4: Governance Protection (Days 4-5)

- [ ] **4.1 Regression Hash Suite**
  ```bash
  # Run baseline hash comparison
  npm run test:hashes
  
  # Expected output:
  # ✓ FV Sizing Hash: <baseline-hash> (MATCH)
  # ✓ BESS Hash: <baseline-hash> (MATCH)
  # ✓ EV Hash: <baseline-hash> (MATCH)
  # ✓ Parser Normalization Hash: <baseline-hash> (MATCH)
  # ✓ Snapshot Serializer Hash: <baseline-hash> (MATCH)
  
  # If ANY drift detected:
  # → STOP deployment
  # → Investigate root cause
  # → Fix and re-test
  ```

- [ ] **4.2 Immutability Verification**
  - [ ] All DTO freeze tests pass ✓
  - [ ] All mutation attempts blocked ✓
  - [ ] Error messages consistent ✓

- [ ] **4.3 Determinism Validation**
  - [ ] Same input → identical output (10 iterations) ✓
  - [ ] No temporal dependencies ✓
  - [ ] No randomness in calculations ✓

### Phase 5: Safe Production Cutover (Day 5-6)

#### 5.1 Pre-Cutover Notification
```
1. Notify users: "System upgrade scheduled for <DATE> <TIME>"
2. Maintenance window: 2-3 hours
3. Expected downtime: 30 minutes
4. Fallback: Legacy system available if needed
```

#### 5.2 DNS Cutover Strategy

**Option A: Gradual (Safer)**
```bash
# 1. Lower TTL to 300s (24 hours before)
# 2. Cutover: Change A record from legacy IP to production IP
# 3. Propagation: ~5 minutes for 95% of users
# 4. Monitor: Watch for errors
# 5. Rollback: If issues, revert to legacy IP (instant)
```

**Option B: Parallel (Fastest)**
```bash
# 1. Production: New platform running on public IP
# 2. Staging: Legacy platform on staging.legacy.fortesolar.com.br
# 3. Cut: Update DNS A record instantly
# 4. Rollback: Immediate if needed
```

#### 5.3 Cutover Execution
```bash
# 1. Final health check on staging
curl -k https://staging.fortesolar.com.br/api/health

# 2. Announce maintenance window
# (Send email to registered users)

# 3. Copy production database
cp /backup/memory-storage-20260523.json /production/data/memory-storage.json

# 4. Deploy to production server
# (Same as staging deployment steps)

# 5. Update DNS
# Via hosting provider: Change A record for fortesolar.com.br

# 6. Monitor
# Watch error logs, user reports, metrics

# 7. Verify
curl https://fortesolar.com.br/api/health
curl https://fortesolar.com.br/ | grep "Forte Solar"

# 8. Announce success
# (Send confirmation email)
```

### Phase 6: Post-Cutover Validation (Days 6-7)

- [ ] **6.1 Frontend Validation**
  - [ ] Home page loads ✓
  - [ ] All routes accessible ✓
  - [ ] Wizard loads correctly ✓
  - [ ] Forms submit properly ✓
  - [ ] No broken assets (404s) ✓

- [ ] **6.2 API Validation**
  - [ ] /api/health responsive ✓
  - [ ] /api/clientes endpoints working ✓
  - [ ] /api/projetos-fv CRUD working ✓
  - [ ] /api/bills/upload processing ✓
  - [ ] /api/engenharia/fv calculating ✓
  - [ ] /api/homologacao/* generating ✓

- [ ] **6.3 Business Logic Validation**
  - [ ] Parser extracts correctly ✓
  - [ ] Sizing calculates correctly ✓
  - [ ] Homologação generates correctly ✓
  - [ ] Freezing enforces immutability ✓
  - [ ] Persistence survives restart ✓

- [ ] **6.4 Error Handling Validation**
  - [ ] Invalid uploads handled ✓
  - [ ] Missing fields reported ✓
  - [ ] DB errors caught gracefully ✓
  - [ ] Meaningful error messages ✓

- [ ] **6.5 Performance Validation**
  - [ ] Frontend load time <3s ✓
  - [ ] API response <500ms ✓
  - [ ] Parser processing <5s/page ✓
  - [ ] Sizing calculation <2s ✓

- [ ] **6.6 Security Validation**
  - [ ] HTTPS enforced ✓
  - [ ] CORS properly configured ✓
  - [ ] Sensitive data not exposed ✓
  - [ ] Error messages don't leak info ✓

### Phase 7: Knowledge Migration (Days 7+)

- [ ] **7.1 Utility Profile Library**
  - [ ] neoenergia_cosern (reference) ✓
  - [ ] enel_sp profile ✓
  - [ ] copel_parana profile ✓
  - [ ] cemig_minas profile ✓
  - [ ] energisa_paraiba profile ✓
  - [ ] 22 additional profiles (future roadmap)

- [ ] **7.2 Documentation**
  - [ ] Concessionária onboarding guide
  - [ ] Parser pattern matching rules
  - [ ] Field extraction examples
  - [ ] Regional heuristics library
  - [ ] Homologação requirement mappings

- [ ] **7.3 Legacy Archive**
  - [ ] Read-only legacy codebase available
  - [ ] Historical parser rules documented
  - [ ] Field knowledge base exported
  - [ ] Regional expertise captured

---

## SUCCESS CRITERIA

| Phase | Criteria | Status |
|-------|----------|--------|
| **1** | Infrastructure provisioned | Pending |
| **2** | Staging deployment complete | Pending |
| **3** | Full operational flow tested | Pending |
| **4** | Governance hashes validated | Pending |
| **5** | Production cutover executed | Pending |
| **6** | Post-cutover validation passed | Pending |
| **7** | Knowledge migration complete | Pending |

---

## FINAL VERDICT CRITERIA

**LIVE_IN_PRODUCTION** (Deploy success):
- ✓ All phases 1-6 complete with zero critical issues
- ✓ All governance hashes match baseline
- ✓ Full operational flow tested and verified
- ✓ Parser accuracy ≥95%
- ✓ Zero immutability breaches
- ✓ Performance acceptable
- ✓ User reports zero critical issues (first 48 hours)

**STAGING_VALIDATED** (Staging ready, await go-live):
- ✓ Staging deployment complete
- ✓ Operational flow tested
- ✓ Governance validated
- ✓ Awaiting production cutover decision

**DEPLOYMENT_BLOCKED** (Critical issues found):
- ✗ Governance drift detected
- ✗ Critical security vulnerability
- ✗ Parser accuracy <90%
- ✗ Immutability breach
- ✗ Performance unacceptable

---

**Plan Version**: 1.0  
**Created**: May 23, 2026  
**Target**: June 1, 2026 (Production Live)
