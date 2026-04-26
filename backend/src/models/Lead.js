import mongoose from 'mongoose'

const leadSchema = new mongoose.Schema({
  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cliente',
  },
  nome: {
    type: String,
    required: true,
    trim: true,
  },
  email: String,
  telefone: String,
  empresa: String,
  valor_estimado_r: Number,
  status: {
    type: String,
    enum: ['prospect', 'qualificado', 'negociacao', 'proposta', 'ganho', 'perdido'],
    default: 'prospect',
  },
  estágio_funil: {
    type: String,
    default: 'contato_inicial',
  },
  coluna_kanban: {
    type: String,
    default: 'novo',
  },
  probabilidade_fechamento_pct: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  data_proximo_contato: Date,
  proxima_acao: String,
  origem: {
    type: String,
    enum: ['website', 'telefone', 'email', 'indicacao', 'evento', 'outro'],
  },
  tags: [String],
  notas: String,
}, {
  timestamps: true,
})

export const Lead = mongoose.model('Lead', leadSchema)
