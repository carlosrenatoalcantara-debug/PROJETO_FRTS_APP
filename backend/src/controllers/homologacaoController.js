import {
  gerarMemorialDescritivo,
  gerarCartaConcessionaria,
  gerarDadosART,
  gerarChecklistDocumentos,
} from '../services/memorialDescritivoService.js'

// Mock database - em produção usar banco real
const homologacoesDB = new Map()

export async function gerarMemorial(req, res) {
  try {
    const { projetoId } = req.params
    const { projeto, cliente } = req.body

    if (!projeto || !cliente) {
      return res.status(400).json({ erro: 'Dados do projeto e cliente obrigatórios' })
    }

    const memorial = gerarMemorialDescritivo(projeto, cliente)

    res.json({
      sucesso: true,
      tipo: 'memorial_descritivo',
      conteudo: memorial,
      data_geracao: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Erro ao gerar memorial:', err)
    res.status(500).json({ erro: err.message })
  }
}

export async function gerarCarta(req, res) {
  try {
    const { projetoId } = req.params
    const { projeto, cliente } = req.body

    if (!projeto || !cliente) {
      return res.status(400).json({ erro: 'Dados do projeto e cliente obrigatórios' })
    }

    const carta = gerarCartaConcessionaria(projeto, cliente)

    res.json({
      sucesso: true,
      tipo: 'carta_concessionaria',
      conteudo: carta,
      data_geracao: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Erro ao gerar carta:', err)
    res.status(500).json({ erro: err.message })
  }
}

export async function obterDadosART(req, res) {
  try {
    const { projetoId } = req.params
    const { projeto } = req.body

    if (!projeto) {
      return res.status(400).json({ erro: 'Dados do projeto obrigatórios' })
    }

    const dadosART = gerarDadosART(projeto, {})

    res.json({
      sucesso: true,
      tipo: 'dados_art',
      dados: dadosART,
      data_geracao: new Date().toISOString(),
      observacoes: {
        1: 'Acesse o site do CREA de sua região para registrar a ART',
        2: 'Potência ≤ 5kWp geralmente tem custo menor',
        3: 'ART deve ser registrada ANTES da instalação iniciar',
      },
    })
  } catch (err) {
    console.error('Erro ao obter dados ART:', err)
    res.status(500).json({ erro: err.message })
  }
}

export async function obterChecklist(req, res) {
  try {
    const { projetoId } = req.params
    const { estado, concessionaria } = req.query

    const checklist = gerarChecklistDocumentos(estado, concessionaria)

    res.json({
      sucesso: true,
      tipo: 'checklist_documentos',
      checklist,
    })
  } catch (err) {
    console.error('Erro ao obter checklist:', err)
    res.status(500).json({ erro: err.message })
  }
}

export async function atualizarChecklist(req, res) {
  try {
    const { projetoId } = req.params
    const { documentos, observacoes, status } = req.body

    if (!documentos) {
      return res.status(400).json({ erro: 'Lista de documentos obrigatória' })
    }

    // Salvar em "banco" (em produção, seria no MongoDB)
    const chave = `homologacao:${projetoId}`
    homologacoesDB.set(chave, {
      projetoId,
      documentos,
      observacoes,
      status: status || 'rascunho',
      data_atualizacao: new Date().toISOString(),
    })

    const totalDocs = documentos.length
    const docsConcluidos = documentos.filter(d => d.concluido).length

    res.json({
      sucesso: true,
      documentos,
      status: status || 'rascunho',
      progresso: {
        concluidos: docsConcluidos,
        total: totalDocs,
        percentual: ((docsConcluidos / totalDocs) * 100).toFixed(0),
      },
      data_atualizacao: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Erro ao atualizar checklist:', err)
    res.status(500).json({ erro: err.message })
  }
}

export async function atualizarStatusHomologacao(req, res) {
  try {
    const { projetoId } = req.params
    const { status, data_envio, data_aprovacao, art_numero, observacoes } = req.body

    if (!status) {
      return res.status(400).json({ erro: 'Status obrigatório' })
    }

    const statusValidos = ['rascunho', 'enviado', 'analise', 'aprovado', 'conectado']
    if (!statusValidos.includes(status)) {
      return res.status(400).json({ erro: `Status inválido. Opções: ${statusValidos.join(', ')}` })
    }

    const chave = `homologacao:${projetoId}`
    const homologacao = homologacoesDB.get(chave) || {}

    const homologacaoAtualizada = {
      projetoId,
      status,
      data_envio: data_envio || homologacao.data_envio,
      data_aprovacao: data_aprovacao || homologacao.data_aprovacao,
      art_numero: art_numero || homologacao.art_numero,
      observacoes: observacoes || homologacao.observacoes,
      data_atualizacao: new Date().toISOString(),
    }

    homologacoesDB.set(chave, homologacaoAtualizada)

    res.json({
      sucesso: true,
      homologacao: homologacaoAtualizada,
      mensagem: `Status atualizado para: ${status}`,
    })
  } catch (err) {
    console.error('Erro ao atualizar status:', err)
    res.status(500).json({ erro: err.message })
  }
}

export async function obterStatusHomologacao(req, res) {
  try {
    const { projetoId } = req.params

    const chave = `homologacao:${projetoId}`
    const homologacao = homologacoesDB.get(chave) || {
      projetoId,
      status: 'rascunho',
      documentos: [],
      data_criacao: new Date().toISOString(),
    }

    res.json({
      sucesso: true,
      homologacao,
    })
  } catch (err) {
    console.error('Erro ao obter status:', err)
    res.status(500).json({ erro: err.message })
  }
}

export async function testarFreezimento(req, res) {
  try {
    const { cliente, unidade, consumo, projeto, concessionariaProfile } = req.body

    if (!cliente || !unidade || !consumo || !projeto) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Dados incompletos: cliente, unidade, consumo, projeto obrigatórios',
      })
    }

    // Import the DTO creation and test functions
    const { createHomologacaoDTO, testHomologacaoImmutability } = await import('../importadores/homologacaoDTO.js')

    // Create frozen DTO
    const frozenDTO = createHomologacaoDTO(cliente, unidade, consumo, projeto, concessionariaProfile)

    // Run immutability attack tests
    const attackResults = testHomologacaoImmutability(frozenDTO)

    res.json({
      sucesso: true,
      tipo: 'homologacao_freeze_test',
      homologacaoDTO: frozenDTO,
      freezeTests: attackResults,
      verdict: attackResults.testsFailed === 0 ? 'FREEZE_SUCCESSFUL' : 'FREEZE_COMPROMISED',
      data_teste: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Erro ao testar freezimento:', err)
    res.status(500).json({
      sucesso: false,
      erro: err.message,
      tipo: 'homologacao_freeze_error',
    })
  }
}
