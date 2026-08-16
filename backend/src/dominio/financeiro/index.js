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
 * ── D3 pendente ──────────────────────────────────────────────────────────────
 * A inflação energética é lida do projeto quando existir. Não há default: se o
 * projeto não a tem, o contrato devolve os indicadores dependentes como `null`
 * e a lacuna aparece na resposta. Nenhum valor é assumido.
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
 * Monta entradas + premissas + proveniência a partir do projeto e do orçamento
 * canônico vigente.
 *
 * @param {object} projeto        ProjetoFV (lean)
 * @param {object} [opts]
 * @param {object} [opts.orcamento]  agregado `Orcamento` aprovado/vigente
 */
export function adaptarProjetoParaFinanceiro(projeto, { orcamento = null } = {}) {
  if (!projeto) throw new Error('adaptarProjetoParaFinanceiro: projeto ausente')

  const fatura = projeto.fatura_extracao ?? {}
  const dim = projeto.dimensionamento ?? {}
  const eng = projeto.engenharia_eletrica ?? {}

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
  const investimento = primeiro([
    ['orcamento.total_r', orcamento?.total_r],
    ['orcamento.conteudo.total_r', orcamento?.conteudo?.total_r],
  ])
  const tarifa = primeiro([
    ['fatura_extracao.tarifa_kwh', fatura.tarifa_kwh],
    ['projeto.valor_kwh', projeto.valor_kwh],
  ])
  // D3 PENDENTE: lido se o projeto tiver; jamais preenchido com default.
  const inflacao = primeiro([
    ['projeto.premissas_financeiras.inflacao_energia_aa_pct', projeto.premissas_financeiras?.inflacao_energia_aa_pct],
  ])
  const reajuste = primeiro([
    ['orcamento.reajuste_anual_pct', orcamento?.reajuste_anual_pct],
    ['projeto.premissas_financeiras.reajuste_tarifa_aa_pct', projeto.premissas_financeiras?.reajuste_tarifa_aa_pct],
  ])
  const consumo = primeiro([
    ['fatura_extracao.media_anual_kwh', fatura.media_anual_kwh],
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
export function calcularFinanceiroDoProjeto(projeto, { orcamento = null, agora = null } = {}) {
  const { entradas, premissas, proveniencia } = adaptarProjetoParaFinanceiro(projeto, { orcamento })
  return calcularContratoV1({ entradas, premissas, proveniencia, agora })
}
