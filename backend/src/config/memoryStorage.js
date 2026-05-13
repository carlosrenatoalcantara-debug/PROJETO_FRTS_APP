/**
 * In-Memory Storage Fallback com Persistência em Arquivo
 * Usado quando MongoDB não está disponível (desenvolvimento/testes)
 * Dados são salvos em arquivo JSON local para persistência entre reinicializações
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, '../../data/memory-storage.json')
const DATA_DIR = path.join(__dirname, '../../data')

class MemoryStore {
  constructor() {
    this.collections = {
      projetos_ev: [],
      clientes: [],
      projetos_fv: [],
      configuracoes: [],
    }
    this.idCounters = {
      projetos_ev: 1,
      clientes: 1,
      projetos_fv: 1,
    }

    // Criar diretório de dados se não existir
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }

    // Carregar dados do arquivo ou inicializar com dados de teste
    this.loadFromFile()
  }

  loadFromFile() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf-8')
        const parsed = JSON.parse(data)
        this.collections = parsed.collections || this.collections
        this.idCounters = parsed.idCounters || this.idCounters
        console.log('✅ Dados carregados do arquivo:', DATA_FILE)
        return
      }
    } catch (err) {
      console.error('❌ Erro ao carregar dados do arquivo:', err.message)
    }

    // Se não tiver arquivo, inicializar com dados de teste
    this.initializeTestData()
    this.saveToFile()
  }

  saveToFile() {
    try {
      const data = {
        collections: this.collections,
        idCounters: this.idCounters,
        lastSaved: new Date().toISOString(),
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
      console.log('💾 Dados salvos em arquivo:', DATA_FILE)
    } catch (err) {
      console.error('❌ Erro ao salvar dados em arquivo:', err.message)
    }
  }

  initializeTestData() {
    // Cliente de teste
    const clienteTeste = {
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
    }
    this.collections.clientes.push(clienteTeste)

    // Projeto de teste
    const projetoTeste = {
      _id: 'proj-ev-teste-1',
      clienteId: 'cliente-teste-1',
      nome: 'Casa João Silva - Carregador EV',
      tipo_carregamento: 'AC',
      status: 'rascunho',
      carregadores: [
        {
          tipo: 'AC_Mono',
          potencia_kw: 7,
          marca: 'EMOBI',
          modelo: 'Evowatt Boreal Master 7kW',
          quantidade: 1,
          tensao_entrada_v: 220,
          corrente_entrada_a: 32,
        },
      ],
      calculos_nbr: {
        corrente_projeto_a: 32,
        corrente_maxima_a: 32,
        bitola_cabo_mm2: 10,
        disjuntor_a: 40,
        dr_ma: 30,
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
    }
    this.collections.projetos_ev.push(projetoTeste)
  }

  // Cliente
  findCliente(id) {
    return this.collections.clientes.find(c => c._id === id)
  }

  // ProjetoEV
  findAllProjetoEV() {
    return this.collections.projetos_ev
  }

  findProjetoEV(id) {
    return this.collections.projetos_ev.find(p => p._id === id)
  }

  createProjetoEV(data) {
    const id = `proj-ev-${this.idCounters.projetos_ev++}`
    const projeto = {
      _id: id,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.collections.projetos_ev.push(projeto)
    this.saveToFile()
    return projeto
  }

  updateProjetoEV(id, data) {
    const index = this.collections.projetos_ev.findIndex(p => p._id === id)
    if (index === -1) return null

    const projeto = {
      ...this.collections.projetos_ev[index],
      ...data,
      updatedAt: new Date().toISOString(),
    }
    this.collections.projetos_ev[index] = projeto
    this.saveToFile()
    return projeto
  }

  deleteProjetoEV(id) {
    const index = this.collections.projetos_ev.findIndex(p => p._id === id)
    if (index === -1) return null

    const projeto = this.collections.projetos_ev[index]
    this.collections.projetos_ev.splice(index, 1)
    this.saveToFile()
    return projeto
  }

  findProjetoEVByCliente(clienteId) {
    return this.collections.projetos_ev.filter(p => p.clienteId === clienteId)
  }

  // Cliente
  findAllClientes() {
    return this.collections.clientes
  }

  findClienteById(id) {
    return this.collections.clientes.find(c => c._id === id)
  }

  createCliente(data) {
    const id = `cliente-${this.idCounters.clientes++}`
    const cliente = {
      _id: id,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.collections.clientes.push(cliente)
    this.saveToFile()
    return cliente
  }

  // Métodos para Configurações (APIs)
  findAllConfiguracoes() {
    return this.collections.configuracoes || []
  }

  createConfiguracao(data) {
    const id = `config-${Date.now()}`
    const config = {
      _id: id,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    if (!this.collections.configuracoes) {
      this.collections.configuracoes = []
    }
    this.collections.configuracoes.push(config)
    this.saveToFile()
    return config
  }

  updateConfiguracao(id, data) {
    if (!this.collections.configuracoes) {
      this.collections.configuracoes = []
    }
    const index = this.collections.configuracoes.findIndex(c => c._id === id)
    if (index === -1) return null

    const config = {
      ...this.collections.configuracoes[index],
      ...data,
      updatedAt: new Date().toISOString(),
    }
    this.collections.configuracoes[index] = config
    this.saveToFile()
    return config
  }

  deleteConfiguracao(id) {
    if (!this.collections.configuracoes) {
      this.collections.configuracoes = []
    }
    const index = this.collections.configuracoes.findIndex(c => c._id === id)
    if (index === -1) return null

    const config = this.collections.configuracoes[index]
    this.collections.configuracoes.splice(index, 1)
    this.saveToFile()
    return config
  }
}

export const memoryStore = new MemoryStore()
