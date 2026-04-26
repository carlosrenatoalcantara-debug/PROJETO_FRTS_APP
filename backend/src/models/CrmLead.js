import mongoose from 'mongoose'

const crmLeadSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    trim: true,
  },
  funilId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CrmFunil',
    required: true,
  },
  colunaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CrmColuna',
    required: true,
  },
  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cliente',
  },
  valor: Number,
  origem: {
    type: String,
    enum: ['manual', 'importado', 'website', 'telefone', 'email', 'indicacao', 'evento', 'outro'],
    default: 'manual',
  },
  notas: String,
  // Campos de endereço adicionados
  endereco: String,
  cidade: String,
  estado: String,
  latitude: Number,
  longitude: Number,
  // Campos adicionais
  email: String,
  telefone: String,
  empresa: String,
  contato: String,
  probabilidade_fechamento_pct: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  tags: [String],
  arquivado: {
    type: Boolean,
    default: false,
  },
  data_atualizacao_coluna: Date,
}, {
  timestamps: true,
})

export const CrmLead = mongoose.model('CrmLead', crmLeadSchema)
