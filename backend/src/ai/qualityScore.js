/**
 * qualityScore.js — AI-ARCH-01 (FASE 8)
 *
 * Score de qualidade (0–100) de um equipamento extraído, por PRESENÇA de campos.
 * Decisão de fluxo:
 *   - score >= 80          → 'aceitar'
 *   - 50 <= score < 80     → 'revisao_assistida'
 *   - score < 50           → 'solicitar_preenchimento'
 *
 * PURO: sem I/O, sem dependências. Trabalha sobre o schema interno
 * { fabricante, modelo, tipo, especificacoes }.
 */

// Pesos por critério (somam 100). Identidade pesa mais que campos físicos.
const CRITERIOS = [
  { nome: 'fabricante',  peso: 15, presente: (e, esp) => _tem(e.fabricante) },
  { nome: 'modelo',      peso: 15, presente: (e, esp) => _tem(e.modelo) },
  { nome: 'potencia',    peso: 15, presente: (e, esp) => _temAlgum(esp, ['potencia_kw', 'potencia_nominal_kw', 'potencia_maxima_kw', 'potencia_max_entrada_cc']) },
  { nome: 'mppt',        peso: 10, presente: (e, esp) => _temAlgum(esp, ['n_mppts', 'strings_por_mppt']) },
  { nome: 'tensao',      peso: 10, presente: (e, esp) => _temAlgum(esp, ['tensao_max_entrada', 'tensao_mppt_min', 'tensao_mppt_max', 'tensao_ac', 'tensao_partida']) },
  { nome: 'corrente',    peso: 10, presente: (e, esp) => _temAlgum(esp, ['corrente_ac_saida', 'corrente_max_entrada', 'corrente_max_por_mppt', 'corrente_isc_max']) },
  { nome: 'eficiencia',  peso: 10, presente: (e, esp) => _temAlgum(esp, ['eficiencia_maxima', 'eficiencia', 'eficiencia_europeia', 'eficiencia_cec']) },
  { nome: 'dimensoes',   peso: 5,  presente: (e, esp) => _tem(esp.dimensoes) },
  { nome: 'peso',        peso: 5,  presente: (e, esp) => _tem(esp.peso_kg) },
  { nome: 'protecoes',   peso: 5,  presente: (e, esp) => _temAlgum(esp, ['grau_protecao_ip', 'protecao_antiilhamento', 'protecao_sobretensao_dc', 'protecao_sobretensao_ac']) },
]

/**
 * @param {Object} equip  schema interno { fabricante, modelo, tipo, especificacoes }
 * @returns {{score:number, decisao:string, presentes:string[], faltando:string[], detalhe:Object}}
 */
export function calcularQualidade(equip = {}) {
  const esp = (equip.especificacoes && typeof equip.especificacoes === 'object') ? equip.especificacoes : {}
  let score = 0
  const presentes = []
  const faltando = []
  const detalhe = {}

  for (const c of CRITERIOS) {
    const ok = !!c.presente(equip, esp)
    detalhe[c.nome] = ok
    if (ok) { score += c.peso; presentes.push(c.nome) }
    else faltando.push(c.nome)
  }

  let decisao
  if (score >= 80) decisao = 'aceitar'
  else if (score >= 50) decisao = 'revisao_assistida'
  else decisao = 'solicitar_preenchimento'

  return { score, decisao, presentes, faltando, detalhe }
}

function _tem(v) {
  if (v == null) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (typeof v === 'number') return !Number.isNaN(v)
  return true
}
function _temAlgum(obj, chaves) {
  return chaves.some(k => _tem(obj?.[k]))
}
