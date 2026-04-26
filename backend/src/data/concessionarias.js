export const CONCESSIONARIAS_POR_ESTADO = {
  'AC': ['Energisa Acre'],
  'AL': ['Energisa Alagoas'],
  'AP': ['Energisa Amapá'],
  'AM': ['Amazonas Energia'],
  'BA': ['Neoenergia Bahia', 'Elektro'],
  'CE': ['Enel Ceará', 'Energisa'],
  'DF': ['Neoenergia Brasília'],
  'ES': ['Energisa Espírito Santo'],
  'GO': ['Energisa Goiás'],
  'MA': ['Energia do Maranhão'],
  'MT': ['Energisa Mato Grosso'],
  'MS': ['Energisa Mato Grosso do Sul'],
  'MG': ['Neoenergia Minas Gerais', 'Cemig'],
  'PA': ['Equatorial Pará'],
  'PB': ['Energisa Paraíba'],
  'PR': ['Copel', 'Energisa Paraná'],
  'PE': ['Neoenergia Pernambuco'],
  'PI': ['Energisa Piauí'],
  'RJ': ['Enel Rio'],
  'RN': ['Cosern'],
  'RS': ['Copel Rio Grande do Sul', 'RGE'],
  'RO': ['Energisa Rondônia'],
  'RR': ['Energisa Roraima'],
  'SC': ['Celesc', 'Energisa Santa Catarina'],
  'SP': ['Enel SP', 'Cpfl', 'Elektro', 'Bandeirante'],
  'TO': ['Energisa Tocantins'],
}

export const TODOS_OS_ESTADOS = [
  { valor: 'AC', rotulo: 'Acre' },
  { valor: 'AL', rotulo: 'Alagoas' },
  { valor: 'AP', rotulo: 'Amapá' },
  { valor: 'AM', rotulo: 'Amazonas' },
  { valor: 'BA', rotulo: 'Bahia' },
  { valor: 'CE', rotulo: 'Ceará' },
  { valor: 'DF', rotulo: 'Distrito Federal' },
  { valor: 'ES', rotulo: 'Espírito Santo' },
  { valor: 'GO', rotulo: 'Goiás' },
  { valor: 'MA', rotulo: 'Maranhão' },
  { valor: 'MT', rotulo: 'Mato Grosso' },
  { valor: 'MS', rotulo: 'Mato Grosso do Sul' },
  { valor: 'MG', rotulo: 'Minas Gerais' },
  { valor: 'PA', rotulo: 'Pará' },
  { valor: 'PB', rotulo: 'Paraíba' },
  { valor: 'PR', rotulo: 'Paraná' },
  { valor: 'PE', rotulo: 'Pernambuco' },
  { valor: 'PI', rotulo: 'Piauí' },
  { valor: 'RJ', rotulo: 'Rio de Janeiro' },
  { valor: 'RN', rotulo: 'Rio Grande do Norte' },
  { valor: 'RS', rotulo: 'Rio Grande do Sul' },
  { valor: 'RO', rotulo: 'Rondônia' },
  { valor: 'RR', rotulo: 'Roraima' },
  { valor: 'SC', rotulo: 'Santa Catarina' },
  { valor: 'SP', rotulo: 'São Paulo' },
  { valor: 'TO', rotulo: 'Tocantins' },
]

export function obterConcessionarias(estado) {
  return CONCESSIONARIAS_POR_ESTADO[estado] || []
}

export function autoSelecionarConcessionaria(estado) {
  const concessionarias = obterConcessionarias(estado)
  return concessionarias.length === 1 ? concessionarias[0] : null
}
