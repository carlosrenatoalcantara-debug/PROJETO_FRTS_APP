/**
 * BaselineRepository.js — FV-DOM-001
 *
 * Acesso a dados do Aggregate Root Baseline. SEM update e SEM delete: a
 * baseline é imutável (M-2). O model também bloqueia atualização por hook, de
 * modo que a ausência aqui não é a única barreira.
 */
import { Baseline } from '../models/Baseline.js'

export const BaselineRepository = {
  async create(dados) {
    const doc = new Baseline(dados)
    await doc.save()
    return doc
  },
  async findById(id) {
    return Baseline.findById(id)
  },
  /** Baseline do projeto (≤ 1 por INV-BAS-3), como objeto plano. */
  async acharPorProjeto(filtro) {
    return Baseline.findOne(filtro).lean()
  },
  async acharPorOrcamento(filtro) {
    return Baseline.findOne(filtro).lean()
  },
}

export default BaselineRepository
