/**
 * engineeringFallback.js — P1-ENGINEERING-FALLBACK-01
 *
 * Camada de ENGENHARIA CONSERVADORA, **somente em tempo de execução**.
 *
 * Recebe um equipamento REAL (já lido/normalizado pelo SSOT) e devolve uma CÓPIA
 * "operacional" com campos ausentes preenchidos por fallback conservador, para que
 * unifilar / parecer / pré-dimensionamento continuem funcionando mesmo com lacunas.
 *
 * GARANTIAS (críticas):
 *  - NÃO grava no Atlas. NÃO altera o catálogo, o SSOT, o parser nem o OCR.
 *  - NÃO muta o objeto original (retorna cópia).
 *  - Todo valor inferido carrega proveniência: origem='fallback_conservador',
 *    confianca='baixa', motivo='campo_ausente'.
 *  - Apenas a regra de `tensao_partida` está ATIVA nesta sprint; as demais estão
 *    documentadas e DESLIGADAS (ativa:false).
 */

export const ORIGEM_FALLBACK = 'fallback_conservador'

// ── FASE 5 — contrato de status p/ a UI (sem alterar componentes) ────────────
export const STATUS = {
  EXTRAIDO: 'extraido',                     // valor veio direto da extração (PDF texto)
  VALIDADO: 'validado',                     // valor revisado/confirmado por humano
  INFERIDO_FORTE: 'inferido_forte',         // inferência de alta confiança (OCR/compartilhado)
  FALLBACK: 'fallback_conservador',         // preenchido por ESTA camada (runtime)
}

// ── FASE 1 — campos que podem travar/degradar engenharia, classificados ──────
export const CAMPOS_ENGENHARIA = {
  CRITICO: ['potencia_kw', 'n_mppts', 'tensao_max_entrada', 'tensao_mppt_min', 'tensao_mppt_max', 'corrente_max_por_mppt'],
  IMPORTANTE: ['corrente_ac_saida', 'tensao_ac', 'corrente_isc_max', 'tensao_partida'],
  OPCIONAL: ['eficiencia_maxima', 'peso_kg', 'dimensoes', 'grau_protecao_ip', 'certificacoes'],
}

const num = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0
const presente = (e, campo) => (campo === 'dimensoes' || campo === 'grau_protecao_ip' || campo === 'certificacoes')
  ? !!e[campo] : num(e[campo])

// ── FASE 4 — regras de fallback ──────────────────────────────────────────────
// ATIVA: tensao_partida. DOCUMENTADAS/DESLIGADAS: as demais.
export const REGRAS_FALLBACK = {
  tensao_partida: {
    ativa: true,
    motivo: 'campo_ausente',
    // Conservador: a tensão de partida nunca é maior que o piso operacional do MPPT;
    // assumir partida = tensao_mppt_min é fisicamente plausível e do lado SEGURO
    // para validação de strings (exige margem). Sem MPPT_min, usa default conservador
    // típico de inversores string trifásicos.
    valor: (e) => (num(e.tensao_mppt_min) ? e.tensao_mppt_min : 200),
    descricao: 'tensao_mppt_min (piso do MPPT) ou default 200 V',
  },
  // ─── FUTURAS (NÃO ativas nesta sprint) ───────────────────────────────────
  n_mppts: { ativa: false, descricao: 'Conservador: 1 MPPT (pior caso p/ distribuição de strings).' },
  strings_por_mppt: { ativa: false, descricao: 'Conservador: 1 string por MPPT.' },
  corrente_max_por_mppt: { ativa: false, descricao: 'Conservador: derivar de potência/tensão CC ou default por classe.' },
  corrente_isc_max: { ativa: false, descricao: 'Conservador: corrente_max_por_mppt × 1.25 (fator Isc).' },
  peso_kg: { ativa: false, descricao: 'Conservador: faixa por potência (tabela).' },
  dimensoes: { ativa: false, descricao: 'Conservador: envelope máximo por classe de potência.' },
  grau_protecao_ip: { ativa: false, descricao: 'Conservador: IP65 (mínimo p/ uso externo).' },
}

/**
 * Aplica o fallback conservador (runtime). Não muta `equip`.
 * @param {Object} equip equipamento real (visão canônica do SSOT)
 * @returns {{ operacional: Object, fallback: Object, campos_inferidos: string[] }}
 */
export function aplicarFallbackEngenharia(equip = {}) {
  const operacional = { ...equip }            // cópia rasa — original intocado
  const fallback = {}                          // proveniência por campo inferido
  for (const [campo, regra] of Object.entries(REGRAS_FALLBACK)) {
    if (!regra.ativa) continue
    if (presente(equip, campo)) continue       // só preenche o que está AUSENTE
    const valor = regra.valor(equip)
    if (valor == null) continue
    operacional[campo] = valor
    fallback[campo] = { valor, origem: ORIGEM_FALLBACK, confianca: 'baixa', motivo: regra.motivo, regra: campo }
  }
  return { operacional, fallback, campos_inferidos: Object.keys(fallback) }
}

/**
 * FASE 5 — status de um campo para exibição (não altera componentes).
 * @param {string} campo
 * @param {Object} ctx { real (equip), fallback (mapa), statusExtracao (mapa _status/fonte_dados), validado (bool) }
 */
export function statusDoCampo(campo, ctx = {}) {
  const { real = {}, fallback = {}, statusExtracao = {}, validado = false } = ctx
  if (fallback[campo]) return STATUS.FALLBACK
  if (validado) return STATUS.VALIDADO
  const s = statusExtracao[campo]
  if (s === 'inferido_alta' || s === 'inferido_forte') return STATUS.INFERIDO_FORTE
  if (presente(real, campo) || real[campo] != null) return STATUS.EXTRAIDO
  return null  // ausente e sem fallback
}

// ── FASE 6 — estrutura p/ substituição manual futura (sem UI/endpoint) ───────
export const ROLES_PODEM_SUBSTITUIR = ['engenheiro', 'tecnico', 'administrador']
export const podeSubstituir = (role) => ROLES_PODEM_SUBSTITUIR.includes(String(role || '').toLowerCase())
/**
 * Contrato (documental) da futura substituição do valor estimado pelo real.
 * Quando implementado, deverá: gravar valor_real no Atlas (campo real), limpar o
 * fallback, e registrar autoria/data. NÃO implementado nesta sprint.
 */
export const CONTRATO_SUBSTITUICAO = {
  shape: { campo: 'string', valor_real: 'number|string', por: 'role', em: 'Date', substitui: ORIGEM_FALLBACK },
  regra: 'somente roles em ROLES_PODEM_SUBSTITUIR; grava real no Atlas e remove o fallback do runtime.',
}
