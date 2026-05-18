/**
 * 🔌 Motor de Compatibilidade Elétrica FV (string-based)
 *
 * Funções puras, sem dependência de banco. Recebe specs de módulo e inversor e
 * calcula:
 *   - quantidade ideal de módulos
 *   - configuração de strings (série × paralelo)
 *   - validação elétrica (Voc, Isc, faixa MPPT, potência)
 *   - sugestão de acessórios (DPS, disjuntores, bitola, conectores)
 *
 * Referências:
 *  - NBR 5410:2004 — instalações elétricas baixa tensão
 *  - NBR 16690:2019 — instalações fotovoltaicas
 *  - NBR 16612:2020 — cabos solares (CC)
 *  - IEC 60269 — fusíveis CC
 */

// ─── Constantes elétricas e de segurança ─────────────────────────────────────
const FATOR_TEMPERATURA_VOC = 1.15      // Voc cresce ~15% a -10°C (cidades RN, p.ex. Caicó madrugada)
const FATOR_SOBRE_CORRENTE = 1.25       // NBR 5410 — proteção contra sobrecorrente
const FAIXA_DC_AC_RATIO_MIN = 0.8       // P_DC / P_AC mínimo (sub-dimensionado)
const FAIXA_DC_AC_RATIO_MAX = 1.25      // máximo (oversize aceitável em latitude baixa)
const TENSAO_REDE_MONOFASICA = 220
const TENSAO_REDE_TRIFASICA = 380

// Tabela ABNT NBR 5410 (simplificada) — bitola mínima por corrente em ampacidade B1 (cabos PVC)
// Aproximação: condutores em eletroduto embutido em alvenaria, 30°C, 2 carregados
const TABELA_BITOLA_NBR_5410 = [
  { ate_amps: 15,   mm2: 1.5 },
  { ate_amps: 21,   mm2: 2.5 },
  { ate_amps: 28,   mm2: 4 },
  { ate_amps: 36,   mm2: 6 },
  { ate_amps: 50,   mm2: 10 },
  { ate_amps: 68,   mm2: 16 },
  { ate_amps: 89,   mm2: 25 },
  { ate_amps: 110,  mm2: 35 },
  { ate_amps: 134,  mm2: 50 },
  { ate_amps: 171,  mm2: 70 },
  { ate_amps: 207,  mm2: 95 },
  { ate_amps: 239,  mm2: 120 },
  { ate_amps: 999,  mm2: 150 },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function round(n, casas = 2) { return Number(n.toFixed(casas)) }

/**
 * Extrai specs de um módulo de forma defensiva — schema heterogêneo (Mixed).
 * Aceita variações comuns: { potencia_w, voc, isc, vmpp, impp, eficiencia }
 *                      ou: especificacoes.{potencia, voc, isc, vmp, imp, eficiencia}
 */
export function extrairSpecsModulo(equipamento) {
  if (!equipamento) return null
  const esp = equipamento.especificacoes || {}
  return {
    fabricante: equipamento.fabricante || null,
    modelo: equipamento.modelo || null,
    potencia_w: equipamento.potencia_w || esp.potencia_w || esp.potencia || 0,
    voc: esp.voc || esp.voc_v || equipamento.voc || 0,
    isc: esp.isc || esp.isc_a || equipamento.isc || 0,
    vmpp: esp.vmp || esp.vmpp || esp.vmpp_v || 0,
    impp: esp.imp || esp.impp || esp.impp_a || 0,
    eficiencia_pct: esp.eficiencia || esp.eficiencia_pct || 0,
    coef_temp_voc: esp.coef_temp_voc || esp.coef_temp_voc_pct_c || -0.27,  // %/°C típico
    largura_mm: esp.largura_mm || esp.dimensoes_largura_mm || 1134,
    altura_mm: esp.altura_mm || esp.dimensoes_altura_mm || 2278,
  }
}

/**
 * Extrai specs de inversor de forma defensiva.
 */
export function extrairSpecsInversor(equipamento) {
  if (!equipamento) return null
  const esp = equipamento.especificacoes || {}
  return {
    fabricante: equipamento.fabricante || null,
    modelo: equipamento.modelo || null,
    potencia_kw: esp.potencia_kw || equipamento.potencia_kw || esp.potencia || 0,
    fases: esp.fases || esp.fases_saida || 1,
    tensao_nominal_v: esp.tensao_nominal_v || (esp.fases_saida === 3 ? 380 : 220),
    voc_max_dc: esp.voc_max_dc || esp.tensao_max_dc || esp.vpv_max || 600,
    mppt_min_v: esp.mppt_min_v || esp.faixa_mppt_min || 100,
    mppt_max_v: esp.mppt_max_v || esp.faixa_mppt_max || 550,
    isc_max_mppt: esp.isc_max_mppt || esp.corrente_max_mppt || esp.ipv_max || 13,
    n_mppts: esp.n_mppts || esp.mppts || 2,
    eficiencia_pct: esp.eficiencia || esp.eficiencia_pct || 97,
    tipo: esp.tipo_inversor || equipamento.tipo_inversor || 'string',
  }
}

// ─── 1. Montagem de strings ──────────────────────────────────────────────────

/**
 * Dado um módulo, inversor e quantidade total desejada, calcula a melhor
 * configuração de strings (série × paralelo) respeitando limites elétricos.
 *
 * @param {Object} input
 * @param {Object} input.modulo   — specs (saída de extrairSpecsModulo)
 * @param {Object} input.inversor — specs (saída de extrairSpecsInversor)
 * @param {number} input.qtd_modulos_total
 * @returns {Object} { configuracao, alertas, ok }
 */
export function montarStrings({ modulo, inversor, qtd_modulos_total }) {
  const alertas = []

  if (!modulo || !modulo.voc || !modulo.isc) {
    return {
      ok: false,
      configuracao: null,
      alertas: [{ nivel: 'erro', codigo: 'MODULO_SEM_SPECS', mensagem: 'Módulo sem Voc/Isc — preencher especificações antes de montar strings.' }],
    }
  }
  if (!inversor || !inversor.voc_max_dc) {
    return {
      ok: false,
      configuracao: null,
      alertas: [{ nivel: 'erro', codigo: 'INVERSOR_SEM_SPECS', mensagem: 'Inversor sem Voc max DC — preencher especificações antes de montar strings.' }],
    }
  }
  if (!qtd_modulos_total || qtd_modulos_total <= 0) {
    return {
      ok: false,
      configuracao: null,
      alertas: [{ nivel: 'erro', codigo: 'QTD_INVALIDA', mensagem: 'qtd_modulos_total deve ser > 0.' }],
    }
  }

  // Limite de módulos em série (Voc corrigido por temperatura)
  const voc_corrigido = modulo.voc * FATOR_TEMPERATURA_VOC
  const max_modulos_serie = Math.floor(inversor.voc_max_dc / voc_corrigido)
  const min_modulos_serie = Math.ceil(inversor.mppt_min_v / modulo.vmpp || 1)

  if (max_modulos_serie < min_modulos_serie) {
    return {
      ok: false,
      configuracao: null,
      alertas: [{
        nivel: 'erro',
        codigo: 'INCOMPATIVEL',
        mensagem: `Combinação inviável: módulo de Voc=${modulo.voc}V não cabe na faixa MPPT do inversor (${inversor.mppt_min_v}-${inversor.mppt_max_v}V).`,
      }],
    }
  }

  // Heurística: maximizar módulos por string (menos paralelismo = menos cabeamento)
  // Aceita configurações onde o paralelo cabe nos MPPTs.
  let melhor = null
  for (let n_serie = max_modulos_serie; n_serie >= min_modulos_serie; n_serie--) {
    if (qtd_modulos_total % n_serie !== 0) continue
    const n_paralelo = qtd_modulos_total / n_serie
    // Cada MPPT aceita 1 string em paralelo (configuração simples); n_mppts strings totais
    if (n_paralelo > inversor.n_mppts) continue

    melhor = { n_serie, n_paralelo }
    break
  }

  // Se não achou divisão exata, aceitar quantidade não divisível com strings desiguais
  if (!melhor) {
    const n_serie = Math.min(max_modulos_serie, qtd_modulos_total)
    const n_strings_completas = Math.floor(qtd_modulos_total / n_serie)
    const resto = qtd_modulos_total % n_serie
    melhor = { n_serie, n_paralelo: n_strings_completas, resto }
    alertas.push({
      nivel: 'aviso',
      codigo: 'QTD_NAO_DIVISIVEL',
      mensagem: `Quantidade ${qtd_modulos_total} não divide igualmente em strings de ${n_serie} módulos. ${n_strings_completas} string(s) completa(s) + ${resto} módulo(s) restante(s). Considere ajustar a quantidade.`,
    })
  }

  // Cálculos por string
  const voc_string = round(modulo.voc * melhor.n_serie)
  const voc_string_corrigido = round(voc_corrigido * melhor.n_serie)
  const vmpp_string = round(modulo.vmpp * melhor.n_serie)
  const isc_string = round(modulo.isc)  // série não soma Isc
  const potencia_array_w = melhor.n_serie * melhor.n_paralelo * modulo.potencia_w
  const potencia_array_kw = round(potencia_array_w / 1000)

  // Validações finais
  if (voc_string_corrigido > inversor.voc_max_dc) {
    alertas.push({
      nivel: 'erro',
      codigo: 'VOC_EXCEDE',
      mensagem: `Voc corrigido por temperatura (${voc_string_corrigido}V) excede Voc max DC do inversor (${inversor.voc_max_dc}V). Reduzir módulos em série.`,
    })
  }
  if (vmpp_string < inversor.mppt_min_v) {
    alertas.push({
      nivel: 'aviso',
      codigo: 'MPPT_ABAIXO',
      mensagem: `Vmpp da string (${vmpp_string}V) abaixo do mínimo MPPT do inversor (${inversor.mppt_min_v}V). Risco de baixa eficiência em dias nublados.`,
    })
  }
  if (isc_string > inversor.isc_max_mppt) {
    alertas.push({
      nivel: 'erro',
      codigo: 'ISC_EXCEDE',
      mensagem: `Isc da string (${isc_string}A) excede corrente máxima do MPPT (${inversor.isc_max_mppt}A).`,
    })
  }

  // Faixa DC/AC ratio
  const dc_ac_ratio = round(potencia_array_kw / inversor.potencia_kw, 3)
  if (dc_ac_ratio < FAIXA_DC_AC_RATIO_MIN) {
    alertas.push({
      nivel: 'aviso',
      codigo: 'INVERSOR_SUPERDIMENSIONADO',
      mensagem: `Inversor superdimensionado (DC/AC = ${dc_ac_ratio}). Recomendado entre ${FAIXA_DC_AC_RATIO_MIN} e ${FAIXA_DC_AC_RATIO_MAX}.`,
    })
  } else if (dc_ac_ratio > FAIXA_DC_AC_RATIO_MAX) {
    alertas.push({
      nivel: 'aviso',
      codigo: 'INVERSOR_SUBDIMENSIONADO',
      mensagem: `Inversor subdimensionado (DC/AC = ${dc_ac_ratio}). Risco de clipping em horários de pico. Recomendado entre ${FAIXA_DC_AC_RATIO_MIN} e ${FAIXA_DC_AC_RATIO_MAX}.`,
    })
  }

  const ok = !alertas.some(a => a.nivel === 'erro')

  return {
    ok,
    configuracao: {
      n_modulos_serie: melhor.n_serie,
      n_strings_paralelo: melhor.n_paralelo,
      modulos_resto: melhor.resto || 0,
      voc_string,
      voc_string_corrigido,
      vmpp_string,
      isc_string,
      potencia_array_kw,
      dc_ac_ratio,
      total_modulos_usados: (melhor.n_serie * melhor.n_paralelo) + (melhor.resto || 0),
    },
    limites_inversor: {
      voc_max_dc: inversor.voc_max_dc,
      mppt_min_v: inversor.mppt_min_v,
      mppt_max_v: inversor.mppt_max_v,
      isc_max_mppt: inversor.isc_max_mppt,
      n_mppts: inversor.n_mppts,
    },
    alertas,
  }
}

// ─── 2. Sugestão de acessórios ───────────────────────────────────────────────

/**
 * Sugere bitola de cabo pela NBR 5410 (tabela simplificada B1).
 */
export function sugerirBitola(corrente_a) {
  const corrente_proj = corrente_a * FATOR_SOBRE_CORRENTE
  for (const linha of TABELA_BITOLA_NBR_5410) {
    if (corrente_proj <= linha.ate_amps) return linha.mm2
  }
  return 150  // máximo na tabela
}

/**
 * Sugere disjuntor (valor comercial padrão acima da corrente de projeto).
 */
export function sugerirDisjuntor(corrente_a) {
  const corrente_proj = corrente_a * FATOR_SOBRE_CORRENTE
  const valores_comerciais = [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400]
  return valores_comerciais.find(v => v >= corrente_proj) || 400
}

/**
 * Dado o resultado de montarStrings + inversor, sugere lista completa de acessórios.
 *
 * @param {Object} input
 * @param {Object} input.configuracao  — saída de montarStrings.configuracao
 * @param {Object} input.inversor      — specs
 * @param {number} [input.comprimento_cabo_cc_m=10]
 * @param {number} [input.comprimento_cabo_ca_m=15]
 * @returns {Object} acessórios + alertas
 */
export function sugerirAcessorios({
  configuracao,
  inversor,
  comprimento_cabo_cc_m = 10,
  comprimento_cabo_ca_m = 15,
}) {
  if (!configuracao || !inversor) {
    return { ok: false, alertas: [{ nivel: 'erro', codigo: 'SEM_ENTRADA', mensagem: 'configuracao e inversor são obrigatórios.' }] }
  }

  const alertas = []
  const tensao_ac = inversor.fases === 3 ? TENSAO_REDE_TRIFASICA : TENSAO_REDE_MONOFASICA

  // ─── CC (lado dos módulos) ───
  const isc_string = configuracao.isc_string || 0
  const voc_string = configuracao.voc_string_corrigido || configuracao.voc_string || 0

  const cabo_cc_mm2 = sugerirBitola(isc_string)
  const disjuntor_cc_a = sugerirDisjuntor(isc_string)
  const fusivel_cc_a = sugerirDisjuntor(isc_string)  // pode ser substituído por valores 10/15/20 padrão CC

  // ─── CA (lado da rede) ───
  const corrente_ac = (inversor.potencia_kw * 1000) / (tensao_ac * (inversor.fases === 3 ? Math.sqrt(3) : 1))
  const cabo_ca_mm2 = sugerirBitola(corrente_ac)
  const disjuntor_ca_a = sugerirDisjuntor(corrente_ac)

  // ─── Conectores ───
  const n_conectores_mc4 = (configuracao.n_strings_paralelo || 1) * 2  // par +/- por string

  // ─── DPS ───
  const dps_cc = {
    classe: 'II',
    tensao_v: Math.ceil(voc_string * 1.2 / 50) * 50,  // arredonda para múltiplo de 50V acima
    corrente_descarga_ka: 20,  // 20 kA padrão residencial/comercial
  }
  const dps_ca = {
    classe: inversor.potencia_kw > 30 ? 'I+II' : 'II',
    tensao_v: tensao_ac,
    corrente_descarga_ka: inversor.potencia_kw > 30 ? 25 : 20,
  }

  // ─── Aterramento ───
  const aterramento = {
    tipo: 'TN-S ou TT',
    haste_min_m: 2.4,
    qtd_hastes_min: inversor.potencia_kw > 10 ? 3 : 1,
    resistencia_max_ohms: 25,
    bitola_cabo_terra_mm2: Math.max(6, cabo_ca_mm2 / 2),
  }

  // ─── Estrutura ───
  const estrutura = {
    qtd_modulos: configuracao.total_modulos_usados || 0,
    tipo_sugerido: 'Telhado metálico (perfil em alumínio)',
    obs: 'Verificar tipo do telhado real (cerâmico, fibrocimento, laje, solo) e ajustar.',
  }

  // ─── Alertas operacionais ───
  if (cabo_cc_mm2 >= 16) {
    alertas.push({
      nivel: 'aviso',
      codigo: 'BITOLA_GROSSA_CC',
      mensagem: `Bitola CC ${cabo_cc_mm2}mm² é grossa — considere strings menores ou conectar mais inversores menores para reduzir corrente.`,
    })
  }
  if (corrente_ac > 100) {
    alertas.push({
      nivel: 'info',
      codigo: 'CORRENTE_ALTA_CA',
      mensagem: `Corrente CA ${round(corrente_ac, 1)}A. Disjuntor ${disjuntor_ca_a}A. Considerar quadro de proteção dedicado.`,
    })
  }

  return {
    ok: true,
    acessorios: {
      cc: {
        cabo_mm2: cabo_cc_mm2,
        comprimento_estimado_m: comprimento_cabo_cc_m,
        disjuntor_a: disjuntor_cc_a,
        fusivel_a: fusivel_cc_a,
        conectores_mc4_pares: n_conectores_mc4,
        dps: dps_cc,
      },
      ca: {
        cabo_mm2: cabo_ca_mm2,
        comprimento_estimado_m: comprimento_cabo_ca_m,
        corrente_calculada_a: round(corrente_ac, 1),
        disjuntor_a: disjuntor_ca_a,
        dps: dps_ca,
      },
      aterramento,
      estrutura,
    },
    alertas,
  }
}

export default {
  extrairSpecsModulo,
  extrairSpecsInversor,
  montarStrings,
  sugerirAcessorios,
  sugerirBitola,
  sugerirDisjuntor,
}
