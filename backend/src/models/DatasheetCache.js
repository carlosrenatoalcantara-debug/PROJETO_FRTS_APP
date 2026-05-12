import mongoose from 'mongoose'

// Cada documento representa um fabricante aprendido.
// Guarda exemplos de variantes reais para enriquecer o prompt do Claude
// e detectar duplicatas antes de salvar no banco.
const DatasheetCacheSchema = new mongoose.Schema({
  fabricante: { type: String, required: true, index: true },
  // modelos vistos: [{ codigo, potencias: [530,535,...], exemplo: {voc,vmpp,...} }]
  modelos: [{
    codigo:    { type: String, required: true },
    potencias: [Number],
    exemplo: {
      potenciaW:  Number,
      voc:        Number,
      vmpp:       Number,
      isc:        Number,
      impp:       Number,
      eficiencia: Number,
    },
  }],
  totalExtrações: { type: Number, default: 0 },
  ultimaExtracao: { type: Date, default: Date.now },
}, { timestamps: true })

DatasheetCacheSchema.index({ fabricante: 1 }, { unique: true })

export const DatasheetCache = mongoose.model('DatasheetCache', DatasheetCacheSchema)
