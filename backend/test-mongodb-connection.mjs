import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI
console.log('[TEST] MongoDB URI configured:', !!MONGODB_URI)
console.log('[TEST] Testing connection to MongoDB Atlas...\n')

try {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 5000
  })
  
  console.log('✅ CONNECTED to MongoDB Atlas')
  console.log('   Database:', mongoose.connection.name)
  console.log('   Host:', mongoose.connection.host)
  console.log('   Collections:', Object.keys(mongoose.connection.collections))
  
  await mongoose.disconnect()
  console.log('\n✅ Connection test PASSED')
  process.exit(0)
} catch (err) {
  console.log('❌ MongoDB Connection FAILED')
  console.log('   Error:', err.message)
  console.log('   Code:', err.code)
  console.log('\n⚠️  Falling back to memory storage')
  process.exit(1)
}
