import mongoose from 'mongoose'

/**
 * BulkOperationLog — Auditoria de operações em lote no catálogo.
 *
 * Coleção regular (não capped) com TTL de 90 dias.
 * Diferente do AuditLog (trilha de requests HTTP), aqui registramos
 * operações de negócio com IDs afetados, duração e resultado.
 */
const bulkOpLogSchema = new mongoose.Schema({
  timestamp:     { type: Date, default: Date.now, index: true },
  usuario:       { type: String, default: 'anonymous', index: true },
  operacao:      { type: String, required: true, enum: ['delete','validate','recalculate_score','status','export'] },
  tipo_catalogo: { type: String, required: true, index: true },
  quantidade:    { type: Number, required: true },
  ids_afetados:  { type: [String], default: [] },
  tempo_ms:      { type: Number, default: null },
  sucesso:       { type: Boolean, required: true },
  erro:          { type: String, default: null },
  metadados:     { type: mongoose.Schema.Types.Mixed, default: null },
}, { versionKey: false })

// TTL: remove logs com mais de 90 dias automaticamente
bulkOpLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })

export const BulkOperationLog = mongoose.model('BulkOperationLog', bulkOpLogSchema)
