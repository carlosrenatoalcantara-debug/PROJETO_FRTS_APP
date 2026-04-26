import mongoose from 'mongoose'

const unidadeBeneficiariaSchema = new mongoose.Schema(
  {
    projetoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjetoFV',
      required: true,
    },
    contaContrato: {
      type: String,
      required: true,
    },
    tipoRateio: {
      type: String,
      enum: ['percentual', 'prioridade'],
      required: true,
    },
    valor: {
      type: Number,
      required: true,
      min: 0,
      // Para percentual: 0-100
      // Para prioridade: 1, 2, 3, etc.
    },
  },
  {
    timestamps: true,
  }
)

export const UnidadeBeneficiaria = mongoose.model('UnidadeBeneficiaria', unidadeBeneficiariaSchema)
