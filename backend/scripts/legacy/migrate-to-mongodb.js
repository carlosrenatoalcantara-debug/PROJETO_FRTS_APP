#!/usr/bin/env node
/**
 * MongoDB Atlas Data Migration Script
 * Syncs all localhost data from memory-storage.json to MongoDB Atlas production database
 * Usage: node migrate-to-mongodb.js
 */

import fs from 'fs'
import path from 'path'
import { MongoClient } from 'mongodb'
import { fileURLToPath } from 'url'
import 'dotenv/config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://forte-solar:REDACTED_ROTATE_VIA_ATLAS@cluster0.mongodb.net/forte_solar?retryWrites=true&w=majority'

async function migrate() {
  let client
  try {
    console.log('🚀 Starting MongoDB Atlas Data Migration...')
    console.log(`📍 Target Database: ${MONGODB_URI.split('@')[1] || 'forte_solar'}`)

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
    console.log('\n🔗 Connecting to MongoDB Atlas...')
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 10000
    })

    await client.connect()
    console.log('✅ Connected to MongoDB Atlas')

    const db = client.db('forte_solar')

    // 3. Verify connection
    const adminDb = client.db('admin')
    const ping = await adminDb.command({ ping: 1 })
    console.log('✅ Database ping successful:', ping.ok === 1 ? 'YES' : 'NO')

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
    console.log(`Database: ${MONGODB_URI.split('mongodb+srv://')[1].split('@')[0]}@Atlas`)
    console.log(`All localhost data has been synced to MongoDB Atlas`)
    console.log('Ready for online testing!')

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED!')
    console.error('Error:', error.message)
    console.error('\nTroubleshooting:')
    console.error('1. Verify MongoDB URI in .env file')
    console.error('2. Check MongoDB Atlas network access (IP whitelist)')
    console.error('3. Ensure credentials are correct')
    console.error('4. Try connecting with MongoDB Compass first')
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
