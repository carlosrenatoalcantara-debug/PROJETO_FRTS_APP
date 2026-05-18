import mongoose from 'mongoose'

const projetoFVSchema = new mongoose.Schema({
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
  endereco_completo: {
    type: String,
    default: '',
  },
  latitude: {
    type: Number,
    default: null,
  },
  longitude: {
    type: Number,
    default: null,
  },
  unidades_consumidoras: [{
    regra: {
      type: String,
      enum: ['GD II', 'GD III'],
      default: 'GD II',
    },
    grupo: {
      type: String,
      enum: ['A', 'B'],
      default: 'B',
    },
    subgrupo: String,
    consumo_mensal_kwh: Number,
    fator_geracao: Number,
    fase_tensao: {
      type: String,
      enum: ['Monofásico', 'Bifásico', 'Trifásico'],
      default: 'Monofásico',
    },
    tarifa_media: Number,
  }],
  consumo_anual_kwh: {
    type: Number,
    default: 0,
  },
  irradiancia_local: {
    type: Number,
    default: 131.44,
    comment: 'kWh/kWp/dia',
  },
  telhado: {
    pontos: [[Number]],
    area_m2: Number,
    orientacao: String,
    inclinacao: Number,
  },
  potencia_kwp: {
    type: Number,
    default: 0,
  },
  geracao_mensal_kwh: {
    type: Number,
    default: 0,
  },
  equipamentos: {
    paineis: [{
      id: String,
      marca: String,
      modelo: String,
      potencia_w: Number,
      quantidade: Number,
    }],
    inversor: {
      id: String,
      marca: String,
      modelo: String,
      potencia_kw: Number,
      tipo: String,
      fases: Number,
    },
    estrutura: {
      tipo: String,
      descricao: String,
    },
  },
  strings: [{
    id: String,
    numero: Number,
    paineis: Number,
    potencia_total_w: Number,
    tensao_voc: Number,
  }],
  bess: {
    presente: { type: Boolean, default: false },
    capacidade_kwh: Number,
    tipo: String,
    marca: String,
  },
  financeiro: {
    custo_total_r: Number,
    custo_painel_r: Number,
    custo_inversor_r: Number,
    custo_estrutura_r: Number,
    custo_mao_obra_r: Number,
    custo_bess_r: Number,
    irr_pct: Number,
    npv_r: Number,
    payback_anos: Number,
    geracao_25anos_kwh: Number,
    economia_25anos_r: Number,
  },
  homologacao: {
    status: {
      type: String,
      enum: ['rascunho', 'enviado', 'analise', 'aprovado', 'conectado'],
      default: 'rascunho',
    },
    data_envio: Date,
    concessionaria: String,
    documento_memorial: String,
    documento_carta: String,
    documento_art: String,
    checklist_documentos: {
      memoria_descritivo: Boolean,
      carta_concessionaria: Boolean,
      art: Boolean,
      projeto_execucao: Boolean,
      anotacao_responsavel: Boolean,
      laudo_conformidade: Boolean,
    },
  },
  observacoes: String,

  // ─── S2: Extração da conta de energia ──────────────────────────────────────
  // Schema ESTRITO no nível superior. Mixed APENAS nos campos que
  // legitimamente precisam ser heterogêneos (dados_brutos do parser).
  fatura_extracao: {
    arquivo_original_nome: { type: String, default: null },
    extraido_em: { type: Date, default: null },
    metodo: {
      type: String,
      enum: ['gemini_vision', 'pdf_parse', 'manual', null],
      default: null,
    },
    confianca: { type: Number, min: 0, max: 1, default: null },
    confirmado_pelo_usuario: { type: Boolean, default: false },

    // Campos extraídos — todos opcionais, tipos estritos
    nome: { type: String, default: null },
    cpf_cnpj: { type: String, default: null },
    telefone: { type: String, default: null },
    numero_cliente: { type: String, default: null },
    codigo_instalacao: { type: String, default: null },
    endereco: { type: String, default: null },
    cep: { type: String, default: null },
    cidade: { type: String, default: null },
    estado: { type: String, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },

    concessionaria: { type: String, default: null },
    grupo_tarifario: { type: String, default: null },     // "A" / "B"
    classificacao: { type: String, default: null },       // B1, A4, etc.
    subgrupo: { type: String, default: null },            // Residencial / Comercial...
    tipo_ligacao: { type: String, default: null },        // Monofásico / Bifásico / Trifásico
    tensao_v: { type: Number, default: null },
    demanda_contratada_kw: { type: Number, default: null },

    consumo_mensal_kwh: { type: Number, default: null },
    media_anual_kwh: { type: Number, default: null },
    historico_12meses: [{
      mes: { type: String },
      consumo: { type: Number },
    }],
    periodo_meses: { type: Number, default: null },

    valor_total_r: { type: Number, default: null },
    valor_kwh: { type: Number, default: null },
    irradiancia_local: { type: Number, default: null },

    // Heterogêneo (snapshot do que o parser retornou — para auditoria/reprocessamento)
    dados_brutos: { type: mongoose.Schema.Types.Mixed, default: null },
  },
}, {
  timestamps: true,
  // strict permanece TRUE (default). Apenas dados_brutos é Mixed dentro do subdoc.
})

export const ProjetoFV = mongoose.model('ProjetoFV', projetoFVSchema)
