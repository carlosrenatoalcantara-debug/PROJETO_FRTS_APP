/**
 * preservacaoArranjos.js — F14-2.
 *
 * Verifica PRESERVAÇÃO DE INFORMAÇÃO entre o documento persistido e o modelo
 * que um adapter produz. Lógica pura, sem I/O e sem `process.exit` — o executor
 * é `__checks__/equivalenciaArranjosF14.check.js`.
 *
 * ── Preservação, não igualdade ──────────────────────────────────────────────
 * O contrato NÃO é "legado === adapter". Em multiarranjo o objetivo é o oposto:
 * o adapter tem de conter MAIS do que o legado enxerga.
 *
 *   PERDA  — o adapter deixou de representar algo que o documento tem  → FALHA
 *   GANHO  — o adapter representa algo que o legado descarta           → esperado
 *
 * Em arranjo único, ganho é zero e os dois modelos coincidem. Em multiarranjo,
 * ganho ZERO significa que o adapter está descartando igual ao legado — e isso
 * REPROVA. Empate, ali, é o defeito; não a aprovação.
 *
 * É por isso que o módulo se chama preservação e não equivalência: o arquivo do
 * executor guardou o nome antigo por continuidade com o commit que o criou, mas
 * a semântica verificada é esta.
 *
 * ── Por que `adapter` é injetável ───────────────────────────────────────────
 * A primeira versão chamava `arranjosCanonicos` por dentro. Todos os cenários
 * rodavam contra a implementação CORRETA, então o comparador nunca foi provado
 * FALHAR: se ele sempre devolvesse `{ perdas: [] }`, o guard continuaria verde.
 * Um guard que nunca falhou não é um guard — é uma afirmação. Com a injeção, os
 * casos adversariais alimentam adapters defeituosos de propósito.
 *
 * ── O que mais a F14-2 corrigiu ─────────────────────────────────────────────
 *   módulos   — eram conferidos só pela SOMA; trocar 225 ↔ 174 entre dois
 *               arranjos mantém 399 e passava
 *   inversor  — era conferido só pela CONTAGEM; trocar Solplanet 50K por
 *               Huawei 60K mantém "1 inversor" e passava
 *   topologia — era conferida só por consistência interna, nunca contra o que o
 *               documento oferece
 *
 * Tudo é comparado POR IDENTIDADE (`arranjo.id`), nunca por posição. A única
 * exceção é `visaoLegada`, que usa `[0]` DE PROPÓSITO: ela simula o legado.
 */
import { arranjosCanonicos, ESTADO_DADO } from './arranjosCanonicos.js'
import { normalizarArranjos, calcularTotaisProjeto } from '../../services/arranjosService.js'

/** O que os consumidores de hoje enxergam: UM arranjo, escolhido por posição. */
function visaoLegada(projeto) {
  const arranjos = Array.isArray(projeto?.arranjos) ? projeto.arranjos : []
  const a = arranjos.find((x) => x?.tipo === 'principal') ?? arranjos[0] ?? null
  return {
    arranjos: a ? 1 : 0,
    modulos: (a?.paineis ?? []).reduce((s, p) => s + (Number(p?.quantidade) || 0), 0),
  }
}

/** Assinatura de um inversor: o que o identifica tecnicamente. */
const assinaturaInversor = (i) => [
  (i?.fabricante ?? i?.marca ?? '').toString().trim().toUpperCase(),
  (i?.modelo ?? '').toString().trim().toUpperCase(),
  Number(i?.potencia_kw) || 0,
  Number(i?.quantidade) || 1,
].join('|')

const _n = (v) => (v === null || v === undefined || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null))

/**
 * Topologia que o DOCUMENTO oferece para um arranjo, e o que o adapter deveria
 * então dizer. Esta função é a expectativa; o comparador confere contra ela.
 */
function topologiaEsperada(docArranjo, projeto, multiarranjo) {
  const micros = Array.isArray(docArranjo?.configuracao_eletrica?.micros) ? docArranjo.configuracao_eletrica.micros : []
  if (micros.length > 0) return { estado: ESTADO_DADO.DISPONIVEL, tipo: 'micro', itens: micros.length }
  const mppts = Array.isArray(docArranjo?.configuracao_eletrica?.mppts) ? docArranjo.configuracao_eletrica.mppts : []
  if (mppts.length > 0) return { estado: ESTADO_DADO.DISPONIVEL, tipo: 'string', itens: mppts.length }

  const legado = Array.isArray(projeto?.engenharia_eletrica?.arranjo?.mppts) ? projeto.engenharia_eletrica.arranjo.mppts : []
  if (legado.length > 0) {
    // Em multiarranjo a topologia do projeto não tem dono. Ambiguidade DECLARADA
    // não é perda — perda seria atribuí-la a um arranjo qualquer.
    return multiarranjo
      ? { estado: ESTADO_DADO.AMBIGUO, tipo: 'string', itens: 0 }
      : { estado: ESTADO_DADO.DISPONIVEL, tipo: 'string', itens: legado.length }
  }
  return { estado: ESTADO_DADO.AUSENTE, tipo: null, itens: 0 }
}

/**
 * Compara o documento com o modelo do adapter.
 *
 * @param {object} projeto
 * @param {object} [opts]
 * @param {function} [opts.adapter] injetável — é o que permite provar que o
 *   comparador REPROVA quando o adapter perde informação. Sem isso, todos os
 *   cenários rodariam contra a implementação correta e nada seria provado.
 * @returns {{perdas: string[], ganhos: string[]}}
 */
export function compararModelos(projeto, { adapter = arranjosCanonicos } = {}) {
  const legado = visaoLegada(projeto)
  const c = adapter(projeto)
  const doc = normalizarArranjos(projeto)
  const totais = calcularTotaisProjeto(projeto)
  const multiarranjo = doc.length > 1
  const perdas = []
  const ganhos = []

  // 1 · quantidade
  if (c.arranjos.length !== doc.length) {
    perdas.push(`adapter tem ${c.arranjos.length} arranjo(s), o documento tem ${doc.length}`)
  }
  // GANHO mede o que o ADAPTER acrescenta sobre o legado — não o que o
  // documento tem. A distinção importa: medido pelo documento, um adapter que
  // descartasse tudo ainda "ganharia", e a checagem 8 nunca dispararia.
  if (c.arranjos.length > legado.arranjos) {
    ganhos.push(`${c.arranjos.length - legado.arranjos} arranjo(s) que o legado descarta`)
  }

  // 2 · identidade — quantidade igual com id trocado é PERDA, não empate
  const idsAdapter = c.arranjos.map((a) => a.id)
  for (const d of doc) {
    if (!idsAdapter.includes(d.id)) perdas.push(`arranjo \`${d.id}\` sumiu no adapter`)
  }
  for (const id of idsAdapter) {
    if (!doc.some((d) => d.id === id)) perdas.push(`adapter inventou o arranjo \`${id}\``)
  }

  // 3 · módulos POR ARRANJO — a soma sozinha não basta: trocar 225 ↔ 174 entre
  //     dois arranjos mantém o total e esconde a troca.
  for (const d of doc) {
    const a = c.arranjos.find((x) => x.id === d.id)
    if (!a) continue
    const esperado = Number(d?.dimensionamento?.n_modulos) || 0
    if (a.modulos.total !== esperado) {
      perdas.push(`módulos do arranjo \`${d.id}\`: adapter ${a.modulos.total}, documento ${esperado}`)
    }
  }
  const soma = c.arranjos.reduce((s, a) => s + a.modulos.total, 0)
  if (soma !== totais.n_modulos_total) {
    perdas.push(`módulos no total: adapter soma ${soma}, totais dizem ${totais.n_modulos_total}`)
  }
  if (soma > legado.modulos) ganhos.push(`${soma - legado.modulos} módulo(s) que o legado descarta`)

  // 4 · potência por arranjo — derivada; `null` é resposta válida (F12)
  for (const a of c.arranjos) {
    const d = doc.find((x) => x.id === a.id)
    if (!d) continue
    const esperado = _n(d?.potencia_kwp)
    if (esperado !== _n(a.potencia.cc_kwp)) {
      perdas.push(`potência do arranjo \`${d.id}\`: adapter ${a.potencia.cc_kwp}, documento ${esperado}`)
    }
  }

  // 5 · inversor por arranjo — por ASSINATURA, não por contagem. Trocar
  //     Solplanet 50K por Huawei 60K mantém "1 inversor" e mudaria a usina.
  for (const d of doc) {
    const a = c.arranjos.find((x) => x.id === d.id)
    const doDoc = (d.inversores ?? []).filter((i) => i?.modelo || i?.marca || i?.fabricante)
    if (doDoc.length === 0) continue
    const esperadas = doDoc.map(assinaturaInversor).sort()
    const obtidas = (a?.inversor.itens ?? []).map(assinaturaInversor).sort()
    if (JSON.stringify(esperadas) !== JSON.stringify(obtidas)) {
      perdas.push(`inversores do arranjo \`${d.id}\`: adapter [${obtidas.join(' , ') || '—'}], documento [${esperadas.join(' , ')}]`)
    }
  }

  // 6 · topologia — contra o que o DOCUMENTO oferece, não só consistência interna
  for (const d of doc) {
    const a = c.arranjos.find((x) => x.id === d.id)
    if (!a) continue
    const esp = topologiaEsperada(d, projeto, multiarranjo)
    const t = a.topologia
    const itens = (t.mppts?.length ?? 0) + (t.micros?.length ?? 0)
    if (t.estado !== esp.estado) {
      perdas.push(`topologia de \`${d.id}\`: adapter diz \`${t.estado}\`, esperado \`${esp.estado}\``)
    }
    if (itens !== esp.itens) {
      perdas.push(`topologia de \`${d.id}\`: adapter traz ${itens} item(ns), documento oferece ${esp.itens}`)
    }
    if (esp.tipo && t.estado === ESTADO_DADO.DISPONIVEL && t.tipo !== esp.tipo) {
      perdas.push(`topologia de \`${d.id}\`: adapter diz tipo \`${t.tipo}\`, esperado \`${esp.tipo}\``)
    }
  }

  // 7 · origem — todo dado presente declara de onde veio
  for (const a of c.arranjos) {
    if (a.inversor.estado === ESTADO_DADO.DISPONIVEL && !a.inversor.fonte) perdas.push(`inversor de \`${a.id}\` sem fonte`)
    if (a.topologia.estado === ESTADO_DADO.DISPONIVEL && !a.topologia.fonte) perdas.push(`topologia de \`${a.id}\` sem fonte`)
  }

  // 8 · multiarranjo sem ganho é o defeito que este guard existe para pegar:
  //     significa que o adapter descarta tanto quanto o legado.
  if (multiarranjo && ganhos.length === 0) {
    perdas.push('projeto multiarranjo sem ganho — o adapter descarta como o legado')
  }

  return { perdas, ganhos }
}

