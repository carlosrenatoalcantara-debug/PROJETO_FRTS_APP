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
import { AtivoEquipamento } from '../models/AtivoEquipamento.js'
import { agregarAlertas, calcularKPIs, filtrarAlertas, SEVERIDADES, ORIGENS } from '../utils/alertcenter/alertDetectors.js'
import { diagnosticarFicha } from '../utils/catalogo/fichaTecnicaMap.js'
import { gerarChecklist } from '../utils/homologacao/homologacaoAssistida.js'

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
// M-4: cache POR ORGANIZAÇÃO. Um cache global vazaria alertas entre tenants.
const _cache = new Map()   // empresa_id → { em, alertas }

async function obterTodosAlertas(req, { forcarRefresh = false } = {}) {
  const _tenant = String(exigirTenant(req, 'alertcenter'))
  const agora = Date.now()
  const _c = _cache.get(_tenant)
  if (!forcarRefresh && _c?.alertas && (agora - _c.em) < CACHE_TTL_MS) {
    return _c.alertas
  }
  // Buscas paralelas em todas as fontes
  const [tecnicos, equipamentos, documentos, projetos, faturas, ativosGarantia] = await Promise.all([
    Tecnico.find(aplicarEscopo({}, req, { contexto: 'alert' })).lean(),
    Equipamento.find({}).lean(),
    DocumentoTecnico.find(aplicarEscopo({}, req, { contexto: 'alert' })).lean().catch(() => []),
    ProjetoFV.find(aplicarEscopo({}, req, { contexto: 'alert' })).lean(),
    FaturaEnergia.find(aplicarEscopo({}, req, { contexto: 'alert' })).lean().catch(() => []),
    // P5-GARANTIA-SIMPLES-01 — apenas ativos com garantia_fim preenchida
    AtivoEquipamento.find(aplicarEscopo({ garantia_fim: { $ne: null }, status: { $nin: ['substituido', 'desativado'] } }, req, { contexto: 'alert' }), 'fabricante modelo qr_code garantia_fim status').lean().catch(() => []),
  ])

  // Beneficiárias agrupadas por projeto (uma query, hash em memória)
  const benefs = await UnidadeBeneficiaria.find(aplicarEscopo({}, req, { contexto: 'alert' })).lean().catch(() => [])
  const beneficiariasPorProjeto = new Map()
  for (const b of benefs) {
    const k = String(b.projetoId)
    if (!beneficiariasPorProjeto.has(k)) beneficiariasPorProjeto.set(k, [])
    beneficiariasPorProjeto.get(k).push(b)
  }

  // S9.0 — Checklist de homologação por projeto (limita a projetos não-arquivados para perf)
  const checklistsPorProjeto = new Map()
  for (const p of projetos) {
    if (p.excluido || p.status_display === 'ARQUIVADO') continue
    // Equipamentos referenciados pelo projeto
    const ids = []
    for (const e of (p?.equipamentos?.paineis || [])) if (e?._id || e?.equipamento_id) ids.push(e._id || e.equipamento_id)
    if (p?.equipamentos?.inversor?._id) ids.push(p.equipamentos.inversor._id)
    if (p?.equipamentos?.inversor?.equipamento_id) ids.push(p.equipamentos.inversor.equipamento_id)
    const eqs = ids.length ? equipamentos.filter(e => ids.some(id => String(id) === String(e._id))) : []
    const benefs = beneficiariasPorProjeto.get(String(p._id)) || []
    try {
      const cl = gerarChecklist({ projeto: p, equipamentos: eqs, beneficiarias: benefs, concessionaria: p?.homologacao?.concessionaria })
      checklistsPorProjeto.set(String(p._id), cl)
    } catch { /* tolera projetos com shape antigo */ }
  }

  const alertas = agregarAlertas({
    tecnicos, equipamentos, documentos, projetos, beneficiariasPorProjeto, faturas,
    checklistsPorProjeto, diagnosticarFicha, ativos: ativosGarantia,
  })
  _cache.set(_tenant, { em: agora, alertas })
  return alertas
}

async function obterStatusMap(alertIds, req) {
  if (!alertIds.length) return new Map()
  const docs = await AlertaStatus.find(aplicarEscopo({ alert_id: { $in: alertIds } }, req, { contexto: 'alert.status' })).lean()
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
    const alertas = await obterTodosAlertas(req, { forcarRefresh: req.query.refresh === '1' })
    const statusMap = await obterStatusMap(alertas.map(a => a.id), req)
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
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
})

// ─── GET /kpis — só métricas (uso em badges/menu) ────────────────────────────
router.get('/kpis', async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const alertas = await obterTodosAlertas(req)
    const statusMap = await obterStatusMap(alertas.map(a => a.id), req)
    res.json({ sucesso: true, kpis: calcularKPIs(alertas, statusMap) })
  } catch (err) { res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo }) }
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
      aplicarEscopo({ alert_id }, req, { contexto: 'alert.status' }),
      {
        $set: {
          status: novoStatus,
          origem,
          observacao,
          resolvido_por: novoStatus === 'resolvido' ? usuario : null,
          resolvido_em:  novoStatus === 'resolvido' ? new Date() : null,
        },
        $push: { historico: histEntry },
        // M-4: upsert precisa carimbar o tenant, senão cria doc órfão (empresa_id null).
        $setOnInsert: { alert_id, empresa_id: exigirTenant(req, 'alert.status') },
      },
      { upsert: true, new: true }
    )
    auditar(req, acaoAudit, `${alert_id} ${observacao ? '| ' + observacao.slice(0, 80) : ''}`)
    res.json({ sucesso: true, item: doc })
  } catch (err) {
    console.error('[alertcenter]', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
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
      aplicarEscopo({ alert_id }, req, { contexto: 'alert.status' }),
      { $push: { historico: { acao: 'observacao', por: usuario, observacao } }, $setOnInsert: { alert_id, status: 'aberto', empresa_id: exigirTenant(req, 'alert.status') } },
      { upsert: true, new: true }
    )
    auditar(req, 'ALERTA_OBSERVACAO', `${alert_id} | ${observacao.slice(0, 80)}`)
    res.json({ sucesso: true, item: doc })
  } catch (err) { res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo }) }
})

export default router
