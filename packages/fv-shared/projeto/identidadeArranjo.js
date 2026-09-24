/**
 * identidadeArranjo.js — F13.
 *
 * Identidade canônica do ARRANJO dentro de um projeto FV.
 *
 * ── Por que existe ──────────────────────────────────────────────────────────
 * A F11 encontrou dois arranjos com `id = 'arr_primario'` no mesmo projeto. A
 * causa não foi um gerador com colisão: eram QUATRO mecanismos de identidade
 * convivendo, e um deles não gerava nada —
 *
 *   backend  `arranjosService.novoId`        → `arr_<base36>_<seq>`
 *   frontend `GerenciadorArranjos.novoId`    → `arr_<epoch>_<seq>`
 *   frontend `ProjetoFVContext`              → `arr_local_<base36>_<seq>`
 *   frontend `E7Equipamentos`                → o LITERAL `'arr_primario'`
 *
 * O quarto escrevia sempre a mesma string para o bloco primário. Quando um
 * arranjo já persistido com esse id voltava na lista, o documento passava a ter
 * dois. Nada reclamava, e `find(tipo === 'principal')` escolhia o primeiro em
 * silêncio — inclusive em `homologacaoController`, que monta documento para a
 * distribuidora.
 *
 * ── O contrato ──────────────────────────────────────────────────────────────
 *   obrigatório · único DENTRO do projeto · estável entre reloads ·
 *   preservado em edição e em reordenação · novo quando se cria nova entidade
 *
 * Índice de array NÃO é identidade: reordenar a lista não pode trocar quem é
 * quem, e é exatamente isso que um índice faz.
 *
 * A unicidade é por PROJETO, não global — `arr_primario` aparecer em 12
 * projetos diferentes não é colisão; aparecer duas vezes no mesmo, é.
 */

let _seq = 0

/**
 * Novo identificador de arranjo. Único dentro do processo e, na prática, entre
 * processos: combina tempo (base 36) com uma sequência local.
 *
 * @param {string} [prefixo] `arr` (padrão), `exist` ou `ampl`.
 * @returns {string}
 */
export function novoIdArranjo(prefixo = 'arr') {
  _seq = (_seq + 1) % 1e6
  return `${prefixo}_${Date.now().toString(36)}_${_seq.toString(36)}`
}

/** Um id utilizável? Strings vazias e não-strings não contam. */
export function idValido(id) {
  return typeof id === 'string' && id.trim().length > 0
}

/**
 * Ids que aparecem mais de uma vez na lista. Pura — não altera nada.
 *
 * Detecção existe separada da correção de propósito: a LEITURA de um documento
 * não pode reescrever identidade (isso quebraria a estabilidade que o contrato
 * promete), mas precisa conseguir dizer que o documento está inconsistente.
 *
 * @returns {string[]} ids duplicados, sem repetição.
 */
export function idsDuplicados(arranjos = []) {
  const contagem = new Map()
  for (const a of arranjos || []) {
    const id = a?.id
    if (!idValido(id)) continue
    contagem.set(id, (contagem.get(id) ?? 0) + 1)
  }
  return [...contagem.entries()].filter(([, n]) => n > 1).map(([id]) => id)
}

/**
 * Garante identidade única para uma lista de arranjos. Para o caminho de
 * ESCRITA — nunca chamar na leitura.
 *
 * Regras:
 *   · id ausente ou inválido → recebe um id novo
 *   · id repetido            → a PRIMEIRA ocorrência mantém o id; as seguintes
 *                              recebem um id novo
 *
 * Manter a primeira não é arbitrário: é a única escolha que não muda a
 * identidade de um arranjo que já estava correto. Reescrever as duas trocaria
 * quem é quem a cada gravação.
 *
 * Não toca em NENHUM outro campo — nem equipamento, nem potência, nem tipo.
 *
 * @returns {Array} nova lista (não muta a original).
 */
export function garantirIdentidade(arranjos = []) {
  const usados = new Set()
  return (arranjos || []).map((a) => {
    const id = a?.id
    if (idValido(id) && !usados.has(id)) {
      usados.add(id)
      return a
    }
    let novo = novoIdArranjo()
    while (usados.has(novo)) novo = novoIdArranjo()
    usados.add(novo)
    return { ...a, id: novo }
  })
}

/**
 * Arranjos marcados como `principal`.
 *
 * O domínio admite NO MÁXIMO UM. Quem precisa do principal usa esta lista e
 * decide o que fazer quando ela tem tamanho ≠ 1 — em vez de `find()`, que
 * devolve o primeiro e não distingue "um" de "dois".
 */
export function principaisDoProjeto(arranjos = []) {
  return (arranjos || []).filter((a) => a?.tipo === 'principal')
}
