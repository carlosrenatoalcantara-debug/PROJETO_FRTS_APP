/**
 * solarMarketCatalogService.js — Sprint 8.0 (PREPARAÇÃO / camada isolada)
 *
 * Busca dados OFICIAIS de equipamentos na SolarMarket quando disponível.
 * Camada isolada: NÃO depende da API funcionando. Enquanto não habilitada,
 * retorna null (o pipeline cai para Gemini/OCR). Marca status FONTE_SOLARMARKET.
 */
const CONFIG = {
  habilitado: false,
  endpoint: process.env.SOLARMARKET_CATALOGO_ENDPOINT || null,
  token: process.env.SOLARMARKET_TOKEN || null,
}

/**
 * @returns {Promise<null | { status:'FONTE_SOLARMARKET', campos: Record<string,{valor,fonte,confianca}> }>}
 */
export async function buscarEquipamento({ fabricante, modelo, tipo } = {}) {
  if (!CONFIG.habilitado || !CONFIG.endpoint || !CONFIG.token) return null
  // TODO (futuro): fetch oficial. Por ora, camada preparada sem chamada real.
  try {
    // const r = await fetch(`${CONFIG.endpoint}?fabricante=${fabricante}&modelo=${modelo}&tipo=${tipo}`,
    //   { headers: { Authorization: `Bearer ${CONFIG.token}` } })
    return null
  } catch {
    return null
  }
}

export function statusCatalogoSolarMarket() {
  return { integracao: 'solarmarket-catalogo', habilitado: CONFIG.habilitado, configurado: Boolean(CONFIG.endpoint && CONFIG.token), modo: 'preparacao' }
}

export default { buscarEquipamento, statusCatalogoSolarMarket }
