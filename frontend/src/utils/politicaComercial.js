/**
 * politicaComercial.js — FEATURE-004: Política Comercial EV.
 *
 * Fonte única da FORMA da política comercial (margem por categoria, impostos,
 * apresentação e modo). NÃO calcula preço — mapeia a política para os parâmetros
 * de `calcularOrcamento()` (FEATURE-002). Sem novo cálculo, sem duplicar lógica.
 */

// Modos de apresentação da PROPOSTA (View/PDF Comercial/WhatsApp/E-mail — NUNCA PDF Executivo).
export const MODOS_APRESENTACAO = Object.freeze({
  detalhada_com_precos: { itens: true, precos: true, resumo: true, final: true },
  detalhada_sem_precos: { itens: true, precos: false, resumo: false, final: true },
  resumo:               { itens: false, precos: false, resumo: true, final: true },
  valor_final:          { itens: false, precos: false, resumo: false, final: true },
})
export const MODO_LABEL = Object.freeze({
  detalhada_com_precos: 'Detalhada com preços',
  detalhada_sem_precos: 'Detalhada sem preços',
  resumo: 'Resumo',
  valor_final: 'Somente valor final',
})

/** Política padrão (fallback quando a empresa ainda não configurou). */
export const POLITICA_PADRAO = Object.freeze({
  nome: 'Padrão Empresa',
  margem: {
    aplicar_materiais: true, aplicar_equipamentos: false, aplicar_servicos: false,
    materiais_pct: 20, equipamentos_pct: 0, servicos_pct: 0,
  },
  impostos_pct: 0,
  apresentacao: {
    mostrar_equipamentos: true, mostrar_materiais: true, mostrar_servicos: true,
    mostrar_precos_unitarios: true, mostrar_quantidades: true, mostrar_subtotais: true,
    mostrar_total_equipamentos: true, mostrar_total_materiais: true, mostrar_total_servicos: true,
    mostrar_valor_final: true,
  },
  modo_apresentacao: 'detalhada_com_precos',
})

// Nomes de perfis sugeridos (o conteúdo de cada um é a política completa).
export const PERFIS_SUGERIDOS = ['Padrão Empresa', 'Residencial', 'Condomínio', 'Comercial', 'Frotista', 'Revenda', 'Licitação']

/** Normaliza/preenche uma política parcial com os defaults (imutável). */
export function normalizarPolitica(p = {}) {
  const d = POLITICA_PADRAO
  return {
    nome: p.nome || d.nome,
    margem: { ...d.margem, ...(p.margem || {}) },
    impostos_pct: Number.isFinite(Number(p.impostos_pct)) ? Number(p.impostos_pct) : d.impostos_pct,
    apresentacao: { ...d.apresentacao, ...(p.apresentacao || {}) },
    modo_apresentacao: MODOS_APRESENTACAO[p.modo_apresentacao] ? p.modo_apresentacao : d.modo_apresentacao,
  }
}

/** Política → objeto `margem` aceito por calcularOrcamento (FEATURE-004). */
export function margemDaPolitica(politica) {
  const m = normalizarPolitica(politica).margem
  return {
    aplicar_materiais: !!m.aplicar_materiais, materiais_pct: Number(m.materiais_pct) || 0,
    aplicar_equipamentos: !!m.aplicar_equipamentos, equipamentos_pct: Number(m.equipamentos_pct) || 0,
    aplicar_servicos: !!m.aplicar_servicos, servicos_pct: Number(m.servicos_pct) || 0,
  }
}

/** Flags de exibição do modo de apresentação (com fallback seguro). */
export function flagsApresentacao(modo) {
  return MODOS_APRESENTACAO[modo] || MODOS_APRESENTACAO.detalhada_com_precos
}

export default { MODOS_APRESENTACAO, MODO_LABEL, POLITICA_PADRAO, PERFIS_SUGERIDOS, normalizarPolitica, margemDaPolitica, flagsApresentacao }
