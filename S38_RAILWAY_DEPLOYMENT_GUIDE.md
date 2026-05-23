# S3.8 - RAILWAY DEPLOYMENT EXECUTION GUIDE

**Estratégia**: Railway + MongoDB Atlas + Staging-First  
**Status**: READY FOR USER EXECUTION  
**Critical Rule**: ZERO DRIFT - Stop immediately if governance diverges

---

## ⚠️ IMPORTANT

You must execute the following steps in your Railway dashboard (login required).  
I have prepared all code/configuration files locally.  
You will perform the Railway UI actions.

---

## STEP 1: LOGIN TO RAILWAY DASHBOARD

**Action**: Go to https://railway.app and login with your account

**Expected**: You see "New Project" option

---

## STEP 2: CREATE NEW PROJECT - FORTE SOLAR STAGING

**Action in Railway Dashboard**:
1. Click "New Project"
2. Enter name: **"Forte Solar Staging"**
3. Select: **"Deploy from GitHub"**
4. Connect your GitHub repository containing the code

**Expected**: Railway detects Dockerfile automatically

---

## STEP 3: CONFIGURE ENVIRONMENT VARIABLES

**In Railway Dashboard - Project Settings**:

Copy and paste each variable from below:

### Staging Environment Variables:
```
NODE_ENV=production
PORT=3001

MONGODB_URI=mongodb+srv://[USERNAME]:[PASSWORD]@[CLUSTER].mongodb.net/forte-solar-staging?retryWrites=true&w=majority

JWT_SECRET=forte-solar-s3.8-staging-secret-key-2026
JWT_EXPIRY=7d

VITE_API_URL=https://staging.fortesolar.com.br/api
VITE_MODE=production

UPLOAD_DIR=/tmp/uploads
UPLOAD_MAX_SIZE=52428800

PARSER_ENABLED=true
PARSER_OCR_ENABLED=true

PDF_ENABLED=true
UNIFILAR_ENABLED=true

LOG_LEVEL=info
MONITORING_ENABLED=true

CORS_ORIGIN=https://staging.fortesolar.com.br
ENABLE_HELMET=true
RATE_LIMIT_ENABLED=true
```

**CRITICAL**: Replace `[USERNAME]`, `[PASSWORD]`, and `[CLUSTER]` with your MongoDB Atlas credentials

---

## STEP 4: CONFIGURE CUSTOM DOMAIN (Optional - Railway URL works too)

**If using staging.fortesolar.com.br**:
1. In Railway: Project Settings → Custom Domain
2. Enter: `staging.fortesolar.com.br`
3. Follow DNS instructions to point your domain to Railway

**If using Railway-generated URL**:
- Railway will auto-generate: `fortesolar-staging-[random].railway.app`
- Use that URL for testing

---

## STEP 5: DEPLOY TO STAGING

**In Railway Dashboard**:
1. Ensure all environment variables are set
2. Click "Deploy" button
3. Watch build progress in logs
4. Wait for: **"Deployment Successful"** message

**Expected Build Time**: 3-5 minutes

**Expected Output**:
```
✅ Building Docker image...
✅ Pushing to Railway...
✅ Deploying service...
✅ Health check passing
✅ Service ready: https://[staging-url]/api/health
```

---

## STEP 6: VALIDATE STAGING ENVIRONMENT

**Test Health Endpoint**:
```bash
curl https://[staging-url]/api/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "servico": "Forte Solar API",
  "mongodb": "conectado",
  "mongodbState": 1
}
```

**Test Frontend**:
- Open: `https://[staging-url]`
- Should see login page
- CSS/JS should load without errors

---

## STEP 7: TEST AUTHENTICATION ONLINE

**Test Admin Login**:
```bash
curl -X POST https://[staging-url]/api/authv2/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@fortesolar.com.br",
    "senha": "admin@2026"
  }'
```

**Expected**: JWT token returned with 7-day expiry

**Test User1 Login**:
```bash
curl -X POST https://[staging-url]/api/authv2/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste1@fortesolar.com.br",
    "senha": "teste123!"
  }'
```

**Test User2 Login**:
```bash
curl -X POST https://[staging-url]/api/authv2/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste2@fortesolar.com.br",
    "senha": "teste123!"
  }'
```

---

## STEP 8: TEST COMPLETE OPERATIONAL FLOW

**Manual testing in browser**:

1. Open: `https://[staging-url]`
2. Login with **admin@fortesolar.com.br / admin@2026**
3. Navigate to Clients page
4. Create new client
5. Create new project
6. **Upload real utility bill** (test PDF)
7. Verify parser extracts data
8. Verify FV sizing calculates
9. Create homologation
10. Generate PDF
11. Generate unifilar
12. Logout

**Expected**: All operations work without errors

---

## STEP 9: TEST MULTIUSER CONCURRENCY

**Scenario**:
- **Browser Tab 1**: Login as teste1
- **Browser Tab 2**: Login as teste2
- Both create separate clients/projects
- Verify data isolation (teste1 doesn't see teste2's data)

**Expected**: Complete data isolation

---

## STEP 10: GOVERNANCE VALIDATION

**Run Local Validation** (on your machine):

```bash
cd /c/Users/Forte\ Solar/PROJETO_FRTS_APP

# Generate hashes of current algorithms
npm run test:hashes

# Should output:
# FV Sizing Hash: [should match S3.7 baseline]
# BESS Hash: [should match S3.7 baseline]
# EV Hash: [should match S3.7 baseline]
# Parser Hash: [should match S3.7 baseline]
```

**IF ANY HASH DIFFERS**:
→ 🛑 **STOP IMMEDIATELY**
→ Rollback staging deployment
→ Investigate root cause
→ DO NOT PROCEED TO PRODUCTION

**IF ALL HASHES MATCH**:
→ ✅ Governance validated
→ Proceed to Step 11

---

## STEP 11: PRODUCTION DEPLOYMENT (AFTER VALIDATION)

**ONLY IF**:
- ✅ All staging tests passed
- ✅ All hashes matched baselines
- ✅ Multiuser isolation verified
- ✅ PDFs/Parser/Homologation working

**Create Production Project**:

1. In Railway: New Project → "Forte Solar Production"
2. Configure identical setup (same Dockerfile)
3. Update environment variables:

```
MONGODB_URI=mongodb+srv://[USERNAME]:[PASSWORD]@[CLUSTER].mongodb.net/forte-solar-production?retryWrites=true&w=majority
VITE_API_URL=https://fortesolar.com.br/api
CORS_ORIGIN=https://fortesolar.com.br
```

4. Custom domain: `fortesolar.com.br`
5. Deploy to production

---

## STEP 12: DNS SWITCHOVER

**ONLY AFTER Production deployment successful**:

1. Go to your DNS provider
2. Update `fortesolar.com.br` A record
3. Point to Railway production URL
4. Wait for DNS propagation (5-15 minutes)

**Verify**:
```bash
curl https://fortesolar.com.br/api/health
```

---

## ROLLBACK PROCEDURE (If needed)

**If production has issues**:

1. **Keep staging running** - staging.fortesolar.com.br remains accessible
2. **Revert DNS** - Point fortesolar.com.br back to legacy server
3. **Investigate** - Debug what went wrong in production logs
4. **Fix and retry** - Deploy fixed version once root cause resolved

---

## MONITORING

**Daily checks**:
1. Visit `https://fortesolar.com.br/api/health`
2. Monitor Railway dashboard for errors
3. Check MongoDB Atlas for connection issues
4. Review application logs for anomalies

---

## CHECKLIST

**Staging Deployment**:
- [ ] Railway project created
- [ ] Environment variables configured
- [ ] Build successful
- [ ] Health endpoint responding
- [ ] Frontend loads
- [ ] Auth working
- [ ] Parser working
- [ ] Governance validated (zero drift)

**Production Deployment**:
- [ ] All staging tests passed
- [ ] Production project created
- [ ] DNS configured
- [ ] HTTPS working
- [ ] Final validation complete

---

## CRITICAL REMINDER

**GOVERNANCE RULE IS SACRED**:
- IF any hash diverges → STOP IMMEDIATELY
- IF any baseline changes → STOP IMMEDIATELY  
- IF immutability fails → STOP IMMEDIATELY

Do NOT skip validation steps.

---

**Generated**: 2026-05-23T22:45:00Z  
**Ready for**: User execution with Railway dashboard access

