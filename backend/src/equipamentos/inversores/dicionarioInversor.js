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
  n_mppts:               { grupo: 'CC', peso: 10, aliases: ['n_mppts', 'mppts', 'nMppts', 'numero_mppt'] },
  strings_por_mppt:      { grupo: 'CC',           aliases: ['strings_por_mppt', 'strings_max_por_mppt'] },
  tensao_max_entrada:    { grupo: 'CC', peso: 15, aliases: ['tensao_max_entrada', 'tensao_max_entrada_dc_v', 'voc_max_dc', 'voc_max_dc_v', 'tensao_max_dc', 'tensao_max_cc', 'vpv_max', 'voc_max'] },
  tensao_mppt_min:       { grupo: 'CC', peso: 10, aliases: ['tensao_mppt_min', 'tensao_mppt_min_v', 'mppt_min_v', 'faixa_mppt_min', 'mppt_min'] },
  tensao_mppt_max:       { grupo: 'CC', peso: 10, aliases: ['tensao_mppt_max', 'tensao_mppt_max_v', 'mppt_max_v', 'faixa_mppt_max', 'mppt_max'] },
  corrente_max_por_mppt: { grupo: 'CC',           aliases: ['corrente_max_por_mppt', 'corrente_max_por_mppt_a', 'corrente_max_mppt', 'ipv_max'] },
  corrente_isc_max:      { grupo: 'CC', peso: 10, aliases: ['corrente_isc_max', 'corrente_isc_max_a', 'isc_max_mppt', 'isc_max_por_mppt_a', 'corrente_curto_mppt'] },
  tensao_partida:        { grupo: 'CC',           aliases: ['tensao_partida', 'tensao_partida_v', 'start_voltage_v', 'tensao_inicializacao_dc'] },
  potencia_max_entrada_cc:{ grupo: 'CC',          aliases: ['potencia_max_entrada_cc', 'potencia_kw_cc_max', 'potencia_dc_max', 'pdc_max', 'potencia_max_entrada_dc_w'] },
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

/**
 * Lê um inversor canônico a partir de `especificacoes` persistido (SSOT).
 * TODOS os consumidores devem usar isto — nunca pick() local.
 * @returns {Object} { campoCanonico: valor|null } para todo CAMPOS_INVERSOR
 */
export function lerInversor(especificacoes) {
  const esp = especificacoes || {}
  const out = {}
  for (const campo of Object.keys(CAMPOS_INVERSOR)) {
    out[campo] = valorCampo(esp, campo)
  }
  out.fases = _inferirFases(esp)
  return out
}

/** Lista de campos que entram no score (peso definido). */
export const CAMPOS_COM_PESO = Object.entries(CAMPOS_INVERSOR)
  .filter(([, d]) => typeof d.peso === 'number')
  .map(([k]) => k)
