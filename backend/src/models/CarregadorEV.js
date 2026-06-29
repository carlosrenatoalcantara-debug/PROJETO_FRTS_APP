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
    // REMOVIDO: enum restritivo causava falhas silenciosas
    // Validar apenas que é um número positivo
    validate: {
      validator: function(v) {
        return v > 0 && v < 500
      },
      message: 'Potência deve estar entre 0 e 500 kW'
    }
  }, // ✅ Aceita qualquer valor razoável de potência
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
  frequencia_hz: Number,   // P2-EV-CATALOG-SIMPLIFICATION-01: sem default (não inventar 60Hz)

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
  tipo_conector: String,   // Tipo 1 | Tipo 2 | CCS2 | GB/T | NACS
  comunicacao: String,
  // P1-EV-CADASTRO-SIMPLIFICADO-01 (ADITIVO) — cadastro mínimo operacional
  qtd_conectores: { type: Number, default: 1 },
  ocpp: { type: Boolean, default: null },

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
