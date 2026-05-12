import mongoose from 'mongoose'

const EquipamentoSchema = new mongoose.Schema(
  {
    tipo: {
      type: String,
      enum: ['modulo', 'inversor', 'estrutura', 'bateria', 'carregador_ev'],
      required: true,
      index: true,
    },
    fabricante: {
      type: String,
      required: true,
      index: true,
    },
    modelo: {
      type: String,
      required: true,
      index: true,
    },
    especificacoes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    garantia_produto: {
      value: Number,
      unit: { type: String, enum: ['anos', 'meses'] },
    },
    garantia_performance: {
      value: Number,
      unit: { type: String, enum: ['anos', 'meses'] },
    },
    datasheet_url: String,
    preco_sugerido: {
      type: Number,
      default: 0,
    },
    ativo: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
)

export const Equipamento = mongoose.model('Equipamento', EquipamentoSchema)
