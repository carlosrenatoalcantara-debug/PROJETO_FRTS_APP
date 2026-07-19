/**
 * instalacaoController.js — S4A-FV-INSTALACAO-WRITE-PATH-01
 *
 * Endpoints REST do Aggregate Root Instalacao. Camada fina: delega ao
 * InstalacaoService. Exige MongoDB (o agregado é persistido de verdade).
 *
 * NÃO toca ProjetoFV, Arranjo, Engenharia, Unifilar nem OCR.
 */

import mongoose from 'mongoose'
import { InstalacaoService, ErroValidacaoInstalacao } from '../services/InstalacaoService.js'

function exigirMongo(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ erro: 'MongoDB indisponível — Instalação exige persistência.' })
    return false
  }
  return true
}

function idValido(id, res) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ erro: 'ID inválido' })
    return false
  }
  return true
}

/** POST /api/instalacoes */
export const criarInstalacao = async (req, res) => {
  if (!exigirMongo(res)) return
  try {
    const doc = await InstalacaoService.criar(req.body || {})
    return res.status(201).json({ sucesso: true, item: doc })
  } catch (err) {
    if (err instanceof ErroValidacaoInstalacao) {
      return res.status(400).json({ erro: 'validacao', erros: err.erros })
    }
    console.error('[instalacao] criar falhou:', err.message)
    return res.status(500).json({ erro: err.message })
  }
}

/** GET /api/instalacoes/:id */
export const buscarInstalacao = async (req, res) => {
  if (!exigirMongo(res)) return
  if (!idValido(req.params.id, res)) return
  try {
    const doc = await InstalacaoService.buscar(req.params.id)
    if (!doc) return res.status(404).json({ erro: 'Instalação não encontrada' })
    return res.json({ sucesso: true, item: doc })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
}

/** PUT /api/instalacoes/:id */
export const atualizarInstalacao = async (req, res) => {
  if (!exigirMongo(res)) return
  if (!idValido(req.params.id, res)) return
  try {
    const doc = await InstalacaoService.atualizar(req.params.id, req.body || {})
    if (!doc) return res.status(404).json({ erro: 'Instalação não encontrada' })
    return res.json({ sucesso: true, item: doc })
  } catch (err) {
    if (err instanceof ErroValidacaoInstalacao) {
      return res.status(400).json({ erro: 'validacao', erros: err.erros })
    }
    return res.status(500).json({ erro: err.message })
  }
}

/** DELETE /api/instalacoes/:id */
export const excluirInstalacao = async (req, res) => {
  if (!exigirMongo(res)) return
  if (!idValido(req.params.id, res)) return
  try {
    const doc = await InstalacaoService.excluir(req.params.id)
    if (!doc) return res.status(404).json({ erro: 'Instalação não encontrada' })
    return res.json({ sucesso: true, removido: doc._id })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
}
