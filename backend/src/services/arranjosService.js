/**
 * arranjosService.js — P1-UX-CORE-EVOLUTION-01 (FASE 3)
 *
 * Suporte a MÚLTIPLOS arranjos de componentes por projeto, de forma retrocompatível.
 *
 * Um "arranjo" é um bloco independente de geração: conjunto de painéis (1+ modelos)
 * + 1+ inversores. Projetos legados têm um arranjo único implícito em
 * `equipamentos.paineis[]` + `equipamentos.inversor`. Estas funções unificam as duas
 * representações para que o motor de dimensionamento e a UI tratem tudo como `arranjos[]`,
 * sem exigir migração destrutiva dos documentos existentes.
 */

let _seq = 0
function novoId(prefixo = 'arr') {
  _seq = (_seq + 1) % 1e6
  return `${prefixo}_${Date.now().toString(36)}_${_seq.toString(36)}`
}

/** Potência DC (kWp) somando potencia_w × quantidade de cada painel. */
export function potenciaPaineisKwp(paineis = []) {
  const wp = (paineis || []).reduce((acc, p) => {
    const w = Number(p?.potencia_w) || 0
    const q = Number(p?.quantidade) || 0
    return acc + w * q
  }, 0)
  return wp > 0 ? Number((wp / 1000).toFixed(3)) : null
}

/** Potência AC (kW) somando potencia_kw × quantidade de cada inversor. */
export function potenciaInversoresKw(inversores = []) {
  const kw = (inversores || []).reduce((acc, i) => {
    const k = Number(i?.potencia_kw) || 0
    const q = Number(i?.quantidade) || 1
    return acc + k * q
  }, 0)
  return kw > 0 ? Number(kw.toFixed(3)) : null
}

/**
 * Retorna os arranjos do projeto SEMPRE como array normalizado.
 * - Se `projeto.arranjos` existe e não está vazio → devolve-o (com potências recalculadas).
 * - Senão, deriva UM arranjo 'principal' a partir do `equipamentos` legado.
 * Nunca muta o documento; retorna objetos planos.
 *
 * @param {object} projeto  Documento ProjetoFV (lean ou hidratado)
 * @returns {Array<object>}
 */
export function normalizarArranjos(projeto) {
  if (!projeto) return []

  if (Array.isArray(projeto.arranjos) && projeto.arranjos.length > 0) {
    return projeto.arranjos.map((a, idx) => {
      const paineis = a.paineis || []
      const inversores = a.inversores || []
      return {
        ...a,
        id: a.id || novoId(),
        rotulo: a.rotulo || `Arranjo ${String.fromCharCode(65 + idx)}`,
        tipo: a.tipo || 'principal',
        somente_leitura: !!a.somente_leitura,
        paineis,
        inversores,
        potencia_kwp: a.potencia_kwp ?? potenciaPaineisKwp(paineis),
        potencia_inversor_kw: a.potencia_inversor_kw ?? potenciaInversoresKw(inversores),
      }
    })
  }

  // Derivação do arranjo único legado (equipamentos.paineis + equipamentos.inversor)
  const eq = projeto.equipamentos || {}
  const paineis = eq.paineis || []
  const inversores = eq.inversor && (eq.inversor.marca || eq.inversor.modelo)
    ? [{ ...eq.inversor, quantidade: eq.inversor.quantidade || 1 }]
    : []

  if (paineis.length === 0 && inversores.length === 0) return []

  return [{
    id: novoId(),
    rotulo: 'Arranjo principal',
    tipo: 'principal',
    somente_leitura: false,
    paineis,
    inversores,
    potencia_kwp: potenciaPaineisKwp(paineis),
    potencia_inversor_kw: potenciaInversoresKw(inversores),
  }]
}

/** Soma a potência DC (kWp) de todos os arranjos. */
export function potenciaTotalKwp(projeto) {
  const arr = normalizarArranjos(projeto)
  const total = arr.reduce((acc, a) => acc + (Number(a.potencia_kwp) || 0), 0)
  return total > 0 ? Number(total.toFixed(3)) : null
}

/**
 * Constrói os arranjos para um projeto de AMPLIAÇÃO:
 * congela os arranjos do projeto original como 'existente'/somente-leitura e
 * adiciona um novo arranjo 'ampliacao' vazio (editável).
 *
 * @param {object} projetoOrigem
 * @returns {Array<object>}
 */
export function montarArranjosAmpliacao(projetoOrigem) {
  const existentes = normalizarArranjos(projetoOrigem).map((a, idx) => ({
    ...a,
    id: novoId('exist'),
    rotulo: a.rotulo && /exist/i.test(a.rotulo) ? a.rotulo : `Existente ${idx + 1}`,
    tipo: 'existente',
    somente_leitura: true,
  }))

  const ampliacao = {
    id: novoId('ampl'),
    rotulo: 'Ampliação',
    tipo: 'ampliacao',
    somente_leitura: false,
    paineis: [],
    inversores: [],
    potencia_kwp: null,
    potencia_inversor_kw: null,
  }

  return [...existentes, ampliacao]
}
