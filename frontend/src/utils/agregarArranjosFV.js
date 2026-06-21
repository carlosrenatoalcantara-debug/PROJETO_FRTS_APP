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

export default { agregarTotaisArranjos, validarAlocacao }
