import mongoose from 'mongoose'
import { processarEquipamento, aplicarResultadoNoDoc } from '../services/catalogoQualidade.js'

/**
 * Equipamento — schema EXISTENTE preservado.
 * S2.6.1 adicionou SOMENTE campos NOVOS opcionais.
 *
 * Garantias:
 *  - especificacoes (Mixed original) NUNCA é modificada
 *  - todos os campos antigos continuam aceitando os mesmos valores
 *  - novos campos têm defaults null/[]
 *  - hook pre('save') é síncrono, idempotente, e nunca lança erro
 */

// ─── Subdocs aditivos (estritos onde possível) ─────────────────────────────

const OrigemSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['manual','datasheet_gemini','datasheet_pdfparse','import_planilha','import_solarmarket','import_legado','desconhecido', null],
    default: null,
  },
  fonte: { type: String, default: null },
  arquivo_original_url: { type: String, default: null },
  em: { type: Date, default: null },
}, { _id: false })

const IdentificacaoSchema = new mongoose.Schema({
  fabricante_normalizado: { type: String, default: null, index: true },
  modelo_normalizado:     { type: String, default: null, index: true },
  hash_unico:             { type: String, default: null, index: true },
  aliases:                { type: [String], default: [] },
}, { _id: false })

const AlertaSchema = new mongoose.Schema({
  codigo:             String,
  severidade:         { type: String, enum: ['critico','alto','medio','baixo','info'] },
  campo:              String,
  descricao:          String,
  mensagem:           String,
  valor_atual:        mongoose.Schema.Types.Mixed,
  valor_esperado_min: { type: Number, default: null },
  valor_esperado_max: { type: Number, default: null },
  detectado_em:       { type: Date, default: () => new Date() },
}, { _id: false })

const QualidadeSchema = new mongoose.Schema({
  completude_score: { type: Number, default: null },
  confianca_score:  { type: Number, default: null },
  score_global:     { type: Number, default: null, index: true },
  nivel: {
    type: String,
    enum: ['validado','utilizavel','incompleto','suspeito','invalido','aguardando_revisao', null],
    default: null,
    index: true,
  },
  campos_faltantes: { type: [String], default: [] },
  alertas:          { type: [AlertaSchema], default: [] },
  calculado_em:     { type: Date, default: null },
  motor_versao:     { type: String, default: null },
}, { _id: false })

const StatusOperacionalSchema = new mongoose.Schema({
  pode_ser_selecionado: { type: Boolean, default: true, index: true },
  aviso_ao_selecionar:  { type: String, default: null },
  bloqueado_em:         { type: Date, default: null },
  motivo_bloqueio:      { type: String, default: null },
}, { _id: false })

const EventoHistoricoSchema = new mongoose.Schema({
  em:    { type: Date, default: () => new Date() },
  tipo:  { type: String, enum: ['validacao_automatica','correcao_manual','reprocessamento_gemini','import'] },
  por:   { type: String, default: 'sistema' },
  antes: mongoose.Schema.Types.Mixed,
  depois: mongoose.Schema.Types.Mixed,
  campos_alterados: { type: [String], default: [] },
  observacao: { type: String, default: null },
}, { _id: false })

const ValidacaoSchema = new mongoose.Schema({
  historico:                { type: [EventoHistoricoSchema], default: [] },
  ultima_revisao_humana:    { type: Date, default: null },
  revisado_por:             { type: String, default: null },
}, { _id: false })

// ─── Equipamento (schema preservado + adições) ─────────────────────────────

const EquipamentoSchema = new mongoose.Schema(
  {
    // === CAMPOS EXISTENTES (intocados) ====================================
    tipo: {
      type: String,
      enum: ['modulo', 'inversor', 'estrutura', 'bateria', 'carregador_ev'],
      required: true,
      index: true,
    },
    fabricante: { type: String, required: true, index: true },
    modelo:     { type: String, required: true, index: true },
    especificacoes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    garantia_produto: {
      value: Number,
      unit: { type: String, enum: ['anos', 'meses'] },
    },
    garantia_performance: {
      value: Number,
      unit: { type: String, enum: ['anos', 'meses'] },
    },
    datasheet_url: String,
    preco_sugerido: { type: Number, default: 0 },
    ativo: { type: Boolean, default: true, index: true },

    // === NOVOS CAMPOS (S2.6.1) ============================================
    _schema_versao:     { type: String, default: '2.0' },
    origem:             { type: OrigemSchema, default: () => ({}) },
    identificacao:      { type: IdentificacaoSchema, default: () => ({}) },
    qualidade:          { type: QualidadeSchema, default: () => ({}) },
    status_operacional: { type: StatusOperacionalSchema, default: () => ({ pode_ser_selecionado: true }) },
    validacao:          { type: ValidacaoSchema, default: () => ({ historico: [] }) },
    specs_canonicas:    { type: mongoose.Schema.Types.Mixed, default: null },

    // === S8.0.1: datasheet original + liberação de engenharia ============
    // Guarda o PDF/imagem original (base64) p/ reprocessar com IA depois.
    datasheet_original: {
      nome:           { type: String, default: null },
      hash:           { type: String, default: null, index: true },
      data_upload:    { type: Date,   default: null },
      origem:         { type: String, default: null },
      conteudo_base64:{ type: String, default: null },   // dataURL (cap ~8MB)
    },
    // Proveniência por campo: { campo: { fonte, confianca } }
    fonte_dados: { type: mongoose.Schema.Types.Mixed, default: null },
    // Flag de uso seguro em projeto (orçamento) — calculada por regras de campos
    utilizavel_em_projeto: { type: Boolean, default: true },
    bloqueio_engenharia:   { type: [String], default: [] },

    // === S8.0.2: biblioteca documental + certificação ====================
    // documentos_tecnicos: datasheet/manual/INMETRO/IEC/declaração/garantia
    documentos_tecnicos: { type: [{
      tipo:         { type: String, default: null },   // datasheet|manual|inmetro|iec|declaracao|garantia
      nome:         { type: String, default: null },
      hash:         { type: String, default: null },
      data_upload:  { type: Date,   default: Date.now },
      origem:       { type: String, default: null },
      validade:     { type: Date,   default: null },
      modelo_relacionado: { type: String, default: null },
      conteudo_base64:    { type: String, default: null },
      // métricas de otimização (documentOptimizerService)
      tamanho_original: { type: Number, default: null },
      tamanho_final:    { type: Number, default: null },
      reducao_pct:      { type: Number, default: null },
      dpi_final:        { type: Number, default: null },
    }], default: [] },
    // Certificação inteligente (INMETRO p/ pequenos; IEC p/ maiores/trifásicos)
    certificacao: {
      inmetro: {
        numero:      { type: String, default: null },
        validade:    { type: Date,   default: null },
        certificado: { type: String, default: null },  // ref/base64
      },
      // normas internacionais identificadas: [{ norma, laboratorio, validade, modelos }]
      normas_iec: { type: mongoose.Schema.Types.Mixed, default: [] },
    },
  },
  { timestamps: true }
)

// ─── Hook pre('save') — síncrono, idempotente, defensivo ────────────────────

// Nota: async style (sem next callback) — compatível com Mongoose 6+/7+/8+/9+
// O callback-style com `next` tem comportamento inconsistente em Mongoose 9.x + ESM.
EquipamentoSchema.pre('save', async function preCalcularQualidade() {
  try {
    // Skip se for um doc novo sem dados mínimos (deixa as validações required cuidarem)
    if (!this.tipo || !this.fabricante || !this.modelo) return

    const equipamento = this.toObject({ depopulate: true, getters: false, virtuals: false })
    const resultado = processarEquipamento(equipamento, { tipoEvento: 'validacao_automatica' })
    aplicarResultadoNoDoc(this, resultado)
  } catch (err) {
    // Nunca derruba o save. Loga e prossegue — qualidade fica null se falhar.
    console.warn('[Equipamento.pre(save)] qualidade falhou:', err.message)
  }
})

export const Equipamento = mongoose.model('Equipamento', EquipamentoSchema)
