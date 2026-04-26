export async function geocodificarEndereco(endereco) {
  try {
    // Tentar busca com o endereço completo
    let dados = await buscarNominatim(endereco)

    // Se não encontrou, tentar variações
    if (!dados.length && endereco.length > 30) {
      // Tentar só a rua + número (remove complementos)
      const simples = endereco.match(/(?:rua|avenida|av\.?|praia|alameda|travessa|pça|praça|estrada|rodovia|via|lote|sítio)\s+[^,]*/i)?.[0]
      if (simples) {
        dados = await buscarNominatim(simples)
      }
    }

    // Se ainda não encontrou, tentar só a rua
    if (!dados.length) {
      const somenteRua = endereco.match(/(?:rua|avenida|av\.?|praia|alameda|travessa|pça|praça|estrada|rodovia|via|lote|sítio)\s+[^,\d]*/i)?.[0]
      if (somenteRua && somenteRua.length > 5) {
        dados = await buscarNominatim(somenteRua + ', Brasil')
      }
    }

    if (!dados.length) {
      throw new Error('Endereço não encontrado. Tente: "Rua/Avenida, Número, Cidade, Estado" (ex: Praia de Baía Formosa, 9172, Natal, RN)')
    }

    const item    = dados[0]
    const addr    = item.address ?? {}
    const cidade  = addr.city ?? addr.town ?? addr.municipality ?? ''
    const estado  = addr.state ?? ''

    return {
      lat:         parseFloat(item.lat),
      lon:         parseFloat(item.lon),
      enderecoFormatado: item.display_name,
      cidadeEstado: cidade && estado ? `${cidade} - ${estado}` : item.display_name,
    }
  } catch (err) {
    console.error('Erro na geocodificação:', err)
    throw err
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
  if (!resp.ok) throw new Error(`Erro Nominatim: ${resp.status}`)

  return await resp.json()
}
