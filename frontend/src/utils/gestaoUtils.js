/**
 * gestaoUtils.js — Sprint 8.3.2
 * Helpers PUROS de gestão para o frontend:
 *  - apenasAtivos: seletores de NOVOS projetos só veem entidades ativas.
 *  - podeVerBancoCompleto / mascararConta / mascararDadosBancarios: máscara por perfil.
 */

/** Integridade histórica: ativo=false não aparece para novos projetos. */
export function apenasAtivos(lista) {
  return (lista || []).filter((x) => x && x.ativo !== false)
}

// Perfis que enxergam dados bancários completos.
const PERFIS_BANCO_COMPLETO = ['administrador', 'diretor', 'financeiro', 'admin']

export function podeVerBancoCompleto(perfil, anonimo = false) {
  if (anonimo) return true // fase legada sem login → acesso total
  return PERFIS_BANCO_COMPLETO.includes(perfil)
}

/** Mascara a conta deixando só os últimos 4 dígitos: "123456" → "****3456". */
export function mascararConta(conta) {
  const s = String(conta ?? '').replace(/\s/g, '')
  if (!s) return ''
  const ult = s.slice(-4)
  return `****${ult}`
}

/**
 * Devolve uma cópia dos dados bancários, mascarando conta/PIX/documento quando o
 * perfil não tem permissão de visualização completa.
 */
export function mascararDadosBancarios(conta, perfil, anonimo = false) {
  if (!conta) return conta
  if (podeVerBancoCompleto(perfil, anonimo)) return { ...conta }
  return {
    ...conta,
    conta: mascararConta(conta.conta),
    pix: conta.pix ? '••••••' : '',
    documento: conta.documento ? mascararConta(conta.documento) : '',
  }
}
