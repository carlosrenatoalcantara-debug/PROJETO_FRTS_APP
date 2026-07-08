import mongoose from 'mongoose'

const clienteSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  telefone: {
    type: String,
    trim: true,
    default: '',
  },
  cpf_cnpj: {
    type: String,
    trim: true,
    default: '',
  },
  tipo: {
    type: String,
    enum: ['Pessoa Física', 'Pessoa Jurídica'],
    default: 'Pessoa Física',
  },
  endereco: {
    type: String,
    default: '',
  },
  endereco_completo: {
    type: String,
    default: '',
  },
  cep: {
    type: String,
    default: '',
  },
  cidade: {
    type: String,
    default: '',
  },
  estado: {
    type: String,
    default: '',
  },
  latitude: {
    type: Number,
    default: null,
  },
  longitude: {
    type: Number,
    default: null,
  },
  // Dados de conta de energia
  numero_cliente: {
    type: String,
    default: '',
  },
  codigo_instalacao: {
    type: String,
    default: '',
  },
  distribuidora: {
    type: String,
    default: '',
  },
  classificacao: {
    type: String,
    default: '',
  },
  subgrupo: {
    type: String,
    default: '',
  },
  tipo_ligacao: {
    type: String,
    default: '',
  },
  valor_kwh: {
    type: Number,
    default: 0,
  },
  consumo_kwh: {
    type: Number,
    default: 0,
  },
  // FEATURE-006: dados de disponibilidade elétrica da UC (fornecidos pela concessionária,
  // informados pelo cliente e digitados pelo operador). Usados APENAS pelo Memorial
  // Descritivo (seção "Verificação da Disponibilidade Elétrica"). null = ainda não
  // informado → o memorial imprime um espaço em branco para preenchimento manual.
  carga_instalada_kw: {
    type: Number,
    default: null,
  },
  disjuntor_geral_a: {
    type: Number,
    default: null,
  },
  tags: [String],
  status: {
    type: String,
    enum: ['ativo', 'inativo', 'prospect'],
    default: 'ativo',
  },
}, {
  timestamps: true,
})

export const Cliente = mongoose.model('Cliente', clienteSchema)
