import mongoose from 'mongoose'

const funilSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    trim: true,
  },
  ordem: {
    type: Number,
    default: 0,
  },
  descricao: String,
  ativo: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
})

export const CrmFunil = mongoose.model('CrmFunil', funilSchema)
