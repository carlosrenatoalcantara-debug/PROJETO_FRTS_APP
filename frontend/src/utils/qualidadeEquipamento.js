/**
 * qualidadeEquipamento.js — P1-MODULE-FALLBACK-CONSERVADOR-01
 *
 * Status semântico de qualidade do equipamento: 🟢 REAL / 🟡 INFERIDO / 🔴 INCOMPLETO.
 * Consome `fallback` (dados conservadores inferidos) e `especificacoes`. Pura/testável.
 */

const MIN = {
  modulo: ['potencia_wp', 'voc', 'isc', 'vmp', 'imp'],
  inversor: ['potencia_kw', 'tensao_max_entrada', 'n_mppts'],
  carregador_ev: ['potencia_kw', 'tensao_entrada_v', 'corrente_entrada_a'],
}
const tem = v => v != null && v !== '' && !(typeof v === 'number' && v === 0)

/**
 * @param {object} eq  equipamento (tipo, especificacoes, fallback?)
 * @returns {{ nivel:'REAL'|'INFERIDO'|'INCOMPLETO', icone, rotulo, cor, tooltip }}
 */
export function statusQualidade(eq) {
  const min = MIN[eq?.tipo] || ['potencia_kw']
  const completo = min.every(k => tem((eq?.especificacoes || {})[k]))

  // INFERIDO: recebeu fallback conservador (algum dado é inferido)
  if (eq?.fallback?.tipo === 'fallback_conservador') {
    return {
      nivel: 'INFERIDO', icone: '🟡', cor: 'amber', rotulo: 'Dados inferidos',
      tooltip: 'Dados conservadores utilizados por ausência de datasheet. Recomenda-se revisão posterior.',
    }
  }
  if (completo) {
    return { nivel: 'REAL', icone: '🟢', cor: 'emerald', rotulo: 'Dados reais', tooltip: 'Dados de datasheet / parser validado / cadastro completo.' }
  }
  return { nivel: 'INCOMPLETO', icone: '🔴', cor: 'red', rotulo: 'Incompleto', tooltip: 'Faltam dados mínimos para dimensionamento. Não recomendado para projeto.' }
}

/** Pode ser usado em projeto? (REAL ou INFERIDO com o mínimo presente) */
export function utilizavelEmProjeto(eq) {
  const min = MIN[eq?.tipo] || ['potencia_kw']
  return min.every(k => tem((eq?.especificacoes || {})[k]))
}
