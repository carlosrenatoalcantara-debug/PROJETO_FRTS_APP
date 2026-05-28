import { Router } from 'express'
import mongoose from 'mongoose'
import { EmpresaConfig } from '../models/EmpresaConfig.js'

/**
 * Rotas de configuração institucional (S7.1) — singleton.
 * GET  /api/empresa        → retorna a configuração (cria vazia se não existir)
 * PUT  /api/empresa        → faz merge dos grupos enviados
 */
const router = Router()

function _dbOk(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ erro: 'MongoDB indisponível.', codigo: 'DB_OFFLINE' })
    return false
  }
  return true
}

const GRUPOS = ['empresa_config', 'responsavel_tecnico', 'branding', 'uploads']

async function obterSingleton() {
  let doc = await EmpresaConfig.findOne({ chave: 'default' })
  if (!doc) doc = await EmpresaConfig.create({ chave: 'default' })
  return doc
}

router.get('/', async (_req, res) => {
  try {
    if (!_dbOk(res)) return
    const doc = await obterSingleton()
    res.json({ sucesso: true, config: doc })
  } catch (err) {
    console.error('[empresa] GET:', err)
    res.status(500).json({ erro: err.message })
  }
})

router.put('/', async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const doc = await obterSingleton()
    // Merge raso por grupo (preserva campos não enviados)
    for (const g of GRUPOS) {
      if (req.body[g] && typeof req.body[g] === 'object') {
        doc[g] = { ...(doc[g] || {}), ...req.body[g] }
        doc.markModified(g)
      }
    }
    await doc.save()
    res.json({ sucesso: true, config: doc })
  } catch (err) {
    console.error('[empresa] PUT:', err)
    res.status(500).json({ erro: err.message })
  }
})

export default router
