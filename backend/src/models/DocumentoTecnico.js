import mongoose from 'mongoose'

/**
 * DocumentoTecnico — Sprint 8.2
 *
 * Biblioteca documental enterprise. O Mongo guarda APENAS metadados + referência
 * de storage (url_storage); o binário fica no object storage (S3/R2) ou no
 * adapter local temporário. Dedup global por hash_sha256.
 */
const documentoTecnicoSchema = new mongoose.Schema({
  tipo:        { type: String, default: 'datasheet' }, // datasheet|manual|certificado|garantia|declaracao
  fabricante:  { type: String, default: null },
  modelo:      { type: String, default: null },
  nome:        { type: String, default: null },

  hash_sha256: { type: String, required: true, unique: true, index: true },
  document_path: { type: String, default: null, index: true }, // referência oficial (S8.2.1)
  url_storage: { type: String, default: null },
  storage_provider: { type: String, default: 'local' }, // local|onedrive|google_drive|dropbox|s3|r2
  ref_externa: { type: String, default: null },          // cache opcional do id no provider (NUNCA chave)

  tamanho_original: { type: Number, default: null },
  tamanho_final:    { type: Number, default: null },
  economia_pct:     { type: Number, default: null },
  dpi_final:        { type: Number, default: null },

  documento_assinado:  { type: Boolean, default: false },
  otimizacao_pulada:   { type: Boolean, default: false },
  motivo_preservacao:  { type: String, default: null },

  versao:      { type: Number, default: 1 },

  // Certificação interpretada (Gemini) — revisão humana antes de aprovar
  certificacao: {
    inmetro_registro: { type: String, default: null },
    inmetro_validade: { type: Date,   default: null },
    normas:           { type: [String], default: [] },   // IEC62116, NBR16149, ...
    laboratorio:      { type: String, default: null },    // TÜV, SGS, Intertek
    emissao:          { type: Date,   default: null },
    validade:         { type: Date,   default: null },
  },
  modelos_nominais: { type: String, default: null },      // texto original do certificado
  modelos_mapeados: { type: [String], default: [] },      // expansão da família
  aprovado:    { type: Boolean, default: false },
  arquivado:   { type: Boolean, default: false },          // nunca deletar fisicamente se em uso

  metadados:   { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true })

export const DocumentoTecnico = mongoose.model('DocumentoTecnico', documentoTecnicoSchema)
