import mongoose from 'mongoose'

/**
 * CategoriaMaterial — P0-CATALOGO-MESTRE-MATERIAIS (Fase 2A)
 *
 * Template de Categoria: define o SCHEMA dos materiais de uma categoria. É a
 * autoridade de vocabulário e de regras de cadastro (substitui, para materiais,
 * o uso do DicionarioCanonico global — mais preciso, pois é por categoria).
 *
 * Responsabilidades:
 *   - atributos obrigatórios e opcionais (impede cadastro incompleto);
 *   - quais atributos compõem a identidade (chaveCanonica);
 *   - como a descrição é gerada automaticamente (padronização).
 *
 * Relacionamento com Material por SLUG natural: Material.categoria === chave.
 * fabricante/modelo são campos próprios do Material (engenharia) — NÃO entram em
 * `atributos[]` (que descreve apenas as especificações EAV), mas podem ser
 * referenciados no `descricaoTemplate` via {fabricante} / {modelo}.
 */

// Definição de um atributo (especificação EAV) da categoria.
const AtributoTemplateSchema = new mongoose.Schema({
  chave:       { type: String, required: true, trim: true },          // ex.: 'bitola_mm2'
  rotulo:      { type: String, default: null, trim: true },           // ex.: 'Bitola (mm²)'
  tipo:        { type: String, enum: ['number', 'int', 'string', 'enum'], default: 'string' },
  unidade:     { type: String, default: null, trim: true },
  obrigatorio: { type: Boolean, default: false },
  identidade:  { type: Boolean, default: false },                     // participa da chaveCanonica
  enumValores: { type: [String], default: [] },                       // quando tipo='enum'
}, { _id: false })

const CategoriaMaterialSchema = new mongoose.Schema(
  {
    // Multi-tenant: mesma convenção do Material (banco compartilhado).
    // Ver docs/DECISAO-MULTITENANCY-CATALOGO-MATERIAIS.md
    empresa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', default: null, index: true },

    chave:  { type: String, required: true, trim: true, lowercase: true },   // slug = Material.categoria
    rotulo: { type: String, default: null, trim: true },
    classe: { type: String, required: true, enum: ['commodity', 'engenharia'] },

    atributos:        { type: [AtributoTemplateSchema], default: [] },
    descricaoTemplate:{ type: String, default: null, trim: true },           // ex.: 'Cabo Flexível {bitola_mm2} mm² ...'

    ativo: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
)

CategoriaMaterialSchema.index({ empresa_id: 1, chave: 1 }, { unique: true })

export const CategoriaMaterial = mongoose.model('CategoriaMaterial', CategoriaMaterialSchema)
