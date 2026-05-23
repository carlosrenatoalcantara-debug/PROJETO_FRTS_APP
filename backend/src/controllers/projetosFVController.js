import { ProjetoFV } from '../models/ProjetoFV.js'
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

    // Sempre atualiza workflow.ultima_atividade e schema_version
    $set['workflow.ultima_atividade'] = new Date()
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
