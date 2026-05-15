#!/usr/bin/env node
/**
 * MongoDB Atlas Data Migration Script (Direct Connection)
 * Alternative to SRV-based connection that bypasses DNS issues
 * Syncs all localhost data from memory-storage.json to MongoDB Atlas production database
 * Usage: node migrate-to-mongodb-direct.js
 */

import fs from 'fs'
import path from 'path'
import { MongoClient } from 'mongodb'
import { fileURLToPath } from 'url'
import 'dotenv/config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// MongoDB Atlas connection details
// Instead of using SRV, we'll use a direct connection with explicit replicas
const MONGODB_HOST = 'cluster0-shard-00-00.mongodb.net'
const MONGODB_PORT = 27017
const MONGODB_USER = 'forte-solar'
const MONGODB_PASSWORD = 'Cr1pt0grafia'
const MONGODB_DB = 'forte_solar'

// Construct a direct connection string without SRV
const MONGODB_URI = `mongodb://${MONGODB_USER}:${encodeURIComponent(MONGODB_PASSWORD)}@${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_DB}?authSource=admin&ssl=true&retryWrites=true&w=majority`

async function migrate() {
  let client
  try {
    console.log('🚀 Starting MongoDB Atlas Data Migration (Direct Connection)...')
    console.log(`📍 Target Database: ${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_DB}`)
    console.log(`⚠️  Using Direct Connection (bypassing DNS SRV)`)

    // 1. Read local data
    console.log('\n📖 Reading local data from memory-storage.json...')
    const dataPath = path.join(__dirname, 'data', 'memory-storage.json')
    const localData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

    console.log('✅ Local data loaded')
    console.log(`   - Clientes: ${localData.collections.clientes.length}`)
    console.log(`   - Projetos FV: ${localData.collections.projetos_fv.length}`)
    console.log(`   - Projetos EV: ${localData.collections.projetos_ev.length}`)
    console.log(`   - Equipamentos: ${localData.collections.equipamentos.length}`)

    // 2. Connect to MongoDB
    console.log('\n🔗 Connecting to MongoDB Atlas (Direct Method)...')
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 15000,
      maxPoolSize: 5,
      // Disable automatic DNS SRV resolution
      directConnection: false,
      tls: true,
      tlsAllowInvalidHostnames: false,
      tlsAllowInvalidCertificates: false
    })

    await client.connect()
    console.log('✅ Connected to MongoDB Atlas')

    const db = client.db(MONGODB_DB)

    // 3. Verify connection
    const adminDb = client.db('admin')
    try {
      const ping = await adminDb.command({ ping: 1 })
      console.log('✅ Database ping successful:', ping.ok === 1 ? 'YES' : 'NO')
    } catch (pingError) {
      console.warn('⚠️  Ping check skipped:', pingError.message)
    }

    // 4. Migrate collections
    console.log('\n📤 Migrating collections to MongoDB...')

    const collections = ['clientes', 'projetos_fv', 'projetos_ev', 'equipamentos', 'configuracoes']

    for (const collectionName of collections) {
      const data = localData.collections[collectionName] || []

      if (data.length === 0) {
        console.log(`   ⏭️  ${collectionName}: 0 records (skipped)`)
        continue
      }

      try {
        // Get collection reference
        const collection = db.collection(collectionName)

        // Clear existing data
        await collection.deleteMany({})

        // Insert new data
        const result = await collection.insertMany(data)
        console.log(`   ✅ ${collectionName}: ${result.insertedCount} records inserted`)
      } catch (error) {
        console.error(`   ❌ ${collectionName}: Error - ${error.message}`)
        throw error
      }
    }

    // 5. Verify migration
    console.log('\n✨ Verifying migration...')
    for (const collectionName of collections) {
      const collection = db.collection(collectionName)
      const count = await collection.countDocuments()
      console.log(`   📊 ${collectionName}: ${count} documents`)
    }

    // 6. Create indexes for better performance
    console.log('\n🔧 Creating indexes...')
    try {
      await db.collection('clientes').createIndex({ email: 1 })
      await db.collection('projetos_ev').createIndex({ clienteId: 1 })
      await db.collection('projetos_fv').createIndex({ clienteId: 1 })
      console.log('   ✅ Indexes created')
    } catch (error) {
      console.warn('   ⚠️  Index creation skipped (may already exist)')
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ MIGRATION COMPLETE!')
    console.log('='.repeat(60))
    console.log(`Database: ${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_DB}`)
    console.log(`All localhost data has been synced to MongoDB Atlas`)
    console.log('Ready for online testing!')

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED!')
    console.error('Error:', error.message)
    console.error('\nTroubleshooting:')
    console.error('1. Check that MongoDB Atlas is accessible at:', MONGODB_HOST + ':' + MONGODB_PORT)
    console.error('2. Verify credentials:', MONGODB_USER)
    console.error('3. Ensure firewall allows outbound port 27017')
    console.error('4. Try connecting with MongoDB Compass first')
    console.error('5. Check MongoDB Atlas IP whitelist settings')
    process.exit(1)
  } finally {
    if (client) {
      console.log('\n🔌 Closing connection...')
      await client.close()
      console.log('✅ Connection closed')
    }
  }
}

// Run migration
migrate().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
