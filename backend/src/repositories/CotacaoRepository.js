/**
 * CotacaoRepository.js — FV-DOM-001
 *
 * Acesso a dados do Aggregate Root Cotacao. Camada fina sobre o Model — sem
 * regra de negócio, sem validação (isso é do Service).
 */
import { Cotacao } from '../models/Cotacao.js'

export const CotacaoRepository = {
  async create(dados) {
    const doc = new Cotacao(dados)
    await doc.save()
    return doc
  },
  async findById(id) {
    return Cotacao.findById(id)
  },
  async findByIdLean(id) {
    return Cotacao.findById(id).lean()
  },
  /** Todas as cotações de um projeto, dentro do escopo já aplicado pelo filtro. */
  async listarPorProjeto(filtro) {
    return Cotacao.find(filtro).sort({ createdAt: -1 })
  },
  async contarPorProjeto(filtro) {
    return Cotacao.countDocuments(filtro)
  },
  /** load + assign + save: preserva integridade e roda as validações do schema. */
  async update(id, patch) {
    const doc = await Cotacao.findById(id)
    if (!doc) return null
    for (const [k, v] of Object.entries(patch)) {
      if (k === '_id') continue
      doc.set(k, v)
    }
    await doc.save()
    return doc
  },
  async delete(id) {
    return Cotacao.findByIdAndDelete(id)
  },
}

export default CotacaoRepository
