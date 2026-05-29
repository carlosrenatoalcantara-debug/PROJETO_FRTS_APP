/**
 * solarMarketService.js — Sprint 7.3 (PREPARAÇÃO APENAS)
 *
 * Arquitetura para futura integração com a SolarMarket. NÃO depende de API real
 * ainda; nenhuma chamada externa é feita. Não altera o catálogo existente.
 *
 * Quando a integração for ativada, basta implementar as chamadas HTTP reais nos
 * métodos abaixo, mantendo a mesma interface.
 */

const CONFIG = {
  habilitado: false,                                  // ativar quando houver credenciais
  endpoint: process.env.SOLARMARKET_ENDPOINT || null,
  token: process.env.SOLARMARKET_TOKEN || null,
}

export function statusSolarMarket() {
  return {
    integracao: 'solarmarket',
    habilitado: CONFIG.habilitado,
    configurado: Boolean(CONFIG.endpoint && CONFIG.token),
    endpoint: CONFIG.endpoint ? '••• configurado' : null,
    modo: 'preparacao',  // ainda sem chamadas reais
  }
}

/**
 * Sincroniza o catálogo (stub). No modo preparação, apenas relata o que faria.
 * @returns {Promise<{sucesso:boolean, modo:string, sincronizados:number}>}
 */
export async function sincronizarCatalogo() {
  if (!CONFIG.habilitado || !CONFIG.endpoint || !CONFIG.token) {
    return { sucesso: false, modo: 'preparacao', sincronizados: 0, mensagem: 'Integração SolarMarket ainda não configurada/habilitada.' }
  }
  // TODO (sprint futura): fetch(CONFIG.endpoint, { headers: { Authorization: `Bearer ${CONFIG.token}` } })
  return { sucesso: false, modo: 'preparacao', sincronizados: 0, mensagem: 'Chamada real não implementada nesta fase.' }
}

export default { statusSolarMarket, sincronizarCatalogo }
