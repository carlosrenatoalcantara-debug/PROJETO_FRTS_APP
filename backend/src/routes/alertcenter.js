/**
 * alertcenter.js — Sprint 8.8
 * Endpoints unificados de AlertCenter.
 *  GET  /api/alertcenter            → lista alertas + KPIs + filtros (texto/sev/origem/período)
 *  GET  /api/alertcenter/kpis       → apenas KPIs (lightweight)
 *  POST /api/alertcenter/resolver   → marca alert_id como resolvido (+ observação opcional)
 *  POST /api/alertcenter/arquivar   → arquiva alert_id
 *  POST /api/alertcenter/reabrir    → reabre alert_id
 *  POST /api/alertcenter/observacao → adiciona observação sem mudar status
 *
 * Reusa modelos existentes (Tecnico, Equipamento, DocumentoTecnico, ProjetoFV,
 * FaturaEnergia, UnidadeBeneficiaria) e auditoria via AuditLog.
 */
import { Router } from 'express'
import mongoose from 'mongoose'
import { Tecnico } from '../models/Tecnico.js'
import { Equipamento } from '../models/Equipamento.js'
import { DocumentoTecnico } from '../models/DocumentoTecnico.js'
import { ProjetoFV } from '../models/ProjetoFV.js'
import { FaturaEnergia } from '../models/FaturaEnergia.js'
import { UnidadeBeneficiaria } from '../models/UnidadeBeneficiaria.js'
import { AuditLog } from '../models/AuditLog.js'
import { AlertaStatus } from '../models/AlertaStatus.js'
import { agregarAlertas, calcularKPIs, filtrarAlertas, SEVERIDADES, ORIGENS } from '../utils/alertcenter/alertDetectors.js'
import { diagnosticarFicha } from '../utils/catalogo/fichaTecnicaMap.js'

const router = Router()

function _dbOk(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ erro: 'MongoDB indisponível.', codigo: 'DB_OFFLINE' })
    return false
  }
  return true
}

// Cache TTL curto p/ evitar recalcular a cada page hit (60s)
const CACHE_TTL_MS = 60_000
let _cache = { em: 0, alertas: null }

async function obterTodosAlertas({ forcarRefresh = false } = {}) {
  const agora = Date.now()
  if (!forcarRefresh && _cache.alertas && (agora - _cache.em) < CACHE_TTL_MS) {
    return _cache.alertas
  }
  // Buscas paralelas em todas as fontes
  const [tecnicos, equipamentos, documentos, projetos, faturas] = await Promise.all([
    Tecnico.find({}).lean(),
    Equipamento.find({}).lean(),
    DocumentoTecnico.find({}).lean().catch(() => []),
    ProjetoFV.find({}).lean(),
    FaturaEnergia.find({}).lean().catch(() => []),
  ])

  // Beneficiárias agrupadas por projeto (uma query, hash em memória)
  const benefs = await UnidadeBeneficiaria.find({}).lean().catch(() => [])
  const beneficiariasPorProjeto = new Map()
  for (const b of benefs) {
    const k = String(b.projetoId)
    if (!beneficiariasPorProjeto.has(k)) beneficiariasPorProjeto.set(k, [])
    beneficiariasPorProjeto.get(k).push(b)
  }

  const alertas = agregarAlertas({
    tecnicos, equipamentos, documentos, projetos, beneficiariasPorProjeto, faturas,
    diagnosticarFicha,
  })
  _cache = { em: agora, alertas }
  return alertas
}

async function obterStatusMap(alertIds) {
  if (!alertIds.length) return new Map()
  const docs = await AlertaStatus.find({ alert_id: { $in: alertIds } }).lean()
  const m = new Map()
  for (const d of docs) m.set(d.alert_id, d)
  return m
}

async function auditar(req, acao, detalhe = null) {
  try {
    if (mongoose.connection.readyState !== 1) return
    await AuditLog.create({
      timestamp: new Date(), usuario: req.auth?.id || req.auth?.email || 'anonymous',
      perfil: req.auth?.perfil || null, empresa: req.auth?.empresa_id || null,
      modulo: 'alertcenter', acao, metodo: 'EVENT',
      path: detalhe ? String(detalhe).slice(0, 240) : '', status: 200,
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null,
    })
  } catch { /* silencioso */ }
}

// ─── GET / — lista paginada + KPIs com filtros ───────────────────────────────
router.get('/', async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const alertas = await obterTodosAlertas({ forcarRefresh: req.query.refresh === '1' })
    const statusMap = await obterStatusMap(alertas.map(a => a.id))
    const filtrados = filtrarAlertas(alertas, {
      severidade: req.query.severidade,
      origem: req.query.origem,
      periodo_dias: req.query.periodo_dias ? Number(req.query.periodo_dias) : null,
      status: req.query.status || 'aberto',
      texto: req.query.q,
    }, statusMap)
    // Anexa estado em cada item
    const itens = filtrados.map(a => ({
      ...a,
      status: statusMap.get(a.id)?.status || 'aberto',
      resolvido_em: statusMap.get(a.id)?.resolvido_em || null,
      observacao: statusMap.get(a.id)?.observacao || null,
    }))
    const kpis = calcularKPIs(alertas, statusMap)
    res.json({ sucesso: true, total: itens.length, total_geral: alertas.length, kpis, itens })
  } catch (err) {
    console.error('[alertcenter] GET:', err)
    res.status(500).json({ erro: err.message })
  }
})

// ─── GET /kpis — só métricas (uso em badges/menu) ────────────────────────────
router.get('/kpis', async (_req, res) => {
  try {
    if (!_dbOk(res)) return
    const alertas = await obterTodosAlertas()
    const statusMap = await obterStatusMap(alertas.map(a => a.id))
    res.json({ sucesso: true, kpis: calcularKPIs(alertas, statusMap) })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

// ─── GET /origens — labels para o frontend ───────────────────────────────────
router.get('/meta', (_req, res) => {
  res.json({ sucesso: true, severidades: SEVERIDADES, origens: ORIGENS })
})

// ─── Mutações de status ──────────────────────────────────────────────────────
async function mudarStatus(req, res, novoStatus, acaoAudit) {
  try {
    if (!_dbOk(res)) return
    const { alert_id, origem = null, observacao = null } = req.body || {}
    if (!alert_id) return res.status(400).json({ erro: 'alert_id obrigatório' })
    const usuario = req.auth?.id || req.auth?.email || 'anonymous'
    const histEntry = { acao: novoStatus === 'aberto' ? 'reaberto' : novoStatus, por: usuario, observacao }
    const doc = await AlertaStatus.findOneAndUpdate(
      { alert_id },
      {
        $set: {
          status: novoStatus,
          origem,
          observacao,
          resolvido_por: novoStatus === 'resolvido' ? usuario : null,
          resolvido_em:  novoStatus === 'resolvido' ? new Date() : null,
        },
        $push: { historico: histEntry },
        $setOnInsert: { alert_id },
      },
      { upsert: true, new: true }
    )
    auditar(req, acaoAudit, `${alert_id} ${observacao ? '| ' + observacao.slice(0, 80) : ''}`)
    res.json({ sucesso: true, item: doc })
  } catch (err) {
    console.error('[alertcenter]', err)
    res.status(500).json({ erro: err.message })
  }
}

router.post('/resolver',  (req, res) => mudarStatus(req, res, 'resolvido', 'ALERTA_RESOLVIDO'))
router.post('/arquivar',  (req, res) => mudarStatus(req, res, 'arquivado', 'ALERTA_ARQUIVADO'))
router.post('/reabrir',   (req, res) => mudarStatus(req, res, 'aberto',    'ALERTA_REABERTO'))

router.post('/observacao', async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const { alert_id, observacao } = req.body || {}
    if (!alert_id || !observacao) return res.status(400).json({ erro: 'alert_id e observacao obrigatórios' })
    const usuario = req.auth?.id || req.auth?.email || 'anonymous'
    const doc = await AlertaStatus.findOneAndUpdate(
      { alert_id },
      { $push: { historico: { acao: 'observacao', por: usuario, observacao } }, $setOnInsert: { alert_id, status: 'aberto' } },
      { upsert: true, new: true }
    )
    auditar(req, 'ALERTA_OBSERVACAO', `${alert_id} | ${observacao.slice(0, 80)}`)
    res.json({ sucesso: true, item: doc })
  } catch (err) { res.status(500).json({ erro: err.message }) }
})

export default router
