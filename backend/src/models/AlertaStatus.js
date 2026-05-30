import mongoose from 'mongoose'

/**
 * AlertaStatus — Sprint 8.8
 *
 * Modelo MÍNIMO para guardar APENAS o estado de resolução de um alerta.
 * Os alertas em si são DERIVADOS a partir dos modelos existentes (Tecnico,
 * Equipamento, ProjetoFV, FaturaEnergia, DocumentoTecnico) — não duplicamos
 * dados. Aqui só registramos: este alert_id foi resolvido/arquivado/reaberto
 * por quem e quando, com observação opcional.
 */
const historicoSchema = new mongoose.Schema({
  em:          { type: Date, default: () => new Date() },
  por:         { type: String, default: null },
  acao:        { type: String, enum: ['criado', 'resolvido', 'arquivado', 'reaberto', 'observacao'], required: true },
  observacao:  { type: String, default: null },
}, { _id: false })

const alertaStatusSchema = new mongoose.Schema({
  alert_id:    { type: String, required: true, unique: true, index: true }, // ex.: 'rt_vencido:6543abc'
  origem:      { type: String, default: null, index: true },                // rt|catalogo|documento|projeto|fatura
  status:      { type: String, enum: ['aberto', 'resolvido', 'arquivado'], default: 'resolvido', index: true },
  resolvido_por:{ type: String, default: null },
  resolvido_em:{ type: Date,   default: null },
  observacao:  { type: String, default: null },
  historico:   { type: [historicoSchema], default: [] },
}, { timestamps: true })

export const AlertaStatus = mongoose.model('AlertaStatus', alertaStatusSchema)
