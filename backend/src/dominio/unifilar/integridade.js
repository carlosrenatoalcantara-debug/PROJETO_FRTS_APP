/**
 * integridade.js — o portão entre a topologia e o desenho — FV-DOM-056.
 *
 * ── O defeito que este módulo fecha ──────────────────────────────────────────
 * Medido na FV-QA-055 (T07/T09), pelo navegador, com 77 módulos e 2 inversores
 * de 25 kW:
 *
 *   • o validador elétrico RECUSOU a topologia — `Vmpp no frio 1017,85 V > 850 V`;
 *   • “Salvar topologia” ficou desabilitado, corretamente;
 *   • e o unifilar foi desenhado assim mesmo, mostrando
 *     `1 string · 77 módulos · Voc 3933,1 V · CA 25 kW`.
 *
 * Voc de 3933 V num inversor de 1000 V. Metade da potência CA comprada. Um
 * documento visualmente impecável descrevendo uma instalação que não existe e
 * não pode existir — pronto para virar anexo de homologação.
 *
 * A causa não está no motor: `montarModeloEletrico` tem um ramo de
 * compatibilidade que, sem `arranjoMPPTs`, usa `dimensionamento.numPaineis` como
 * UMA string. Isso serve ao wizard legado, onde um traço aproximado é melhor que
 * nenhum. O erro é o domínio canônico deixar esse ramo ser alcançado.
 *
 * ── O que este módulo faz ────────────────────────────────────────────────────
 * Decide, ANTES de desenhar, se existe topologia que sustente um desenho. Quando
 * não existe, o domínio declara o impedimento com o motivo técnico e devolve
 * `svg: null` — nunca um desenho alternativo.
 *
 * ── O que este módulo NÃO faz ────────────────────────────────────────────────
 * Não altera `montarModeloEletrico` (compartilhado com o wizard legado, que
 * continua desenhando como sempre pelo seu próprio caminho). Não valida
 * eletricidade — quem faz isso é `compatibilidadeEletricaService`, e aqui só se
 * LÊ o veredito que ele já deu. Não conta módulos por conta própria: a
 * composição vem de `obterTopologiaProjeto`, a camada de acesso oficial. Não
 * cria campo, não persiste, não inventa default.
 */

import { obterTopologiaProjeto } from '../topologia/obterTopologiaProjeto.js'

/** Por que o desenho foi recusado. Toda recusa nomeia um destes. */
export const MOTIVOS_UNIFILAR = Object.freeze({
  TOPOLOGIA_AUSENTE:    'TOPOLOGIA_AUSENTE',
  TOPOLOGIA_INVALIDA:   'TOPOLOGIA_INVALIDA',
  TOPOLOGIA_DIVERGENTE: 'TOPOLOGIA_DIVERGENTE',
  MULTIPLOS_INVERSORES: 'MULTIPLOS_INVERSORES',
  // F-02: topologia declarada e equipamento ausente — o caso em que o motor
  // desenhava com os próprios defaults (550 W / 5 kW) sem avisar ninguém.
  EQUIPAMENTO_AUSENTE:  'EQUIPAMENTO_AUSENTE',
})

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Módulos que a topologia declara — soma do que o adapter já normalizou.
 * Não é uma segunda contagem: `entrada.arranjoMPPTs` é a saída de `adaptarMppts`,
 * a mesma lista que o motor consome.
 */
export function modulosDaTopologia(arranjoMPPTs) {
  if (!Array.isArray(arranjoMPPTs)) return 0
  return arranjoMPPTs.reduce((s, m) => s + num(m.numStrings) * num(m.modulosPorString), 0)
}

/**
 * Existe topologia suficiente para o desenho representar a instalação?
 *
 * @returns {null|{codigo,motivo,detalhe}} `null` quando pode desenhar.
 */
export function avaliarIntegridade(projeto, entrada, { instalacao = null, catalogo = null } = {}) {
  const micro = entrada?.topologia === 'micro'

  // ── 1 · Ausência ──────────────────────────────────────────────────────────
  // Sem contagem declarada não há o que desenhar. É aqui que T07/T09 param: a
  // topologia foi recusada pelo validador e, por isso, nunca chegou ao projeto.
  const contagem = micro ? entrada?.micros : entrada?.arranjoMPPTs
  if (!Array.isArray(contagem) || contagem.length === 0) {
    return {
      codigo: MOTIVOS_UNIFILAR.TOPOLOGIA_AUSENTE,
      motivo: micro
        ? 'A distribuição por microinversor não foi definida. Sem ela, o diagrama descreveria uma instalação que o projeto não declarou.'
        : 'A topologia por MPPT não foi definida. Sem ela, o diagrama usaria o número ESTIMADO de módulos como uma única string — um sistema que não existe.',
      detalhe: { campo: micro
        ? 'arranjos[].configuracao_eletrica.micros'
        : 'engenharia_eletrica.arranjo.mppts' },
    }
  }

  // ── 1b · Equipamento ausente — F-02 ───────────────────────────────────────
  //
  // O portão cobria a topologia e não cobria o EQUIPAMENTO. Com uma topologia
  // declarada e `equipamentos` vazio, `entrada.painel` e `entrada.inversor`
  // chegam `null` e o motor cai nos seus defaults internos: módulo de 550 W,
  // inversor de 5 kW. O desenho sai bonito e descreve outro sistema.
  //
  // A regra do domínio é a mesma dos limites elétricos: ausência é ausência.
  // Sem o equipamento, recusa-se o desenho em vez de assumir um.
  if (!micro) {
    const faltando = []
    if (!entrada?.painel?.modelo && !entrada?.painel?.marca) faltando.push('equipamentos.paineis[0]')
    if (!entrada?.inversor?.modelo && !entrada?.inversor?.marca) faltando.push('equipamentos.inversor')
    if (faltando.length > 0) {
      return {
        codigo: MOTIVOS_UNIFILAR.EQUIPAMENTO_AUSENTE,
        motivo: 'O projeto não declara o módulo e/ou o inversor. Sem eles o diagrama '
          + 'usaria os valores internos do motor (módulo de 550 W, inversor de 5 kW) '
          + 'e representaria um sistema que não é o do projeto.',
        detalhe: { campos: faltando },
      }
    }
  }

  // O caminho micro para por aqui: a decisão da FV-DOM-031 é REGISTRAR e
  // DECLARAR a divergência (CC/CA acima do limite do fabricante, distribuição
  // desigual), não impedir. Esta sprint preserva isso — as regras abaixo são do
  // caminho string, onde a fabricação acontece.
  if (micro) return null

  // ── 2 · Recusa do validador ───────────────────────────────────────────────
  // `compatibilidade.compativel` é o veredito que a etapa de topologia já
  // persistiu. A tela impede salvar quando é `false`; a API, não. Se um
  // reprovado chegou ao documento por qualquer caminho, o desenho para.
  const compat = projeto?.engenharia_eletrica?.compatibilidade ?? null
  if (compat && compat.compativel === false) {
    const bloqueios = (compat.diagnosticos ?? [])
      .filter((d) => d?.severidade === 'erro' || d?.bloqueante === true)
      .map((d) => d?.mensagem ?? d?.codigo)
      .filter(Boolean)
    return {
      codigo: MOTIVOS_UNIFILAR.TOPOLOGIA_INVALIDA,
      motivo: 'A topologia registrada foi REPROVADA pela análise elétrica. O diagrama não representa arranjo reprovado.',
      detalhe: { diagnosticos: bloqueios.length > 0 ? bloqueios : null },
    }
  }

  const { totais } = obterTopologiaProjeto(projeto, { instalacao, catalogo })

  // ── 3 · Mais de um inversor ───────────────────────────────────────────────
  // O adapter lê `equipamentos.inversor` — o PRIMEIRO. Desenhar um sistema de
  // dois inversores a partir de um só reduz a potência CA pela metade em
  // silêncio, que foi exatamente o `25 kW` de 50 kW comprados do T07/T09.
  const nInversores = num(totais?.n_inversores_total)
  if (nInversores > 1) {
    return {
      codigo: MOTIVOS_UNIFILAR.MULTIPLOS_INVERSORES,
      motivo: `A composição tem ${nInversores} inversores e o diagrama representa um só. A distribuição entre vários inversores depende de decisão de domínio ainda pendente e não é assumida aqui.`,
      detalhe: { inversores_na_composicao: nInversores, inversores_no_desenho: 1 },
    }
  }

  // ── 4 · Topologia que não corresponde à composição ────────────────────────
  // Módulos ligados ≠ módulos comprados. Pode ser achado legítimo de engenharia,
  // mas não pode passar calado para dentro de um documento.
  const naTopologia = modulosDaTopologia(entrada.arranjoMPPTs)
  const naComposicao = num(totais?.n_modulos_total)
  if (naComposicao > 0 && naTopologia !== naComposicao) {
    return {
      codigo: MOTIVOS_UNIFILAR.TOPOLOGIA_DIVERGENTE,
      motivo: `A topologia liga ${naTopologia} módulo(s), e a composição do projeto tem ${naComposicao}. O diagrama representaria um sistema diferente do contratado.`,
      detalhe: { modulos_na_topologia: naTopologia, modulos_na_composicao: naComposicao },
    }
  }

  return null
}

/**
 * O mesmo portão, aplicado a UM ARRANJO — F14-6B.
 *
 * As regras são as mesmas; o que muda é o ESCOPO em que cada uma é medida.
 * Regras 3 e 4 liam totais do PROJETO — é por isso que hoje nenhum projeto
 * multiarranjo desenha: dois arranjos de um inversor cada somam dois inversores
 * e caem em `MULTIPLOS_INVERSORES`, mesmo com cada arranjo perfeitamente
 * representável. Medidas POR ARRANJO, as duas regras continuam valendo com o
 * mesmo rigor: um arranjo com dois inversores segue recusado, e a divergência
 * entre topologia e composição segue bloqueando.
 *
 * A regra 2 (veredito do validador elétrico) continua sendo do PROJETO: é o
 * documento que está reprovado, não um arranjo em particular.
 *
 * @param {object} projeto
 * @param {object} entrada  entrada do motor para ESTE arranjo
 * @param {object} arranjo  arranjo do contrato canônico (`arranjosCanonicos`)
 */
export function avaliarIntegridadeArranjo(projeto, entrada, arranjo) {
  const micro = entrada?.topologia === 'micro'

  const contagem = micro ? entrada?.micros : entrada?.arranjoMPPTs
  if (!Array.isArray(contagem) || contagem.length === 0) {
    return {
      codigo: MOTIVOS_UNIFILAR.TOPOLOGIA_AUSENTE,
      motivo: micro
        ? `O arranjo ${arranjo?.rotulo ?? arranjo?.id} não define a distribuição por microinversor.`
        : `O arranjo ${arranjo?.rotulo ?? arranjo?.id} não define a topologia por MPPT. Sem ela, o diagrama usaria o número ESTIMADO de módulos como uma única string.`,
      // `campo`/`chave` saem separados de propósito: o guard F-04 (2/3) proíbe o
      // Core de TOCAR a topologia string legada, e escrever o caminho inteiro
      // numa mensagem seria indistinguível de lê-lo. O dado aqui vem do adapter
      // canônico; o que se declara é onde o projetista preenche.
      detalhe: { arranjo_id: arranjo?.id ?? null, campo: 'arranjos[].configuracao_eletrica',
        chave: micro ? 'micros' : 'mppts' },
    }
  }

  if (!micro) {
    const faltando = []
    if (!entrada?.painel?.modelo && !entrada?.painel?.marca) faltando.push('arranjos[].paineis[0]')
    if (!entrada?.inversor?.modelo && !entrada?.inversor?.marca) faltando.push('arranjos[].inversores[0]')
    if (faltando.length > 0) {
      return {
        codigo: MOTIVOS_UNIFILAR.EQUIPAMENTO_AUSENTE,
        motivo: `O arranjo ${arranjo?.rotulo ?? arranjo?.id} não declara módulo e/ou inversor. Sem eles o diagrama usaria os valores internos do motor.`,
        detalhe: { arranjo_id: arranjo?.id ?? null, campos: faltando },
      }
    }
  }

  const compat = projeto?.engenharia_eletrica?.compatibilidade ?? null
  if (compat && compat.compativel === false) {
    const bloqueios = (compat.diagnosticos ?? [])
      .filter((d) => d?.severidade === 'erro' || d?.bloqueante === true)
      .map((d) => d?.mensagem ?? d?.codigo)
      .filter(Boolean)
    return {
      codigo: MOTIVOS_UNIFILAR.TOPOLOGIA_INVALIDA,
      motivo: 'A topologia registrada foi REPROVADA pela análise elétrica. O diagrama não representa arranjo reprovado.',
      detalhe: { diagnosticos: bloqueios.length > 0 ? bloqueios : null },
    }
  }

  if (micro) return null

  // Regra 3 · POR ARRANJO. `MULTIPLOS_INVERSORES` permanece — o desenho de um
  // arranjo representa UM inversor, e dois num mesmo arranjo continuam sem
  // distribuição definida.
  const nInversores = (arranjo?.inversor?.itens ?? []).reduce((s, i) => s + num(i?.quantidade ?? 1), 0)
  if (nInversores > 1) {
    return {
      codigo: MOTIVOS_UNIFILAR.MULTIPLOS_INVERSORES,
      motivo: `O arranjo ${arranjo?.rotulo ?? arranjo?.id} tem ${nInversores} inversores e o diagrama representa um só.`,
      detalhe: { arranjo_id: arranjo?.id ?? null, inversores_no_arranjo: nInversores, inversores_no_desenho: 1 },
    }
  }

  // Regra 4 · POR ARRANJO. `modulos.total` vem de `calcularTotaisProjeto` pela
  // via canônica — não é contagem nova.
  const naTopologia = modulosDaTopologia(entrada.arranjoMPPTs)
  const naComposicao = num(arranjo?.modulos?.total)
  if (naComposicao > 0 && naTopologia !== naComposicao) {
    return {
      codigo: MOTIVOS_UNIFILAR.TOPOLOGIA_DIVERGENTE,
      motivo: `O arranjo ${arranjo?.rotulo ?? arranjo?.id} liga ${naTopologia} módulo(s) e a composição declara ${naComposicao}.`,
      detalhe: { arranjo_id: arranjo?.id ?? null, modulos_na_topologia: naTopologia, modulos_na_composicao: naComposicao },
    }
  }

  return null
}

export default { avaliarIntegridade, avaliarIntegridadeArranjo, modulosDaTopologia, MOTIVOS_UNIFILAR }
