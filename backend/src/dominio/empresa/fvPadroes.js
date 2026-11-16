/**
 * fvPadroes — padrões do módulo FV definidos pela EMPRESA (EmpresaConfig.fv_padroes).
 *
 * Hoje: `eficiencia_padrao` — fator global de geração (HSP × 30 × fator) com que
 * um projeto NOVO nasce. Não é retroativo: projeto salvo mantém o valor dele.
 *
 * Faixa 0,50–1,00. Fora dela é erro de digitação (ex.: "75" no lugar de 0,75).
 * Sem configuração, o sistema usa EFICIENCIA_FALLBACK — e a tela diz que é o
 * "padrão do sistema", nunca finge que alguém configurou.
 */
export const EFICIENCIA_MIN = 0.5
export const EFICIENCIA_MAX = 1.0
export const EFICIENCIA_FALLBACK = 0.8

/** @returns {{ok: true} | {ok: false, erro: string}} */
export function validarFvPadroes(grupo) {
  if (grupo === undefined) return { ok: true }
  if (grupo === null || typeof grupo !== 'object' || Array.isArray(grupo)) {
    return { ok: false, erro: 'fv_padroes deve ser um objeto.' }
  }
  if ('eficiencia_padrao' in grupo) {
    const v = grupo.eficiencia_padrao
    // null limpa a configuração (volta ao padrão do sistema).
    if (v !== null) {
      const n = typeof v === 'number' ? v : NaN
      if (!Number.isFinite(n) || n < EFICIENCIA_MIN || n > EFICIENCIA_MAX) {
        return {
          ok: false,
          erro: `eficiencia_padrao deve ser um número entre ${EFICIENCIA_MIN} e ${EFICIENCIA_MAX} (ex.: 0.75 = 75%).`,
        }
      }
    }
  }
  return { ok: true }
}
