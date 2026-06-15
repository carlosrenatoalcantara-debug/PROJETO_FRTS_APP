import mongoose from 'mongoose'

/**
 * AtivoEquipamento — P1-ASSET-CORE-01 (FASE 1)
 *
 * O "Gêmeo Digital": registra O QUE FOI EFETIVAMENTE INSTALADO (as-built), distinto do
 * catálogo (Atlas = as-specified). Coleção própria, ligada por referência ao projeto/arranjo
 * e ao item de catálogo — NÃO altera ProjetoFV nem Atlas.
 *
 * Conforme ASSET_MODEL_ENTITY_DIAGRAM.md. Modo inicial: MÓDULOS agregados por arranjo
 * (1 ativo, quantidade=N) para evitar explosão de registros; individualização por unidade
 * fica para a sprint avançada de O&M.
 */

const HistoricoSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['criacao', 'instalacao', 'troca', 'garantia', 'manutencao', 'comissionamento', 'falha', 'inspecao', 'mudanca_status'],
  },
  data:        { type: Date,   default: () => new Date() },
  usuario:     { type: String, default: null },
  descricao:   { type: String, default: null },
  status_de:   { type: String, default: null },
  status_para: { type: String, default: null },
  // P1-ASSET-COMMISSIONING-01 — diffs por campo (valor anterior/novo) na trilha
  alteracoes:  { type: [{ campo: String, de: mongoose.Schema.Types.Mixed, para: mongoose.Schema.Types.Mixed }], default: undefined, _id: false },
}, { _id: false })

const AtivoEquipamentoSchema = new mongoose.Schema({
  // ── Vínculos ────────────────────────────────────────────────────────────────
  projeto_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'ProjetoFV',   required: true, index: true },
  arranjo_id:     { type: String, default: null, index: true },                 // = ProjetoFV.arranjos[].id
  equipamento_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipamento',  default: null },
  cliente_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente',      default: null, index: true },

  // ── Identidade física (as-built) ──────────────────────────────────────────────
  tipo: {
    type: String,
    enum: ['modulo', 'inversor', 'microinversor', 'otimizador', 'bess', 'carregador'],
    required: true,
    index: true,
  },
  fabricante:   { type: String, default: null },
  modelo:       { type: String, default: null },
  numero_serie: { type: String, default: null },
  qr_code:      { type: String, default: null },   // FORTE-<TIPO3>-<SEQ6> (único; imutável)
  quantidade:   { type: Number, default: 1 },      // agregado (módulos por arranjo); 1 p/ inversor/bess

  // ── Ciclo de vida ─────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['planejado', 'instalado', 'operacional', 'manutencao', 'substituido', 'desativado'],
    default: 'planejado',
    index: true,
  },
  data_instalacao:      { type: Date, default: null },
  data_comissionamento: { type: Date, default: null },
  comissionado_por:     { type: String, default: null },   // P1-ASSET-COMMISSIONING-01

  // ── Garantia ────────────────────────────────────────────────────────────────
  garantia_inicio: { type: Date, default: null },
  garantia_fim:    { type: Date, default: null },

  // ── Conectividade (reservado; preenchido em fases futuras) ────────────────────
  conectividade: {
    mac_wifi:    { type: String, default: null },
    wifi_ssid:   { type: String, default: null },   // P1-ASSET-COMMISSIONING-01
    senha_wifi:  { type: String, default: null },   // sensível — NÃO exposto em consulta pública
    firmware:    { type: String, default: null },
    endereco_ip: { type: String, default: null },
  },

  // ── Substituição (cadeia de troca) ────────────────────────────────────────────
  substitui_ativo_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'AtivoEquipamento', default: null },
  substituido_por_ativo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AtivoEquipamento', default: null },

  // ── Físico / contexto ─────────────────────────────────────────────────────────
  topologia:   { type: String, default: null },    // herdado do arranjo (string|micro|hibrido|bess|...)
  localizacao: { type: String, default: null },
  observacoes: { type: String, default: null },

  // ── Idempotência da geração (evita duplicidade na re-execução) ─────────────────
  chave_origem: { type: String, default: null, index: true },

  // ── Histórico (embutido) ──────────────────────────────────────────────────────
  historico: { type: [HistoricoSchema], default: [] },

  // ── Documentos (RESERVADO — não implementado nesta sprint) ────────────────────
  documentos: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { collection: 'ativos_equipamento', timestamps: true })

// Índices (conforme diagrama): QR único, chave_origem única (idempotência), projeto+arranjo.
AtivoEquipamentoSchema.index({ qr_code: 1 },      { unique: true, partialFilterExpression: { qr_code: { $type: 'string' } } })
AtivoEquipamentoSchema.index({ chave_origem: 1 }, { unique: true, partialFilterExpression: { chave_origem: { $type: 'string' } } })
AtivoEquipamentoSchema.index({ projeto_id: 1, arranjo_id: 1 })

export const AtivoEquipamento = mongoose.models.AtivoEquipamento || mongoose.model('AtivoEquipamento', AtivoEquipamentoSchema)
export default AtivoEquipamento
