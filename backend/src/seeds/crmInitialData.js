// Script para inicializar dados padrão do CRM no MongoDB
import { CrmFunil } from '../models/CrmFunil.js'
import { CrmColuna } from '../models/CrmColuna.js'

export async function inicializarCRM() {
  try {
    // Verificar se já existe funis
    const countFunis = await CrmFunil.countDocuments()
    if (countFunis > 0) {
      console.log('✓ CRM já inicializado com', countFunis, 'funis')
      return
    }

    console.log('📋 Inicializando dados padrão do CRM...')

    // Criar funis padrão
    const vendas = new CrmFunil({
      nome: 'Vendas',
      ordem: 1,
      descricao: 'Funil de vendas padrão',
      ativo: true,
    })
    await vendas.save()
    console.log('✓ Funis "Vendas" criado')

    // Criar colunas padrão para o funis de vendas
    const colunasData = [
      { nome: 'Lead', ordem: 1, descricao: 'Novos leads' },
      { nome: 'Qualificado', ordem: 2, descricao: 'Leads qualificados' },
      { nome: 'Proposta', ordem: 3, descricao: 'Com proposta em análise' },
      { nome: 'Negociação', ordem: 4, descricao: 'Em negociação' },
      { nome: 'Fechado', ordem: 5, descricao: 'Negócio fechado' },
    ]

    for (const colunaData of colunasData) {
      const coluna = new CrmColuna({
        nome: colunaData.nome,
        funilId: vendas._id,
        ordem: colunaData.ordem,
        descricao: colunaData.descricao,
        ativo: true,
      })
      await coluna.save()
      console.log(`  ✓ Coluna "${colunaData.nome}" criada`)
    }

    console.log('✅ CRM inicializado com sucesso')
  } catch (erro) {
    console.error('❌ Erro ao inicializar CRM:', erro.message)
    throw erro
  }
}
