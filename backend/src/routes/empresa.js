import { Router } from 'express'
import mongoose from 'mongoose'
import { EmpresaConfig } from '../models/EmpresaConfig.js'
import { AuditLog } from '../models/AuditLog.js'
import { MATRIZ_RBAC, PERFIS, MODULOS, mesclarMatriz } from '../services/rbac.js'

/**
 * Rotas de configuração institucional (S7.1 / S8.3.2) — singleton.
 * GET  /api/empresa            → retorna a configuração (cria vazia se não existir)
 * PUT  /api/empresa            → faz merge dos grupos enviados (+ dados_bancarios)
 * PUT  /api/empresa/permissoes → salva RBAC customizado + auditoria delta
 */
const router = Router()

function _dbOk(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ erro: 'MongoDB indisponível.', codigo: 'DB_OFFLINE' })
    return false
  }
  return true
}

const GRUPOS = ['empresa_config', 'responsavel_tecnico', 'branding', 'uploads', 'armazenamento']

async function obterSingleton() {
  let doc = await EmpresaConfig.findOne({ chave: 'default' })
  if (!doc) doc = await EmpresaConfig.create({ chave: 'default' })
  return doc
}

// S8.3.2 — auditoria (reaproveita AuditLog; não cria sistema paralelo)
async function auditarEmpresa(req, acao, detalhe) {
  try {
    if (mongoose.connection.readyState !== 1) return
    await AuditLog.create({
      timestamp: new Date(), usuario: req.auth?.id || req.auth?.email || 'anonymous',
      perfil: req.auth?.perfil || null, empresa: req.auth?.empresa_id || null,
      modulo: 'configuracoes', acao, metodo: 'EVENT',
      path: String(detalhe).slice(0, 300), status: 200,
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null,
    })
  } catch { /* silencioso */ }
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
    // S8.3.2 — dados_bancarios: substitui o array inteiro quando enviado (lista de contas)
    if (Array.isArray(req.body.dados_bancarios)) {
      const antes = (doc.dados_bancarios || []).length
      doc.dados_bancarios = req.body.dados_bancarios
      doc.markModified('dados_bancarios')
      auditarEmpresa(req, 'BANCO_ALTERADO', `contas: ${antes} → ${req.body.dados_bancarios.length}`)
    }
    if (req.body.empresa_config && typeof req.body.empresa_config === 'object') {
      auditarEmpresa(req, 'ORGANIZACAO_EDITADA', `org: ${req.body.empresa_config.nomeFantasia || req.body.empresa_config.razaoSocial || ''}`)
    }
    await doc.save()
    res.json({ sucesso: true, config: doc })
  } catch (err) {
    console.error('[empresa] PUT:', err)
    res.status(500).json({ erro: err.message })
  }
})

/**
 * S8.3.2 — RBAC flexível. Salva permissoes_customizadas (matriz parcial) e audita
 * cada célula alterada (PERMISSAO_ALTERADA com perfil/modulo/antes/depois).
 * Body: { permissoes_customizadas: { perfil: { modulo: nivel } } }
 */
router.put('/permissoes', async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const nova = req.body?.permissoes_customizadas
    if (!nova || typeof nova !== 'object') return res.status(400).json({ erro: 'permissoes_customizadas inválido' })

    const doc = await obterSingleton()
    const matrizAntes = mesclarMatriz(doc.permissoes_customizadas)   // efetiva atual
    const matrizDepois = mesclarMatriz(nova)                          // efetiva proposta

    // Auditoria delta: só registra células que mudaram de nível efetivo
    let alteracoes = 0
    for (const p of PERFIS) {
      for (const m of MODULOS) {
        const a = matrizAntes[p]?.[m]
        const d = matrizDepois[p]?.[m]
        if (a !== d) {
          alteracoes++
          auditarEmpresa(req, 'PERMISSAO_ALTERADA', `${p}.${m}: ${a} → ${d}`)
        }
      }
    }

    doc.permissoes_customizadas = nova
    doc.markModified('permissoes_customizadas')
    await doc.save()
    res.json({ sucesso: true, alteracoes, permissoes_customizadas: doc.permissoes_customizadas })
  } catch (err) {
    console.error('[empresa] PUT /permissoes:', err)
    res.status(500).json({ erro: err.message })
  }
})

// Matriz padrão (referência para o editor de permissões)
router.get('/permissoes/padrao', (_req, res) => {
  res.json({ sucesso: true, perfis: PERFIS, modulos: MODULOS, matriz: MATRIZ_RBAC })
})

export default router
