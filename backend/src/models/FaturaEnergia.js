import mongoose from 'mongoose'

/**
 * FaturaEnergia — Sprint 8.5
 * Modelo UNIVERSAL de fatura. Cada bloco é Mixed para suportar concessionárias
 * distintas; cada campo carrega { valor, fonte, confianca } produzido pelo
 * service de inteligência (parser + Gemini + correção humana).
 *
 * Aditivo: não substitui o fluxo legado `/api/fatura/extrair` — esta camada
 * apenas estrutura, valida e oferece revisão humana antes de criar Cliente/Projeto.
 */
const faturaEnergiaSchema = new mongoose.Schema({
  // Procedência
  origem: {
    tipo:           { type: String, enum: ['PDF', 'OCR', 'TEXTO', 'MANUAL'], default: 'PDF' },
    arquivo_nome:   { type: String, default: null },
    arquivo_hash:   { type: String, default: null }, // SHA-256 do upload original (opcional)
    importado_em:   { type: Date,   default: Date.now },
    importado_por:  { type: String, default: null },
  },

  // Detecção de concessionária (resultado do detector puro)
  concessionaria_detectada: {
    concessionaria: { type: String, default: 'DESCONHECIDA' },
    grupo:          { type: String, default: 'OUTRA' },
    estado:         { type: String, default: null },
    layout:         { type: String, default: 'generico' },
    confianca:      { type: Number, default: 0 },
  },

  // Estrutura normalizada (Mixed — cada folha é {valor, fonte, confianca})
  cliente:               { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  unidade_consumidora:   { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  classificacao:         { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  ligacao:               { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  historico_consumo:     { type: [mongoose.Schema.Types.Mixed], default: [] }, // [{mes,ano,kwh}]
  analise:               { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  grupo_a:               { type: mongoose.Schema.Types.Mixed, default: null }, // só preenchido se aplicável
  geracao_existente:     { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  consumo_atual_kwh:     { type: mongoose.Schema.Types.Mixed, default: () => ({}) },

  // Validação + revisão humana
  flags:                 { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  alertas:               { type: [mongoose.Schema.Types.Mixed], default: [] },
  necessita_revisao:     { type: Boolean, default: true },
  revisado_por:          { type: String, default: null },
  revisado_em:           { type: Date,   default: null },
  status_revisao:        {
    type: String,
    enum: ['pendente', 'revisada', 'aprovada', 'rejeitada'],
    default: 'pendente',
  },

  // Após aprovação: vínculo a Cliente/Projeto criados
  cliente_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', default: null },
  projeto_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'ProjetoFV', default: null },
  empresa_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', default: null },
}, { timestamps: true, collection: 'faturas_energia' })

faturaEnergiaSchema.index({ 'unidade_consumidora.numero_uc.valor': 1 })
faturaEnergiaSchema.index({ 'cliente.cpf_cnpj.valor': 1 })

export const FaturaEnergia = mongoose.model('FaturaEnergia', faturaEnergiaSchema)
