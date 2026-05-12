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

  // LOCALIZAÇÃO
  endereco_completo: String,
  latitude: Number,
  longitude: Number,

  // CARREGADORES
  carregadores: [{
    tipo: { type: String, enum: ['AC_Mono', 'AC_Tri', 'DC'] },
    potencia_kw: Number,
    marca: String,
    modelo: String,
    quantidade: Number,
  }],
  quantidade_pontos: Number,
  potencia_total_kw: Number,

  // INSTALAÇÃO
  tensao_sistema: { type: Number, default: 220 },
  fases: { type: Number, enum: [1, 3], default: 3 },
  frequencia_hz: { type: Number, default: 60 },
  comprimento_cabo_m: Number,
  localizacao_instacao: String,

  // CÁLCULOS NBR 5410
  calculos_nbr: {
    corrente_projeto_a: Number,
    corrente_maxima_a: Number,
    bitola_cabo_mm2: Number,
    disjuntor_a: Number,
    dr_ma: Number,
    tempo_seccionamento_s: Number,
    queda_tensao_pct: Number,
    materiais: [{ item: String, especificacao: String, quantidade: Number }],
  },

  protecoes: {
    disjuntor_a: Number,
    dr_ma: Number,
    dispositivo_diferencial: Boolean,
    aterramento: String,
  },

  // DOCUMENTAÇÃO
  fotos: [{
    url: String,
    descricao: String,
    tipo: { type: String, enum: ['instalacao', 'quadro', 'geral'] },
  }],

  tecnico: {
    nome: String,
    crea: String,
    assinatura_url: String,
  },

  financeiro: {
    custo_equipamentos_r: Number,
    custo_instalacao_r: Number,
    custo_total_r: Number,
  },

  observacoes: String,
}, {
  timestamps: true,
})

export const ProjetoEV = mongoose.model('ProjetoEV', projetoEVSchema)
