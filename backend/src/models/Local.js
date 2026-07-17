import mongoose from 'mongoose'

/**
 * Local de Instalação [AR-2] — S1-FV-DOMAIN-MIGRATION-01
 *
 * Agregado raiz que representa o SÍTIO GEOGRÁFICO físico onde os equipamentos
 * são fixados. Fonte das condições ambientais que governam todo cálculo elétrico
 * e de geração. Contém as Superfícies do imóvel (composição — o Local é o dono).
 *
 * Constituição: FV-DOMAIN-MODEL-01 §AR-2 · S1-FV-UNIFIED-DOMAIN-MODEL §4.2/§4.3.
 *
 * DERIVADOS QUE NUNCA SÃO PERSISTIDOS AQUI (INV-58):
 *   - HSP efetivo por Superfície  (f: HSP₀, azimute, inclinação — Motor de Engenharia)
 *   - área ocupada / área residual / capacidade residual da Superfície
 * Esses campos NÃO existem neste schema; são calculados em leitura.
 *
 * ESCOPO S1: agregado criado e populado por backfill. NÃO referencia Instalação,
 * NÃO cria Gerador/MPPT/String, NÃO migra topologia.
 */

// ── Value Object: Coordenadas ────────────────────────────────────────────────
const CoordenadasSchema = new mongoose.Schema({
  latitude:  { type: Number, default: null, immutable: true },
  longitude: { type: Number, default: null, immutable: true },
}, { _id: false })

// ── Value Object: Endereço ───────────────────────────────────────────────────
const EnderecoSchema = new mongoose.Schema({
  endereco_completo: { type: String, default: null },
  cep:               { type: String, default: null },
  cidade:            { type: String, default: null },
  estado:            { type: String, default: null },
}, { _id: false })

// ── Entidade: Superfície [E-01] (subdoc — pertence ao Local, INV-10) ──────────
// Tem _id próprio (ObjectId) → identidade referenciável pela String em S2.
const SuperficieSchema = new mongoose.Schema({
  nome:              { type: String, required: true },           // etiqueta humana
  area_disponivel_m2:{ type: Number, default: null },            // primitivo medido

  // azimute/inclinação são IMUTÁVEIS: se mudarem, é outra Superfície (contrato §5).
  azimute_graus:     { type: Number, default: null, immutable: true, min: 0, max: 360 }, // 0 = norte verdadeiro
  inclinacao_graus:  { type: Number, default: null, immutable: true, min: 0, max: 90 },

  tipo_cobertura: {
    type: String,
    enum: ['ceramico', 'metalico', 'fibrocimento', 'laje', 'madeira', 'solo', 'carport', 'outro', null],
    default: null,
  },
  metodo_fixacao:      { type: String, default: null },
  sombreamento_parcial:{ type: Boolean, default: false },
  capacidade_carga_kg_m2: { type: Number, default: null },

  estado: { type: String, enum: ['ativa', 'encerrada'], default: 'ativa' },

  // Proveniência do backfill (rastreabilidade; não é atributo de domínio).
  origem: {
    projeto_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'ProjetoFV', default: null },
    fonte:        { type: String, default: null },   // 'backfill_localizacao' | 'backfill_telhado' | 'manual'
    migrado_em:   { type: Date,   default: null },
  },
}, { _id: true, timestamps: true })

// ── Agregado raiz: Local ─────────────────────────────────────────────────────
const LocalSchema = new mongoose.Schema({
  // Identidade natural = coordenadas (imutáveis). Identidade técnica = _id.
  coordenadas: { type: CoordenadasSchema, default: () => ({}) },
  endereco:    { type: EnderecoSchema,    default: () => ({}) },

  // Condições ambientais (primitivos brutos do local).
  hsp0_kwh_m2_dia:        { type: Number, default: null },  // irradiância horizontal (dado bruto)
  fonte_irradiancia: {
    type: String,
    enum: ['nasa_power', 'manual', 'padrao_regional', null],
    default: null,
  },
  data_coleta_climatica:  { type: Date, default: null },

  temperatura_min_c:      { type: Number, default: null },  // governa K_max (Voc no frio)
  temperatura_max_c:      { type: Number, default: null },
  temperatura_media_c:    { type: Number, default: null },
  fonte_climatica:        { type: String, default: 'manual' },

  // Superfícies (composição — o Local é o único ponto de criação/edição, INV-10).
  superficies: { type: [SuperficieSchema], default: [] },

  // Proveniência do backfill.
  origem: {
    projeto_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'ProjetoFV', default: null, index: true },
    fonte:       { type: String, default: null },   // 'backfill_projetoFV' | 'manual'
    migrado_em:  { type: Date,   default: null },
  },

  _schema_versao: { type: String, default: '1.0' },
}, { timestamps: true })

// Índice geográfico leve para consulta futura por proximidade (não é chave natural).
LocalSchema.index({ 'coordenadas.latitude': 1, 'coordenadas.longitude': 1 })

export const Local = mongoose.model('Local', LocalSchema)
export default Local
