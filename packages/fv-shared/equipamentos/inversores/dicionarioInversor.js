/**
 * dicionarioInversor.js — P0-INV-SSOT-01
 *
 * FONTE ÚNICA DE VERDADE (SSOT) do vocabulário de inversores do Forte Solar.
 *
 * Antes desta sprint, CADA consumidor tinha sua própria lista de aliases:
 *   - backend  services/catalogoQualidade.js        (pick locais)
 *   - frontend utils/catalogQualityEngine.js         (pick locais)
 *   - backend  services/compatibilidadeFV.js         (|| locais, dimensionamento)
 *   - backend  utils/catalogo/fichaTecnicaMap.js     (aliases por slot)
 * Resultado: o mesmo inversor lido de 4 formas → notas divergentes (causa raiz D).
 *
 * Agora TODOS leem o MESMO objeto persistido (`Equipamento.especificacoes`) por
 * meio deste dicionário. PURO (sem I/O, sem deps node) → importável do backend e
 * do frontend (mesmo padrão de fichaTecnicaMap.js).
 *
 * Nome canônico = o nome que o PARSER determinístico grava (produtor principal).
 * `aliases` agrega TODA grafia histórica (parser, Claude/Gemini, seeds legados,
 * catalogoQualidade, compatibilidadeFV). `peso` espelha PESOS_INVERSOR (soma 100,
 * incluindo identificacao=15) — preservando a semântica de score existente.
 */

// campo canônico → { aliases[], grupo, peso?, tipo? }
export const CAMPOS_INVERSOR = {
  // ── Saída CA ──────────────────────────────────────────────────────────────
  potencia_kw:           { grupo: 'CA', peso: 10, aliases: ['potencia_kw', 'potencia_nominal_kw', 'potencia_kw_ca', 'potenciaKW', 'potencia'] },
  potencia_maxima_kw:    { grupo: 'CA',           aliases: ['potencia_maxima_kw', 'potencia_max'] },
  potencia_aparente_kva: { grupo: 'CA',           aliases: ['potencia_aparente_kva'] },
  tensao_ac:             { grupo: 'CA', peso: 5,  aliases: ['tensao_ac', 'tensao_ac_nominal', 'tensao_ac_nominal_v', 'tensao_saida', 'tensao_saida_v', 'tensao_nominal_v'] },
  corrente_ac_saida:     { grupo: 'CA',           aliases: ['corrente_ac_saida', 'corrente_ac_saida_a', 'corrente_max'] },
  fases:                 { grupo: 'CA', peso: 10, tipo: 'fases', aliases: ['fases', 'fases_saida', 'numeroFases', 'faseAC', 'fases_ac'] },
  frequencia_hz:         { grupo: 'CA',           aliases: ['frequencia_hz', 'freq_hz', 'frequencia'] },
  // ── Entrada CC / MPPT ─────────────────────────────────────────────────────
  n_mppts:               { grupo: 'CC', peso: 10, aliases: ['n_mppts', 'mppts', 'nMppts', 'numero_mppt', 'num_mppt'] },
  strings_por_mppt:      { grupo: 'CC',           aliases: ['strings_por_mppt', 'strings_max_por_mppt'] },
  // P1-INV-TOPOLOGY-01: representação canônica do lado CC.
  tipo_topologia:        { grupo: 'CC', tipo: 'enum',  aliases: ['tipo_topologia', 'topologia'] },
  entradas_por_mppt:     { grupo: 'CC', tipo: 'array', aliases: ['entradas_por_mppt'] },
  // FV-DOM-031 (decisão 2) — lado CC do MICROINVERSOR. O catálogo elétrico já
  // declarava `entradas`/`modulos_por_entrada` para os 13 micros, mas o
  // dicionário não os conhecia: `lerInversor` devolvia `undefined` e um micro de
  // 6 entradas chegava ao consumidor como 1. Sem `peso` — reconhecidos em
  // leitura, não alteram a semântica de score existente.
  entradas:              { grupo: 'CC', aliases: ['entradas', 'entradas_cc', 'total_entradas_cc', 'n_entradas', 'numero_entradas', 'entradas_dc'] },
  modulos_por_entrada:   { grupo: 'CC', aliases: ['modulos_por_entrada', 'modulos_por_entrada_max', 'paineis_por_entrada', 'modulos_por_canal'] },
  // Limite de fábrica de microinversores no MESMO ramal CA (cabo tronco).
  // Quando o modelo o declara, VENCE a tabela de regras por fabricante
  // (`regrasMicroFabricante`): dado do modelo é mais específico que do
  // fabricante. Sem `peso`: reconhecido em leitura, não altera o score.
  //
  // ── Sprint E3: por que o nome canônico é este ─────────────────────────────
  // `max_por_cabo_tronco` é o nome que o sistema JÁ usava: é o campo que o
  // extrator de datasheet pede (`datasheetController`), que `normalizarMulti`
  // grava e que a página de Inversores exibe como "Máx. por cabo tronco".
  //
  // A Sprint E cunhou `max_micros_por_arranjo` sem reconhecer o antigo; a E2
  // corrigiu pela metade, deixando o nome novo como canônico e o antigo como
  // alias — o que mantinha DOIS nomes para o dado, com o de baixa procedência
  // em cima. A E3 inverte: o nome do cadastro é o canônico, e o inventado por
  // mim vira apenas um alias de leitura, para não quebrar nada já gravado.
  max_por_cabo_tronco:   { grupo: 'CC', aliases: ['max_por_cabo_tronco', 'max_micros_por_arranjo', 'max_micros_serie', 'max_micros_por_ramal', 'micros_por_ramal_max', 'max_unidades_por_ramal', 'maximo_micros_em_serie'] },
  tensao_max_entrada:    { grupo: 'CC', peso: 15, aliases: ['tensao_max_entrada', 'tensao_max_entrada_dc_v', 'voc_max_dc', 'voc_max_dc_v', 'tensao_max_dc', 'tensao_max_cc', 'vpv_max', 'voc_max'] },
  tensao_mppt_min:       { grupo: 'CC', peso: 10, aliases: ['tensao_mppt_min', 'tensao_mppt_min_v', 'mppt_min_v', 'faixa_mppt_min', 'mppt_min'] },
  tensao_mppt_max:       { grupo: 'CC', peso: 10, aliases: ['tensao_mppt_max', 'tensao_mppt_max_v', 'mppt_max_v', 'faixa_mppt_max', 'mppt_max'] },
  corrente_max_por_mppt: { grupo: 'CC',           aliases: ['corrente_max_por_mppt', 'corrente_max_por_mppt_a', 'corrente_max_mppt', 'ipv_max'] },
  corrente_isc_max:      { grupo: 'CC', peso: 10, aliases: ['corrente_isc_max', 'corrente_isc_max_a', 'isc_max_mppt', 'isc_max_por_mppt_a', 'corrente_curto_mppt'] },
  tensao_partida:        { grupo: 'CC',           aliases: ['tensao_partida', 'tensao_partida_v', 'start_voltage_v', 'tensao_inicializacao_dc'] },
  potencia_max_entrada_cc:{ grupo: 'CC',          aliases: ['potencia_max_entrada_cc', 'potencia_kw_cc_max', 'potencia_dc_max', 'pdc_max', 'potencia_max_entrada_dc_w'] },
  // S1-FV-DOMAIN-MIGRATION-01 — envelope de dimensionamento do domínio.
  // Limite de fábrica CC/CA para contar inversores (D-13/INV-39). Sem `peso`:
  // reconhecido em leitura, não altera a semântica de score existente.
  oversizing_max:        { grupo: 'CC',           aliases: ['oversizing_max', 'fator_sobrecarga_max', 'dc_ac_ratio_max', 'sobredimensionamento_max', 'overload_max'] },
  // ── Bateria (SOMENTE inversor híbrido) — envelope CC de acoplamento ─────────
  // Fonte da validação bateria↔inversor (INV-44/INV-45). Aplicável quando
  // tipo_topologia = 'hibrido'; ausente/null nos demais.
  tensao_bateria_min:          { grupo: 'BAT', aliases: ['tensao_bateria_min', 'vbat_min', 'tensao_bat_min_v', 'battery_voltage_min'] },
  tensao_bateria_max:          { grupo: 'BAT', aliases: ['tensao_bateria_max', 'vbat_max', 'tensao_bat_max_v', 'battery_voltage_max'] },
  corrente_bateria_carga_max:  { grupo: 'BAT', aliases: ['corrente_bateria_carga_max', 'ibat_carga_max', 'corrente_carga_max_a', 'max_charge_current'] },
  corrente_bateria_descarga_max:{ grupo: 'BAT', aliases: ['corrente_bateria_descarga_max', 'ibat_descarga_max', 'corrente_descarga_max_a', 'max_discharge_current'] },
  // ── Eficiência ────────────────────────────────────────────────────────────
  eficiencia_maxima:     { grupo: 'EFIC', peso: 5, aliases: ['eficiencia_maxima', 'eficiencia_maxima_pct', 'eficiencia_max', 'eficiencia_max_pct', 'eficiencia'] },
  eficiencia_europeia:   { grupo: 'EFIC',          aliases: ['eficiencia_europeia', 'eficiencia_europeia_pct', 'eficiencia_european', 'euro_efficiency'] },
  // ── Proteção / físico / geral ─────────────────────────────────────────────
  grau_protecao_ip:      { grupo: 'PROT',          aliases: ['grau_protecao_ip', 'grau_protecao', 'ip'] },
  temperatura_operacao:  { grupo: 'FIS',           aliases: ['temperatura_operacao', 'temperatura_operacao_c'] },
  peso_kg:               { grupo: 'FIS',           aliases: ['peso_kg', 'peso'] },
  dimensoes:             { grupo: 'FIS',           aliases: ['dimensoes', 'dimensoes_mm'] },
  garantia_anos:         { grupo: 'GERAL',         aliases: ['garantia_anos', 'garantia', 'garantia_produto'] },
  certificacoes:         { grupo: 'GERAL', tipo: 'array', aliases: ['certificacoes'] },
}

// Peso da identificação (fabricante+modelo) — fora de `especificacoes`.
export const PESO_IDENTIFICACAO = 15

// ── Helpers de leitura (única tradução de nomes do sistema) ──────────────────

/** Valor de UM campo canônico, resolvendo todos os aliases. null se ausente. */
export function valorCampo(especificacoes, campo) {
  const def = CAMPOS_INVERSOR[campo]
  if (!def || !especificacoes) return null
  for (const a of def.aliases) {
    const v = especificacoes[a]
    if (v !== undefined && v !== null && v !== '') return v
  }
  return null
}

function _num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Inferência de fases (mesma regra histórica do catalogoQualidade). */
function _inferirFases(esp) {
  const raw = valorCampo(esp, 'fases')
  const n = _num(raw)
  if (n !== null) return n
  if (typeof raw === 'string') {
    if (/trif/i.test(raw)) return 3
    if (/mono/i.test(raw)) return 1
  }
  const tri = esp?.entrada_trifasico
  if (tri === true || /trif/i.test(String(tri))) return 3
  const mono = esp?.entrada_monofasico ?? esp?.entrada_monofalor // typo histórico no seed
  if (mono === true || /mono/i.test(String(mono))) return 1
  return null
}

// ── P1-INV-TOPOLOGY-01: lado CC canônico (entradas físicas por MPPT) ──────────

export const TOPOLOGIA = { STRING: 'STRING', MICRO: 'MICRO', HYBRID: 'HYBRID', OTIMIZADOR: 'OTIMIZADOR' }

/**
 * FV-DOM-031 (decisão 4) — CLASSIFICAÇÃO CANÔNICA ÚNICA.
 *
 * Antes desta sprint havia TRÊS classificadores independentes, e a auditoria
 * mediu 10 divergências em 50 modelos do catálogo:
 *
 *   nova UX  → regrasPlausibilidade.tecnologiaInversor   'microinversor'|…
 *   wizard   → frontend/utils/topologiaInversor          'micro'|'string'|'otimizador'
 *   SSOT     → derivarTopologia (aqui)                   'MICRO'|'STRING'|'HYBRID'
 *
 * Um microinversor real (Deye SUN-M2000G4) era STRING para dois deles, e os três
 * SolarEdge eram STRING para a SSOT. Agora existe UMA implementação — esta — e
 * os outros dois pontos de entrada são adaptadores de vocabulário sobre ela.
 *
 * Precedência, na ordem:
 *   1. campo explícito (`tipo_topologia`/`topologia`) — dado autorado vence;
 *   2. `subtipo`;
 *   3. padrões de fabricante/modelo — herdados de `tecnologiaInversor`, que era
 *      o mais completo dos três (4 categorias, não 3);
 *   4. indícios de bateria no próprio spec;
 *   5. queda elétrica (Voc máx. baixa ⇒ micro), também de `tecnologiaInversor`;
 *   6. STRING.
 */

/** Vocabulários aceitos no campo explícito, todos apontando para o enum canônico. */
const _EXPLICITO = {
  STRING: TOPOLOGIA.STRING,
  MICRO: TOPOLOGIA.MICRO, MICROINVERSOR: TOPOLOGIA.MICRO,
  HYBRID: TOPOLOGIA.HYBRID, HIBRIDO: TOPOLOGIA.HYBRID, 'HÍBRIDO': TOPOLOGIA.HYBRID,
  OTIMIZADOR: TOPOLOGIA.OTIMIZADOR, OPTIMIZER: TOPOLOGIA.OTIMIZADOR,
}

const _RE_HIBRIDO = /hibrid|híbrid|hybrid|\bbess\b|storage|all-?in-?one|h1-|hb-|sun-?\d+k-?sg|-eu-sg/i
const _RE_OTIMIZADOR = /solaredge|solar\s?edge|hd-?wave|\boptimi|otimizad|power\s*optimizer/i
const _RE_MICRO = /micro|sun-?m\d|tsol-?m[xpps]|hms-|hmt-|\bm2-|bdm-|iq[78]|ds3|apsystem|ap\s*systems|ez1|qs1|qt\d|yc[56]\d{2}|mi-?\d{3,4}|hoymiles|tsun|enphase|sunna|northern\s*ele|\bnep\b/i

/**
 * Classificação canônica da topologia do inversor.
 * @param {Object} esp `especificacoes` persistido
 * @param {Object} [ctx] { fabricante, modelo, subtipo }
 * @returns {'STRING'|'MICRO'|'HYBRID'|'OTIMIZADOR'}
 */
export function classificarTopologiaInversor(esp = {}, ctx = {}) {
  // 1) campo explícito — o que foi autorado manda
  const bruto = String(esp.tipo_topologia || esp.topologia || '').trim().toUpperCase()
  if (_EXPLICITO[bruto]) return _EXPLICITO[bruto]

  // 2) subtipo
  const sub = String(esp.subtipo || ctx.subtipo || '').toLowerCase()
  if (/micro/.test(sub)) return TOPOLOGIA.MICRO
  if (/otimizad|optimi/.test(sub)) return TOPOLOGIA.OTIMIZADOR
  if (/h[íi]brid|hybrid/.test(sub)) return TOPOLOGIA.HYBRID

  // 3) padrões de nome — MESMA ordem de `tecnologiaInversor`: híbrido antes de
  //    micro, senão "SUN-5K-SG" (híbrido Deye) casaria com o padrão de micro.
  const nome = `${ctx.fabricante || ''} ${ctx.modelo || ''}`.trim()
  if (nome) {
    if (_RE_HIBRIDO.test(nome)) return TOPOLOGIA.HYBRID
    if (_RE_OTIMIZADOR.test(nome)) return TOPOLOGIA.OTIMIZADOR
    if (_RE_MICRO.test(nome)) return TOPOLOGIA.MICRO
  }

  // 4) indícios de bateria no próprio spec
  if (esp.suporta_bateria || esp.interface_bess ||
      /bateria|battery|backup|eps/i.test(JSON.stringify(esp.comunicacao || '') + sub)) {
    return TOPOLOGIA.HYBRID
  }

  // 5) queda elétrica — micro opera em baixa tensão CC
  const voc = _num(valorCampo(esp, 'tensao_max_entrada'))
  if (voc !== null && voc <= 100) return TOPOLOGIA.MICRO
  if (voc !== null && voc >= 200) return TOPOLOGIA.STRING
  const pca = _num(valorCampo(esp, 'potencia_kw'))
  const nm = _num(valorCampo(esp, 'n_mppts'))
  if (pca !== null && pca <= 3.5 && (nm || 0) >= 4) return TOPOLOGIA.MICRO

  return TOPOLOGIA.STRING
}

/**
 * Nome histórico, preservado para não quebrar os importadores.
 * É a MESMA função — não uma segunda regra.
 */
export const derivarTopologia = classificarTopologiaInversor

/** A topologia é de microinversor? Pergunta que meia dúzia de telas faz. */
export function ehMicroinversor(esp = {}, ctx = {}) {
  return classificarTopologiaInversor(esp, ctx) === TOPOLOGIA.MICRO
}

/**
 * Normaliza `entradas_por_mppt` para ARRAY de inteiros (fonte canônica do lado CC).
 * Deriva de `entradas_por_mppt` (se já existir) ou de `strings_por_mppt` ("2/1"→[2,1],
 * "3"→[3,3] usando num_mppt). Retorna null quando indeduzível.
 */
export function normalizarEntradasPorMppt(esp = {}) {
  const nMppt = _num(valorCampo(esp, 'n_mppts'))
  // 1) já é array
  const direto = valorCampo(esp, 'entradas_por_mppt')
  if (Array.isArray(direto) && direto.length && direto.every(x => Number.isFinite(Number(x)))) {
    return direto.map(x => Math.round(Number(x)))
  }
  // 2) string "2/1/3" ou "2 / 1"
  const fonte = direto != null ? direto : valorCampo(esp, 'strings_por_mppt')
  if (typeof fonte === 'string' && /\d/.test(fonte)) {
    const partes = fonte.split('/').map(s => parseInt(String(s).replace(/[^\d]/g, ''), 10)).filter(Number.isFinite)
    if (partes.length > 1) return partes
    if (partes.length === 1) {
      const k = partes[0]
      return nMppt && nMppt > 0 ? Array(nMppt).fill(k) : [k]   // "3" + 2 MPPT → [3,3]
    }
  }
  // 3) número simples (strings por MPPT) → replica por MPPT
  const num = _num(fonte)
  if (num != null && num > 0) return nMppt && nMppt > 0 ? Array(nMppt).fill(Math.round(num)) : [Math.round(num)]
  // 4) micro: "total de entradas CC" distribuído uniformemente entre os MPPTs
  const total = _num(esp.total_entradas_cc)
  if (total && total > 0 && nMppt && nMppt > 0) {
    const base = Math.floor(total / nMppt)
    let resto = total % nMppt
    return Array.from({ length: nMppt }, () => base + (resto-- > 0 ? 1 : 0))
  }
  return null
}

/**
 * Lê um inversor canônico a partir de `especificacoes` persistido (SSOT).
 * TODOS os consumidores devem usar isto — nunca pick() local.
 * @param {Object} especificacoes
 * @param {Object} [ctx] { fabricante, modelo, subtipo } p/ derivar topologia
 * @returns {Object} { campoCanonico: valor|null } + tipo_topologia + entradas_por_mppt
 */
export function lerInversor(especificacoes, ctx = {}) {
  const esp = especificacoes || {}
  const out = {}
  for (const campo of Object.keys(CAMPOS_INVERSOR)) {
    out[campo] = valorCampo(esp, campo)
  }
  out.fases = _inferirFases(esp)
  // Lado CC canônico (derivado, sem schema novo)
  out.tipo_topologia = derivarTopologia(esp, ctx)
  out.entradas_por_mppt = normalizarEntradasPorMppt(esp)
  return out
}

/** Lista de campos que entram no score (peso definido). */
export const CAMPOS_COM_PESO = Object.entries(CAMPOS_INVERSOR)
  .filter(([, d]) => typeof d.peso === 'number')
  .map(([k]) => k)
