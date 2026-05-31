/**
 * catalogoDiagnostico.js — Sprint CAT-P0-UNIFY (FASE 3)
 *
 * Endpoint SOMENTE LEITURA de diagnóstico do catálogo. Conta equipamentos por
 * origem real para detectar fontes paralelas antes de qualquer limpeza
 * (CAT-CLEAN-01). Não altera nada.
 *
 *   GET /api/catalogo/diagnostico
 */
import { Router } from 'express'
import mongoose from 'mongoose'
import { Equipamento } from '../models/Equipamento.js'
import { CarregadorEV } from '../models/CarregadorEV.js'
import { memoryStore } from '../config/memoryStorage.js'
import { snapshotFlags } from '../config/catalogoFlags.js'
import { equipamentosExemplo } from '../seeds/equipamentosMemory.js'

const router = Router()

// CAT-P0-UNIFY (FASE 4): flags consultáveis pelo frontend (read-only, leve).
// Permite que os seletores do wizard FV respeitem ENABLE_INVERSORES_DATA /
// ENABLE_PAINEIS_DATA sem expor env diretamente ao bundle.
router.get('/flags', (_req, res) => {
  res.json({ sucesso: true, flags: snapshotFlags() })
})

router.get('/diagnostico', async (_req, res) => {
  try {
    const dbOnline = mongoose.connection.readyState === 1
    const resultado = {
      gerado_em: new Date(),
      db_online: dbOnline,
      flags: snapshotFlags(),
      origens: {},
    }

    // ── 1. Equipamento (Mongo) — por tipo + ativo/inativo ──────────────────
    if (dbOnline) {
      const porTipo = await Equipamento.aggregate([
        { $group: { _id: { tipo: '$tipo', ativo: '$ativo' }, n: { $sum: 1 } } },
      ])
      const eq = { total: 0, ativos: 0, inativos: 0, por_tipo: {} }
      for (const g of porTipo) {
        const tipo = g._id.tipo || 'desconhecido'
        const ativo = g._id.ativo !== false
        eq.total += g.n
        if (ativo) eq.ativos += g.n; else eq.inativos += g.n
        eq.por_tipo[tipo] = eq.por_tipo[tipo] || { ativos: 0, inativos: 0 }
        if (ativo) eq.por_tipo[tipo].ativos += g.n; else eq.por_tipo[tipo].inativos += g.n
      }
      resultado.origens.Equipamento = eq

      // ── 2. CarregadorEV (coleção legada/paralela) ─────────────────────────
      const [cgTotal, cgAtivos, cgInativos] = await Promise.all([
        CarregadorEV.countDocuments({}),
        CarregadorEV.countDocuments({ ativo: true }),
        CarregadorEV.countDocuments({ ativo: false }),
      ])
      resultado.origens.CarregadorEV = { total: cgTotal, ativos: cgAtivos, inativos: cgInativos }
    } else {
      resultado.origens.Equipamento = { erro: 'DB_OFFLINE', observacao: 'sem conexão Mongo' }
      resultado.origens.CarregadorEV = { erro: 'DB_OFFLINE' }
    }

    // ── 3. memoryStore (fallback offline) ──────────────────────────────────
    try {
      const mem = memoryStore.findAllEquipamentos({}) || []
      const porTipoMem = {}
      for (const e of mem) {
        const t = e.tipo || 'desconhecido'
        porTipoMem[t] = (porTipoMem[t] || 0) + 1
      }
      resultado.origens.memoryStore = { total: mem.length, por_tipo: porTipoMem, ativa: !dbOnline }
    } catch (e) {
      resultado.origens.memoryStore = { erro: e.message }
    }

    // ── 4. Seed estático equipamentosMemory.js ────────────────────────────
    const porTipoSeed = {}
    for (const e of (equipamentosExemplo || [])) {
      const t = e.tipo || 'desconhecido'
      porTipoSeed[t] = (porTipoSeed[t] || 0) + 1
    }
    resultado.origens.seed_equipamentosMemory = {
      total: (equipamentosExemplo || []).length,
      por_tipo: porTipoSeed,
      observacao: 'só carregado quando DB offline (via memoryStore)',
    }

    // ── 5. INVERSORES_DATA / PAINEIS_DATA (hardcoded no FRONTEND) ──────────
    // Esses datasets vivem no bundle do frontend (SeletorInversores.jsx /
    // SeletorPaineis.jsx). O backend não os enxerga, mas reportamos a flag
    // e a contagem é informada pelo frontend no diagnóstico de UI.
    resultado.origens.INVERSORES_DATA = {
      localizacao: 'frontend/src/components/fv/SeletorInversores.jsx',
      controlado_por_flag: 'ENABLE_INVERSORES_DATA',
      ativo: snapshotFlags().ENABLE_INVERSORES_DATA,
      observacao: 'fallback do wizard E7 quando catálogo Mongo retorna 0 inversores',
    }
    resultado.origens.PAINEIS_DATA = {
      localizacao: 'frontend/src/components/fv/SeletorPaineis.jsx',
      controlado_por_flag: 'ENABLE_PAINEIS_DATA',
      ativo: snapshotFlags().ENABLE_PAINEIS_DATA,
      observacao: 'fallback do wizard E7 quando catálogo Mongo retorna 0 módulos',
    }

    // ── Veredito de prontidão para CAT-CLEAN-01 ───────────────────────────
    const eqAtivos = resultado.origens.Equipamento?.ativos ?? null
    const cgAtivos = resultado.origens.CarregadorEV?.ativos ?? null
    resultado.pronto_para_limpeza = {
      equipamento_ativos: eqAtivos,
      carregador_ev_ativos: cgAtivos,
      fontes_paralelas_ativas: [
        resultado.origens.CarregadorEV?.ativos > 0 ? 'CarregadorEV' : null,
        snapshotFlags().ENABLE_INVERSORES_DATA ? 'INVERSORES_DATA (flag on)' : null,
        snapshotFlags().ENABLE_PAINEIS_DATA ? 'PAINEIS_DATA (flag on)' : null,
        snapshotFlags().ENABLE_CARREGADOR_EV_FALLBACK ? 'CarregadorEV fallback (flag on)' : null,
      ].filter(Boolean),
    }

    res.json({ sucesso: true, ...resultado })
  } catch (err) {
    console.error('[catalogoDiagnostico]', err)
    res.status(500).json({ sucesso: false, erro: err.message })
  }
})

export default router
