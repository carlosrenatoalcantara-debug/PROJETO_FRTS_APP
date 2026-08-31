/**
 * obterOrcamentoProjeto.js — adapter de LEITURA do orçamento — FV-DOM-002.
 *
 * Costura entre o agregado `Orcamento` (fonte operacional a partir desta sprint)
 * e o subdocumento legado `ProjetoFV.orcamento` (compatibilidade temporária).
 *
 * Mesmo padrão já aprovado em `obterLocalProjeto` (S1.5) e `obterTopologiaProjeto`
 * (S3): resolução campo a campo, novo primeiro, legado como fallback. Nenhum
 * consumidor precisa saber de onde veio.
 *
 * ── Por que ainda existe (FV-DOM-003) ────────────────────────────────────────
 * NENHUM consumidor funcional depende mais dele: a UX migrou para
 * `orcamento_vigente` (forma própria do agregado) e nada mais escreve o
 * subdocumento.
 *
 * Ele sobrevive por UM motivo: projetos históricos que nunca passaram pelo
 * agregado — 7 com conteúdo real em produção. Para esses, o subdocumento é a
 * ÚNICA cópia do orçamento; sem este adapter eles apareceriam vazios na tela.
 *
 * Removê-lo exige backfill (Cotacao/Orcamento a partir do subdoc), que é do LME
 * (ADR-022) e está fora do escopo desta sprint. Enquanto isso, é caminho de
 * compatibilidade — não fonte operacional.
 *
 * ── O que NÃO deriva do agregado novo ────────────────────────────────────────
 * Indicadores financeiros (`irr_pct`, `npv_r`, `payback_anos`, economias, CO₂)
 * NÃO existem no `Orcamento` por decisão de domínio: são DERIVADOS (INV-58),
 * calculados pelo motor financeiro a cada leitura. Aqui eles são repassados do
 * legado quando presentes — nunca inventados.
 *
 * Domínio PURO: sem I/O, sem Mongoose. Recebe planos já carregados.
 */

/** Campos financeiros derivados — repassados do legado, nunca recalculados aqui. */
const CAMPOS_DERIVADOS_LEGADO = [
  'custo_total_r', 'custo_equipamentos_r', 'custo_mao_obra_r', 'custo_outros_r',
  'margem_pct', 'preco_venda_r', 'irr_pct', 'npv_r', 'payback_anos', 'payback_meses',
  'economia_mensal_r', 'economia_anual_r', 'economia_25anos_r', 'co2_evitado_t',
  'tarifa_kwh', 'reajuste_anual_pct', 'calculado_em',
]

/** Soma segura — ignora parcelas não numéricas em vez de propagar NaN. */
function valorItem(i) {
  const q = Number(i?.quantidade)
  const v = Number(i?.valor_unitario_r)
  if (!Number.isFinite(q) || !Number.isFinite(v)) return 0
  return q * v
}

/** Totais a partir dos itens do agregado novo. */
export function totaisDeItens(itens) {
  const lista = Array.isArray(itens) ? itens : []
  const total_material_r = lista.filter((i) => i?.tipo !== 'servico').reduce((a, i) => a + valorItem(i), 0)
  const total_servicos_r = lista.filter((i) => i?.tipo === 'servico').reduce((a, i) => a + valorItem(i), 0)
  return { total_material_r, total_servicos_r, total_venda_r: total_material_r + total_servicos_r }
}

/**
 * Projeta o agregado `Orcamento` na FORMA LEGADA de `ProjetoFV.orcamento`.
 * Usado para manter a UX intacta enquanto o Core já opera no modelo novo.
 */
export function projetarFormaLegada(orcamento) {
  if (!orcamento) return null
  const itens = orcamento.itens || []
  const totais = totaisDeItens(itens)
  return {
    modo: 'detalhado',
    kit: null,
    itens_adicionais: itens.map((i) => ({
      descricao:  i.descricao ?? null,
      quantidade: Number(i.quantidade) || 0,
      valor:      Number(i.valor_unitario_r) || 0,
      tipo:       i.tipo ?? 'material',
    })),
    ...totais,
  }
}

/**
 * Orçamento operacional do projeto, na forma legada.
 *
 * @param {object} projeto            plano do ProjetoFV (lean/toObject)
 * @param {object|null} orcamentoNovo agregado `Orcamento` vigente, se houver
 * @returns {object|null}
 */
export function obterOrcamentoProjeto(projeto, orcamentoNovo = null) {
  const legado = projeto?.orcamento || null

  // Sem agregado novo → projeto histórico: devolve o legado como está.
  if (!orcamentoNovo) return legado

  const derivado = projetarFormaLegada(orcamentoNovo)

  // Indicadores financeiros continuam vindo do legado (INV-58 — ver cabeçalho).
  for (const campo of CAMPOS_DERIVADOS_LEGADO) {
    if (legado?.[campo] != null) derivado[campo] = legado[campo]
  }

  // Proveniência (M-3): quem consome consegue saber de onde a resposta veio.
  derivado.origem = 'agregado'
  derivado.orcamento_ref = String(orcamentoNovo._id ?? '')
  derivado.estado = orcamentoNovo.estado ?? null
  return derivado
}

/** O projeto já opera no modelo novo? */
export function orcamentoMigrado(orcamentoNovo) {
  return !!orcamentoNovo?._id
}

export default obterOrcamentoProjeto
