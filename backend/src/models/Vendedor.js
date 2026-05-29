import mongoose from 'mongoose'

/**
 * Vendedor — Sprint 7.2
 * Vendedores cadastráveis (múltiplos). Associáveis a projetos (vendedor_id).
 */
const vendedorSchema = new mongoose.Schema({
  nome:       { type: String, required: true, trim: true },
  email:      { type: String, default: null },
  telefone:   { type: String, default: null },
  cargo:      { type: String, default: null },
  usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  empresa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', default: null },
  ativo:      { type: Boolean, default: true },
}, { timestamps: true })

export const Vendedor = mongoose.model('Vendedor', vendedorSchema)
