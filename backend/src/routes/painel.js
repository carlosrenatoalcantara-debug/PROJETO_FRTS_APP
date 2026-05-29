import { Router } from 'express'
import mongoose from 'mongoose'
import { ProjetoFV } from '../models/ProjetoFV.js'
import { Equipamento } from '../models/Equipamento.js'
import { Tecnico } from '../models/Tecnico.js'
import { Vendedor } from '../models/Vendedor.js'
import { Empresa } from '../models/Empresa.js'
import User from '../models/User.js'
import { AuditLog } from '../models/AuditLog.js'

/**
 * Painel executivo, health da plataforma e auditoria consultável (S7.3).
 * Agregações sobre dados REAIS — sem mock. Additive; não altera engenharia.
 */
const router = Router()

function _dbOk(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ erro: 'MongoDB indisponível.', codigo: 'DB_OFFLINE' })
    return false
  }
  return true
}
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const media = (arr) => (arr.length ? +(arr.reduce((s, x) => s + x, 0) / arr.length).toFixed(2) : null)

// ─── GET /api/painel/executivo ──────────────────────────────────────────────
router.get('/executivo', async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const filtro = req.query.empresa_id
      ? { $or: [{ empresa_id: req.query.empresa_id }, { empresa_id: null }] } : {}
    const projetos = await ProjetoFV.find(filtro)
      .select('status potencia_kwp dimensionamento governanca.freeze_status governanca.comercial.workflow_status governanca.comercial.crm_pipeline governanca.snapshot_tecnico governanca.snapshot_financeiro')
      .lean()

    // Projetos
    const total = projetos.length
    const congelados = projetos.filter(p => ['CONGELADO', 'HOMOLOGADO'].includes(p.governanca?.freeze_status)).length
    const homologados = projetos.filter(p => p.governanca?.freeze_status === 'HOMOLOGADO').length
    const emAndamento = total - congelados

    // Comercial (funil CRM + workflow)
    const funil = { LEAD: 0, QUALIFICADO: 0, PROPOSTA: 0, NEGOCIACAO: 0, FECHADO: 0, PERDIDO: 0, IMPLANTACAO: 0 }
    let propostasEnviadas = 0
    for (const p of projetos) {
      const pl = p.governanca?.comercial?.crm_pipeline
      if (pl && funil[pl] != null) funil[pl]++
      const wf = p.governanca?.comercial?.workflow_status
      if (wf && wf !== 'EM_ANALISE' && wf !== 'RASCUNHO') propostasEnviadas++
    }
    const fechados = funil.FECHADO + funil.IMPLANTACAO
    const taxaConversao = total > 0 ? +((fechados / total) * 100).toFixed(1) : 0

    // Energia
    let kwpVendidos = 0, kwpInstalados = 0, geracaoAnual = 0
    for (const p of projetos) {
      const kwp = num(p.dimensionamento?.potencia_kwp) || num(p.potencia_kwp)
      kwpVendidos += kwp
      const congelado = ['CONGELADO', 'HOMOLOGADO'].includes(p.governanca?.freeze_status)
      if (congelado) kwpInstalados += kwp
      geracaoAnual += num(p.governanca?.snapshot_tecnico?.geracao_anual_kwh) || (kwp * 1400) // fallback ~1400 kWh/kWp/ano
    }

    // Financeiro (snapshots)
    const precos = [], margens = [], rois = [], paybacks = []
    let valorTotalPropostas = 0, valorVendido = 0
    for (const p of projetos) {
      const f = p.governanca?.snapshot_financeiro
      const preco = num(f?.proposta_final)
      if (preco > 0) { precos.push(preco); valorTotalPropostas += preco }
      if (preco > 0 && ['CONGELADO', 'HOMOLOGADO'].includes(p.governanca?.freeze_status)) valorVendido += preco
      if (f?.margem?.margem_liquida_pct != null) margens.push(num(f.margem.margem_liquida_pct))
      const roi = f?.retorno_realista?.roi_pct ?? f?.retorno?.roi_pct
      if (roi != null) rois.push(num(roi))
      const pb = f?.retorno_realista?.payback_anos ?? f?.retorno?.payback_anos
      if (pb != null) paybacks.push(num(pb))
    }

    res.json({
      sucesso: true,
      gerado_em: new Date(),
      projetos: { total, em_andamento: emAndamento, congelados, homologados },
      comercial: {
        leads: funil.LEAD, qualificados: funil.QUALIFICADO, propostas: funil.PROPOSTA,
        negociacao: funil.NEGOCIACAO, fechados: funil.FECHADO, perdidos: funil.PERDIDO,
        implantacao: funil.IMPLANTACAO, propostas_enviadas: propostasEnviadas,
        taxa_conversao_pct: taxaConversao,
      },
      energia: {
        kwp_vendidos: +kwpVendidos.toFixed(2), kwp_instalados: +kwpInstalados.toFixed(2),
        geracao_anual_kwh: Math.round(geracaoAnual), geracao_mensal_kwh: Math.round(geracaoAnual / 12),
      },
      financeiro: {
        valor_total_propostas: +valorTotalPropostas.toFixed(2),
        valor_vendido: +valorVendido.toFixed(2),
        ticket_medio: media(precos),
        margem_media_pct: media(margens),
        roi_medio_pct: media(rois),
        payback_medio_anos: media(paybacks),
      },
    })
  } catch (err) {
    console.error('[painel] executivo:', err)
    res.status(500).json({ erro: err.message })
  }
})

// ─── GET /api/painel/health ──────────────────────────────────────────────────
router.get('/health', async (_req, res) => {
  try {
    if (!_dbOk(res)) return
    const [usuarios, empresas, vendedores, tecnicos, equipamentos, projetos] = await Promise.all([
      User.countDocuments(), Empresa.countDocuments(), Vendedor.countDocuments(),
      Tecnico.countDocuments(), Equipamento.countDocuments(), ProjetoFV.countDocuments(),
    ])
    const comSnapshot = await ProjetoFV.countDocuments({ 'governanca.snapshot_tecnico': { $ne: null } })
    const congelados = await ProjetoFV.countDocuments({ 'governanca.freeze_status': { $in: ['CONGELADO', 'HOMOLOGADO'] } })
    // S7.3.1: métricas documentais (documento ≈ unifilar/proposta congelados)
    const docsGerados = await ProjetoFV.countDocuments({ 'governanca.snapshot_unifilar': { $ne: null } })
    const docsCongelados = congelados
    const semDocumentos = projetos - docsGerados

    // S8.4 — ciclo de vida e saúde do dataset
    const [arquivados, excluidos, legados, pendentesRev] = await Promise.all([
      ProjetoFV.countDocuments({ status: 'arquivado' }),
      ProjetoFV.countDocuments({ excluido: true }),
      ProjetoFV.countDocuments({ legacy: true }),
      ProjetoFV.countDocuments({ necessita_revisao: true }),
    ])
    const ativos = projetos - arquivados - excluidos

    res.json({
      sucesso: true,
      plataforma: {
        usuarios, empresas, vendedores, tecnicos, equipamentos_catalogo: equipamentos,
        projetos_total: projetos, projetos_com_snapshot: comSnapshot,
        projetos_sem_snapshot: projetos - comSnapshot, projetos_congelados: congelados,
        // divergência técnica é detectada sob demanda (endpoint /divergencia); aqui é indicativo
        projetos_com_divergencia: null,
        // S7.3.1: documentos
        documentos_gerados: docsGerados,
        documentos_congelados: docsCongelados,
        documentos_pendentes: projetos - docsGerados,
        projetos_sem_documentos: semDocumentos,
        // S8.4: ciclo de vida
        projetos_ativos: ativos,
        projetos_arquivados: arquivados,
        projetos_excluidos: excluidos,
        projetos_legados: legados,
        projetos_pendentes_revisao: pendentesRev,
      },
    })
  } catch (err) {
    console.error('[painel] health:', err)
    res.status(500).json({ erro: err.message })
  }
})

// ─── GET /api/painel/auditoria ───────────────────────────────────────────────
router.get('/auditoria', async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const { usuario, empresa, modulo, acao, de, ate, limite } = req.query
    const filtro = {}
    if (usuario) filtro.usuario = usuario
    if (empresa) filtro.empresa = empresa
    if (modulo) filtro.modulo = modulo
    if (acao) filtro.acao = acao
    if (de || ate) {
      filtro.timestamp = {}
      if (de) filtro.timestamp.$gte = new Date(de)
      if (ate) filtro.timestamp.$lte = new Date(ate)
    }
    const lim = Math.min(parseInt(limite) || 200, 1000)
    const itens = await AuditLog.find(filtro).sort({ timestamp: -1 }).limit(lim).lean()
    res.json({ sucesso: true, total: itens.length, itens })
  } catch (err) {
    console.error('[painel] auditoria:', err)
    res.status(500).json({ erro: err.message })
  }
})

// ─── POST /api/painel/evento ─────────────────────────────────────────────────
// Registra eventos de documento (download/visualização/geração/comparação) na
// MESMA trilha de auditoria (AuditLog) — sem sistema paralelo.
router.post('/evento', async (req, res) => {
  try {
    if (!_dbOk(res)) return
    const { acao, modulo = 'documentos', detalhe = null, projeto_id = null } = req.body || {}
    if (!acao) return res.status(400).json({ erro: 'acao é obrigatória' })
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null
    await AuditLog.create({
      timestamp: new Date(),
      usuario: req.auth?.id || req.auth?.email || 'anonymous',
      perfil: req.auth?.perfil || null,
      empresa: req.auth?.empresa_id || null,
      modulo, acao, metodo: 'EVENT',
      path: `${detalhe || ''}${projeto_id ? ' #' + projeto_id : ''}`.trim() || acao,
      status: 200, ip,
    })
    res.json({ sucesso: true })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

export default router
