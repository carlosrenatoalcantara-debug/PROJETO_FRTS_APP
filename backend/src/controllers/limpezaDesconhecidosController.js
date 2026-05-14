/**
 * Controller para limpeza de equipamentos "Desconhecido"
 * Pode ser chamado via POST /api/admin/limpar-desconhecidos
 */

import { Equipamento } from '../models/Equipamento.js'
import { CarregadorEV } from '../models/CarregadorEV.js'

export const limparDesconhecidos = async (req, res) => {
  try {
    // Validar admin key
    const adminKey = req.headers['x-admin-key'] || req.query.key
    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(403).json({ erro: 'Acesso negado - chave admin inválida' })
    }

    console.log('\n🧹 INICIANDO LIMPEZA DE "DESCONHECIDO"...\n')

    // Contar antes
    const equipantesAntes = await Equipamento.countDocuments()
    const desconhecidosAntes = await Equipamento.countDocuments({
      fabricante: 'Desconhecido'
    })

    console.log(`📊 ANTES:`)
    console.log(`   Total: ${equipantesAntes}`)
    console.log(`   Desconhecido: ${desconhecidosAntes}\n`)

    if (desconhecidosAntes === 0) {
      console.log('✅ Nenhum "Desconhecido" encontrado')
      return res.json({
        sucesso: true,
        mensagem: 'Nenhum equipamento com "Desconhecido" encontrado',
        antes: {
          total: equipantesAntes,
          desconhecido: desconhecidosAntes,
        },
        depois: {
          total: equipantesAntes,
          desconhecido: 0,
        },
        removidos: 0,
      })
    }

    // Breakdown antes
    const inversoresDesc = await Equipamento.countDocuments({
      tipo: 'inversor',
      fabricante: 'Desconhecido',
    })

    const modulosDesc = await Equipamento.countDocuments({
      tipo: 'modulo',
      fabricante: 'Desconhecido',
    })

    const carregadoresDesc = await Equipamento.countDocuments({
      tipo: 'carregador_ev',
      fabricante: 'Desconhecido',
    })

    console.log(`Breakdown:`)
    console.log(`   - Inversores: ${inversoresDesc}`)
    console.log(`   - Módulos: ${modulosDesc}`)
    console.log(`   - Carregadores EV: ${carregadoresDesc}\n`)

    // DELETAR
    console.log('🗑️  Deletando...\n')
    const resultado = await Equipamento.deleteMany({
      fabricante: 'Desconhecido',
    })

    // Contar depois
    const equipantesDepois = await Equipamento.countDocuments()
    const desconhecidosDepois = await Equipamento.countDocuments({
      fabricante: 'Desconhecido',
    })

    console.log(`✅ ${resultado.deletedCount} equipamentos deletados!\n`)
    console.log(`📊 DEPOIS:`)
    console.log(`   Total: ${equipantesDepois}`)
    console.log(`   Desconhecido: ${desconhecidosDepois}\n`)

    if (desconhecidosDepois === 0) {
      console.log('🎉 LIMPEZA CONCLUÍDA COM SUCESSO!\n')
    }

    // Retornar resultado
    res.json({
      sucesso: true,
      mensagem: `${resultado.deletedCount} equipamentos com "Desconhecido" foram removidos`,
      antes: {
        total: equipantesAntes,
        desconhecido: desconhecidosAntes,
        por_tipo: {
          inversores: inversoresDesc,
          modulos: modulosDesc,
          carregadores_ev: carregadoresDesc,
        },
      },
      depois: {
        total: equipantesDepois,
        desconhecido: desconhecidosDepois,
      },
      removidos: resultado.deletedCount,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('❌ Erro na limpeza:', err)
    res.status(500).json({
      sucesso: false,
      erro: err.message,
    })
  }
}

export const statusLimpeza = async (req, res) => {
  try {
    // Não requer auth para ver status
    const total = await Equipamento.countDocuments()
    const desconhecidos = await Equipamento.countDocuments({
      fabricante: 'Desconhecido',
    })

    const por_tipo = await Equipamento.aggregate([
      { $group: { _id: '$tipo', count: { $sum: 1 } } },
    ])

    const desconhecidos_por_tipo = await Equipamento.aggregate([
      { $match: { fabricante: 'Desconhecido' } },
      { $group: { _id: '$tipo', count: { $sum: 1 } } },
    ])

    res.json({
      timestamp: new Date().toISOString(),
      status: desconhecidos === 0 ? '✅ LIMPO' : '⚠️ SUJO',
      resumo: {
        total,
        desconhecido: desconhecidos,
        percentual_desconhecido: ((desconhecidos / total) * 100).toFixed(2) + '%',
      },
      por_tipo,
      desconhecidos_por_tipo,
    })
  } catch (err) {
    res.status(500).json({
      erro: err.message,
    })
  }
}
