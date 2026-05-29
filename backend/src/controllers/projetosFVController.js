import { ProjetoFV } from '../models/ProjetoFV.js'
import { Equipamento } from '../models/Equipamento.js'
import { Tecnico } from '../models/Tecnico.js'
import mongoose from 'mongoose'
import { memoryStore } from '../config/memoryStorage.js'
import { montarSnapshotRT } from '../utils/snapshotRT.js'
import {
  derivarStatusSeguro, paraModel, podeExcluirDefinitivo, avaliarLegacy, MOTIVOS_ARQUIVAMENTO,
} from '../utils/statusLifecycle.js'
import { AuditLog } from '../models/AuditLog.js'

// S8.4 — auditoria de ciclo de vida (reaproveita AuditLog; nunca quebra a request)
async function auditarCiclo(req, acao, projetoId, detalhe = null) {
  try {
    if (mongoose.connection.readyState !== 1) return
    await AuditLog.create({
      timestamp: new Date(), usuario: req.auth?.id || req.auth?.email || req.body?.usuario || 'anonymous',
      perfil: req.auth?.perfil || null, empresa: req.auth?.empresa_id || null,
      modulo: 'fv', acao, metodo: 'EVENT',
      path: `projeto:${projetoId}${detalhe ? ' ' + String(detalhe).slice(0, 240) : ''}`, status: 200,
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null,
    })
  } catch { /* silencioso */ }
}

// S8.4 — enriquece o projeto com derivados não-persistidos (status_display, legacy)
function enriquecer(p) {
  if (!p) return p
  const obj = typeof p.toObject === 'function' ? p.toObject() : { ...p }
  const av = avaliarLegacy(obj)
  obj.status_display = derivarStatusSeguro(obj)
  obj.legacy = obj.legacy || av.legacy
  obj.necessita_revisao = obj.necessita_revisao || av.necessita_revisao
  obj.legacy_motivos = av.motivos
  obj.pode_excluir_definitivo = podeExcluirDefinitivo(obj)
  return obj
}

export const listarProjetosFV = async (req, res) => {
  try {
    let projetos
    // S7.2.1: filtro multiempresa opcional (?empresa_id=). Sem filtro → todos
    // (projetos antigos com empresa_id null permanecem acessíveis na empresa default).
    const empresaId = req?.query?.empresa_id || null
    // S8.4: por padrão esconde excluídos; ?incluir_excluidos=1 mostra (lixeira).
    const incluirExcluidos = ['1', 'true', 'yes'].includes(String(req?.query?.incluir_excluidos || '').toLowerCase())
    const incluirArquivados = ['1', 'true', 'yes'].includes(String(req?.query?.incluir_arquivados || '1').toLowerCase()) // default mostra arquivados
    const filtro = {}
    if (empresaId) filtro.$or = [{ empresa_id: empresaId }, { empresa_id: null }]
    if (!incluirExcluidos) filtro.excluido = { $ne: true }
    if (!incluirArquivados) filtro.status = { $ne: 'arquivado' }

    if (mongoose.connection.readyState === 1) {
      projetos = await ProjetoFV.find(filtro).populate('clienteId').sort({ createdAt: -1 })
    } else {
      // Memory storage fallback
      projetos = memoryStore.findAllProjetoFV().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      projetos = projetos.filter(p => incluirExcluidos || p.excluido !== true)
      projetos = projetos.map(p => ({ ...p, clienteId: memoryStore.findClienteById(p.clienteId) }))
    }
    // S8.4: enriquecer com status_display + legacy (não persiste; só leitura)
    const enriquecidos = projetos.map(enriquecer)
    console.log(`✓ GET /api/projetos-fv - Listando ${enriquecidos.length} projetos (excluidos=${incluirExcluidos})`)
    res.json(enriquecidos)
  } catch (err) {
    console.error('❌ Erro ao listar projetos FV:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const buscarProjetoFV = async (req, res) => {
  try {
    let p
    if (mongoose.connection.readyState === 1) {
      p = await ProjetoFV.findById(req.params.id).populate('clienteId')
    } else {
      // Memory storage fallback
      p = memoryStore.findProjetoFV(req.params.id)
      if (p) {
        p = {
          ...p,
          clienteId: memoryStore.findClienteById(p.clienteId)
        }
      }
    }
    if (!p) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    res.json(enriquecer(p))
  } catch (err) {
    console.error('❌ Erro ao buscar projeto FV:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const criarProjetoFV = async (req, res) => {
  try {
    const {
      clienteId,
      nome,
      status,
      endereco_completo,
      latitude,
      longitude,
      geocoding_origem,
      geocoding_confianca,
      geocodificado_em,
    } = req.body

    if (!clienteId || !nome) {
      return res.status(400).json({ erro: 'Campos clienteId e nome são obrigatórios' })
    }

    console.log(`[DEBUG] criarProjetoFV: readyState=${mongoose.connection.readyState}, clienteId=${clienteId}`)

    // Se MongoDB está disponível, usar Mongoose
    if (mongoose.connection.readyState === 1) {
      // Validar que clienteId é um ObjectId válido
      if (!mongoose.Types.ObjectId.isValid(clienteId)) {
        return res.status(400).json({ erro: 'ClienteId inválido' })
      }

      const novo = new ProjetoFV({
        clienteId,
        nome,
        status: status || 'rascunho',
        endereco_completo: endereco_completo || '',
        latitude: latitude === undefined || latitude === null || latitude === '' ? null : Number(latitude),
        longitude: longitude === undefined || longitude === null || longitude === '' ? null : Number(longitude),
        geocoding_origem: geocoding_origem || null,
        geocoding_confianca: geocoding_confianca !== undefined && geocoding_confianca !== null ? Number(geocoding_confianca) : null,
        geocodificado_em: geocodificado_em ? new Date(geocodificado_em) : null,
        irradiancia_local: 131.44,
      })

      await novo.save()
      await novo.populate('clienteId')
      console.log('✓ Projeto FV criado:', novo._id)
      res.status(201).json(novo)
    } else {
      // Fallback para memory storage
      console.log('💾 Usando memory storage para criar projeto FV')

      // Validar que cliente existe em memory storage
      const cliente = memoryStore.findClienteById(clienteId)
      if (!cliente) {
        return res.status(404).json({ erro: 'Cliente não encontrado' })
      }

      const novo = memoryStore.createProjetoFV({
        clienteId,
        nome,
        status: status || 'rascunho',
        endereco_completo: endereco_completo || '',
        latitude: latitude === undefined || latitude === null || latitude === '' ? null : Number(latitude),
        longitude: longitude === undefined || longitude === null || longitude === '' ? null : Number(longitude),
        geocoding_origem: geocoding_origem || null,
        geocoding_confianca: geocoding_confianca !== undefined && geocoding_confianca !== null ? Number(geocoding_confianca) : null,
        geocodificado_em: geocodificado_em ? new Date(geocodificado_em) : null,
        irradiancia_local: 131.44,
      })

      console.log('✓ Projeto FV criado em memory storage:', novo._id)
      res.status(201).json({ ...novo, clienteId: cliente })
    }
  } catch (err) {
    console.error('❌ Erro ao criar projeto FV:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const atualizarProjetoFV = async (req, res) => {
  try {
    let projeto
    if (mongoose.connection.readyState === 1) {
      projeto = await ProjetoFV.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('clienteId')
    } else {
      // Memory storage fallback
      projeto = memoryStore.updateProjetoFV(req.params.id, req.body)
      if (projeto) {
        projeto = {
          ...projeto,
          clienteId: memoryStore.findClienteById(projeto.clienteId)
        }
      }
    }
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    console.log('✓ Projeto FV atualizado:', req.params.id)
    res.json(projeto)
  } catch (err) {
    console.error('❌ Erro ao atualizar projeto FV:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * S8.4 — EXCLUIR. Regra:
 *  - Se rascunho + sem freeze + sem assinatura + sem documentos → HARD DELETE.
 *  - Senão → SOFT DELETE (excluido=true, fica preservado p/ histórico/auditoria).
 *  - ?definitivo=1 força tentativa de hard; rejeita se a regra não permite.
 */
export const excluirProjetoFV = async (req, res) => {
  try {
    const definitivo = ['1', 'true', 'yes'].includes(String(req.query?.definitivo || '').toLowerCase())
    if (mongoose.connection.readyState !== 1) {
      // Memory storage: soft delete não disponível → mantém comportamento legado
      const removido = memoryStore.deleteProjetoFV(req.params.id)
      if (!removido) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
      return res.status(204).end()
    }
    const projeto = await ProjetoFV.findById(req.params.id)
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })

    if (podeExcluirDefinitivo(projeto)) {
      await ProjetoFV.findByIdAndDelete(projeto._id)
      auditarCiclo(req, 'PROJETO_EXCLUIDO', projeto._id, 'hard delete (regra ok)')
      return res.status(204).end()
    }
    if (definitivo) {
      return res.status(409).json({
        erro: 'Exclusão definitiva bloqueada (projeto possui freeze, assinatura ou documentos).',
        sugestao: 'Use arquivamento — preserva histórico.',
      })
    }
    // Soft delete
    projeto.excluido = true
    projeto.excluido_em = new Date()
    projeto.excluido_por = req.auth?.id || req.auth?.email || req.body?.usuario || null
    await projeto.save()
    auditarCiclo(req, 'PROJETO_EXCLUIDO', projeto._id, 'soft delete')
    res.json({ sucesso: true, soft: true, item: enriquecer(projeto) })
  } catch (err) {
    console.error('❌ Erro ao excluir projeto FV:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * S8.4 — DUPLICAR. Copia cliente/consumo/localização/equipamentos/layout/dimensionamento.
 * Reseta: _id, freeze, assinaturas, auditoria, documentos congelados. Status: RASCUNHO.
 */
export const duplicarProjetoFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const orig = await ProjetoFV.findById(req.params.id).lean()
    if (!orig) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    if (orig.excluido) return res.status(400).json({ erro: 'Não é possível duplicar projeto excluído.' })

    // Campos a NÃO copiar (resetar)
    const {
      _id, createdAt, updatedAt, __v,
      governanca, // contém freeze + assinaturas + auditoria + revisoes
      documentos, documentos_tecnicos,
      excluido, excluido_em, excluido_por,
      arquivado_em, arquivado_por, motivo_arquivamento,
      ...resto
    } = orig

    const copia = {
      ...resto,
      status: 'rascunho',
      excluido: false, excluido_em: null, excluido_por: null,
      arquivado_em: null, arquivado_por: null, motivo_arquivamento: null,
      legacy: false, necessita_revisao: false,
      // governança zerada (sem snapshots, sem assinaturas, sem revisões)
      governanca: null,
      // marca a origem na descrição (não-funcional)
      nome: `${resto.nome || 'Projeto'} (cópia)`,
    }
    const novo = await ProjetoFV.create(copia)
    auditarCiclo(req, 'PROJETO_DUPLICADO', novo._id, `origem=${_id}`)
    res.status(201).json({ sucesso: true, item: enriquecer(novo), origem: _id })
  } catch (err) {
    console.error('❌ Erro ao duplicar projeto FV:', err)
    res.status(500).json({ erro: err.message })
  }
}

// S8.4 — ARQUIVAR (obriga motivo)
export const arquivarProjetoFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { motivo, usuario } = req.body || {}
    if (!motivo) return res.status(400).json({ erro: 'motivo obrigatório', motivos_validos: MOTIVOS_ARQUIVAMENTO })
    if (!MOTIVOS_ARQUIVAMENTO.includes(motivo)) {
      return res.status(400).json({ erro: `motivo inválido (use um de: ${MOTIVOS_ARQUIVAMENTO.join(', ')})` })
    }
    const projeto = await ProjetoFV.findById(req.params.id)
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    projeto.status = 'arquivado'
    projeto.arquivado_em = new Date()
    projeto.arquivado_por = req.auth?.id || req.auth?.email || usuario || null
    projeto.motivo_arquivamento = motivo
    await projeto.save()
    auditarCiclo(req, 'PROJETO_ARQUIVADO', projeto._id, `motivo=${motivo}`)
    res.json({ sucesso: true, item: enriquecer(projeto) })
  } catch (err) {
    console.error('❌ Erro ao arquivar projeto FV:', err)
    res.status(500).json({ erro: err.message })
  }
}

// S8.4 — RESTAURAR (volta a RASCUNHO se vinha de arquivado/excluído; preserva histórico)
export const restaurarProjetoFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const projeto = await ProjetoFV.findById(req.params.id)
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    const veioDe = projeto.excluido ? 'excluido' : (projeto.status === 'arquivado' ? 'arquivado' : 'nada')
    if (veioDe === 'nada') return res.status(400).json({ erro: 'Projeto não está arquivado nem excluído.' })

    projeto.excluido = false
    projeto.excluido_em = null
    projeto.excluido_por = null
    if (projeto.status === 'arquivado') projeto.status = 'rascunho'
    projeto.arquivado_em = null
    projeto.arquivado_por = null
    projeto.motivo_arquivamento = null
    await projeto.save()
    auditarCiclo(req, 'PROJETO_RESTAURADO', projeto._id, `de=${veioDe}`)
    res.json({ sucesso: true, item: enriquecer(projeto) })
  } catch (err) {
    console.error('❌ Erro ao restaurar projeto FV:', err)
    res.status(500).json({ erro: err.message })
  }
}

// S8.4 — Alterar status do ciclo (rascunho/em_analise/proposta/aprovado/em_execucao/concluido/perdido/cancelado)
export const alterarStatusCiclo = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { status } = req.body || {}
    if (!status) return res.status(400).json({ erro: 'status obrigatório' })
    const novo = paraModel(String(status).toUpperCase())
    const projeto = await ProjetoFV.findById(req.params.id)
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    const antes = projeto.status
    if (antes === novo) return res.json({ sucesso: true, item: enriquecer(projeto), inalterado: true })
    projeto.status = novo
    await projeto.save()
    auditarCiclo(req, 'STATUS_ALTERADO', projeto._id, `${antes} → ${novo}`)
    res.json({ sucesso: true, item: enriquecer(projeto), alteracao: { antes, depois: novo } })
  } catch (err) {
    console.error('❌ Erro ao alterar status FV:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const listarProjetosFVPorCliente = async (req, res) => {
  try {
    const { clienteId } = req.params

    // Skip ObjectId validation if memory storage is active
    if (mongoose.connection.readyState === 1 && !mongoose.Types.ObjectId.isValid(clienteId)) {
      return res.status(400).json({ erro: 'ClienteId inválido' })
    }

    let projetosDocliente
    if (mongoose.connection.readyState === 1) {
      projetosDocliente = await ProjetoFV.find({ clienteId }).sort({ createdAt: -1 })
    } else {
      // Memory storage fallback
      projetosDocliente = memoryStore.findProjetoFVByCliente(clienteId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }

    console.log(`✓ Listando ${projetosDocliente.length} projetos do cliente ${clienteId}`)
    res.json(projetosDocliente)
  } catch (err) {
    console.error('❌ Erro ao listar projetos por cliente:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const salvarTelhado = async (req, res) => {
  try {
    const { id } = req.params
    const {
      endereco_completo,
      latitude,
      longitude,
      geocoding_origem,
      geocoding_confianca,
      geocodificado_em,
      telhado,
    } = req.body

    // Skip ObjectId validation if memory storage is active
    if (mongoose.connection.readyState === 1 && !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ erro: 'ID inválido' })
    }

    let projeto
    if (mongoose.connection.readyState === 1) {
      projeto = await ProjetoFV.findById(id)
    } else {
      projeto = memoryStore.findProjetoFV(id)
    }
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    if (endereco_completo) projeto.endereco_completo = endereco_completo
    if (latitude !== undefined) {
      projeto.latitude = latitude === null || latitude === '' ? null : Number(latitude)
    }
    if (longitude !== undefined) {
      projeto.longitude = longitude === null || longitude === '' ? null : Number(longitude)
    }
    if (geocoding_origem !== undefined) projeto.geocoding_origem = geocoding_origem || null
    if (geocoding_confianca !== undefined) {
      projeto.geocoding_confianca = geocoding_confianca === null || geocoding_confianca === '' ? null : Number(geocoding_confianca)
    }
    if (geocodificado_em !== undefined) projeto.geocodificado_em = geocodificado_em ? new Date(geocodificado_em) : null
    if (telhado) {
      projeto.telhado = {
        pontos: telhado.pontos || [],
        area_m2: Number(telhado.area_m2) || 0,
      }
    }

    if (mongoose.connection.readyState === 1) {
      await projeto.save()
    } else {
      // Memory storage fallback
      memoryStore.updateProjetoFV(id, {
        endereco_completo: projeto.endereco_completo,
        latitude: projeto.latitude,
        longitude: projeto.longitude,
        geocoding_origem: projeto.geocoding_origem,
        geocoding_confianca: projeto.geocoding_confianca,
        geocodificado_em: projeto.geocodificado_em,
        telhado: projeto.telhado,
      })
    }

    console.log('✓ Telhado salvo para projeto:', id)
    res.json(projeto)
  } catch (err) {
    console.error('❌ Erro ao salvar telhado:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const obterTelhado = async (req, res) => {
  try {
    const { id } = req.params

    // Skip ObjectId validation if memory storage is active
    if (mongoose.connection.readyState === 1 && !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ erro: 'ID inválido' })
    }

    let projeto
    if (mongoose.connection.readyState === 1) {
      projeto = await ProjetoFV.findById(id)
    } else {
      projeto = memoryStore.findProjetoFV(id)
    }
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    res.json({
      id: projeto._id,
      nome: projeto.nome,
      endereco_completo: projeto.endereco_completo,
      latitude: projeto.latitude,
      longitude: projeto.longitude,
      geocoding_origem: projeto.geocoding_origem,
      geocoding_confianca: projeto.geocoding_confianca,
      geocodificado_em: projeto.geocodificado_em,
      telhado: projeto.telhado,
    })
  } catch (err) {
    console.error('❌ Erro ao obter telhado:', err)
    res.status(500).json({ erro: err.message })
  }
}

// ─── S2.7: Persistência incremental por etapa do Wizard v2 ──────────────────
/**
 * PUT /api/projetos-fv/:id/etapa
 *
 * Persiste um slice individual do Wizard v2 SEM sobrescrever o documento inteiro.
 * Usa $set cirúrgico — apenas o subdoc da etapa é atualizado.
 *
 * Body: { etapa: string, dados: object }
 *
 * Etapas suportadas:
 *   localizacao    → projeto.localizacao + espelha latitude/longitude/endereco_completo
 *   dimensionamento → projeto.dimensionamento + espelha potencia_kwp/geracao_mensal_kwh
 *   equipamentos   → projeto.equipamentos
 *   layout_solar   → projeto.layout_solar + espelha telhado
 *   protecoes      → projeto.protecoes
 *   orcamento      → projeto.orcamento + espelha financeiro.payback_anos/irr_pct
 *   proposta       → projeto.proposta
 *   workflow       → projeto.workflow
 *   unifilar       → projeto.unifilar
 *   fatura         → projeto.fatura_extracao (somente campos seguros)
 */
export const salvarEtapaProjetoFV = async (req, res) => {
  try {
    const { id } = req.params
    const { etapa, dados } = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ erro: 'ID inválido' })
    }
    if (!etapa || typeof etapa !== 'string') {
      return res.status(400).json({ erro: 'Campo "etapa" é obrigatório (string)' })
    }
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
      return res.status(400).json({ erro: 'Campo "dados" é obrigatório (object)' })
    }

    // Etapas permitidas — lista fechada para evitar escrita arbitrária
    const ETAPAS_PERMITIDAS = [
      'localizacao', 'dimensionamento', 'equipamentos', 'layout_solar',
      'protecoes', 'orcamento', 'proposta', 'workflow', 'unifilar', 'fatura',
      'engenharia_eletrica',  // S2.11.2 — arranjo + clima + resultado de compatibilidade
    ]
    if (!ETAPAS_PERMITIDAS.includes(etapa)) {
      return res.status(400).json({
        erro: `Etapa "${etapa}" não reconhecida.`,
        etapas_validas: ETAPAS_PERMITIDAS,
      })
    }

    // Monta $set para o subdoc principal + campos legados espelhados
    const $set = {}

    switch (etapa) {
      case 'localizacao': {
        $set.localizacao = dados
        // Espelha campos flat de v2 para manter compatibilidade
        if (dados.latitude     !== undefined) $set.latitude            = dados.latitude
        if (dados.longitude    !== undefined) $set.longitude           = dados.longitude
        if (dados.endereco_completo !== undefined) $set.endereco_completo = dados.endereco_completo
        if (dados.geocoding_origem  !== undefined) $set.geocoding_origem  = dados.geocoding_origem
        if (dados.geocoding_confianca !== undefined) $set.geocoding_confianca = dados.geocoding_confianca
        if (dados.geocodificado_em  !== undefined) $set.geocodificado_em  = dados.geocodificado_em
        if (dados.irradiancia_kwh_kwp_dia !== undefined) $set.irradiancia_local = dados.irradiancia_kwh_kwp_dia
        break
      }
      case 'dimensionamento': {
        $set.dimensionamento = dados
        // Espelha campos flat de v2
        if (dados.potencia_kwp      !== undefined) $set.potencia_kwp       = dados.potencia_kwp
        if (dados.geracao_mensal_kwh !== undefined) $set.geracao_mensal_kwh = dados.geracao_mensal_kwh
        break
      }
      case 'layout_solar': {
        $set.layout_solar = dados
        // Espelha para `telhado` legado
        if (dados.pontos || dados.area_util_m2 || dados.orientacao || dados.inclinacao_graus) {
          $set.telhado = {
            pontos:      dados.pontos      ?? undefined,
            area_m2:     dados.area_util_m2 ?? undefined,
            orientacao:  dados.orientacao   ?? undefined,
            inclinacao:  dados.inclinacao_graus ?? undefined,
          }
        }
        break
      }
      case 'orcamento': {
        $set.orcamento = dados
        // Espelha campos básicos para `financeiro` legado
        if (dados.payback_anos !== undefined) $set['financeiro.payback_anos'] = dados.payback_anos
        if (dados.irr_pct      !== undefined) $set['financeiro.irr_pct']      = dados.irr_pct
        if (dados.npv_r        !== undefined) $set['financeiro.npv_r']        = dados.npv_r
        break
      }
      case 'fatura': {
        // Permite atualizar apenas um subconjunto seguro de fatura_extracao
        // (não permite sobrescrever dados_brutos ou arquivo_original_nome via esta rota)
        const CAMPOS_FATURA_PERMITIDOS = [
          'confirmado_pelo_usuario', 'concessionaria', 'grupo_tarifario',
          'classificacao', 'tipo_ligacao', 'consumo_mensal_kwh', 'media_anual_kwh',
          'historico_12meses', 'valor_total_r', 'valor_kwh', 'irradiancia_local',
        ]
        for (const campo of CAMPOS_FATURA_PERMITIDOS) {
          if (dados[campo] !== undefined) {
            $set[`fatura_extracao.${campo}`] = dados[campo]
          }
        }
        if (Object.keys($set).length === 0) {
          return res.status(400).json({ erro: 'Nenhum campo de fatura permitido encontrado em "dados"' })
        }
        break
      }
      case 'engenharia_eletrica': {
        // S2.11.2 — Merge seguro por dot-notation.
        // Grava apenas os subcampos enviados, preservando quaisquer subcampos
        // existentes que o frontend não tenha incluído no payload.
        //
        // Subcampos aceitos: arranjo, clima_utilizado, compatibilidade
        // Campos desconhecidos são ignorados (lista de permissão explícita).
        const SUBCAMPOS = ['arranjo', 'clima_utilizado', 'compatibilidade']
        for (const sub of SUBCAMPOS) {
          if (dados[sub] !== undefined) {
            $set[`engenharia_eletrica.${sub}`] = dados[sub]
          }
        }
        if (Object.keys($set).length === 0) {
          return res.status(400).json({
            erro: 'engenharia_eletrica: nenhum subcampo válido recebido.',
            subcampos_validos: SUBCAMPOS,
          })
        }
        break
      }

      default:
        // equipamentos, protecoes, proposta, workflow, unifilar — set direto
        $set[etapa] = dados
    }

    // ⚠️ FIX defensivo: garantir que `workflow` não seja null antes de tocar subcampos.
    // Sem isso, MongoDB lança "Cannot create field 'ultima_atividade' in element {workflow: null}"
    // pois $set em path dot-notation falha quando o ancestral é null.
    const projetoAtual = await ProjetoFV.findById(id).select('workflow governanca.freeze_status governanca.comercial.workflow_status').lean()
    if (!projetoAtual) return res.status(404).json({ erro: 'Projeto não encontrado' })

    // ── S3.5/S4.2: Freeze guard ────────────────────────────────────────────────
    // Projetos CONGELADO/HOMOLOGADO (técnico) ou ASSINADO (comercial) não aceitam
    // recálculo nem alteração silenciosa. Apenas a etapa 'workflow' é tolerada.
    // Snapshots e mudança de status passam por endpoints dedicados.
    const freezeStatus = projetoAtual.governanca?.freeze_status
    const comStatus    = projetoAtual.governanca?.comercial?.workflow_status
    const travado = freezeStatus === 'CONGELADO' || freezeStatus === 'HOMOLOGADO' || comStatus === 'ASSINADO'
    if (travado && etapa !== 'workflow') {
      const motivo = comStatus === 'ASSINADO' ? 'ASSINADO (comercial)' : freezeStatus
      return res.status(409).json({
        erro: `Projeto ${motivo} — alteração de "${etapa}" bloqueada.`,
        codigo: 'PROJETO_CONGELADO',
        freeze_status: freezeStatus,
        workflow_comercial: comStatus,
        dica: 'Crie uma revisão (técnica ou comercial) para reabrir antes de editar.',
      })
    }

    if (!projetoAtual.workflow) {
      await ProjetoFV.updateOne({ _id: id }, { $set: { workflow: {} } })
    }

    // Sempre atualiza ultima_atividade + schema_version.
    // Quando etapa === 'workflow', o switch default já fez $set.workflow = dados (objeto inteiro);
    // nesse caso, embutimos ultima_atividade dentro do objeto para evitar conflito de path
    // "Updating the path 'workflow.ultima_atividade' would create a conflict at 'workflow'".
    if (etapa === 'workflow') {
      $set.workflow = { ...dados, ultima_atividade: new Date() }
    } else {
      $set['workflow.ultima_atividade'] = new Date()
    }
    $set.schema_version = 3  // documento passa a ser v3 a partir do primeiro save via wizard

    const projeto = await ProjetoFV.findByIdAndUpdate(
      id,
      { $set },
      { new: true, runValidators: true }
    ).populate('clienteId')

    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    console.log(`✓ Etapa "${etapa}" salva para projeto ${id}`)
    res.json({
      sucesso: true,
      etapa,
      projeto_id: projeto._id,
      schema_version: projeto.schema_version,
      // Retorna apenas o subdoc atualizado + metadados básicos (não o doc inteiro)
      [etapa === 'fatura' ? 'fatura_extracao' : etapa]: projeto[etapa === 'fatura' ? 'fatura_extracao' : etapa],
    })
  } catch (err) {
    console.error('❌ Erro ao salvar etapa FV:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const gerarUnifilarProjeto = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ erro: 'ID inválido' })
    }

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const dim = projeto.dimensionamento
    if (!dim) {
      return res.status(400).json({ erro: 'Projeto sem dimensionamento' })
    }

    const { gerarUnifilarFV } = await import('../controllers/unifilarController.js')

    const res2 = {
      json: (data) => {
        res.json(data)
      },
      status: (code) => ({
        json: (data) => res.status(code).json(data),
      }),
    }

    gerarUnifilarFV(
      {
        body: {
          paineis: dim.numPaineis,
          strings: Array(dim.numStrings).fill(null),
          inversor: { potenciaKW: dim.potenciaArredondada, modelo: 'Fronius SYMO' },
          tensao_rede: 'trifasico',
          bess: null,
        },
      },
      res2
    )
  } catch (err) {
    console.error('❌ Erro ao gerar unifilar:', err)
    res.status(500).json({ erro: err.message })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// S3.5 — GOVERNANÇA TÉCNICA
//
// Congelamento de snapshots, versionamento de engenharia, revisões, auditoria e
// detecção de divergência com o catálogo vivo. Tudo additive: projetos antigos
// (governanca === null) seguem funcionando sem nenhuma alteração de comportamento.
// ═══════════════════════════════════════════════════════════════════════════════

function _exigirMongo(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ erro: 'MongoDB indisponível.', codigo: 'DB_OFFLINE' })
    return false
  }
  return true
}

// Próxima letra de revisão: A→B→C... (após Z, usa AA, AB... improvável mas seguro)
function _proximaRevisao(atual) {
  if (!atual) return 'A'
  const ultima = String(atual).trim().toUpperCase()
  const cod = ultima.charCodeAt(ultima.length - 1)
  if (cod >= 65 && cod < 90) return ultima.slice(0, -1) + String.fromCharCode(cod + 1)
  if (cod === 90) return ultima + 'A' // Z → ZA
  return 'A'
}

/**
 * POST /:id/governanca/congelar
 * Congela os snapshots enviados pelo frontend e trava o projeto.
 * Body: { snapshots: { tecnico, catalogo, unifilar, memorial, financeiro },
 *         engineering_version, usuario, motivo, novo_status }
 */
export const congelarProjetoFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })

    const {
      snapshots = {},
      engineering_version = null,
      usuario = null,
      motivo = null,
      novo_status = 'CONGELADO',
    } = req.body || {}

    const STATUS_VALIDOS = ['CONGELADO', 'HOMOLOGADO']
    if (!STATUS_VALIDOS.includes(novo_status)) {
      return res.status(400).json({ erro: `novo_status deve ser um de: ${STATUS_VALIDOS.join(', ')}` })
    }

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const gov = projeto.governanca || {}
    const agora = new Date()
    const revAtual = gov.revisao_atual || 'A'

    // S8.3.2 — snapshot imutável do Responsável Técnico (congela o cadastro no momento
    // do freeze; documentos futuros usam o snapshot, não o cadastro vivo).
    let snapshotRT = snapshots.responsavel_tecnico ?? gov.snapshot_responsavel_tecnico ?? null
    if (!snapshotRT) {
      const tecnicoId = projeto.tecnico_principal_id || projeto.tecnico_id || null
      if (tecnicoId && mongoose.Types.ObjectId.isValid(tecnicoId)) {
        try {
          const tec = await Tecnico.findById(tecnicoId).lean()
          if (tec) snapshotRT = montarSnapshotRT(tec, agora)
        } catch { /* segue sem snapshot RT */ }
      }
    }

    // Monta o subdoc de governança congelado
    const novaGovernanca = {
      ...((projeto.governanca && projeto.governanca.toObject?.()) || gov),
      engineering_version: engineering_version || gov.engineering_version || null,
      freeze_status: novo_status,
      revisao_atual: revAtual,
      congelado_em: agora,
      congelado_por: usuario,
      snapshot_responsavel_tecnico: snapshotRT,
      snapshot_tecnico:    snapshots.tecnico    ?? gov.snapshot_tecnico    ?? null,
      snapshot_geoespacial: snapshots.geoespacial ?? gov.snapshot_geoespacial ?? null,
      snapshot_empresa:    snapshots.empresa    ?? gov.snapshot_empresa    ?? null,
      snapshot_tecnico_identificacao: snapshots.tecnico_identificacao ?? gov.snapshot_tecnico_identificacao ?? null,
      snapshot_catalogo:   snapshots.catalogo   ?? gov.snapshot_catalogo   ?? null,
      snapshot_unifilar:   snapshots.unifilar   ?? gov.snapshot_unifilar   ?? null,
      snapshot_memorial:   snapshots.memorial   ?? gov.snapshot_memorial   ?? null,
      snapshot_financeiro: snapshots.financeiro ?? gov.snapshot_financeiro ?? null,
    }

    // Garante arrays existentes
    novaGovernanca.revisoes  = Array.isArray(gov.revisoes)  ? [...gov.revisoes]  : []
    novaGovernanca.auditoria = Array.isArray(gov.auditoria) ? [...gov.auditoria] : []
    novaGovernanca.historico = Array.isArray(gov.historico) ? [...gov.historico] : []

    // Registra/atualiza a revisão atual com cópia dos snapshots
    const idxRev = novaGovernanca.revisoes.findIndex(r => r.rev === revAtual)
    const registroRev = {
      rev: revAtual,
      timestamp: agora,
      usuario,
      motivo: motivo || `Proposta ${novo_status.toLowerCase()}`,
      alteracoes: 'Snapshots técnicos, catálogo, unifilar, memorial e financeiro congelados.',
      engineering_version: novaGovernanca.engineering_version,
      snapshots: {
        responsavel_tecnico: novaGovernanca.snapshot_responsavel_tecnico,
        tecnico:    novaGovernanca.snapshot_tecnico,
        geoespacial: novaGovernanca.snapshot_geoespacial,
        catalogo:   novaGovernanca.snapshot_catalogo,
        unifilar:   novaGovernanca.snapshot_unifilar,
        memorial:   novaGovernanca.snapshot_memorial,
        financeiro: novaGovernanca.snapshot_financeiro,
      },
    }
    if (idxRev >= 0) novaGovernanca.revisoes[idxRev] = registroRev
    else novaGovernanca.revisoes.push(registroRev)

    novaGovernanca.auditoria.push({
      timestamp: agora, usuario, acao: 'congelamento',
      detalhe: `Projeto ${novo_status} na revisão ${revAtual} (motor ${novaGovernanca.engineering_version || '—'}).`,
      contexto: { motivo },
    })
    // S8.3.2 — auditoria do snapshot do RT (quando houver técnico atribuído)
    if (snapshotRT) {
      novaGovernanca.auditoria.push({
        timestamp: agora, usuario, acao: 'SNAPSHOT_RT_CRIADO',
        detalhe: `RT congelado: ${snapshotRT.nome || '—'} (${snapshotRT.tipo_registro || ''} ${snapshotRT.numero_registro || ''}).`,
        contexto: { uf: snapshotRT.uf, modalidade: snapshotRT.modalidade },
      })
    }
    novaGovernanca.historico.push({
      timestamp: agora,
      tipo: novo_status === 'HOMOLOGADO' ? 'homologado' : 'congelado',
      descricao: `Rev ${revAtual} — proposta ${novo_status.toLowerCase()}.`,
    })

    projeto.governanca = novaGovernanca
    await projeto.save()

    console.log(`🔒 Projeto ${id} ${novo_status} (Rev ${revAtual})`)
    res.json({ sucesso: true, governanca: projeto.governanca })
  } catch (err) {
    console.error('❌ Erro ao congelar projeto:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * POST /:id/governanca/revisao
 * Cria nova revisão (Rev A→B→C) e reabre a engenharia (volta a EM_REVISAO).
 * Body: { usuario, motivo, alteracoes }
 */
export const criarRevisaoProjetoFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })

    const { usuario = null, motivo = null, alteracoes = null } = req.body || {}

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const gov = (projeto.governanca && projeto.governanca.toObject?.()) || projeto.governanca || {}
    const agora = new Date()
    const novaRev = _proximaRevisao(gov.revisao_atual || 'A')

    const revisoes  = Array.isArray(gov.revisoes)  ? [...gov.revisoes]  : []
    const auditoria = Array.isArray(gov.auditoria) ? [...gov.auditoria] : []
    const historico = Array.isArray(gov.historico) ? [...gov.historico] : []

    revisoes.push({
      rev: novaRev, timestamp: agora, usuario,
      motivo: motivo || 'Revisão aberta para edição',
      alteracoes,
      engineering_version: gov.engineering_version || null,
      snapshots: null, // ainda não congelada
    })
    auditoria.push({
      timestamp: agora, usuario, acao: 'revisao_criada',
      detalhe: `Revisão ${novaRev} criada. Engenharia reaberta (EM_REVISAO).`,
      contexto: { motivo, alteracoes },
    })
    historico.push({
      timestamp: agora, tipo: 'revisao',
      descricao: `Rev ${novaRev} criada — projeto reaberto para edição.`,
    })

    projeto.governanca = {
      ...gov,
      freeze_status: 'EM_REVISAO',
      revisao_atual: novaRev,
      revisoes, auditoria, historico,
    }
    await projeto.save()

    console.log(`📝 Projeto ${id} reaberto — Rev ${novaRev}`)
    res.json({ sucesso: true, revisao_atual: novaRev, governanca: projeto.governanca })
  } catch (err) {
    console.error('❌ Erro ao criar revisão:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * PUT /:id/governanca/status
 * Altera o status de governança manualmente (RASCUNHO/EM_REVISAO/CONGELADO/HOMOLOGADO).
 * Body: { status, usuario }
 */
export const alterarStatusGovernanca = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })

    const { status, usuario = null } = req.body || {}
    const STATUS_VALIDOS = ['RASCUNHO', 'EM_REVISAO', 'CONGELADO', 'HOMOLOGADO']
    if (!STATUS_VALIDOS.includes(status)) {
      return res.status(400).json({ erro: `status deve ser um de: ${STATUS_VALIDOS.join(', ')}` })
    }

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const gov = (projeto.governanca && projeto.governanca.toObject?.()) || projeto.governanca || {}
    const agora = new Date()
    const auditoria = Array.isArray(gov.auditoria) ? [...gov.auditoria] : []
    const historico = Array.isArray(gov.historico) ? [...gov.historico] : []
    const anterior = gov.freeze_status || 'RASCUNHO'

    auditoria.push({
      timestamp: agora, usuario, acao: 'status_alterado',
      detalhe: `Status: ${anterior} → ${status}.`,
    })
    historico.push({
      timestamp: agora, tipo: status === 'HOMOLOGADO' ? 'homologado' : status.toLowerCase(),
      descricao: `Status alterado para ${status}.`,
    })

    projeto.governanca = {
      ...gov,
      freeze_status: status,
      ...(status === 'HOMOLOGADO' ? {} : {}),
      auditoria, historico,
    }
    await projeto.save()

    res.json({ sucesso: true, freeze_status: status, governanca: projeto.governanca })
  } catch (err) {
    console.error('❌ Erro ao alterar status de governança:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * GET /:id/governanca/divergencia
 * Compara o snapshot_catalogo congelado com o catálogo vivo (Equipamento).
 * Detecta equipamentos que mudaram de specs/score/validação desde o congelamento.
 */
export const detectarDivergenciaProjetoFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })

    const projeto = await ProjetoFV.findById(id).lean()
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const snapCat = projeto.governanca?.snapshot_catalogo
    if (!snapCat) {
      return res.json({
        sucesso: true,
        tem_snapshot: false,
        mensagem: 'Projeto sem snapshot de catálogo — nada para comparar.',
        divergencias: [],
      })
    }

    // snapshot_catalogo: { modulo: {...}, inversor: {...}, ... }
    const divergencias = []

    for (const [chave, snap] of Object.entries(snapCat)) {
      if (!snap || typeof snap !== 'object') continue

      // Localiza o equipamento atual: por id, senão por fabricante+modelo
      let atual = null
      if (snap.equipamento_id && mongoose.Types.ObjectId.isValid(snap.equipamento_id)) {
        atual = await Equipamento.findById(snap.equipamento_id).lean()
      }
      if (!atual && snap.fabricante && snap.modelo) {
        atual = await Equipamento.findOne({
          fabricante: snap.fabricante,
          modelo: snap.modelo,
        }).lean()
      }

      if (!atual) {
        divergencias.push({
          chave, fabricante: snap.fabricante, modelo: snap.modelo,
          tipo_divergencia: 'removido_do_catalogo',
          impacto: 'Equipamento não encontrado no catálogo atual.',
          mudancas: [],
        })
        continue
      }

      // Compara campos relevantes
      const mudancas = []
      const hashAtual = atual.identificacao?.hash_unico ?? null
      if (snap.hash_tecnico && hashAtual && snap.hash_tecnico !== hashAtual) {
        mudancas.push({ campo: 'hash_tecnico', de: snap.hash_tecnico, para: hashAtual })
      }
      const scoreAtual = atual.qualidade?.score_global ?? null
      if (snap.score != null && scoreAtual != null && snap.score !== scoreAtual) {
        mudancas.push({ campo: 'score_qualidade', de: snap.score, para: scoreAtual })
      }
      const nivelAtual = atual.qualidade?.nivel ?? null
      if (snap.nivel && nivelAtual && snap.nivel !== nivelAtual) {
        mudancas.push({ campo: 'nivel_qualidade', de: snap.nivel, para: nivelAtual })
      }
      // Specs elétricas
      const espSnap = snap.especificacoes || {}
      const espAtual = atual.especificacoes || {}
      for (const campo of Object.keys(espSnap)) {
        if (espAtual[campo] !== undefined && espSnap[campo] !== espAtual[campo]) {
          mudancas.push({ campo: `especificacoes.${campo}`, de: espSnap[campo], para: espAtual[campo] })
        }
      }

      if (mudancas.length > 0) {
        divergencias.push({
          chave, fabricante: snap.fabricante, modelo: snap.modelo,
          tipo_divergencia: 'specs_alteradas',
          impacto: mudancas.some(m => m.campo.startsWith('especificacoes'))
            ? 'Specs elétricas mudaram — recálculo necessário para refletir o catálogo atual.'
            : 'Qualidade/score do equipamento mudou no catálogo.',
          mudancas,
        })
      }
    }

    res.json({
      sucesso: true,
      tem_snapshot: true,
      congelado_em: projeto.governanca?.congelado_em ?? null,
      engineering_version: projeto.governanca?.engineering_version ?? null,
      total_divergencias: divergencias.length,
      divergente: divergencias.length > 0,
      divergencias,
    })
  } catch (err) {
    console.error('❌ Erro ao detectar divergência:', err)
    res.status(500).json({ erro: err.message })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// S4.2 — COMERCIAL ENTERPRISE
// Workflow comercial, cenários, desconto/aprovação, assinaturas e snapshot
// comercial congelável. Additive: projetos sem governanca.comercial seguem iguais.
// ═══════════════════════════════════════════════════════════════════════════════

function _carregarComercial(gov) {
  const govObj = (gov && gov.toObject?.()) || gov || {}
  const com = govObj.comercial || {}
  return {
    govObj,
    com: {
      ...com,
      assinaturas: Array.isArray(com.assinaturas) ? [...com.assinaturas] : [],
      historico: Array.isArray(com.historico) ? [...com.historico] : [],
    },
  }
}

const WORKFLOW_COMERCIAL = ['RASCUNHO', 'EM_ANALISE', 'NEGOCIACAO', 'AGUARDANDO_CLIENTE', 'APROVADO',
  'ASSINADO', 'IMPLANTACAO', 'CONCLUIDO', 'REPROVADO', 'CANCELADO', 'EXPIRADO']

// S4.3: máquina de estados (espelho de comercialStateMachine.js no frontend)
const TRANSICOES_COMERCIAL = {
  RASCUNHO:           ['EM_ANALISE', 'CANCELADO'],
  EM_ANALISE:         ['NEGOCIACAO', 'AGUARDANDO_CLIENTE', 'REPROVADO', 'CANCELADO'],
  NEGOCIACAO:         ['AGUARDANDO_CLIENTE', 'APROVADO', 'REPROVADO', 'CANCELADO'],
  AGUARDANDO_CLIENTE: ['APROVADO', 'NEGOCIACAO', 'REPROVADO', 'EXPIRADO', 'CANCELADO'],
  APROVADO:           ['ASSINADO', 'NEGOCIACAO', 'CANCELADO', 'EXPIRADO'],
  ASSINADO:           ['IMPLANTACAO', 'CANCELADO'],
  IMPLANTACAO:        ['CONCLUIDO', 'CANCELADO'],
  CONCLUIDO:          [],
  REPROVADO:          ['EM_ANALISE'],
  CANCELADO:          [],
  EXPIRADO:           ['EM_ANALISE'],
}
const ORDEM_COMERCIAL = { RASCUNHO: 1, EM_ANALISE: 2, NEGOCIACAO: 3, AGUARDANDO_CLIENTE: 4, APROVADO: 5, ASSINADO: 6, IMPLANTACAO: 7, CONCLUIDO: 8 }
const CONGELADOS_COMERCIAL = ['ASSINADO', 'IMPLANTACAO', 'CONCLUIDO']

function _statusJuridicoDeEstado(estado) {
  if (['ASSINADO', 'IMPLANTACAO', 'CONCLUIDO'].includes(estado)) return 'ASSINADO'
  if (estado === 'CANCELADO') return 'CANCELADO'
  if (estado === 'EXPIRADO') return 'EXPIRADO'
  if (estado === 'REPROVADO') return 'EM_REVISAO'
  return 'PENDENTE_ASSINATURA'
}

function _validarTransicaoComercial(de, para) {
  if (de === para) return { ok: false, motivo: 'Estado de origem e destino iguais.' }
  if (!WORKFLOW_COMERCIAL.includes(para)) return { ok: false, motivo: `Estado "${para}" inválido.` }
  const permitidas = TRANSICOES_COMERCIAL[de] || []
  if (permitidas.includes(para)) return { ok: true }
  if (CONGELADOS_COMERCIAL.includes(de) && (ORDEM_COMERCIAL[para] || 0) < (ORDEM_COMERCIAL[de] || 0)) {
    return { ok: false, requer_revisao: true, motivo: `${de}: retroceder para ${para} exige nova revisão comercial.` }
  }
  return { ok: false, motivo: `Transição ${de} → ${para} não permitida.` }
}

function _proximaRevComercial(atual) {
  return _proximaRevisao(atual || 'A')
}

/**
 * POST /:id/governanca/comercial/snapshot
 * Salva/congela o snapshot comercial: cenários, comparativos, desconto, PDF.
 * Body: { snapshot_comercial, cenarios, comparativos, desconto_pct, congelar, usuario }
 */
export const salvarComercialProjetoFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })

    const { snapshot_comercial = null, cenarios = null, comparativos = null,
      desconto_pct, desconto_limite_pct, margem_liquida_pct = null,
      cenarios_congelados = null, congelar = false, usuario = null } = req.body || {}

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const agora = new Date()

    if (CONGELADOS_COMERCIAL.includes(com.workflow_status)) {
      return res.status(409).json({ erro: `Proposta ${com.workflow_status} — crie uma revisão comercial antes de alterar.`, codigo: 'COMERCIAL_CONGELADO' })
    }

    // S4.3: proteção de margem ao congelar (impede venda destrutiva)
    if (congelar && margem_liquida_pct != null) {
      const pol = com.politicas || {}
      const bloqueio = pol.margem_bloqueio_pct ?? 0
      const minima = pol.margem_minima_pct ?? 8
      if (Number(margem_liquida_pct) < bloqueio) {
        return res.status(422).json({ erro: `Margem ${margem_liquida_pct}% abaixo do bloqueio (${bloqueio}%). Congelamento impedido.`, codigo: 'MARGEM_BLOQUEIO' })
      }
      if (Number(margem_liquida_pct) < minima && !com.aprovacao) {
        return res.status(422).json({ erro: `Margem ${margem_liquida_pct}% abaixo da mínima (${minima}%). Requer aprovação gerencial antes de congelar.`, codigo: 'MARGEM_REQUER_APROVACAO' })
      }
    }
    if (cenarios_congelados != null) com.cenarios_congelados = cenarios_congelados

    if (cenarios != null)            com.cenarios = cenarios
    if (comparativos != null)        com.comparativos = comparativos
    if (snapshot_comercial != null)  com.snapshot_comercial = snapshot_comercial
    if (desconto_pct != null)        com.desconto_pct = desconto_pct
    if (desconto_limite_pct != null) com.desconto_limite_pct = desconto_limite_pct
    if (congelar)                    com.congelado_em = agora

    com.historico.push({
      timestamp: agora, usuario, acao: congelar ? 'snapshot_comercial_congelado' : 'snapshot_comercial_salvo',
      detalhe: `Cenários e comparativos ${congelar ? 'congelados' : 'atualizados'}.`,
    })

    projeto.governanca = { ...govObj, comercial: com }
    await projeto.save()
    res.json({ sucesso: true, comercial: projeto.governanca.comercial })
  } catch (err) {
    console.error('❌ Erro ao salvar comercial:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * PUT /:id/governanca/comercial/workflow
 * Altera o status do workflow comercial. ASSINADO congela (freeze comercial).
 * Body: { status, usuario }
 */
export const atualizarWorkflowComercial = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })

    const { status, usuario = null, motivo = null } = req.body || {}
    if (!WORKFLOW_COMERCIAL.includes(status)) {
      return res.status(400).json({ erro: `status deve ser um de: ${WORKFLOW_COMERCIAL.join(', ')}` })
    }

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const agora = new Date()
    const anterior = com.workflow_status || 'EM_ANALISE'

    // S4.3: valida transição na máquina de estados
    const val = _validarTransicaoComercial(anterior, status)
    if (!val.ok) {
      return res.status(409).json({
        erro: val.motivo, codigo: val.requer_revisao ? 'REQUER_REVISAO' : 'TRANSICAO_INVALIDA',
        de: anterior, para: status,
      })
    }

    com.workflow_status = status
    com.status_juridico = _statusJuridicoDeEstado(status)
    if (status === 'ASSINADO') com.congelado_em = com.congelado_em || agora
    com.historico.push({
      timestamp: agora, usuario, acao: 'workflow_alterado',
      detalhe: `Workflow: ${anterior} → ${status}.${motivo ? ' Motivo: ' + motivo : ''}`,
    })

    projeto.governanca = { ...govObj, comercial: com }
    await projeto.save()
    res.json({ sucesso: true, workflow_status: status, comercial: projeto.governanca.comercial })
  } catch (err) {
    console.error('❌ Erro no workflow comercial:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * POST /:id/governanca/comercial/assinatura
 * Registra assinatura digital simples (hash + timestamp).
 * Body: { papel, nome, hash, usuario }
 */
export const registrarAssinaturaComercial = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })

    const { papel, nome, hash, hash_documento = null, hash_snapshot = null, algoritmo = 'sha256', usuario = null, usuario_id = null } = req.body || {}
    const PAPEIS = ['cliente', 'vendedor', 'tecnico']
    if (!PAPEIS.includes(papel)) return res.status(400).json({ erro: `papel deve ser: ${PAPEIS.join(', ')}` })
    if (!nome || !hash) return res.status(400).json({ erro: 'nome e hash são obrigatórios' })

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const agora = new Date()

    // S4.3: trilha auditável — ip, user-agent, hashes, id único
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || req.socket?.remoteAddress || null
    const user_agent = req.headers['user-agent'] || null
    const assinatura_id = `SIG-${papel.toUpperCase()}-${agora.getTime().toString(36)}`

    // Substitui assinatura existente do mesmo papel (re-assinatura)
    com.assinaturas = com.assinaturas.filter(a => a.papel !== papel)
    com.assinaturas.push({ assinatura_id, usuario_id, papel, nome, hash, algoritmo, hash_documento, hash_snapshot, ip, user_agent, timestamp: agora })
    com.historico.push({ timestamp: agora, usuario: usuario || nome, acao: 'assinatura', detalhe: `Assinatura ${papel}: ${nome} (${assinatura_id}).` })

    // Se as três assinaturas estão presentes, marca ASSINADO
    const papeisAssinados = new Set(com.assinaturas.map(a => a.papel))
    if (PAPEIS.every(p => papeisAssinados.has(p)) && com.workflow_status !== 'ASSINADO') {
      com.workflow_status = 'ASSINADO'
      com.status_juridico = 'ASSINADO'
      com.congelado_em = com.congelado_em || agora
      com.historico.push({ timestamp: agora, usuario, acao: 'workflow_alterado', detalhe: 'Workflow: ASSINADO (todas as assinaturas coletadas).' })
    }

    projeto.governanca = { ...govObj, comercial: com }
    await projeto.save()
    res.json({ sucesso: true, comercial: projeto.governanca.comercial })
  } catch (err) {
    console.error('❌ Erro ao registrar assinatura:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * POST /:id/governanca/comercial/aprovacao
 * Registra aprovação gerencial de desconto/margem/exceção.
 * Body: { tipo, aprovado_por, observacao, usuario }
 */
export const registrarAprovacaoComercial = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })

    const { tipo, aprovado_por, observacao = null, usuario = null } = req.body || {}
    const TIPOS = ['aprovacao_desconto', 'aprovacao_margem', 'aprovacao_excecao']
    if (!TIPOS.includes(tipo)) return res.status(400).json({ erro: `tipo deve ser: ${TIPOS.join(', ')}` })
    if (!aprovado_por) return res.status(400).json({ erro: 'aprovado_por é obrigatório' })

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const agora = new Date()

    com.aprovacao = { tipo, aprovado_por, em: agora, observacao }
    com.desconto_aprovado_por = aprovado_por
    if (tipo === 'aprovacao_excecao') com.desconto_excecao = true
    com.historico.push({ timestamp: agora, usuario: usuario || aprovado_por, acao: 'aprovacao', detalhe: `${tipo} por ${aprovado_por}.` })

    projeto.governanca = { ...govObj, comercial: com }
    await projeto.save()
    res.json({ sucesso: true, comercial: projeto.governanca.comercial })
  } catch (err) {
    console.error('❌ Erro ao registrar aprovação:', err)
    res.status(500).json({ erro: err.message })
  }
}

// Diff raso entre dois snapshots comerciais (campos-chave)
function _diffComercial(antigo, novo) {
  const campos = [
    ['proposta_final', 'Proposta final'],
    ['desconto_pct', 'Desconto'],
    ['cenario_exibicao', 'Cenário base'],
  ]
  const diff = []
  const a = antigo || {}, b = novo || {}
  for (const [campo, rotulo] of campos) {
    if (a[campo] !== b[campo]) diff.push({ campo: rotulo, de: a[campo] ?? null, para: b[campo] ?? null })
  }
  return diff
}

/**
 * POST /:id/governanca/comercial/revisao
 * Cria nova revisão comercial: clona o snapshot atual, gera diff, preserva
 * histórico e reabre o workflow (EM_ANALISE). Permite reabrir proposta ASSINADA.
 * Body: { usuario, motivo, snapshot_comercial (novo, opcional) }
 */
export const criarRevisaoComercial = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })

    const { usuario = null, motivo = null, snapshot_comercial: novoSnap = null } = req.body || {}

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const agora = new Date()
    const revAtual = com.revisao_comercial_atual || 'A'
    const novaRev = _proximaRevComercial(revAtual)

    const revisoes = Array.isArray(com.revisoes_comerciais) ? [...com.revisoes_comerciais] : []
    const snapAnterior = com.snapshot_comercial || null
    const diff = _diffComercial(snapAnterior, novoSnap || snapAnterior)

    // Arquiva a revisão anterior (clone do snapshot)
    revisoes.push({
      rev: revAtual, timestamp: agora, usuario,
      motivo: motivo || 'Revisão comercial',
      diff,
      snapshot_comercial: snapAnterior,
    })

    com.revisoes_comerciais = revisoes
    com.revisao_comercial_atual = novaRev
    com.workflow_status = 'EM_ANALISE'
    com.status_juridico = 'EM_REVISAO'
    com.congelado_em = null
    com.aprovacao = null
    com.desconto_excecao = false
    com.assinaturas = []   // assinaturas anteriores ficam arquivadas na revisão
    if (novoSnap) com.snapshot_comercial = novoSnap
    com.historico.push({
      timestamp: agora, usuario, acao: 'revisao_comercial',
      detalhe: `Revisão comercial ${revAtual} → ${novaRev}. Proposta reaberta (EM_ANALISE).${motivo ? ' Motivo: ' + motivo : ''}`,
    })

    projeto.governanca = { ...govObj, comercial: com }
    await projeto.save()
    res.json({ sucesso: true, revisao_atual: novaRev, comercial: projeto.governanca.comercial })
  } catch (err) {
    console.error('❌ Erro ao criar revisão comercial:', err)
    res.status(500).json({ erro: err.message })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// S4.3.1 — GOVERNANÇA INDIVIDUAL POR CENÁRIO + AUDITORIA REAL DE IP
// ═══════════════════════════════════════════════════════════════════════════════

// Extrai a trilha de IP real (trust proxy ativo → req.ip é o cliente).
function _ipReal(req) {
  const fwd = req.headers['x-forwarded-for'] || ''
  const proxy_chain = fwd ? fwd.split(',').map(s => s.trim()).filter(Boolean) : []
  const ip_real = req.ip || proxy_chain[0] || req.socket?.remoteAddress || null
  return { ip_real, forwarded_for: fwd || null, proxy_chain, user_agent: req.headers['user-agent'] || null }
}

// Carrega/inicializa o objeto de governança de um cenário específico.
function _carregarCenarioGov(com, scenarioId) {
  const mapa = (com.cenarios_governanca && typeof com.cenarios_governanca === 'object')
    ? { ...com.cenarios_governanca } : {}
  const atual = mapa[scenarioId] || {
    scenario_id: scenarioId,
    freeze_status: 'EDITAVEL',          // EDITAVEL | CONGELADO
    workflow_status: 'EM_ANALISE',
    status_juridico: 'PENDENTE_ASSINATURA',
    snapshot_comercial: null,
    snapshot_financeiro: null,
    snapshot_regulatorio: null,
    hash: null,
    assinaturas: [],
    revisoes: [],
    timeline: [],
    revisao_atual: 'A',
    congelado_em: null,
  }
  // Garante arrays
  atual.assinaturas = Array.isArray(atual.assinaturas) ? [...atual.assinaturas] : []
  atual.revisoes = Array.isArray(atual.revisoes) ? [...atual.revisoes] : []
  atual.timeline = Array.isArray(atual.timeline) ? [...atual.timeline] : []
  return { mapa, cen: atual }
}

async function _salvarCenario(projeto, govObj, com, mapa, cen, res) {
  mapa[cen.scenario_id] = cen
  com.cenarios_governanca = mapa
  projeto.governanca = { ...govObj, comercial: com }
  await projeto.save()
  res.json({ sucesso: true, scenario_id: cen.scenario_id, cenario: cen, comercial: projeto.governanca.comercial })
}

/**
 * POST /:id/governanca/comercial/cenario/freeze
 * Congela UM cenário (os demais permanecem editáveis).
 * Body: { scenario_id, snapshots:{comercial,financeiro,regulatorio}, hash, usuario }
 */
export const congelarCenarioComercial = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
    const { scenario_id, snapshots = {}, hash = null, usuario = null } = req.body || {}
    if (!scenario_id) return res.status(400).json({ erro: 'scenario_id é obrigatório' })

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const { mapa, cen } = _carregarCenarioGov(com, scenario_id)
    const agora = new Date()

    if (cen.freeze_status === 'CONGELADO') {
      return res.status(409).json({ erro: `Cenário ${scenario_id} já está CONGELADO — crie revisão para alterar.`, codigo: 'CENARIO_CONGELADO' })
    }

    cen.freeze_status = 'CONGELADO'
    cen.congelado_em = agora
    cen.hash = hash || cen.hash
    if (snapshots.comercial   != null) cen.snapshot_comercial   = snapshots.comercial
    if (snapshots.financeiro  != null) cen.snapshot_financeiro  = snapshots.financeiro
    if (snapshots.regulatorio != null) cen.snapshot_regulatorio = snapshots.regulatorio
    cen.timeline.push({ timestamp: agora, usuario, acao: 'congelamento', detalhe: `Cenário ${scenario_id} congelado individualmente.` })
    com.historico.push({ timestamp: agora, usuario, acao: 'cenario_congelado', detalhe: `Cenário ${scenario_id} congelado.` })

    await _salvarCenario(projeto, govObj, com, mapa, cen, res)
  } catch (err) {
    console.error('❌ Erro ao congelar cenário:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * PUT /:id/governanca/comercial/cenario/workflow
 * Workflow individual do cenário (valida transição na mesma máquina de estados).
 * Body: { scenario_id, status, usuario }
 */
export const workflowCenarioComercial = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
    const { scenario_id, status, usuario = null } = req.body || {}
    if (!scenario_id) return res.status(400).json({ erro: 'scenario_id é obrigatório' })
    if (!WORKFLOW_COMERCIAL.includes(status)) return res.status(400).json({ erro: `status inválido` })

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const { mapa, cen } = _carregarCenarioGov(com, scenario_id)
    const anterior = cen.workflow_status || 'EM_ANALISE'

    const val = _validarTransicaoComercial(anterior, status)
    if (!val.ok) return res.status(409).json({ erro: val.motivo, codigo: val.requer_revisao ? 'REQUER_REVISAO' : 'TRANSICAO_INVALIDA' })

    const agora = new Date()
    cen.workflow_status = status
    cen.status_juridico = _statusJuridicoDeEstado(status)
    if (CONGELADOS_COMERCIAL.includes(status)) { cen.freeze_status = 'CONGELADO'; cen.congelado_em = cen.congelado_em || agora }
    cen.timeline.push({ timestamp: agora, usuario, acao: 'workflow', detalhe: `Cenário ${scenario_id}: ${anterior} → ${status}.` })

    await _salvarCenario(projeto, govObj, com, mapa, cen, res)
  } catch (err) {
    console.error('❌ Erro no workflow do cenário:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * POST /:id/governanca/comercial/cenario/assinatura
 * Assinatura individual do cenário com IP real e cadeia de auditoria.
 * Body: { scenario_id, papel, nome, hash, hash_documento, hash_snapshot, hash_cenario, usuario }
 */
export const assinarCenarioComercial = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
    const { scenario_id, papel, nome, hash, hash_documento = null, hash_snapshot = null, hash_cenario = null, algoritmo = 'sha256', usuario = null } = req.body || {}
    const PAPEIS = ['cliente', 'vendedor', 'tecnico']
    if (!scenario_id) return res.status(400).json({ erro: 'scenario_id é obrigatório' })
    if (!PAPEIS.includes(papel)) return res.status(400).json({ erro: `papel deve ser: ${PAPEIS.join(', ')}` })
    if (!nome || !hash) return res.status(400).json({ erro: 'nome e hash são obrigatórios' })

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const { mapa, cen } = _carregarCenarioGov(com, scenario_id)
    const agora = new Date()
    const aud = _ipReal(req)
    const assinatura_id = `SIG-${scenario_id}-${papel.toUpperCase()}-${agora.getTime().toString(36)}`

    cen.assinaturas = cen.assinaturas.filter(a => a.papel !== papel)
    cen.assinaturas.push({
      assinatura_id, papel, nome, hash, algoritmo,
      hash_documento, hash_snapshot, hash_cenario,
      ip: aud.ip_real, ip_real: aud.ip_real, forwarded_for: aud.forwarded_for, proxy_chain: aud.proxy_chain,
      user_agent: aud.user_agent, timestamp: agora,
    })
    cen.timeline.push({ timestamp: agora, usuario: usuario || nome, acao: 'assinatura', detalhe: `Assinatura ${papel} (${nome}) no cenário ${scenario_id}. IP ${aud.ip_real || '—'}.` })

    const papeisAssinados = new Set(cen.assinaturas.map(a => a.papel))
    if (PAPEIS.every(p => papeisAssinados.has(p))) {
      cen.workflow_status = 'ASSINADO'
      cen.status_juridico = 'ASSINADO'
      cen.freeze_status = 'CONGELADO'
      cen.congelado_em = cen.congelado_em || agora
      cen.timeline.push({ timestamp: agora, usuario, acao: 'workflow', detalhe: `Cenário ${scenario_id} ASSINADO (todas as assinaturas).` })
    }

    await _salvarCenario(projeto, govObj, com, mapa, cen, res)
  } catch (err) {
    console.error('❌ Erro ao assinar cenário:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * POST /:id/governanca/comercial/cenario/revisao
 * Revisão individual do cenário (não afeta os outros cenários).
 * Body: { scenario_id, usuario, motivo }
 */
export const revisaoCenarioComercial = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
    const { scenario_id, usuario = null, motivo = null } = req.body || {}
    if (!scenario_id) return res.status(400).json({ erro: 'scenario_id é obrigatório' })

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const { mapa, cen } = _carregarCenarioGov(com, scenario_id)
    const agora = new Date()
    const revAtual = cen.revisao_atual || 'A'
    const novaRev = _proximaRevComercial(revAtual)

    cen.revisoes.push({
      rev: revAtual, timestamp: agora, usuario, motivo: motivo || 'Revisão de cenário',
      snapshot_comercial: cen.snapshot_comercial || null,
    })
    cen.revisao_atual = novaRev
    cen.freeze_status = 'EDITAVEL'
    cen.workflow_status = 'EM_ANALISE'
    cen.status_juridico = 'EM_REVISAO'
    cen.congelado_em = null
    cen.assinaturas = []
    cen.timeline.push({ timestamp: agora, usuario, acao: 'revisao', detalhe: `Cenário ${scenario_id}: revisão ${revAtual} → ${novaRev}. Reaberto.` })

    await _salvarCenario(projeto, govObj, com, mapa, cen, res)
  } catch (err) {
    console.error('❌ Erro na revisão do cenário:', err)
    res.status(500).json({ erro: err.message })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// S5 — CRM OPERACIONAL LEVE + COMUNICAÇÃO AUDITÁVEL
// Reutiliza governanca.comercial.historico como timeline ÚNICA (sem paralelas).
// ═══════════════════════════════════════════════════════════════════════════════

const CRM_PIPELINE = ['LEAD', 'QUALIFICADO', 'PROPOSTA', 'NEGOCIACAO', 'FECHADO', 'PERDIDO', 'IMPLANTACAO']

/**
 * PUT /:id/governanca/comercial/crm
 * Atualiza pipeline CRM e follow-up. Alimenta o historico (timeline única).
 * Body: { crm_pipeline, followup:{status,data,observacao}, usuario }
 */
export const atualizarCrm = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
    const { crm_pipeline = null, followup = null, usuario = null } = req.body || {}

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const agora = new Date()

    if (crm_pipeline) {
      if (!CRM_PIPELINE.includes(crm_pipeline)) return res.status(400).json({ erro: `crm_pipeline inválido` })
      const anterior = com.crm_pipeline || 'LEAD'
      com.crm_pipeline = crm_pipeline
      if (anterior !== crm_pipeline) {
        com.historico.push({ timestamp: agora, usuario, acao: 'crm_pipeline', detalhe: `Pipeline CRM: ${anterior} → ${crm_pipeline}.` })
      }
    }
    if (followup) {
      com.followup = {
        status: followup.status ?? com.followup?.status ?? null,
        data: followup.data ?? com.followup?.data ?? null,
        observacao: followup.observacao ?? com.followup?.observacao ?? null,
      }
      com.historico.push({ timestamp: agora, usuario, acao: 'followup', detalhe: `Follow-up: ${followup.status || ''}${followup.observacao ? ' — ' + followup.observacao : ''}.` })
    }

    projeto.governanca = { ...govObj, comercial: com }
    await projeto.save()
    res.json({ sucesso: true, comercial: projeto.governanca.comercial })
  } catch (err) {
    console.error('❌ Erro ao atualizar CRM:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * POST /:id/governanca/comercial/comunicacao
 * Registra uma comunicação auditável (whatsapp/email/share/followup).
 * Body: { canal, destinatario, cenario_id, revisao, snapshot_hash, resumo, usuario }
 */
export const registrarComunicacao = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
    const { canal, destinatario = null, cenario_id = null, revisao = null, snapshot_hash = null, resumo = null, usuario = null } = req.body || {}
    const CANAIS = ['whatsapp', 'email', 'compartilhamento', 'followup', 'outro']
    if (!CANAIS.includes(canal)) return res.status(400).json({ erro: `canal deve ser: ${CANAIS.join(', ')}` })

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const agora = new Date()
    const partes = [`Comunicação via ${canal}`]
    if (destinatario) partes.push(`para ${destinatario}`)
    if (cenario_id) partes.push(`cenário ${cenario_id}`)
    if (revisao) partes.push(`Rev ${revisao}`)
    if (resumo) partes.push(`— ${resumo}`)

    com.historico.push({
      timestamp: agora, usuario, acao: `comunicacao_${canal}`,
      detalhe: partes.join(' '),
      contexto: { canal, destinatario, cenario_id, revisao, snapshot_hash },
    })

    projeto.governanca = { ...govObj, comercial: com }
    await projeto.save()
    res.json({ sucesso: true, comercial: projeto.governanca.comercial })
  } catch (err) {
    console.error('❌ Erro ao registrar comunicação:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * POST /:id/governanca/comercial/compartilhar
 * Cria um link público seguro que abre o SNAPSHOT CONGELADO (somente leitura).
 * Engineering lock: exige snapshot congelado (global ou de cenário). Nunca dinâmico.
 * Body: { cenario_id, validade_dias, usuario }
 */
export const criarCompartilhamento = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
    const { cenario_id = null, validade_dias = 30, usuario = null } = req.body || {}

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)

    // Determina o snapshot congelado a compartilhar
    let snapshot = null, hash = null, revisao = com.revisao_comercial_atual || 'A', freezeOk = false
    if (cenario_id) {
      const cg = (com.cenarios_governanca || {})[cenario_id]
      if (cg && cg.freeze_status === 'CONGELADO') {
        snapshot = { tipo: 'cenario', cenario_id, comercial: cg.snapshot_comercial, financeiro: cg.snapshot_financeiro, regulatorio: cg.snapshot_regulatorio }
        hash = cg.hash || null
        revisao = cg.revisao_atual || revisao
        freezeOk = true
      }
    } else if (com.snapshot_comercial && CONGELADOS_COMERCIAL.includes(com.workflow_status)) {
      snapshot = { tipo: 'global', comercial: com.snapshot_comercial }
      hash = com.snapshot_comercial?.hash || null
      freezeOk = true
    }

    if (!freezeOk) {
      return res.status(409).json({
        erro: 'Congele a proposta (ou o cenário) antes de compartilhar. O link público sempre abre um snapshot congelado.',
        codigo: 'SEM_SNAPSHOT_CONGELADO',
      })
    }

    const agora = new Date()
    const token = `${id.slice(-6)}${agora.getTime().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    const share_id = `SHARE-${agora.getTime().toString(36)}`
    const validade = new Date(agora.getTime() + (Number(validade_dias) || 30) * 86400000)

    com.compartilhamentos = Array.isArray(com.compartilhamentos) ? [...com.compartilhamentos] : []
    com.compartilhamentos.push({
      share_id, token, cenario_id, revisao, snapshot_hash: hash,
      criado_em: agora, criado_por: usuario, validade, somente_leitura: true,
      snapshot,
      tracking: { visualizacoes: 0, primeiro_acesso: null, ultimo_acesso: null, acessos: [] },
    })
    com.historico.push({
      timestamp: agora, usuario, acao: 'comunicacao_compartilhamento',
      detalhe: `Link compartilhável criado${cenario_id ? ' (cenário ' + cenario_id + ')' : ''}, Rev ${revisao}, validade ${validade.toLocaleDateString('pt-BR')}.`,
      contexto: { share_id, cenario_id, revisao, snapshot_hash: hash },
    })

    projeto.governanca = { ...govObj, comercial: com }
    await projeto.save()
    res.json({ sucesso: true, share_id, token, validade, comercial: projeto.governanca.comercial })
  } catch (err) {
    console.error('❌ Erro ao criar compartilhamento:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * GET /api/publico/proposta/:token  (rota pública, sem auth)
 * Retorna o snapshot CONGELADO do compartilhamento e registra tracking leve.
 * NUNCA recalcula — apenas devolve o snapshot persistido.
 */
export const obterPropostaPublica = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { token } = req.params
    if (!token) return res.status(400).json({ erro: 'token ausente' })

    const projeto = await ProjetoFV.findOne(
      { 'governanca.comercial.compartilhamentos.token': token }
    )
      .populate('clienteId', 'nome email telefone')
      .populate('vendedor_id', 'nome telefone email')
      .populate('tecnico_principal_id', 'nome tipo_registro registro uf modalidade')
    if (!projeto) return res.status(404).json({ erro: 'Proposta não encontrada ou link inválido.' })

    const com = projeto.governanca?.comercial
    const share = (com?.compartilhamentos || []).find(s => s.token === token)
    if (!share) return res.status(404).json({ erro: 'Compartilhamento não encontrado.' })

    if (share.validade && new Date(share.validade) < new Date()) {
      return res.status(410).json({ erro: 'Este link expirou.', codigo: 'LINK_EXPIRADO', expirado_em: share.validade })
    }

    // Tracking leve
    const agora = new Date()
    const ip = _ipReal(req).ip_real
    share.tracking = share.tracking || { visualizacoes: 0, acessos: [] }
    share.tracking.visualizacoes = (share.tracking.visualizacoes || 0) + 1
    share.tracking.ultimo_acesso = agora
    if (!share.tracking.primeiro_acesso) share.tracking.primeiro_acesso = agora
    share.tracking.acessos = Array.isArray(share.tracking.acessos) ? share.tracking.acessos : []
    if (share.tracking.acessos.length < 200) share.tracking.acessos.push({ timestamp: agora, ip })
    projeto.markModified('governanca.comercial.compartilhamentos')
    await projeto.save()

    res.json({
      sucesso: true,
      somente_leitura: true,
      cliente: projeto.clienteId ? { nome: projeto.clienteId.nome } : null,
      projeto_nome: projeto.nome,
      // S7.1: identidade institucional congelada (logo/nome/RT)
      empresa: projeto.governanca?.snapshot_empresa ?? null,
      responsavel_tecnico: projeto.governanca?.snapshot_tecnico_identificacao ?? null,
      // S7.2.1: equipe responsável (técnico/vendedor do projeto)
      vendedor: projeto.vendedor_id ? { nome: projeto.vendedor_id.nome } : null,
      tecnico: projeto.tecnico_principal_id ? {
        nome: projeto.tecnico_principal_id.nome,
        registro: `${projeto.tecnico_principal_id.tipo_registro || ''} ${projeto.tecnico_principal_id.registro || ''}`.trim(),
      } : null,
      cenario_id: share.cenario_id,
      revisao: share.revisao,
      snapshot_hash: share.snapshot_hash,
      criado_em: share.criado_em,
      validade: share.validade,
      snapshot: share.snapshot,   // snapshot congelado — fonte única de verdade
    })
  } catch (err) {
    console.error('❌ Erro ao obter proposta pública:', err)
    res.status(500).json({ erro: err.message })
  }
}
