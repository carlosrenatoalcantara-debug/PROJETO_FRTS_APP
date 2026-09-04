/**
 * inversoresCompativeisService.js — Sprint D1.
 *
 * ORQUESTRADOR. Não contém uma única regra de engenharia elétrica: recebe a
 * configuração preliminar (D0), o módulo e os candidatos do catálogo, e chama o
 * motor canônico `analisarCompatibilidade` uma vez por candidato.
 *
 * ── O que este arquivo NÃO faz ───────────────────────────────────────────────
 * Não compara tensão, não corrige por temperatura, não calcula Voc de string,
 * não avalia oversizing. Tudo isso vive em `compatibilidadeEletricaService` e
 * continua vivendo lá. Se aparecer aritmética elétrica aqui, é bug — e há teste
 * varrendo este arquivo atrás dela.
 *
 * ── O limite honesto do que se pode avaliar antes do inversor ────────────────
 * O motor canônico modela STRING: exige `quantidade_modulos_por_string` e
 * `quantidade_strings_paralelo`, e avalia janela de MPPT, Voc a frio e corrente.
 * A configuração preliminar da D0 fornece exatamente esses dois números — então,
 * para topologia string, a avaliação preliminar é REAL, feita pelo motor.
 *
 * Para MICRO não é. A topologia de microinversor é `micro → entradas → módulos`
 * (FV-DOM-031), não série/paralelo, e a tensão máxima de entrada de um micro
 * (dezenas de volts) é incomparável com uma string. Alimentar o motor com um
 * arranjo de string para julgar um micro produziria reprovação artificial.
 *
 * Por isso, em micro, o filtro preliminar é declaradamente MENOR: tecnologia e
 * fase. O envelope elétrico do micro (entradas, módulos por entrada, CC/CA) é
 * avaliado depois, no editor de microinversores que já existe. O resultado diz
 * isso em `avaliacao`, em vez de fingir que houve análise elétrica.
 */

import { analisarCompatibilidade } from './compatibilidadeEletricaService.js'
import { lerInversor, classificarTopologiaInversor, TOPOLOGIA }
  from '../equipamentos/inversores/dicionarioInversor.js'
import { lerModulo } from '@fortesolar/fv-shared/modulos'

/** Motivos que a UX pode tratar sem conhecer a regra interna. */
export const MOTIVOS_COMPATIBILIDADE = Object.freeze({
  CONFIG_INCOMPLETA: 'CONFIG_INCOMPLETA',
  MODULO_SEM_DADOS: 'MODULO_SEM_DADOS',
  SEM_CANDIDATOS: 'SEM_CANDIDATOS',
  TOPOLOGIA_INVALIDA: 'TOPOLOGIA_INVALIDA',
})

/** Como cada candidato foi julgado — o rótulo do que realmente se avaliou. */
export const AVALIACAO = Object.freeze({
  ELETRICA_PRELIMINAR: 'eletrica_preliminar',   // motor canônico rodou
  TECNOLOGIA_E_FASE: 'tecnologia_e_fase',       // micro: só o que dá antes do inversor
})

const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const inteiroPositivo = (v) => {
  const n = num(v)
  if (n === null) return null
  const i = Math.trunc(n)
  return i > 0 ? i : null
}

/**
 * Fases que o texto da fatura declara → número, como o catálogo as guarda.
 *
 * A comparação remove acentos por normalização Unicode. Medido no QA: o mesmo
 * rótulo "Monofásico" chega ora composto, ora decomposto (NFC × NFD) conforme a
 * origem do dado, e a igualdade literal falhava em silêncio — devolvia "fases"
 * como lacuna para uma fase que estava lá. Comparar sem diacrítico elimina a
 * classe inteira do problema, sem afrouxar nada: o vocabulário aceito continua
 * sendo o mesmo três.
 */
const FASES_POR_ROTULO = Object.freeze({ monofasico: 1, bifasico: 2, trifasico: 3 })
const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
export function fasesDaInstalacao(rotulo) {
  if (typeof rotulo !== 'string') return null
  return FASES_POR_ROTULO[semAcento(rotulo.trim().toLowerCase())] ?? null
}

/**
 * A fase do inversor serve a instalação?
 *
 * Só REPROVA quando o catálogo declara a fase e ela é maior que a da
 * instalação — um trifásico não entra numa entrada monofásica. Fase ausente no
 * catálogo não reprova nem aprova: vira ressalva, porque ausência não é defeito
 * do equipamento e inventar o número seria pior.
 */
export function faseServe(fasesInversor, fasesInstalacao) {
  if (fasesInversor === null || fasesInstalacao === null) return { serve: true, declarada: false }
  return { serve: fasesInversor <= fasesInstalacao, declarada: true }
}

/** O que falta na configuração preliminar para sequer tentar avaliar. */
export function lacunasDaConfiguracao(cfg) {
  const faltando = []
  const tipo = cfg?.tipo
  if (tipo !== 'string' && tipo !== 'micro') faltando.push('tipo')
  if (fasesDaInstalacao(cfg?.fases) === null) faltando.push('fases')
  if (tipo === 'string') {
    if (inteiroPositivo(cfg?.modulos_por_string) === null) faltando.push('modulos_por_string')
    if (inteiroPositivo(cfg?.quantidade_strings) === null) faltando.push('quantidade_strings')
  }
  return faltando
}

/** Resumo estável do candidato. NÃO devolve a ficha técnica inteira. */
const resumo = (eq) => ({
  equipamento_id: String(eq?._id ?? ''),
  fabricante: eq?.fabricante ?? null,
  modelo: eq?.modelo ?? null,
})

/**
 * Avalia o catálogo contra a configuração preliminar.
 *
 * @param {object} p
 * @param {object} p.configuracao   — preliminar da D0: {tipo, fases, modulos_por_string, quantidade_strings}
 * @param {object} p.modulo         — documento `Equipamento` do módulo (SSOT)
 * @param {object[]} p.candidatos   — documentos `Equipamento` de inversores (SSOT)
 * @param {object} [p.clima]        — repassado ao motor; ele tem fallback próprio
 * @returns {{ok:boolean, codigo?:string, ...}} resultado normalizado
 */
export function avaliarCompatibilidade({ configuracao, modulo, candidatos, clima } = {}) {
  const lacunas = lacunasDaConfiguracao(configuracao)
  if (lacunas.length > 0) {
    return {
      ok: false,
      codigo: MOTIVOS_COMPATIBILIDADE.CONFIG_INCOMPLETA,
      mensagem: `Configuração preliminar incompleta: ${lacunas.join(', ')}.`,
      lacunas,
      compativeis: [],
      incompativeis: [],
      avaliados: 0,
    }
  }

  // O módulo vem do SSOT; nada é assumido quando ele não declara um parâmetro.
  const m = lerModulo(modulo)
  const eletricoModulo = {
    voc: m.voc,
    vmpp: m.vmpp,
    isc: m.isc,
    impp: m.impp,
    potencia_w: m.potencia_w,
    coef_temp_voc: m.coef_temp_voc,
  }
  const faltaModulo = ['voc', 'vmpp', 'isc', 'impp', 'potencia_w', 'coef_temp_voc']
    .filter((k) => eletricoModulo[k] === null || eletricoModulo[k] === undefined)
  if (faltaModulo.length > 0) {
    return {
      ok: false,
      codigo: MOTIVOS_COMPATIBILIDADE.MODULO_SEM_DADOS,
      mensagem: `O módulo do catálogo não declara: ${faltaModulo.join(', ')}.`,
      lacunas: faltaModulo.map((k) => `modulo.${k}`),
      compativeis: [],
      incompativeis: [],
      avaliados: 0,
    }
  }

  const fasesInst = fasesDaInstalacao(configuracao.fases)
  const querMicro = configuracao.tipo === 'micro'
  const modulosPorString = inteiroPositivo(configuracao.modulos_por_string)
  const totalStrings = inteiroPositivo(configuracao.quantidade_strings)

  /**
   * Descasamento semântico medido, e resolvido sem inventar dado.
   *
   * No motor canônico, `quantidade_strings_paralelo` é o número de strings em
   * paralelo POR MPPT — é assim que ele calcula a Isc de projeto contra
   * `corrente_max_mppt` (NBR 16690 §5.2). Na configuração preliminar da D0,
   * `quantidade_strings` é o TOTAL de strings do sistema.
   *
   * Converter um no outro exigiria saber quantos MPPTs o inversor tem e como as
   * strings se distribuem entre eles — exatamente o que só existe DEPOIS da
   * escolha e que a D0 deixou fora de escopo.
   *
   * Passar o total como se fosse por MPPT reprovaria quase todo inversor por uma
   * corrente que ninguém propôs. Então a pergunta preliminar é a que se pode
   * responder com honestidade: UMA string de N módulos cabe neste inversor?
   * Isso testa tensão máxima de entrada, janela de MPPT e Voc a frio — tudo pelo
   * motor canônico, sem nenhuma conta reproduzida aqui.
   *
   * A corrente por MPPT depende da distribuição e continua sendo validada
   * depois, no fluxo que já existe. O resultado diz isso em `nao_avaliado`.
   */
  const arranjo = {
    quantidade_modulos_por_string: modulosPorString,
    quantidade_strings_paralelo: 1,
  }

  const compativeis = []
  const incompativeis = []

  for (const eq of candidatos ?? []) {
    const esp = eq?.especificacoes ?? {}
    const ctx = { fabricante: eq?.fabricante, modelo: eq?.modelo, subtipo: esp?.subtipo }
    const topo = classificarTopologiaInversor(esp, ctx)
    const ehMicro = topo === TOPOLOGIA.MICRO

    // 1 · Tecnologia: string não serve topologia micro, e vice-versa.
    if (ehMicro !== querMicro) {
      incompativeis.push({ ...resumo(eq), motivo: 'tecnologia', detalhe: `topologia do catálogo: ${topo ?? 'não classificada'}` })
      continue
    }

    // 2 · Fase — só quando o catálogo declara.
    const c = lerInversor(esp, ctx)
    const fase = faseServe(num(c?.fases), fasesInst)
    if (!fase.serve) {
      incompativeis.push({ ...resumo(eq), motivo: 'fase', detalhe: `inversor ${c.fases}F em instalação ${fasesInst}F` })
      continue
    }

    // 3 · Micro para aqui — o envelope elétrico dele não é série/paralelo.
    if (querMicro) {
      compativeis.push({
        ...resumo(eq),
        compativel: true,
        avaliacao: AVALIACAO.TECNOLOGIA_E_FASE,
        fase_declarada: fase.declarada,
        resumo: 'Tecnologia e fase conferem. Envelope elétrico do microinversor é avaliado na etapa de distribuição por entradas.',
      })
      continue
    }

    // 4 · String: o motor canônico decide. Nenhuma regra é reproduzida aqui.
    const r = analisarCompatibilidade({
      dados_eletricos_modulo: eletricoModulo,
      // O motor usa `mppt_min|mppt_max|corrente_max_mppt|potencia_ca_kw`; o
      // dicionário SSOT nomeia os mesmos parâmetros como `tensao_mppt_min`,
      // `tensao_mppt_max`, `corrente_max_por_mppt` e `potencia_kw`. A tradução é
      // só de nome — nenhum valor é convertido, estimado ou completado.
      dados_eletricos_inversor: {
        tensao_max_entrada: num(c?.tensao_max_entrada),
        mppt_min: num(c?.tensao_mppt_min),
        mppt_max: num(c?.tensao_mppt_max),
        // Dois limites de corrente DISTINTOS, cada um no seu parâmetro: o de
        // trabalho e o de curto-circuito. Antes só o primeiro era enviado, e o
        // motor o usava como se fosse o segundo.
        corrente_max_mppt: num(c?.corrente_max_por_mppt),
        corrente_isc_max_mppt: num(c?.corrente_isc_max),
        potencia_ca_kw: num(c?.potencia_kw),
      },
      arranjo_proposto: arranjo,
      dados_climaticos_regiao: clima ?? undefined,
    })

    if (r?.compativel) {
      /**
       * Capacidade declarada pelo catálogo: o total de strings cabe nas entradas
       * que este inversor diz ter? Só verifica quando o SSOT declara os dois
       * números — ausência não reprova nem aprova, vira ressalva.
       */
      const nMppts = inteiroPositivo(c?.n_mppts)
      const porMppt = inteiroPositivo(c?.strings_por_mppt)
      const capacidade = nMppts !== null && porMppt !== null ? nMppts * porMppt : null
      if (capacidade !== null && totalStrings !== null && totalStrings > capacidade) {
        incompativeis.push({
          ...resumo(eq),
          motivo: 'CAPACIDADE_DE_STRINGS',
          detalhe: `${totalStrings} strings não cabem nas ${capacidade} entradas declaradas (${nMppts} MPPT × ${porMppt}).`,
        })
        continue
      }
      compativeis.push({
        ...resumo(eq),
        compativel: true,
        /**
         * `status` é aditivo — `compativel: true` continua significando o
         * mesmo, e nenhum consumidor do contrato quebra. Ele distingue o
         * candidato limpo do candidato com ATENÇÃO, que antes eram o mesmo
         * booleano com um array de avisos que a UX não mostrava.
         */
        status: r.status ?? null,
        avaliacao: AVALIACAO.ELETRICA_PRELIMINAR,
        fase_declarada: fase.declarada,
        capacidade_strings: capacidade,
        avisos: (r.warnings ?? []).map((w) => w.codigo).filter(Boolean),
        // Mensagens completas, com os valores medidos — a UX não deve
        // reconstruir texto a partir de código.
        avisos_detalhados: (r.warnings ?? []).map((w) => ({
          codigo: w.codigo, mensagem: w.mensagem, valores: w.valores ?? null,
        })),
        // Corrente por critério: operação, curto-circuito e projeto normativa.
        avaliacao_corrente: r.avaliacao_corrente ?? null,
        erros: [],
        // O que a avaliação preliminar NÃO cobre — declarado, não escondido.
        /**
         * `corrente_por_mppt` CONTINUA aqui: o que a correção passou a avaliar é
         * a corrente de UMA string contra os limites de trabalho e de curto. A
         * corrente resultante da distribuição real de várias strings por MPPT
         * segue fora do alcance da avaliação preliminar — dizer o contrário
         * seria trocar um exagero por outro.
         */
        nao_avaliado: [
          'corrente_por_mppt', 'distribuicao_de_strings', 'relacao_cc_ca_total',
          ...(r.nao_avaliados ?? []).map((n) => n.criterio),
        ],
        resumo: (r.warnings ?? []).length ? 'Compatível com ressalvas do motor elétrico.' : 'Compatível.',
      })
    } else {
      const primeiro = (r?.erros ?? [])[0] ?? null
      incompativeis.push({
        ...resumo(eq),
        motivo: primeiro?.codigo ?? 'INCOMPATIVEL',
        detalhe: primeiro?.mensagem ?? null,
      })
    }
  }

  const avaliados = (candidatos ?? []).length
  return {
    ok: true,
    // Determinístico: ordena por fabricante e modelo, não pela ordem do banco.
    compativeis: compativeis.sort(ordenar),
    incompativeis: incompativeis.sort(ordenar),
    avaliados,
    ...(compativeis.length === 0
      ? {
        codigo: MOTIVOS_COMPATIBILIDADE.SEM_CANDIDATOS,
        mensagem: avaliados === 0
          ? 'Nenhum inversor no catálogo para avaliar.'
          : `Nenhum dos ${avaliados} inversores do catálogo atende a configuração.`,
      }
      : {}),
    criterio: querMicro ? AVALIACAO.TECNOLOGIA_E_FASE : AVALIACAO.ELETRICA_PRELIMINAR,
  }
}

const ordenar = (a, b) =>
  String(a.fabricante ?? '').localeCompare(String(b.fabricante ?? ''), 'pt-BR')
  || String(a.modelo ?? '').localeCompare(String(b.modelo ?? ''), 'pt-BR')

export default { avaliarCompatibilidade, lacunasDaConfiguracao, fasesDaInstalacao, faseServe, MOTIVOS_COMPATIBILIDADE, AVALIACAO }
