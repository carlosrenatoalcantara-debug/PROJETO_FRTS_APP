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
