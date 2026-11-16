/**
 * tensaoRede — tensão de fornecimento da instalação.
 *
 * Regra de domínio: trifásico na COSERN/RN é 380 V (fase-fase). Para qualquer
 * outra combinação NÃO há padrão: devolve `null` e a tela mostra a lacuna.
 * Um '220' de reserva foi exatamente o defeito de produção (trifásico exibido
 * como 220 V).
 *
 * Ordem de precedência (a primeira que responder vence):
 *   1. tensão explícita informada (campo próprio);
 *   2. número no texto do tipo de ligação ("Trifásico 380V");
 *   3. trifásico + concessionária COSERN ou UF RN → 380;
 *   4. nada → null.
 *
 * Puro: sem React, sem I/O. Valor derivado — nunca persistir.
 */
const TENSOES = ['440', '380', '220', '127']

/** "Trifásico 380V" → "380"; sem número reconhecido → null. */
export function tensaoDoTexto(t) {
  const m = String(t ?? '').match(/(?<!\d)(440|380|220|127)(?!\d)/)
  return m ? m[1] : null
}

function semAcento(t) {
  return String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function ehTrifasico(tipoLigacao) {
  return semAcento(tipoLigacao).includes('trifas')
}

function ehRN({ concessionaria, uf }) {
  if (/cosern/.test(semAcento(concessionaria))) return true
  return String(uf ?? '').trim().toUpperCase() === 'RN'
}

/**
 * @param {{tensao?: string|number|null, tipoLigacao?: string|null,
 *          concessionaria?: string|null, uf?: string|null}} d
 * @returns {{valor: string|null, origem: 'informada'|'texto_ligacao'|'regra_rn'|null}}
 */
export function resolverTensaoRede(d = {}) {
  const explicita = String(d.tensao ?? '').trim()
  if (TENSOES.includes(explicita)) return { valor: explicita, origem: 'informada' }

  const doTexto = tensaoDoTexto(d.tipoLigacao)
  if (doTexto) return { valor: doTexto, origem: 'texto_ligacao' }

  if (ehTrifasico(d.tipoLigacao) && ehRN(d)) return { valor: '380', origem: 'regra_rn' }

  return { valor: null, origem: null }
}

export const ROTULO_ORIGEM_TENSAO = {
  informada: 'informada',
  texto_ligacao: 'lida do tipo de ligação',
  regra_rn: 'derivada: trifásico na COSERN/RN = 380 V',
}
