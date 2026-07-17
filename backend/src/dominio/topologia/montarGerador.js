/**
 * montarGerador.js — S2-FV-TOPOLOGY-FOUNDATION-01
 *
 * Fábrica PURA da topologia (sem I/O, sem mongoose). Materializa um Gerador com
 * seus MPPTs a partir EXCLUSIVAMENTE do Catálogo do inversor (n_mppts), lido pelo
 * SSOT `lerInversor`. A quantidade de MPPTs NUNCA é parametrizada manualmente (INV-03).
 *
 * NÃO distribui módulos. NÃO infere Strings. NÃO calcula nada derivado.
 * Apenas produz o esqueleto estrutural que a Engenharia (sprint seguinte) preencherá.
 */

import { lerInversor } from '../../equipamentos/inversores/index.js'

/**
 * Nº de MPPTs de um inversor, lido do Catálogo (especificacoes) via SSOT.
 * @param {object} inversorDoc  Equipamento do inversor (ou objeto com `especificacoes`).
 * @returns {number|null} inteiro > 0, ou null se ausente.
 */
export function contarMpptsInversor(inversorDoc) {
  const esp = (inversorDoc && inversorDoc.especificacoes) || inversorDoc || {}
  const c = lerInversor(esp, inversorDoc || {})
  const n = Number(c.n_mppts)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
}

/**
 * Materializa um Gerador (esqueleto) para um inversor do Catálogo.
 * MPPTs criados = n_mppts do Catálogo, com strings vazias. Ramal CA deferido (null).
 * @param {object} inversorDoc  Equipamento do inversor (precisa de _id e especificacoes.n_mppts).
 * @param {object} [opts]       { apelido?, inversor_ref? }
 * @returns {object} gerador plano { inversor_ref, ramal_ca_ref, apelido, mppts[] }
 */
export function montarGerador(inversorDoc, opts = {}) {
  const n = contarMpptsInversor(inversorDoc)
  if (!n) {
    throw new Error('n_mppts ausente no Catálogo do inversor — não é possível materializar os MPPTs')
  }
  const mppts = Array.from({ length: n }, (_, i) => ({ indice: i + 1, strings: [] }))
  return {
    inversor_ref: (inversorDoc && inversorDoc._id) ?? opts.inversor_ref ?? null,
    ramal_ca_ref: null,            // DEFERIDO — Ramal CA não criado nesta sprint
    apelido: opts.apelido ?? null,
    mppts,
  }
}

/**
 * Constrói uma String válida (sem persistir). Centraliza a garantia de que a
 * composição é uma LISTA de {modulo, quantidade} e que a String não carrega
 * nenhum valor derivado (K/Voc/Vmpp/Isc/potência ficam de fora por construção).
 *
 * @param {object} args
 * @param {number} [args.indice_entrada]  entrada física do MPPT (1..entradas_por_mppt)
 * @param {Array<{modulo_ref:any, quantidade:number}>} args.composicao  ≥1 item
 * @param {any}    args.superficie_id      _id da Superfície (dentro de um Local)
 * @param {any}    [args.otimizador_ref]   opcional (um por módulo quando presente)
 * @returns {object} string plana
 */
export function montarString({ indice_entrada = null, composicao, superficie_id, otimizador_ref = null } = {}) {
  if (!Array.isArray(composicao) || composicao.length === 0) {
    throw new Error('String exige composição com ≥1 item')
  }
  for (const it of composicao) {
    if (!it || it.modulo_ref == null) throw new Error('item de composição exige modulo_ref')
    if (!(Number(it.quantidade) > 0)) throw new Error('quantidade por item deve ser > 0')
  }
  if (superficie_id == null) throw new Error('String exige referência à Superfície (superficie_id)')
  return {
    indice_entrada,
    composicao: composicao.map((it) => ({ modulo_ref: it.modulo_ref, quantidade: Number(it.quantidade) })),
    superficie_id,
    otimizador_ref,
  }
}

/** Uma String é homogênea quando sua composição tem exatamente 1 modelo de módulo. */
export function stringHomogenea(str) {
  return Array.isArray(str?.composicao) && str.composicao.length === 1
}

export default { contarMpptsInversor, montarGerador, montarString, stringHomogenea }
