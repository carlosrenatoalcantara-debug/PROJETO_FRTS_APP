import { Router } from 'express'
import mongoose from 'mongoose'
import User from '../models/User.js'
import { Empresa } from '../models/Empresa.js'
import { Tecnico } from '../models/Tecnico.js'
import { Vendedor } from '../models/Vendedor.js'
import { MATRIZ_RBAC, PERFIS, MODULOS, ACOES, LABEL_PERFIL } from '../services/rbac.js'

/**
 * Rotas de gestão corporativa (S7.2) — usuários, empresas, técnicos, vendedores
 * e a matriz RBAC. Additive; não toca em autenticação. Auditoria via auditLogger
 * global (middleware já montado no server).
 */
const router = Router()

function _dbOk(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ erro: 'MongoDB indisponível.', codigo: 'DB_OFFLINE' })
    return false
  }
  return true
}

// Gera um CRUD genérico para um Model. `selecionar` opcional p/ ocultar campos.
function crud(model, { selecionar = null, ordenar = { createdAt: -1 } } = {}) {
  return {
    listar: async (req, res) => {
      try {
        if (!_dbOk(res)) return
        const filtro = req.query.empresa_id ? { empresa_id: req.query.empresa_id } : {}
        let q = model.find(filtro).sort(ordenar)
        if (selecionar) q = q.select(selecionar)
        res.json({ sucesso: true, itens: await q })
      } catch (e) { res.status(500).json({ erro: e.message }) }
    },
    criar: async (req, res) => {
      try {
        if (!_dbOk(res)) return
        const doc = await model.create(req.body || {})
        res.status(201).json({ sucesso: true, item: doc })
      } catch (e) { res.status(400).json({ erro: e.message }) }
    },
    atualizar: async (req, res) => {
      try {
        if (!_dbOk(res)) return
        const { id } = req.params
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
        const doc = await model.findByIdAndUpdate(id, { $set: req.body || {} }, { new: true, runValidators: true })
        if (!doc) return res.status(404).json({ erro: 'Não encontrado' })
        res.json({ sucesso: true, item: doc })
      } catch (e) { res.status(400).json({ erro: e.message }) }
    },
    remover: async (req, res) => {
      try {
        if (!_dbOk(res)) return
        const { id } = req.params
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
        // Soft-delete: marca ativo=false (preserva referências em projetos)
        const doc = await model.findByIdAndUpdate(id, { $set: { ativo: false } }, { new: true })
        if (!doc) return res.status(404).json({ erro: 'Não encontrado' })
        res.json({ sucesso: true, item: doc })
      } catch (e) { res.status(500).json({ erro: e.message }) }
    },
  }
}

// ── Matriz RBAC ─────────────────────────────────────────────────────────────
router.get('/rbac/matriz', (_req, res) => {
  res.json({ sucesso: true, perfis: PERFIS, modulos: MODULOS, acoes: ACOES, labels: LABEL_PERFIL, matriz: MATRIZ_RBAC })
})

// ── Usuários (senha tratada só na criação; oculta hash) ───────────────────────
const usuarios = crud(User, { selecionar: '-senha_hash' })
router.get('/usuarios', usuarios.listar)
router.post('/usuarios', async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const { nome, email, perfil, telefone, cargo, empresa_id, senha } = req.body || {}
    if (!nome || !email) return res.status(400).json({ erro: 'nome e email são obrigatórios' })
    // senha_hash é required no model; usa senha enviada ou um placeholder (admin define depois)
    const doc = await User.create({
      nome, email, perfil: perfil || 'visualizador', telefone, cargo, empresa_id: empresa_id || null,
      senha_hash: senha || Math.random().toString(36).slice(2) + 'A1!',
    })
    res.status(201).json({ sucesso: true, item: doc })   // toJSON remove senha_hash
  } catch (e) { res.status(400).json({ erro: e.message }) }
})
router.put('/usuarios/:id', usuarios.atualizar)
router.delete('/usuarios/:id', usuarios.remover)

// ── Empresas (multiempresa) ───────────────────────────────────────────────────
const empresas = crud(Empresa)
router.get('/empresas', empresas.listar)
router.post('/empresas', empresas.criar)
router.put('/empresas/:id', empresas.atualizar)
router.delete('/empresas/:id', empresas.remover)

// ── Técnicos ────────────────────────────────────────────────────────────────
const tecnicos = crud(Tecnico)
router.get('/tecnicos', tecnicos.listar)
router.post('/tecnicos', tecnicos.criar)
router.put('/tecnicos/:id', tecnicos.atualizar)
router.delete('/tecnicos/:id', tecnicos.remover)

// ── Vendedores ────────────────────────────────────────────────────────────────
const vendedores = crud(Vendedor)
router.get('/vendedores', vendedores.listar)
router.post('/vendedores', vendedores.criar)
router.put('/vendedores/:id', vendedores.atualizar)
router.delete('/vendedores/:id', vendedores.remover)

export default router
