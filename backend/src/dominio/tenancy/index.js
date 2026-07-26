/**
 * dominio/tenancy — Fase 0 (Fundação Transversal) · ADR-021 M-4
 *
 * PONTO ÚNICO do isolamento organizacional. Toda consulta e toda escrita que
 * toque um agregado com tenancy DEVE passar por aqui.
 *
 * ── ESTADO NESTA FASE ──────────────────────────────────────────────────────
 * CONTRATO FORMALIZADO, ENFORCEMENT NÃO APLICADO.
 * Estes helpers existem e são testáveis, mas nenhum controller os utiliza ainda.
 * Aplicá-los é Fase 0.5 (Migração Arquitetural) e exige backfill prévio de
 * `empresa_id` nos dados legados — sem isso, fail-closed derruba o sistema.
 *
 * Mapeamento conceitual (D-1): arquitetura chama `Organização`; a implementação
 * usa `empresa_id` (consolidado em JWT, RBAC, models e índices). Não renomear.
 *
 * M-4: "Todo agregado pertence a exatamente uma Organização. Nenhuma operação,
 * consulta ou referência atravessa organizações."
 *
 * PURO: sem I/O, sem mongoose, sem express. Recebe `req`, devolve filtro.
 */

/**
 * CLASSIFICAÇÃO DE TENANCY — SSOT da política de isolamento.
 *
 * Nem todo agregado é isolado por organização. Três categorias:
 *
 *  • ESCOPO_TENANT   — dados de negócio da organização. Isolamento OBRIGATÓRIO.
 *  • GLOBAL          — referência compartilhada por todas as organizações.
 *                      Catálogo é global por decisão da ADR-021 (A-8): o
 *                      equipamento é o mesmo; o que varia é a certificação por
 *                      jurisdição. Jurisdição idem — "Brasil/SP" não é de ninguém.
 *  • INFRAESTRUTURA  — auth, log, cache, contadores. Sem semântica de negócio.
 */
export const TENANCY = {
  ESCOPO_TENANT: [
    'ProjetoFV', 'ProjetoEV', 'Cliente', 'Local', 'Instalacao',
    'UnidadeBeneficiaria', 'Lead', 'CrmLead', 'CrmFunil', 'CrmColuna',
    'AtivoEquipamento', 'DocumentoTecnico', 'AlertaStatus', 'FaturaEnergia',
    'Material', 'CategoriaMaterial', 'Tecnico', 'Vendedor', 'User',
  ],
  GLOBAL: [
    'Equipamento',        // Catálogo — ADR-021 A-8
    'CarregadorEV',       // catálogo de carregadores
    'Jurisdicao',         // Contexto Regulatório
    'DicionarioCanonico', 'AliasCampo',
    'Empresa', 'EmpresaConfig',   // a própria organização
  ],
  INFRAESTRUTURA: [
    'ApiKey', 'AuditLog', 'Contador', 'BulkOperationLog',
    'DatasheetCache', 'DatasheetProcessamento',
  ],
}

/** O agregado exige isolamento por organização? */
export function exigeTenant(nomeModel) {
  return TENANCY.ESCOPO_TENANT.includes(nomeModel)
}

export class ErroTenantAusente extends Error {
  constructor(contexto = '') {
    super(`Tenant ausente${contexto ? ` (${contexto})` : ''} — operação bloqueada (M-4, fail-closed).`)
    this.name = 'ErroTenantAusente'
    this.status = 403
    this.codigo = 'TENANT_AUSENTE'
  }
}

/**
 * Extrai o tenant da requisição. NÃO lança — use `exigirTenant` para fail-closed.
 * @returns {any|null} empresa_id ou null
 */
export function tenantDoReq(req) {
  return req?.auth?.empresa_id ?? null
}

/**
 * FAIL-CLOSED: devolve o tenant ou lança. Nenhuma operação de negócio deve
 * prosseguir sem tenant resolvido.
 * @throws {ErroTenantAusente}
 */
export function exigirTenant(req, contexto = '') {
  const t = tenantDoReq(req)
  if (t == null) throw new ErroTenantAusente(contexto)
  return t
}

/**
 * Aplica o escopo de organização a um filtro de consulta.
 * Fail-closed por padrão: sem tenant, lança.
 *
 * @param {object} filtro  filtro base
 * @param {object} req
 * @param {object} [opts]  { contexto?: string }
 * @returns {object} filtro com escopo aplicado
 */
export function aplicarEscopo(filtro, req, opts = {}) {
  const empresa_id = exigirTenant(req, opts.contexto)
  return { ...(filtro || {}), empresa_id }
}

/**
 * Carimba o tenant num documento a ser criado.
 * @throws {ErroTenantAusente}
 */
export function carimbarTenant(dados, req, opts = {}) {
  const empresa_id = exigirTenant(req, opts.contexto)
  return { ...(dados || {}), empresa_id }
}

export default {
  TENANCY, exigeTenant, tenantDoReq, exigirTenant,
  aplicarEscopo, carimbarTenant, ErroTenantAusente,
}
