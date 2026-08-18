import mongoose from 'mongoose'

/**
 * Cotação [AR-6] — FV-DOM-001 (Fase 1 do fluxo canônico).
 *
 * SIMULAÇÃO TÉCNICA. Um Projeto FV pode ter QUALQUER quantidade de cotações —
 * string, microinversor, híbrido, BESS — para comparação.
 *
 * O que a Cotação NÃO é (regras de domínio desta sprint):
 *  • NÃO é uma venda            → não tem valor comercial, condição ou cliente aceito
 *  • NÃO gera engenharia        → não referencia ProjetoExecutivo nem Instalação executiva
 *  • NÃO gera homologação       → não referencia parecer, concessionária ou ART
 *
 * Por isso este agregado não possui NENHUMA referência de saída para engenharia
 * ou homologação: a impossibilidade é estrutural, não uma regra que alguém possa
 * esquecer de aplicar.
 *
 * A ponte para o comercial é de MÃO ÚNICA e parte do outro lado: é o Orçamento
 * que aponta para a Cotação (`cotacao_ref`), nunca o contrário (M-1 — derivação
 * unidirecional).
 *
 * NADA DERIVADO É PERSISTIDO (INV-58): kWp, geração, Voc/Vmpp/Isc, oversizing,
 * área e contagens não existem aqui. A Cotação guarda PREMISSAS e COMPOSIÇÃO;
 * os resultados são derivados pelo motor de engenharia a cada leitura.
 */

/** Tecnologias de simulação suportadas. Aberto a extensão — sem enum rígido. */
export const TECNOLOGIAS_COTACAO = ['string', 'micro', 'hibrido', 'bess', 'otimizador']

// ── Item de composição [VO] ───────────────────────────────────────────────────
// Referência ao Catálogo (GLOBAL, ADR-021 A-8) + quantidade. Sem preço: preço é
// matéria do Orçamento, não da simulação técnica.
const ItemCotacaoSchema = new mongoose.Schema({
  equipamento_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipamento', required: true },
  quantidade:      { type: Number, required: true, min: 1 },
  papel:           { type: String, default: null },   // 'modulo' | 'inversor' | 'bateria' | ...
}, { _id: false })

// ── Premissas da simulação [VO] ───────────────────────────────────────────────
// ENTRADAS do cálculo. Nenhum resultado é guardado aqui (INV-58).
const PremissasSchema = new mongoose.Schema({
  consumo_kwh_mes:      { type: Number, default: null, min: 0 },
  tarifa_kwh:           { type: Number, default: null, min: 0 },
  hsp_kwh_m2_dia:       { type: Number, default: null, min: 0 },
  performance_ratio:    { type: Number, default: null, min: 0, max: 1 },
  area_disponivel_m2:   { type: Number, default: null, min: 0 },

  // FV-DOM-016A — premissa financeira do CENÁRIO.
  //
  // D3: obrigatória para calcular retorno, e SEM DEFAULT. `null` significa "não
  // informada" e produz lacuna no contrato V1 — nunca um valor assumido. `0` é
  // escolha legítima e é preservada como zero.
  //
  // Fica aqui, e não em Empresa ou ProjetoFV, porque premissa é do cenário: um
  // projeto tem N cotações, cada uma com as suas. A TMA (10 % nominal, D2) é
  // premissa do MÉTODO e permanece versionada no contrato.
  inflacao_energia_aa_pct: { type: Number, default: null, min: 0 },

  observacoes:          { type: String, default: null },
}, { _id: false })

const CotacaoSchema = new mongoose.Schema({
  // M-4: isolamento organizacional (Fase 0.5).
  empresa_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', default: null, index: true },

  // Âncora obrigatória: toda cotação pertence a um Projeto FV.
  projeto_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjetoFV', required: true, index: true },

  rotulo:      { type: String, default: null },   // etiqueta humana ('Cenário A — string')
  tecnologia:  {
    type: String,
    required: true,
    validate: {
      validator: (v) => typeof v === 'string' && v.trim().length > 0,
      message: 'tecnologia é obrigatória',
    },
  },

  premissas:   { type: PremissasSchema, default: () => ({}) },
  composicao:  { type: [ItemCotacaoSchema], default: [] },

  // Referências técnicas OPCIONAIS — contexto da simulação, não execução.
  local_ref:      { type: mongoose.Schema.Types.ObjectId, ref: 'Local',      default: null },
  instalacao_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Instalacao', default: null },

  // M-3: proveniência obrigatória.
  criado_por:  { type: String, default: null },

  _schema_versao: { type: String, default: '1.0' },
}, { timestamps: true })

// Listagem por projeto dentro da organização — o acesso mais comum.
CotacaoSchema.index({ empresa_id: 1, projeto_ref: 1, createdAt: -1 })

export const Cotacao = mongoose.model('Cotacao', CotacaoSchema)
export default Cotacao
