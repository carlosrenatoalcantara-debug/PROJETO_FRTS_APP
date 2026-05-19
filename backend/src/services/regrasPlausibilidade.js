/**
 * 🔬 Regras de Plausibilidade Física — Catálogo Técnico FV
 *
 * Funções PURAS, determinísticas, sem efeitos colaterais.
 * Cada regra recebe `specs` (objeto normalizado) e retorna:
 *    { ok: true }                            — passa
 *    { ok: false, mensagem, valor_atual, valor_esperado_min?, valor_esperado_max? }
 *
 * Severidade dos alertas:
 *   - critico — viola lei física; equipamento será marcado 'invalido'
 *   - alto    — provável erro de parsing; reduz score significativamente
 *   - medio   — fora da faixa típica; alerta visual
 *   - baixo   — desvio menor; apenas informativo
 *   - info    — observação; sem impacto no score
 *
 * NÃO modifica o input. NÃO depende de I/O.
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

function num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function isPresent(v) {
  return num(v) !== null
}

function inRange(v, min, max) {
  const n = num(v)
  return n !== null && n >= min && n <= max
}

function approximately(actual, expected, toleranciaPct) {
  const a = num(actual), e = num(expected)
  if (a === null || e === null || e === 0) return false
  return Math.abs(a - e) / Math.abs(e) <= toleranciaPct
}

const PADROES_DESCONHECIDO = /^\s*(desconhecid[ao]|n\/?a|sem\s*nome|null|undefined|n[ãa]o\s*informad[ao]|--)\s*$/i

function ehDesconhecido(v) {
  if (!v) return true
  return PADROES_DESCONHECIDO.test(String(v).trim())
}

// ─── Regras para MÓDULOS ────────────────────────────────────────────────────

export const REGRAS_MODULO = [
  // M1 — Vmpp < Voc (lei física, sem exceção)
  {
    codigo: 'VMPP_MAIOR_QUE_VOC',
    severidade: 'critico',
    campo: 'vmpp_v',
    descricao: 'Tensão de máxima potência maior que tensão de circuito aberto',
    valida(specs) {
      const voc = num(specs.voc_v), vmpp = num(specs.vmpp_v)
      if (voc === null || vmpp === null) return { ok: true } // se faltar, outra regra cobre
      if (vmpp >= voc) {
        return {
          ok: false,
          mensagem: `Vmpp (${vmpp}V) deve ser menor que Voc (${voc}V). Lei física violada — provável erro de parsing.`,
          valor_atual: vmpp,
          valor_esperado_max: voc - 0.1,
        }
      }
      return { ok: true }
    },
  },

  // M2 — Impp < Isc
  {
    codigo: 'IMPP_MAIOR_QUE_ISC',
    severidade: 'critico',
    campo: 'impp_a',
    descricao: 'Corrente de máxima potência maior que corrente de curto-circuito',
    valida(specs) {
      const isc = num(specs.isc_a), impp = num(specs.impp_a)
      if (isc === null || impp === null) return { ok: true }
      if (impp >= isc) {
        return {
          ok: false,
          mensagem: `Impp (${impp}A) deve ser menor que Isc (${isc}A).`,
          valor_atual: impp,
          valor_esperado_max: isc - 0.05,
        }
      }
      return { ok: true }
    },
  },

  // M3 — razão Vmpp/Voc tipicamente 0.7–0.92
  {
    codigo: 'RAZAO_VMPP_VOC_FORA_FAIXA',
    severidade: 'medio',
    campo: 'vmpp_v',
    descricao: 'Razão Vmpp/Voc fora da faixa típica (0.7 – 0.92)',
    valida(specs) {
      const voc = num(specs.voc_v), vmpp = num(specs.vmpp_v)
      if (voc === null || vmpp === null || voc === 0) return { ok: true }
      const razao = vmpp / voc
      if (razao < 0.70 || razao > 0.92) {
        return {
          ok: false,
          mensagem: `Vmpp/Voc = ${razao.toFixed(2)} (esperado entre 0.70 e 0.92).`,
          valor_atual: Number(razao.toFixed(2)),
          valor_esperado_min: 0.70,
          valor_esperado_max: 0.92,
        }
      }
      return { ok: true }
    },
  },

  // M4 — razão Impp/Isc tipicamente 0.9–0.99
  {
    codigo: 'RAZAO_IMPP_ISC_FORA_FAIXA',
    severidade: 'medio',
    campo: 'impp_a',
    descricao: 'Razão Impp/Isc fora da faixa típica (0.90 – 0.99)',
    valida(specs) {
      const isc = num(specs.isc_a), impp = num(specs.impp_a)
      if (isc === null || impp === null || isc === 0) return { ok: true }
      const razao = impp / isc
      if (razao < 0.90 || razao > 0.99) {
        return {
          ok: false,
          mensagem: `Impp/Isc = ${razao.toFixed(2)} (esperado entre 0.90 e 0.99).`,
          valor_atual: Number(razao.toFixed(2)),
          valor_esperado_min: 0.90,
          valor_esperado_max: 0.99,
        }
      }
      return { ok: true }
    },
  },

  // M5 — Pmax ≈ Vmpp × Impp (±5%)
  {
    codigo: 'POTENCIA_NAO_BATE_VxI',
    severidade: 'alto',
    campo: 'potencia_w',
    descricao: 'Potência declarada não coincide com Vmpp × Impp',
    valida(specs) {
      const p = num(specs.potencia_w), vmpp = num(specs.vmpp_v), impp = num(specs.impp_a)
      if (p === null || vmpp === null || impp === null) return { ok: true }
      const calculado = vmpp * impp
      if (!approximately(p, calculado, 0.05)) {
        return {
          ok: false,
          mensagem: `Potência declarada ${p}W não coincide com Vmpp×Impp = ${calculado.toFixed(1)}W (tolerância ±5%).`,
          valor_atual: p,
          valor_esperado_min: calculado * 0.95,
          valor_esperado_max: calculado * 1.05,
        }
      }
      return { ok: true }
    },
  },

  // M6 — potência comercial 100–800 Wp
  {
    codigo: 'POTENCIA_FORA_FAIXA_COMERCIAL',
    severidade: 'medio',
    campo: 'potencia_w',
    descricao: 'Potência fora da faixa comercial típica (100–800 Wp)',
    valida(specs) {
      if (!isPresent(specs.potencia_w)) return { ok: true }
      if (!inRange(specs.potencia_w, 100, 800)) {
        return {
          ok: false,
          mensagem: `Potência ${specs.potencia_w}W fora da faixa típica de módulos comerciais.`,
          valor_atual: num(specs.potencia_w),
          valor_esperado_min: 100, valor_esperado_max: 800,
        }
      }
      return { ok: true }
    },
  },

  // M7 — eficiência 10–30 %
  {
    codigo: 'EFICIENCIA_IMPLAUSIVEL',
    severidade: 'medio',
    campo: 'eficiencia_pct',
    descricao: 'Eficiência fora da faixa físicamente plausível',
    valida(specs) {
      if (!isPresent(specs.eficiencia_pct)) return { ok: true }
      if (!inRange(specs.eficiencia_pct, 10, 30)) {
        return {
          ok: false,
          mensagem: `Eficiência ${specs.eficiencia_pct}% fora de [10, 30].`,
          valor_atual: num(specs.eficiencia_pct),
          valor_esperado_min: 10, valor_esperado_max: 30,
        }
      }
      return { ok: true }
    },
  },

  // M8 — Voc 20–80 V
  {
    codigo: 'VOC_IMPLAUSIVEL',
    severidade: 'alto',
    campo: 'voc_v',
    descricao: 'Voc fora da faixa típica de módulos (20–80 V)',
    valida(specs) {
      if (!isPresent(specs.voc_v)) return { ok: true }
      if (!inRange(specs.voc_v, 20, 80)) {
        return {
          ok: false,
          mensagem: `Voc ${specs.voc_v}V fora de [20, 80].`,
          valor_atual: num(specs.voc_v),
          valor_esperado_min: 20, valor_esperado_max: 80,
        }
      }
      return { ok: true }
    },
  },

  // M9 — Isc 3–25 A
  {
    codigo: 'ISC_IMPLAUSIVEL',
    severidade: 'alto',
    campo: 'isc_a',
    descricao: 'Isc fora da faixa típica de módulos (3–25 A)',
    valida(specs) {
      if (!isPresent(specs.isc_a)) return { ok: true }
      if (!inRange(specs.isc_a, 3, 25)) {
        return {
          ok: false,
          mensagem: `Isc ${specs.isc_a}A fora de [3, 25].`,
          valor_atual: num(specs.isc_a),
          valor_esperado_min: 3, valor_esperado_max: 25,
        }
      }
      return { ok: true }
    },
  },

  // M10 — coef temp Voc ∈ [-0.5, -0.15] %/°C
  {
    codigo: 'COEF_TEMP_VOC_FORA_FAIXA',
    severidade: 'medio',
    campo: 'coef_temp_voc_pct_c',
    descricao: 'Coeficiente de temperatura de Voc fora da faixa típica',
    valida(specs) {
      if (!isPresent(specs.coef_temp_voc_pct_c)) return { ok: true }
      if (!inRange(specs.coef_temp_voc_pct_c, -0.5, -0.15)) {
        return {
          ok: false,
          mensagem: `Coef. temp. Voc ${specs.coef_temp_voc_pct_c}%/°C fora de [-0.5, -0.15].`,
          valor_atual: num(specs.coef_temp_voc_pct_c),
          valor_esperado_min: -0.5, valor_esperado_max: -0.15,
        }
      }
      return { ok: true }
    },
  },

  // M11 — coef temp Isc ∈ [0.02, 0.10] %/°C
  {
    codigo: 'COEF_TEMP_ISC_FORA_FAIXA',
    severidade: 'medio',
    campo: 'coef_temp_isc_pct_c',
    descricao: 'Coeficiente de temperatura de Isc fora da faixa típica',
    valida(specs) {
      if (!isPresent(specs.coef_temp_isc_pct_c)) return { ok: true }
      if (!inRange(specs.coef_temp_isc_pct_c, 0.02, 0.10)) {
        return {
          ok: false,
          mensagem: `Coef. temp. Isc ${specs.coef_temp_isc_pct_c}%/°C fora de [0.02, 0.10].`,
          valor_atual: num(specs.coef_temp_isc_pct_c),
          valor_esperado_min: 0.02, valor_esperado_max: 0.10,
        }
      }
      return { ok: true }
    },
  },

  // M13 — peso 10–40 kg
  {
    codigo: 'PESO_IMPLAUSIVEL',
    severidade: 'baixo',
    campo: 'peso_kg',
    descricao: 'Peso fora da faixa típica (10–40 kg)',
    valida(specs) {
      if (!isPresent(specs.peso_kg)) return { ok: true }
      if (!inRange(specs.peso_kg, 10, 40)) {
        return {
          ok: false,
          mensagem: `Peso ${specs.peso_kg}kg fora de [10, 40].`,
          valor_atual: num(specs.peso_kg),
          valor_esperado_min: 10, valor_esperado_max: 40,
        }
      }
      return { ok: true }
    },
  },

  // M14 — número de células canônico
  {
    codigo: 'NUM_CELULAS_NAO_PADRAO',
    severidade: 'baixo',
    campo: 'numero_celulas',
    descricao: 'Número de células fora dos valores comerciais',
    valida(specs) {
      const n = num(specs.numero_celulas)
      if (n === null) return { ok: true }
      const valoresAceitos = [36, 60, 66, 72, 78, 96, 108, 120, 132, 144]
      if (!valoresAceitos.includes(n)) {
        return {
          ok: false,
          mensagem: `Número de células ${n} não é um valor comercial padrão.`,
          valor_atual: n,
        }
      }
      return { ok: true }
    },
  },

  // M15 — fabricante desconhecido
  {
    codigo: 'FABRICANTE_DESCONHECIDO',
    severidade: 'alto',
    campo: 'fabricante',
    descricao: 'Fabricante não identificado',
    valida(specs) {
      if (ehDesconhecido(specs.fabricante)) {
        return {
          ok: false,
          mensagem: `Fabricante "${specs.fabricante || '(vazio)'}" — equipamento precisa identificação.`,
          valor_atual: specs.fabricante || null,
        }
      }
      return { ok: true }
    },
  },

  // M16 — modelo desconhecido
  {
    codigo: 'MODELO_DESCONHECIDO',
    severidade: 'alto',
    campo: 'modelo',
    descricao: 'Modelo não identificado',
    valida(specs) {
      if (ehDesconhecido(specs.modelo)) {
        return {
          ok: false,
          mensagem: `Modelo "${specs.modelo || '(vazio)'}" — equipamento precisa identificação.`,
          valor_atual: specs.modelo || null,
        }
      }
      return { ok: true }
    },
  },
]

// ─── Regras para INVERSORES ─────────────────────────────────────────────────

export const REGRAS_INVERSOR = [
  // I1 — MPPT coerente: min < max < voc_max_dc
  {
    codigo: 'MPPT_INCOERENTE',
    severidade: 'critico',
    campo: 'mppt_min_v',
    descricao: 'Faixa MPPT incoerente (esperado: min < max < voc_max_dc)',
    valida(specs) {
      const min = num(specs.mppt_min_v), max = num(specs.mppt_max_v), vocmax = num(specs.voc_max_dc_v)
      if (min === null || max === null) return { ok: true }
      if (min >= max) {
        return {
          ok: false,
          mensagem: `MPPT min (${min}V) >= MPPT max (${max}V).`,
          valor_atual: min, valor_esperado_max: max - 1,
        }
      }
      if (vocmax !== null && max >= vocmax) {
        return {
          ok: false,
          mensagem: `MPPT max (${max}V) >= Voc max DC (${vocmax}V).`,
          valor_atual: max, valor_esperado_max: vocmax - 10,
        }
      }
      return { ok: true }
    },
  },

  // I2 — Voc max DC 200–1500 V
  {
    codigo: 'VOC_MAX_DC_IMPLAUSIVEL',
    severidade: 'alto',
    campo: 'voc_max_dc_v',
    descricao: 'Voc max DC fora da faixa típica de inversores comerciais',
    valida(specs) {
      if (!isPresent(specs.voc_max_dc_v)) return { ok: true }
      if (!inRange(specs.voc_max_dc_v, 200, 1500)) {
        return {
          ok: false,
          mensagem: `Voc max DC ${specs.voc_max_dc_v}V fora de [200, 1500].`,
          valor_atual: num(specs.voc_max_dc_v),
          valor_esperado_min: 200, valor_esperado_max: 1500,
        }
      }
      return { ok: true }
    },
  },

  // I3 — MPPT min ∈ [50, 400], max ∈ [200, 1000]
  {
    codigo: 'MPPT_FAIXA_IMPLAUSIVEL',
    severidade: 'medio',
    campo: 'mppt_min_v',
    descricao: 'Faixa MPPT fora dos limites práticos',
    valida(specs) {
      const min = num(specs.mppt_min_v), max = num(specs.mppt_max_v)
      if (min !== null && !inRange(min, 50, 400)) {
        return { ok: false, mensagem: `MPPT min ${min}V fora de [50, 400].`, valor_atual: min, valor_esperado_min: 50, valor_esperado_max: 400 }
      }
      if (max !== null && !inRange(max, 200, 1000)) {
        return { ok: false, mensagem: `MPPT max ${max}V fora de [200, 1000].`, valor_atual: max, valor_esperado_min: 200, valor_esperado_max: 1000 }
      }
      return { ok: true }
    },
  },

  // I4 — Isc max MPPT 10–40 A
  {
    codigo: 'ISC_MPPT_IMPLAUSIVEL',
    severidade: 'medio',
    campo: 'isc_max_por_mppt_a',
    descricao: 'Isc max por MPPT fora da faixa típica (10–40 A)',
    valida(specs) {
      if (!isPresent(specs.isc_max_por_mppt_a)) return { ok: true }
      if (!inRange(specs.isc_max_por_mppt_a, 10, 40)) {
        return {
          ok: false,
          mensagem: `Isc max MPPT ${specs.isc_max_por_mppt_a}A fora de [10, 40].`,
          valor_atual: num(specs.isc_max_por_mppt_a),
          valor_esperado_min: 10, valor_esperado_max: 40,
        }
      }
      return { ok: true }
    },
  },

  // I5 — Número de MPPTs 1–12
  {
    codigo: 'NUM_MPPTS_IMPLAUSIVEL',
    severidade: 'medio',
    campo: 'n_mppts',
    descricao: 'Número de MPPTs fora da faixa esperada (1–12)',
    valida(specs) {
      if (!isPresent(specs.n_mppts)) return { ok: true }
      const n = num(specs.n_mppts)
      if (!Number.isInteger(n) || n < 1 || n > 12) {
        return {
          ok: false,
          mensagem: `n_mppts = ${n} fora de [1, 12].`,
          valor_atual: n,
          valor_esperado_min: 1, valor_esperado_max: 12,
        }
      }
      return { ok: true }
    },
  },

  // I6 — Potência CA 1–100 kW (residencial/comercial)
  {
    codigo: 'POTENCIA_FORA_FAIXA',
    severidade: 'baixo',
    campo: 'potencia_kw_ca',
    descricao: 'Potência CA fora da faixa residencial/comercial (1–100 kW)',
    valida(specs) {
      if (!isPresent(specs.potencia_kw_ca)) return { ok: true }
      if (!inRange(specs.potencia_kw_ca, 1, 100)) {
        return {
          ok: false,
          mensagem: `Potência CA ${specs.potencia_kw_ca}kW fora de [1, 100].`,
          valor_atual: num(specs.potencia_kw_ca),
          valor_esperado_min: 1, valor_esperado_max: 100,
        }
      }
      return { ok: true }
    },
  },

  // I7 — DC ≥ AC (oversize esperado)
  {
    codigo: 'DC_AC_INVERSO',
    severidade: 'medio',
    campo: 'potencia_kw_cc_max',
    descricao: 'Potência DC máxima menor que AC (esperado: DC ≥ AC para oversize)',
    valida(specs) {
      const dc = num(specs.potencia_kw_cc_max), ca = num(specs.potencia_kw_ca)
      if (dc === null || ca === null) return { ok: true }
      if (dc < ca) {
        return {
          ok: false,
          mensagem: `Potência DC ${dc}kW menor que CA ${ca}kW.`,
          valor_atual: dc, valor_esperado_min: ca,
        }
      }
      return { ok: true }
    },
  },

  // I8 — DC/AC oversize razoável (≤ 1.5)
  {
    codigo: 'OVERSIZE_EXCESSIVO',
    severidade: 'baixo',
    campo: 'potencia_kw_cc_max',
    descricao: 'Oversize DC/AC excessivo (esperado ≤ 1.5)',
    valida(specs) {
      const dc = num(specs.potencia_kw_cc_max), ca = num(specs.potencia_kw_ca)
      if (dc === null || ca === null || ca === 0) return { ok: true }
      if (dc / ca > 1.5) {
        return {
          ok: false,
          mensagem: `Oversize DC/AC = ${(dc/ca).toFixed(2)} excede 1.5.`,
          valor_atual: Number((dc/ca).toFixed(2)),
          valor_esperado_max: 1.5,
        }
      }
      return { ok: true }
    },
  },

  // I9 — Fases 1 ou 3
  {
    codigo: 'FASES_INVALIDAS',
    severidade: 'alto',
    campo: 'fases_saida',
    descricao: 'Fases de saída devem ser 1 (monofásico) ou 3 (trifásico)',
    valida(specs) {
      if (!isPresent(specs.fases_saida)) return { ok: true }
      const f = num(specs.fases_saida)
      if (f !== 1 && f !== 3) {
        return {
          ok: false,
          mensagem: `Fases ${f} inválido. Esperado 1 ou 3.`,
          valor_atual: f,
        }
      }
      return { ok: true }
    },
  },

  // I10 — tensão saída
  {
    codigo: 'TENSAO_SAIDA_NAO_PADRAO',
    severidade: 'medio',
    campo: 'tensao_saida_v',
    descricao: 'Tensão de saída não corresponde a padrões brasileiros',
    valida(specs) {
      if (!isPresent(specs.tensao_saida_v)) return { ok: true }
      const v = num(specs.tensao_saida_v)
      const padroes = [127, 220, 380, 440]
      if (!padroes.includes(v)) {
        return {
          ok: false,
          mensagem: `Tensão saída ${v}V não é padrão BR (127/220/380/440).`,
          valor_atual: v,
        }
      }
      return { ok: true }
    },
  },

  // I11 — Eficiência 90–99 %
  {
    codigo: 'EFICIENCIA_IMPLAUSIVEL',
    severidade: 'medio',
    campo: 'eficiencia_max_pct',
    descricao: 'Eficiência fora da faixa típica de inversores (90–99 %)',
    valida(specs) {
      if (!isPresent(specs.eficiencia_max_pct)) return { ok: true }
      if (!inRange(specs.eficiencia_max_pct, 90, 99)) {
        return {
          ok: false,
          mensagem: `Eficiência ${specs.eficiencia_max_pct}% fora de [90, 99].`,
          valor_atual: num(specs.eficiencia_max_pct),
          valor_esperado_min: 90, valor_esperado_max: 99,
        }
      }
      return { ok: true }
    },
  },

  // I12 — fabricante/modelo desconhecido (igual módulo)
  {
    codigo: 'FABRICANTE_DESCONHECIDO',
    severidade: 'alto',
    campo: 'fabricante',
    descricao: 'Fabricante não identificado',
    valida(specs) {
      if (ehDesconhecido(specs.fabricante)) {
        return {
          ok: false,
          mensagem: `Fabricante "${specs.fabricante || '(vazio)'}" não identificado.`,
          valor_atual: specs.fabricante || null,
        }
      }
      return { ok: true }
    },
  },
  {
    codigo: 'MODELO_DESCONHECIDO',
    severidade: 'alto',
    campo: 'modelo',
    descricao: 'Modelo não identificado',
    valida(specs) {
      if (ehDesconhecido(specs.modelo)) {
        return {
          ok: false,
          mensagem: `Modelo "${specs.modelo || '(vazio)'}" não identificado.`,
          valor_atual: specs.modelo || null,
        }
      }
      return { ok: true }
    },
  },
]

// ─── Regras ESTRUTURAIS (qualquer tipo) ─────────────────────────────────────

export const REGRAS_ESTRUTURAIS = [
  {
    codigo: 'SEM_TIPO',
    severidade: 'critico',
    campo: 'tipo',
    descricao: 'Documento sem tipo definido',
    valida(specs) {
      if (!specs.tipo) {
        return { ok: false, mensagem: 'Campo `tipo` ausente.', valor_atual: null }
      }
      return { ok: true }
    },
  },
  {
    codigo: 'TIPO_INVALIDO',
    severidade: 'critico',
    campo: 'tipo',
    descricao: 'Tipo fora dos valores aceitos',
    valida(specs) {
      const aceitos = ['modulo','inversor','estrutura','bateria','carregador_ev']
      if (specs.tipo && !aceitos.includes(specs.tipo)) {
        return {
          ok: false,
          mensagem: `Tipo "${specs.tipo}" não está em [${aceitos.join(', ')}].`,
          valor_atual: specs.tipo,
        }
      }
      return { ok: true }
    },
  },
  {
    codigo: 'IDENTIFICACAO_MINIMA',
    severidade: 'alto',
    campo: 'fabricante',
    descricao: 'Identificação mínima (fabricante e modelo com pelo menos 2 caracteres)',
    valida(specs) {
      if (!specs.fabricante || String(specs.fabricante).trim().length < 2) {
        return { ok: false, mensagem: 'Fabricante muito curto ou vazio.', valor_atual: specs.fabricante }
      }
      if (!specs.modelo || String(specs.modelo).trim().length < 2) {
        return { ok: false, mensagem: 'Modelo muito curto ou vazio.', valor_atual: specs.modelo }
      }
      return { ok: true }
    },
  },
  {
    codigo: 'SEM_ESPECIFICACOES',
    severidade: 'medio',
    campo: 'especificacoes',
    descricao: 'Sem especificações técnicas registradas',
    valida(specs) {
      if (!specs._tem_especificacoes_originais) {
        return { ok: false, mensagem: 'Documento não possui campo `especificacoes` preenchido.' }
      }
      return { ok: true }
    },
  },
]

// ─── API pública ────────────────────────────────────────────────────────────

/**
 * Aplica todas as regras pertinentes ao tipo do equipamento.
 * Retorna lista de alertas (cada um já preenchido com codigo/severidade/campo).
 *
 * @param {Object} specs - shape normalizado contendo tipo + fabricante + modelo + campos canônicos
 * @returns {Array<Object>} alertas
 */
export function aplicarRegras(specs) {
  if (!specs || typeof specs !== 'object') return []
  const alertas = []

  const aplicarLista = (lista) => {
    for (const regra of lista) {
      try {
        const r = regra.valida(specs)
        if (r && r.ok === false) {
          alertas.push({
            codigo: regra.codigo,
            severidade: regra.severidade,
            campo: regra.campo,
            descricao: regra.descricao,
            mensagem: r.mensagem || regra.descricao,
            valor_atual: r.valor_atual ?? null,
            valor_esperado_min: r.valor_esperado_min ?? null,
            valor_esperado_max: r.valor_esperado_max ?? null,
            detectado_em: new Date(),
          })
        }
      } catch (err) {
        // regra com bug nunca derruba o pipeline
        alertas.push({
          codigo: 'REGRA_FALHOU',
          severidade: 'info',
          campo: regra.campo || 'desconhecido',
          descricao: `Falha interna na regra ${regra.codigo}`,
          mensagem: err.message,
          detectado_em: new Date(),
        })
      }
    }
  }

  // Estruturais sempre
  aplicarLista(REGRAS_ESTRUTURAIS)

  // Por tipo
  if (specs.tipo === 'modulo') aplicarLista(REGRAS_MODULO)
  else if (specs.tipo === 'inversor') aplicarLista(REGRAS_INVERSOR)
  // Carregador EV e estrutura: por ora só regras estruturais

  return alertas
}

export const _internals = { num, isPresent, inRange, approximately, ehDesconhecido, PADROES_DESCONHECIDO }
