/**
 * engenhariaNormativa.js — Sprint 2.5
 *
 * Biblioteca de cálculos de engenharia elétrica para sistemas FV.
 * Normas de referência:
 *   NBR 16690:2019  — Instalações elétricas de microgeração FV
 *   NBR 5410:2004   — Instalações elétricas de baixa tensão
 *   NBR 5419:2015   — Proteção contra descargas atmosféricas (SPDA)
 *   NBR 16800:2020  — Limitadores de sobretensão (DPS)
 *   ABNT IEC 60364-7-712 — Sistemas de alimentação FV
 *
 * ATENÇÃO: coef_temp_voc em DADOS_ELETRICOS_PAINEIS é fração absoluta por Kelvin
 *   (ex: -0.0028 significa -0.28 %/°C). Fórmulas aqui usam essa convenção.
 */

import { DADOS_ELETRICOS_PAINEIS } from '../data/catalogoEletrico.js'

// ─── TEMPERATURAS DE PROJETO POR UF ──────────────────────────────────────────
// Tmin: temperatura ambiente mínima de projeto (°C)
//        Usado para calcular Voc_max — quanto menor, maior a tensão do módulo
// Tmax: temperatura ambiente máxima (°C)
//        Usado para Tcélula máxima → Vmpp mínimo
//
// Fonte: INMET normais climatológicas 1981-2010 + margem de engenharia
// Valores conservadores: Tmin = média dos mínimos extremos; Tmax = média das máximas

export const TEMPERATURAS_UF = {
  // Norte
  AC: { tmin: 15, tmax: 36 },
  AM: { tmin: 14, tmax: 37 },
  AP: { tmin: 16, tmax: 34 },
  PA: { tmin: 14, tmax: 36 },
  RO: { tmin: 12, tmax: 36 },
  RR: { tmin: 14, tmax: 36 },
  TO: { tmin:  8, tmax: 40 },

  // Nordeste
  AL: { tmin: 16, tmax: 35 },
  BA: { tmin:  5, tmax: 38 }, // interior semiárido pode esfriar
  CE: { tmin: 14, tmax: 38 },
  MA: { tmin: 14, tmax: 38 },
  PB: { tmin: 12, tmax: 38 },
  PE: { tmin: 12, tmax: 38 },
  PI: { tmin: 12, tmax: 42 }, // Piauí: clima mais quente do país
  RN: { tmin: 14, tmax: 38 },
  SE: { tmin: 14, tmax: 36 },

  // Centro-Oeste
  DF: { tmin:  5, tmax: 34 },
  GO: { tmin:  3, tmax: 38 },
  MS: { tmin: -2, tmax: 40 },
  MT: { tmin:  5, tmax: 40 },

  // Sudeste
  ES: { tmin:  8, tmax: 36 },
  MG: { tmin:  0, tmax: 38 }, // Diamantina/serras podem chegar a 0°C
  RJ: { tmin: 10, tmax: 36 },
  SP: { tmin:  2, tmax: 37 },

  // Sul (geadas frequentes)
  PR: { tmin: -5, tmax: 35 },
  RS: { tmin: -8, tmax: 35 }, // RS: geadas severas no planalto
  SC: { tmin: -5, tmax: 35 },
}

const TEMP_PADRAO = { tmin: 5, tmax: 38 }

/**
 * Retorna temperaturas de projeto para um estado.
 * @param {string|null} uf - sigla da UF (ex: 'RN', 'SP')
 */
export function calcularTemperaturas(uf) {
  if (!uf) return TEMP_PADRAO
  return TEMPERATURAS_UF[(uf || '').toUpperCase()] || TEMP_PADRAO
}

// ─── CÁLCULOS DE TENSÃO E CORRENTE (NBR 16690) ───────────────────────────────

/**
 * Voc máximo da string na temperatura mínima (NBR 16690 §5.1)
 *
 * Voc_max = n × Voc_stc × [1 + coef_abs × (Tmin − 25)]
 * coef_abs é a fração absoluta por Kelvin (ex: −0.0028 = −0.28 %/°C)
 *
 * Deve ser ≤ tensão máxima de entrada do inversor (Vmax_CC).
 *
 * @param {number} voc        - Voc do módulo em STC (V)
 * @param {number} nModulos   - quantidade de módulos em série na string
 * @param {number} coefAbs    - coef. temp. Voc em fração/K (ex: -0.0028)
 * @param {number} tmin       - temperatura mínima de projeto (°C)
 * @returns {number} Voc_max da string (V)
 */
export function calcularVocMaxString(voc, nModulos, coefAbs, tmin) {
  const fator = 1 + coefAbs * (tmin - 25)   // >1 quando Tmin < 25°C
  return +(voc * nModulos * Math.max(fator, 0.8)).toFixed(1)
}

/**
 * Vmpp mínimo da string na temperatura máxima de célula (NBR 16690 §5.1)
 *
 * Temperatura de célula na condição STC (G = 1000 W/m²):
 *   Tcell = Tamb + (NOCT − 20) / 0.8 × 1.0 = Tamb + 1.25 × (NOCT − 20)
 *
 * Vmpp_min = n × Vmpp_stc × [1 + coef_abs × (Tcell − 25)]
 *
 * Deve ser ≥ Vmpp_mín do inversor.
 *
 * @param {number} vmpp     - Vmpp do módulo em STC (V)
 * @param {number} nModulos - quantidade de módulos em série
 * @param {number} coefAbs  - coef. temp. Voc em fração/K (ex: -0.0028)
 * @param {number} tmax     - temperatura máxima ambiente (°C)
 * @param {number} noct     - temperatura NOCT do módulo (°C), padrão 44°C
 * @returns {number} Vmpp_min da string (V)
 */
export function calcularVmppMinString(vmpp, nModulos, coefAbs, tmax, noct = 44) {
  const tCelula = tmax + 1.25 * (noct - 20)
  const fator   = 1 + coefAbs * (tCelula - 25)   // <1 quando Tcell > 25°C
  return +(vmpp * nModulos * Math.max(fator, 0.5)).toFixed(1)
}

/**
 * Corrente de curto-circuito máxima da string (NBR 16690 §5.2)
 * Isc_max = Isc_stc × 1.25 (fator de segurança normativo)
 *
 * @param {number} isc - Isc do módulo em STC (A)
 * @returns {number}
 */
export function calcularIscMax(isc) {
  return +(isc * 1.25).toFixed(2)
}

// ─── CORRENTE DE SAÍDA AC (NBR 5410) ─────────────────────────────────────────

/**
 * Corrente nominal de saída AC do inversor.
 *
 * Monofásico (1Ø): I = P / (V × fp)
 * Bifásico   (2Ø): I = P / (V × fp)     — V é a tensão fase-fase (220V)
 * Trifásico  (3Ø): I = P / (√3 × V × fp) — V é tensão de linha (380V)
 *
 * NOTA: bifásico usa a mesma fórmula que monofásico porque V_LL = 220V
 *       (a corrente circula pelo condutor ativo ao longo de 220V de diferença).
 *
 * @param {number} potenciaKW - potência nominal AC (kW)
 * @param {number} fasesAC    - 1, 2 ou 3
 * @param {number} tensaoV    - tensão nominal (V). Trifásico: usar 380V.
 * @param {number} fp         - fator de potência, padrão 0.95
 * @returns {number} corrente em A
 */
export function calcularCorrenteAC(potenciaKW, fasesAC, tensaoV, fp = 0.95) {
  const potW = potenciaKW * 1000
  if (fasesAC === 3) return +(potW / (tensaoV * Math.sqrt(3) * fp)).toFixed(1)
  return +(potW / (tensaoV * fp)).toFixed(1)
}

// ─── TABELA DE CABOS NBR 5410 ─────────────────────────────────────────────────
// Tabela 36: condutores de cobre, método B2 (conduíte embutido), XLPE/PVC 70°C
// Temperatura ambiente de referência: 40°C (fator de correção = 1.0)
// Para cabo DC FV (ao sol, 65°C): aplicar fator 0.87 (Tab. 40, 65°C/40°C base)

const TABELA_CABO_NBR5410 = [
  { imax: 14.5, secao: '1.5', disj: '10' },
  { imax: 19.5, secao: '2.5', disj: '16' },
  { imax: 26,   secao: '4',   disj: '20' },
  { imax: 34,   secao: '6',   disj: '25' },
  { imax: 46,   secao: '10',  disj: '32' },
  { imax: 61,   secao: '16',  disj: '50' },
  { imax: 80,   secao: '25',  disj: '63' },
  { imax: 99,   secao: '35',  disj: '80' },
  { imax: 119,  secao: '50',  disj: '100'},
  { imax: 151,  secao: '70',  disj: '125'},
  { imax: 182,  secao: '95',  disj: '160'},
  { imax: 210,  secao: '120', disj: '200'},
]

/**
 * Seleciona a seção mínima de cabo pelo critério de aquecimento (NBR 5410 Tab. 36).
 *
 * Para circuito DC fotovoltaico (tipo 'cc'):
 *   - Fator de projeto normativo: 1.25 (NBR 16690 §6.1)
 *   - Seção mínima: 4 mm² (NBR 16690 §6.1.1)
 *
 * @param {number} corrente - corrente de projeto (A)
 * @param {{ tipo?: 'cc'|'ca' }} opts
 * @returns {{ secao: string, imax: number, disj: string }}
 */
export function selecionarCabo(corrente, { tipo = 'ca' } = {}) {
  const fatorProj  = tipo === 'cc' ? 1.25 : 1.0
  const correnteProjeto = corrente * fatorProj

  for (const row of TABELA_CABO_NBR5410) {
    if (row.imax >= correnteProjeto) {
      // Mínimo 4 mm² para cabo DC FV (NBR 16690 §6.1.1)
      if (tipo === 'cc' && parseFloat(row.secao) < 4) {
        return TABELA_CABO_NBR5410.find(r => parseFloat(r.secao) >= 4) || row
      }
      return row
    }
  }
  return TABELA_CABO_NBR5410[TABELA_CABO_NBR5410.length - 1]
}

// ─── DPS FOTOVOLTAICO (NBR 5419 + NBR 16800) ─────────────────────────────────

/**
 * Seleciona DPS DC conforme NBR 5419:2015 §5.5 e NBR 16800:2020.
 * Tensão de operação contínua mínima: Uc ≥ 1.2 × Voc_max (NBR 5419)
 *
 * @param {number} vocMax - Voc máximo da string já com correção térmica (V)
 * @returns {{ modelo: string, nivel: string, ucMin: number }}
 */
export function selecionarDPS(vocMax) {
  const ucMin = Math.ceil(vocMax * 1.2)
  if (ucMin <= 600)  return { modelo: 'DPS DC 600V / In=20kA',  nivel: 'Tipo II',   ucMin }
  if (ucMin <= 1000) return { modelo: 'DPS DC 1000V / In=20kA', nivel: 'Tipo II',   ucMin }
  return                    { modelo: 'DPS DC 1200V / In=40kA', nivel: 'Tipo I+II', ucMin }
}

// ─── MODELO ELÉTRICO CENTRALIZADO ─────────────────────────────────────────────

/**
 * Monta o modelo elétrico completo para um projeto FV.
 * Serve como fonte de verdade para o diagrama unifilar e o memorial técnico.
 *
 * @param {object} params
 * @param {object}   params.painel         - objeto painel (inclui painel.id)
 * @param {object}   params.inversor       - objeto inversor
 * @param {Array}    params.arranjoMPPTs   - [{numStrings, modulosPorString}] ou null
 * @param {object}   params.dimensionamento - slice do contexto FV
 * @param {object}   params.dadosConsumo   - slice do contexto FV
 * @param {string}   params.uf             - sigla da UF (ex: 'RN')
 * @returns {object} electricalModel
 */
export function montarModeloEletrico({
  painel         = null,
  inversor       = null,
  arranjoMPPTs   = null,
  dimensionamento = {},
  dadosConsumo    = {},
  uf              = null,
}) {
  // ── Temperatura de projeto ──────────────────────────────────────────────────
  const { tmin, tmax } = calcularTemperaturas(uf)

  // ── Parâmetros do módulo ────────────────────────────────────────────────────
  // coef_temp_voc e temp_noct só existem em DADOS_ELETRICOS_PAINEIS (catálogo elétrico)
  // SeletorPaineis não os inclui no objeto selecionado → busca pelo ID
  const catEletrico = painel?.id ? (DADOS_ELETRICOS_PAINEIS[painel.id] ?? null) : null

  const voc      = catEletrico?.voc      || painel?.voc      || 49.5
  const vmpp     = catEletrico?.vmpp     || painel?.vmpp     || 41.2
  const isc      = catEletrico?.isc      || painel?.isc      || 13.9
  const pmpp     = catEletrico?.potencia_w || painel?.potenciaW || painel?.pmpp || 550
  const coefAbs  = catEletrico?.coef_temp_voc || painel?.coef_temp_voc || -0.0029
  const noct     = catEletrico?.temp_noct || painel?.temp_noct || 44

  // ── Parâmetros do inversor ──────────────────────────────────────────────────
  const invPotKW = inversor?.potenciaKW  || dimensionamento?.potenciaArredondada || 5
  const invNMPPT = inversor?.nMppts      || 1
  const invTipo  = (inversor?.tipo || 'string').toLowerCase()

  // ── Fase e tensão AC ────────────────────────────────────────────────────────
  const tipoLig = (dadosConsumo?.tipoLigacao || 'monofasico')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const fasesAC  = tipoLig.includes('trifas') ? 3 : tipoLig.includes('bifas') ? 2 : 1
  const tensaoBase = parseInt(dadosConsumo?.tensao) || 220
  const tensaoAC   = fasesAC === 3 ? 380 : tensaoBase

  // ── Arranjo por MPPT ────────────────────────────────────────────────────────
  let mppts = arranjoMPPTs && arranjoMPPTs.length > 0 ? arranjoMPPTs : null
  if (!mppts) {
    // Fallback para modelo legado (numStrings total, sem estrutura multi-MPPT)
    const numStrings = dimensionamento?.numStrings ?? 1
    const numPaineis = dimensionamento?.numPaineis ?? 6
    const modPorStr  = Math.ceil(numPaineis / Math.max(numStrings, 1))
    const nMppts     = Math.max(invNMPPT, 1)
    const strPorMppt = Math.ceil(numStrings / nMppts)
    mppts = Array.from({ length: nMppts }, () => ({
      numStrings:      strPorMppt,
      modulosPorString: modPorStr,
    }))
  }

  // ── Cálculo elétrico por MPPT ────────────────────────────────────────────────
  const mpptCalc = mppts.map((m, idx) => {
    const nSer    = m.modulosPorString
    const vocMax  = calcularVocMaxString(voc,  nSer, coefAbs, tmin)
    const vmppMin = calcularVmppMinString(vmpp, nSer, coefAbs, tmax, noct)
    const iscMaxS = calcularIscMax(isc)
    const iscTotM = +(iscMaxS * m.numStrings).toFixed(1)
    return {
      mppt:         idx + 1,
      numStrings:   m.numStrings,
      modPorString: nSer,
      vocMax,
      vmppMin,
      iscMaxStr:    iscMaxS,
      iscTotalMPPT: iscTotM,
      dps:          selecionarDPS(vocMax),
    }
  })

  // ── Totais ─────────────────────────────────────────────────────────────────
  const numPaineisTotal = mppts.reduce((s, m) => s + m.numStrings * m.modulosPorString, 0)
  const numStringsTotal = mppts.reduce((s, m) => s + m.numStrings, 0)
  const vocMaxGlobal    = Math.max(...mpptCalc.map(m => m.vocMax))
  const iscTotalDC      = +mpptCalc.reduce((s, m) => s + m.iscTotalMPPT, 0).toFixed(1)

  // ── Cabos e proteções ───────────────────────────────────────────────────────
  const iscStrMax = calcularIscMax(isc)
  const caboDC    = selecionarCabo(iscStrMax, { tipo: 'cc' })
  const iac       = calcularCorrenteAC(invPotKW, fasesAC, tensaoAC)
  const caboAC    = selecionarCabo(iac, { tipo: 'ca' })
  const dpsGlobal = selecionarDPS(vocMaxGlobal)

  // ── Labels de fase ──────────────────────────────────────────────────────────
  const fasesLabel = fasesAC === 1 ? `1Ø ${tensaoAC}V`
                   : fasesAC === 2 ? `2Ø ${tensaoAC}V`
                   :                 `3Ø 380V`
  const disjLabel  = fasesAC === 1 ? '1P' : fasesAC === 2 ? '2P' : '3P'

  return {
    temperatura: { tmin, tmax, uf: uf ?? '—' },
    sistema: {
      potenciaCC:  +(numPaineisTotal * pmpp / 1000).toFixed(2),
      potenciaCA:  invPotKW,
      fasesAC,
      tensaoAC,
      tipoLigacao: tipoLig,
    },
    modulos:  { voc, vmpp, isc, pmpp, coefAbs, noct, quantidade: numPaineisTotal },
    inversor: { potencia: invPotKW, nMppts: invNMPPT, tipo: invTipo, fasesAC },
    mppts:    mpptCalc,
    resumo:   { numPaineis: numPaineisTotal, numStrings: numStringsTotal, vocMaxGlobal, iscTotalDC },
    cabos:    { dc: caboDC, ac: caboAC, aterramento: '6' },
    protecoes:{ djDCamp: caboDC.disj, djACamp: caboAC.disj, dps: dpsGlobal },
    fasesLabel,
    disjLabel,
    iac,
  }
}
