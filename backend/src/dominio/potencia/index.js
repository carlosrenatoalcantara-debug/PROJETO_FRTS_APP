/**
 * dominio/potencia — derivação canônica das três potências FV — FV-DOM-052.
 *
 * O projeto tem TRÊS grandezas de potência, medidas e confirmadas na FV-AUD/
 * FV-DOM-050/051. Elas não são versões imprecisas umas das outras: respondem a
 * perguntas diferentes e podem divergir legitimamente.
 *
 *   NECESSIDADE  quanta potência o CONSUMO exige      dimensionamento.potencia_kwp
 *   COMPRADA     quanta potência foi ESCOLHIDA         arranjos[]
 *   INSTALADA    quanta potência está LIGADA           mppts[] / micros[] × Pmpp
 *
 * ── Por que este módulo existe ───────────────────────────────────────────────
 * `montarModeloEletrico` fabrica a potência quando falta topologia: sem
 * `mppts[]` ele cai num ramo de compatibilidade que usa `numPaineis ?? 6` e
 * `Pmpp ?? 550`. Medido — mesmo painel de 650 W:
 *
 *   com mppts[] (2 × 12)                → 15,6 kWp   ✓ físico
 *   sem mppts[], num_paineis = 20       → 13,0 kWp   ✗ é a NECESSIDADE arredondada
 *   projeto vazio                       →  3,3 kWp   ✗ 6 × 550 W, ambos inventados
 *
 * O motor não está errado — ele serve o desenho do wizard legado, onde um traço
 * aproximado é melhor que nenhum. Errado é consumir esse número como fato. Este
 * módulo é o portão: decide se o motor PODE ser chamado e, quando não pode,
 * devolve `instalada: null` com a lacuna declarada. Nunca estima.
 *
 * ── O que este módulo NÃO faz ────────────────────────────────────────────────
 * Não persiste (INV-58). Não altera `montarModeloEletrico` — ele é compartilhado
 * com o wizard legado e mexer nele mudaria desenho de projeto existente. Não soma
 * módulos por conta própria: a composição vem de `obterTopologiaProjeto`, a
 * camada de acesso oficial. Não cria tolerância: divergência é declarada com o
 * número, e quem decide o que é aceitável é regra de negócio que ainda não existe.
 * Não troca leitor nenhum — isso é a FV-DOM-053.
 */

import { obterTopologiaProjeto } from '../topologia/obterTopologiaProjeto.js'
import { adaptarProjetoParaUnifilar } from '../unifilar/adaptarProjeto.js'
import { montarModeloEletrico } from '@fortesolar/fv-shared/engenharia/normativa'
import { montarModeloMicro } from '@fortesolar/fv-shared/engenharia/microinversores'

/** Motivos de ausência. Uma potência ausente sempre diz POR QUÊ. */
export const MOTIVOS_POTENCIA = Object.freeze({
  SEM_NECESSIDADE:      'NECESSIDADE_NAO_CALCULADA',
  SEM_COMPOSICAO:       'COMPOSICAO_VAZIA',
  SEM_TOPOLOGIA:        'TOPOLOGIA_AUSENTE',
  SEM_POTENCIA_MODULO:  'MODULO_SEM_POTENCIA',
  MODELO_SEM_POTENCIA:  'MOTOR_DECLAROU_LACUNA',
})

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Grandeza ausente, com o motivo. Nunca `0` — ausência não é zero. */
const vazia = (motivo) => ({ valor: null, fonte: null, motivo })
const presente = (valor, fonte) => ({ valor, fonte, motivo: null })

// ─── 1 · NECESSIDADE ─────────────────────────────────────────────────────────

/**
 * Necessidade energética. Persistida porque é decisão de premissas (HSP, perdas,
 * margem) que não se reconstrói do estado do projeto.
 *
 * NÃO recalcula: lê o que o motor de dimensionamento já gravou. Recalcular aqui
 * criaria a segunda fórmula que a FV-DOM-050 proibiu.
 */
export function necessidadeDoProjeto(projeto) {
  const v = num(projeto?.dimensionamento?.potencia_kwp)
  if (v === null || v <= 0) return vazia(MOTIVOS_POTENCIA.SEM_NECESSIDADE)
  return presente(v, 'dimensionamento.potencia_kwp')
}

// ─── 2 · COMPRADA ────────────────────────────────────────────────────────────

/**
 * Potência da composição escolhida. Derivada, nunca persistida.
 *
 * Passa por `obterTopologiaProjeto` porque a S3-FV-ENGINE-TOPOLOGY-CONSUMPTION-01
 * declarou aquela a camada de acesso oficial e PROIBIU ler `projeto.arranjos`
 * fora dela. A soma continua sendo a de `calcularTotaisProjeto` — byte a byte.
 */
export function compradaDoProjeto(projeto, { instalacao = null, catalogo = null } = {}) {
  const { origem, totais } = obterTopologiaProjeto(projeto, { instalacao, catalogo })
  const v = num(totais?.potencia_total_kwp)
  if (v === null || v <= 0) return vazia(MOTIVOS_POTENCIA.SEM_COMPOSICAO)
  return presente(v, origem === 'instalacao'
    ? 'instalacao.geradores (totaisTopologia)'
    : 'arranjos[] (calcularTotaisProjeto)')
}

// ─── 3 · INSTALADA ───────────────────────────────────────────────────────────

/**
 * A topologia é suficiente para AFIRMAR uma potência física?
 *
 * Duas condições, e as duas são sobre o mesmo produto `contagem × Pmpp`:
 *
 *   1. CONTAGEM real — `arranjoMPPTs` (string) ou `micros[]` (micro). O adapter
 *      já filtra MPPT sem `strings_paralelo`/`modulos_por_string`; o que sobra é
 *      contagem declarada pelo projetista, não estimativa.
 *   2. Pmpp real — `equipamentos.paineis[0].potencia_w`. Sem ele o caminho string
 *      usa 550 W silenciosamente.
 *
 * Conservador de propósito: o motor também aceita Pmpp do catálogo elétrico por
 * `painel.id`, e daqui não dá para verificar se aquela consulta acertou. Na
 * dúvida, lacuna — nunca um número que ninguém escolheu.
 */
export function topologiaSuficiente(entrada) {
  const lacunas = []

  // A topologia é decidida pelo adapter (FV-DOM-031C) — não se readivinha aqui.
  const topologia = entrada?.topologia === 'micro' ? 'micro' : 'string'
  const contagem = topologia === 'micro' ? entrada?.micros : entrada?.arranjoMPPTs
  if (!Array.isArray(contagem) || contagem.length === 0) {
    lacunas.push(topologia === 'micro'
      ? 'arranjos[].configuracao_eletrica.micros'
      : 'engenharia_eletrica.arranjo.mppts')
  }

  const pmpp = num(entrada?.painelMicro?.potenciaW ?? entrada?.painel?.potenciaW)
  if (pmpp === null || pmpp <= 0) lacunas.push('equipamentos.paineis[0].potencia_w')

  return { suficiente: lacunas.length === 0, topologia, lacunas }
}

/**
 * Potência física efetivamente ligada. `null` quando a topologia não sustenta a
 * afirmação — e é essa a regra central da sprint.
 *
 * Quando pode afirmar, DELEGA aos motores existentes. Não reimplementa
 * `Σ strings × módulos_por_string × Pmpp`: o número devolvido é o mesmo que o
 * unifilar desenha, byte a byte.
 */
export function instaladaDoProjeto(projeto, { moduloCatalogo = null } = {}) {
  let entrada
  try {
    ({ entrada } = adaptarProjetoParaUnifilar(projeto, { moduloCatalogo }))
  } catch {
    return { ...vazia(MOTIVOS_POTENCIA.SEM_TOPOLOGIA), lacunas: ['engenharia_eletrica.arranjo.mppts'] }
  }

  const porta = topologiaSuficiente(entrada)
  if (!porta.suficiente) {
    const soFaltaPmpp = porta.lacunas.length === 1
      && porta.lacunas[0] === 'equipamentos.paineis[0].potencia_w'
    return {
      ...vazia(soFaltaPmpp ? MOTIVOS_POTENCIA.SEM_POTENCIA_MODULO : MOTIVOS_POTENCIA.SEM_TOPOLOGIA),
      lacunas: porta.lacunas, topologia: porta.topologia,
    }
  }

  const modelo = porta.topologia === 'micro'
    ? montarModeloMicro({
      // Mesma composição que `gerarUnifilarMicro` monta: os elétricos vêm do
      // catálogo, marca/modelo/potência do projeto. Um objeto diferente daria
      // um número diferente do que o unifilar desenha.
      painel: { ...entrada.painel, ...(entrada.painelMicro ?? {}) },
      micros: entrada.micros,
      dadosConsumo: { tipoLigacao: entrada.tipo_ligacao, tensao: entrada.tensao }, uf: entrada.uf,
    })
    : montarModeloEletrico({
      painel: entrada.painel, inversor: entrada.inversor,
      arranjoMPPTs: entrada.arranjoMPPTs, dimensionamento: entrada.dimensionamento,
      dadosConsumo: { tipoLigacao: entrada.tipo_ligacao, tensao: entrada.tensao }, uf: entrada.uf,
    })

  const v = num(modelo?.sistema?.potenciaCC)
  if (v === null || v <= 0) {
    // O caminho micro declara as próprias lacunas; o string não declara nenhuma.
    return {
      ...vazia(MOTIVOS_POTENCIA.MODELO_SEM_POTENCIA),
      lacunas: Array.isArray(modelo?.lacunas) && modelo.lacunas.length > 0
        ? modelo.lacunas : ['modulo.potencia_w'],
      topologia: porta.topologia,
    }
  }

  return {
    ...presente(v, porta.topologia === 'micro'
      ? 'arranjos[].configuracao_eletrica.micros[] × Pmpp'
      : 'engenharia_eletrica.arranjo.mppts[] × Pmpp'),
    lacunas: [],
    topologia: porta.topologia,
    modulos: num(porta.topologia === 'micro'
      ? modelo?.sistema?.numModulos
      : modelo?.resumo?.numPaineis),
  }
}

// ─── 4 · DIVERGÊNCIAS ────────────────────────────────────────────────────────

/**
 * Compara duas grandezas. DECLARA — não lança, não bloqueia, não corrige.
 *
 * Mesmo contrato de `avaliarDivergencia` (dominio/conexao, FV-DOM-047): derivado
 * em leitura e informativo. Sem faixa de tolerância: `divergente` é a diferença
 * existir, e o consumidor recebe o número para decidir. Fixar um limiar aqui
 * seria inventar a regra de negócio que a FV-DOM-050 deixou explicitamente aberta.
 */
export function compararPotencias(a, b, rotulo) {
  if (a?.valor == null || b?.valor == null) {
    return { rotulo, comparavel: false, divergente: false, diferenca_kwp: null, diferenca_pct: null }
  }
  const dif = +(b.valor - a.valor).toFixed(3)
  return {
    rotulo,
    comparavel: true,
    divergente: dif !== 0,
    diferenca_kwp: dif,
    diferenca_pct: a.valor === 0 ? null : +((dif / a.valor) * 100).toFixed(1),
  }
}

// ─── 5 · DERIVAÇÃO CANÔNICA ──────────────────────────────────────────────────

/**
 * As três potências de um projeto, com fonte, lacunas e divergências.
 *
 * PURA: sem I/O, sem escrita, sem `process.env`. Idempotente.
 *
 * @param {object} projeto  ProjetoFV (lean ou hidratado)
 * @param {object} [opts]
 * @param {object} [opts.instalacao]      Instalação, quando o projeto já tem uma
 * @param {object|function} [opts.catalogo]      resolvedor de specs da Instalação
 * @param {object} [opts.moduloCatalogo]  doc do módulo, para o caminho micro
 * @returns {{necessidade, comprada, instalada, lacunas, divergencias}}
 */
export function derivarPotencias(projeto, { instalacao = null, catalogo = null, moduloCatalogo = null } = {}) {
  const necessidade = necessidadeDoProjeto(projeto)
  const comprada = compradaDoProjeto(projeto, { instalacao, catalogo })
  const instalada = instaladaDoProjeto(projeto, { moduloCatalogo })

  const lacunas = [...new Set([
    ...(necessidade.valor == null ? ['dimensionamento.potencia_kwp'] : []),
    ...(comprada.valor == null ? ['arranjos[]'] : []),
    ...(instalada.lacunas ?? []),
  ])]

  return {
    necessidade,
    comprada,
    instalada,
    lacunas,
    divergencias: {
      necessidade_vs_comprada: compararPotencias(necessidade, comprada, 'necessidade → comprada'),
      comprada_vs_instalada:   compararPotencias(comprada, instalada, 'comprada → instalada'),
      necessidade_vs_instalada: compararPotencias(necessidade, instalada, 'necessidade → instalada'),
    },
  }
}

export default {
  derivarPotencias,
  necessidadeDoProjeto,
  compradaDoProjeto,
  instaladaDoProjeto,
  topologiaSuficiente,
  compararPotencias,
  MOTIVOS_POTENCIA,
}
