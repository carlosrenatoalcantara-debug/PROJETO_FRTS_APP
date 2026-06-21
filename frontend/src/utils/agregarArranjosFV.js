/**
 * agregarArranjosFV.js — P0-FV-ENGINEERING-WORKFLOW-CONSOLIDATION-01
 *
 * FONTE ÚNICA DE VERDADE do dimensionamento físico do sistema FV.
 * Agrega módulos / inversores / potência a partir dos arranjos configurados em E7
 * (Arranjo A primário em `equipamentos` + arranjos secundários em `state.arranjos[]`),
 * espelhando EXATAMENTE o `montarArranjosPayload()` do E7Equipamentos.
 *
 * Proíbe recálculo paralelo na E8: a E8 deve consumir estes totais, não o E5.
 */

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

function potenciaModuloW(p) {
  return num(p?.potencia_w ?? p?.potenciaW ?? p?.especificacoes?.potencia_wp ?? p?.especificacoes?.potencia_w)
}

/**
 * Agrega os totais físicos a partir do estado do wizard (fonte única = arranjos).
 * @returns {{ modulos:number, inversores:number, kwp:number, porArranjo:Array, fonte:string }}
 */
export function agregarTotaisArranjos(state) {
  const equipamentos = state?.equipamentos || {}
  const arranjos     = Array.isArray(state?.arranjos) ? state.arranjos : []
  const dim          = state?.dimensionamento || {}

  let modulos = 0, inversores = 0, kwp = 0
  const porArranjo = []

  // ── Arranjo A (primário) — vem de `equipamentos` (ConfiguradorArranjoFV) ──
  if (equipamentos.painel || equipamentos.inversor) {
    const qa = num(equipamentos.quantidadeModulos ?? dim.numPaineis)
    const pw = potenciaModuloW(equipamentos.painel)
    const invA = equipamentos.inversor ? 1 : 0
    modulos    += qa
    kwp        += qa * pw / 1000
    inversores += invA
    porArranjo.push({
      rotulo: 'Arranjo A', modulos: qa, inversores: invA, kwp: +(qa * pw / 1000).toFixed(3),
      potencia_modulo_w: pw || null,
    })
  }

  // ── Arranjos secundários (B, C, …) — `state.arranjos[]` ──
  arranjos.forEach((b, i) => {
    let m = 0, k = 0, inv = 0
    for (const p of (b.paineis || [])) { const q = num(p.quantidade); m += q; k += q * potenciaModuloW(p) / 1000 }
    for (const it of (b.inversores || [])) inv += num(it.quantidade)
    modulos += m; kwp += k; inversores += inv
    porArranjo.push({
      rotulo: b.rotulo || `Arranjo ${String.fromCharCode(66 + i)}`,
      modulos: m, inversores: inv, kwp: +k.toFixed(3),
    })
  })

  return {
    modulos,
    inversores,
    kwp: +kwp.toFixed(2),
    porArranjo,
    fonte: 'arranjos',
  }
}

/**
 * FASE 5 — Validação de alocação: quantos módulos os inversores selecionados
 * conseguem atender vs. módulos sem inversor. NÃO bloqueia — apenas informa.
 *
 * @param {number} totalModulos
 * @param {Array<{capacidadeModulos?:number, modulosMax?:number, quantidade?:number}>} inversores
 * @returns {{ atendidos:number, semInversor:number, capacidadeTotal:number, suficiente:boolean }}
 */
export function validarAlocacao(totalModulos, inversores = []) {
  const capacidadeTotal = inversores.reduce((s, inv) => {
    const cap = num(inv.capacidadeModulos ?? inv.modulosMax)
    const qtd = num(inv.quantidade) || 1
    return s + cap * qtd
  }, 0)
  const atendidos   = capacidadeTotal > 0 ? Math.min(totalModulos, capacidadeTotal) : totalModulos
  const semInversor = Math.max(0, totalModulos - capacidadeTotal)
  return {
    atendidos,
    semInversor,
    capacidadeTotal,
    suficiente: capacidadeTotal === 0 || capacidadeTotal >= totalModulos,
  }
}

// ── P0-E7-ARRANJO-WORKFLOW-REFACTOR-01: resumo técnico em tempo real por arranjo ──

const numEsp = (esp, ks) => { for (const k of ks) { const v = Number(esp?.[k]); if (Number.isFinite(v) && v !== 0) return v } return null }

/**
 * Resumo técnico de UM arranjo: P CC, P CA, oversizing, MPPT, entradas, strings,
 * módulos atendidos vs sem inversor, com avisos visuais. NÃO bloqueia.
 *
 * @param {object} arranjo  { paineis:[{quantidade,potencia_w,modelo,equipamento_id}], inversores:[...] }
 * @param {object} cat      { modulos:[docCatalogo], inversores:[docCatalogo] }
 */
export function resumoTecnicoArranjo(arranjo, cat = {}) {
  const catMod = cat.modulos || []
  const catInv = cat.inversores || []
  const acharDoc = (lista, l) => lista.find(d => String(d._id) === String(l.equipamento_id)) || lista.find(d => d.modelo === l.modelo) || null

  // Módulos + potência CC + Voc do módulo (para estimar módulos/string)
  let modulos = 0, pCC = 0, vocModulo = null
  for (const p of (arranjo.paineis || [])) {
    const q = num(p.quantidade); modulos += q
    const doc = acharDoc(catMod, p)
    const pw = num(p.potencia_w) || numEsp(doc?.especificacoes, ['potencia_wp', 'potencia_w', 'potencia']) || 0
    pCC += q * pw / 1000
    const vc = numEsp(doc?.especificacoes, ['voc', 'voc_v'])
    if (vc && !vocModulo) vocModulo = vc
  }

  // Inversores + potência CA + MPPT + entradas + capacidade estimada de módulos
  let pCA = 0, nMppt = 0, entradas = 0, capacidade = 0, qtdInv = 0
  for (const it of (arranjo.inversores || [])) {
    const q = num(it.quantidade); qtdInv += q
    const doc = acharDoc(catInv, it)
    const esp = doc?.especificacoes || {}
    const pkw = num(it.potencia_kw) || numEsp(esp, ['potencia_kw', 'potencia', 'potencia_ca']) || 0
    const nm  = numEsp(esp, ['n_mppts', 'mppts', 'numero_mppt']) || 1
    const epm = numEsp(esp, ['entradas_por_mppt', 'strings_por_mppt']) || 1
    const vmax = numEsp(esp, ['tensao_max_entrada', 'voc_max', 'voc_max_dc'])
    pCA += pkw * q
    nMppt += nm * q
    entradas += nm * epm * q
    // módulos por string estimado por Voc; fallback conservador 16
    const modPorString = (vmax && vocModulo) ? Math.max(1, Math.floor(vmax / vocModulo)) : 16
    capacidade += nm * epm * modPorString * q
  }

  const oversizing = pCA > 0 ? +(pCC / pCA).toFixed(2) : null
  // alocação: sem inversor → tudo sem alocar; com inversor e capacidade conhecida → diferença
  let atendidos, semInversor
  if (qtdInv === 0) { atendidos = 0; semInversor = modulos }
  else if (capacidade > 0) { atendidos = Math.min(modulos, capacidade); semInversor = Math.max(0, modulos - capacidade) }
  else { atendidos = modulos; semInversor = 0 }   // inversor sem specs → não falso-alarme

  const avisos = []
  if (semInversor > 0) avisos.push({ nivel: 'warn', msg: `${semInversor} módulo(s) sem inversor` })
  if (oversizing != null && oversizing > 1.5) avisos.push({ nivel: 'crit', msg: `Oversizing ${oversizing}× muito alto` })
  else if (oversizing != null && oversizing > 1.3) avisos.push({ nivel: 'warn', msg: `Oversizing ${oversizing}× acima do recomendado` })

  return {
    modulos, inversores: qtdInv,
    pCC: +pCC.toFixed(2), pCA: +pCA.toFixed(2), oversizing,
    nMppt, entradas, strings: entradas,   // 1 string por entrada (estimativa)
    capacidade, atendidos, semInversor, avisos,
  }
}

export default { agregarTotaisArranjos, validarAlocacao, resumoTecnicoArranjo }
