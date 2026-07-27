/**
 * lme/contrato.js — Legacy Migration Engine · ADR-022
 *
 * CONTRATO ÚNICO de toda migração de legado. Nenhum script solto: para trazer
 * ou reprocessar dado legado, declara-se um PLANO que implementa estes estágios.
 *
 * Pipeline canônico (todo plano percorre exatamente esta ordem):
 *
 *   Fonte → [validação bruta] → Normalizador → [validação canônica]
 *         → Matcher → Reconciliador → Aplicador
 *
 * Direção da dependência (ADR-021, regra 3): o LME conhece o Core e converte
 * PARA ele. O Core jamais importa daqui. Por isso este arquivo importa
 * `dominio/tenancy` — nunca o contrário.
 *
 * PURO: sem I/O, sem mongoose, sem express. Só o contrato e sua verificação.
 */
import { exigeTenant, ErroTenantAusente } from '../dominio/tenancy/index.js'

/** Etapas do pipeline, na ordem. Toda entrada do ledger cita uma delas. */
export const ETAPAS = Object.freeze([
  'extracao',
  'validacao_bruta',
  'normalizacao',
  'validacao_canonica',
  'matching',
  'reconciliacao',
  'aplicacao',
])

/** Decisões possíveis do Reconciliador. Fechado — não estender sem ADR. */
export const ACOES = Object.freeze({
  CRIAR:     'criar',      // não existe no destino
  ATUALIZAR: 'atualizar',  // existe e o legado acrescenta informação
  IGNORAR:   'ignorar',    // existe e nada muda (idempotência)
  CONFLITO:  'conflito',   // existe divergente — exige decisão humana, nunca sobrescreve
})

export class ErroPlanoInvalido extends Error {
  constructor(falhas) {
    super(`Plano de migração inválido:\n  - ${falhas.join('\n  - ')}`)
    this.name = 'ErroPlanoInvalido'
    this.codigo = 'LME_PLANO_INVALIDO'
    this.falhas = falhas
  }
}

/**
 * ESTÁGIOS OBRIGATÓRIOS e a assinatura esperada.
 *
 *   fonte.extrair(ctx)                     → iterável (sync ou async) de ItemBruto
 *   normalizador.normalizar(bruto, ctx)    → { ok, canonico?, motivo? }
 *   matcher.encontrar(canonico, ctx)       → { alvo|null, criterio?, confianca? }
 *   reconciliador.decidir(canonico, m, ctx)→ { acao, alvo?, campos?, motivo? }
 *   aplicador.aplicar(decisao, ctx)        → { ok, destino_id?, erro? }
 *
 * ItemBruto = { ref, dados }
 *   `ref` é a identidade ESTÁVEL na origem. Sem ela não há idempotência nem
 *   rastreabilidade — por isso é obrigatória.
 */
const ESTAGIOS = [
  ['fonte',          'extrair'],
  ['normalizador',   'normalizar'],
  ['matcher',        'encontrar'],
  ['reconciliador',  'decidir'],
  ['aplicador',      'aplicar'],
]

/**
 * Estágios opcionais: barreiras de qualidade. Ausentes = tudo passa.
 *   validador.bruto(itemBruto, ctx)    → { ok, motivo? }
 *   validador.canonico(canonico, ctx)  → { ok, motivo? }
 */
export function temValidacao(plano, qual) {
  return typeof plano?.validador?.[qual] === 'function'
}

/**
 * Verifica a conformidade estrutural do plano. Falha cedo e com a lista
 * COMPLETA de problemas — não um por execução.
 *
 * @throws {ErroPlanoInvalido}
 */
export function validarPlano(plano) {
  const falhas = []

  if (!plano || typeof plano !== 'object') throw new ErroPlanoInvalido(['plano ausente'])
  if (!plano.id)   falhas.push('`id` ausente (identificador da migração, ex.: LME-EQUIP-SM-01)')
  if (!plano.alvo) falhas.push('`alvo` ausente (nome do agregado canônico de destino, ex.: Equipamento)')

  for (const [estagio, metodo] of ESTAGIOS) {
    if (!plano[estagio])                            falhas.push(`estágio \`${estagio}\` ausente`)
    else if (typeof plano[estagio][metodo] !== 'function') falhas.push(`\`${estagio}.${metodo}()\` não é função`)
  }

  for (const qual of ['bruto', 'canonico']) {
    const v = plano?.validador?.[qual]
    if (v !== undefined && typeof v !== 'function') falhas.push(`\`validador.${qual}\` existe mas não é função`)
  }

  if (falhas.length) throw new ErroPlanoInvalido(falhas)
  return true
}

/**
 * Monta o contexto passado a TODOS os estágios.
 *
 * FAIL-CLOSED de tenancy: se o agregado de destino exige isolamento
 * organizacional (M-4), a migração não roda sem `empresa_id`. Carimbar dado
 * legado sem organização é exatamente o que a Fase 0.5 precisa evitar.
 *
 * @throws {ErroTenantAusente}
 */
export function prepararContexto(plano, { dryRun = true, empresa_id = null, ...extra } = {}) {
  if (exigeTenant(plano.alvo) && empresa_id == null) {
    throw new ErroTenantAusente(`LME/${plano.id} → ${plano.alvo}`)
  }
  return Object.freeze({
    plano_id: plano.id,
    alvo:     plano.alvo,
    dryRun,
    empresa_id,
    iniciado_em: new Date(),
    ...extra,
  })
}

export default { ETAPAS, ACOES, validarPlano, prepararContexto, temValidacao, ErroPlanoInvalido }
