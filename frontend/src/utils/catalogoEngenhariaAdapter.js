const num = (v) => {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function pick(specs, keys, fallback = null) {
  for (const k of keys) {
    const v = specs?.[k]
    if (v !== undefined && v !== null && v !== '') return v
  }
  return fallback
}

export function agruparInversores(equipamentos) {
  const tree = {}
  for (const eq of equipamentos || []) {
    const e = eq.especificacoes || {}
    const tipo = String(eq.tipo_inversor || e.tipo_inversor || 'string').toLowerCase() === 'micro' ? 'micro' : 'string'
    const marca = eq.fabricante || 'N/D'
    const fases = num(pick(e, ['fases', 'fases_saida'], 1)) === 3 ? 'trifasico' : 'monofasico'

    const modelo = {
      id: String(eq._id),
      modelo: eq.modelo,
      potenciaKW: num(pick(e, ['potencia_kw', 'potencia_ca', 'potencia'], 0)) || 0,
      nMppts: num(pick(e, ['mppts', 'n_mppts', 'numero_mppt'], 1)) || 1,
      garantia: num(eq?.garantia_produto?.value) || 5,
    }

    if (!tree[tipo]) tree[tipo] = {}
    if (!tree[tipo][marca]) tree[tipo][marca] = {}
    if (!tree[tipo][marca][fases]) tree[tipo][marca][fases] = []
    tree[tipo][marca][fases].push(modelo)
  }
  return tree
}

export function agruparPaineis(equipamentos) {
  const out = {}
  for (const eq of equipamentos || []) {
    const e = eq.especificacoes || {}
    const marca = eq.fabricante || 'N/D'
    const modelo = {
      id: String(eq._id),
      modelo: eq.modelo,
      potenciaW: num(pick(e, ['potencia_w', 'potencia', 'pmpp'], 0)) || 0,
      pmpp: num(pick(e, ['potencia_w', 'potencia', 'pmpp'], 0)) || 0,
      voc: num(pick(e, ['voc', 'voc_v'], 0)) || 0,
      vmpp: num(pick(e, ['vmpp', 'vmp', 'vmpp_v'], 0)) || 0,
      isc: num(pick(e, ['isc', 'isc_a'], 0)) || 0,
      garantiaProduto: num(eq?.garantia_produto?.value) || 10,
      garantiaPerformance: num(eq?.garantia_performance?.value) || 25,
      percentualPerformance: num(pick(e, ['percentual_performance'], 80)) || 80,
    }
    if (!out[marca]) out[marca] = []
    out[marca].push(modelo)
  }
  return out
}
