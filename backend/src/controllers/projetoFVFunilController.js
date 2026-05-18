/**
 * 🌞 Controller — Funil FV v2
 *
 * Endpoints encadeados para criação de projeto a partir de fatura.
 *
 * Princípio de segurança: NUNCA cria Cliente automaticamente.
 *   - /preparar-com-fatura: extrai dados + busca candidatos. Não persiste nada.
 *   - /finalizar-com-fatura: usuário escolheu (existente ou novo). Persiste.
 */

import mongoose from 'mongoose'
import { Cliente } from '../models/Cliente.js'
import { ProjetoFV } from '../models/ProjetoFV.js'
import { memoryStore } from '../config/memoryStorage.js'
import dimensionamentoFV from '../services/dimensionamentoFV.js'

const { dimensionarFV } = dimensionamentoFV

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Normaliza CPF/CNPJ removendo caracteres não-numéricos.
 */
function normalizarCpfCnpj(v) {
  if (!v) return null
  return String(v).replace(/\D/g, '') || null
}

/**
 * Normaliza email para lowercase.
 */
function normalizarEmail(v) {
  if (!v) return null
  const trimmed = String(v).trim().toLowerCase()
  return trimmed || null
}

/**
 * Calcula score de confiança do match (0-100).
 */
function scoreMatch(cliente, faturaDados) {
  let score = 0
  let total = 0

  // CPF/CNPJ idêntico = match forte
  const cpfFatura = normalizarCpfCnpj(faturaDados.cpfCnpj)
  const cpfCliente = normalizarCpfCnpj(cliente.cpf_cnpj)
  if (cpfFatura && cpfCliente) {
    total += 60
    if (cpfFatura === cpfCliente) score += 60
  }

  // Email idêntico = match médio
  const emailFatura = normalizarEmail(faturaDados.email)
  const emailCliente = normalizarEmail(cliente.email)
  if (emailFatura && emailCliente) {
    total += 20
    if (emailFatura === emailCliente) score += 20
  }

  // Nome similar (case-insensitive, trim) = match fraco
  if (faturaDados.nome && cliente.nome) {
    total += 20
    const a = faturaDados.nome.trim().toLowerCase()
    const b = cliente.nome.trim().toLowerCase()
    if (a === b) score += 20
    else if (a.includes(b) || b.includes(a)) score += 10
  }

  return total > 0 ? Math.round((score / total) * 100) : 0
}

/**
 * Busca clientes candidatos para match.
 * Estratégia conservadora: só retorna candidatos com algum sinal real.
 * NUNCA cria nada.
 */
async function buscarCandidatosCliente(faturaDados) {
  if (mongoose.connection.readyState !== 1) {
    // Memory storage fallback
    try {
      const todos = memoryStore.findAllClientes?.() || []
      return rankearCandidatos(todos, faturaDados)
    } catch {
      return []
    }
  }

  // MongoDB: busca por CPF normalizado OR email OR nome similar
  const cpf = normalizarCpfCnpj(faturaDados.cpfCnpj)
  const email = normalizarEmail(faturaDados.email)
  const nome = faturaDados.nome?.trim()

  const ors = []
  if (cpf) {
    // Como o CPF no banco pode estar formatado, fazemos regex tolerante
    const cpfRegex = cpf.split('').join('\\D?')
    ors.push({ cpf_cnpj: { $regex: cpfRegex } })
  }
  if (email) ors.push({ email: new RegExp(`^${email}$`, 'i') })
  if (nome && nome.length >= 4) {
    // Busca por nome parcial (primeiros 2 nomes)
    const partes = nome.split(/\s+/).slice(0, 2).join(' ')
    ors.push({ nome: { $regex: partes.replace(/[^\w\s]/g, ''), $options: 'i' } })
  }

  if (ors.length === 0) return []

  const candidatos = await Cliente.find({ $or: ors }).limit(10).lean()
  return rankearCandidatos(candidatos, faturaDados)
}

function rankearCandidatos(candidatos, faturaDados) {
  return candidatos
    .map(c => ({
      _id: c._id,
      nome: c.nome,
      email: c.email,
      telefone: c.telefone,
      cpf_cnpj: c.cpf_cnpj,
      endereco_completo: c.endereco_completo,
      cidade: c.cidade,
      estado: c.estado,
      score_match: scoreMatch(c, faturaDados),
    }))
    .filter(c => c.score_match >= 30)  // limiar mínimo para considerar candidato
    .sort((a, b) => b.score_match - a.score_match)
    .slice(0, 5)
}

/**
 * Roda dimensionamento em background a partir dos dados extraídos.
 */
function calcularDimensionamentoAutomatico(faturaExtraida) {
  try {
    const consumo = faturaExtraida.mediaAnual || faturaExtraida.consumoKwh
    if (!consumo || consumo <= 0) {
      return { sucesso: false, motivo: 'consumo_indisponivel' }
    }
    const resultado = dimensionarFV({
      consumo_mensal_kwh: consumo,
      cidade: faturaExtraida.cidade,
      estado: faturaExtraida.estado,
      irradiancia_kwh_m2_dia: faturaExtraida.irradiancia,
      tarifa_kwh: faturaExtraida.valorKwh,
      tipo_sistema: 'string',
    })
    return resultado
  } catch (err) {
    console.error('[FUNIL] Erro no dimensionamento automático:', err.message)
    return { sucesso: false, motivo: 'erro_calculo', erro: err.message }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/projetos-fv/preparar-com-fatura
// Body: { faturaDados: {...} }
//
// NÃO PERSISTE NADA. Apenas:
//   1. Recebe os dados já extraídos (ou re-extraídos no client)
//   2. Busca candidatos de Cliente (sem criar nada)
//   3. Calcula dimensionamento em memória
//   4. Retorna preview completo para o usuário decidir
// ─────────────────────────────────────────────────────────────────────────────
export async function prepararComFatura(req, res) {
  try {
    const { faturaDados } = req.body || {}
    if (!faturaDados) {
      return res.status(400).json({
        sucesso: false,
        erro: 'faturaDados é obrigatório.',
        codigo: 'INPUT_INVALIDO',
      })
    }

    const [candidatos, dimensionamento] = await Promise.all([
      buscarCandidatosCliente(faturaDados),
      Promise.resolve(calcularDimensionamentoAutomatico(faturaDados)),
    ])

    return res.json({
      sucesso: true,
      fatura_normalizada: faturaDados,
      candidatos_cliente: candidatos,        // [] se nenhum match — usuário criará novo
      requer_decisao: candidatos.length > 0, // UI deve perguntar
      dimensionamento_preview: dimensionamento,
    })
  } catch (err) {
    console.error('[FUNIL] prepararComFatura erro:', err)
    res.status(500).json({ sucesso: false, erro: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/projetos-fv/finalizar-com-fatura
// Body: {
//   faturaDados: {...},
//   decisaoCliente: { tipo: 'usar_existente'|'criar_novo', clienteId?, novosDados? },
//   nomeProjeto?: string
// }
//
// Persiste Cliente (se novo) + ProjetoFV (com dimensionamento).
// ─────────────────────────────────────────────────────────────────────────────
export async function finalizarComFatura(req, res) {
  try {
    const { faturaDados, decisaoCliente, nomeProjeto } = req.body || {}

    if (!faturaDados) {
      return res.status(400).json({
        sucesso: false,
        erro: 'faturaDados é obrigatório.',
        codigo: 'INPUT_INVALIDO',
      })
    }
    if (!decisaoCliente || !['usar_existente', 'criar_novo'].includes(decisaoCliente.tipo)) {
      return res.status(400).json({
        sucesso: false,
        erro: 'decisaoCliente.tipo deve ser "usar_existente" ou "criar_novo".',
        codigo: 'DECISAO_INVALIDA',
      })
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        sucesso: false,
        erro: 'Banco indisponível. Tente novamente em alguns instantes.',
        codigo: 'DB_OFFLINE',
      })
    }

    // ── 1. Resolver Cliente ──────────────────────────────────────────────────
    let clienteId = null
    let clienteCriado = false

    if (decisaoCliente.tipo === 'usar_existente') {
      if (!decisaoCliente.clienteId) {
        return res.status(400).json({
          sucesso: false,
          erro: 'clienteId é obrigatório para tipo "usar_existente".',
          codigo: 'CLIENTE_ID_OBRIGATORIO',
        })
      }
      const existe = await Cliente.findById(decisaoCliente.clienteId).lean()
      if (!existe) {
        return res.status(404).json({
          sucesso: false,
          erro: `Cliente ${decisaoCliente.clienteId} não encontrado.`,
        })
      }
      clienteId = existe._id
    } else {
      // criar_novo — pega dados explicitamente fornecidos pelo usuário
      // (que podem ter sido editados a partir do extraído)
      const dados = decisaoCliente.novosDados || {}
      if (!dados.nome || !dados.nome.trim()) {
        return res.status(400).json({
          sucesso: false,
          erro: 'novosDados.nome é obrigatório.',
          codigo: 'NOME_OBRIGATORIO',
        })
      }
      const novo = await Cliente.create({
        nome: dados.nome,
        email: dados.email || `cliente-${Date.now()}@sem-email.local`,
        telefone: dados.telefone || '',
        cpf_cnpj: dados.cpf_cnpj || faturaDados.cpfCnpj || '',
        tipo: dados.tipo || 'Pessoa Física',
        endereco_completo: dados.endereco_completo || faturaDados.endereco || '',
        cep: dados.cep || faturaDados.cep || '',
        cidade: dados.cidade || faturaDados.cidade || '',
        estado: dados.estado || faturaDados.estado || '',
        status: 'ativo',
      })
      clienteId = novo._id
      clienteCriado = true
    }

    // ── 2. Calcular dimensionamento ──────────────────────────────────────────
    const dimensionamento = calcularDimensionamentoAutomatico(faturaDados)

    // ── 3. Criar ProjetoFV ───────────────────────────────────────────────────
    const nome = nomeProjeto?.trim() ||
      `${faturaDados.nome || 'Projeto'} — ${new Date().toISOString().split('T')[0]}`

    const projeto = await ProjetoFV.create({
      clienteId,
      nome,
      status: 'rascunho',
      endereco_completo: faturaDados.endereco || '',
      latitude: faturaDados.latitude || null,
      longitude: faturaDados.longitude || null,
      consumo_anual_kwh: (faturaDados.mediaAnual || faturaDados.consumoKwh || 0) * 12,
      irradiancia_local: faturaDados.irradiancia || null,

      fatura_extracao: {
        arquivo_original_nome: faturaDados._arquivoOriginal || null,
        extraido_em: faturaDados._extraidoEm ? new Date(faturaDados._extraidoEm) : new Date(),
        metodo: faturaDados._metodo || 'manual',
        confianca: faturaDados._confianca || null,
        confirmado_pelo_usuario: true,
        nome: faturaDados.nome || null,
        cpf_cnpj: faturaDados.cpfCnpj || null,
        telefone: faturaDados.telefone || null,
        numero_cliente: faturaDados.numeroCliente || null,
        codigo_instalacao: faturaDados.codigoInstalacao || null,
        endereco: faturaDados.endereco || null,
        cep: faturaDados.cep || null,
        cidade: faturaDados.cidade || null,
        estado: faturaDados.estado || null,
        latitude: faturaDados.latitude || null,
        longitude: faturaDados.longitude || null,
        concessionaria: faturaDados.distribuidora || null,
        grupo_tarifario: faturaDados.grupoTarifario || null,
        classificacao: faturaDados.classificacao || null,
        subgrupo: faturaDados.subgrupo || null,
        tipo_ligacao: faturaDados.tipoLigacao || null,
        tensao_v: faturaDados.tensaoV || faturaDados.tensao || null,
        demanda_contratada_kw: faturaDados.demandaContratadaKw || null,
        consumo_mensal_kwh: faturaDados.consumoKwh || null,
        media_anual_kwh: faturaDados.mediaAnual || null,
        historico_12meses: Array.isArray(faturaDados.historico12Meses) ? faturaDados.historico12Meses : [],
        periodo_meses: faturaDados.periodoMeses || null,
        valor_total_r: faturaDados.valorR || null,
        valor_kwh: faturaDados.valorKwh || null,
        irradiancia_local: faturaDados.irradiancia || null,
        dados_brutos: faturaDados,
      },
    })

    // ── 4. Resposta ──────────────────────────────────────────────────────────
    return res.status(201).json({
      sucesso: true,
      projeto: {
        _id: projeto._id,
        nome: projeto.nome,
        status: projeto.status,
        clienteId: projeto.clienteId,
      },
      cliente_criado: clienteCriado,
      cliente_id: clienteId,
      dimensionamento: dimensionamento.sucesso ? dimensionamento : null,
    })
  } catch (err) {
    console.error('[FUNIL] finalizarComFatura erro:', err)
    res.status(500).json({ sucesso: false, erro: err.message })
  }
}
