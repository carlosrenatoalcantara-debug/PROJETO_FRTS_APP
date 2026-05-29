import mongoose from 'mongoose'

/**
 * Tecnico — Sprint 7.2
 * Responsáveis técnicos cadastráveis (múltiplos). Associáveis a projetos.
 */
const tecnicoSchema = new mongoose.Schema({
  nome:        { type: String, required: true, trim: true },
  tipo_registro: { type: String, default: 'CREA' },  // CREA | CFT | CFMV
  registro:    { type: String, default: null },        // número
  uf:          { type: String, default: null },
  modalidade:  { type: String, default: null },
  email:       { type: String, default: null },
  telefone:    { type: String, default: null },
  empresa_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', default: null },
  ativo:       { type: Boolean, default: true },
}, { timestamps: true })

export const Tecnico = mongoose.model('Tecnico', tecnicoSchema)
