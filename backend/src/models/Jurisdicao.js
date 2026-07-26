import mongoose from 'mongoose'

/**
 * Jurisdicao — Fase 0 (Fundação Transversal) · ADR-021 Parte 4
 *
 * Aggregate Root do topo do Contexto Regulatório. Representa o território legal
 * onde um projeto existe e as convenções que dele decorrem.
 *
 * É o que torna o modelo internacionalizável: adicionar um país é criar uma
 * Jurisdição, não alterar o núcleo (ADR-021 §4).
 *
 * ── FRONTEIRA ──────────────────────────────────────────────────────────────
 * A Jurisdição é o PAÍS. Estados/províncias são SUBDIVISÕES internas — não
 * jurisdições próprias. Modelar cada UF como jurisdição duplicaria moeda,
 * unidades e normas nacionais 27 vezes e tornaria impossível responder
 * "qual a moeda do Brasil?" sem escolher arbitrariamente uma UF.
 *
 * ── TENANCY ────────────────────────────────────────────────────────────────
 * GLOBAL. "Brasil/SP" é o mesmo fato para toda organização — não possui
 * empresa_id (ver classificação em `dominio/tenancy`).
 *
 * ── ISOLAMENTO (Fase 0) ────────────────────────────────────────────────────
 * Nasce SEM consumidores. Nenhum agregado a referencia ainda.
 * Autoridade Reguladora vira Aggregate Root próprio na Fase 2, quando passar a
 * emitir Políticas Regulatórias versionadas. Aqui é entidade interna — não há
 * ciclo de vida independente enquanto não emite políticas.
 *
 * ── FORA DO ESCOPO ─────────────────────────────────────────────────────────
 * Política Regulatória, Requisito Documental, Regra de Validação e Agente de
 * Conexão (distribuidora) são Fase 2 — Homologação.
 */

// ── Subdivisão (estado / província / região) ────────────────────────────────
const SubdivisaoSchema = new mongoose.Schema({
  codigo: { type: String, required: true, uppercase: true, trim: true },  // SP, RJ, CA...
  nome:   { type: String, required: true },
  tipo:   { type: String, default: null },   // 'estado' | 'provincia' | 'departamento'
  // Fuso próprio quando difere do padrão nacional (ex.: AC no Brasil).
  fuso_horario: { type: String, default: null },
}, { _id: true })

// ── Autoridade Reguladora (entidade interna nesta fase) ─────────────────────
const AutoridadeSchema = new mongoose.Schema({
  nome:   { type: String, required: true },   // Agência Nacional de Energia Elétrica
  sigla:  { type: String, default: null },    // ANEEL
  // SEM enum: o escopo regulatório varia por país e evolui. Exemplos correntes:
  // 'supranacional' (UE), 'nacional', 'subnacional', 'regional', 'municipal'.
  // Fechar em enum obrigaria alterar o Core a cada novo país — proibido pela ADR-021.
  escopo: { type: String, default: 'nacional' },
  // Preenchido quando o escopo é subnacional; referencia SubdivisaoSchema.codigo.
  subdivisao_codigo: { type: String, default: null, uppercase: true },
  // Áreas sobre as quais a autoridade legisla (energia, edificações, proteção...).
  competencias: { type: [String], default: [] },
  // Extensão livre para particularidades de jurisdição sem alterar o Core.
  metadados: { type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: true })

// ── Norma técnica aplicável no território ───────────────────────────────────
const NormaTecnicaSchema = new mongoose.Schema({
  codigo:     { type: String, required: true },   // NBR 16690, IEC 62446, NEC 690
  titulo:     { type: String, default: null },
  // SEM enum: disciplinas crescem (FV, EV, BESS, SPDA, Retrofit, …). Fechar aqui
  // obrigaria alterar o Core a cada nova disciplina — o oposto da ADR-021 Parte 3.
  disciplina: { type: String, default: null },
  obrigatoria:{ type: Boolean, default: true },
  // Vigência da norma no território (edições se sucedem: NBR 5410:2004 → :2024).
  versao:            { type: String, default: null },
  vigencia_inicio:   { type: Date,   default: null },
  vigencia_fim:      { type: Date,   default: null },
  // Extensão livre sem alterar o Core.
  metadados: { type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: true })

// ── Aggregate Root ──────────────────────────────────────────────────────────
const JurisdicaoSchema = new mongoose.Schema({
  // Identidade natural: código ISO 3166-1 do país.
  pais_iso: {
    type: String, required: true, unique: true,
    uppercase: true, trim: true, minlength: 2, maxlength: 3,
  },
  nome: { type: String, required: true },

  // ── Convenções que decorrem da jurisdição (ADR-021 O-2 / O-3) ────────────
  moeda_iso: { type: String, default: null, uppercase: true, maxlength: 3 },  // BRL, USD
  sistema_unidades: {
    type: String,
    enum: ['metrico', 'imperial'],
    default: 'metrico',
  },
  fuso_horario_padrao: { type: String, default: null },
  idioma_padrao:       { type: String, default: null },

  // ── Composição ───────────────────────────────────────────────────────────
  subdivisoes: { type: [SubdivisaoSchema],   default: [] },
  autoridades: { type: [AutoridadeSchema],   default: [] },
  normas:      { type: [NormaTecnicaSchema], default: [] },

  ativa:          { type: Boolean, default: true, index: true },
  _schema_versao: { type: String,  default: '1.0' },
}, { timestamps: true })

export const Jurisdicao = mongoose.model('Jurisdicao', JurisdicaoSchema)
export default Jurisdicao
