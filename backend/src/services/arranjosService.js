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

/** Nº total de módulos de uma lista de painéis (soma das quantidades). */
export function contarModulos(paineis = []) {
  return (paineis || []).reduce((acc, p) => acc + (Number(p?.quantidade) || 0), 0)
}

/** Nº total de inversores de uma lista (soma das quantidades, default 1). */
export function contarInversores(inversores = []) {
  return (inversores || []).reduce((acc, i) => acc + (Number(i?.quantidade) || 1), 0)
}

/** Capacidade total (kWh) das baterias de um arranjo. */
export function capacidadeBateriasKwh(baterias = []) {
  const kwh = (baterias || []).reduce((acc, b) => {
    const c = Number(b?.capacidade_kwh) || 0
    const q = Number(b?.quantidade) || 1
    return acc + c * q
  }, 0)
  return kwh > 0 ? Number(kwh.toFixed(3)) : null
}

/**
 * Detecta a topologia de um arranjo a partir dos inversores/baterias.
 * Prioridade: bess (tem bateria + sem painel) → micro → hibrido → off-grid → otimizador → string.
 * @returns {'string'|'micro'|'hibrido'|'off-grid'|'otimizador'|'bess'|null}
 */
export function detectarTopologia(arranjo = {}) {
  if (arranjo.topologia) return arranjo.topologia   // respeita definição explícita
  const baterias = arranjo.baterias || []
  const paineis = arranjo.paineis || []
  const inv = (arranjo.inversores || [])[0] || {}
  const blob = `${inv.tipo || ''} ${inv.modelo || ''} ${inv.fabricante || ''}`.toLowerCase()

  if (baterias.length > 0 && paineis.length === 0) return 'bess'
  if (/micro/.test(blob)) return 'micro'
  if (/h[íi]brid|hybrid/.test(blob) || baterias.length > 0) return 'hibrido'
  if (/off.?grid/.test(blob)) return 'off-grid'
  if (/otimiz|optimi/.test(blob)) return 'otimizador'
  if (inv.modelo || inv.marca) return 'string'
  return null
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
    return projeto.arranjos.map((a, idx) => enriquecerArranjo(a, idx))
  }

  // Derivação do arranjo único legado (equipamentos.paineis + equipamentos.inversor)
  const eq = projeto.equipamentos || {}
  const paineis = eq.paineis || []
  const inversores = eq.inversor && (eq.inversor.marca || eq.inversor.modelo)
    ? [{ ...eq.inversor, quantidade: eq.inversor.quantidade || 1 }]
    : []

  // BESS legado de nível de projeto → arranjo derivado vê baterias se presentes
  const baterias = projeto.bess?.presente
    ? [{ marca: projeto.bess.marca, capacidade_kwh: projeto.bess.capacidade_kwh, quantidade: 1 }]
    : []

  if (paineis.length === 0 && inversores.length === 0 && baterias.length === 0) return []

  return [enriquecerArranjo({
    id: novoId(),
    rotulo: 'Arranjo principal',
    tipo: 'principal',
    origem: 'original',
    somente_leitura: false,
    paineis,
    inversores,
    baterias,
  }, 0)]
}

/** Normaliza+enriquece um único arranjo (potências, contagens, topologia). Não muta. */
function enriquecerArranjo(a, idx = 0) {
  const paineis = a.paineis || []
  const inversores = a.inversores || []
  const baterias = a.baterias || []
  const n_modulos = contarModulos(paineis)
  const n_inversores = contarInversores(inversores)
  const potencia_kwp = a.potencia_kwp ?? potenciaPaineisKwp(paineis)
  const enriquecido = {
    ...a,
    id: a.id || novoId(),
    rotulo: a.rotulo || `Arranjo ${String.fromCharCode(65 + idx)}`,
    tipo: a.tipo || 'principal',
    origem: a.origem || (a.tipo === 'ampliacao' ? 'ampliacao' : 'original'),
    somente_leitura: !!a.somente_leitura,
    paineis,
    inversores,
    baterias,
    potencia_kwp,
    potencia_inversor_kw: a.potencia_inversor_kw ?? potenciaInversoresKw(inversores),
    capacidade_bateria_kwh: capacidadeBateriasKwh(baterias),
    dimensionamento: {
      potencia_kwp,
      geracao_mensal_kwh: a.dimensionamento?.geracao_mensal_kwh ?? null,
      n_modulos,
      n_inversores,
    },
  }
  enriquecido.topologia = detectarTopologia(enriquecido)
  return enriquecido
}

/**
 * FASE 4 — Totais do projeto somando TODOS os arranjos.
 * @returns {{ n_arranjos, n_modulos_total, n_inversores_total, potencia_total_kwp,
 *             potencia_inversor_total_kw, capacidade_bateria_total_kwh, geracao_mensal_total_kwh }}
 */
export function calcularTotaisProjeto(projeto) {
  const arranjos = normalizarArranjos(projeto)
  const t = {
    n_arranjos: arranjos.length,
    n_modulos_total: 0,
    n_inversores_total: 0,
    potencia_total_kwp: 0,
    potencia_inversor_total_kw: 0,
    capacidade_bateria_total_kwh: 0,
    geracao_mensal_total_kwh: 0,
  }
  for (const a of arranjos) {
    t.n_modulos_total            += a.dimensionamento?.n_modulos || 0
    t.n_inversores_total         += a.dimensionamento?.n_inversores || 0
    t.potencia_total_kwp         += Number(a.potencia_kwp) || 0
    t.potencia_inversor_total_kw += Number(a.potencia_inversor_kw) || 0
    t.capacidade_bateria_total_kwh += Number(a.capacidade_bateria_kwh) || 0
    t.geracao_mensal_total_kwh   += Number(a.dimensionamento?.geracao_mensal_kwh) || 0
  }
  // arredonda os flutuantes
  t.potencia_total_kwp = Number(t.potencia_total_kwp.toFixed(3))
  t.potencia_inversor_total_kw = Number(t.potencia_inversor_total_kw.toFixed(3))
  t.capacidade_bateria_total_kwh = Number(t.capacidade_bateria_total_kwh.toFixed(3))
  t.geracao_mensal_total_kwh = Number(t.geracao_mensal_total_kwh.toFixed(1))
  return t
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
    origem: 'ampliacao',
    somente_leitura: false,
    paineis: [],
    inversores: [],
    baterias: [],
    potencia_kwp: null,
    potencia_inversor_kw: null,
  }

  return [...existentes, ampliacao]
}
