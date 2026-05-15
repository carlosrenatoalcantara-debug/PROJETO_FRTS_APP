# 🔐 MongoDB Atlas Network Access Configuration

## Current Situation
Your localhost IP address **179.190.207.204** needs to be whitelisted in MongoDB Atlas to allow the data migration script to connect.

## Quick Fix Options

### Option 1: Temporary Whitelist (Recommended for Testing)
1. Go to: https://cloud.mongodb.com/v2
2. Login if needed
3. Select Organization: **Carlos's Org - 2026-0...** 
4. Select Project: **Project 0**
5. In left sidebar, under SECURITY, click **Database & Network Access**
6. Click the **ADD IP ADDRESS** button
7. Choose **Add Current IP Address** (should show: 179.190.207.204)
8. OR manually enter: `179.190.207.204`
9. (Optional) Add description: "Localhost Development"
10. Click **Confirm**
11. Wait for the whitelist to update (usually 1-2 minutes)

### Option 2: Allow All IPs (For Development Only - NOT RECOMMENDED)
1. Follow steps 1-5 above
2. Click **ADD IP ADDRESS**
3. Enter `0.0.0.0/0` (allows all IPs)
4. Description: "Temporary Development Access"
5. Click **Confirm**
6. **⚠️ IMPORTANT: Remove this after development! This is a security risk.**

### Option 3: Use MongoDB Compass
1. Download MongoDB Compass from: https://www.mongodb.com/products/tools/compass
2. Click "New Connection"
3. Paste connection string:
   ```
   mongodb+srv://forte-solar:Cr1pt0grafia@cluster0.mongodb.net/forte_solar?retryWrites=true&w=majority
   ```
4. Click "Save & Connect"
5. Once connected, you can manually import the data through the UI

## After Whitelisting
Once the IP is whitelisted, run the migration script:

```bash
cd C:\Users\Forte Solar\PROJETO_FRTS_APP\backend
node migrate-to-mongodb.js
```

## What the Migration Does
- Reads local data from: `backend/data/memory-storage.json`
- Imports to MongoDB Atlas collections:
  - ✅ clientes (1 client)
  - ✅ projetos_ev (1 EV project)
  - ✅ projetos_fv (0 FV projects)
  - ✅ equipamentos (9 equipment items)

## MongoDB URI Details
- **Connection String**: mongodb+srv://forte-solar:Cr1pt0grafia@cluster0.mongodb.net/forte_solar
- **Username**: forte-solar
- **Database**: forte_solar
- **Cluster**: cluster0.mongodb.net

## Current IP Address
**Your IP**: 179.190.207.204

## Troubleshooting
If you still get connection errors after whitelisting:
1. Wait 5 minutes for MongoDB Atlas to fully update
2. Try restarting your Node.js application
3. Check that DNS can resolve cluster0.mongodb.net:
   ```bash
   nslookup cluster0.mongodb.net
   ```
4. Contact MongoDB Support if the issue persists

## Security Note
- After development/testing, consider removing the 0.0.0.0/0 whitelist if used
- The encryption in the backend ensures API keys are secure even if the network is exposed
- All connections use TLS/HTTPS encryption

---

**Status**: Waiting for network access configuration  
**Action Required**: Whitelist IP 179.190.207.204 in MongoDB Atlas
