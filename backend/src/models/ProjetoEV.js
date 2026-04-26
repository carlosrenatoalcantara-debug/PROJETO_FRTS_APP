import mongoose from 'mongoose'

const projetoEVSchema = new mongoose.Schema({
  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cliente',
    required: true,
  },
  nome: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['rascunho', 'em_simulacao', 'dimensionado', 'proposta', 'aprovado', 'em_execucao', 'concluido'],
    default: 'rascunho',
  },
  tipo_carregamento: {
    type: String,
    enum: ['AC', 'DC'],
    default: 'AC',
  },
  quantidade_pontos: Number,
  endereco_completo: String,
  latitude: Number,
  longitude: Number,
  potencia_total_kw: Number,
  tensao_sistema: Number,
  corrente_max_a: Number,
  bitola_cabo_mm2: Number,
  comprimento_cabo_m: Number,
  carregador: {
    marca: String,
    modelo: String,
    potencia_kw: Number,
  },
  protecoes: {
    disjuntor_a: Number,
    dr_ma: Number,
    dispositivo_diferencial: Boolean,
  },
  financeiro: {
    custo_total_r: Number,
    irr_pct: Number,
    npv_r: Number,
    payback_anos: Number,
  },
  homologacao: {
    status: {
      type: String,
      enum: ['rascunho', 'enviado', 'analise', 'aprovado', 'conectado'],
      default: 'rascunho',
    },
  },
  observacoes: String,
}, {
  timestamps: true,
})

export const ProjetoEV = mongoose.model('ProjetoEV', projetoEVSchema)
