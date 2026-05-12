import mongoose from 'mongoose'

const carregadorEVSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['AC_Mono', 'AC_Tri', 'DC'],
    required: true,
  },
  potencia_kw: {
    type: Number,
    required: true,
    enum: [3.6, 7.4, 11, 22, 30, 40, 60, 80, 90, 120, 150, 180],
  }, // ✅ Todas as 12 potências solicitadas
  marca: {
    type: String,
    required: true,
  },
  modelo: {
    type: String,
    required: true,
  },

  // ESPECIFICAÇÕES ELÉTRICAS
  tensao_entrada_v: Number,
  corrente_entrada_a: Number,
  numero_fases: Number,
  frequencia_hz: { type: Number, default: 60 },

  tensao_saida_dc_v: Number,
  corrente_saida_dc_a: Number,

  // CARACTERÍSTICAS
  eficiencia_pct: Number,
  fator_potencia: Number,
  grau_protecao_ip: String,
  temperatura_operacao: String,
  peso_kg: Number,
  dimensoes_mm: String,

  // CARREGAMENTO
  protocolo_carregamento: String,
  tipo_carregamento: String,
  tempo_carga_rapida_min: Number,
  tipo_conector: String,
  comunicacao: String,

  // PROTEÇÕES
  disjuntor_recomendado_a: Number,
  dr_recomendado_ma: Number,
  bitola_cabo_minima_mm2: Number,

  // GARANTIA E DATASHEET
  garantia_anos: Number,
  datasheet_url: String,

  ativo: { type: Boolean, default: true },
}, {
  timestamps: true,
})

export const CarregadorEV = mongoose.model('CarregadorEV', carregadorEVSchema)
