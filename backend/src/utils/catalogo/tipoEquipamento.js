/**
 * tipoEquipamento.js — Sprint CAT-P0-UNIFY (FASE 2)
 *
 * PURO. Normaliza o `tipo` de equipamento entre as variações que circulam no
 * sistema (hífen vs underscore). O enum canônico do model Equipamento usa
 * UNDERSCORE: 'carregador_ev'. O frontend antigo envia 'carregador-ev' (hífen).
 * Esta função é a fonte única de verdade para a conversão.
 *
 * Diagnóstico CAT-DIAG-02 confirmou que essa divergência fazia
 *   Equipamento.find({ tipo: 'carregador-ev' })  → sempre 0
 * e disparava o fallback CarregadorEV.
 */

// Mapa de aliases → tipo canônico (enum do model Equipamento)
const ALIASES = {
  'carregador-ev': 'carregador_ev',
  'carregador_ev': 'carregador_ev',
  'carregador':    'carregador_ev',
  'carregadorev':  'carregador_ev',
  'ev_charger':    'carregador_ev',
  'wallbox':       'carregador_ev',
  'inversor':      'inversor',
  'inverter':      'inversor',
  'microinversor': 'inversor',     // microinversor é subtipo de inversor no model
  'modulo':        'modulo',
  'módulo':        'modulo',
  'painel':        'modulo',
  'bateria':       'bateria',
  'battery':       'bateria',
  'estrutura':     'estrutura',
}

/**
 * Devolve o tipo canônico (enum do model) para qualquer alias.
 * Retorna o próprio valor (lowercased) se não houver mapeamento — não inventa.
 */
export function normalizarTipo(tipo) {
  if (tipo == null) return null
  const k = String(tipo).trim().toLowerCase()
  return ALIASES[k] || k
}

/** True se o tipo (após normalizar) é um carregador EV. */
export function ehCarregadorEV(tipo) {
  return normalizarTipo(tipo) === 'carregador_ev'
}

export const TIPOS_CANONICOS = ['modulo', 'inversor', 'estrutura', 'bateria', 'carregador_ev']
