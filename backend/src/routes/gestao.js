import { Router } from 'express'
import mongoose from 'mongoose'
import User from '../models/User.js'
import { Empresa } from '../models/Empresa.js'
import { Tecnico } from '../models/Tecnico.js'
import { Vendedor } from '../models/Vendedor.js'
import { MATRIZ_RBAC, PERFIS, MODULOS, ACOES, LABEL_PERFIL } from '../services/rbac.js'
import { AuditLog } from '../models/AuditLog.js'
import { calcularDelta, filtroEmailUnico } from '../utils/gestaoDelta.js'

// S8.3.1: auditoria inteligente (delta, não o objeto inteiro)
async function auditarDelta(req, evento, alvo, delta) {
  try {
    if (mongoose.connection.readyState !== 1) return
    await AuditLog.create({
      timestamp: new Date(), usuario: req.auth?.id || req.auth?.email || 'anonymous',
      perfil: req.auth?.perfil || null, empresa: req.auth?.empresa_id || null,
      modulo: 'configuracoes', acao: evento, metodo: 'EVENT',
      path: `${alvo} ${JSON.stringify(delta).slice(0, 300)}`, status: 200,
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null,
    })
  } catch { /* silencioso */ }
}

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
// `evento` (S8.3.1) → nome do evento de auditoria de edição.
function crud(model, { selecionar = null, ordenar = { createdAt: -1 }, evento = 'EDITADO' } = {}) {
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
        const antes = await model.findById(id).lean()
        if (!antes) return res.status(404).json({ erro: 'Não encontrado' })
        const delta = calcularDelta(antes, req.body || {})
        const doc = await model.findByIdAndUpdate(id, { $set: req.body || {} }, { new: true, runValidators: true })
        if (Object.keys(delta).length) {
          await auditarDelta(req, evento, `${antes.nome || id}`, delta)
          if (delta.ativo) await auditarDelta(req, 'STATUS_ALTERADO', `${antes.nome || id}`, { ativo: delta.ativo })
        }
        res.json({ sucesso: true, item: doc, alteracoes: delta })
      } catch (e) { res.status(400).json({ erro: e.message }) }
    },
    remover: async (req, res) => {
      try {
        if (!_dbOk(res)) return
        const { id } = req.params
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
        // Soft-delete: marca ativo=false (preserva referências em projetos/integridade histórica)
        const doc = await model.findByIdAndUpdate(id, { $set: { ativo: false } }, { new: true })
        if (!doc) return res.status(404).json({ erro: 'Não encontrado' })
        await auditarDelta(req, 'STATUS_ALTERADO', `${doc.nome || id}`, { ativo: { antes: true, depois: false } })
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
const usuarios = crud(User, { selecionar: '-senha_hash', evento: 'USUARIO_EDITADO' })
router.get('/usuarios', usuarios.listar)
router.post('/usuarios', async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const { nome, email, perfil, telefone, cargo, empresa_id, senha } = req.body || {}
    if (!nome || !email) return res.status(400).json({ erro: 'nome e email são obrigatórios' })
    // S8.3.1: e-mail único
    if (await User.findOne({ email: String(email).toLowerCase() })) return res.status(409).json({ erro: 'E-mail já cadastrado' })
    const doc = await User.create({
      nome, email, perfil: perfil || 'visualizador', telefone, cargo, empresa_id: empresa_id || null,
      senha_hash: senha || Math.random().toString(36).slice(2) + 'A1!',
    })
    res.status(201).json({ sucesso: true, item: doc })   // toJSON remove senha_hash
  } catch (e) { res.status(400).json({ erro: e.message }) }
})
// S8.3.1: PUT custom — e-mail único EXCLUINDO o próprio usuário + delta audit
router.put('/usuarios/:id', async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
    const antes = await User.findById(id).lean()
    if (!antes) return res.status(404).json({ erro: 'Não encontrado' })

    const { nome, email, telefone, cargo, perfil, ativo } = req.body || {}
    if (email && String(email).toLowerCase() !== String(antes.email).toLowerCase()) {
      const dup = await User.findOne(filtroEmailUnico(email, id))
      if (dup) return res.status(409).json({ erro: 'E-mail já cadastrado em outro usuário' })
    }
    const mudancas = {}
    for (const [k, v] of Object.entries({ nome, email, telefone, cargo, perfil, ativo })) if (v !== undefined) mudancas[k] = v
    const delta = calcularDelta(antes, mudancas)
    const doc = await User.findByIdAndUpdate(id, { $set: mudancas }, { new: true, runValidators: true }).select('-senha_hash')
    if (Object.keys(delta).length) await auditarDelta(req, 'USUARIO_EDITADO', antes.nome || id, delta)
    if (delta.ativo) await auditarDelta(req, 'STATUS_ALTERADO', antes.nome || id, { ativo: delta.ativo })
    res.json({ sucesso: true, item: doc, alteracoes: delta })
  } catch (e) { res.status(400).json({ erro: e.message }) }
})
router.delete('/usuarios/:id', usuarios.remover)

// ── Empresas (multiempresa) ───────────────────────────────────────────────────
const empresas = crud(Empresa, { evento: 'EMPRESA_EDITADA' })
router.get('/empresas', empresas.listar)
router.post('/empresas', empresas.criar)
router.put('/empresas/:id', empresas.atualizar)
router.delete('/empresas/:id', empresas.remover)

// ── Técnicos ────────────────────────────────────────────────────────────────
const tecnicos = crud(Tecnico, { evento: 'TECNICO_EDITADO' })
router.get('/tecnicos', tecnicos.listar)
router.post('/tecnicos', tecnicos.criar)
router.put('/tecnicos/:id', tecnicos.atualizar)
router.delete('/tecnicos/:id', tecnicos.remover)

// ── Vendedores ────────────────────────────────────────────────────────────────
const vendedores = crud(Vendedor, { evento: 'VENDEDOR_EDITADO' })
router.get('/vendedores', vendedores.listar)
router.post('/vendedores', vendedores.criar)
router.put('/vendedores/:id', vendedores.atualizar)
router.delete('/vendedores/:id', vendedores.remover)

export default router
