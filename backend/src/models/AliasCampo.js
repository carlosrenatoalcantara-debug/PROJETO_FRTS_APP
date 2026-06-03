import mongoose from 'mongoose'

/**
 * AliasCampo — CAT-KB-01
 *
 * Conhecimento "como o mundo escreve" → "nosso vocabulário canônico".
 * Três espécies (campo `tipo`):
 *   - 'rotulo'       → rótulo de datasheet (PT/EN) que aponta para um campo
 *                      técnico. `alias_original` guarda o PADRÃO (regex source)
 *                      usado pelo parser. `campo_canonico` = chave do parser.
 *   - 'nomenclatura' → nome de campo devolvido por IA (Claude/Gemini) que
 *                      mapeia para a chave canônica de especificacoes.
 *   - 'fabricante'   → texto que identifica um fabricante. `fabricante` = nome
 *                      canônico; `campo_canonico` = '_fabricante'.
 *
 * `fabricante: null` ⇒ alias GLOBAL (vale para todos). Sem score de confiança,
 * sem aprendizado automático — apenas o conhecimento migrado do código (seed).
 */
const AliasCampoSchema = new mongoose.Schema({
  campo_canonico:    { type: String, required: true },
  alias_original:    { type: String, required: true }, // regex/label/nome exatamente como usado
  alias_normalizado: { type: String, required: true }, // lower, sem acento, espaços colapsados
  tipo:              { type: String, enum: ['rotulo', 'nomenclatura', 'fabricante'], required: true },
  fabricante:        { type: String, default: null },  // null = global
  idioma:            { type: String, default: null },  // 'pt' | 'en' | null
  origem:            { type: String, default: 'seed' },
}, { timestamps: true })

// Resolução rápida (rótulo por campo / alias por fabricante)
AliasCampoSchema.index({ tipo: 1, campo_canonico: 1 })
AliasCampoSchema.index({ tipo: 1, fabricante: 1 })
// Idempotência do seed: não duplica o mesmo alias para o mesmo campo/fabricante
AliasCampoSchema.index(
  { tipo: 1, campo_canonico: 1, alias_normalizado: 1, fabricante: 1 },
  { unique: true },
)

export const AliasCampo = mongoose.model('AliasCampo', AliasCampoSchema)
