// Dados de irradiância solar (kWh/m²/dia) para municípios de RN
// Fonte: INPE/CRESESB Atlas Solarimétrico Brasileiro
// Média anual com aproximação para cidades principais

export const irradianciaRN = {
  // Região Metropolitana (Natal)
  'natal': 5.42,
  'parnamirim': 5.40,
  'são gonçalo do amarante': 5.38,
  'areia branca': 5.44,

  // Região Leste
  'ceará-mirim': 5.35,
  'touros': 5.48,
  'maxaranguape': 5.46,

  // Região Central
  'caicó': 5.62,
  'currais novos': 5.60,
  'acari': 5.65,
  'jardim do seridó': 5.68,

  // Região Oeste
  'mossoró': 5.72,
  'assu': 5.70,
  'areia branca (oeste)': 5.75,
  'umarizal': 5.74,

  // Região Sul
  'pau dos ferros': 5.68,
  'portalegre': 5.70,
  'francisco dantas': 5.72,

  // Região Norte
  'macau': 5.50,
  'guamaré': 5.52,
  'tibau': 5.55,
}

export function obterIrradianciaCity(cidade, estado) {
  if (!cidade || estado?.toUpperCase() !== 'RN') {
    return null
  }

  const cityNormalizado = cidade.toLowerCase().trim()

  // Busca exata
  if (irradianciaRN[cityNormalizado]) {
    return irradianciaRN[cityNormalizado]
  }

  // Busca por similitude (caso primeiras letras coincidam)
  const chaves = Object.keys(irradianciaRN)
  for (const chave of chaves) {
    if (chave.startsWith(cityNormalizado.substring(0, 3))) {
      return irradianciaRN[chave]
    }
  }

  return null
}

export function obterIrradianciaFallback(estado) {
  // Fallback por estado
  const fallbacks = {
    'RN': 5.55, // Média geral de RN
    'SP': 5.49,
    'MG': 5.47,
    'BA': 5.65,
    'CE': 5.70,
  }
  return fallbacks[estado?.toUpperCase()] || 5.55
}
