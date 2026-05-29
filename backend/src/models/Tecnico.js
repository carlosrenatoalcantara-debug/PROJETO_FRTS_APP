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

  // === S8.3: atribuição profissional ===================================
  formacao:                       { type: String, default: null },
  especialidades:                 { type: [String], default: [] },   // FV | EV | BESS
  potencia_max_kw:                { type: Number, default: null },    // limite de atribuição (ex.: CFT 75kW)
  validade_carteira_profissional: { type: Date,   default: null },
  numero_art_padrao:              { type: String, default: null },
  assinatura:                     { type: String, default: null },    // base64/URL
}, { timestamps: true })

export const Tecnico = mongoose.model('Tecnico', tecnicoSchema)
