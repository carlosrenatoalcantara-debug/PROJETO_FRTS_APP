import mongoose from 'mongoose'

// ─── Subdoc schemas v3 ────────────────────────────────────────────────────────
// Todos os subdocs abaixo são NOVOS (S2.7 additive).
// Campos legados de v2 permanecem intocados imediatamente abaixo.
// Compatibilidade total: documentos v2 existentes leem estes campos como null/[].

/**
 * Localização estruturada (v3).
 * Espelha os campos flat de v2 (latitude/longitude/endereco_completo/geocoding_*)
 * mas em subdoc próprio para o Wizard v2 salvar de forma atômica.
 */
const localizacaoV3Schema = new mongoose.Schema({
  endereco_completo:    { type: String,  default: null },
  latitude:             { type: Number,  default: null },
  longitude:            { type: Number,  default: null },
  cep:                  { type: String,  default: null },
  cidade:               { type: String,  default: null },
  estado:               { type: String,  default: null },
  geocoding_origem: {
    type: String,
    enum: ['gemini_vision','nominatim_completo','nominatim_parcial',
           'cidade_estado','usuario_manual','nao_geocodificado', null],
    default: null,
  },
  geocoding_confianca:  { type: Number,  min: 0, max: 1, default: null },
  geocodificado_em:     { type: Date,    default: null },
  irradiancia_kwh_kwp_dia: { type: Number, default: null },
  fonte_irradiancia: {
    type: String,
    enum: ['nasa_power', 'manual', 'padrao_regional', null],
    default: null,
  },

  // ── S2.10-prep: Fundação Climática ───────────────────────────────────────
  // Dados de temperatura histórica do local — usados pelo motor elétrico FV
  // futuro para Voc corrigido, string sizing, validação MPPT e sobretensão.
  //
  // temperatura_min_historica_c: temperatura mínima absoluta do ano (°C)
  //   → crítica para Voc_max (tensão em circuito aberto no frio)
  //   → determina o PIOR CASO de tensão no string (maior Voc = mais perigoso)
  //   → base do cálculo: Voc_corr = Voc_STC × [1 + αVoc × (Tmin − 25)]
  //
  // temperatura_max_historica_c: temperatura máxima absoluta do ano (°C)
  //   → crítica para Pmax (potência real gerada no calor)
  //   → afeta sizing de cabos e MPPT range no verão
  //
  // temperatura_media_c: temperatura média anual (°C)
  //   → usada para cálculo de geração anual corrigida por temperatura
  //
  // temperatura_referencia_c: STC (Standard Test Conditions) = 25 °C
  //   → valor fixo da norma IEC 61215; mantido aqui para rastreabilidade
  //
  // fonte_climatica: quem preencheu (manual, nasa_power, inmet, meteostat, etc.)
  // fonte_climatica_confianca: 0–1 (1 = fonte oficial verificada)
  // atualizado_clima_em: timestamp da última atualização dos dados climáticos

  temperatura_min_historica_c: { type: Number, default: null },
  temperatura_max_historica_c: { type: Number, default: null },
  temperatura_media_c:         { type: Number, default: null },
  temperatura_referencia_c:    { type: Number, default: 25   },
  fonte_climatica:             { type: String, default: 'manual' },
  fonte_climatica_confianca:   { type: Number, default: null },
  atualizado_clima_em:         { type: Date,   default: null },
}, { _id: false })

/**
 * Dimensionamento estruturado (v3).
 * Substitui os campos flat potencia_kwp / geracao_mensal_kwh de v2.
 * Os campos flat são mantidos para compatibilidade.
 */
const dimensionamentoV3Schema = new mongoose.Schema({
  potencia_kwp:         { type: Number, default: null },
  geracao_mensal_kwh:   { type: Number, default: null },
  geracao_anual_kwh:    { type: Number, default: null },
  num_paineis:          { type: Number, default: null },
  num_strings:          { type: Number, default: null },
  num_inversores:       { type: Number, default: null },
  performance_ratio:    { type: Number, default: null },  // fator de desempenho (tipicamente 0.75-0.85)
  fator_capacidade:     { type: Number, default: null },
  area_total_m2:        { type: Number, default: null },
  metodo: {
    type: String,
    enum: ['automatico', 'manual', null],
    default: null,
  },
  calculado_em:         { type: Date,   default: null },
}, { _id: false })

/**
 * Layout solar estruturado (v3).
 * Espelha/expande o campo flat `telhado` de v2.
 * O campo `telhado` original é mantido para compatibilidade com MapaTelhado/LayoutTelhado.
 */
const layoutSolarV3Schema = new mongoose.Schema({
  pontos:               [[Number]],       // pares [lat, lng] dos vértices do telhado
  area_util_m2:         { type: Number,  default: null },
  orientacao:           { type: String,  default: null },  // 'Norte', 'Sul', 'Leste', 'Oeste', etc.
  inclinacao_graus:     { type: Number,  default: null },
  tipo_telhado: {
    type: String,
    enum: ['ceramico', 'metalico', 'fibrocimento', 'laje', 'madeira', 'outro', null],
    default: null,
  },
  sombreamento_pct:     { type: Number,  min: 0, max: 100, default: null },
  imagem_satelite_url:  { type: String,  default: null },

  // ── S6: Geoespacial multi-pano (additive) ────────────────────────────────
  // roof_planes e obstaculos são Mixed (estrutura definida no geoEngine).
  roof_planes:          { type: mongoose.Schema.Types.Mixed, default: null },
  obstaculos:           { type: mongoose.Schema.Types.Mixed, default: null },
  area_bruta_m2:        { type: Number,  default: null },
  capacidade_max_modulos: { type: Number, default: null },
  fator_sombra_medio:   { type: Number,  default: null },
  fator_geracao_medio:  { type: Number,  default: null },
}, { _id: false })

/**
 * Proteções elétricas (v3 — novo).
 * Calculado pelo motor de dimensionamento (S2.9+).
 */
const protecoesV3Schema = new mongoose.Schema({
  dps_string: {
    tipo:        { type: String, default: null },
    corrente_a:  { type: Number, default: null },
    tensao_v:    { type: Number, default: null },
    quantidade:  { type: Number, default: null },
  },
  disjuntor_ca: {
    tipo:        { type: String, default: null },
    corrente_a:  { type: Number, default: null },
    fases:       { type: Number, default: null },
  },
  dps_ca: {
    tipo:        { type: String, default: null },
    corrente_a:  { type: Number, default: null },
    tensao_v:    { type: Number, default: null },
  },
  seccionadora: {
    corrente_a:  { type: Number, default: null },
    tensao_v:    { type: Number, default: null },
  },
  cabo_string_mm2:     { type: Number, default: null },
  cabo_ca_mm2:         { type: Number, default: null },
}, { _id: false })

/**
 * Orçamento estruturado (v3).
 * Expande e substitui o subdoc `financeiro` de v2 em novos projetos.
 * O subdoc `financeiro` legado é mantido intocado.
 */
const orcamentoV3Schema = new mongoose.Schema({
  custo_total_r:        { type: Number, default: null },
  custo_equipamentos_r: { type: Number, default: null },
  custo_mao_obra_r:     { type: Number, default: null },
  custo_outros_r:       { type: Number, default: null },
  margem_pct:           { type: Number, default: null },
  preco_venda_r:        { type: Number, default: null },
  irr_pct:              { type: Number, default: null },
  npv_r:                { type: Number, default: null },
  payback_anos:         { type: Number, default: null },
  payback_meses:        { type: Number, default: null },
  economia_mensal_r:    { type: Number, default: null },
  economia_anual_r:     { type: Number, default: null },
  economia_25anos_r:    { type: Number, default: null },
  co2_evitado_t:        { type: Number, default: null },
  tarifa_kwh:           { type: Number, default: null },
  reajuste_anual_pct:   { type: Number, default: null },
  calculado_em:         { type: Date,   default: null },
}, { _id: false })

/**
 * Proposta comercial (v3 — novo).
 * Gerada no Wizard v2 Etapa 8.
 */
const propostaV3Schema = new mongoose.Schema({
  numero:          { type: String, default: null },
  versao:          { type: Number, default: 1 },
  status: {
    type: String,
    enum: ['rascunho', 'enviada', 'aceita', 'recusada', 'expirada', null],
    default: null,
  },
  validade_dias:   { type: Number, default: 30 },
  enviada_em:      { type: Date,   default: null },
  aceita_em:       { type: Date,   default: null },
  pdf_url:         { type: String, default: null },
  template_id:     { type: String, default: null },
  observacoes:     { type: String, default: null },
}, { _id: false })

/**
 * Workflow do wizard (v3 — novo).
 * Rastreia progresso do usuário no Wizard v2.
 * Alimentado pelo endpoint PUT /etapa.
 */
const workflowV3Schema = new mongoose.Schema({
  etapa_atual:          { type: Number, default: 1 },       // etapa corrente (1–8)
  etapas_completas:     [{ type: Number }],                  // ex: [1, 2, 3]
  iniciado_em:          { type: Date,   default: null },
  ultima_atividade:     { type: Date,   default: null },
  fluxo_origem: {
    type: String,
    enum: ['wizard_v2', 'funil_v2', 'manual', null],
    default: null,
  },
  usuario_responsavel:  { type: String, default: null },     // userId ou email
}, { _id: false })

/**
 * Unifilar (v3 — novo).
 * Gerado pelo unifilarController; persistido aqui para cache e histórico.
 */
const unifilarV3Schema = new mongoose.Schema({
  svg_data:     { type: String,  default: null },
  gerado_em:    { type: Date,    default: null },
  versao:       { type: Number,  default: null },
  configuracao: { type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: false })

/**
 * Engenharia Elétrica FV (v3 — S2.11.2, additive).
 *
 * Persiste o resultado de compatibilidadeEletricaService após confirmação
 * consciente pelo usuário (botão "Salvar"). Nunca auto-gravado.
 *
 * ── Subcampos ────────────────────────────────────────────────────────────────
 *  arranjo              Configuração de strings escolhida
 *  clima_utilizado      Dados climáticos enviados na análise
 *  compatibilidade      Resultado do motor: compatível, diagnósticos, margens
 *
 * ── Retrocompatibilidade ─────────────────────────────────────────────────────
 *  default: null → documentos v2/v3 sem este campo leem como null (sem erro)
 */
const engenhariaEletricaV3Schema = new mongoose.Schema({
  // Arranjo de strings escolhido pelo engenheiro
  arranjo: {
    quantidade_modulos_por_string: { type: Number, default: null },
    quantidade_strings_paralelo:   { type: Number, default: null },
    total_modulos:                 { type: Number, default: null },
  },

  // Dados climáticos usados na análise (pode ser fallback ou dados reais)
  clima_utilizado: {
    cidade:                     { type: String,  default: null },
    uf:                         { type: String,  default: null },
    temperatura_min_historica_c:{ type: Number,  default: null },
    temperatura_max_historica_c:{ type: Number,  default: null },
    fonte:                      { type: String,  default: null },
    usou_fallback:              { type: Boolean, default: null },
  },

  // Resultado da última análise de compatibilidade salva
  compatibilidade: {
    versao_motor:   { type: String,  default: null },
    compativel:     { type: Boolean, default: null },

    // Array de objetos { codigo, severidade, mensagem, explicacao_curta, valores }
    // Mixed porque a estrutura interna varia por tipo de diagnóstico
    diagnosticos:   { type: mongoose.Schema.Types.Mixed, default: null },

    // Objeto com margem_tensao_percentual, margem_mppt_max_percentual, etc.
    margens:        { type: mongoose.Schema.Types.Mixed, default: null },

    // Subset dos cálculos principais (voc_string_max, vmpp_string_frio, fator_oversizing…)
    calculos_principais: { type: mongoose.Schema.Types.Mixed, default: null },

    // Timestamp da análise — permite detectar dados desatualizados
    analisado_em:   { type: Date, default: null },
  },
}, { _id: false })

/**
 * Governança Técnica (v3 — S3.5, additive).
 *
 * Congela snapshots imutáveis do projeto no momento da proposta/homologação.
 * Após CONGELADO, o projeto NÃO depende mais do catálogo vivo nem de
 * recálculos automáticos: os snapshots são a fonte de verdade.
 *
 * ── Retrocompatibilidade ─────────────────────────────────────────────────────
 *  default: null → projetos v2/v3 antigos leem governanca como null (sem erro).
 *  Nada é recalculado ou congelado automaticamente — só via ação explícita.
 */
const snapshotUnifilarV3Schema = new mongoose.Schema({
  svg:       { type: String, default: null },
  hash:      { type: String, default: null },
  criado_em: { type: Date,   default: null },
  versao:    { type: String, default: null },
}, { _id: false })

const revisaoV3Schema = new mongoose.Schema({
  rev:                 { type: String, default: null },   // 'A', 'B', 'C'...
  timestamp:           { type: Date,   default: Date.now },
  usuario:             { type: String, default: null },
  motivo:              { type: String, default: null },
  alteracoes:          { type: String, default: null },
  engineering_version: { type: String, default: null },
  // Cópia congelada dos snapshots no momento da revisão (auditoria)
  snapshots:           { type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: false })

const auditoriaV3Schema = new mongoose.Schema({
  timestamp: { type: Date,   default: Date.now },
  usuario:   { type: String, default: null },
  acao:      { type: String, default: null },   // 'congelamento' | 'revisao_criada' | 'status_alterado' | 'divergencia_detectada'
  detalhe:   { type: String, default: null },
  contexto:  { type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: false })

const historicoTimelineV3Schema = new mongoose.Schema({
  timestamp: { type: Date,   default: Date.now },
  tipo:      { type: String, default: null },   // 'criado' | 'engenharia_recalculada' | 'catalogo_atualizado' | 'revisao' | 'congelado' | 'homologado'
  descricao: { type: String, default: null },
}, { _id: false })

/**
 * Comercial enterprise (S4.2 — additive dentro de governanca).
 * Workflow comercial, cenários multi-comparados, desconto/aprovação,
 * assinaturas digitais (hash+timestamp) e snapshot comercial congelável.
 */
const assinaturaV3Schema = new mongoose.Schema({
  assinatura_id: { type: String, default: null },   // S4.3: id único da assinatura
  usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // S7.2
  papel:     { type: String, default: null },        // 'cliente' | 'vendedor' | 'tecnico'
  nome:      { type: String, default: null },
  hash:      { type: String, default: null },        // S4.3: SHA-256 (hex)
  algoritmo: { type: String, default: 'sha256' },
  hash_documento: { type: String, default: null },   // hash do PDF/proposta
  hash_snapshot:  { type: String, default: null },   // hash do snapshot técnico
  hash_cenario:   { type: String, default: null },   // S4.3.1: hash do cenário assinado
  ip:        { type: String, default: null },
  ip_real:   { type: String, default: null },        // S4.3.1: IP real do cliente (trust proxy)
  forwarded_for: { type: String, default: null },    // S4.3.1: cabeçalho X-Forwarded-For bruto
  proxy_chain:   { type: [String], default: undefined }, // S4.3.1: cadeia de proxies
  user_agent:{ type: String, default: null },
  timestamp: { type: Date,   default: Date.now },
}, { _id: false })

// S4.3: revisão comercial (clona snapshot, preserva histórico, gera diff)
const revisaoComercialV3Schema = new mongoose.Schema({
  rev:        { type: String, default: null },
  timestamp:  { type: Date,   default: Date.now },
  usuario:    { type: String, default: null },
  motivo:     { type: String, default: null },
  diff:       { type: mongoose.Schema.Types.Mixed, default: null },
  snapshot_comercial: { type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: false })

const comercialV3Schema = new mongoose.Schema({
  // S4.3: máquina de estados completa (validada no controller)
  workflow_status: {
    type: String,
    enum: ['RASCUNHO', 'EM_ANALISE', 'NEGOCIACAO', 'AGUARDANDO_CLIENTE', 'APROVADO',
           'ASSINADO', 'IMPLANTACAO', 'CONCLUIDO', 'REPROVADO', 'CANCELADO', 'EXPIRADO', null],
    default: 'EM_ANALISE',
  },

  // S4.3: status jurídico (separado do operacional)
  status_juridico: {
    type: String,
    enum: ['PENDENTE_ASSINATURA', 'ASSINADO', 'EXPIRADO', 'CANCELADO', 'EM_REVISAO', null],
    default: 'PENDENTE_ASSINATURA',
  },

  // S4.3: políticas de aprovação/margem
  politicas: {
    margem_minima_pct:  { type: Number, default: 8 },
    margem_alerta_pct:  { type: Number, default: 12 },
    margem_bloqueio_pct:{ type: Number, default: 0 },
    desconto_limite_pct:{ type: Number, default: 10 },
  },

  // S4.3: congelamento por cenário { [idCenario]: { ...valores, congelado_em } }
  cenarios_congelados: { type: mongoose.Schema.Types.Mixed, default: null },

  // S4.3: revisões comerciais (clones + diff)
  revisoes_comerciais: { type: [revisaoComercialV3Schema], default: [] },
  revisao_comercial_atual: { type: String, default: 'A' },

  // S4.3.1: governança INDIVIDUAL por cenário (additive). Mixed:
  // { [scenario_id]: { scenario_id, freeze_status, workflow_status, status_juridico,
  //   snapshot_comercial, snapshot_financeiro, snapshot_regulatorio, hash,
  //   assinaturas:[], revisoes:[], timeline:[], revisao_atual, congelado_em } }
  cenarios_governanca: { type: mongoose.Schema.Types.Mixed, default: null },

  // ── S5: CRM operacional leve (separado do workflow jurídico/comercial) ──────
  crm_pipeline: {
    type: String,
    enum: ['LEAD', 'QUALIFICADO', 'PROPOSTA', 'NEGOCIACAO', 'FECHADO', 'PERDIDO', 'IMPLANTACAO', null],
    default: 'LEAD',
  },
  followup: {
    status:     { type: String, default: null },   // 'retorno_pendente' | 'aguardando_assinatura' | ...
    data:       { type: Date,   default: null },
    observacao: { type: String, default: null },
  },
  // Links públicos seguros — abrem o SNAPSHOT CONGELADO (somente leitura)
  compartilhamentos: [{
    share_id:      { type: String, default: null },
    token:         { type: String, default: null },
    cenario_id:    { type: String, default: null },
    revisao:       { type: String, default: null },
    snapshot_hash: { type: String, default: null },
    criado_em:     { type: Date,   default: Date.now },
    criado_por:    { type: String, default: null },
    validade:      { type: Date,   default: null },
    somente_leitura: { type: Boolean, default: true },
    snapshot:      { type: mongoose.Schema.Types.Mixed, default: null }, // cópia congelada exibida
    tracking: {
      visualizacoes:   { type: Number, default: 0 },
      primeiro_acesso: { type: Date,   default: null },
      ultimo_acesso:   { type: Date,   default: null },
      acessos: [{ timestamp: { type: Date }, ip: { type: String } }],
    },
  }],

  // Cenários financeiros comparados (Mixed — estrutura vem do comercialEngine)
  cenarios:      { type: mongoose.Schema.Types.Mixed, default: null },
  comparativos:  { type: mongoose.Schema.Types.Mixed, default: null },

  // Controle de desconto/aprovação
  desconto_pct:          { type: Number, default: 0 },
  desconto_limite_pct:   { type: Number, default: 10 },
  desconto_aprovado_por: { type: String, default: null },
  desconto_excecao:      { type: Boolean, default: false },
  aprovacao: { type: mongoose.Schema.Types.Mixed, default: null }, // { tipo, aprovado_por, em, observacao }

  assinaturas: { type: [assinaturaV3Schema], default: [] },

  // Snapshot comercial congelado (cenários, descontos, aprovação, PDF, assinaturas)
  snapshot_comercial: { type: mongoose.Schema.Types.Mixed, default: null },
  congelado_em:  { type: Date,   default: null },

  // Histórico comercial (quem alterou/aprovou/assinou/revisou)
  historico: [{
    timestamp: { type: Date,   default: Date.now },
    usuario:   { type: String, default: null },
    acao:      { type: String, default: null },
    detalhe:   { type: String, default: null },
  }],
}, { _id: false })

const governancaV3Schema = new mongoose.Schema({
  /** Versão do motor de engenharia que gerou os snapshots (ex: 'ENG-2.0'). */
  engineering_version: { type: String, default: null },

  /** Status do ciclo de vida da proposta. CONGELADO/HOMOLOGADO travam recálculo. */
  freeze_status: {
    type: String,
    enum: ['RASCUNHO', 'EM_REVISAO', 'CONGELADO', 'HOMOLOGADO', null],
    default: 'RASCUNHO',
  },

  revisao_atual: { type: String, default: 'A' },
  congelado_em:  { type: Date,   default: null },
  congelado_por: { type: String, default: null },

  // Snapshots congelados — Mixed porque a estrutura espelha o motor de engenharia
  snapshot_tecnico:    { type: mongoose.Schema.Types.Mixed, default: null },
  snapshot_geoespacial:{ type: mongoose.Schema.Types.Mixed, default: null }, // S6
  snapshot_empresa:    { type: mongoose.Schema.Types.Mixed, default: null }, // S7.1
  snapshot_tecnico_identificacao: { type: mongoose.Schema.Types.Mixed, default: null }, // S7.1
  snapshot_responsavel_tecnico:   { type: mongoose.Schema.Types.Mixed, default: null }, // S8.3.2 (RT congelado)
  snapshot_catalogo:   { type: mongoose.Schema.Types.Mixed, default: null },
  snapshot_unifilar:   { type: snapshotUnifilarV3Schema,     default: null },
  snapshot_memorial:   { type: mongoose.Schema.Types.Mixed, default: null },
  snapshot_financeiro: { type: mongoose.Schema.Types.Mixed, default: null },

  revisoes:  { type: [revisaoV3Schema],          default: [] },
  auditoria: { type: [auditoriaV3Schema],        default: [] },
  historico: { type: [historicoTimelineV3Schema], default: [] },

  /** Comercial enterprise (S4.2). */
  comercial: { type: comercialV3Schema, default: null },
}, { _id: false })

// ─── Schema principal ─────────────────────────────────────────────────────────

const projetoFVSchema = new mongoose.Schema({
  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cliente',
    required: true,
  },
  // ── S7.2: organização multiempresa/equipe (additive, default null = "default") ──
  empresa_id:            { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa',  default: null },
  vendedor_id:           { type: mongoose.Schema.Types.ObjectId, ref: 'Vendedor', default: null },
  tecnico_principal_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Tecnico',  default: null },
  tecnico_secundario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tecnico',  default: null },
  nome: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    // S8.4 — ciclo de vida estendido (mantém valores legados para compat):
    enum: ['rascunho', 'em_simulacao', 'em_analise', 'dimensionado', 'proposta', 'aprovado', 'em_execucao', 'concluido', 'perdido', 'cancelado', 'arquivado'],
    default: 'rascunho',
  },
  // S8.4 — soft delete + arquivamento + flags de saúde
  excluido:               { type: Boolean, default: false, index: true },
  excluido_em:            { type: Date,    default: null },
  excluido_por:           { type: String,  default: null },
  arquivado_em:           { type: Date,    default: null },
  arquivado_por:          { type: String,  default: null },
  motivo_arquivamento:    { type: String,  default: null },
  legacy:                 { type: Boolean, default: false },
  necessita_revisao:      { type: Boolean, default: false },
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
  geocoding_origem: {
    type: String,
    default: null,
  },
  geocoding_confianca: {
    type: Number,
    default: null,
  },
  geocodificado_em: {
    type: Date,
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
      // S2.7: referência opcional ao CatalogoEquipamento (preenchida a partir de S2.9)
      equipamento_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Equipamento',
        default: null,
      },
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
    // S9.0 — Homologação Assistida (aditivo, não substitui o `status` legado)
    status_homologacao: {
      type: String,
      enum: ['nao_iniciado', 'em_preparacao', 'pendente_documentacao', 'pendente_engenharia', 'pendente_concessionaria', 'homologado', 'reprovado', null],
      default: null,
    },
    historico_status: [{
      em: { type: Date, default: Date.now },
      de: String, para: String, por: String, motivo: String,
    }],
    iniciada_em: Date,
    iniciada_por: String,
    concluida_em: Date,
    concluida_por: String,
  },
  observacoes: String,

  // ─── S2.7: Campos v3 (additive — não alteram documentos existentes) ─────────
  // Todos opcionais/null por padrão. Documentos v2 continuam válidos.

  /** Versão do schema. v2 = legado (sem este campo). v3 = migrado/criado via wizard v2. */
  schema_version: {
    type: Number,
    default: 2,
  },

  /** Localização estruturada. Espelha/substitui latitude/longitude/geocoding_* flat de v2. */
  localizacao: {
    type: localizacaoV3Schema,
    default: null,
  },

  /** Dimensionamento estruturado. Espelha/expande potencia_kwp / geracao_mensal_kwh de v2. */
  dimensionamento: {
    type: dimensionamentoV3Schema,
    default: null,
  },

  /** Layout solar estruturado. Espelha/expande `telhado` de v2. */
  layout_solar: {
    type: layoutSolarV3Schema,
    default: null,
  },

  /** Proteções elétricas (DPS, disjuntores, cabos). */
  protecoes: {
    type: protecoesV3Schema,
    default: null,
  },

  /** Orçamento estruturado. Expande o subdoc `financeiro` de v2. */
  orcamento: {
    type: orcamentoV3Schema,
    default: null,
  },

  /** Proposta comercial gerada no Wizard v2 Etapa 8. */
  proposta: {
    type: propostaV3Schema,
    default: null,
  },

  /** Rastreamento de progresso no Wizard v2. */
  workflow: {
    type: workflowV3Schema,
    default: null,
  },

  /** SVG do diagrama unifilar persistido. */
  unifilar: {
    type: unifilarV3Schema,
    default: null,
  },

  /**
   * Engenharia elétrica FV (S2.11.2 — additive).
   * Persiste arranjo, clima e resultado de compatibilidade confirmados pelo usuário.
   * Projetos v2/v3 sem este campo leem null sem nenhum erro.
   */
  engenharia_eletrica: {
    type: engenhariaEletricaV3Schema,
    default: null,
  },

  /**
   * Governança técnica (S3.5 — additive).
   * Snapshots congelados, versionamento de engenharia, revisões e auditoria.
   * Projetos antigos sem este campo leem null — nada é congelado automaticamente.
   */
  governanca: {
    type: governancaV3Schema,
    default: null,
  },

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

    // S2.5 — Metadados do geocoding (frontend faz, backend persiste)
    geocoding_origem: {
      type: String,
      enum: [
        'gemini_vision',        // Gemini retornou coords direto
        'nominatim_completo',   // OSM bateu com endereço completo
        'nominatim_parcial',    // OSM bateu só com rua / fragmento
        'cidade_estado',        // fallback: centróide da cidade/estado
        'usuario_manual',       // ajuste manual no mapa
        'nao_geocodificado',    // falha — coords null
        null,
      ],
      default: null,
    },
    geocoding_confianca: { type: Number, min: 0, max: 1, default: null },
    geocodificado_em: { type: Date, default: null },

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
