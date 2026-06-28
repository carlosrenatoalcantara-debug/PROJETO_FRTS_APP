import mongoose from 'mongoose'
import { derivarChaveCanonica } from '../utils/catalogo/chaveCanonicaMaterial.js'

/**
 * Material — P0-CATALOGO-MESTRE-MATERIAIS (Fase 1: infraestrutura)
 *
 * Catálogo Mestre de Materiais elétricos (SSOT de FV/EV/BESS/Obras). NÃO é ERP.
 * Schema MÍNIMO aprovado — sem campos preventivos/hipotéticos. Estoque, matcher,
 * importação Excel, edição em massa e snapshot pertencem às próximas fases.
 *
 * Identidade:
 *   - _id (Mongo)  → âncora referencial imutável (toda referência usa isto)
 *   - chaveCanonica → business key derivada (única por empresa), recalculável
 */

// Unidades canônicas (vocabulário de medida — infra, não conteúdo). Extensível.
export const UNIDADES_CANONICAS = ['un', 'm', 'barra', 'rolo', 'jogo', 'par', 'cento', 'kg', 'm2', 'L', 'cx', 'pc']

export const STATUS_MATERIAL = ['ativo', 'pendente_revisao', 'inativo']
export const CLASSES_MATERIAL = ['commodity', 'engenharia']

const EspecificacaoSchema = new mongoose.Schema({
  // chave DEVE existir no DicionarioCanonico (validado na camada de serviço/controller).
  chave:   { type: String, required: true, trim: true },
  // valor como String (nunca Mixed); o `tipo` do DicionarioCanonico define a interpretação.
  valor:   { type: String, required: true, trim: true },
  unidade: { type: String, default: null, trim: true },
}, { _id: false })

const CompraSchema = new mongoose.Schema({
  data:       { type: Date, required: true },
  fornecedor: { type: String, required: true, trim: true },
  valor:      { type: Number, required: true, min: 0 },
  observacao: { type: String, default: null, trim: true },
}, { _id: false })

const PrecoReferenciaSchema = new mongoose.Schema({
  valor:        { type: Number, default: null, min: 0 },
  moeda:        { type: String, default: 'BRL' },
  atualizadoEm: { type: Date, default: null },
  atualizadoPor:{ type: String, default: null },
}, { _id: false })

const MaterialSchema = new mongoose.Schema(
  {
    // Multi-tenant: DB compartilhado, convenção `empresa_id` (default null = "default"),
    // espelha ProjetoFV/User. Populado a partir do JWT (req.auth.empresa_id) no controller.
    empresa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', default: null, index: true },

    descricao: { type: String, required: true, trim: true },
    // Soft-reference (chave natural) para CategoriaMaterial.chave — evita migração
    // futura String→relacionamento. Enforcement contra a taxonomia é da Fase 2.
    categoria: { type: String, required: true, trim: true, lowercase: true },
    classe:    { type: String, required: true, enum: CLASSES_MATERIAL },
    unidade:   { type: String, required: true, enum: UNIDADES_CANONICAS },

    // Apenas engenharia: fabricante/modelo fazem parte da identidade.
    fabricante: {
      type: String, trim: true, default: null,
      required: function () { return this.classe === 'engenharia' },
    },
    modelo: {
      type: String, trim: true, default: null,
      required: function () { return this.classe === 'engenharia' },
    },

    especificacoes: { type: [EspecificacaoSchema], default: [] },   // EAV controlado
    aliases:        { type: [String], default: [] },

    // Derivada no hook pre('validate') — única por empresa (índice composto abaixo).
    chaveCanonica: { type: String, required: true, index: true },

    precoReferencia: { type: PrecoReferenciaSchema, default: () => ({}) },

    // Histórico bounded (máx. 5) — append via $push/$slice:-5 na camada de serviço.
    historicoCompras: { type: [CompraSchema], default: [] },

    // Estado único (substitui ativo:Boolean). Default 'ativo' p/ criação manual.
    status: { type: String, required: true, enum: STATUS_MATERIAL, default: 'ativo', index: true },
  },
  { timestamps: true }
)

// Unicidade da identidade canônica por empresa (impede duplicatas lógicas).
MaterialSchema.index({ empresa_id: 1, chaveCanonica: 1 }, { unique: true })
// Listagem/filtros mais comuns.
MaterialSchema.index({ empresa_id: 1, categoria: 1, status: 1 })

// Fallback defensivo: o controller deriva a chave canônica de forma template-aware
// (apenas atributos de identidade). Este hook só atua se a chave não vier setada
// (ex.: save direto sem passar pelo controller) — usa todas as especificações.
MaterialSchema.pre('validate', function aplicarChaveCanonicaFallback() {
  if (this.chaveCanonica) return
  this.chaveCanonica = derivarChaveCanonica({
    classe: this.classe,
    categoria: this.categoria,
    fabricante: this.fabricante,
    modelo: this.modelo,
    especificacoes: this.especificacoes,
  })
})

export const Material = mongoose.model('Material', MaterialSchema)
