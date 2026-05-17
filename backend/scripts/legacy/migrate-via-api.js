#!/usr/bin/env node
/**
 * MongoDB Atlas Migration via REST API Data API
 * Alternative approach using HTTP instead of DNS
 */

import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'
import 'dotenv/config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// MongoDB Atlas Data API Configuration
const ATLAS_API_KEY = process.env.ATLAS_API_KEY || 'test'
const ATLAS_ENDPOINT = 'https://data.mongodb-api.com/app/data-xxxxx/endpoint/data/v1'

async function migrateViaAPI() {
  try {
    console.log('🚀 Attempting Migration via REST API...')
    
    // Read local data
    const dataPath = path.join(__dirname, 'data', 'memory-storage.json')
    const localData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
    
    console.log('✅ Local data loaded')
    console.log(`   - Clientes: ${localData.collections.clientes.length}`)
    console.log(`   - Projetos EV: ${localData.collections.projetos_ev.length}`)
    
    console.log('\n⚠️  REST API method requires API key configuration')
    console.log('Please use MongoDB Compass instead - it handles DNS better')
    
  } catch (error) {
    console.error('Error:', error.message)
  }
}

migrateViaAPI()
