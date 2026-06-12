import { Router } from 'express'
import mongoose from 'mongoose'
import User from '../models/User.js'
import { Empresa } from '../models/Empresa.js'
import { Tecnico } from '../models/Tecnico.js'
import { Vendedor } from '../models/Vendedor.js'
import { MATRIZ_RBAC, PERFIS, MODULOS, ACOES, LABEL_PERFIL } from '../services/rbac.js'
import { AuditLog } from '../models/AuditLog.js'
import { calcularDelta, filtroEmailUnico } from '../utils/gestaoDelta.js'
// P0-AUTH-MAIL-01
import { gerarToken, enviarEmail, smtpConfigurado, verificarTransporte } from '../services/mailService.js'
import { templateConvite, templateReset } from '../services/emailTemplates.js'
import { podeDisparar, registrarDisparo } from '../services/mailRateLimit.js'

const APP_URL = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173'
// Perfis autorizados a disparar reset/convite
const PERFIS_GESTAO_ACESSO = ['admin', 'administrador', 'diretor']

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

// ── P0-AUTH-MAIL-01: Reset de senha / Reenvio de convite ──────────────────────
// POST /api/gestao/usuarios/:id/reset-password
// Gera token expirável, invalida o token anterior, audita e dispara o e-mail via Zoho.
// Só perfis Admin/Diretor. Rate-limited por usuário.
router.post('/usuarios/:id/reset-password', async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })

    // Autorização: apenas Admin/Diretor (defesa em profundidade além do protegerModulo)
    const perfilSolicitante = (req.auth?.perfil || '').toLowerCase()
    if (perfilSolicitante && !PERFIS_GESTAO_ACESSO.includes(perfilSolicitante)) {
      return res.status(403).json({ erro: 'Apenas Admin/Diretor podem redefinir acesso de usuários.' })
    }

    const user = await User.findById(id)
    if (!user) return res.status(404).json({ erro: 'Usuário não encontrado' })

    // Rate-limit por usuário-alvo
    const rl = podeDisparar(id)
    if (!rl.ok) return res.status(429).json({ erro: rl.motivo, retry_em_s: rl.retry_em_s })

    // Tipo: convite (primeiro acesso, 24h) se nunca logou; senão reset (uso único, 30min)
    const tipo = req.body?.tipo === 'convite' || (!user.ultimo_login)
      ? 'convite' : 'reset'
    const validadeMs = tipo === 'convite' ? 24 * 60 * 60 * 1000 : 30 * 60 * 1000

    // Gera token novo → INVALIDA automaticamente qualquer token anterior (sobrescreve hash)
    const { raw, hash } = gerarToken()
    user.reset_token_hash   = hash
    user.reset_token_expira = new Date(Date.now() + validadeMs)
    user.reset_token_usado  = false
    user.reset_token_tipo   = tipo
    await user.save()   // não altera senha_hash (não foi modificado) → senha atual segue válida até a redefinição

    const link = `${APP_URL}/redefinir-senha?token=${raw}`
    const tpl = tipo === 'convite'
      ? templateConvite({ nome: user.nome, link, validadeHoras: 24 })
      : templateReset({ nome: user.nome, link, validadeMinutos: 30 })

    let envio
    try {
      envio = await enviarEmail({ to: user.email, subject: tpl.subject, html: tpl.html })
    } catch (e) {
      envio = { enviado: false, motivo: e.message }
    }

    registrarDisparo(id)

    // Auditoria persistente (FASE 3)
    await auditarDelta(req, tipo === 'convite' ? 'CONVITE_ENVIADO' : 'RESET_SENHA_ENVIADO',
      user.nome || user.email,
      { para: user.email, tipo, enviado: envio.enviado, expira_em: user.reset_token_expira, por: req.auth?.email || req.auth?.id || 'sistema' })

    res.json({
      sucesso: true,
      tipo,
      enviado: envio.enviado,
      smtp_configurado: smtpConfigurado(),
      expira_em: user.reset_token_expira,
      ...(envio.enviado ? {} : { aviso: envio.motivo || 'E-mail não enviado (SMTP não configurado).' }),
    })
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
})

// GET /api/gestao/smtp/verificar — teste de handshake SMTP (não envia e-mail)
router.get('/smtp/verificar', async (_req, res) => {
  const r = await verificarTransporte()
  res.status(r.ok ? 200 : 503).json(r)
})

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
