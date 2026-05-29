import mongoose from 'mongoose'

/**
 * AuditLog — Sprint 7.3
 *
 * Persistência da trilha de auditoria gerada pelo auditLogger existente
 * (não é um sistema novo — é a materialização consultável do que já era logado).
 * Coleção CAPPED (limite de tamanho) para não crescer indefinidamente.
 */
const auditLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now, index: true },
  usuario:   { type: String, default: 'anonymous', index: true },
  perfil:    { type: String, default: null, index: true },
  empresa:   { type: String, default: null, index: true },
  modulo:    { type: String, default: null, index: true },
  acao:      { type: String, default: null },   // GET/POST/PUT/DELETE
  metodo:    { type: String, default: null },
  path:      { type: String, default: null },
  status:    { type: Number, default: null },
  ip:        { type: String, default: null },
}, {
  // ~5000 entradas ou 5MB (o que vier primeiro)
  capped: { size: 5 * 1024 * 1024, max: 5000 },
  versionKey: false,
})

export const AuditLog = mongoose.model('AuditLog', auditLogSchema)
