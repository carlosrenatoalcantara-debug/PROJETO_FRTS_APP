import { ProjetoFV } from '../models/ProjetoFV.js'
import { Equipamento } from '../models/Equipamento.js'
import mongoose from 'mongoose'
import { memoryStore } from '../config/memoryStorage.js'

export const listarProjetosFV = async (_req, res) => {
  try {
    let projetos
    if (mongoose.connection.readyState === 1) {
      projetos = await ProjetoFV.find().populate('clienteId').sort({ createdAt: -1 })
    } else {
      // Memory storage fallback
      projetos = memoryStore.findAllProjetoFV().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      // Enriquecer com dados do cliente
      projetos = projetos.map(p => ({
        ...p,
        clienteId: memoryStore.findClienteById(p.clienteId)
      }))
    }
    console.log(`✓ GET /api/projetos-fv - Listando ${projetos.length} projetos`)
    res.json(projetos)
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
    res.json(p)
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

export const excluirProjetoFV = async (req, res) => {
  try {
    let projeto
    if (mongoose.connection.readyState === 1) {
      projeto = await ProjetoFV.findByIdAndDelete(req.params.id)
    } else {
      // Memory storage fallback
      projeto = memoryStore.deleteProjetoFV(req.params.id)
    }
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    console.log('✓ Projeto FV excluído:', req.params.id)
    res.status(204).end()
  } catch (err) {
    console.error('❌ Erro ao excluir projeto FV:', err)
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

    // Monta o subdoc de governança congelado
    const novaGovernanca = {
      ...((projeto.governanca && projeto.governanca.toObject?.()) || gov),
      engineering_version: engineering_version || gov.engineering_version || null,
      freeze_status: novo_status,
      revisao_atual: revAtual,
      congelado_em: agora,
      congelado_por: usuario,
      snapshot_tecnico:    snapshots.tecnico    ?? gov.snapshot_tecnico    ?? null,
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
        tecnico:    novaGovernanca.snapshot_tecnico,
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

const WORKFLOW_COMERCIAL = ['EM_ANALISE', 'AGUARDANDO_CLIENTE', 'NEGOCIACAO', 'APROVADO', 'REPROVADO', 'ASSINADO']

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
      desconto_pct, desconto_limite_pct, congelar = false, usuario = null } = req.body || {}

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const agora = new Date()

    if (com.workflow_status === 'ASSINADO') {
      return res.status(409).json({ erro: 'Proposta ASSINADA — crie uma revisão comercial antes de alterar.', codigo: 'COMERCIAL_ASSINADO' })
    }

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

    const { status, usuario = null } = req.body || {}
    if (!WORKFLOW_COMERCIAL.includes(status)) {
      return res.status(400).json({ erro: `status deve ser um de: ${WORKFLOW_COMERCIAL.join(', ')}` })
    }

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const agora = new Date()
    const anterior = com.workflow_status || 'EM_ANALISE'

    com.workflow_status = status
    if (status === 'ASSINADO') com.congelado_em = com.congelado_em || agora
    com.historico.push({
      timestamp: agora, usuario, acao: 'workflow_alterado',
      detalhe: `Workflow comercial: ${anterior} → ${status}.`,
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

    const { papel, nome, hash, usuario = null } = req.body || {}
    const PAPEIS = ['cliente', 'vendedor', 'tecnico']
    if (!PAPEIS.includes(papel)) return res.status(400).json({ erro: `papel deve ser: ${PAPEIS.join(', ')}` })
    if (!nome || !hash) return res.status(400).json({ erro: 'nome e hash são obrigatórios' })

    const projeto = await ProjetoFV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const agora = new Date()

    // Substitui assinatura existente do mesmo papel (re-assinatura)
    com.assinaturas = com.assinaturas.filter(a => a.papel !== papel)
    com.assinaturas.push({ papel, nome, hash, timestamp: agora })
    com.historico.push({ timestamp: agora, usuario: usuario || nome, acao: 'assinatura', detalhe: `Assinatura ${papel}: ${nome}.` })

    // Se as três assinaturas estão presentes, marca ASSINADO
    const papeisAssinados = new Set(com.assinaturas.map(a => a.papel))
    if (PAPEIS.every(p => papeisAssinados.has(p))) {
      com.workflow_status = 'ASSINADO'
      com.congelado_em = com.congelado_em || agora
      com.historico.push({ timestamp: agora, usuario, acao: 'workflow_alterado', detalhe: 'Workflow comercial: ASSINADO (todas as assinaturas coletadas).' })
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
