import mongoose from 'mongoose'

/**
 * Baseline Contratual [AR-8] — FV-DOM-001 (Fase 1 do fluxo canônico).
 *
 * SNAPSHOT CONGELADO do único Orçamento aprovado de um Projeto FV. É a
 * materialização da metainvariante M-2 (imutabilidade da baseline congelada) da
 * ADR-021 e o que destrava o Gate para Engenharia e Homologação.
 *
 * ── Autocontido por construção ───────────────────────────────────────────────
 * "Nenhum dado do Baseline pode depender de leitura dinâmica posterior."
 *
 * Por isso `conteudo` guarda uma CÓPIA INTEGRAL do orçamento e da cotação no
 * instante da aprovação — incluindo os TOTAIS já calculados. Este é o único
 * lugar do domínio onde persistir valor derivado é correto: reconstruí-los mais
 * tarde leria um Catálogo que pode ter mudado de preço, e o que foi contratado
 * deixaria de ser recuperável.
 *
 * As referências (`orcamento_ref`, `cotacao_ref`, `projeto_ref`) existem como
 * PROVENIÊNCIA (M-3) — rastreiam a origem. NÃO são caminho de resolução: nada
 * em `conteudo` precisa delas para ser lido.
 *
 * ── Imutabilidade ────────────────────────────────────────────────────────────
 * Todo campo é `immutable`. Mongoose descarta silenciosamente a alteração de um
 * campo imutável em documento já persistido; o serviço complementa negando
 * qualquer operação de atualização. Corrigir um Baseline é impossível por
 * desenho: o caminho é emitir um novo orçamento e aprová-lo.
 */

const BaselineSchema = new mongoose.Schema({
  // M-4: isolamento organizacional.
  empresa_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', default: null, index: true, immutable: true },

  // ── Proveniência (M-3) — rastreabilidade, NÃO caminho de leitura ──────────
  projeto_ref:  { type: mongoose.Schema.Types.ObjectId, ref: 'ProjetoFV', required: true, index: true, immutable: true },
  orcamento_ref:{ type: mongoose.Schema.Types.ObjectId, ref: 'Orcamento', required: true, immutable: true },
  cotacao_ref:  { type: mongoose.Schema.Types.ObjectId, ref: 'Cotacao',   required: true, immutable: true },

  // ── Conteúdo congelado — autocontido ─────────────────────────────────────
  // Mixed porque espelha fielmente a forma do orçamento e da cotação no momento
  // do congelamento; tipar aqui obrigaria a versionar o snapshot junto com os
  // agregados de origem, que é exatamente o acoplamento que a baseline evita.
  conteudo: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    immutable: true,
  },

  // Integridade: hash determinístico de `conteudo`. Permite provar que o
  // snapshot não foi adulterado fora da aplicação.
  hash:        { type: String, required: true, immutable: true },
  algoritmo:   { type: String, default: 'sha256', immutable: true },

  // ── Congelamento (M-3) ───────────────────────────────────────────────────
  congelado_em:  { type: Date,   required: true, default: Date.now, immutable: true },
  congelado_por: { type: String, default: null, immutable: true },

  _schema_versao: { type: String, default: '1.0', immutable: true },
}, {
  timestamps: { createdAt: true, updatedAt: false },   // updatedAt não faz sentido: nunca muda
})

/**
 * INV-BAS-3 — no máximo UM Baseline por projeto nesta fase.
 *
 * Decorre de INV-ORC-3 (um único orçamento aprovado). Baselines versionadas por
 * aditivo contratual são matéria de sprint futura; até lá, a unicidade é
 * garantida no banco.
 */
BaselineSchema.index({ projeto_ref: 1 }, { unique: true, name: 'unico_baseline_por_projeto' })
BaselineSchema.index({ orcamento_ref: 1 }, { unique: true, name: 'unico_baseline_por_orcamento' })

/**
 * Bloqueia atualização por qualquer caminho de QUERY (M-2).
 *
 * `{ document: false, query: true }` é obrigatório: em Mongoose ≥ 7 hooks como
 * `updateOne` são ambíguos (existem nas duas formas) e, sem a opção, registram
 * também como middleware de documento — onde a assinatura é outra.
 */
function negarAtualizacao() {
  throw Object.assign(
    new Error('Baseline é imutável — não pode ser atualizada. Emita um novo orçamento e aprove-o.'),
    { status: 409, codigo: 'BASELINE_IMUTAVEL' },
  )
}
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace', 'replaceOne']) {
  BaselineSchema.pre(op, { document: false, query: true }, negarAtualizacao)
}

/** Exclusão também é negada: a baseline registra o que foi contratado. */
function negarExclusao() {
  throw Object.assign(
    new Error('Baseline é imutável — não pode ser excluída.'),
    { status: 409, codigo: 'BASELINE_IMUTAVEL' },
  )
}
for (const op of ['deleteOne', 'deleteMany', 'findOneAndDelete']) {
  BaselineSchema.pre(op, { document: false, query: true }, negarExclusao)
}

export const Baseline = mongoose.model('Baseline', BaselineSchema)
export default Baseline
