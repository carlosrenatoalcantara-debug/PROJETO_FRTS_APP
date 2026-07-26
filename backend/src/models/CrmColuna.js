import mongoose from 'mongoose'

const colunaSchema = new mongoose.Schema({
  // IMPL-000 (Fase 0.5) — M-4: isolamento organizacional. Aditivo, default null.
  empresa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', default: null, index: true },
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
