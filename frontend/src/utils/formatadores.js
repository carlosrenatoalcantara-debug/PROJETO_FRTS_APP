export function formatarMoeda(valor, moeda = 'BRL') {
  if (typeof valor !== 'number' || isNaN(valor)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: moeda,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)
}

export function formatarNumero(valor, decimais = 2) {
  if (typeof valor !== 'number' || isNaN(valor)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  }).format(valor)
}

export function formatarPercentual(valor, decimais = 1) {
  if (typeof valor !== 'number' || isNaN(valor)) return '—'
  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  }).format(valor)}%`
}

export function formatarData(data, formato = 'curto') {
  if (!data) return '—'
  const d = new Date(data)
  if (formato === 'curto') {
    return d.toLocaleDateString('pt-BR')
  }
  if (formato === 'longo') {
    return d.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })
  }
  return d.toLocaleDateString('pt-BR')
}

export function formatarDataHora(data) {
  if (!data) return '—'
  const d = new Date(data)
  return d.toLocaleString('pt-BR')
}
