import mongoose from 'mongoose'
import { Cliente } from '../models/Cliente.js'
import { Empresa } from '../models/Empresa.js'
import { Equipamento } from '../models/Equipamento.js'
import { conectarBD } from '../config/database.js'

async function seedBD() {
  try {
    await conectarBD()

    // Limpar dados existentes
    await Cliente.deleteMany({})
    await Empresa.deleteMany({})
    await Equipamento.deleteMany({})

    console.log('🧹 Banco de dados limpo')

    // Criar empresa padrão
    const empresa = await Empresa.create({
      nome: 'Forte Solar',
      cnpj: '00.000.000/0001-00',
      email: 'contato@fortesolar.com.br',
      telefone: '(11) 3000-0000',
      responsavel_tecnico: {
        nome: 'Eng. Solar',
        crea: '123456/D-SP',
        email: 'engenharia@fortesolar.com.br',
      },
      branding: {
        logo_url: 'https://via.placeholder.com/200x100',
        cor_primaria: '#f97316',
        cor_secundaria: '#1e293b',
      },
    })
    console.log('✅ Empresa padrão criada:', empresa.nome)

    // Criar clientes de exemplo
    const clientes = await Cliente.insertMany([
      {
        nome: 'João Silva',
        email: 'joao@email.com',
        telefone: '(11) 99999-0001',
        tipo: 'Pessoa Física',
        cidade: 'São Paulo',
        estado: 'SP',
        status: 'ativo',
      },
      {
        nome: 'Ana Ferreira',
        email: 'ana@empresa.com',
        telefone: '(21) 99999-0002',
        tipo: 'Pessoa Jurídica',
        cidade: 'Rio de Janeiro',
        estado: 'RJ',
        status: 'ativo',
      },
      {
        nome: 'Pedro Oliveira',
        email: 'pedro@email.com',
        telefone: '(31) 99999-0003',
        tipo: 'Pessoa Física',
        cidade: 'Belo Horizonte',
        estado: 'MG',
        status: 'ativo',
      },
    ])
    console.log(`✅ ${clientes.length} clientes criados`)

    // Criar equipamentos de exemplo - Painéis FV
    const paineis = await Equipamento.insertMany([
      {
        tipo: 'modulo_fv',
        fabricante: 'Canadian Solar',
        modelo: 'HiKu CS6L-MS',
        especificacoes: {
          potencia_w: 550,
          voc: 49.5,
          vmpp: 40.8,
          isc: 14.15,
          impp: 13.48,
          eficiencia_pct: 21.0,
          area_m2: 2.27,
        },
        garantias: {
          produto_anos: 12,
          performance_anos: 25,
          performance_minima_pct: 80,
        },
        preco_unitario_r: 1200,
        disponivel: true,
      },
      {
        tipo: 'modulo_fv',
        fabricante: 'JA Solar',
        modelo: 'JAM60S20-455',
        especificacoes: {
          potencia_w: 455,
          voc: 48.8,
          vmpp: 40.2,
          isc: 12.25,
          impp: 11.35,
          eficiencia_pct: 20.8,
          area_m2: 2.18,
        },
        garantias: {
          produto_anos: 12,
          performance_anos: 25,
          performance_minima_pct: 80,
        },
        preco_unitario_r: 950,
        disponivel: true,
      },
      {
        tipo: 'modulo_fv',
        fabricante: 'Bifacial',
        modelo: 'BF-450W',
        especificacoes: {
          potencia_w: 450,
          voc: 47.5,
          vmpp: 39.5,
          isc: 12.0,
          impp: 11.2,
          eficiencia_pct: 20.5,
          area_m2: 2.19,
        },
        garantias: {
          produto_anos: 15,
          performance_anos: 30,
          performance_minima_pct: 80,
        },
        preco_unitario_r: 1050,
        disponivel: true,
      },
    ])
    console.log(`✅ ${paineis.length} painéis FV criados`)

    // Criar equipamentos - Inversores
    const inversores = await Equipamento.insertMany([
      {
        tipo: 'inversor',
        fabricante: 'SMA',
        modelo: 'Sunny Boy 5.0',
        especificacoes: {
          potencia_kw: 5.0,
          tipo_inversor: 'String',
          fases_entrada: 1,
          fases_saida: 1,
          tensao_entrada_min: 200,
          tensao_entrada_max: 800,
          n_mppt: 2,
        },
        garantias: {
          produto_anos: 10,
        },
        preco_unitario_r: 5500,
        disponivel: true,
      },
      {
        tipo: 'inversor',
        fabricante: 'Fronius',
        modelo: 'Primo 5.0',
        especificacoes: {
          potencia_kw: 5.0,
          tipo_inversor: 'String',
          fases_entrada: 3,
          fases_saida: 3,
          tensao_entrada_min: 200,
          tensao_entrada_max: 800,
          n_mppt: 2,
        },
        garantias: {
          produto_anos: 10,
        },
        preco_unitario_r: 5800,
        disponivel: true,
      },
      {
        tipo: 'inversor',
        fabricante: 'Growatt',
        modelo: 'MAX 3.6',
        especificacoes: {
          potencia_kw: 3.6,
          tipo_inversor: 'String',
          fases_entrada: 1,
          fases_saida: 1,
          tensao_entrada_min: 200,
          tensao_entrada_max: 550,
          n_mppt: 1,
        },
        garantias: {
          produto_anos: 5,
        },
        preco_unitario_r: 2200,
        disponivel: true,
      },
    ])
    console.log(`✅ ${inversores.length} inversores criados`)

    // Criar equipamentos - Estruturas
    const estruturas = await Equipamento.insertMany([
      {
        tipo: 'estrutura',
        fabricante: 'Sunflow',
        modelo: 'Telhado Metálico',
        especificacoes: {
          tipo_estrutura: 'Metálico',
          descricao_estrutura: 'Estrutura de alumínio para telhado metálico',
        },
        garantias: {
          produto_anos: 10,
        },
        preco_unitario_r: 150,
        disponivel: true,
      },
      {
        tipo: 'estrutura',
        fabricante: 'Sunflow',
        modelo: 'Telhado Cerâmico',
        especificacoes: {
          tipo_estrutura: 'Cerâmico',
          descricao_estrutura: 'Estrutura de alumínio para telhado cerâmico',
        },
        garantias: {
          produto_anos: 10,
        },
        preco_unitario_r: 120,
        disponivel: true,
      },
      {
        tipo: 'estrutura',
        fabricante: 'Sunflow',
        modelo: 'Solo',
        especificacoes: {
          tipo_estrutura: 'Solo',
          descricao_estrutura: 'Estrutura para instalação no solo',
        },
        garantias: {
          produto_anos: 15,
        },
        preco_unitario_r: 180,
        disponivel: true,
      },
    ])
    console.log(`✅ ${estruturas.length} estruturas criadas`)

    console.log('\n✅ Seed inicial completo!')
    console.log(`   - 1 Empresa (Forte Solar)`)
    console.log(`   - 3 Clientes de exemplo`)
    console.log(`   - 3 Painéis FV`)
    console.log(`   - 3 Inversores`)
    console.log(`   - 3 Estruturas`)

  } catch (erro) {
    console.error('❌ Erro ao fazer seed:', erro.message)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

// Executar seed
seedBD()
