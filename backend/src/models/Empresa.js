import mongoose from 'mongoose'

const empresaSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    trim: true,
  },
  cnpj: {
    type: String,
    unique: true,
    sparse: true,
  },
  email: String,
  telefone: String,
  website: String,
  endereco: String,
  responsavel_tecnico: {
    nome: String,
    crea: String,
    email: String,
  },
  branding: {
    logo_url: String,
    cor_primaria: {
      type: String,
      default: '#f97316',
    },
    cor_secundaria: {
      type: String,
      default: '#1e293b',
    },
    favicon_url: String,
  },
  configuracoes: {
    fator_geracao_kwh_dia: {
      type: Number,
      default: 131.44,
    },
    moeda: {
      type: String,
      default: 'BRL',
    },
    timezone: {
      type: String,
      default: 'America/Sao_Paulo',
    },
  },
  ativo: {
    type: Boolean,
    default: true,
  },
  tipo: {
    type: String,
    enum: ['interna', 'parceira', 'cliente'],
    default: 'interna',
  },
}, {
  timestamps: true,
})

export const Empresa = mongoose.model('Empresa', empresaSchema)
