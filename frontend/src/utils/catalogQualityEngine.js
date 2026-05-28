/**
 * catalogQualityEngine.js — Sprint 3
 *
 * Motor de qualidade técnica CLIENT-SIDE para o catálogo FV.
 * Espelha a lógica do backend (catalogoQualidade.js + regrasPlausibilidade.js)
 * sem dependências Node.js — roda no browser.
 *
 * Uso principal:
 *  - Validação em tempo real nos formulários de criação/edição
 *  - Exibição de badges e scores nos cards do catálogo
 *  - Proteção da engenharia: avisos antes de usar equipamento com dados duvidosos
 *
 * NÃO modifica dados. NÃO faz I/O. Funções puras e determinísticas.
 */

// ─── Helpers numéricos ────────────────────────────────────────────────────────

export function toNum(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function inRange(v, min, max) {
  const n = toNum(v)
  return n !== null && n >= min && n <= max
}

function isPresent(v) {
  return toNum(v) !== null
}

const RE_DESCONHECIDO = /^\s*(desconhecid[ao]|n\/?a|sem\s*nome|null|undefined|nao\s*informad[ao]|não\s*informad[ao]|--)\s*$/i

export function isDesconhecido(v) {
  if (!v) return true
  return RE_DESCONHECIDO.test(String(v).trim())
}

// Pick: primeiro valor não nulo entre múltiplas chaves de um objeto
function pick(obj, keys) {
  if (!obj) return null
  for (const k of keys) {
    const v = obj[k]
    if (v !== undefined && v !== null && v !== '') return v
  }
  return null
}

// ─── Normalização de nome ─────────────────────────────────────────────────────

/**
 * Normaliza string para comparação canônica.
 * Ex: "Trina Solar" → "TRINA SOLAR" | "TSM-610 NEG21C.20" → "TSM 610 NEG21C 20"
 */
export function normalizarNome(s) {
  if (!s) return ''
  return String(s)
    .trim()
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // remove acentos
    .replace(/\s+/g, ' ')
}

/**
 * Chave normalizada para detecção de possíveis duplicatas.
 * Remove pontuação, tudo uppercase, tokens relevantes.
 */
export function chaveNormalizada(tipo, fabricante, modelo) {
  const normFab = normalizarNome(fabricante).replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, '_')
  const normMod = normalizarNome(modelo).replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, '_')
  return `${tipo || ''}|${normFab}|${normMod}`
}

// ─── Normalização de specs (espelho de normalizarSpecsModulo/Inversor) ────────

function normalizarEspecificacoes(tipo, especificacoes) {
  const esp = especificacoes || {}
  if (tipo === 'modulo') {
    return {
      potencia_w:            toNum(pick(esp, ['potencia_w', 'potencia', 'potenciaW', 'potencia_wp'])),
      voc_v:                 toNum(pick(esp, ['voc', 'voc_v', 'vocV', 'Voc'])),
      vmpp_v:                toNum(pick(esp, ['vmpp', 'vmp', 'vmpp_v', 'vmp_v', 'Vmpp', 'Vmp'])),
      isc_a:                 toNum(pick(esp, ['isc', 'isc_a', 'iscA', 'Isc'])),
      impp_a:                toNum(pick(esp, ['impp', 'imp', 'impp_a', 'imp_a', 'Impp'])),
      eficiencia_pct:        toNum(pick(esp, ['eficiencia', 'eficiencia_pct', 'eficienciaPct', 'efficiency'])),
      coef_temp_voc_pct_c:   toNum(pick(esp, ['coef_temp_voc', 'coef_temp_voc_pct_c', 'tempCoefVoc'])),
      noct_c:                toNum(pick(esp, ['noct', 'noct_c', 'NOCT'])),
      peso_kg:               toNum(pick(esp, ['peso_kg', 'peso'])),
      numero_celulas:        toNum(pick(esp, ['numero_celulas', 'num_celulas', 'celulas'])),
    }
  }
  if (tipo === 'inversor') {
    return {
      potencia_kw_ca:        toNum(pick(esp, ['potencia_kw', 'potencia_kw_ca', 'potencia'])),
      potencia_kw_cc_max:    toNum(pick(esp, ['potencia_kw_cc_max', 'potencia_dc_max', 'pdc_max'])),
      fases_saida:           toNum(pick(esp, ['fases', 'fases_saida', 'numeroFases'])),
      voc_max_dc_v:          toNum(pick(esp, ['voc_max_dc', 'voc_max_dc_v', 'tensao_max_dc', 'voc_max'])),
      mppt_min_v:            toNum(pick(esp, ['mppt_min_v', 'faixa_mppt_min', 'mppt_min'])),
      mppt_max_v:            toNum(pick(esp, ['mppt_max_v', 'faixa_mppt_max', 'mppt_max'])),
      isc_max_por_mppt_a:    toNum(pick(esp, ['isc_max_mppt', 'isc_max_por_mppt_a', 'corrente_max_mppt', 'ipv_max'])),
      n_mppts:               toNum(pick(esp, ['n_mppts', 'mppts', 'numero_mppt'])),
      eficiencia_max_pct:    toNum(pick(esp, ['eficiencia_max', 'eficiencia', 'eficiencia_max_pct'])),
    }
  }
  return {}
}

// ─── REGRAS DE PLAUSIBILIDADE ─────────────────────────────────────────────────

function regrasModulo(specs) {
  const alertas = []

  // R-M1: Vmpp < Voc (lei física)
  if (isPresent(specs.voc_v) && isPresent(specs.vmpp_v) && specs.vmpp_v >= specs.voc_v) {
    alertas.push({ codigo: 'VMPP_MAIOR_QUE_VOC', severidade: 'critico', campo: 'vmpp_v',
      mensagem: `Vmpp (${specs.vmpp_v}V) ≥ Voc (${specs.voc_v}V). Lei física violada — possível erro de digitação.` })
  }

  // R-M2: Impp < Isc (lei física)
  if (isPresent(specs.isc_a) && isPresent(specs.impp_a) && specs.impp_a >= specs.isc_a) {
    alertas.push({ codigo: 'IMPP_MAIOR_QUE_ISC', severidade: 'critico', campo: 'impp_a',
      mensagem: `Impp (${specs.impp_a}A) ≥ Isc (${specs.isc_a}A). Lei física violada.` })
  }

  // R-M3: Razão Vmpp/Voc
  if (isPresent(specs.voc_v) && isPresent(specs.vmpp_v) && specs.voc_v > 0) {
    const r = specs.vmpp_v / specs.voc_v
    if (r < 0.70 || r > 0.92) {
      alertas.push({ codigo: 'RAZAO_VMPP_VOC_FORA_FAIXA', severidade: 'medio', campo: 'vmpp_v',
        mensagem: `Vmpp/Voc = ${r.toFixed(2)} fora de [0.70, 0.92]. Possível erro de parsing.` })
    }
  }

  // R-M4: Razão Impp/Isc
  if (isPresent(specs.isc_a) && isPresent(specs.impp_a) && specs.isc_a > 0) {
    const r = specs.impp_a / specs.isc_a
    if (r < 0.90 || r > 0.99) {
      alertas.push({ codigo: 'RAZAO_IMPP_ISC_FORA_FAIXA', severidade: 'medio', campo: 'impp_a',
        mensagem: `Impp/Isc = ${r.toFixed(2)} fora de [0.90, 0.99].` })
    }
  }

  // R-M5: Pmax ≈ Vmpp × Impp (±5%)
  if (isPresent(specs.potencia_w) && isPresent(specs.vmpp_v) && isPresent(specs.impp_a)) {
    const calc = specs.vmpp_v * specs.impp_a
    const desv = Math.abs(specs.potencia_w - calc) / calc
    if (desv > 0.05) {
      alertas.push({ codigo: 'POTENCIA_NAO_BATE_VxI', severidade: 'alto', campo: 'potencia_w',
        mensagem: `Potência declarada ${specs.potencia_w}W ≠ Vmpp×Impp=${calc.toFixed(1)}W (desvio ${(desv*100).toFixed(1)}%).` })
    }
  }

  // R-M6: Potência comercial 100–800 Wp
  if (isPresent(specs.potencia_w) && !inRange(specs.potencia_w, 100, 800)) {
    alertas.push({ codigo: 'POTENCIA_FORA_FAIXA_COMERCIAL', severidade: 'medio', campo: 'potencia_w',
      mensagem: `Potência ${specs.potencia_w}W fora da faixa comercial [100, 800].` })
  }

  // R-M7: Eficiência 10–30 %
  if (isPresent(specs.eficiencia_pct) && !inRange(specs.eficiencia_pct, 10, 30)) {
    alertas.push({ codigo: 'EFICIENCIA_IMPLAUSIVEL', severidade: 'medio', campo: 'eficiencia_pct',
      mensagem: `Eficiência ${specs.eficiencia_pct}% fora de [10, 30].` })
  }

  // R-M8: Voc 20–80 V
  if (isPresent(specs.voc_v) && !inRange(specs.voc_v, 20, 80)) {
    alertas.push({ codigo: 'VOC_IMPLAUSIVEL', severidade: 'alto', campo: 'voc_v',
      mensagem: `Voc ${specs.voc_v}V fora da faixa típica [20, 80].` })
  }

  // R-M9: Isc 3–25 A
  if (isPresent(specs.isc_a) && !inRange(specs.isc_a, 3, 25)) {
    alertas.push({ codigo: 'ISC_IMPLAUSIVEL', severidade: 'alto', campo: 'isc_a',
      mensagem: `Isc ${specs.isc_a}A fora da faixa típica [3, 25].` })
  }

  // R-M10: Coef. temp. Voc [-0.5, -0.15] %/°C
  if (isPresent(specs.coef_temp_voc_pct_c) && !inRange(specs.coef_temp_voc_pct_c, -0.5, -0.15)) {
    alertas.push({ codigo: 'COEF_TEMP_VOC_FORA_FAIXA', severidade: 'medio', campo: 'coef_temp_voc_pct_c',
      mensagem: `Coef. temp. Voc ${specs.coef_temp_voc_pct_c}%/°C fora de [-0.5, -0.15].` })
  }

  return alertas
}

function regrasInversor(specs) {
  const alertas = []

  // R-I1: MPPT min < max < voc_max_dc
  if (isPresent(specs.mppt_min_v) && isPresent(specs.mppt_max_v)) {
    if (specs.mppt_min_v >= specs.mppt_max_v) {
      alertas.push({ codigo: 'MPPT_INCOERENTE', severidade: 'critico', campo: 'mppt_min_v',
        mensagem: `MPPT min (${specs.mppt_min_v}V) ≥ MPPT max (${specs.mppt_max_v}V).` })
    } else if (isPresent(specs.voc_max_dc_v) && specs.mppt_max_v >= specs.voc_max_dc_v) {
      alertas.push({ codigo: 'MPPT_INCOERENTE', severidade: 'critico', campo: 'mppt_max_v',
        mensagem: `MPPT max (${specs.mppt_max_v}V) ≥ Voc max DC (${specs.voc_max_dc_v}V).` })
    }
  }

  // R-I2: Voc max DC 200–1500 V
  if (isPresent(specs.voc_max_dc_v) && !inRange(specs.voc_max_dc_v, 200, 1500)) {
    alertas.push({ codigo: 'VOC_MAX_DC_IMPLAUSIVEL', severidade: 'alto', campo: 'voc_max_dc_v',
      mensagem: `Voc max DC ${specs.voc_max_dc_v}V fora de [200, 1500].` })
  }

  // R-I3: MPPT faixa prática
  if (isPresent(specs.mppt_min_v) && !inRange(specs.mppt_min_v, 50, 400)) {
    alertas.push({ codigo: 'MPPT_FAIXA_IMPLAUSIVEL', severidade: 'medio', campo: 'mppt_min_v',
      mensagem: `MPPT min ${specs.mppt_min_v}V fora de [50, 400].` })
  }
  if (isPresent(specs.mppt_max_v) && !inRange(specs.mppt_max_v, 200, 1000)) {
    alertas.push({ codigo: 'MPPT_FAIXA_IMPLAUSIVEL', severidade: 'medio', campo: 'mppt_max_v',
      mensagem: `MPPT max ${specs.mppt_max_v}V fora de [200, 1000].` })
  }

  // R-I4: Isc max MPPT 10–40 A
  if (isPresent(specs.isc_max_por_mppt_a) && !inRange(specs.isc_max_por_mppt_a, 10, 40)) {
    alertas.push({ codigo: 'ISC_MPPT_IMPLAUSIVEL', severidade: 'medio', campo: 'isc_max_por_mppt_a',
      mensagem: `Isc max MPPT ${specs.isc_max_por_mppt_a}A fora de [10, 40].` })
  }

  // R-I5: n_mppts 1–12
  if (isPresent(specs.n_mppts) && (specs.n_mppts < 1 || specs.n_mppts > 12)) {
    alertas.push({ codigo: 'NUM_MPPTS_IMPLAUSIVEL', severidade: 'medio', campo: 'n_mppts',
      mensagem: `n_mppts=${specs.n_mppts} fora de [1, 12].` })
  }

  // R-I6: Potência CA 1–100 kW
  if (isPresent(specs.potencia_kw_ca) && !inRange(specs.potencia_kw_ca, 0.5, 100)) {
    alertas.push({ codigo: 'POTENCIA_FORA_FAIXA', severidade: 'baixo', campo: 'potencia_kw_ca',
      mensagem: `Potência CA ${specs.potencia_kw_ca}kW fora de [0.5, 100].` })
  }

  // R-I7: DC ≥ AC (oversize esperado)
  if (isPresent(specs.potencia_kw_cc_max) && isPresent(specs.potencia_kw_ca) && specs.potencia_kw_cc_max < specs.potencia_kw_ca) {
    alertas.push({ codigo: 'DC_AC_INVERSO', severidade: 'medio', campo: 'potencia_kw_cc_max',
      mensagem: `Potência DC ${specs.potencia_kw_cc_max}kW < CA ${specs.potencia_kw_ca}kW. Esperado DC ≥ CA.` })
  }

  // R-I9: Fases 1 ou 3
  if (isPresent(specs.fases_saida) && specs.fases_saida !== 1 && specs.fases_saida !== 3) {
    alertas.push({ codigo: 'FASES_INVALIDAS', severidade: 'alto', campo: 'fases_saida',
      mensagem: `Fases ${specs.fases_saida} inválido. Esperado 1 (mono) ou 3 (trifásico).` })
  }

  return alertas
}

// ─── COMPLETUDE ───────────────────────────────────────────────────────────────

const CAMPOS_OBRIGATORIOS = {
  modulo: [
    { campo: 'potencia_w',      peso: 15, rotulo: 'Potência (Wp)' },
    { campo: 'voc_v',           peso: 12, rotulo: 'Voc (V)' },
    { campo: 'vmpp_v',          peso: 10, rotulo: 'Vmpp (V)' },
    { campo: 'isc_a',           peso: 10, rotulo: 'Isc (A)' },
    { campo: 'impp_a',          peso: 8,  rotulo: 'Impp (A)' },
    { campo: 'eficiencia_pct',  peso: 8,  rotulo: 'Eficiência (%)' },
    { campo: 'coef_temp_voc_pct_c', peso: 6, rotulo: 'Coef. Temp. Voc (%/°C)' },
    { campo: 'noct_c',          peso: 5,  rotulo: 'NOCT (°C)' },
    { campo: 'numero_celulas',  peso: 4,  rotulo: 'Nº células' },
  ],
  inversor: [
    { campo: 'potencia_kw_ca',     peso: 12, rotulo: 'Potência CA (kW)' },
    { campo: 'voc_max_dc_v',       peso: 14, rotulo: 'Voc máx DC (V)' },
    { campo: 'mppt_min_v',         peso: 10, rotulo: 'MPPT mín (V)' },
    { campo: 'mppt_max_v',         peso: 10, rotulo: 'MPPT máx (V)' },
    { campo: 'isc_max_por_mppt_a', peso: 10, rotulo: 'Isc máx/MPPT (A)' },
    { campo: 'n_mppts',            peso: 10, rotulo: 'Nº MPPTs' },
    { campo: 'fases_saida',        peso: 8,  rotulo: 'Fases saída' },
    { campo: 'eficiencia_max_pct', peso: 5,  rotulo: 'Eficiência máx (%)' },
  ],
}

function calcularCompletude(tipo, specs, fabricante, modelo) {
  const campos = CAMPOS_OBRIGATORIOS[tipo] || []
  let totalPeso = 16  // 16 para identificação
  let preenchidoPeso = 0
  const faltantes = []

  // Identificação (fabricante + modelo)
  const idOk = fabricante && fabricante.trim().length >= 2 && !isDesconhecido(fabricante) &&
               modelo && modelo.trim().length >= 2 && !isDesconhecido(modelo)
  if (idOk) preenchidoPeso += 16
  else faltantes.push('identificacao')

  for (const { campo, peso, rotulo } of campos) {
    totalPeso += peso
    const v = specs[campo]
    if (v !== null && v !== undefined && Number.isFinite(v)) {
      preenchidoPeso += peso
    } else {
      faltantes.push(rotulo || campo)
    }
  }

  return {
    score: totalPeso > 0 ? Math.round((preenchidoPeso / totalPeso) * 100) : 0,
    faltantes,
  }
}

// ─── SCORE GLOBAL E NÍVEL ─────────────────────────────────────────────────────

function calcularConfiancaLocal(alertas) {
  // Sem origin info → base 70 (estimativa para dados de formulário)
  let score = 70
  for (const a of alertas) {
    if (a.severidade === 'critico') { score = 0; break }
    if (a.severidade === 'alto')   score *= 0.5
    else if (a.severidade === 'medio') score *= 0.85
    else if (a.severidade === 'baixo') score *= 0.95
  }
  return Math.max(0, Math.min(100, Math.round(score)))
}

/**
 * Determina nível de qualidade a partir dos scores e alertas.
 * @returns {'validado'|'utilizavel'|'incompleto'|'suspeito'|'invalido'|'aguardando_revisao'}
 */
export function determinarNivel(scoreGlobal, alertas, fabricante, modelo) {
  const temCritico = alertas.some(a => a.severidade === 'critico')
  if (temCritico) return 'invalido'
  if (!fabricante || isDesconhecido(fabricante) || !modelo || isDesconhecido(modelo)) return 'aguardando_revisao'
  if (scoreGlobal >= 90) return 'validado'
  if (scoreGlobal >= 72) return 'utilizavel'
  if (scoreGlobal >= 50) return 'incompleto'
  if (scoreGlobal >= 30) return 'suspeito'
  return 'invalido'
}

// ─── FUNÇÃO PRINCIPAL ─────────────────────────────────────────────────────────

/**
 * Valida um equipamento e retorna resultado de qualidade completo.
 * Aceita tanto documentos do banco (com qualidade já calculada) quanto
 * objetos parciais do formulário de criação.
 *
 * @param {object} equipamento - objeto com tipo, fabricante, modelo, especificacoes
 * @returns {{
 *   score: number,             — 0–100
 *   completude_score: number,
 *   confianca_score: number,
 *   nivel: string,
 *   alertas: Array,
 *   campos_faltantes: Array,
 *   specs: object,             — specs normalizadas
 * }}
 */
export function validarEquipamento(equipamento) {
  if (!equipamento) {
    return { score: 0, completude_score: 0, confianca_score: 0, nivel: 'invalido', alertas: [], campos_faltantes: [], specs: {} }
  }

  const { tipo, fabricante, modelo, especificacoes } = equipamento
  const specs = normalizarEspecificacoes(tipo, especificacoes)

  // Alertas estruturais
  const alertas = []
  if (!tipo) alertas.push({ codigo: 'SEM_TIPO', severidade: 'critico', campo: 'tipo', mensagem: 'Campo tipo ausente.' })
  if (isDesconhecido(fabricante)) alertas.push({ codigo: 'FABRICANTE_DESCONHECIDO', severidade: 'alto', campo: 'fabricante', mensagem: `Fabricante "${fabricante || '(vazio)'}" não identificado.` })
  if (isDesconhecido(modelo)) alertas.push({ codigo: 'MODELO_DESCONHECIDO', severidade: 'alto', campo: 'modelo', mensagem: `Modelo "${modelo || '(vazio)'}" não identificado.` })

  // Alertas por tipo
  if (tipo === 'modulo') alertas.push(...regrasModulo(specs))
  else if (tipo === 'inversor') alertas.push(...regrasInversor(specs))

  // Scores
  const { score: completude_score, faltantes: campos_faltantes } = calcularCompletude(tipo, specs, fabricante, modelo)
  const confianca_score = calcularConfiancaLocal(alertas)
  const score = Math.round(completude_score * 0.4 + confianca_score * 0.6)
  const nivel = determinarNivel(score, alertas, fabricante, modelo)

  return { score, completude_score, confianca_score, nivel, alertas, campos_faltantes, specs }
}

// ─── METADADOS DE DISPLAY ─────────────────────────────────────────────────────

export const NIVEL_CONFIG = {
  validado:           { label: 'VALIDADO',      cor: 'verde',   corHex: '#10b981', descricao: 'Specs completas e consistentes.' },
  utilizavel:         { label: 'UTILIZÁVEL',    cor: 'azul',    corHex: '#3b82f6', descricao: 'Dados suficientes para projetos.' },
  incompleto:         { label: 'INCOMPLETO',    cor: 'amarelo', corHex: '#f59e0b', descricao: 'Campos técnicos faltando.' },
  suspeito:           { label: 'SUSPEITO',      cor: 'laranja', corHex: '#f97316', descricao: 'Alertas técnicos — verificar antes de usar.' },
  invalido:           { label: 'INVÁLIDO',      cor: 'vermelho',corHex: '#ef4444', descricao: 'Specs violam leis físicas. NÃO usar em projetos.' },
  aguardando_revisao: { label: 'AGUARDANDO',    cor: 'cinza',   corHex: '#64748b', descricao: 'Identificação incompleta.' },
  null:               { label: 'SEM ANÁLISE',   cor: 'cinza',   corHex: '#94a3b8', descricao: 'Qualidade não calculada.' },
}

export function getNivelConfig(nivel) {
  return NIVEL_CONFIG[nivel] || NIVEL_CONFIG['null']
}

export const SEVERIDADE_CONFIG = {
  critico: { label: 'Crítico',     corBg: 'bg-red-100',    corText: 'text-red-800',    icon: '🚫' },
  alto:    { label: 'Alto',        corBg: 'bg-orange-100', corText: 'text-orange-800', icon: '⚠️' },
  medio:   { label: 'Médio',       corBg: 'bg-amber-100',  corText: 'text-amber-800',  icon: '⚡' },
  baixo:   { label: 'Baixo',       corBg: 'bg-blue-100',   corText: 'text-blue-800',   icon: 'ℹ️' },
  info:    { label: 'Info',        corBg: 'bg-slate-100',  corText: 'text-slate-600',  icon: '💬' },
}

export function getSeveridadeConfig(sev) {
  return SEVERIDADE_CONFIG[sev] || SEVERIDADE_CONFIG['info']
}

/**
 * Verifica se o equipamento pode ser usado com segurança em projetos FV.
 * Nível 'invalido' → aviso forte. Demais: OK com observações.
 */
export function podeUsarEmProjeto(nivel) {
  if (nivel === 'invalido') return { pode: false, mensagem: '⚠️ Specs inválidas (lei física violada). NÃO use em projetos reais.' }
  if (nivel === 'suspeito') return { pode: true,  mensagem: '⚡ Dados com alertas técnicos. Verifique antes do projeto final.' }
  if (nivel === 'incompleto') return { pode: true, mensagem: 'ℹ️ Specs parciais — verifique os campos faltantes.' }
  return { pode: true, mensagem: null }
}

/**
 * Retorna cor do score para display visual.
 * @param {number} score - 0 a 100
 */
export function corDoScore(score) {
  if (score >= 90) return { bg: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-200' }
  if (score >= 72) return { bg: 'bg-blue-500',    text: 'text-blue-700',    border: 'border-blue-200'    }
  if (score >= 50) return { bg: 'bg-amber-500',   text: 'text-amber-700',   border: 'border-amber-200'   }
  if (score >= 30) return { bg: 'bg-orange-500',  text: 'text-orange-700',  border: 'border-orange-200'  }
  return               { bg: 'bg-red-500',    text: 'text-red-700',    border: 'border-red-200'    }
}
