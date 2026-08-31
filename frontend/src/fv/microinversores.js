/**
 * microinversores.js — topologia de microinversores da opção — FV-DOM-031.
 *
 * Converte entre o que o operador edita e
 * `arranjos[].configuracao_eletrica.micros[]`, o campo que a decisão 1 abriu.
 *
 * ── O modelo (decisão 5) ─────────────────────────────────────────────────────
 *   microinversor → entradas → módulos
 *
 * Não há MPPT, não há string, não há módulos em série. Cada micro tem N entradas
 * CC independentes e cada entrada aceita M módulos — quase sempre M = 1.
 *
 * ── Um bloco por MODELO (decisão 1) ──────────────────────────────────────────
 * A composição da FV-UX-029 já lista `arranjos[].inversores[]` com quantidade;
 * é dela que sai a lista de modelos. Cada modelo tem a sua quantidade, o seu
 * envelope (do catálogo) e a sua fatia de módulos.
 *
 * ── Onde a engenharia mora ───────────────────────────────────────────────────
 * Em `@fortesolar/fv-shared/engenharia/microinversores`. Aqui não há fórmula:
 * este arquivo monta o payload, chama o motor e traduz o resultado para a tela.
 *
 * Puro: sem React, sem I/O.
 */
import {
  avaliarComposicaoMicro, capacidadeDoMicro, distribuirEntreMicros, microsNecessarios,
} from '@fortesolar/fv-shared/engenharia/microinversores'
import { envelopeDoMicro, ehMicro } from './catalogo'

/** Inteiro > 0 ou `null`. Vazio e 0 são ausência. */
export function inteiro(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

/**
 * A composição é de microinversores?
 *
 * Basta UM micro na lista: uma composição que mistura micro e string não é
 * topologizável por nenhum dos dois editores, e isso é declarado, não resolvido
 * por conta própria.
 */
export function composicaoEhMicro(inversoresDaComposicao, catalogo) {
  const itens = comCatalogo(inversoresDaComposicao, catalogo)
  if (itens.length === 0) return false
  return itens.some((i) => i.equipamento && ehMicro(i.equipamento))
}

/** A composição mistura micro com não-micro? Situação que a UX declara. */
export function composicaoMista(inversoresDaComposicao, catalogo) {
  const itens = comCatalogo(inversoresDaComposicao, catalogo).filter((i) => i.equipamento)
  if (itens.length === 0) return false
  const micros = itens.filter((i) => ehMicro(i.equipamento)).length
  return micros > 0 && micros < itens.length
}

/** Casa cada inversor da composição com o registro do catálogo. */
function comCatalogo(inversores, catalogo) {
  return (inversores ?? []).map((inv) => ({
    inv,
    equipamento: (catalogo ?? []).find(
      (e) => String(e._id) === String(inv?.equipamento_id ?? inv?.id),
    ) ?? null,
  }))
}

/**
 * Configuração inicial a partir da composição.
 *
 * A quantidade de cada modelo vem da composição (fonte da opção, decisão 8).
 * O envelope vem do catálogo. A distribuição dos módulos NÃO é adivinhada: cada
 * modelo começa com os módulos que já couberem nele, na ordem, e o operador
 * ajusta. Nada é forçado a fechar (decisão 7).
 */
export function configDaComposicao(inversoresDaComposicao, catalogo, totalModulos) {
  const itens = comCatalogo(inversoresDaComposicao, catalogo).filter((i) => i.equipamento)
  let restante = inteiro(totalModulos) ?? 0

  return itens.map(({ inv, equipamento }) => {
    const envelope = envelopeDoMicro(equipamento)
    const quantidade = inteiro(inv?.quantidade)
    const capacidade = capacidadeDoMicro(envelope)
    // Cabe neste modelo o mínimo entre a capacidade dele e o que sobrou.
    const cabe = capacidade === null || quantidade === null
      ? null : Math.min(capacidade * quantidade, Math.max(0, restante))
    if (cabe !== null) restante -= cabe

    return {
      equipamento_id: String(equipamento._id),
      marca: equipamento.fabricante ?? null,
      modelo: equipamento.modelo ?? null,
      quantidade,
      entradas_por_micro: envelope.entradas,
      modulos_por_entrada: envelope.modulos_por_entrada,
      modulos: cabe,
      // Campos só de leitura, do catálogo — nunca editados aqui.
      _potencia_kw: envelope.potencia_kw,
      _oversizing_max: envelope.oversizing_max,
    }
  })
}

/** Capacidade em módulos de UM bloco (quantidade × entradas × módulos/entrada). */
export function capacidadeDoBloco(bloco) {
  const cap = capacidadeDoMicro({
    entradas: bloco?.entradas_por_micro,
    modulos_por_entrada: bloco?.modulos_por_entrada,
  })
  const q = inteiro(bloco?.quantidade)
  return cap === null || q === null ? null : cap * q
}

/** Distribuição dos módulos de um bloco entre os seus micros. */
export function distribuicaoDoBloco(bloco) {
  const cap = capacidadeDoMicro({
    entradas: bloco?.entradas_por_micro,
    modulos_por_entrada: bloco?.modulos_por_entrada,
  })
  return distribuirEntreMicros(bloco?.modulos, bloco?.quantidade, cap)
}

/** Micros que ESTE bloco precisaria para os módulos que recebeu (decisão 7). */
export function microsNecessariosNoBloco(bloco) {
  const cap = capacidadeDoMicro({
    entradas: bloco?.entradas_por_micro,
    modulos_por_entrada: bloco?.modulos_por_entrada,
  })
  return microsNecessarios(bloco?.modulos, cap)
}

/** Total de módulos já atribuído aos blocos. */
export function modulosAtribuidos(config) {
  return (config ?? [])
    .map((b) => inteiro(b?.modulos))
    .filter((n) => n !== null)
    .reduce((s, n) => s + n, 0)
}

/**
 * Coerência entre a topologia e a COMPOSIÇÃO (decisão 8).
 *
 * A composição é a fonte da opção; esta tela pode ajustar a quantidade para
 * testar arranjos (decisão 7). Divergir não é erro — é informação, exatamente
 * como `coerenciaComDimensionamento` faz na FV-UX-029. Quem decide qual dos dois
 * corrigir é o operador; o que não acontece é a divergência passar despercebida.
 */
export function coerenciaComComposicao(config, inversoresDaComposicao) {
  const naComposicao = new Map(
    (inversoresDaComposicao ?? []).map((i) => [String(i?.equipamento_id ?? i?.id), inteiro(i?.quantidade)]),
  )
  return (config ?? [])
    .map((b) => {
      const previsto = naComposicao.get(String(b.equipamento_id)) ?? null
      const naTopologia = inteiro(b.quantidade)
      if (previsto === null || naTopologia === null || previsto === naTopologia) return null
      return {
        rotulo: [b.marca, b.modelo].filter(Boolean).join(' ') || '—',
        previsto, naTopologia, diferenca: naTopologia - previsto,
      }
    })
    .filter(Boolean)
}

/** Total de microinversores da configuração. */
export function totalDeMicros(config) {
  return (config ?? [])
    .map((b) => inteiro(b?.quantidade))
    .filter((n) => n !== null)
    .reduce((s, n) => s + n, 0)
}

/**
 * Avaliação da configuração inteira — delega ao motor canônico.
 * Nenhuma regra elétrica vive deste lado.
 */
export function avaliar(config, potenciaModuloW, totalModulos) {
  return avaliarComposicaoMicro({
    modelos: (config ?? []).map((b) => ({
      rotulo: [b.marca, b.modelo].filter(Boolean).join(' ') || '—',
      modulos: b.modulos,
      quantidade: b.quantidade,
      micro: {
        entradas: b.entradas_por_micro,
        modulos_por_entrada: b.modulos_por_entrada,
        potencia_kw: b._potencia_kw,
        oversizing_max: b._oversizing_max,
      },
    })),
    totalModulos,
    potenciaModuloW,
  })
}

// ─── Persistência ────────────────────────────────────────────────────────────

/**
 * Configuração → `arranjos[].configuracao_eletrica.micros[]`.
 * A distribuição é gravada junto porque é o que o unifilar e o memorial leem —
 * derivada aqui uma vez, não recalculada por cada consumidor.
 */
export function paraConfigPersistida(config) {
  return (config ?? []).map((b) => ({
    equipamento_id: b.equipamento_id ?? null,
    marca: b.marca ?? null,
    modelo: b.modelo ?? null,
    quantidade: inteiro(b.quantidade),
    entradas_por_micro: inteiro(b.entradas_por_micro),
    modulos_por_entrada: inteiro(b.modulos_por_entrada),
    distribuicao: distribuicaoDoBloco(b) ?? undefined,
  }))
}

/**
 * `arranjos[].configuracao_eletrica.micros[]` → configuração editável.
 * Reidrata `_potencia_kw` e `_oversizing_max` do catálogo: são do EQUIPAMENTO,
 * não do projeto, e persistir cópia deles criaria segunda fonte.
 */
export function daConfigPersistida(micros, catalogo) {
  if (!Array.isArray(micros) || micros.length === 0) return null
  return micros.map((m) => {
    const eq = (catalogo ?? []).find((e) => String(e._id) === String(m?.equipamento_id)) ?? null
    const envelope = eq ? envelopeDoMicro(eq) : { potencia_kw: null, oversizing_max: null }
    return {
      equipamento_id: m?.equipamento_id ? String(m.equipamento_id) : null,
      marca: m?.marca ?? null,
      modelo: m?.modelo ?? null,
      quantidade: inteiro(m?.quantidade),
      entradas_por_micro: inteiro(m?.entradas_por_micro),
      modulos_por_entrada: inteiro(m?.modulos_por_entrada),
      modulos: (m?.distribuicao ?? [])
        .map((n) => Number(n)).filter(Number.isFinite)
        .reduce((s, n) => s + n, 0) || null,
      _potencia_kw: envelope.potencia_kw,
      _oversizing_max: envelope.oversizing_max,
    }
  })
}

/**
 * Arranjo pronto para `etapa: 'arranjos'`, preservando tudo o que esta tela
 * não edita — inclusive a composição da FV-UX-029 (decisão 8) e a topologia
 * string, que continua onde estava.
 */
export function paraArranjoComMicros(arranjoExistente, config) {
  return {
    ...(arranjoExistente ?? {}),
    topologia: 'micro',
    configuracao_eletrica: {
      ...(arranjoExistente?.configuracao_eletrica ?? {}),
      micros: paraConfigPersistida(config),
    },
  }
}
