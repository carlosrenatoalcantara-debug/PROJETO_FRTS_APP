import mongoose from 'mongoose'
import { ORCAMENTO_STATUS } from '@fortesolar/fv-shared/estados/orcamento'

/**
 * Orçamento [AR-7] — FV-DOM-001 (Fase 1 do fluxo canônico).
 *
 * PROPOSTA COMERCIAL derivada de uma Cotação (M-1: a seta aponta Orçamento →
 * Cotação, nunca o inverso).
 *
 * Regras de domínio desta sprint:
 *  • N orçamentos por Projeto FV — nenhum substitui outro
 *  • nenhum é sobrescrito: mudanças geram um NOVO orçamento, com histórico intacto
 *  • apenas UM chega a APROVADO por projeto (INV-ORC-3, garantido por índice
 *    parcial único E por verificação no serviço)
 *  • aprovar CONGELA o conteúdo e origina o Baseline (M-2)
 *
 * NADA DERIVADO É PERSISTIDO (INV-58): `total_r`, `total_material_r`,
 * `total_servicos_r` NÃO existem aqui — são somas de `itens[]`, recalculadas a
 * cada leitura. A única cópia congelada de totais vive no Baseline, e ali é
 * deliberada (o Baseline não pode depender de leitura dinâmica).
 *
 * Este agregado NÃO substitui `ProjetoFV.orcamento` (subdoc 1:1 legado). Nasce
 * isolado; a convergência é matéria de sprint própria.
 */

// ── Item do orçamento [VO] ────────────────────────────────────────────────────
const ItemOrcamentoSchema = new mongoose.Schema({
  descricao:       { type: String, required: true },
  tipo:            { type: String, enum: ['material', 'servico'], default: 'material' },
  quantidade:      { type: Number, required: true, min: 0 },
  valor_unitario_r:{ type: Number, required: true, min: 0 },
  // Proveniência opcional para o Catálogo (M-3).
  equipamento_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipamento', default: null },
  material_ref:    { type: mongoose.Schema.Types.ObjectId, ref: 'Material',    default: null },
}, { _id: false })

// ── Condições comerciais [VO] ─────────────────────────────────────────────────
const CondicoesSchema = new mongoose.Schema({
  validade_dias:        { type: Number, default: 30, min: 0 },
  prazo_execucao_dias:  { type: Number, default: null, min: 0 },
  forma_pagamento:      { type: String, default: null },
  observacoes:          { type: String, default: null },
}, { _id: false })

// ── Evento de histórico [VO] — nunca removido, só acrescentado ───────────────
const EventoOrcamentoSchema = new mongoose.Schema({
  em:     { type: Date,   default: Date.now },
  de:     { type: String, default: null },
  para:   { type: String, default: null },
  por:    { type: String, default: null },
  motivo: { type: String, default: null },
}, { _id: false })

const OrcamentoSchema = new mongoose.Schema({
  // M-4: isolamento organizacional.
  empresa_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', default: null, index: true },

  projeto_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjetoFV', required: true, index: true },
  // M-1: o Orçamento deriva de UMA Cotação. Imutável — trocar a origem
  // descaracterizaria a proposta; o caminho é emitir outro orçamento.
  cotacao_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Cotacao', required: true, immutable: true },

  numero:      { type: String, default: null },
  versao:      { type: Number, default: 1, min: 1 },

  estado: {
    type: String,
    enum: ORCAMENTO_STATUS,
    default: 'RASCUNHO',
    index: true,
  },

  itens:      { type: [ItemOrcamentoSchema], default: [] },
  condicoes:  { type: CondicoesSchema, default: () => ({}) },

  // Marcos do ciclo — escritos pelo serviço, um por transição.
  emitido_em:   { type: Date,   default: null },
  emitido_por:  { type: String, default: null },
  aprovado_em:  { type: Date,   default: null },
  aprovado_por: { type: String, default: null },
  encerrado_em: { type: Date,   default: null },   // rejeição ou cancelamento
  encerrado_por:{ type: String, default: null },
  motivo_encerramento: { type: String, default: null },

  // Preenchido na aprovação. Aponta para o snapshot congelado (M-2).
  baseline_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Baseline', default: null },

  historico:   { type: [EventoOrcamentoSchema], default: [] },

  // M-3: proveniência obrigatória.
  criado_por:  { type: String, default: null },

  _schema_versao: { type: String, default: '1.0' },
}, { timestamps: true })

/**
 * INV-ORC-3 — no máximo UM orçamento APROVADO por projeto.
 *
 * Índice parcial único: só indexa documentos em APROVADO, então RASCUNHO,
 * EMITIDO, REJEITADO e CANCELADO podem coexistir livremente. Esta é a garantia
 * de última instância; o serviço também verifica antes de gravar, para devolver
 * erro de domínio em vez de erro de driver.
 */
OrcamentoSchema.index(
  { projeto_ref: 1 },
  { unique: true, partialFilterExpression: { estado: 'APROVADO' }, name: 'unico_aprovado_por_projeto' },
)

OrcamentoSchema.index({ empresa_id: 1, projeto_ref: 1, createdAt: -1 })

export const Orcamento = mongoose.model('Orcamento', OrcamentoSchema)
export default Orcamento
