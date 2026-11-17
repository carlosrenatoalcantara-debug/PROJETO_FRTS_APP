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

const semAcento = (t) =>
  String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// Índice sem acento/caixa: "Sao Goncalo do Amarante" casa com a chave acentuada.
const indiceRN = Object.fromEntries(
  Object.entries(irradianciaRN).map(([k, v]) => [semAcento(k), v]),
)

/**
 * Média anual da cidade (RN) ou `null`. SÓ casamento exato (sem acento/caixa).
 * A busca anterior por prefixo de 3 letras devolvia o valor de OUTRA cidade em
 * silêncio ("Parelhas" → Parnamirim): valor inventado com cara de dado.
 */
export function obterIrradianciaCity(cidade, estado) {
  if (!cidade || estado?.toUpperCase() !== 'RN') return null
  return indiceRN[semAcento(cidade)] ?? null
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
