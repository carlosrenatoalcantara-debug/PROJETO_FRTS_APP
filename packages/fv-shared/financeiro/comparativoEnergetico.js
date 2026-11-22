/**
 * comparativoEnergetico.js — consumo × geração de cada opção — FV-ORC-000 Fase 1.
 *
 * ── O que responde ───────────────────────────────────────────────────────────
 * Para cada opção de kit de uma proposta: quanto a usina gera por mês, quanto
 * isso cobre da média de consumo e dos meses de referência (os dois últimos e a
 * média deles), quanto falta e quantos kWp a mais cobririam a falta.
 *
 * ── Regras de negócio (decisões D1 e D3) ─────────────────────────────────────
 *   • Geração = kWp × produtividade (kWh/kWp/mês). A produtividade é ENTRADA:
 *     vem de HSP × dias × eficiência (`produtividadeMensal`) ou de um valor que a
 *     empresa adota. Este módulo não escolhe eficiência nem HSP.
 *   • O dimensionamento-base é a MÉDIA do período informado. Os dois últimos
 *     meses são referência de alerta, não de dimensionamento.
 *   • Crédito de geração existente (GD) só existe em AMPLIAÇÃO e entra UMA vez,
 *     somado à geração nova. Usina nova passa `creditoExistenteKwh` nulo ou 0.
 *
 * ── O que NÃO faz ────────────────────────────────────────────────────────────
 * Não arredonda para exibição (o documento arredonda), não lê fatura, não
 * inventa mês ausente. Entrada inválida vira lacuna declarada e valor `null`,
 * nunca zero.
 *
 * Puro: sem I/O, sem React, sem Mongoose.
 */

/** Dias por mês usados na produtividade mensal — mesma convenção da proposta. */
export const DIAS_MES_PADRAO = 30

function _num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

const _pos = (v) => { const n = _num(v); return n !== null && n > 0 ? n : null }
const _naoNeg = (v) => { const n = _num(v); return n !== null && n >= 0 ? n : null }

/**
 * Produtividade mensal (kWh/kWp/mês) = HSP × dias × eficiência.
 * Ex.: 5,78 × 30 × 0,75 ≈ 130.
 * @returns {number|null} null se alguma entrada for inválida
 */
export function produtividadeMensal({ hsp, eficiencia, dias = DIAS_MES_PADRAO } = {}) {
  const h = _pos(hsp)
  const e = _pos(eficiencia)
  const d = _pos(dias)
  if (h === null || e === null || e > 1 || d === null) return null
  return h * d * e
}

/**
 * Estatística do histórico de consumo.
 *
 * @param {Array<{mes:string, kwh:number}>} historico  em ordem cronológica
 *   (mais antigo → mais recente). Quem chama decide o período (normalmente os
 *   12 meses mais recentes da fatura).
 */
export function estatisticaConsumo(historico) {
  const lacunas = []
  const lista = Array.isArray(historico) ? historico : []
  const validos = []
  lista.forEach((m, i) => {
    const kwh = _naoNeg(m?.kwh)
    if (kwh === null) lacunas.push(`Mês ${m?.mes ?? `#${i + 1}`} sem consumo válido — fora da média.`)
    else validos.push({ mes: m?.mes ?? null, kwh })
  })

  if (validos.length === 0) {
    lacunas.push('Histórico de consumo vazio: não há média para comparar.')
    return { meses: 0, media_kwh: null, ultimos: [], media_ultimos_kwh: null, maiores: [], lacunas }
  }

  const media = validos.reduce((s, m) => s + m.kwh, 0) / validos.length
  const variacao = (kwh) => (media > 0 ? ((kwh - media) / media) * 100 : null)
  const comVariacao = (m) => ({ ...m, variacao_pct: variacao(m.kwh) })

  const ultimos = validos.slice(-2).map(comVariacao)
  const mediaUltimos = ultimos.reduce((s, m) => s + m.kwh, 0) / ultimos.length
  const maiores = [...validos].sort((a, b) => b.kwh - a.kwh).slice(0, 2).map(comVariacao)

  if (validos.length < 12) {
    lacunas.push(`Histórico com ${validos.length} mês(es): a média não cobre um ano.`)
  }

  return {
    meses: validos.length,
    media_kwh: media,
    ultimos,
    media_ultimos_kwh: mediaUltimos,
    media_ultimos_variacao_pct: variacao(mediaUltimos),
    maiores,
    lacunas,
  }
}

/** Referências de comparação: média do período, média dos 2 últimos e cada um deles. */
function _referencias(est) {
  if (est.media_kwh === null) return []
  const refs = [{ chave: 'media', rotulo: 'Média do período', kwh: est.media_kwh }]
  if (est.ultimos.length === 2) {
    refs.push({ chave: 'media_ultimos', rotulo: 'Média dos 2 últimos meses', kwh: est.media_ultimos_kwh })
  }
  est.ultimos.forEach((m, i) => {
    refs.push({ chave: `ultimo_${est.ultimos.length - i}`, rotulo: m.mes ?? `Último ${est.ultimos.length - i}`, mes: m.mes, kwh: m.kwh })
  })
  return refs
}

/**
 * Compara cada opção contra o consumo.
 *
 * @param {Object} p
 * @param {Array<{mes:string,kwh:number}>} p.historico
 * @param {number} p.produtividadeKwhKwpMes
 * @param {number|null} [p.creditoExistenteKwh]  só em ampliação (D3)
 * @param {Array<{id:string, potencia_kwp:number}>} p.opcoes
 */
export function compararOpcoes({
  historico, produtividadeKwhKwpMes, creditoExistenteKwh = null, opcoes = [],
} = {}) {
  const lacunas = []
  const est = estatisticaConsumo(historico)
  lacunas.push(...est.lacunas)

  const prod = _pos(produtividadeKwhKwpMes)
  if (prod === null) lacunas.push('Produtividade (kWh/kWp/mês) ausente ou inválida: geração não calculada.')

  let credito = 0
  if (creditoExistenteKwh !== null && creditoExistenteKwh !== undefined) {
    const c = _naoNeg(creditoExistenteKwh)
    if (c === null) lacunas.push('Crédito de geração existente inválido: desconsiderado.')
    else credito = c
  }

  const referencias = _referencias(est)

  const resultado = (Array.isArray(opcoes) ? opcoes : []).map((op, i) => {
    const id = op?.id ?? String(i + 1)
    const kwp = _pos(op?.potencia_kwp)
    const lacunasOpcao = []
    if (kwp === null) lacunasOpcao.push('Potência CC (kWp) ausente ou inválida.')

    const geracaoNova = kwp !== null && prod !== null ? kwp * prod : null
    const total = geracaoNova === null ? null : geracaoNova + credito

    const comparacoes = referencias.map((ref) => {
      if (total === null) {
        return { ...ref, saldo_kwh: null, deficit_kwh: null, excedente_kwh: null, kwp_adicional: null }
      }
      const saldo = total - ref.kwh
      const deficit = saldo < 0 ? -saldo : 0
      return {
        ...ref,
        saldo_kwh: saldo,
        deficit_kwh: deficit,
        excedente_kwh: saldo > 0 ? saldo : 0,
        kwp_adicional: deficit / prod,
      }
    })

    return {
      id,
      potencia_kwp: kwp,
      geracao_nova_kwh: geracaoNova,
      credito_existente_kwh: credito,
      total_kwh: total,
      cobertura_media_pct: total !== null && est.media_kwh > 0 ? (total / est.media_kwh) * 100 : null,
      comparacoes,
      lacunas: lacunasOpcao,
    }
  })

  return {
    produtividade_kwh_kwp_mes: prod,
    credito_existente_kwh: credito,
    consumo: est,
    referencias,
    opcoes: resultado,
    lacunas,
  }
}

export default { DIAS_MES_PADRAO, produtividadeMensal, estatisticaConsumo, compararOpcoes }
