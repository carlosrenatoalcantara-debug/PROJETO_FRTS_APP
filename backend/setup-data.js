#!/usr/bin/env node
/**
 * Setup de dados - Carrega dados de import-files e cria memory-storage.json
 * Executa: node setup-data.js
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const IMPORT_DIR = path.join(__dirname, 'data/import-files')
const DATA_FILE = path.join(__dirname, 'data/memory-storage.json')
const DATA_DIR = path.join(__dirname, 'data')

console.log('📦 SETUP DE DADOS - Inicializando memory storage...\n')

// Garantir que diretório existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  console.log('✓ Diretório de dados criado')
}

// Carregar dados dos arquivos de importação
const collections = {
  clientes: [],
  equipamentos: [],
  projetos_ev: [],
  projetos_fv: [],
  configuracoes: []
}

const idCounters = {
  clientes: 1,
  equipamentos: 1,
  projetos_ev: 1,
  projetos_fv: 1
}

// Função para carregar arquivo JSON
function carregarJSON(arquivo) {
  const caminho = path.join(IMPORT_DIR, arquivo)
  if (fs.existsSync(caminho)) {
    try {
      const conteudo = fs.readFileSync(caminho, 'utf-8')
      const dados = JSON.parse(conteudo)
      console.log(`✓ Carregado ${arquivo}`)
      return Array.isArray(dados) ? dados : [dados]
    } catch (err) {
      console.error(`❌ Erro ao carregar ${arquivo}:`, err.message)
      return []
    }
  }
  console.log(`⚠️  ${arquivo} não encontrado`)
  return []
}

// Carregar cada tipo de dado
collections.clientes = carregarJSON('clientes.json')
collections.equipamentos = carregarJSON('equipamentos.json')
collections.projetos_ev = carregarJSON('projetos_ev.json')

// Se não houver dados importados, adicionar dados de teste
if (collections.clientes.length === 0) {
  console.log('\n📝 Adicionando dados de teste...')
  collections.clientes.push({
    _id: 'cliente-teste-1',
    nome: 'João Silva',
    cpf: '123.456.789-00',
    email: 'joao@example.com',
    telefone: '(84) 99999-9999',
    endereco_completo: 'Rua dos Tororós, 730 Apto 801, Natal/RN',
    cep: '59.054-550',
    carga_instalada_w: 18140,
    unidade_consumidora: '007028936405',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  console.log('✓ Cliente de teste adicionado')
}

if (collections.equipamentos.length === 0) {
  // Adicionar equipamentos de teste
  const equipamentosExemplo = [
    {
      _id: 'ev-wallbox-11kw',
      tipo: 'carregador_ev',
      fabricante: 'Wallbox',
      modelo: 'Pulsar Plus',
      ativo: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: 'mod-canadian-400',
      tipo: 'modulo',
      fabricante: 'Canadian Solar',
      modelo: 'CS3K-400MS',
      potencia_w: 400,
      ativo: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ]
  collections.equipamentos = equipamentosExemplo
  console.log('✓ Equipamentos de teste adicionados')
}

if (collections.projetos_ev.length === 0) {
  collections.projetos_ev.push({
    _id: 'proj-ev-teste-1',
    clienteId: 'cliente-teste-1',
    nome: 'Casa João Silva - Carregador EV',
    tipo_carregamento: 'AC',
    status: 'rascunho',
    carregadores: [{
      tipo: 'AC_Mono',
      potencia_kw: 7,
      marca: 'EMOBI',
      modelo: 'Evowatt Boreal Master 7kW',
      quantidade: 1,
      tensao_entrada_v: 220,
      corrente_entrada_a: 32,
    }],
    calculos_nbr: {
      corrente_projeto_a: 32,
      corrente_maxima_a: 32,
      bitola_cabo_mm2: 10,
      disjuntor_a: 40,
      dr_ma: 30,
      dps_kv: 275,
      dps_capacidade_a: 52,
      tempo_seccionamento_s: 0.4,
      queda_tensao_pct: 1.25,
      materiais: [
        { item: 'Disjuntor Bipolar', especificacao: '40A Curva C', quantidade: 1 },
        { item: 'Dispositivo DR', especificacao: '40A/30mA', quantidade: 1 },
        { item: 'Cabo PP', especificacao: '10mm² (Fase)', quantidade: 50 },
      ],
    },
    tecnico: {
      nome: 'Carlos Renato Alcantara',
      crea: 'SP 123456/D',
      tipo_profissional: 'crea',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  console.log('✓ Projeto EV de teste adicionado')
}

// Salvar dados
const dataToSave = {
  collections,
  idCounters,
  lastSaved: new Date().toISOString(),
}

try {
  fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8')
  console.log(`\n✅ Dados salvos em: ${DATA_FILE}`)
  console.log(`\n📊 Resumo:`)
  console.log(`   Clientes: ${collections.clientes.length}`)
  console.log(`   Equipamentos: ${collections.equipamentos.length}`)
  console.log(`   Projetos EV: ${collections.projetos_ev.length}`)
  console.log(`\n✅ Setup completo! Inicie o backend com: npm run dev`)
} catch (err) {
  console.error('\n❌ Erro ao salvar dados:', err.message)
  process.exit(1)
}
