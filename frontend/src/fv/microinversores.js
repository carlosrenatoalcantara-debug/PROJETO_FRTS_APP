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
// Sprint E — o nível ACIMA do micro (arranjos e fases) mora no motor canônico,
// como o nível de baixo. Aqui só se monta o payload e se traduz o resultado.
import {
  planejarMicros, planejarComposicaoMicro, planoObsoleto,
} from '@fortesolar/fv-shared/engenharia/arranjos-micro'
// Sprint E2 — corrente é motor separado, com veredito próprio. Não se mistura
// com a distribuição de módulos: um pode estar completo e o outro não.
import { avaliarCorrenteMicro, VEREDITO } from '@fortesolar/fv-shared/engenharia/corrente-micro'
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
      _fabricante: envelope.fabricante,
      _max_por_cabo_tronco: envelope.max_por_cabo_tronco,
      // Sprint E2 — o que o CATÁLOGO declara, guardado ao lado do que está em
      // uso, para que a procedência da capacidade seja derivável na tela.
      _entradas_ssot: envelope.entradas,
      _modulos_por_entrada_ssot: envelope.modulos_por_entrada,
      _corrente_max_por_mppt: envelope.corrente_max_por_mppt,
      _corrente_isc_max: envelope.corrente_isc_max,
      _corrente_ac_saida: envelope.corrente_ac_saida,
      // Sprint E3 — conflitos de cadastro do EQUIPAMENTO, para a tela dizer por
      // que um valor sumiu. Vêm do catálogo e nunca são persistidos no projeto.
      _conflitos: envelope.conflitos ?? [],
      // Agrupamento salvo do projeto. Ausente numa composição nova — o plano
      // vigente é a proposta, e é ele que a tela mostra.
      arranjos: null,
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

/**
 * Envelope do bloco no formato que o motor de arranjos espera — Sprint E.
 * `entradas`/`modulos_por_entrada` são editáveis na tela (o operador pode
 * corrigir um catálogo incompleto); `fabricante` e o limite por arranjo vêm do
 * catálogo e nunca são editados aqui, porque são do EQUIPAMENTO.
 */
function envelopeDoBloco(bloco) {
  return {
    entradas: bloco?.entradas_por_micro ?? null,
    modulos_por_entrada: bloco?.modulos_por_entrada ?? null,
    fabricante: bloco?._fabricante ?? bloco?.marca ?? null,
    max_por_cabo_tronco: bloco?._max_por_cabo_tronco ?? null,
    rotulo: [bloco?.marca, bloco?.modelo].filter(Boolean).join(' ') || null,
    origem: procedenciaDaCapacidade(bloco),
    corrente_max_por_mppt: bloco?._corrente_max_por_mppt ?? null,
    // Limite de CURTO-CIRCUITO — grandeza distinta do limite de trabalho acima.
    corrente_isc_max: bloco?._corrente_isc_max ?? null,
    corrente_ac_saida: bloco?._corrente_ac_saida ?? null,
  }
}

/**
 * De onde vieram `entradas` e `modulos_por_entrada` — Sprint E2, §2.
 *
 * A auditoria mediu que NENHUM micro do catálogo declara os dois. O operador
 * pode preenchê-los na tela, e o cálculo então roda — mas o resultado não pode
 * se apresentar como dado de catálogo. A procedência é DERIVADA da comparação
 * entre o que está no bloco e o que o catálogo declarou (`_entradas_ssot`,
 * `_modulos_por_entrada_ssot`): não é campo novo, não é persistida, não é uma
 * quarta fonte.
 *
 * @returns {'ssot'|'manual'|'ajustado'|null}
 *   `ssot`     ambos vieram do catálogo e não foram tocados
 *   `manual`   o catálogo não declara — o número é do operador
 *   `ajustado` o catálogo declara, mas o operador mudou
 */
export function procedenciaDaCapacidade(bloco) {
  const noBloco = [inteiro(bloco?.entradas_por_micro), inteiro(bloco?.modulos_por_entrada)]
  if (noBloco.some((v) => v === null)) return null
  const noCatalogo = [inteiro(bloco?._entradas_ssot), inteiro(bloco?._modulos_por_entrada_ssot)]
  if (noCatalogo.some((v) => v === null)) return 'manual'
  return noCatalogo[0] === noBloco[0] && noCatalogo[1] === noBloco[1] ? 'ssot' : 'ajustado'
}

/**
 * Plano vigente do bloco: módulos por micro, arranjos e fases — Sprint E.
 * Delegação pura ao motor canônico; nenhuma regra vive deste lado.
 */
export function planoDoBloco(bloco, fases) {
  return planejarMicros({
    modulos: bloco?.modulos,
    quantidade: bloco?.quantidade,
    micro: envelopeDoBloco(bloco),
    fases,
  })
}

/**
 * Plano da COMPOSIÇÃO inteira — Sprint E2, §6.
 *
 * É este que a tela usa. `planoDoBloco` continua existindo para quem precisa de
 * um modelo isolado, mas o balanceamento de fases só faz sentido olhando todos
 * os arranjos juntos: dois modelos planejados separadamente empilhavam ambos em
 * L1 e cada um se declarava equilibrado.
 */
export function planoDaComposicao(config, fases) {
  return planejarComposicaoMicro({
    modelos: (config ?? []).map((b) => ({
      modulos: b?.modulos, quantidade: b?.quantidade, micro: envelopeDoBloco(b),
    })),
    fases,
  })
}

/**
 * Corrente de um bloco — Sprint E2, §3. Delegação pura; `null` quando não há
 * plano de arranjos, porque a corrente de ramal depende de quantos micros há
 * em cada um.
 */
export function correnteDoBloco(bloco, modulo, plano) {
  // Aceita `{ isc, impp }`; a forma antiga (só Isc) continua legível para não
  // quebrar chamador nenhum — mas sem Impp o critério de OPERAÇÃO fica
  // `nao_avaliado`, e Isc jamais entra no lugar dele.
  const eletrico = typeof modulo === 'object' && modulo !== null
    ? modulo : { isc: modulo, impp: null }
  return avaliarCorrenteMicro({
    micro: envelopeDoBloco(bloco),
    iscModulo: eletrico.isc ?? null,
    imppModulo: eletrico.impp ?? null,
    microsPorArranjo: plano?.arranjos ? plano.arranjos.map((a) => a.micros.length) : null,
  })
}

export { VEREDITO }

/**
 * O agrupamento salvo ainda descreve a configuração atual? (§20 da Sprint E.)
 * Nada é corrigido em silêncio: a tela mostra o plano vigente e DIZ o que mudou.
 */
export function obsolescenciaDoBloco(bloco, fases) {
  return planoObsoleto(bloco?.arranjos, planoDoBloco(bloco, fases))
}

/**
 * Obsolescência de cada bloco contra o plano da COMPOSIÇÃO — Sprint E2.
 * Necessário porque a fase de um arranjo depende dos outros modelos: com dois
 * modelos, comparar bloco a bloco acusaria divergência onde não há, e deixaria
 * passar a que existe.
 */
export function obsolescenciaDaComposicao(config, fases) {
  const composicao = planoDaComposicao(config, fases)
  return (config ?? []).map((b, i) =>
    planoObsoleto(b?.arranjos, composicao.por_modelo[i] ?? planoDoBloco(b, fases)))
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
export function paraConfigPersistida(config, fases = null) {
  /**
   * Sprint E2 — as fases vêm do plano da COMPOSIÇÃO, não do plano de cada bloco.
   * Gravar por bloco reintroduziria o defeito do §6: dois modelos, ambos
   * começando em L1. O que se grava é exatamente o que a tela mostrou.
   */
  const composicao = planoDaComposicao(config, fases)
  return (config ?? []).map((b, i) => {
    const plano = composicao.por_modelo[i] ?? planoDoBloco(b, fases)
    return {
      equipamento_id: b.equipamento_id ?? null,
      marca: b.marca ?? null,
      modelo: b.modelo ?? null,
      quantidade: inteiro(b.quantidade),
      entradas_por_micro: inteiro(b.entradas_por_micro),
      modulos_por_entrada: inteiro(b.modulos_por_entrada),
      distribuicao: distribuicaoDoBloco(b) ?? undefined,
      /**
       * Sprint E — agrupamento e fase. `undefined` (campo ausente) quando não há
       * regra declarada: gravar `[]` afirmaria "nenhum arranjo", que é diferente
       * de "não se sabe agrupar". O limite do fabricante NÃO é copiado para cá —
       * ele é do catálogo, e persistir cópia criaria segunda fonte.
       */
      arranjos: plano.arranjos === null
        ? undefined
        : plano.arranjos.map((a) => ({ micros: a.micros, fase: a.fase })),
    }
  })
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
      _fabricante: envelope.fabricante ?? m?.marca ?? null,
      _max_por_cabo_tronco: envelope.max_por_cabo_tronco ?? null,
      _entradas_ssot: envelope.entradas ?? null,
      _modulos_por_entrada_ssot: envelope.modulos_por_entrada ?? null,
      _corrente_max_por_mppt: envelope.corrente_max_por_mppt ?? null,
      _corrente_isc_max: envelope.corrente_isc_max ?? null,
      _corrente_ac_saida: envelope.corrente_ac_saida ?? null,
      _conflitos: envelope.conflitos ?? [],
      // Sprint E — agrupamento como está gravado, para poder ser CONFRONTADO
      // com o plano vigente. Não é usado como verdade: é usado para detectar
      // que a configuração mudou embaixo dele.
      arranjos: Array.isArray(m?.arranjos) && m.arranjos.length > 0
        ? m.arranjos.map((a) => ({
            micros: (a?.micros ?? []).map((n) => Number(n)).filter(Number.isFinite),
            fase: a?.fase ?? null,
          }))
        : null,
    }
  })
}

/**
 * Arranjo pronto para `etapa: 'arranjos'`, preservando tudo o que esta tela
 * não edita — inclusive a composição da FV-UX-029 (decisão 8) e a topologia
 * string, que continua onde estava.
 */
export function paraArranjoComMicros(arranjoExistente, config, fases = null) {
  return {
    ...(arranjoExistente ?? {}),
    topologia: 'micro',
    configuracao_eletrica: {
      ...(arranjoExistente?.configuracao_eletrica ?? {}),
      micros: paraConfigPersistida(config, fases),
    },
  }
}
