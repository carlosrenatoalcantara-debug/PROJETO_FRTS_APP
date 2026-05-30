import { ProjetoEV } from '../models/ProjetoEV.js'
import { CarregadorEV } from '../models/CarregadorEV.js'
import { AuditLog } from '../models/AuditLog.js'
import mongoose from 'mongoose'
import { gerarPDFUnifilarStream } from '../utils/gerarPDFUnifilar.js'
import { memoryStore } from '../config/memoryStorage.js'
import { executarCalculosProjetoEV, obterModoOperacao, obterEspecificacaoConector } from '../utils/calculosCarregadorEV.js'

const usarMemoryStorage = () => mongoose.connection.readyState !== 1

// EV-ALIGN-01: auditoria centralizada (mesmo padrão FV/catálogo)
async function _auditarEV(req, acao, alvo, detalhe = null) {
  try {
    if (mongoose.connection.readyState !== 1) return
    await AuditLog.create({
      timestamp: new Date(),
      usuario: req.auth?.id || req.auth?.email || req.body?.usuario || 'anonymous',
      perfil: req.auth?.perfil || null, empresa: req.auth?.empresa_id || null,
      modulo: 'ev', acao, metodo: 'EVENT',
      path: `${alvo}${detalhe ? ' ' + String(detalhe).slice(0, 200) : ''}`,
      status: 200,
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null,
    })
  } catch { /* silencioso */ }
}

// EV-ALIGN-01: cria snapshot imutável do carregador vinculado ao projeto.
// Equivalente ao snapshot_responsavel_tecnico do ProjetoFV — guarda apenas
// referências + specs críticas (NÃO duplica documentos).
export const vincularCarregadorEV = async (req, res) => {
  try {
    if (usarMemoryStorage()) return res.status(503).json({ erro: 'DB_OFFLINE' })
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
    const projeto = await ProjetoEV.findById(id)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { carregador_id } = req.body || {}
    if (!carregador_id || !mongoose.Types.ObjectId.isValid(carregador_id)) {
      return res.status(400).json({ erro: 'carregador_id obrigatório (ObjectId válido)' })
    }
    const car = await CarregadorEV.findById(carregador_id).lean()
    if (!car) return res.status(404).json({ erro: 'Carregador não encontrado' })

    const usuario = req.auth?.id || req.auth?.email || req.body?.usuario || 'anonymous'
    const snapshot = {
      carregador_id: car._id,
      equipamento_id: car.equipamento_id || null,
      fabricante: car.marca || null,
      modelo: car.modelo || null,
      potencia_kw: car.potencia_kw || null,
      corrente_max_a: car.corrente_entrada_a || null,
      tensao_v: car.tensao_entrada_v || null,
      tipo_conector: car.tipo_conector || null,
      fases: car.numero_fases || null,
      datasheet_hash: car.datasheet_hash || null,
      datasheet_url: car.datasheet_url || null,
      documento_id: car.documento_id || null,
      data_snapshot: new Date(),
      por: usuario,
    }
    projeto.snapshot_carregador = snapshot
    projeto.markModified('snapshot_carregador')
    await projeto.save()
    _auditarEV(req, 'CARREGADOR_EV_VINCULADO', `projeto:${id}`, `carregador:${car._id} ${car.marca} ${car.modelo}`)
    res.json({ sucesso: true, snapshot_carregador: snapshot })
  } catch (err) {
    console.error('❌ Erro vincular carregador EV:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const listarProjetosEV = async (_req, res) => {
  try {
    let projetos

    if (usarMemoryStorage()) {
      console.log('⚠️  Usando armazenamento em memória (MongoDB indisponível)')
      projetos = memoryStore.findAllProjetoEV()
    } else {
      projetos = await ProjetoEV.find().populate('clienteId').sort({ createdAt: -1 })
    }

    console.log(`✓ GET /api/projetos-ev - Listando ${projetos.length} projetos EV`)
    res.json(projetos)
  } catch (err) {
    console.error('❌ Erro ao listar projetos EV:', err)
    // Fallback para memória em caso de erro
    try {
      const projetos = memoryStore.findAllProjetoEV()
      res.json(projetos)
    } catch (memErr) {
      res.status(500).json({ erro: err.message })
    }
  }
}

export const buscarProjetoEV = async (req, res) => {
  try {
    let p

    if (usarMemoryStorage()) {
      p = memoryStore.findProjetoEV(req.params.id)
    } else {
      p = await ProjetoEV.findById(req.params.id).populate('clienteId')
    }

    if (!p) return res.status(404).json({ mensagem: 'Projeto não encontrado' })

    // Auto-calcular calculos_nbr se estiver vazio ou faltando campos essenciais (DPS, tempo_seccionamento)
    const camposEssenciais = ['dps_kv', 'dps_capacidade_a', 'tempo_seccionamento_s']
    const faltamCampos = !p.calculos_nbr ||
                         camposEssenciais.some(campo => !(campo in (p.calculos_nbr || {})))

    if (faltamCampos) {
      if (p.carregadores && p.carregadores.length > 0) {
        console.log('📊 Auto-calculando NBR para projeto:', req.params.id)
        try {
          const resultados = executarCalculosProjetoEV(p.toObject ? p.toObject() : p)
          if (!resultados.erro && resultados.calculos_nbr) {
            p.calculos_nbr = resultados.calculos_nbr
            // Se não está em memory storage, salvar no MongoDB
            if (!usarMemoryStorage()) {
              await ProjetoEV.findByIdAndUpdate(req.params.id, { calculos_nbr: resultados.calculos_nbr })
            }
          }
        } catch (calcErr) {
          console.warn('⚠️  Erro ao auto-calcular NBR:', calcErr.message)
          // Continua mesmo com erro nos cálculos
        }
      }
    }

    res.json(p)
  } catch (err) {
    console.error('❌ Erro ao buscar projeto EV:', err)
    // Tenta memória como fallback
    const p = memoryStore.findProjetoEV(req.params.id)
    if (!p) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    res.json(p)
  }
}

export const criarProjetoEV = async (req, res) => {
  try {
    const { clienteId, nome, tipo_carregamento } = req.body

    if (!clienteId || !nome) {
      return res.status(400).json({ erro: 'Campos clienteId e nome são obrigatórios' })
    }

    if (usarMemoryStorage()) {
      console.log('⚠️  Criando projeto em memória')
      const novo = memoryStore.createProjetoEV({
        ...req.body,
        clienteId,
        nome,
        tipo_carregamento: tipo_carregamento || 'AC',
        status: req.body.status || 'rascunho',
      })
      console.log('✓ Projeto EV criado em memória:', novo._id)
      res.status(201).json(novo)
      return
    }

    if (!mongoose.Types.ObjectId.isValid(clienteId)) {
      return res.status(400).json({ erro: 'ClienteId inválido' })
    }

    // Construir objeto com todos os dados que chegam do frontend
    const novoProjetoData = {
      clienteId,
      nome,
      tipo_carregamento: tipo_carregamento || 'AC',
      status: req.body.status || 'rascunho',
      // Incluir todos os dados adicionais enviados pelo frontend
      ...(req.body.endereco_completo && { endereco_completo: req.body.endereco_completo }),
      ...(req.body.latitude && { latitude: req.body.latitude }),
      ...(req.body.longitude && { longitude: req.body.longitude }),
      ...(req.body.carregadores && { carregadores: req.body.carregadores }),
      ...(req.body.quantidade_pontos && { quantidade_pontos: req.body.quantidade_pontos }),
      ...(req.body.potencia_total_kw && { potencia_total_kw: req.body.potencia_total_kw }),
      ...(req.body.comprimento_cabo_m && { comprimento_cabo_m: req.body.comprimento_cabo_m }),
      ...(req.body.calculos_nbr && { calculos_nbr: req.body.calculos_nbr }),
      ...(req.body.tecnico && { tecnico: req.body.tecnico }),
      ...(req.body.modo_operacao && { modo_operacao: req.body.modo_operacao }),
      ...(req.body.fases && { fases: req.body.fases }),
      ...(req.body.tensao_sistema && { tensao_sistema: req.body.tensao_sistema }),
    }

    const novo = new ProjetoEV(novoProjetoData)

    await novo.save()
    await novo.populate('clienteId')

    console.log('✓ Projeto EV criado:', novo._id, {
      nome: novo.nome,
      quantidade_pontos: novo.quantidade_pontos,
      potencia_total_kw: novo.potencia_total_kw,
      carregadores: novo.carregadores?.length || 0,
    })
    // EV-ALIGN-01: audit
    _auditarEV(req, 'PROJETO_EV_CRIADO', `projeto:${novo._id}`, `nome=${novo.nome} pts=${novo.quantidade_pontos}`)
    res.status(201).json(novo)
  } catch (err) {
    console.error('❌ Erro ao criar projeto EV:', err)
    // Fallback
    try {
      const novo = memoryStore.createProjetoEV({
        ...req.body,
        clienteId: req.body.clienteId,
        nome: req.body.nome,
        tipo_carregamento: req.body.tipo_carregamento || 'AC',
        status: req.body.status || 'rascunho',
      })
      res.status(201).json(novo)
    } catch (memErr) {
      res.status(500).json({ erro: err.message })
    }
  }
}

export const atualizarProjetoEV = async (req, res) => {
  try {
    if (usarMemoryStorage()) {
      const projeto = memoryStore.updateProjetoEV(req.params.id, req.body)
      if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
      console.log('✓ Projeto EV atualizado em memória:', req.params.id)
      res.json(projeto)
      return
    }

    // Buscar projeto atual para comparação
    const projetoAtual = await ProjetoEV.findById(req.params.id)
    if (!projetoAtual) return res.status(404).json({ mensagem: 'Projeto não encontrado' })

    // Merge dos dados
    const dadosAtualizacao = { ...req.body }

    // Se carregadores são atualizados, recalcular quantidade_pontos e potencia_total_kw
    if (dadosAtualizacao.carregadores && Array.isArray(dadosAtualizacao.carregadores)) {
      const quantidade_pontos = dadosAtualizacao.carregadores.length
      const potencia_total_kw = dadosAtualizacao.carregadores.reduce(
        (sum, c) => sum + ((c.potencia_kw || 0) * (c.quantidade || 1)),
        0
      )
      dadosAtualizacao.quantidade_pontos = quantidade_pontos
      dadosAtualizacao.potencia_total_kw = potencia_total_kw
      console.log(`✓ Recalculados: ${quantidade_pontos} pontos, ${potencia_total_kw}kW`)
    }

    // Verificar se há mudanças nos campos que requerem recálculo
    const requerCalculos =
      dadosAtualizacao.carregadores ||
      dadosAtualizacao.tensao_sistema ||
      dadosAtualizacao.comprimento_cabo_m ||
      dadosAtualizacao.resistencia_aterramento_ohms ||
      dadosAtualizacao.modo_operacao

    // Se requer cálculos, executar
    if (requerCalculos) {
      const dadosParaCalculo = {
        ...projetoAtual.toObject(),
        ...dadosAtualizacao,
      }

      try {
        const resultados = executarCalculosProjetoEV(dadosParaCalculo)
        if (!resultados.erro) {
          dadosAtualizacao.calculos_nbr = resultados.calculos_nbr
          dadosAtualizacao.conformidade_norms = resultados.conformidade_norms

          // Atualizar informações de aterramento
          if (resultados.detalhes.aterramento) {
            dadosAtualizacao.resistencia_aterramento_conformidade = resultados.detalhes.aterramento.status
          }

          console.log('✓ Cálculos NBR executados automaticamente')
        }
      } catch (calcErr) {
        console.error('⚠️  Erro ao executar cálculos automáticos:', calcErr)
        // Continua mesmo com erro nos cálculos
      }
    }

    const projeto = await ProjetoEV.findByIdAndUpdate(req.params.id, dadosAtualizacao, { new: true }).populate('clienteId')
    console.log('✓ Projeto EV atualizado:', req.params.id)
    // EV-ALIGN-01: audit (alteração de carregadores → evento específico)
    if (dadosAtualizacao.carregadores) {
      _auditarEV(req, 'CARREGADOR_EV_ALTERADO', `projeto:${req.params.id}`, `pontos=${dadosAtualizacao.quantidade_pontos} pot=${dadosAtualizacao.potencia_total_kw}kW`)
    } else {
      _auditarEV(req, 'PROJETO_EV_ATUALIZADO', `projeto:${req.params.id}`, Object.keys(dadosAtualizacao).slice(0, 5).join(','))
    }
    res.json(projeto)
  } catch (err) {
    console.error('❌ Erro ao atualizar projeto EV:', err)
    // Fallback
    try {
      const projeto = memoryStore.updateProjetoEV(req.params.id, req.body)
      if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
      res.json(projeto)
    } catch (memErr) {
      res.status(500).json({ erro: err.message })
    }
  }
}

export const excluirProjetoEV = async (req, res) => {
  try {
    if (usarMemoryStorage()) {
      const projeto = memoryStore.deleteProjetoEV(req.params.id)
      if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
      console.log('✓ Projeto EV excluído em memória:', req.params.id)
      res.status(204).end()
      return
    }

    const projeto = await ProjetoEV.findByIdAndDelete(req.params.id)
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    console.log('✓ Projeto EV excluído:', req.params.id)
    res.status(204).end()
  } catch (err) {
    console.error('❌ Erro ao excluir projeto EV:', err)
    // Fallback
    try {
      const projeto = memoryStore.deleteProjetoEV(req.params.id)
      if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
      res.status(204).end()
    } catch (memErr) {
      res.status(500).json({ erro: err.message })
    }
  }
}

export const listarProjetosEVPorCliente = async (req, res) => {
  try {
    const { clienteId } = req.params

    if (usarMemoryStorage()) {
      const projetosDocliente = memoryStore.findProjetoEVByCliente(clienteId)
      console.log(`✓ Listando ${projetosDocliente.length} projetos EV do cliente ${clienteId} em memória`)
      res.json(projetosDocliente)
      return
    }

    if (!mongoose.Types.ObjectId.isValid(clienteId)) {
      return res.status(400).json({ erro: 'ClienteId inválido' })
    }
    const projetosDocliente = await ProjetoEV.find({ clienteId }).sort({ createdAt: -1 })
    console.log(`✓ Listando ${projetosDocliente.length} projetos EV do cliente ${clienteId}`)
    res.json(projetosDocliente)
  } catch (err) {
    console.error('❌ Erro ao listar projetos EV por cliente:', err)
    // Fallback
    try {
      const projetosDocliente = memoryStore.findProjetoEVByCliente(req.params.clienteId)
      res.json(projetosDocliente)
    } catch (memErr) {
      res.status(500).json({ erro: err.message })
    }
  }
}

export const calcularNormasProjetoEV = async (req, res) => {
  try {
    const { id } = req.params
    const dadosAtualizacao = req.body

    let projeto

    if (usarMemoryStorage()) {
      projeto = memoryStore.findProjetoEV(id)
      if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    } else {
      projeto = await ProjetoEV.findById(id)
      if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    }

    // Mesclar dados para cálculo
    const dadosParaCalculo = {
      ...projeto.toObject ? projeto.toObject() : projeto,
      ...dadosAtualizacao,
    }

    // Executar cálculos
    const resultados = executarCalculosProjetoEV(dadosParaCalculo)

    if (resultados.erro) {
      return res.status(400).json({ erro: resultados.erro })
    }

    res.json({
      calculos_nbr: resultados.calculos_nbr,
      conformidade_norms: resultados.conformidade_norms,
      detalhes: resultados.detalhes,
    })
  } catch (err) {
    console.error('❌ Erro ao calcular normas:', err)
    res.status(500).json({ erro: err.message })
  }
}

export const exportarPDFProjetoEV = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ erro: 'ID do projeto inválido' })
    }

    const projeto = await ProjetoEV.findById(id).populate('clienteId')
    if (!projeto) {
      return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    }

    // Dados do técnico
    const tecnico = projeto.tecnico || {}

    // Gerar PDF
    const doc = gerarPDFUnifilarStream(projeto, projeto.clienteId, tecnico)

    // Configurar resposta
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Unifilar_${projeto.nome.replace(/\s+/g, '_')}.pdf"`
    )

    // Enviar PDF
    doc.pipe(res)
    doc.end()

    console.log(`✓ PDF gerado para projeto: ${projeto.nome}`)
  } catch (err) {
    console.error('❌ Erro ao gerar PDF:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * POST /api/projetos-ev/manutencao/recalcular-potencias
 * Recalcular quantidade_pontos e potencia_total_kw de todos os projetos
 * Útil para corrigir dados históricos
 */
export const recalcularPotenciasProjetosEV = async (_req, res) => {
  try {
    if (usarMemoryStorage()) {
      return res.status(503).json({ erro: 'MongoDB não disponível para esta operação' })
    }

    const projetos = await ProjetoEV.find({ carregadores: { $exists: true, $ne: [] } })

    let atualizados = 0
    let erros = 0

    for (const projeto of projetos) {
      try {
        const quantidade_pontos = projeto.carregadores.length
        const potencia_total_kw = projeto.carregadores.reduce(
          (sum, c) => sum + ((c.potencia_kw || 0) * (c.quantidade || 1)),
          0
        )

        if (projeto.quantidade_pontos !== quantidade_pontos || projeto.potencia_total_kw !== potencia_total_kw) {
          await ProjetoEV.findByIdAndUpdate(projeto._id, {
            quantidade_pontos,
            potencia_total_kw,
          })
          atualizados++
          console.log(`✓ Atualizado ${projeto.nome}: ${quantidade_pontos} pontos, ${potencia_total_kw}kW`)
        }
      } catch (err) {
        erros++
        console.error(`❌ Erro ao atualizar ${projeto.nome}:`, err.message)
      }
    }

    res.json({
      mensagem: 'Recalculu concluído',
      total_projetos: projetos.length,
      atualizados,
      erros,
    })
  } catch (err) {
    console.error('❌ Erro ao recalcular potências:', err)
    res.status(500).json({ erro: err.message })
  }
}
