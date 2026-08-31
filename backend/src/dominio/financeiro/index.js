/**
 * dominio/financeiro — adapter do contrato financeiro V1 — FV-DOM-012.
 *
 * Traduz um `ProjetoFV` persistido para as entradas do contrato e declara a
 * proveniência de cada campo (M-3). O CÁLCULO todo vive em
 * `@fortesolar/fv-shared/financeiro/contrato-v1` — aqui não há fórmula alguma.
 *
 * ── O que este módulo NÃO faz ────────────────────────────────────────────────
 * Não persiste (INV-58: indicadores financeiros são derivados). Não aceita
 * totais vindos do cliente. Não inventa valor ausente — o que o projeto não
 * tem vira lacuna declarada.
 *
 * ── Premissas do cenário (FV-DOM-016A) ───────────────────────────────────────
 * Tarifa e inflação vêm da `Cotacao` que originou o orçamento vigente — é lá
 * que vivem as ENTRADAS do cálculo, por cenário. D3: a inflação não tem default;
 * ausente, o contrato devolve `null` nos indicadores dependentes e declara a
 * lacuna. `0` informado é preservado como zero.
 */
import { calcularContratoV1 } from '@fortesolar/fv-shared/financeiro/contrato-v1'

/** Primeiro valor não-nulo, com o rótulo da fonte. */
function primeiro(candidatos) {
  for (const [fonte, valor] of candidatos) {
    if (valor !== null && valor !== undefined && valor !== '') return { valor, fonte }
  }
  return { valor: null, fonte: null }
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Total do orçamento — DERIVADO dos itens (INV-58: nada derivado é persistido).
 * Entrada não numérica vale 0, nunca NaN. Sem itens, devolve `null` para que
 * vire lacuna em vez de um total de R$ 0 que pareceria calculado.
 */
function totalDosItens(itens) {
  if (!Array.isArray(itens) || itens.length === 0) return null
  return itens.reduce((acc, i) => {
    const q = Number(i?.quantidade)
    const v = Number(i?.valor_unitario_r)
    return acc + (Number.isFinite(q) && Number.isFinite(v) ? q * v : 0)
  }, 0)
}

/**
 * Monta entradas + premissas + proveniência a partir do projeto e do orçamento
 * canônico vigente.
 *
 * @param {object} projeto        ProjetoFV (lean)
 * @param {object} [opts]
 * @param {object} [opts.orcamento]  agregado `Orcamento` aprovado/vigente
 * @param {object} [opts.cotacao]    `Cotacao` de origem — fonte das premissas do cenário
 */
export function adaptarProjetoParaFinanceiro(projeto, { orcamento = null, cotacao = null } = {}) {
  if (!projeto) throw new Error('adaptarProjetoParaFinanceiro: projeto ausente')

  const dim = projeto.dimensionamento ?? {}

  // FV-DOM-016A: as premissas do CENÁRIO vivem na Cotação que originou o
  // orçamento vigente (`Orcamento.cotacao_ref`, immutable). Antes, o adapter
  // lia `projeto.premissas_financeiras` e `fatura_extracao.tarifa_kwh` — dois
  // caminhos que NÃO EXISTEM no schema. O strict-mode do Mongoose descartava
  // qualquer escrita, e toda inflação virava lacuna permanente.
  const premissasCotacao = cotacao?.premissas ?? {}

  // ENGINEERING LOCK: geração e potência vêm do snapshot técnico congelado
  // quando ele existe — nunca do estado vivo (E8 do contrato).
  const snapshot = projeto.governanca?.snapshot_tecnico ?? null

  const geracao = primeiro([
    ['governanca.snapshot_tecnico.geracao_anual_kwh', snapshot?.geracao_anual_kwh],
    ['dimensionamento.geracao_anual_kwh', dim.geracao_anual_kwh],
  ])
  const potenciaKwp = primeiro([
    ['governanca.snapshot_tecnico.sistema.potenciaCC', snapshot?.sistema?.potenciaCC],
    ['dimensionamento.potencia_kwp', dim.potencia_kwp],
  ])
  // Investimento: o valor do orçamento canônico. NUNCA vem do cliente.
  //
  // FV-UX-017: o agregado `Orcamento` NÃO persiste `total_r` — INV-58, declarado
  // no próprio modelo. O total é DERIVADO dos itens, como `agregadosFvController`
  // já fazia. Ler `orcamento.total_r` devolvia `undefined` sempre, e o
  // investimento virava lacuna permanente em todo projeto.
  const investimento = primeiro([
    ['orcamento.itens (derivado)', totalDosItens(orcamento?.itens)],
    ['orcamento.conteudo.itens (derivado)', totalDosItens(orcamento?.conteudo?.orcamento?.itens)],
  ])
  // Tarifa: a Cotação é a fonte canônica. `projeto.valor_kwh` permanece como
  // leitura de compatibilidade para projetos anteriores ao fluxo canônico.
  const tarifa = primeiro([
    ['cotacao.premissas.tarifa_kwh', premissasCotacao.tarifa_kwh],
    ['projeto.valor_kwh', projeto.valor_kwh],
  ])
  // D3: premissa obrigatória, sem default. Vem da Cotação; ausente vira lacuna.
  // `0` informado é valor legítimo — `primeiro()` só descarta null/undefined/''.
  const inflacao = primeiro([
    ['cotacao.premissas.inflacao_energia_aa_pct', premissasCotacao.inflacao_energia_aa_pct],
  ])
  // Reajuste tarifário: FV-DOM-016A NÃO adicionou o campo à Cotação — a sprint
  // decidiu adiar. Sem fonte canônica, permanece `null` e o contrato compõe só
  // com a inflação. Não há caminho fantasma aqui: `null` é o estado real.
  const reajuste = { valor: null, fonte: null }
  const consumo = primeiro([
    ['cotacao.premissas.consumo_kwh_mes×12',
      premissasCotacao.consumo_kwh_mes != null ? premissasCotacao.consumo_kwh_mes * 12 : null],
    ['projeto.consumo_kwh_mes×12', projeto.consumo_kwh_mes != null ? projeto.consumo_kwh_mes * 12 : null],
  ])

  const potWp = num(potenciaKwp.valor) == null ? null : num(potenciaKwp.valor) * 1000

  return {
    entradas: {
      investimento_r: num(investimento.valor),
      geracao_anual_kwh: num(geracao.valor),
      consumo_anual_kwh: num(consumo.valor),
      potencia_wp: potWp,
    },
    premissas: {
      tarifa_kwh: num(tarifa.valor),
      inflacao_energia_aa_pct: num(inflacao.valor),
      reajuste_tarifa_aa_pct: num(reajuste.valor),
    },
    proveniencia: {
      investimento_r: investimento.fonte,
      geracao_anual_kwh: geracao.fonte,
      consumo_anual_kwh: consumo.fonte,
      potencia_wp: potenciaKwp.fonte,
      tarifa_kwh: tarifa.fonte,
      inflacao_energia_aa_pct: inflacao.fonte,
      reajuste_tarifa_aa_pct: reajuste.fonte,
      engineering_lock: snapshot ? 'snapshot_tecnico' : 'dados_atuais',
    },
  }
}

/**
 * Executa o contrato V1 para um projeto.
 * Derivação pura: nada é gravado.
 */
export function calcularFinanceiroDoProjeto(projeto, { orcamento = null, cotacao = null, agora = null } = {}) {
  const { entradas, premissas, proveniencia } = adaptarProjetoParaFinanceiro(projeto, { orcamento, cotacao })
  return calcularContratoV1({ entradas, premissas, proveniencia, agora })
}
