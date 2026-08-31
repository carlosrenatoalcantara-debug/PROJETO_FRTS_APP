/**
 * propostas.js — agrupamento das opções na listagem — FV-UX-033.
 *
 * ── O que é e o que não é ────────────────────────────────────────────────────
 * É uma REORGANIZAÇÃO de leitura: a listagem já recebe `tipo_projeto`,
 * `proposta_grupo_id`, `opcao_numero`, `opcao_rotulo` e `proposta_aceite` de
 * `GET /api/projetos-fv`. Este módulo só decide como exibir.
 *
 * NÃO é uma segunda fonte de verdade: nenhum agrupamento é persistido, nenhum
 * número de opção é atribuído aqui, nenhum aceite é decidido aqui. O que o
 * servidor não disser, não aparece.
 *
 * `projeto_origem_id` NÃO é consultado (item 5): ele significa "ampliação de".
 * O vínculo entre opções é `proposta_grupo_id`, relação de pares.
 *
 * Puro: sem React, sem I/O.
 */

/** O projeto é uma opção de proposta? Exige as DUAS marcas. */
export function ehOpcao(projeto) {
  return projeto?.tipo_projeto === 'opcao' && !!projeto?.proposta_grupo_id
}

/**
 * Rótulo da opção. Preserva o que o servidor gravou; só cai no número quando o
 * rótulo não existe — item 7: excluir uma irmã não renumera nem renomeia as
 * outras, porque nada é recalculado a partir da posição na lista.
 */
export function rotuloDaOpcao(projeto) {
  if (projeto?.opcao_rotulo) return projeto.opcao_rotulo
  const n = Number(projeto?.opcao_numero)
  return Number.isFinite(n) && n > 0 ? `Opção ${String(n).padStart(2, '0')}` : 'Opção'
}

/** Nome do cliente, como a listagem já o entrega. */
const clienteDe = (p) => p?.clienteId?.nome ?? null

/**
 * Agrupa a listagem em PROPOSTAS e projetos avulsos.
 *
 * Devolve uma lista única, na ordem original de `createdAt` que o servidor já
 * aplicou: cada entrada é `{ tipo: 'projeto' }` ou `{ tipo: 'proposta' }`. A
 * proposta ocupa a posição da sua opção mais recente, para que agrupar não
 * reordene a tela.
 *
 * Uma opção órfã — com grupo, mas sozinha na listagem — aparece como proposta
 * de uma opção só. Não vira projeto avulso: ela É uma opção, e escondê-lo
 * mentiria sobre o que está no banco.
 */
export function agruparPropostas(projetos) {
  const entradas = []
  const porGrupo = new Map()

  for (const p of projetos ?? []) {
    if (!ehOpcao(p)) {
      entradas.push({ tipo: 'projeto', chave: String(p._id), projeto: p })
      continue
    }
    const grupo = String(p.proposta_grupo_id)
    if (!porGrupo.has(grupo)) {
      const entrada = {
        tipo: 'proposta',
        chave: `proposta:${grupo}`,
        proposta_grupo_id: grupo,
        cliente: clienteDe(p),
        opcoes: [],
      }
      porGrupo.set(grupo, entrada)
      entradas.push(entrada)
    }
    porGrupo.get(grupo).opcoes.push(p)
  }

  // Dentro da proposta, a ordem é a do número da opção — estável e do servidor.
  for (const entrada of porGrupo.values()) {
    entrada.opcoes.sort((a, b) => (Number(a.opcao_numero) || 0) - (Number(b.opcao_numero) || 0))
    entrada.aceita = entrada.opcoes.find((o) => o?.proposta_aceite?.aceita === true) ?? null
    entrada.total = entrada.opcoes.length
  }

  return entradas
}

/** Quantas propostas e quantos projetos avulsos, para o cabeçalho. */
export function resumoDaListagem(entradas) {
  const propostas = (entradas ?? []).filter((e) => e.tipo === 'proposta')
  const projetos = (entradas ?? []).filter((e) => e.tipo === 'projeto')
  return {
    propostas: propostas.length,
    opcoes: propostas.reduce((s, e) => s + e.opcoes.length, 0),
    projetos: projetos.length,
  }
}

/**
 * Situação de UMA opção para exibição — item 8.
 *
 * Traduz o que o servidor disse; não decide nada. Cada campo tem três estados
 * possíveis, e "não sei" é um deles: enquanto o detalhe do grupo não chegou,
 * `carregado` é `false` e a tela mostra "—" em vez de afirmar ausência.
 */
export function situacaoDaOpcao(opcao, detalhe = null) {
  const d = detalhe ?? null
  return {
    escolhida: opcao?.proposta_aceite?.aceita === true,
    // `null` = ainda não sabemos; `false` = sabemos que não há.
    orcamento: d ? (d.orcamento?.estado ?? null) : undefined,
    baseline: d ? !!d.baseline : undefined,
    gate: d ? (d.gate ?? null) : undefined,
    topologia: d?.topologia ?? null,
    inversor: d?.inversor ?? null,
    estrutura: d?.estrutura ?? null,
    potencia_kwp: opcao?.dimensionamento?.potencia_kwp ?? d?.dimensionamento?.potencia_kwp ?? null,
  }
}

/** Rótulo do Gate, com o motivo que o domínio devolveu. */
export function rotuloDoGate(gate) {
  if (gate === undefined) return { texto: '—', tom: 'neutro' }
  if (!gate) return { texto: 'não avaliado', tom: 'neutro' }
  if (gate.liberado) return { texto: 'liberado', tom: 'ok' }
  /**
   * O rótulo do Gate não repete o do selo da opção. Na mesma linha aparecem
   * duas coisas diferentes: o selo diz que ESTA opção perdeu a proposta; o Gate
   * diz por que o avanço está barrado. Escrever "não escolhida" nos dois
   * confundia as duas leituras.
   */
  const MOTIVOS = {
    SEM_BASELINE: 'sem Baseline',
    BASELINE_CORROMPIDA: 'Baseline corrompida',
    PROPOSTA_SEM_ACEITE: 'aguarda aceite',
    OPCAO_NAO_ESCOLHIDA: 'bloqueado',
  }
  return { texto: MOTIVOS[gate.motivo] ?? gate.motivo ?? 'bloqueado', tom: 'bloqueado' }
}
