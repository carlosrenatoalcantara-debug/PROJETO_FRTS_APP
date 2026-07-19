/**
 * InstalacaoRepository.js — S4A-FV-INSTALACAO-WRITE-PATH-01
 *
 * Acesso a dados do Aggregate Root Instalacao. Camada fina sobre o Model —
 * sem regra de negócio, sem validação (isso é do Service). Todo o agregado é
 * carregado/persistido inteiro (Gerador/MPPT/String são subdocs internos).
 *
 * NÃO toca ProjetoFV, Arranjo, Engenharia, Unifilar nem OCR.
 */

import { Instalacao } from '../models/Instalacao.js'

export const InstalacaoRepository = {
  /** Persiste uma nova Instalação (agregado completo). */
  async create(dados) {
    const doc = new Instalacao(dados)
    await doc.save()
    return doc
  },

  /** Recupera o agregado por id (documento Mongoose). */
  async findById(id) {
    return Instalacao.findById(id)
  },

  /** Recupera como objeto plano (leitura). */
  async findByIdLean(id) {
    return Instalacao.findById(id).lean()
  },

  /**
   * Atualiza via load + assign + save — preserva a integridade do agregado e
   * roda as validações de schema (nunca findByIdAndUpdate, que as ignoraria).
   * @param {string} id
   * @param {object} patch  campos de topo a substituir (geradores, local_ref, ...)
   */
  async update(id, patch) {
    const doc = await Instalacao.findById(id)
    if (!doc) return null
    for (const [k, v] of Object.entries(patch)) {
      if (k === '_id') continue
      doc.set(k, v)
    }
    await doc.save()
    return doc
  },

  /** Remove o agregado. Retorna o documento removido ou null. */
  async delete(id) {
    return Instalacao.findByIdAndDelete(id)
  },
}

export default InstalacaoRepository
