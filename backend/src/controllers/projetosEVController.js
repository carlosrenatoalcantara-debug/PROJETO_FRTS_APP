import { ProjetoEV } from '../models/ProjetoEV.js'
import mongoose from 'mongoose'
import { gerarPDFUnifilarStream } from '../utils/gerarPDFUnifilar.js'
import { memoryStore } from '../config/memoryStorage.js'
import { executarCalculosProjetoEV, obterModoOperacao, obterEspecificacaoConector } from '../utils/calculosCarregadorEV.js'

const usarMemoryStorage = () => mongoose.connection.readyState !== 1

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
        clienteId,
        nome,
        tipo_carregamento: tipo_carregamento || 'AC',
        status: 'rascunho',
      })
      console.log('✓ Projeto EV criado em memória:', novo._id)
      res.status(201).json(novo)
      return
    }

    if (!mongoose.Types.ObjectId.isValid(clienteId)) {
      return res.status(400).json({ erro: 'ClienteId inválido' })
    }

    const novo = new ProjetoEV({
      clienteId,
      nome,
      tipo_carregamento: tipo_carregamento || 'AC',
      status: 'rascunho',
    })

    await novo.save()
    await novo.populate('clienteId')
    console.log('✓ Projeto EV criado:', novo._id)
    res.status(201).json(novo)
  } catch (err) {
    console.error('❌ Erro ao criar projeto EV:', err)
    // Fallback
    try {
      const novo = memoryStore.createProjetoEV({
        clienteId: req.body.clienteId,
        nome: req.body.nome,
        tipo_carregamento: req.body.tipo_carregamento || 'AC',
        status: 'rascunho',
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
