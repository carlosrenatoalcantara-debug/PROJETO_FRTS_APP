/**
 * bulkOperationsService — operações em lote genéricas para qualquer tipo de catálogo.
 *
 * Todas as operações destrutivas rodam em transação MongoDB (Atlas replica set).
 * Cada execução grava um BulkOperationLog com usuário, IDs, duração e resultado.
 */

import mongoose from 'mongoose'
import { Equipamento } from '../models/Equipamento.js'
import { BulkOperationLog } from '../models/BulkOperationLog.js'
import { processarEquipamento } from './catalogoQualidade.js'

// ── helpers ──────────────────────────────────────────────────────────────────

function validarIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) throw new Error('ids deve ser array não vazio')
  const invalidos = ids.filter(id => !mongoose.Types.ObjectId.isValid(id))
  if (invalidos.length) throw new Error(`IDs inválidos: ${invalidos.slice(0, 5).join(', ')}`)
  return ids.map(id => new mongoose.Types.ObjectId(id))
}

async function gravarLog({ usuario, operacao, tipo_catalogo, ids, inicio, sucesso, erro, metadados }) {
  try {
    await BulkOperationLog.create({
      timestamp:     new Date(),
      usuario:       usuario || 'anonymous',
      operacao,
      tipo_catalogo,
      quantidade:    ids.length,
      ids_afetados:  ids.map(String),
      tempo_ms:      Date.now() - inicio,
      sucesso,
      erro:          erro || null,
      metadados:     metadados || null,
    })
  } catch { /* log não pode bloquear operação */ }
}

// ── delete ────────────────────────────────────────────────────────────────────

export async function bulkDelete({ ids, tipo, usuario }) {
  const objectIds = validarIds(ids)
  const inicio = Date.now()
  const session = await mongoose.startSession()
  try {
    let deletados = 0
    await session.withTransaction(async () => {
      const filtro = { _id: { $in: objectIds }, tipo }
      const resultado = await Equipamento.deleteMany(filtro, { session })
      deletados = resultado.deletedCount
    })
    await gravarLog({ usuario, operacao: 'delete', tipo_catalogo: tipo, ids, inicio, sucesso: true, metadados: { deletados } })
    return { sucesso: true, deletados, solicitados: ids.length }
  } catch (err) {
    await gravarLog({ usuario, operacao: 'delete', tipo_catalogo: tipo, ids, inicio, sucesso: false, erro: err.message })
    throw err
  } finally {
    session.endSession()
  }
}

// ── validate ──────────────────────────────────────────────────────────────────
// Marca aprovacao_tecnica.status = 'aprovado' + registra evento no histórico.

export async function bulkValidate({ ids, tipo, usuario }) {
  const objectIds = validarIds(ids)
  const inicio = Date.now()
  const session = await mongoose.startSession()
  try {
    let atualizados = 0
    await session.withTransaction(async () => {
      const resultado = await Equipamento.updateMany(
        { _id: { $in: objectIds }, tipo },
        {
          $set: {
            'aprovacao_tecnica.status':       'aprovado',
            'aprovacao_tecnica.aprovado_em':  new Date(),
            'aprovacao_tecnica.aprovado_por': usuario || 'sistema',
          },
          $push: {
            'validacao.historico': {
              $each: [{
                em:   new Date(),
                tipo: 'validacao_lote',
                por:  usuario || 'sistema',
                observacao: `Validação em lote (${ids.length} equipamentos)`,
              }],
              $slice: -50,
            },
          },
        },
        { session }
      )
      atualizados = resultado.modifiedCount
    })
    await gravarLog({ usuario, operacao: 'validate', tipo_catalogo: tipo, ids, inicio, sucesso: true, metadados: { atualizados } })
    return { sucesso: true, atualizados, solicitados: ids.length }
  } catch (err) {
    await gravarLog({ usuario, operacao: 'validate', tipo_catalogo: tipo, ids, inicio, sucesso: false, erro: err.message })
    throw err
  } finally {
    session.endSession()
  }
}

// ── recalculate-score ─────────────────────────────────────────────────────────

export async function bulkRecalculateScore({ ids, tipo, usuario }) {
  const objectIds = validarIds(ids)
  const inicio = Date.now()
  const equipamentos = await Equipamento.find({ _id: { $in: objectIds }, tipo }).lean()

  const session = await mongoose.startSession()
  let processados = 0, erros = 0
  try {
    await session.withTransaction(async () => {
      for (const eq of equipamentos) {
        try {
          const resultado = processarEquipamento(eq, { tipoEvento: 'reprocessamento_lote' })
          const update = {
            $set: {
              specs_canonicas:       resultado.specs_canonicas,
              identificacao:         resultado.identificacao,
              qualidade:             resultado.qualidade,
              status_operacional:    resultado.status_operacional,
              utilizavel_em_projeto: resultado.utilizavel_em_projeto,
              bloqueio_engenharia:   resultado.bloqueio_engenharia,
            },
          }
          if (resultado.evento_historico) {
            update.$push = { 'validacao.historico': { $each: [resultado.evento_historico], $slice: -50 } }
          }
          await Equipamento.updateOne({ _id: eq._id }, update, { session })
          processados++
        } catch { erros++ }
      }
    })
    await gravarLog({ usuario, operacao: 'recalculate_score', tipo_catalogo: tipo, ids, inicio, sucesso: true, metadados: { processados, erros } })
    return { sucesso: true, processados, erros, solicitados: ids.length }
  } catch (err) {
    await gravarLog({ usuario, operacao: 'recalculate_score', tipo_catalogo: tipo, ids, inicio, sucesso: false, erro: err.message })
    throw err
  } finally {
    session.endSession()
  }
}

// ── status ────────────────────────────────────────────────────────────────────
// Altera ativo (true/false) ou aprovacao_tecnica.status.

export async function bulkAlterarStatus({ ids, tipo, usuario, novoStatus }) {
  const VALIDOS = ['ativo', 'inativo', 'pendente', 'aprovado', 'bloqueado']
  if (!VALIDOS.includes(novoStatus)) throw new Error(`status inválido: ${novoStatus}`)

  const objectIds = validarIds(ids)
  const inicio = Date.now()
  const session = await mongoose.startSession()
  try {
    let atualizados = 0
    await session.withTransaction(async () => {
      let setOp
      if (novoStatus === 'ativo')   setOp = { ativo: true }
      else if (novoStatus === 'inativo') setOp = { ativo: false }
      else setOp = { 'aprovacao_tecnica.status': novoStatus }

      const resultado = await Equipamento.updateMany(
        { _id: { $in: objectIds }, tipo },
        { $set: setOp },
        { session }
      )
      atualizados = resultado.modifiedCount
    })
    await gravarLog({ usuario, operacao: 'status', tipo_catalogo: tipo, ids, inicio, sucesso: true, metadados: { novoStatus, atualizados } })
    return { sucesso: true, atualizados, solicitados: ids.length, novo_status: novoStatus }
  } catch (err) {
    await gravarLog({ usuario, operacao: 'status', tipo_catalogo: tipo, ids, inicio, sucesso: false, erro: err.message })
    throw err
  } finally {
    session.endSession()
  }
}

// ── export ────────────────────────────────────────────────────────────────────

export async function bulkExport({ ids, tipo }) {
  const objectIds = validarIds(ids)
  const equipamentos = await Equipamento.find(
    { _id: { $in: objectIds }, tipo },
    '-datasheet_original.conteudo_base64 -documentos_tecnicos.conteudo_base64'
  ).lean()
  return { sucesso: true, total: equipamentos.length, tipo, equipamentos }
}
