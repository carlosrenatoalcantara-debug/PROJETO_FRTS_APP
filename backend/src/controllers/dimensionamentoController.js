/**
 * 🌞 Controller HTTP — Dimensionamento FV
 *
 * Endpoints stateless. Não persiste no banco. Apenas calcula e retorna.
 * Persistência fica no PATCH /api/projetos-fv/:id quando o usuário avançar.
 */

import dimensionamentoFV from '../services/dimensionamentoFV.js'
import compatibilidadeFV from '../services/compatibilidadeFV.js'
import { Equipamento } from '../models/Equipamento.js'
import mongoose from 'mongoose'

const { dimensionarFV } = dimensionamentoFV
const {
  extrairSpecsModulo,
  extrairSpecsInversor,
  montarStrings,
  sugerirAcessorios,
} = compatibilidadeFV

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dimensionamento/calcular
// Body: { consumo_mensal_kwh, cidade?, estado?, perdas_pct?, margem_pct?,
//         tarifa_kwh?, pot_modulo_w?, custo_kwp_instalado_r?, tipo_sistema? }
// ─────────────────────────────────────────────────────────────────────────────
export async function calcularDimensionamento(req, res) {
  try {
    const resultado = dimensionarFV(req.body || {})

    if (resultado.erro) {
      return res.status(400).json({
        sucesso: false,
        erro: resultado.erro,
        codigo: resultado.codigo,
      })
    }

    res.json(resultado)
  } catch (err) {
    console.error('[DIMENSIONAMENTO] Erro:', err)
    res.status(500).json({ sucesso: false, erro: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dimensionamento/strings
// Body: { modulo_id, inversor_id, qtd_modulos_total }
//   OU: { modulo: {specs...}, inversor: {specs...}, qtd_modulos_total }
// ─────────────────────────────────────────────────────────────────────────────
export async function calcularStrings(req, res) {
  try {
    const { modulo_id, inversor_id, qtd_modulos_total, modulo: moduloInline, inversor: inversorInline } = req.body || {}

    if (!qtd_modulos_total || qtd_modulos_total <= 0) {
      return res.status(400).json({
        sucesso: false,
        erro: 'qtd_modulos_total é obrigatório e deve ser > 0',
        codigo: 'INPUT_INVALIDO',
      })
    }

    let moduloSpecs = null
    let inversorSpecs = null

    // Modo 1: por IDs (busca no banco)
    if (modulo_id && inversor_id) {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
          sucesso: false,
          erro: 'Banco indisponível para buscar equipamentos por ID. Use modo inline (modulo: {...}, inversor: {...}).',
          codigo: 'DB_OFFLINE',
        })
      }
      const [moduloDoc, inversorDoc] = await Promise.all([
        Equipamento.findById(modulo_id).lean(),
        Equipamento.findById(inversor_id).lean(),
      ])
      if (!moduloDoc) return res.status(404).json({ sucesso: false, erro: `Módulo ${modulo_id} não encontrado.` })
      if (!inversorDoc) return res.status(404).json({ sucesso: false, erro: `Inversor ${inversor_id} não encontrado.` })

      moduloSpecs = extrairSpecsModulo(moduloDoc)
      inversorSpecs = extrairSpecsInversor(inversorDoc)
    }
    // Modo 2: specs inline (sem banco — útil para preview client-side)
    else if (moduloInline && inversorInline) {
      moduloSpecs = extrairSpecsModulo(moduloInline)
      inversorSpecs = extrairSpecsInversor(inversorInline)
    }
    else {
      return res.status(400).json({
        sucesso: false,
        erro: 'Forneça {modulo_id, inversor_id} ou {modulo, inversor} inline.',
        codigo: 'INPUT_INVALIDO',
      })
    }

    const resultado = montarStrings({
      modulo: moduloSpecs,
      inversor: inversorSpecs,
      qtd_modulos_total,
    })

    res.json({
      sucesso: true,
      ...resultado,
      modulo_specs: moduloSpecs,
      inversor_specs: inversorSpecs,
    })
  } catch (err) {
    console.error('[STRINGS] Erro:', err)
    res.status(500).json({ sucesso: false, erro: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dimensionamento/acessorios
// Body: { configuracao: {n_serie, n_paralelo, voc_string, isc_string, ...},
//         inversor: {potencia_kw, fases, ...},
//         comprimento_cabo_cc_m?, comprimento_cabo_ca_m? }
// ─────────────────────────────────────────────────────────────────────────────
export async function calcularAcessorios(req, res) {
  try {
    const { configuracao, inversor, inversor_id, comprimento_cabo_cc_m, comprimento_cabo_ca_m } = req.body || {}

    if (!configuracao) {
      return res.status(400).json({
        sucesso: false,
        erro: 'configuracao é obrigatória (use saída de /api/dimensionamento/strings).',
        codigo: 'INPUT_INVALIDO',
      })
    }

    let inversorSpecs = null
    if (inversor) {
      inversorSpecs = extrairSpecsInversor(inversor)
    } else if (inversor_id) {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
          sucesso: false,
          erro: 'Banco indisponível. Use inversor inline.',
          codigo: 'DB_OFFLINE',
        })
      }
      const doc = await Equipamento.findById(inversor_id).lean()
      if (!doc) return res.status(404).json({ sucesso: false, erro: `Inversor ${inversor_id} não encontrado.` })
      inversorSpecs = extrairSpecsInversor(doc)
    } else {
      return res.status(400).json({
        sucesso: false,
        erro: 'Forneça inversor (inline) ou inversor_id.',
        codigo: 'INPUT_INVALIDO',
      })
    }

    const resultado = sugerirAcessorios({
      configuracao,
      inversor: inversorSpecs,
      comprimento_cabo_cc_m: comprimento_cabo_cc_m || 10,
      comprimento_cabo_ca_m: comprimento_cabo_ca_m || 15,
    })

    res.json({
      sucesso: true,
      ...resultado,
      inversor_specs: inversorSpecs,
    })
  } catch (err) {
    console.error('[ACESSORIOS] Erro:', err)
    res.status(500).json({ sucesso: false, erro: err.message })
  }
}
