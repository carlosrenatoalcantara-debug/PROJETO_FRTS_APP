/**
 * 🔒 Rotas admin do catálogo técnico.
 *
 * S2.6.1 entrega apenas o endpoint de relatório (leitura).
 * Endpoints de reprocessamento/revisão são da S2.6.2/2.6.3.
 *
 * ⚠️ Sem auth nesta fase — segue regra global (ProtectedRoute = FASE 2C).
 * Rota documentada como "interno" — não exposta no frontend público ainda.
 */

import { Router } from 'express'
import mongoose from 'mongoose'
import { Equipamento } from '../models/Equipamento.js'
import { criarProviderAE, providerConfigurado } from '../integracoes/ae/index.js'
import { criarAuditoriaRapidaService, formatarResumo } from '../services/auditoriaRapidaService.js'
import { criarAplicadorAuditoria, criarRepositorioMongo } from '../services/auditoriaAplicacaoService.js'

const router = Router()

// ─── GET /api/admin/catalogo/qualidade-relatorio ─────────────────────────
//
// Retorna sumário consolidado do catálogo:
//   - Totais por tipo (modulo/inversor/carregador_ev/etc.)
//   - Distribuição por nível de qualidade
//   - Score médio (global / completude / confiança)
//   - Top alertas (códigos mais frequentes)
//   - Lista resumida de equipamentos inválidos
//   - Lista resumida de equipamentos "Desconhecido"
//
router.get('/qualidade-relatorio', async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        sucesso: false,
        erro: 'MongoDB indisponível.',
        codigo: 'DB_OFFLINE',
      })
    }

    // 1. Totais por tipo
    const totaisPorTipo = await Equipamento.aggregate([
      { $group: { _id: '$tipo', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ])

    // 2. Distribuição por nível de qualidade
    const distribuicaoNivel = await Equipamento.aggregate([
      { $group: { _id: '$qualidade.nivel', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ])

    // 3. Distribuição cruzada tipo × nível
    const cruzadoTipoNivel = await Equipamento.aggregate([
      {
        $group: {
          _id: { tipo: '$tipo', nivel: '$qualidade.nivel' },
          total: { $sum: 1 },
        },
      },
      { $sort: { '_id.tipo': 1, '_id.nivel': 1 } },
    ])

    // 4. Scores médios (globais e por tipo)
    const scoresGerais = await Equipamento.aggregate([
      {
        $group: {
          _id: null,
          score_global_medio:     { $avg: '$qualidade.score_global' },
          completude_score_medio: { $avg: '$qualidade.completude_score' },
          confianca_score_medio:  { $avg: '$qualidade.confianca_score' },
          total: { $sum: 1 },
        },
      },
    ])

    const scoresPorTipo = await Equipamento.aggregate([
      {
        $group: {
          _id: '$tipo',
          score_global_medio:     { $avg: '$qualidade.score_global' },
          completude_score_medio: { $avg: '$qualidade.completude_score' },
          confianca_score_medio:  { $avg: '$qualidade.confianca_score' },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    // 5. Top alertas (códigos mais frequentes)
    const topAlertas = await Equipamento.aggregate([
      { $unwind: { path: '$qualidade.alertas', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: {
            codigo: '$qualidade.alertas.codigo',
            severidade: '$qualidade.alertas.severidade',
          },
          ocorrencias: { $sum: 1 },
        },
      },
      { $sort: { ocorrencias: -1 } },
      { $limit: 25 },
    ])

    // 6. Equipamentos inválidos (até 50)
    const invalidos = await Equipamento.find(
      { 'qualidade.nivel': 'invalido' },
      'tipo fabricante modelo qualidade.score_global qualidade.alertas.codigo qualidade.alertas.severidade'
    )
      .limit(50)
      .lean()

    // 7. Equipamentos "Desconhecido"
    const padraoDesc = /^\s*(desconhecid[ao]|n\/?a|sem\s*nome|null|undefined|n[ãa]o\s*informad[ao]|--)\s*$/i
    const desconhecidos = await Equipamento.find(
      {
        $or: [
          { fabricante: { $regex: padraoDesc } },
          { modelo: { $regex: padraoDesc } },
          { 'identificacao.fabricante_normalizado': { $in: [null, '', 'DESCONHECIDO'] } },
        ],
      },
      'tipo fabricante modelo qualidade.nivel qualidade.score_global'
    )
      .limit(50)
      .lean()

    // 8. Sem qualidade calculada (provavelmente ainda não passaram pelo backfill)
    const semQualidade = await Equipamento.countDocuments({
      $or: [
        { qualidade: { $exists: false } },
        { 'qualidade.nivel': null },
      ],
    })

    // Helper para transformar arrays em map { chave: valor }
    const aMap = (arr, k = '_id') => Object.fromEntries(arr.map(x => [x[k] ?? '(sem)', x.total]))

    res.json({
      sucesso: true,
      gerado_em: new Date(),
      totais: {
        equipamentos_total: scoresGerais[0]?.total || 0,
        por_tipo: aMap(totaisPorTipo),
        sem_qualidade_calculada: semQualidade,
      },
      distribuicao_nivel: aMap(distribuicaoNivel),
      cruzado_tipo_x_nivel: cruzadoTipoNivel.map(c => ({
        tipo:  c._id.tipo,
        nivel: c._id.nivel,
        total: c.total,
      })),
      scores: {
        geral: scoresGerais[0]
          ? {
              score_global_medio:     Number((scoresGerais[0].score_global_medio || 0).toFixed(1)),
              completude_score_medio: Number((scoresGerais[0].completude_score_medio || 0).toFixed(1)),
              confianca_score_medio:  Number((scoresGerais[0].confianca_score_medio || 0).toFixed(1)),
            }
          : null,
        por_tipo: scoresPorTipo.map(s => ({
          tipo: s._id,
          total: s.total,
          score_global_medio:     Number((s.score_global_medio || 0).toFixed(1)),
          completude_score_medio: Number((s.completude_score_medio || 0).toFixed(1)),
          confianca_score_medio:  Number((s.confianca_score_medio || 0).toFixed(1)),
        })),
      },
      top_alertas: topAlertas.map(a => ({
        codigo: a._id.codigo,
        severidade: a._id.severidade,
        ocorrencias: a.ocorrencias,
      })),
      invalidos_amostra: invalidos.map(e => ({
        _id: e._id,
        tipo: e.tipo,
        fabricante: e.fabricante,
        modelo: e.modelo,
        score_global: e.qualidade?.score_global ?? null,
        codigos_alerta: (e.qualidade?.alertas || [])
          .filter(a => a.severidade === 'critico' || a.severidade === 'alto')
          .map(a => a.codigo)
          .slice(0, 5),
      })),
      desconhecidos_amostra: desconhecidos.map(e => ({
        _id: e._id,
        tipo: e.tipo,
        fabricante: e.fabricante,
        modelo: e.modelo,
        nivel: e.qualidade?.nivel ?? null,
        score_global: e.qualidade?.score_global ?? null,
      })),
    })
  } catch (err) {
    console.error('[adminCatalogo] erro no relatório:', err)
    res.status(500).json({ sucesso: false, erro: err.message })
  }
})

// ─── POST /api/admin/catalogo/auditoria-rapida ───────────────────────────
//
// Executa a Auditoria Rápida contra o AE. SOMENTE LEITURA:
// percorre o catálogo, localiza o Datasheet Técnico AE correspondente,
// compara KnowledgeVersion e devolve o que MUDARIA. Nada é gravado aqui.
//
// A escrita é responsabilidade da rota de aplicação (fase seguinte).
//
router.post('/auditoria-rapida', async (_req, res) => {
  try {
    if (!providerConfigurado()) {
      return res.status(501).json({
        sucesso: false,
        erro: 'Integração AE não configurada.',
        codigo: 'AE_NAO_CONFIGURADO',
      })
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        sucesso: false,
        erro: 'MongoDB indisponível.',
        codigo: 'DB_OFFLINE',
      })
    }

    const servico = criarAuditoriaRapidaService({
      provider: criarProviderAE(),
      listarEquipamentos: () => Equipamento.find(
        { tipo: { $in: ['modulo', 'inversor', 'carregador_ev', 'bateria'] } },
        'tipo fabricante modelo specs_canonicas identificacao origem protecao qualidade',
      ).lean(),
    })

    const relatorio = await servico.executar()

    res.json({ sucesso: true, resumo: formatarResumo(relatorio), relatorio })
  } catch (err) {
    console.error('[adminCatalogo] erro na auditoria rápida:', err)
    const status = err.code === 'AE_BIBLIOTECA_AUSENTE' ? 503 : 500
    res.status(status).json({ sucesso: false, erro: err.message, codigo: err.code || null })
  }
})

// ─── POST /api/admin/catalogo/auditoria-rapida/aplicar ───────────────────
//
// Aplica as atualizações do AE. ESCRITA.
//
// O plano NÃO vem do cliente: a auditoria é reexecutada no servidor e o corpo
// da requisição informa apenas QUAIS equipamentos aplicar. Aceitar um plano
// externo permitiria gravação arbitrária no catálogo.
//
// Cada equipamento é atômico: specs técnicas, histórico e knowledge_version
// são confirmados juntos, sob guarda de versão.
//
router.post('/auditoria-rapida/aplicar', async (req, res) => {
  try {
    if (!providerConfigurado()) {
      return res.status(501).json({ sucesso: false, erro: 'Integração AE não configurada.', codigo: 'AE_NAO_CONFIGURADO' })
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ sucesso: false, erro: 'MongoDB indisponível.', codigo: 'DB_OFFLINE' })
    }

    const { selecionados = null, incluirNuncaAuditados = false } = req.body || {}
    if (selecionados !== null && !Array.isArray(selecionados)) {
      return res.status(400).json({ sucesso: false, erro: '"selecionados" deve ser uma lista de ids ou null.' })
    }

    const listarEquipamentos = () => Equipamento.find(
      { tipo: { $in: ['modulo', 'inversor', 'carregador_ev', 'bateria'] } },
      'tipo fabricante modelo specs_canonicas identificacao origem protecao qualidade',
    ).lean()

    // Reexecuta a auditoria: o plano aplicado é sempre o do servidor, calculado
    // sobre o estado atual do catálogo.
    const relatorio = await criarAuditoriaRapidaService({
      provider: criarProviderAE(),
      listarEquipamentos,
    }).executar()

    const aplicador = criarAplicadorAuditoria(criarRepositorioMongo(Equipamento))
    const resultado = await aplicador.aplicar(relatorio, {
      selecionados: selecionados === null ? null : selecionados.map(String),
      incluirNuncaAuditados: Boolean(incluirNuncaAuditados),
    })

    res.json({ sucesso: true, resultado })
  } catch (err) {
    console.error('[adminCatalogo] erro ao aplicar atualizações do AE:', err)
    res.status(500).json({ sucesso: false, erro: err.message, codigo: err.code || null })
  }
})

// ─── POST /api/admin/catalogo/auditoria-rapida/reverter/:id ──────────────
//
// Desfaz a última aplicação do AE em um equipamento, a partir do estado
// anterior gravado no histórico. Também atômico.
//
router.post('/auditoria-rapida/reverter/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ sucesso: false, erro: 'MongoDB indisponível.', codigo: 'DB_OFFLINE' })
    }

    const equipamento = await Equipamento.findById(req.params.id, 'validacao.historico').lean()
    if (!equipamento) {
      return res.status(404).json({ sucesso: false, erro: 'Equipamento não encontrado.' })
    }

    const aplicador = criarAplicadorAuditoria(criarRepositorioMongo(Equipamento))
    const resultado = await aplicador.reverter(equipamento)

    res.json({ sucesso: resultado.status === 'aplicado', resultado })
  } catch (err) {
    console.error('[adminCatalogo] erro ao reverter aplicação do AE:', err)
    res.status(500).json({ sucesso: false, erro: err.message })
  }
})

export default router
