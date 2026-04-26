import mongoose from 'mongoose'

const colunaSchema = new mongoose.Schema({
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
  ordem: {
    type: Number,
    default: 0,
  },
  limiteWIP: Number, // Work In Progress limit
  descricao: String,
  ativo: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
})

export const CrmColuna = mongoose.model('CrmColuna', colunaSchema)
