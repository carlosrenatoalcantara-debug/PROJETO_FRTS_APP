/**
 * Dados de exemplo para Equipamentos (Memory Storage)
 * Usado quando MongoDB está offline
 */

export const equipamentosExemplo = [
  // Módulos Solares
  {
    _id: 'mod-neosolar-400',
    tipo: 'modulo',
    fabricante: 'Neosolar',
    modelo: 'NS400W',
    potencia_w: 400,
    especificacoes: {
      potencia: 400,
      voc: 48.5,
      isc: 10.2,
      vmp: 39,
      imp: 10.26,
      eficiencia: 21.5,
    },
    preco_sugerido: 1200,
    ativo: true,
  },
  {
    _id: 'mod-neosolar-550',
    tipo: 'modulo',
    fabricante: 'Neosolar',
    modelo: 'NS550W',
    potencia_w: 550,
    especificacoes: {
      potencia: 550,
      voc: 48.6,
      isc: 13.5,
      vmp: 39,
      imp: 14.1,
      eficiencia: 22,
    },
    preco_sugerido: 1600,
    ativo: true,
  },
  {
    _id: 'mod-canadian-400',
    tipo: 'modulo',
    fabricante: 'Canadian Solar',
    modelo: 'CS3K-400MS',
    potencia_w: 400,
    especificacoes: {
      potencia: 400,
      voc: 49,
      isc: 10,
      vmp: 39.5,
      imp: 10.1,
      eficiencia: 20.9,
    },
    preco_sugerido: 1150,
    ativo: true,
  },

  // Inversores
  {
    _id: 'inv-growatt-5000',
    tipo: 'inversor',
    fabricante: 'Growatt',
    modelo: 'MIC 5000TL-X',
    potencia_kw: 5,
    especificacoes: {
      potencia_kw: 5,
      vpv_max: 600,
      ipv_max: 32,
      eficiencia: 97.2,
      entrada_monofalor: true,
    },
    preco_sugerido: 2800,
    ativo: true,
  },
  {
    _id: 'inv-growatt-10000',
    tipo: 'inversor',
    fabricante: 'Growatt',
    modelo: 'MIC 10000TL-X',
    potencia_kw: 10,
    especificacoes: {
      potencia_kw: 10,
      vpv_max: 600,
      ipv_max: 65,
      eficiencia: 97.5,
      entrada_trifasico: true,
    },
    preco_sugerido: 4200,
    ativo: true,
  },
  {
    _id: 'inv-solis-5000',
    tipo: 'inversor',
    fabricante: 'Solis',
    modelo: 'RHI-5K-48ES-5G',
    potencia_kw: 5,
    especificacoes: {
      potencia_kw: 5,
      vpv_max: 550,
      ipv_max: 32,
      eficiencia: 97.4,
    },
    preco_sugerido: 2600,
    ativo: true,
  },
  {
    _id: 'inv-deye-8000',
    tipo: 'inversor',
    fabricante: 'Deye',
    modelo: 'SUN-8K-G04',
    potencia_kw: 8,
    especificacoes: {
      potencia_kw: 8,
      vpv_max: 600,
      ipv_max: 50,
      eficiencia: 97.3,
    },
    preco_sugerido: 3200,
    ativo: true,
  },

  // Carregadores EV
  {
    _id: 'ev-wallbox-11kw',
    tipo: 'carregador_ev',
    fabricante: 'Wallbox',
    modelo: 'Pulsar Plus',
    especificacoes: {
      potencia_kw: 11,
      tensao_entrada_v: 400,
      corrente_entrada_a: 16,
      numero_fases: 3,
      tipo_conector: 'Type 2',
      tipo_carregamento: 'AC',
    },
    preco_sugerido: 1800,
    ativo: true,
  },
  {
    _id: 'ev-tesla-supercharger-250',
    tipo: 'carregador_ev',
    fabricante: 'Tesla',
    modelo: 'Supercharger V3',
    especificacoes: {
      potencia_kw: 250,
      tensao_entrada_v: 400,
      corrente_entrada_a: 350,
      numero_fases: 3,
      tipo_conector: 'CCS Combo 2',
      tipo_carregamento: 'DC',
    },
    preco_sugerido: 80000,
    ativo: true,
  },
]

/**
 * Dados de clientes exemplo
 */
export const clientesExemplo = [
  {
    _id: 'cli-alice-farm',
    nome: 'Fazenda Alice',
    email: 'fazenda.alice@example.com',
    cpf_cnpj: '00.000.000/0001-00',
    numero_cliente: '2301040659',
    endereco_completo: 'Rod BR 101, KM 250, São Paulo - SP',
    distribuidora: 'Cosern',
    tipo_ligacao: 'Trifásico',
    tags: ['parecer-import'],
  },
  {
    _id: 'cli-sarah-brasil',
    nome: 'Sarah Rodrigues Brasil',
    email: 'sarah.brasil@example.com',
    cpf_cnpj: '123.456.789-10',
    numero_cliente: '2409118802',
    endereco_completo: 'Rua Principal, 123, Rio Grande do Norte',
    distribuidora: 'Cosern',
    tipo_ligacao: 'Monofásico',
    tags: ['parecer-import'],
  },
]

export function inicializarEquipamentosMemory() {
  console.log(`📦 Inicializando ${equipamentosExemplo.length} equipamentos em memória`)
  return equipamentosExemplo
}

export function inicializarClientesMemory() {
  console.log(`👥 Inicializando ${clientesExemplo.length} clientes em memória`)
  return clientesExemplo
}
