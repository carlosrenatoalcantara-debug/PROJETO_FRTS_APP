import { importarCatalogoDeSolarMarket } from '../importadores/importadorSolarMarket.js'
import {
  executarManutencaoCompleta,
  arquivarLeadsAntigos,
  compactarDadosAntigos,
  relatorioWinRate,
} from '../utils/arquivamentoPolicy.js'

export async function importarSolarMarket(req, res) {
  try {
    // Validar API key do admin
    const adminKey = req.headers['x-admin-key']
    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(403).json({ erro: 'Acesso negado' })
    }

    const resultado = await importarCatalogoDeSolarMarket()
    res.json(resultado)
  } catch (err) {
    console.error('Erro na importação:', err)
    res.status(500).json({ erro: err.message })
  }
}

export async function statusImportacao(req, res) {
  try {
    // Retornar status da última importação
    // Em produção, buscar do banco de dados
    res.json({
      ultimaImportacao: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 dias atrás (mock)
      total: {
        modulos: 500,
        inversores: 150,
        estruturas: 30,
      },
      statusSolarMarket: 'Ativo (importação automática desabilitada)',
    })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
}

// ========== MANUTENÇÃO DO SISTEMA ==========
function validarChaveAdmin(req) {
  const chaveAdmin = req.headers['x-admin-key']
  return chaveAdmin && chaveAdmin === process.env.ADMIN_API_KEY
}

export async function executarManutencao(req, res) {
  try {
    if (!validarChaveAdmin(req)) {
      return res.status(403).json({ erro: 'Acesso negado' })
    }

    console.log('🔧 Executando manutenção completa via API...')
    await executarManutencaoCompleta()

    res.json({
      sucesso: true,
      mensagem: 'Manutenção executada com sucesso',
      tarefas: [
        'Arquivamento de leads antigos',
        'Compactação de dados',
        'Geração de relatório trimestral',
      ],
    })
  } catch (erro) {
    console.error('❌ Erro ao executar manutenção:', erro.message)
    res.status(500).json({ erro: erro.message })
  }
}

export async function arquivarLeads(req, res) {
  try {
    if (!validarChaveAdmin(req)) {
      return res.status(403).json({ erro: 'Acesso negado' })
    }

    console.log('📦 Arquivando leads antigos via API...')
    await arquivarLeadsAntigos()

    res.json({
      sucesso: true,
      mensagem: 'Leads antigos arquivados com sucesso',
    })
  } catch (erro) {
    console.error('❌ Erro ao arquivar leads:', erro.message)
    res.status(500).json({ erro: erro.message })
  }
}

export async function compactarDados(req, res) {
  try {
    if (!validarChaveAdmin(req)) {
      return res.status(403).json({ erro: 'Acesso negado' })
    }

    const { diasThreshold = 180 } = req.body

    console.log(`💾 Compactando dados (> ${diasThreshold} dias) via API...`)
    await compactarDadosAntigos(diasThreshold)

    res.json({
      sucesso: true,
      mensagem: `Dados antigos (> ${diasThreshold} dias) compactados com sucesso`,
    })
  } catch (erro) {
    console.error('❌ Erro ao compactar dados:', erro.message)
    res.status(500).json({ erro: erro.message })
  }
}

export async function relatorio(req, res) {
  try {
    if (!validarChaveAdmin(req)) {
      return res.status(403).json({ erro: 'Acesso negado' })
    }

    console.log('📊 Gerando relatório de win rate via API...')
    await relatorioWinRate()

    res.json({
      sucesso: true,
      mensagem: 'Relatório gerado com sucesso (verifique os logs)',
    })
  } catch (erro) {
    console.error('❌ Erro ao gerar relatório:', erro.message)
    res.status(500).json({ erro: erro.message })
  }
}
