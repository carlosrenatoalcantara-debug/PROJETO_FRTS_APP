/**
 * fluxo.js — FONTE ÚNICA do fluxo canônico FV na UX — FV-UX-010.
 *
 * Espelha o ciclo aprovado na ADR-021 e detalhado em FV-DOM-002A §B.1:
 *
 *   Projeto → Cotação → Orçamentos → Aprovação → Baseline → Gate
 *           → ⑂ Engenharia ∥ Homologação → Projeto Executivo
 *           → Execução → As-Built
 *
 * ── Diferença essencial em relação ao wizard antigo ──────────────────────────
 * `config/etapasFunilFV.js` numera passos (1, 2, 2.5, 3…) e a navegação vive
 * hardcoded no `ProjetoFVContext` (`2 → 2.5 → 3`, `Math.min(…, 8)`). Aqui não há
 * numeração: cada etapa tem uma CHAVE estável, e a ordem é a ordem do array.
 * Inserir ou remover etapa não renumera nada.
 *
 * ── Bifurcação ───────────────────────────────────────────────────────────────
 * Engenharia e Homologação são PARALELAS (`paralela: true`), não sequenciais.
 * O fluxo só avança para Projeto Executivo quando ambas concluem — regra do
 * domínio, refletida aqui apenas para desenhar a navegação.
 *
 * Puro: sem React, sem I/O.
 */

/** Agregado que cada etapa consome. `null` = agregado ainda não implementado. */
export const ETAPAS_FLUXO = Object.freeze([
  { chave: 'projeto',       rotulo: 'Projeto',        grupo: 'origem',    agregado: 'ProjetoFV' },
  // FV-UX-019: a seleção de equipamentos vive no próprio ProjetoFV
  // (`equipamentos.paineis[]` / `equipamentos.inversor`) e referencia o
  // catálogo por `equipamento_id`. Não tem agregado próprio.
  { chave: 'equipamentos',  rotulo: 'Equipamentos',   grupo: 'origem',    agregado: 'ProjetoFV' },
  // FV-UX-020: o dimensionamento é gravado em `ProjetoFV.dimensionamento` e
  // calculado pelo motor existente no servidor. Sem agregado próprio.
  { chave: 'dimensionamento', rotulo: 'Dimensionamento', grupo: 'origem', agregado: 'ProjetoFV' },
  { chave: 'beneficiarias', rotulo: 'Beneficiárias',  grupo: 'origem',    agregado: 'UnidadeBeneficiaria' },
  { chave: 'cotacao',    rotulo: 'Cotação',           grupo: 'comercial', agregado: 'Cotacao' },
  { chave: 'orcamentos', rotulo: 'Orçamentos',        grupo: 'comercial', agregado: 'Orcamento' },
  { chave: 'aprovacao',  rotulo: 'Aprovação',         grupo: 'comercial', agregado: 'Orcamento' },
  // FV-UX-017: o Financeiro é DERIVADO do projeto + orçamento vigente (INV-58),
  // não tem agregado próprio. Fica no comercial porque é o retorno da proposta.
  { chave: 'financeiro', rotulo: 'Financeiro',        grupo: 'comercial', agregado: 'Orcamento' },
  { chave: 'baseline',   rotulo: 'Baseline',          grupo: 'contrato',  agregado: 'Baseline' },
  { chave: 'gate',       rotulo: 'Gate',              grupo: 'contrato',  agregado: 'Baseline' },
  { chave: 'engenharia',  rotulo: 'Engenharia',       grupo: 'execucao', agregado: null, paralela: true },
  // FV-UX-016: o unifilar é produto da engenharia elétrica. Não tem agregado
  // próprio — é DERIVADO do ProjetoFV pelo motor canônico (INV-58).
  { chave: 'unifilar',    rotulo: 'Unifilar',         grupo: 'execucao', agregado: 'ProjetoFV' },
  { chave: 'homologacao', rotulo: 'Homologação',      grupo: 'execucao', agregado: null, paralela: true },
  { chave: 'executivo',  rotulo: 'Projeto Executivo', grupo: 'execucao',  agregado: null },
  { chave: 'execucao',   rotulo: 'Execução',          grupo: 'entrega',   agregado: null },
  { chave: 'asbuilt',    rotulo: 'As-Built',          grupo: 'entrega',   agregado: null },
])

/** Macro-etapas, para a navegação não exibir 11 itens soltos. */
export const GRUPOS_FLUXO = Object.freeze([
  { chave: 'origem',    rotulo: 'Projeto',   descricao: 'Identificação e dados do cliente' },
  { chave: 'comercial', rotulo: 'Comercial', descricao: 'Cotações, orçamentos e aprovação' },
  { chave: 'contrato',  rotulo: 'Contrato',  descricao: 'Baseline congelada e liberação' },
  { chave: 'execucao',  rotulo: 'Execução',  descricao: 'Engenharia, homologação e executivo' },
  { chave: 'entrega',   rotulo: 'Entrega',   descricao: 'Obra, as-built e comissionamento' },
])

export function etapaPorChave(chave) {
  return ETAPAS_FLUXO.find((e) => e.chave === chave) || null
}

export function etapasDoGrupo(grupo) {
  return ETAPAS_FLUXO.filter((e) => e.grupo === grupo)
}

export function indiceDaEtapa(chave) {
  return ETAPAS_FLUXO.findIndex((e) => e.chave === chave)
}

/** A etapa depende de um agregado que ainda não existe no domínio? */
export function etapaSemAgregado(chave) {
  return etapaPorChave(chave)?.agregado == null
}

/**
 * Etapas anteriores e posteriores. Etapas paralelas entre si não se ordenam —
 * Engenharia não vem "antes" de Homologação.
 */
export function vizinhas(chave) {
  const i = indiceDaEtapa(chave)
  if (i < 0) return { anterior: null, proxima: null }
  return {
    anterior: ETAPAS_FLUXO[i - 1]?.chave ?? null,
    proxima: ETAPAS_FLUXO[i + 1]?.chave ?? null,
  }
}

/**
 * Progresso por grupo, dado o estado do contrato.
 *
 * NÃO decide regra de negócio: recebe o que a API canônica já respondeu
 * (Gate liberado por fase, estado do orçamento) e traduz em rótulos.
 */
export function progressoDosGrupos({ temOrcamento = false, orcamentoAprovado = false, execucaoLiberada = false } = {}) {
  const alcancado = {
    origem: true,
    comercial: true,
    contrato: orcamentoAprovado,
    execucao: execucaoLiberada,
    entrega: false,
  }
  return GRUPOS_FLUXO.map((g) => ({
    ...g,
    alcancado: alcancado[g.chave] ?? false,
    primeiraEtapa: etapasDoGrupo(g.chave)[0]?.chave ?? 'projeto',
    // `comercial` só é "em andamento" quando já existe algo comercial de fato.
    emAndamento: g.chave === 'comercial' ? temOrcamento && !orcamentoAprovado : false,
  }))
}
