import mongoose from 'mongoose'

const apiKeySchema = new mongoose.Schema({
  keyId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  integrationName: {
    type: String,
    required: true,
    enum: ['GeminiVision', 'OpenAI', 'Claude', 'GoogleMaps', 'GitHub', 'Anthropic'],
  },
  description: {
    type: String,
    default: '',
  },
  // 🔐 Encrypted data stored as-is (contains encryptedData, salt, iv, authTag)
  encrypted: {
    encryptedData: {
      type: String,
      required: true,
    },
    salt: {
      type: String,
      required: true,
    },
    iv: {
      type: String,
      required: true,
    },
    authTag: {
      type: String,
      required: true,
    },
    algorithm: {
      type: String,
      default: 'aes-256-gcm',
    },
  },
  // Key lifecycle management
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastUsed: {
    type: Date,
    default: null,
  },
  deactivatedAt: {
    type: Date,
    default: null,
  },
  rotatedAt: {
    type: Date,
    default: null,
  },
  rotationDueAt: {
    type: Date,
    required: true,
  },
  // Audit trail
  lastAccessBy: {
    type: String,
    default: null,
  },
  lastAccessIp: {
    type: String,
    default: null,
  },
  accessCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
})

// Index for finding keys needing rotation
apiKeySchema.index({ isActive: 1, rotationDueAt: 1 })
apiKeySchema.index({ userId: 1, integrationName: 1 })

export const ApiKey = mongoose.model('ApiKey', apiKeySchema)
