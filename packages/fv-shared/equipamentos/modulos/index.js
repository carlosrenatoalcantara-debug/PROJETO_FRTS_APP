/**
 * equipamentos/modulos — leitor canônico do MÓDULO FV — FV-DOM-031D.
 *
 * ── Por que existe ───────────────────────────────────────────────────────────
 * O inversor já tinha dicionário SSOT (`equipamentos/inversores`). O módulo não:
 * a lista de aliases vivia em `frontend/src/fv/catalogo.js::eletricoDoModulo`,
 * alcançável só pelo frontend. O unifilar de microinversores precisa de Voc,
 * Vmpp, Isc e do coeficiente térmico do módulo no BACKEND — e sem um leitor
 * compartilhado a alternativa seria reescrever a lista, que é exatamente o que
 * a FV-DOM-008 provou caro.
 *
 * ── O que este arquivo é e não é ─────────────────────────────────────────────
 * É uma MUDANÇA DE LUGAR: os aliases abaixo são os mesmos que `eletricoDoModulo`
 * já usava, na mesma ordem. Nenhum foi acrescentado, removido ou reordenado, e
 * `catalogo.js` passou a delegar — o valor lido é o mesmo antes e depois.
 *
 * NÃO é um catálogo, não calcula nada e não completa ausência: o que o
 * `Equipamento.especificacoes` não declarar sai `null`, para virar lacuna em
 * quem consome.
 *
 * Puro: sem I/O, sem React, sem dependência de node.
 */

/** Alias por campo canônico, na ORDEM de precedência herdada de `eletricoDoModulo`. */
export const CAMPOS_MODULO = Object.freeze({
  potencia_w:    ['potencia', 'potencia_w', 'potenciaW'],
  voc:           ['voc', 'voc_v'],
  vmpp:          ['vmpp', 'vmp', 'vmpp_v'],
  isc:           ['isc', 'isc_a'],
  impp:          ['impp', 'imp', 'impp_a', 'imp_a'],
  coef_temp_voc: ['coef_temp_voc_pct_c', 'coef_temp_voc'],
  temp_noct:     ['noct_c', 'noct', 'temp_noct'],
})

function _num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Primeiro alias com número válido. `null` quando nenhum declarou. */
function _primeiro(esp, chaves) {
  for (const k of chaves) {
    const v = _num(esp?.[k])
    if (v !== null) return v
  }
  return null
}

/** Potência do módulo (W) — como o catálogo a declarar, sem completar. */
export function potenciaDoModulo(equipamento) {
  return _primeiro(equipamento?.especificacoes, CAMPOS_MODULO.potencia_w)
}

/**
 * Parâmetros elétricos do módulo, resolvidos pela SSOT.
 * Toda ausência é `null` — nunca um módulo genérico.
 */
export function lerModulo(equipamento) {
  const esp = equipamento?.especificacoes ?? {}
  const out = {}
  for (const [campo, aliases] of Object.entries(CAMPOS_MODULO)) {
    out[campo] = _primeiro(esp, aliases)
  }
  return out
}

/** Campos elétricos que o catálogo não declarou, nomeados. */
export function lacunasDoModulo(equipamento) {
  const c = lerModulo(equipamento)
  // `impp` e `temp_noct` ficam de fora: nenhum consumidor os exige, e o NOCT
  // tem constante canônica própria na FV-DOM-025.
  return ['potencia_w', 'voc', 'vmpp', 'isc', 'coef_temp_voc']
    .filter((k) => c[k] === null)
    .map((k) => `modulo.${k}`)
}
