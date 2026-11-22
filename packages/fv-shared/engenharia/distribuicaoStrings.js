/**
 * distribuicaoStrings.js — sugestão preliminar de strings por MPPT — FV-ORC-000 Fase 1.
 *
 * ── Pergunta ─────────────────────────────────────────────────────────────────
 * Dados N módulos e um inversor (MPPTs × entradas por MPPT), como dividir os
 * módulos em strings usando TODOS eles?
 *
 * ── Regras ───────────────────────────────────────────────────────────────────
 *   1. Strings em paralelo no MESMO MPPT têm o MESMO comprimento. (O PDF feito
 *      fora do sistema pôs 11 e 12 no mesmo MPPT — erro nº 1 do diagnóstico.)
 *   2. Comprimentos possíveis: só L e L+1 (L = ⌊N/S⌋), o mais equilibrado.
 *   3. O comprimento precisa passar em `classificarTensaoCC` (Voc no frio,
 *      janela MPPT no frio e no quente). Incompatível é descartado.
 *   4. O nº de strings por MPPT não passa das entradas do catálogo, e não pode
 *      reprovar em `classificarCorrenteCC` (curto-circuito).
 *   5. Entre as soluções válidas, a de MAIS strings (strings mais curtas,
 *      entradas ocupadas). Determinístico: mesma entrada, mesma saída.
 *
 * ── Ausência não vira aprovação ──────────────────────────────────────────────
 * Sem dados de tensão, o comprimento não é filtrado e a saída declara a lacuna
 * (`tensao: nao_avaliado`). Sem MPPT/entradas no catálogo, não há distribuição.
 * A saída é sempre `preliminar`: o projeto executivo valida.
 *
 * Escopo: UM inversor. Vários inversores → quem chama divide os módulos.
 *
 * Puro: sem I/O, sem React, sem Mongoose.
 */
import { classificarTensaoCC, STATUS_TENSAO } from './classificacaoTensaoCC.js'
import { classificarCorrenteCC, STATUS_CORRENTE } from './classificacaoCorrenteCC.js'

export const STATUS_DISTRIBUICAO = Object.freeze({
  PRELIMINAR: 'preliminar',
  SEM_SOLUCAO: 'sem_solucao',
  SEM_DADOS: 'sem_dados',
})

/** Teto de busca do comprimento de string quando a tensão não limita. */
const MAX_MODULOS_STRING_BUSCA = 60

function _num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}
const _inteiroPos = (v) => { const n = _num(v); return n !== null && Number.isInteger(n) && n > 0 ? n : null }

function _tensao(n, modulo, inversor, clima) {
  return classificarTensaoCC({
    voc: modulo.voc, vmpp: modulo.vmpp,
    coefTempVoc: modulo.coef_temp_voc, coefTempVmpp: modulo.coef_temp_vmpp,
    tempNoct: modulo.noct ?? undefined,
    modulosPorString: n,
    tensaoMaxEntrada: inversor.tensao_max_entrada,
    mpptMin: inversor.mppt_min, mpptMax: inversor.mppt_max,
    tMin: clima.tMin, tMax: clima.tMax,
  })
}

function _corrente(strings, modulo, inversor) {
  return classificarCorrenteCC({
    isc: modulo.isc, impp: modulo.impp, strings,
    limiteTrabalho: inversor.corrente_max_por_mppt, limiteCurto: inversor.corrente_isc_max,
  })
}

/** Distribui `qtd` strings iguais em MPPTs de até `e` entradas, enchendo cada um. */
function _blocos(qtd, e) {
  const out = []
  let resta = qtd
  while (resta > 0) { const k = Math.min(e, resta); out.push(k); resta -= k }
  return out
}

/**
 * @param {Object} p
 * @param {number} p.totalModulos
 * @param {Object} p.inversor  { numero_mppt, entradas_por_mppt, tensao_max_entrada,
 *   mppt_min, mppt_max, corrente_max_por_mppt, corrente_isc_max }
 * @param {Object} [p.modulo]  { voc, vmpp, coef_temp_voc, coef_temp_vmpp, noct, isc, impp }
 * @param {Object} [p.clima]   { tMin, tMax } (°C, ambiente)
 */
export function sugerirDistribuicaoStrings({
  totalModulos, inversor = {}, modulo = {}, clima = {},
} = {}) {
  const lacunas = []
  const N = _inteiroPos(totalModulos)
  const mppts = _inteiroPos(inversor?.numero_mppt)
  const entradas = _inteiroPos(inversor?.entradas_por_mppt)

  if (N === null) lacunas.push('Quantidade de módulos ausente ou não inteira.')
  if (mppts === null) lacunas.push('Catálogo do inversor sem número de MPPTs.')
  if (entradas === null) lacunas.push('Catálogo do inversor sem entradas (strings) por MPPT.')
  if (lacunas.length) return { status: STATUS_DISTRIBUICAO.SEM_DADOS, mppts: [], lacunas }

  // ── Faixa de comprimento pela tensão ──────────────────────────────────────
  const avaliacaoTensao = new Map()
  let tensaoAvaliada = true
  const comprimentoOk = (n) => {
    if (!avaliacaoTensao.has(n)) avaliacaoTensao.set(n, _tensao(n, modulo ?? {}, inversor, clima ?? {}))
    const t = avaliacaoTensao.get(n)
    if (t.status === STATUS_TENSAO.NAO_AVALIADO) tensaoAvaliada = false
    return t.status !== STATUS_TENSAO.INCOMPATIVEL
  }

  // ── Paralelo máximo por MPPT pela corrente de curto ───────────────────────
  let paraleloMax = entradas
  while (paraleloMax > 0
    && _corrente(paraleloMax, modulo ?? {}, inversor).curto_circuito.status === STATUS_CORRENTE.INCOMPATIVEL) {
    paraleloMax -= 1
  }
  if (paraleloMax === 0) {
    return {
      status: STATUS_DISTRIBUICAO.SEM_SOLUCAO, mppts: [],
      lacunas: ['Uma única string já excede o limite de curto-circuito do MPPT.'],
    }
  }
  if (paraleloMax < entradas) {
    lacunas.push(`Corrente de curto limita a ${paraleloMax} string(s) por MPPT (catálogo: ${entradas}).`)
  }

  // ── Busca: mais strings primeiro ──────────────────────────────────────────
  const capacidade = mppts * paraleloMax
  let escolha = null
  for (let S = Math.min(capacidade, N); S >= 1; S -= 1) {
    const L = Math.floor(N / S)
    const r = N % S                      // r strings de L+1, S-r de L
    if (L > MAX_MODULOS_STRING_BUSCA) break
    if (!comprimentoOk(L)) continue
    if (r > 0 && !comprimentoOk(L + 1)) continue
    const blocosLongos = _blocos(r, paraleloMax)
    const blocosCurtos = _blocos(S - r, paraleloMax)
    if (blocosLongos.length + blocosCurtos.length > mppts) continue
    escolha = { S, L, r, blocosLongos, blocosCurtos }
    break
  }

  if (!escolha) {
    return {
      status: STATUS_DISTRIBUICAO.SEM_SOLUCAO, mppts: [],
      lacunas: [...lacunas, `Nenhuma divisão de ${N} módulos cabe em ${mppts} MPPT × ${paraleloMax} string(s) com tensão compatível.`],
    }
  }

  const { L, blocosLongos, blocosCurtos } = escolha
  const lista = [
    ...blocosLongos.map((k) => ({ modulos_por_string: L + 1, strings: k })),
    ...blocosCurtos.map((k) => ({ modulos_por_string: L, strings: k })),
  ].map((b, i) => {
    const corrente = _corrente(b.strings, modulo ?? {}, inversor)
    return {
      mppt: i + 1,
      strings: b.strings,
      modulos_por_string: b.modulos_por_string,
      modulos: b.strings * b.modulos_por_string,
      tensao: avaliacaoTensao.get(b.modulos_por_string)?.status ?? STATUS_TENSAO.NAO_AVALIADO,
      corrente: corrente.status,
    }
  })

  if (!tensaoAvaliada) {
    lacunas.push('Tensão não avaliada (faltam Voc/Vmpp/coeficientes do módulo, limites do inversor ou temperaturas): comprimento não verificado.')
  }
  if (lista.some((m) => m.corrente === STATUS_CORRENTE.NAO_AVALIADO)) {
    lacunas.push('Corrente não avaliada em algum MPPT (catálogo sem limite ou módulo sem Isc/Impp).')
  }

  const grupos = new Map()
  for (const m of lista) grupos.set(m.modulos_por_string, (grupos.get(m.modulos_por_string) ?? 0) + m.strings)

  return {
    status: STATUS_DISTRIBUICAO.PRELIMINAR,
    mppts: lista,
    mppts_livres: mppts - lista.length,
    resumo: {
      total_modulos: lista.reduce((s, m) => s + m.modulos, 0),
      total_strings: escolha.S,
      grupos: [...grupos].map(([modulos_por_string, strings]) => ({ modulos_por_string, strings })),
    },
    lacunas,
  }
}

export default { STATUS_DISTRIBUICAO, sugerirDistribuicaoStrings }
