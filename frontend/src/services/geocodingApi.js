/**
 * Geocoding via Nominatim/OpenStreetMap (gratuito, sem chave).
 *
 * S2.5: retorna `geocoding_origem`, `geocoding_confianca` e `geocodificado_em`
 *       para o pipeline persistir no ProjetoFV (subdoc fatura_extracao).
 *
 * Cache em memória de 1h para evitar requisições redundantes.
 * NÃO lança erro quando não encontra — retorna null para permitir avanço do wizard.
 */

const CACHE_TTL_MS = 60 * 60 * 1000  // 1 hora
const cache = new Map()  // key: endereco normalizado -> { result, expira }

function chaveCache(endereco) {
  return String(endereco || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function lerCache(endereco) {
  const k = chaveCache(endereco)
  const v = cache.get(k)
  if (!v) return null
  if (Date.now() > v.expira) { cache.delete(k); return null }
  return v.result
}

function gravarCache(endereco, result) {
  cache.set(chaveCache(endereco), {
    result,
    expira: Date.now() + CACHE_TTL_MS,
  })
}

/**
 * Geocodifica endereço brasileiro. Tenta 3 níveis de fallback antes de desistir.
 *
 * @returns {Promise<Object|null>} null se NÃO encontrou (sem throw)
 */
export async function geocodificarEndereco(endereco) {
  if (!endereco || typeof endereco !== 'string' || endereco.trim().length < 3) {
    return null
  }

  const cached = lerCache(endereco)
  if (cached) return cached

  try {
    // 1ª tentativa — endereço completo
    let dados = await buscarNominatim(endereco)
    let origem = 'nominatim_completo'

    // 2ª — rua + número
    if (!dados.length && endereco.length > 30) {
      const simples = endereco.match(/(?:rua|avenida|av\.?|praia|alameda|travessa|pça|praça|estrada|rodovia|via|lote|sítio)\s+[^,]*/i)?.[0]
      if (simples) {
        dados = await buscarNominatim(simples + ', Brasil')
        origem = 'nominatim_parcial'
      }
    }

    // 3ª — só rua
    if (!dados.length) {
      const somenteRua = endereco.match(/(?:rua|avenida|av\.?|praia|alameda|travessa|pça|praça|estrada|rodovia|via|lote|sítio)\s+[^,\d]*/i)?.[0]
      if (somenteRua && somenteRua.length > 5) {
        dados = await buscarNominatim(somenteRua + ', Brasil')
        origem = 'nominatim_parcial'
      }
    }

    if (!dados.length) return null

    const item = dados[0]
    const addr = item.address ?? {}
    const cidade = addr.city ?? addr.town ?? addr.municipality ?? ''
    const estado = addr.state ?? ''

    // Confiança: nominatim_completo começa em 0.85 e modula pela importance.
    // nominatim_parcial reduz teto para 0.6 (sinaliza match não-exato).
    const tetoConfianca = origem === 'nominatim_completo' ? 0.95 : 0.65
    const baseConfianca = origem === 'nominatim_completo' ? 0.85 : 0.45
    const importance = Number(item?.importance)
    let confianca = baseConfianca
    if (Number.isFinite(importance)) {
      confianca = Math.max(baseConfianca, Math.min(tetoConfianca, importance))
    }
    confianca = Number(confianca.toFixed(2))

    const resultado = {
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      enderecoFormatado: item.display_name,
      cidade: cidade || null,
      estado: estado || null,
      cidadeEstado: cidade && estado ? `${cidade} - ${estado}` : item.display_name,
      geocoding_origem: origem,
      geocoding_confianca: confianca,
      geocodificado_em: new Date().toISOString(),
    }
    gravarCache(endereco, resultado)
    return resultado
  } catch (err) {
    console.warn('[geocoding]', err?.message || err)
    return null
  }
}

async function buscarNominatim(endereco) {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', endereco)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '5')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('countrycodes', 'br')

  const resp = await fetch(url.toString(), {
    headers: { 'Accept-Language': 'pt-BR,pt' },
  })
  if (!resp.ok) return []
  return await resp.json()
}
