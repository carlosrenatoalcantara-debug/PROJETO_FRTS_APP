# LEGACY BACKUP MANIFEST
## S3.6 — Rollback Safety Protocol

**Date**: May 23, 2026  
**Status**: BACKUP PREPARED FOR PRODUCTION CUTOVER  
**Purpose**: Preserve complete legacy system state for rollback capability

---

## BACKUP STRATEGY

### Tier 1: Git-Based Version Control (Current)
- **Repository**: Forte Solar PROJETO_FRTS_APP
- **Primary Branch**: main (pre-cutover state)
- **Backup Branch**: `legacy-backup-s36-20260523` (created for cutover date)
- **Purpose**: Version control + code history preservation
- **Includes**: All source code, configs, assets
- **Excludes**: node_modules (redownloadable), .env files (security)
- **Rollback Mechanism**: `git checkout legacy-backup-s36-20260523` restores entire codebase

### Tier 2: MongoDB Data Backup
- **Current Status**: MongoDB Atlas unavailable (network access issue)
- **Fallback Active**: memory-storage.json (persistent JSON file)
- **Backup Strategy**:
  - Pre-cutover: Export current memory-storage.json as `memory-storage-backup.json`
  - Post-cutover: Maintain parallel memory-storage.json during transition
  - MongoDB Recovery: When Atlas reconnects, import from backup snapshot

### Tier 3: Environment Configuration Backup
- **Files to Preserve**:
  - `.env.production` (if exists)
  - `.env.staging` (if exists)
  - `backend/.env` (legacy configuration)
  - `frontend/.env` (legacy configuration)
- **Storage**: Encrypted secure vault (not git-tracked for security)
- **Backup Location**: `/secure/backup/env-vars-s36-legacy.enc`

### Tier 4: Build Artifacts
- **Legacy Frontend Build**: `frontend/dist/` (as of S3.5)
- **Legacy Backend Build**: Codebase only (no build artifact, runs directly via Node)
- **Backup Location**: 
  - Frontend: `/backup/legacy-frontend-build-s36.tar.gz`
  - Backend: Already version-controlled in git

### Tier 5: Deployment Configuration
- **nginx Config**: If using reverse proxy (not yet deployed)
- **PM2 Ecosystem**: If using PM2 (not yet configured)
- **SSL Certificates**: If HTTPS enabled (future)
- **DNS Configuration**: Current setup (legacy platform)
- **Backup Location**: `/backup/legacy-deployment-config-s36/`

---

## CRITICAL ASSETS TO PRESERVE

### Source Code (Git ✓)
```
backend/
├─ src/
│  ├─ controllers/       ✓ Preserved
│  ├─ routes/           ✓ Preserved
│  ├─ models/           ✓ Preserved
│  ├─ services/         ✓ Preserved
│  ├─ importadores/     ✓ Preserved (S3.6 enhanced)
│  ├─ data/             ✓ Preserved (Legacy knowledge)
│  ├─ utils/            ✓ Preserved
│  ├─ middleware/       ✓ Preserved
│  ├─ config/           ✓ Preserved
│  └─ server.js         ✓ Preserved
├─ package.json         ✓ Preserved
└─ .env.example         ✓ Preserved

frontend/
├─ src/
│  ├─ components/       ✓ Preserved
│  ├─ pages/            ✓ Preserved
│  ├─ services/         ✓ Preserved
│  ├─ utils/            ✓ Preserved
│  ├─ data/             ✓ Preserved
│  └─ assets/           ✓ Preserved
├─ dist/                ✓ Preserved (Production build)
├─ package.json         ✓ Preserved
└─ vite.config.js       ✓ Preserved
```

### Configuration Files (Backed Up)
```
.env files              → Vault (encrypted, not git)
.railway.json           ✓ Git
.github/workflows/      ✓ Git
nginx.conf (future)     → File backup
PM2 config (future)     → File backup
```

### Historical Data (Preserved)
```
legacy-backend-logs/           → File backup (if exists)
memory-storage.json            → File backup + Git
historical-projects/           → File backup
historical-homologacoes/       → File backup
bill-parsing-samples/          → File backup
```

### Documentation (Git ✓)
```
*.md files              ✓ All documentation preserved in git
Knowledge reports       ✓ S3.6 KNOWLEDGE_PRESERVATION_REPORT.md
Deployment guides       ✓ DEPLOYMENT_CHECKLIST.md
Analysis docs           ✓ Historical analysis preserved
```

---

## ROLLBACK PROCEDURE

### Scenario 1: Critical Bug in New Platform (≤24 hours post-cutover)

**Action**: Switch DNS back to legacy platform

```bash
# 1. Verify legacy platform still running
ssh legacy-server "sudo systemctl status legacy-app"

# 2. Restore nginx to legacy routing
ssh legacy-server "sudo cp /backup/nginx-legacy.conf /etc/nginx/sites-enabled/default"
ssh legacy-server "sudo nginx -t && sudo systemctl reload nginx"

# 3. Verify legacy platform accessible
curl https://fortesolar.com.br

# 4. Notify users of temporary downtime
# (Update status page)

# 5. Debug new platform issue
# (In parallel on staging environment)

# 6. Re-cutover when issue resolved
```

**Estimated Recovery Time**: 15-30 minutes

### Scenario 2: Data Integrity Issue (MongoDB inconsistency)

**Action**: Restore from backup snapshot

```bash
# 1. Identify last-known-good memory-storage.json
ls -lart /backup/memory-storage-backup-*.json

# 2. Restore to production
cp /backup/memory-storage-backup-20260523.json \
   /app/data/memory-storage.json

# 3. Restart application
pm2 restart forte-solar-app

# 4. Verify data integrity
curl https://staging.fortesolar.com.br/api/health
```

**Estimated Recovery Time**: 5-10 minutes

### Scenario 3: Complete Failure (≥2 days post-cutover)

**Action**: Restore from Git branch + rebuild

```bash
# 1. Checkout legacy codebase
git checkout legacy-backup-s36-20260523

# 2. Install dependencies
npm install (backend)
npm install (frontend)

# 3. Build frontend
npm run build

# 4. Restore environment variables
source /secure/backup/env-vars-legacy.enc

# 5. Restore database
mongorestore --archive=/backup/mongo-legacy-20260523.archive

# 6. Start services
pm2 start forte-solar-app

# 7. Verify all endpoints
./scripts/health-check.sh
```

**Estimated Recovery Time**: 30-45 minutes

---

## BACKUP VERIFICATION CHECKLIST

- [ ] Git branch `legacy-backup-s36-20260523` created
- [ ] `memory-storage.json` backed up as `memory-storage-backup-20260523.json`
- [ ] Environment variables encrypted and secured
- [ ] Frontend build artifact archived
- [ ] Deployment configuration documented
- [ ] Rollback procedure tested (staging environment)
- [ ] Team trained on rollback process
- [ ] Monitoring alerts configured
- [ ] Status page setup for incident communication

---

## POST-CUTOVER MONITORING

### First 48 Hours (Critical Window)
- Monitor error logs every 30 minutes
- Check /api/health endpoint every 5 minutes
- Monitor user reports on support channel
- Watch application metrics (CPU, memory, disk)

### First Week
- Daily backup verification
- Weekly functionality audit
- Monitor parser accuracy (error rates)
- Track project creation success rate
- Monitor homologacao generation

### Legacy Platform Status (First 30 days)
- Keep running in parallel (safety)
- Maintain backups on schedule
- Archive access logs
- Document any issues reported
- Plan migration timeline for edge cases

---

## LEGACY PLATFORM PRESERVATION

**After Successful Cutover** (14+ days stability):

1. **Keep Running**: Continue operating legacy on internal server
2. **Archive**: Create read-only archive of legacy codebase
3. **Knowledge Extraction**: Continue mining operational patterns
4. **User Fallback**: If new platform issues arise, temporary routing to legacy
5. **Eventual Retirement**: Decommission ≥6 months post-cutover (after all users migrated)

**DO NOT**: Delete legacy deployment immediately after cutover
**DO NOT**: Lose legacy source code (git preserves it)
**DO NOT**: Lose legacy environment configs (vault preserves them)

---

## ENCRYPTION & SECURITY

### Environment Variables Backup
- **Tool**: `openssl enc -aes-256-cbc`
- **Location**: `/secure/backup/env-vars-s36-legacy.enc`
- **Passphrase**: Stored in LastPass (team access)
- **Decryption**: 
  ```bash
  openssl enc -d -aes-256-cbc -in env-vars-s36-legacy.enc -out .env.recovered
  ```

### Database Backup Encryption
- **Tool**: `gpg` (if backup taken)
- **Key**: Team GPG key (stored in vault)
- **Verification**: Compare SHA256 hashes

### Access Control
- **Backup Directory Permissions**: `chmod 700 /backup/` (root only)
- **Backup File Permissions**: `chmod 600 /backup/*.enc`
- **Access Logs**: Audit all backup access

---

## BACKUP TESTING SCHEDULE

| Frequency | Action | Verification |
|-----------|--------|--------------|
| Weekly | Verify git branch is accessible | `git branch -l legacy-backup*` |
| Weekly | Test env variable decryption | Decrypt + validate structure |
| Monthly | Full rollback test on staging | Run Scenario 1-3 on staging |
| Quarterly | Archive old backups | Move to cold storage |

---

## NOTES

**Legacy System Retirement Timeline**:
- **Day 0-1**: Cutover, legacy running in parallel
- **Day 1-7**: Critical monitoring, emergency rollback window
- **Day 7-30**: Stabilization period, legacy on standby
- **Day 30-90**: User migration completed, legacy archived
- **Day 90+**: Legacy can be decommissioned (code preserved in git)

**Key Principle**: Never delete legacy system until new system has proven stability across full quarter of real operations.

---

**Manifest Version**: 1.0  
**Last Updated**: May 23, 2026  
**Next Review**: May 30, 2026 (post-cutover)
