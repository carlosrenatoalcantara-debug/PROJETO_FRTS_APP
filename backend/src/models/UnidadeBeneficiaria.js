import mongoose from 'mongoose'

/**
 * UnidadeBeneficiaria — Sprint 7 (original) + Sprint 8.7 (extensão aditiva).
 * Representa uma UC beneficiária do crédito GD (Lei 14.300/2022).
 * Campos originais (contaContrato, tipoRateio, valor) preservados.
 * Novos campos S8.7: titular, cpf_cnpj, concessionaria, modalidade_gd, ativa, historico.
 */
const historicoEventoSchema = new mongoose.Schema({
  em:    { type: Date, default: () => new Date() },
  por:   { type: String, default: 'sistema' },
  acao:  { type: String, default: null },   // 'criado'|'editado'|'removido'|'rateio_alterado'
  antes: { type: mongoose.Schema.Types.Mixed, default: null },
  depois:{ type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: false })

const unidadeBeneficiariaSchema = new mongoose.Schema(
  {
    // === CAMPOS ORIGINAIS (preservados intactos) =============================
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
    },

    // === NOVOS CAMPOS S8.7 ===================================================
    titular:       { type: String, default: null },
    cpf_cnpj:      { type: String, default: null },
    concessionaria:{ type: String, default: null },
    // Modalidade GD (Lei 14.300/2022)
    modalidade_gd: {
      type: String,
      enum: ['autoconsumo_local', 'autoconsumo_remoto', 'geracao_compartilhada', 'condominio', null],
      default: null,
    },
    ativa:    { type: Boolean, default: true, index: true },
    historico:{ type: [historicoEventoSchema], default: [] },
  },
  { timestamps: true }
)

unidadeBeneficiariaSchema.index({ projetoId: 1, ativa: 1 })

export const UnidadeBeneficiaria = mongoose.model('UnidadeBeneficiaria', unidadeBeneficiariaSchema)
