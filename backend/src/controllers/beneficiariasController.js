/**
 * beneficiariasController.js — Sprint 7 (base) + Sprint 8.7 (extensão)
 *
 * S8.7 adiciona:
 *  - campos enriquecidos (titular/CPF/concessionária/modalidade/ativa)
 *  - validação completa do rateio (soma = 100%)
 *  - importação em lote (POST /lote) — Excel paste ou CSV pré-parseados
 *  - resumo enriquecido com status do rateio
 *  - auditoria via AuditLog (BENEFICIARIA_ADICIONADA / EDITADA / REMOVIDA / RATEIO_ALTERADO)
 *  - histórico por registro
 *
 * NÃO altera os endpoints individuais existentes (preserva contrato da API).
 */
import { UnidadeBeneficiaria } from '../models/UnidadeBeneficiaria.js'
import { ProjetoFV } from '../models/ProjetoFV.js'
import { AuditLog } from '../models/AuditLog.js'
import { validarRateio, calcularSomaRateio, MODALIDADES_GD } from '../utils/beneficiarias/beneficiariaRateio.js'
import mongoose from 'mongoose'

// ── Auditoria ───────────────────────────────────────────────────────────────
async function auditar(req, acao, projetoId, detalhe = null) {
  try {
    if (mongoose.connection.readyState !== 1) return
    await AuditLog.create({
      timestamp: new Date(), usuario: req.auth?.id || req.auth?.email || 'anonymous',
      perfil: req.auth?.perfil || null, empresa: req.auth?.empresa_id || null,
      modulo: 'fv', acao, metodo: 'EVENT',
      path: `projeto:${projetoId}${detalhe ? ' ' + String(detalhe).slice(0, 200) : ''}`, status: 200,
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null,
    })
  } catch { /* silencioso */ }
}

// ── CRUD individual (preservado + enriquecido) ─────────────────────────────

export const listarBeneficiarias = async (req, res) => {
  try {
    const { id } = req.params
    const beneficiarias = await UnidadeBeneficiaria.find({ projetoId: id }).sort({ createdAt: 1 })
    res.json(beneficiarias)
  } catch (err) {
    console.error('❌ Erro ao listar beneficiárias:', err)
    res.status(500).json({ mensagem: 'Erro ao listar beneficiárias', erro: err.message })
  }
}

export const criarBeneficiaria = async (req, res) => {
  try {
    const { id } = req.params
    const { contaContrato, tipoRateio, valor, titular, cpf_cnpj, concessionaria, modalidade_gd } = req.body

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    if (!contaContrato || !tipoRateio || valor === undefined) {
      return res.status(400).json({ mensagem: 'Campos obrigatórios: contaContrato, tipoRateio, valor' })
    }

    if (tipoRateio === 'percentual') {
      if (valor < 0 || valor > 100) return res.status(400).json({ mensagem: 'Percentual deve estar entre 0 e 100' })
      const existentes = await UnidadeBeneficiaria.find({ projetoId: id, ativa: true })
      const somaAtual = calcularSomaRateio(existentes)
      if (somaAtual + valor > 100.001) {
        return res.status(400).json({
          mensagem: `Soma de percentuais ultrapassaria 100%. Disponível: ${(100 - somaAtual).toFixed(2)}%`,
        })
      }
    }

    const nova = new UnidadeBeneficiaria({
      projetoId: id, contaContrato, tipoRateio, valor,
      titular: titular || null, cpf_cnpj: cpf_cnpj || null,
      concessionaria: concessionaria || null, modalidade_gd: modalidade_gd || null,
      historico: [{ acao: 'criado', depois: { contaContrato, tipoRateio, valor } }],
    })
    await nova.save()
    auditar(req, 'BENEFICIARIA_ADICIONADA', id, `UC=${contaContrato} val=${valor}%`)
    res.status(201).json(nova)
  } catch (err) {
    console.error('❌ Erro ao criar beneficiária:', err)
    res.status(500).json({ mensagem: 'Erro ao criar beneficiária', erro: err.message })
  }
}

export const atualizarBeneficiaria = async (req, res) => {
  try {
    const { id, beneficiariaId } = req.params
    const updates = req.body

    const antes = await UnidadeBeneficiaria.findById(beneficiariaId).lean()
    if (!antes) return res.status(404).json({ mensagem: 'Beneficiária não encontrada' })

    if (updates.valor !== undefined && antes.tipoRateio === 'percentual') {
      const demais = await UnidadeBeneficiaria.find({ projetoId: id, ativa: true, _id: { $ne: beneficiariaId } })
      const somaOutras = calcularSomaRateio(demais)
      if (somaOutras + Number(updates.valor) > 100.001) {
        return res.status(400).json({
          mensagem: `Novo valor ultrapassaria 100%. Disponível para esta UC: ${(100 - somaOutras).toFixed(2)}%`,
        })
      }
    }

    const histEntry = {
      acao: 'editado',
      antes: { valor: antes.valor, titular: antes.titular, contaContrato: antes.contaContrato },
      depois: updates,
    }
    const beneficiaria = await UnidadeBeneficiaria.findByIdAndUpdate(
      beneficiariaId,
      { $set: updates, $push: { historico: histEntry } },
      { new: true }
    )
    auditar(req, 'BENEFICIARIA_EDITADA', id, `UC=${antes.contaContrato}`)
    if (updates.valor !== undefined) {
      auditar(req, 'RATEIO_ALTERADO', id, `UC=${antes.contaContrato} ${antes.valor}→${updates.valor}`)
    }
    res.json(beneficiaria)
  } catch (err) {
    console.error('❌ Erro ao atualizar beneficiária:', err)
    res.status(500).json({ mensagem: 'Erro ao atualizar beneficiária', erro: err.message })
  }
}

export const deletarBeneficiaria = async (req, res) => {
  try {
    const { id, beneficiariaId } = req.params
    const beneficiaria = await UnidadeBeneficiaria.findByIdAndDelete(beneficiariaId)
    if (!beneficiaria) return res.status(404).json({ mensagem: 'Beneficiária não encontrada' })
    auditar(req, 'BENEFICIARIA_REMOVIDA', id, `UC=${beneficiaria.contaContrato}`)
    res.status(204).end()
  } catch (err) {
    console.error('❌ Erro ao deletar beneficiária:', err)
    res.status(500).json({ mensagem: 'Erro ao deletar beneficiária', erro: err.message })
  }
}

// ── Resumo enriquecido S8.7 ────────────────────────────────────────────────

export const obterResumo = async (req, res) => {
  try {
    const { id } = req.params
    const beneficiarias = await UnidadeBeneficiaria.find({ projetoId: id }).sort({ createdAt: 1 })
    const ativas = beneficiarias.filter(b => b.ativa !== false)
    const val = validarRateio(ativas)
    res.json({
      total: beneficiarias.length,
      ativas: ativas.length,
      beneficiarias,
      rateio: val,
      modalidades: MODALIDADES_GD,
    })
  } catch (err) {
    console.error('❌ Erro ao obter resumo:', err)
    res.status(500).json({ mensagem: 'Erro ao obter resumo', erro: err.message })
  }
}

// ── S8.7: Importação em lote ───────────────────────────────────────────────

/**
 * POST /api/projetos-fv/:id/beneficiarias/lote
 * Body: { beneficiarias: [...], substituir?: boolean }
 * Valida soma = 100% antes de persistir (se todas forem percentual).
 * `substituir=true` zera as existentes antes de inserir.
 */
export const importarLote = async (req, res) => {
  try {
    const { id } = req.params
    const { beneficiarias: novas = [], substituir = false } = req.body || {}

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    if (!Array.isArray(novas) || novas.length === 0) {
      return res.status(400).json({ mensagem: 'Forneça um array beneficiarias com ao menos 1 item.' })
    }

    // Valida a soma antes de persistir
    let paraValidar = novas
    if (!substituir) {
      const existentes = await UnidadeBeneficiaria.find({ projetoId: id, ativa: true }).lean()
      paraValidar = [...existentes, ...novas]
    }
    const val = validarRateio(paraValidar)
    if (!val.ok) {
      return res.status(400).json({
        mensagem: `Rateio inválido: soma = ${val.soma.toFixed(2)}% (${val.status}). Corrija antes de importar.`,
        rateio: val,
      })
    }

    if (substituir) await UnidadeBeneficiaria.deleteMany({ projetoId: id })

    const docs = novas.map(b => ({
      projetoId: id,
      contaContrato: String(b.contaContrato || b.uc || '').trim(),
      tipoRateio: b.tipoRateio || 'percentual',
      valor: Number(b.valor || b.percentual) || 0,
      titular: b.titular || null, cpf_cnpj: b.cpf_cnpj || null,
      concessionaria: b.concessionaria || null, modalidade_gd: b.modalidade_gd || null,
      ativa: b.ativa !== false,
      historico: [{ acao: 'criado', depois: b }],
    }))

    const inseridas = await UnidadeBeneficiaria.insertMany(docs)
    auditar(req, 'RATEIO_ALTERADO', id, `lote ${inseridas.length} UCs substituir=${substituir}`)
    res.status(201).json({ sucesso: true, inseridas: inseridas.length, rateio: val, beneficiarias: inseridas })
  } catch (err) {
    console.error('❌ importarLote:', err)
    res.status(500).json({ mensagem: 'Erro ao importar lote', erro: err.message })
  }
}

/**
 * POST /api/projetos-fv/:id/beneficiarias/validar-rateio
 * Body: { beneficiarias: [...] }
 * Calcula e devolve status do rateio sem persistir — pré-visualização.
 */
export const validarRateioPreview = async (req, res) => {
  try {
    const { beneficiarias = [] } = req.body || {}
    const val = validarRateio(beneficiarias)
    res.json({ sucesso: true, ...val })
  } catch (err) {
    res.status(500).json({ mensagem: err.message })
  }
}
