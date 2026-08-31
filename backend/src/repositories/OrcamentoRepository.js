/**
 * OrcamentoRepository.js — FV-DOM-001
 *
 * Acesso a dados do Aggregate Root Orcamento. Camada fina sobre o Model.
 * Nunca usa findOneAndUpdate para mudar estado: as transições passam pelo
 * Service, que valida antes e grava histórico.
 */
import { Orcamento } from '../models/Orcamento.js'

export const OrcamentoRepository = {
  async create(dados) {
    const doc = new Orcamento(dados)
    await doc.save()
    return doc
  },
  async findById(id) {
    return Orcamento.findById(id)
  },
  async findByIdLean(id) {
    return Orcamento.findById(id).lean()
  },
  async listarPorProjeto(filtro) {
    return Orcamento.find(filtro).sort({ createdAt: -1 })
  },
  /** O orçamento aprovado do projeto, se existir (INV-ORC-3 garante ≤ 1). */
  async acharAprovado(filtro) {
    return Orcamento.findOne({ ...filtro, estado: 'APROVADO' })
  },
  async update(id, patch) {
    const doc = await Orcamento.findById(id)
    if (!doc) return null
    for (const [k, v] of Object.entries(patch)) {
      if (k === '_id') continue
      doc.set(k, v)
    }
    await doc.save()
    return doc
  },
  async delete(id) {
    return Orcamento.findByIdAndDelete(id)
  },
}

export default OrcamentoRepository
