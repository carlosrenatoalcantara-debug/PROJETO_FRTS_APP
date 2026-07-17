/**
 * dicionarioBateria.js — S1-FV-DOMAIN-MIGRATION-01
 *
 * FONTE ÚNICA DE VERDADE (SSOT) do vocabulário de BATERIAS do Forte Solar.
 * Mesmo padrão de dicionarioInversor.js: PURO (sem I/O, sem deps de node),
 * importável do backend e do frontend.
 *
 * ESCOPO S1 (modelo de dados apenas): expõe o envelope da bateria
 * (SpecsBateria do contrato S1-FV-UNIFIED-DOMAIN-MODEL) em LEITURA, a partir de
 * `Equipamento.especificacoes` (Mixed). NÃO altera o schema de Equipamento —
 * `especificacoes` permanece intocada. NÃO calcula nada, NÃO valida nada
 * (validação bateria↔inversor INV-44/45 é do Motor de Engenharia, sprint S2+).
 *
 * Nome canônico = nome preferencial do domínio. `aliases` agrega as grafias
 * históricas/importadas conhecidas.
 */

// campo canônico → { aliases[], grupo }
export const CAMPOS_BATERIA = {
  // ── Capacidade / energia ────────────────────────────────────────────────────
  capacidade_kwh:          { grupo: 'ENERGIA', aliases: ['capacidade_kwh', 'capacidade_nominal_kwh', 'energia_kwh', 'capacidade'] },
  capacidade_util_kwh:     { grupo: 'ENERGIA', aliases: ['capacidade_util_kwh', 'energia_util_kwh'] },
  profundidade_descarga_pct:{ grupo: 'ENERGIA', aliases: ['profundidade_descarga_pct', 'dod_pct', 'dod', 'depth_of_discharge'] },
  // ── Potência ────────────────────────────────────────────────────────────────
  potencia_carga_max_kw:    { grupo: 'POT', aliases: ['potencia_carga_max_kw', 'potencia_carga_kw', 'max_charge_power_kw'] },
  potencia_descarga_max_kw: { grupo: 'POT', aliases: ['potencia_descarga_max_kw', 'potencia_descarga_kw', 'max_discharge_power_kw'] },
  // ── Tensão do banco (CC) — base da compatibilidade com o inversor híbrido ────
  tensao_nominal_v:        { grupo: 'CC', aliases: ['tensao_nominal_v', 'tensao_banco_v', 'tensao_nominal', 'voltagem_nominal_v', 'nominal_voltage'] },
  tensao_min_v:            { grupo: 'CC', aliases: ['tensao_min_v', 'tensao_minima_v', 'min_voltage'] },
  tensao_max_v:            { grupo: 'CC', aliases: ['tensao_max_v', 'tensao_maxima_v', 'max_voltage'] },
  // ── Vida útil / química ──────────────────────────────────────────────────────
  ciclos_vida:             { grupo: 'GERAL', aliases: ['ciclos_vida', 'ciclos', 'ciclos_garantidos', 'cycle_life'] },
  quimica:                 { grupo: 'GERAL', tipo: 'enum', aliases: ['quimica', 'tecnologia', 'chemistry', 'tipo_celula'] },
  acoplamento:             { grupo: 'GERAL', tipo: 'enum', aliases: ['acoplamento', 'tipo_acoplamento', 'coupling'] },
}

function _num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Valor de um campo canônico buscando por todos os aliases em `especificacoes`. */
export function valorCampoBateria(especificacoes, campoCanonico) {
  const def = CAMPOS_BATERIA[campoCanonico]
  if (!def || !especificacoes || typeof especificacoes !== 'object') return null
  for (const alias of def.aliases) {
    const v = especificacoes[alias]
    if (v !== null && v !== undefined && v !== '') return v
  }
  return null
}

/**
 * Projeção canônica de uma bateria a partir de `especificacoes` (Mixed).
 * Numéricos normalizados; enums/strings mantidos como vêm. Campos ausentes → null.
 * @returns {Object} { campoCanonico: valor|null }
 */
export function lerBateria(especificacoes = {}, equipamento = {}) {
  const out = {}
  for (const campo of Object.keys(CAMPOS_BATERIA)) {
    const def = CAMPOS_BATERIA[campo]
    const raw = valorCampoBateria(especificacoes, campo)
    out[campo] = (def.tipo === 'enum') ? (raw ?? null) : _num(raw)
  }
  // Fallbacks de identificação já presentes no doc de Equipamento.
  out.fabricante = equipamento.fabricante ?? null
  out.modelo = equipamento.modelo ?? null
  return out
}

export default { CAMPOS_BATERIA, valorCampoBateria, lerBateria }
