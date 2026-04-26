// Política de arquivamento e retenção de dados
import cron from 'node-cron'
import { CrmLead } from '../models/CrmLead.js'
import { CrmFunil } from '../models/CrmFunil.js'
import { CrmColuna } from '../models/CrmColuna.js'

/**
 * Arquiva leads antigos que não foram atualizados há 6 meses
 */
export async function arquivarLeadsAntigos() {
  try {
    const seisMemesAtras = new Date()
    seisMemesAtras.setMonth(seisMemesAtras.getMonth() - 6)

    const resultado = await CrmLead.updateMany(
      {
        updatedAt: { $lt: seisMemesAtras },
        arquivado: false,
      },
      { arquivado: true }
    )

    if (resultado.modifiedCount > 0) {
      console.log(
        `📦 Arquivamento: ${resultado.modifiedCount} leads arquivados (inatividade > 6 meses)`
      )
    }
  } catch (erro) {
    console.error('❌ Erro ao arquivar leads antigos:', erro.message)
  }
}

/**
 * Limpa dados completamente arquivados após 12 meses (apenas se habilitado)
 * Por padrão, apenas marca como arquivado (soft delete)
 */
export async function limparDadosArquivados(diasRetencao = 365) {
  try {
    const dataLimite = new Date()
    dataLimite.setDate(dataLimite.getDate() - diasRetencao)

    const resultado = await CrmLead.deleteMany({
      arquivado: true,
      updatedAt: { $lt: dataLimite },
    })

    if (resultado.deletedCount > 0) {
      console.log(
        `🗑️ Limpeza: ${resultado.deletedCount} leads removidos permanentemente (archivado > ${diasRetencao} dias)`
      )
    }
  } catch (erro) {
    console.error('❌ Erro ao limpar dados arquivados:', erro.message)
  }
}

/**
 * Relatório de leads ganhos vs perdidos (último trimestre)
 */
export async function relatorioWinRate() {
  try {
    const tresMemesAtras = new Date()
    tresMemesAtras.setMonth(tresMemesAtras.getMonth() - 3)

    // Leads movidos para "Fechado" (assumindo que é a última coluna)
    const colunaFechado = await CrmColuna.findOne({ nome: 'Fechado' })

    if (!colunaFechado) {
      console.warn('⚠️ Coluna "Fechado" não encontrada para relatório')
      return
    }

    const stats = await CrmLead.aggregate([
      {
        $match: {
          updatedAt: { $gte: tresMemesAtras },
          colunaId: colunaFechado._id,
        },
      },
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },
          valorTotal: { $sum: '$valor' },
          valorMedio: { $avg: '$valor' },
        },
      },
    ])

    if (stats.length > 0) {
      const { totalLeads, valorTotal, valorMedio } = stats[0]
      console.log(`📊 Relatório Trimestral:`)
      console.log(`  - Leads fechados: ${totalLeads}`)
      console.log(`  - Valor total: R$ ${(valorTotal || 0).toFixed(2)}`)
      console.log(`  - Valor médio: R$ ${(valorMedio || 0).toFixed(2)}`)
    }
  } catch (erro) {
    console.error('❌ Erro ao gerar relatório:', erro.message)
  }
}

/**
 * Compacta dados antigos (remove detalhes menos importantes)
 */
export async function compactarDadosAntigos(diasThreshold = 180) {
  try {
    const dataLimite = new Date()
    dataLimite.setDate(dataLimite.getDate() - diasThreshold)

    const resultado = await CrmLead.updateMany(
      {
        updatedAt: { $lt: dataLimite },
        arquivado: false,
      },
      {
        $unset: {
          'notas': '', // Remover notas para economizar espaço
          'tags': [], // Remover tags
          'probabilidade_fechamento_pct': '', // Remover prob para leads antigos
        },
      }
    )

    if (resultado.modifiedCount > 0) {
      console.log(`💾 Compactação: ${resultado.modifiedCount} leads compactados`)
    }
  } catch (erro) {
    console.error('❌ Erro ao compactar dados:', erro.message)
  }
}

/**
 * Agenda todas as tarefas de manutenção
 * Executa:
 * - Arquivamento toda segunda-feira às 2am
 * - Limpeza todo mês no dia 1º às 3am
 * - Relatório toda sexta-feira às 9am
 * - Compactação todo mês no dia 15 às 4am
 */
export function agendarTarefasManutencao() {
  // Arquivar leads antigos - toda segunda às 02:00
  cron.schedule('0 2 * * 1', async () => {
    console.log('⏰ [Cron] Iniciando arquivamento de leads antigos...')
    await arquivarLeadsAntigos()
  })

  // Limpar dados arquivados - dia 1º do mês às 03:00
  cron.schedule('0 3 1 * *', async () => {
    console.log('⏰ [Cron] Iniciando limpeza de dados permanentemente arquivados...')
    await limparDadosArquivados(365)
  })

  // Relatório de performance - toda sexta às 09:00
  cron.schedule('0 9 * * 5', async () => {
    console.log('⏰ [Cron] Gerando relatório trimestral...')
    await relatorioWinRate()
  })

  // Compactar dados antigos - dia 15 do mês às 04:00
  cron.schedule('0 4 15 * *', async () => {
    console.log('⏰ [Cron] Iniciando compactação de dados antigos...')
    await compactarDadosAntigos(180)
  })

  console.log('✅ Tarefas de manutenção agendadas com sucesso')
}

/**
 * Função utilitária para executar manutenção manual
 */
export async function executarManutencaoCompleta() {
  console.log('🔧 Executando manutenção completa do sistema...')

  await arquivarLeadsAntigos()
  await compactarDadosAntigos(180)
  await relatorioWinRate()

  console.log('✅ Manutenção completa finalizada')
}

export default {
  arquivarLeadsAntigos,
  limparDadosArquivados,
  relatorioWinRate,
  compactarDadosAntigos,
  agendarTarefasManutencao,
  executarManutencaoCompleta,
}
