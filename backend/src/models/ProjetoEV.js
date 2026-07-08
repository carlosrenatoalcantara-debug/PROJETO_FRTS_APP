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

  // BUG-015: última etapa do wizard em que o usuário salvou (1..4). "Editar Projeto"
  // reabre exatamente nesta etapa, restaurando o estado salvo (não reinicia o wizard).
  ultimaEtapa: { type: Number, min: 1, max: 4, default: 1 },

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
    tensao_entrada_v: Number,
    corrente_entrada_a: Number,
  }],
  quantidade_pontos: Number,
  potencia_total_kw: Number,
  tipo_carregamento: { type: String, default: 'AC' }, // AC, DC, Misto

  // MODO DE OPERAÇÃO (NBR IEC 61851-1:2021)
  modo_operacao: { type: Number, enum: [1, 2, 3, 4], default: 1 },
  tipo_conector: String, // IEC 62196-2, Tesla, CCS, CHAdeMO

  // INSTALAÇÃO
  tensao_sistema: { type: Number, default: 220 },
  fases: { type: Number, enum: [1, 3], default: 3 },
  frequencia_hz: { type: Number, default: 60 },
  comprimento_cabo_m: Number,
  localizacao_instacao: String,

  // FEATURE-006: corrente aferida na fase destinada ao carregador durante a vistoria
  // técnica. Pertence ao Projeto EV (medição específica desta instalação, não do
  // cadastro do cliente). Usada APENAS pelo Memorial (seção Disponibilidade Elétrica).
  // null = não aferida → o memorial imprime espaço em branco para preenchimento manual.
  corrente_aferida_a: { type: Number, default: null },

  // CÁLCULOS NBR 5410
  calculos_nbr: {
    corrente_projeto_a: Number,
    corrente_maxima_a: Number,
    bitola_cabo_mm2: Number,
    disjuntor_a: Number,
    dr_ma: Number,
    dps_kv: Number,
    dps_capacidade_a: Number,
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

  // ATERRAMENTO E PROTEÇÃO (NBR 5410:2004)
  resistencia_aterramento_ohms: Number,
  resistencia_aterramento_conformidade: String, // 'Excelente', 'Aceitável', 'Não conforme'

  // NORMAS APLICADAS
  normas_aplicadas: {
    type: [String],
    default: [
      'ABNT NBR 17019:2022',
      'ABNT NBR 5410:2004',
      'ABNT NBR IEC 61851-1:2021',
      'ABNT NBR IEC 62196-1/2/3:2021',
    ],
  },

  // CONFORMIDADE COM NORMAS
  conformidade_norms: {
    corrente_ok: Boolean,
    bitola_ok: Boolean,
    queda_tensao_ok: Boolean,
    disjuntor_ok: Boolean,
    dr_ok: Boolean,
    aterramento_ok: Boolean,
    spda_necessario: Boolean,
    conforme: Boolean, // Todos os requisitos foram atendidos
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

  // DIAGRAMA UNIFILAR — JSON canônico do DiagramEngine (P3-EV-UNIFILAR-ENGINE-01)
  // Fonte única de verdade: o layout base é SEMPRE recalculado pelo Engine a partir
  // do projeto elétrico; persistimos apenas version/viewport/metadata/overrides.
  // nodes/edges permanecem por retrocompatibilidade (projetos antigos) e como cache
  // resolvido para o renderizador de PDF.
  diagrama_editado: {
    version:   { type: String, default: null },                          // ex.: "2.0"
    viewport:  { type: mongoose.Schema.Types.Mixed, default: null },      // { x, y, zoom }
    metadata:  { type: mongoose.Schema.Types.Mixed, default: null },      // { modelo, criadoPor, atualizadoEm, ... }
    overrides: { type: mongoose.Schema.Types.Mixed, default: null },      // edições manuais por id de componente
    nodes:     { type: mongoose.Schema.Types.Mixed, default: null },      // retrocompat + cache resolvido
    edges:     { type: mongoose.Schema.Types.Mixed, default: null },      // retrocompat + cache resolvido
    timestamp: { type: Date, default: null },
  },

  // ─── EV-ALIGN-01: estrutura compatível com governança / AlertCenter / homologação ──
  // RT por referência (alinhado com ProjetoFV.tecnico_principal_id)
  tecnico_principal_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tecnico', default: null },

  // Snapshot imutável do carregador no momento da vinculação (não duplica o
  // documento — guarda apenas as referências e snapshot de specs críticas).
  // Permite que documentos futuros usem este snapshot ao invés do cadastro vivo.
  snapshot_carregador: {
    carregador_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'CarregadorEV', default: null },
    equipamento_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Equipamento',  default: null },
    fabricante:        { type: String, default: null },
    modelo:            { type: String, default: null },
    potencia_kw:       { type: Number, default: null },
    corrente_max_a:    { type: Number, default: null },
    tensao_v:          { type: Number, default: null },
    tipo_conector:     { type: String, default: null },
    fases:             { type: Number, default: null },
    datasheet_hash:    { type: String, default: null },
    datasheet_url:     { type: String, default: null },
    documento_id:      { type: mongoose.Schema.Types.ObjectId, default: null },
    data_snapshot:     { type: Date,   default: null },
    por:               { type: String, default: null },
  },

  // Governança mínima compatível com FV (snapshots + freeze_status + auditoria).
  // Mixed para flexibilidade sem migração futura.
  governanca: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },

  // Homologação assistida (status alinhado com ProjetoFV.homologacao.status_homologacao)
  homologacao: {
    status_homologacao: {
      type: String,
      enum: ['nao_iniciado', 'em_preparacao', 'pendente_documentacao', 'pendente_engenharia', 'pendente_concessionaria', 'homologado', 'reprovado', null],
      default: null,
    },
    concessionaria:   { type: String, default: null },
    iniciada_em:      Date,
    iniciada_por:     String,
    concluida_em:     Date,
    concluida_por:    String,
    historico_status: [{ em: { type: Date, default: Date.now }, de: String, para: String, por: String, motivo: String }],
  },
}, {
  timestamps: true,
  strict: false,  // Permite campos extras sem erro silencioso
})

export const ProjetoEV = mongoose.model('ProjetoEV', projetoEVSchema)
