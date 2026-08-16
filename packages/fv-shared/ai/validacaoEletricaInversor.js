/**
 * validacaoEletricaInversor.js — P1-INV-HARDEN-01
 *
 * Verificação de PLAUSIBILIDADE elétrica de um inversor (apenas SINALIZA — NUNCA
 * corrige automaticamente). Roda sobre o `especificacoes` canônico (mesmo
 * vocabulário do SSOT/parser). PURO, sem I/O, sem deps. Importável no front.
 *
 * Não altera SSOT nem catálogo: é uma camada de alerta para a Importação
 * Assistida e para o Golden Suite (detecta extrações incoerentes).
 */

const SQRT3 = Math.sqrt(3)
const n = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

/** Severidades: 'critico' (lei física violada) | 'alto' | 'medio' | 'info'. */
export function validarPlausibilidadeInversor(esp = {}) {
  const a = []
  const add = (campo, severidade, mensagem) => a.push({ campo, severidade, mensagem })

  const pkw   = n(esp.potencia_kw)
  const pmax  = n(esp.potencia_maxima_kw)
  const vac   = n(esp.tensao_ac)
  const iac   = n(esp.corrente_ac_saida)
  const vmin  = n(esp.tensao_mppt_min)
  const vmax  = n(esp.tensao_mppt_max)
  const vdc   = n(esp.tensao_max_entrada)
  const imax  = n(esp.corrente_max_por_mppt)
  const isc   = n(esp.corrente_isc_max)
  const efic  = n(esp.eficiencia_maxima)
  const fases = n(esp.fases) ?? (vac != null ? (vac >= 300 ? 3 : 1) : null)

  // 1) Ordem da faixa MPPT e teto CC
  if (vmin != null && vmax != null && vmin >= vmax)
    add('tensao_mppt_min', 'critico', `MPPT mín (${vmin}V) ≥ MPPT máx (${vmax}V).`)
  if (vmax != null && vdc != null && vmax > vdc)
    add('tensao_mppt_max', 'alto', `MPPT máx (${vmax}V) > tensão máx. de entrada (${vdc}V).`)

  // 2) Eficiência fora de faixa física
  if (efic != null && (efic < 90 || efic > 100))
    add('eficiencia_maxima', 'alto', `Eficiência ${efic}% fora de [90, 100].`)

  // 3) Potência máxima deve ser ≥ nominal
  if (pkw != null && pmax != null && pmax < pkw * 0.98)
    add('potencia_maxima_kw', 'medio', `Potência máx (${pmax}kW) < nominal (${pkw}kW).`)

  // 4) Isc ≥ corrente máx. de entrada (Isc é sempre ≥ Imp)
  if (isc != null && imax != null && isc < imax)
    add('corrente_isc_max', 'medio', `Isc (${isc}A) < corrente máx./MPPT (${imax}A).`)

  // 5) Coerência CA: I ≈ P / (V · k). Trifásico: V pode estar como FASE (<300V) ou
  //    LINHA (≥300V) no datasheet — testa ambas e só alerta se as DUAS divergirem.
  //    fp≈1; corrente declarada costuma ser a MÁX (até ~10% acima da nominal) → tol 40%.
  if (pkw != null && vac != null && iac != null && vac > 0) {
    const P = pkw * 1000
    const cands = fases === 3
      ? [P / (SQRT3 * vac), P / (3 * vac)]   // V como linha · V como fase
      : [P / vac]
    const desvio = Math.min(...cands.map(c => (c > 0 ? Math.abs(iac - c) / c : Infinity)))
    if (desvio > 0.40) {
      const melhor = cands.reduce((a, b) => (Math.abs(iac - b) < Math.abs(iac - a) ? b : a))
      add('corrente_ac_saida', 'medio',
        `Corrente CA ${iac}A incoerente com P=${pkw}kW, V=${vac}V, ${fases || '?'}∅ ` +
        `(esperado ≈ ${melhor.toFixed(1)}A, desvio ${(desvio * 100).toFixed(0)}%).`)
    }
  }

  // 6) Faixas absurdas (sanidade)
  if (pkw != null && (pkw <= 0 || pkw > 600)) add('potencia_kw', 'alto', `Potência nominal ${pkw}kW fora de faixa plausível.`)
  if (vdc != null && (vdc < 100 || vdc > 1500)) add('tensao_max_entrada', 'alto', `Tensão máx. CC ${vdc}V fora de [100, 1500].`)

  return a
}

/** Resumo p/ UI: { ok, alertas, criticos }. */
export function resumirPlausibilidade(esp = {}) {
  const alertas = validarPlausibilidadeInversor(esp)
  return {
    ok: alertas.length === 0,
    alertas,
    criticos: alertas.filter(x => x.severidade === 'critico').length,
  }
}
