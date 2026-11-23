/**
 * localizacaoDoCliente — o que do CADASTRO do cliente já é fato da localização
 * do projeto (UF, cidade, CEP, endereço).
 *
 * Irmã de `faturaDoCliente`: o projeto nasce com o que o cadastro já tem, sem o
 * operador redigitar. Sem isso a UF do projeto nascia `null` e, com ela, o
 * Tmin/Tmax de projeto e a sugestão de tensão ficavam sem base.
 *
 * Regras:
 *  - Ausente ou vazio no cliente ⇒ campo OMITIDO (fica `null` no schema). Nunca default.
 *  - UF só vale com 2 letras (normalizada para maiúsculas). "Rio Grande do Norte"
 *    digitado por extenso NÃO é convertido: omite-se em vez de adivinhar.
 *  - Coordenadas e geocodificação NÃO vêm do cadastro: são da etapa de localização.
 */
const texto = (v) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}
const uf = (v) => {
  const s = texto(v)
  return s && /^[A-Za-z]{2}$/.test(s) ? s.toUpperCase() : null
}

export function localizacaoDoCliente(cliente) {
  if (!cliente || typeof cliente !== 'object') return {}
  const campos = {
    estado: uf(cliente.estado),
    cidade: texto(cliente.cidade),
    cep: texto(cliente.cep),
    endereco_completo: texto(cliente.endereco_completo),
  }
  return Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== null))
}
