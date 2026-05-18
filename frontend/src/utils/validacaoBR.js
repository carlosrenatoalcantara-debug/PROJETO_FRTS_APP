/**
 * Utilitários de validação e formatação para padrões brasileiros.
 * Funções puras, sem dependências externas.
 */

export function normalizarCpfCnpj(v) {
  if (!v) return ''
  return String(v).replace(/\D/g, '')
}

export function formatarCpfCnpj(v) {
  const n = normalizarCpfCnpj(v)
  if (n.length === 11) {
    return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  if (n.length === 14) {
    return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  return v
}

export function validarCPF(cpf) {
  const n = normalizarCpfCnpj(cpf)
  if (n.length !== 11) return false
  if (/^(\d)\1{10}$/.test(n)) return false
  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(n[i]) * (10 - i)
  let d1 = 11 - (soma % 11)
  if (d1 >= 10) d1 = 0
  if (d1 !== parseInt(n[9])) return false
  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(n[i]) * (11 - i)
  let d2 = 11 - (soma % 11)
  if (d2 >= 10) d2 = 0
  return d2 === parseInt(n[10])
}

export function validarCNPJ(cnpj) {
  const n = normalizarCpfCnpj(cnpj)
  if (n.length !== 14) return false
  if (/^(\d)\1{13}$/.test(n)) return false
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let soma = 0
  for (let i = 0; i < 12; i++) soma += parseInt(n[i]) * pesos1[i]
  let d1 = 11 - (soma % 11)
  if (d1 >= 10) d1 = 0
  if (d1 !== parseInt(n[12])) return false
  soma = 0
  for (let i = 0; i < 13; i++) soma += parseInt(n[i]) * pesos2[i]
  let d2 = 11 - (soma % 11)
  if (d2 >= 10) d2 = 0
  return d2 === parseInt(n[13])
}

export function normalizarTelefone(v) {
  if (!v) return ''
  return String(v).replace(/\D/g, '')
}

export function formatarTelefoneBR(v) {
  const n = normalizarTelefone(v)
  if (n.length === 11) {
    return n.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, '($1) $2 $3-$4')
  }
  if (n.length === 10) {
    return n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }
  return v
}

export function validarTelefoneBR(v) {
  const n = normalizarTelefone(v)
  return n.length === 10 || n.length === 11
}

export function validarEmail(v) {
  if (!v) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim())
}

export function formatarCEP(v) {
  const n = String(v || '').replace(/\D/g, '')
  if (n.length === 8) return n.replace(/(\d{5})(\d{3})/, '$1-$2')
  return v
}

export function gerarLinkWhatsAppBR(telefone, mensagem = '') {
  const n = normalizarTelefone(telefone)
  if (n.length < 10) return null
  const numeroComDDI = n.length === 11 || n.length === 10 ? `55${n}` : n
  return `https://wa.me/${numeroComDDI}?text=${encodeURIComponent(mensagem)}`
}
