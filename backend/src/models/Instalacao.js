import mongoose from 'mongoose'

/**
 * Instalação Fotovoltaica [AR-4] — S2-FV-TOPOLOGY-FOUNDATION-01
 *
 * Aggregate Root OFICIAL da topologia elétrica do domínio FV aprovado.
 * Nesta sprint nasce MÍNIMA: apenas o container da topologia
 *   Instalação └── Geradores[] └── MPPT[] └── Strings[]
 *
 * Constituição: FV-DOMAIN-MODEL-01 §AR-4 · S1-FV-UNIFIED-DOMAIN-MODEL §4.6/§4.8/§4.9/§4.10.
 *
 * ISOLADA: não é referenciada por ProjetoFV, não migra dados, não é consumida
 * por Engenharia/Unifilar/OCR/Workflow. Existe só para receber Gerador/MPPT/String.
 *
 * NÃO MATERIALIZADO nesta sprint (fidelidade ao escopo aprovado): Alocações de UC,
 * Sistema de Armazenamento, Ramais CA, Quadros, Aterramento, Engenharia,
 * Homologação, As-Built. Serão adicionados em sprints próprias.
 *
 * NADA DERIVADO É PERSISTIDO (INV-58): kWp, Voc, Vmpp, Isc, potência, oversizing,
 * contagens, saldo, área ocupada — nenhum desses campos existe neste schema.
 */

// ── Item de composição da String [VO] ────────────────────────────────────────
// composição = LISTA de { módulo, quantidade }. K (total) é DERIVADO → não existe.
const ItemComposicaoSchema = new mongoose.Schema({
  modulo_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipamento', required: true },
  quantidade: { type: Number, required: true, min: 1 },   // quantidade POR ITEM (nunca K da String)
}, { _id: false })

// ── String [E-04] ─────────────────────────────────────────────────────────────
// Sem identidade técnica própria: endereçada por (MPPT, indice_entrada). _id:false.
// NÃO armazena Voc/Vmpp/Isc/Pmax/kWp/área — todos derivados.
const StringSchema = new mongoose.Schema({
  indice_entrada: { type: Number, default: null },   // qual entrada física do MPPT (1..entradas_por_mppt)
  composicao: {
    type: [ItemComposicaoSchema],
    default: [],
    validate: { validator: (v) => Array.isArray(v) && v.length >= 1, message: 'String exige composição com ≥1 item' },
  },
  // Referência à Superfície [E-01] por identidade (_id do subdoc dentro de um Local).
  superficie_id:  { type: mongoose.Schema.Types.ObjectId, required: true },
  // Otimizador opcional (um por módulo quando presente). Referência ao Catálogo.
  otimizador_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipamento', default: null },
}, { _id: false })

// ── MPPT [E-03] ───────────────────────────────────────────────────────────────
// Entidade interna do Gerador, SEM identidade própria (endereçada por índice).
// A QUANTIDADE de MPPTs é determinada exclusivamente pelo Catálogo (n_mppts) na
// materialização do Gerador — nunca parametrizada manualmente (INV-03).
const MpptSchema = new mongoose.Schema({
  indice:  { type: Number, required: true },   // 1..n_mppts (do Catálogo do inversor)
  strings: { type: [StringSchema], default: [] },
  // NÃO armazena janela de tensão, corrente máxima, corrente total — derivados do Catálogo.
}, { _id: false })

// ── Gerador [E-02] ────────────────────────────────────────────────────────────
// TEM identidade técnica própria (_id). Um Gerador = um inversor físico + topologia.
// NÃO armazena: rótulo, potência, kWp, oversizing, contagens (derivados);
// letra (A/B/C), tipo (principal/secundário), fase_projeto, origem, somente_leitura
// (não existem — a distinção original/ampliação é referência entre Instalações).
const GeradorSchema = new mongoose.Schema({
  inversor_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipamento', required: true },
  // Ramal CA [E-05] DEFERIDO nesta sprint → referência nula, materializada depois.
  ramal_ca_ref: { type: mongoose.Schema.Types.ObjectId, default: null },
  apelido:      { type: String, default: null },   // etiqueta humana opcional (rótulo é derivado)
  mppts:        { type: [MpptSchema], default: [] },
}, { _id: true })

// ── Instalação [AR-4] — mínima (só topologia) ────────────────────────────────
const InstalacaoSchema = new mongoose.Schema({
  // IMPL-000 (Fase 0.5) — M-4: isolamento organizacional. Aditivo, default null.
  empresa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', default: null, index: true },
  // Âncora opcional ao Local [AR-2] (referência, não subdomínio materializado).
  // Permite resolver os superficie_id das Strings; default null nesta sprint.
  local_ref:  { type: mongoose.Schema.Types.ObjectId, ref: 'Local', default: null, index: true },
  geradores:  { type: [GeradorSchema], default: [] },
  _schema_versao: { type: String, default: '1.0' },
}, { timestamps: true })

export const Instalacao = mongoose.model('Instalacao', InstalacaoSchema)
export default Instalacao
