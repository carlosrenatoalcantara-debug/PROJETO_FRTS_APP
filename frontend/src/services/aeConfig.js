/**
 * aeConfig — política de aplicação das atualizações do AE.
 *
 * Persistida em localStorage, mesmo padrão das demais preferências da tela de
 * Configurações. É uma preferência de operação, não um segredo.
 *
 * Limitação conhecida: por navegador, não por organização.
 */

const CHAVE = 'ae_politica_atualizacoes'

export const POLITICA = Object.freeze({
  PERGUNTAR: 'perguntar',
  AUTOMATICO: 'automatico',
  RELATORIO: 'relatorio',
})

export const OPCOES_POLITICA = [
  { valor: POLITICA.PERGUNTAR, rotulo: 'Sempre perguntar antes de aplicar', descricao: 'A auditoria mostra o resultado e aguarda confirmação. (padrão)' },
  { valor: POLITICA.AUTOMATICO, rotulo: 'Aplicar automaticamente após Auditoria Rápida', descricao: 'As atualizações encontradas são aplicadas sem confirmação.' },
  { valor: POLITICA.RELATORIO, rotulo: 'Apenas gerar relatório', descricao: 'Nunca aplica; a ação de aplicar fica indisponível.' },
]

const VALIDAS = new Set(Object.values(POLITICA))

/** Política vigente. Default: sempre perguntar. */
export function obterPolitica() {
  try {
    const valor = localStorage.getItem(CHAVE)
    return VALIDAS.has(valor) ? valor : POLITICA.PERGUNTAR
  } catch {
    return POLITICA.PERGUNTAR
  }
}

/** Define a política. Valor inválido é ignorado. */
export function definirPolitica(valor) {
  if (!VALIDAS.has(valor)) return obterPolitica()
  try {
    localStorage.setItem(CHAVE, valor)
  } catch {
    // Sem persistência disponível: a sessão segue com o default.
  }
  return valor
}
