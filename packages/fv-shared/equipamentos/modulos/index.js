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
 * Nasceu como MUDANÇA DE LUGAR: os aliases eram os mesmos de `eletricoDoModulo`,
 * na mesma ordem, e `catalogo.js` passou a delegar.
 *
 * Isso deixou de ser verdade: a lista de `potencia_w` ganhou `potencia_wp` (veja
 * a nota em CAMPOS_MODULO). A lista herdada estava incompleta em relação ao que
 * os caminhos de cadastro realmente gravam, e este arquivo é o lugar certo para
 * corrigir — é o SSOT. Os demais campos permanecem como herdados.
 *
 * NÃO é um catálogo, não calcula nada e não completa ausência: o que o
 * `Equipamento.especificacoes` não declarar sai `null`, para virar lacuna em
 * quem consome.
 *
 * Puro: sem I/O, sem React, sem dependência de node.
 */

/**
 * Alias por campo canônico, na ORDEM de precedência.
 *
 * `potencia_wp` foi ACRESCENTADO, em primeiro lugar. A lista herdada de
 * `eletricoDoModulo` não o continha, e o efeito foi medido em produção: os 54
 * módulos do catálogo gravam `especificacoes.potencia_wp` — 100% deles — porque
 * é o que o formulário de cadastro (`ModalNovoModulo.jsx`) e a extração por
 * datasheet (`equipamentosController.js`) escrevem. Nenhum grava os três nomes
 * antigos. O leitor devolvia `null` para o catálogo inteiro, e a tela dizia
 * "potência não informada" para módulos que tinham a potência gravada.
 *
 * Primeiro na ordem por ser o mais específico: o sufixo `wp` declara a unidade,
 * enquanto `potencia` sozinho é ambíguo entre tipos (W no módulo, kW no
 * inversor). É a mesma precedência que `GerenciadorArranjos.jsx`,
 * `agregarArranjosFV.js` e `derivadosTopologia.js` já usavam — esta lista passa
 * a concordar com eles, não a inaugurar uma convenção.
 *
 * Medição prévia (T1, somente leitura, produção): zero documentos com mais de
 * um alias preenchido, logo zero divergência possível. A mudança recupera
 * valores `null` e NÃO reinterpreta nenhum número já em uso.
 *
 * `potencia_pico` entra como sinônimo que o importador SolarMarket grava ao
 * lado de `potencia_w` (`integracoes/solarmarket/normalizer.js`).
 */
export const CAMPOS_MODULO = Object.freeze({
  potencia_w:    ['potencia_wp', 'potencia_w', 'potenciaW', 'potencia_pico', 'potencia'],
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
