/**
 * arranjosCanonicos.js — F14-IMP (etapas 1–3).
 *
 * Contrato canônico INTERMEDIÁRIO de arranjos. Lê o modelo de hoje e expõe uma
 * representação uniforme POR ARRANJO, dizendo de onde veio cada informação e o
 * que está ausente.
 *
 * Não persiste nada. Não escreve. Não migra. Nenhum consumidor foi ligado a ele
 * neste sprint — é a infraestrutura para migrar consumidor por consumidor
 * depois, um de cada vez, com o guard de equivalência provando que nada se
 * perdeu no caminho.
 *
 * ── Por que existe ──────────────────────────────────────────────────────────
 * A F14 mediu: `unifilar/adaptarProjeto` produz `inversor: AUSENTE` em 5 de 5
 * projetos multiarranjo, e `homologacaoController` descarta até 354 de 565
 * módulos (63%) do documento enviado à distribuidora. Os dois fazem a mesma
 * coisa — escolhem um arranjo com `find(principal) ?? arranjos[0]` e seguem
 * como se ele fosse o projeto.
 *
 * A causa não é falta de dado: `arranjos[]` tem tudo. É que cada consumidor
 * resolve compatibilidade legada por conta própria, e a forma mais curta de
 * fazer isso é pegar o primeiro. Enquanto a regra viver espalhada, cada novo
 * consumidor a reinventa errado. Aqui ela vive uma vez.
 *
 * ── Como se encaixa no que já existe ────────────────────────────────────────
 * Constrói SOBRE `obterTopologiaProjeto`, a camada de acesso oficial — não ao
 * lado dela. A normalização e os totais continuam vindo de lá (portanto de
 * `normalizarArranjos`/`calcularTotaisProjeto`), byte a byte. O que este módulo
 * acrescenta é o que faltava: topologia e equipamento resolvidos POR ARRANJO,
 * com procedência declarada.
 *
 * O formato espelha o caminho de MICROINVERSOR, que já resolveu este problema:
 * `arranjos[].configuracao_eletrica.micros[]` é por arranjo, é canônico, e o
 * domínio inteiro o consome sem passar por `engenharia_eletrica`. String segue
 * o mesmo desenho em vez de inventar outro.
 *
 * ── Invariantes ─────────────────────────────────────────────────────────────
 *   identidade > posição   `arranjo.id` (F13) identifica; `ordem` é informativa
 *   ausência ≠ inferência  falta de dado vira estado nomeado, nunca um default
 *   agregado = derivação   totais vêm dos arranjos, nunca de segunda fonte
 *   fallback é explícito   toda leitura legada carrega `fonte` dizendo isso
 */

import { obterTopologiaProjeto } from './obterTopologiaProjeto.js'
import { principaisDoProjeto } from '@fortesolar/fv-shared/projeto/identidade-arranjo'

/** Como o projeto está composto. */
export const ESTADO_PROJETO = Object.freeze({
  SEM_ARRANJOS: 'sem_arranjos',
  ARRANJO_UNICO: 'arranjo_unico',
  MULTIARRANJO: 'multiarranjo',
})

/** Procedência de um dado — nunca implícita. */
export const FONTE = Object.freeze({
  ARRANJO: 'arranjos',
  LEGACY_TOPOLOGIA: 'legacy_engenharia_eletrica_arranjo',
  LEGACY_EQUIPAMENTO: 'legacy_equipamentos_inversor',
  AUSENTE: null,
})

/**
 * Qual REGRA produziu `topologia.efetiva` — F14-3A.
 *
 * Distinta de `FONTE`, que diz de qual ESTRUTURA o dado elétrico veio. Aqui a
 * pergunta é outra: por que a classificação é esta.
 */
export const ORIGEM_TOPOLOGIA = Object.freeze({
  /** `micros[]` preenchido — FV-DOM-031C, o fato estrutural. */
  ESTRUTURAL_MICROS: 'estrutural_micros',
  /** `arranjos[].topologia` escolhida pelo projetista. */
  DECLARADA: 'declarada',
  /** `engenharia_eletrica.arranjo`, só quando atribuível a UM arranjo. */
  LEGADO: 'legacy_engenharia_eletrica_arranjo',
  /** Nada classificou. A heurística NÃO preenche `efetiva`. */
  AUSENTE: null,
})

/** Como a classificação do PROJETO foi obtida a partir dos arranjos. */
export const ORIGEM_PROJETO = Object.freeze({
  UNANIME: 'unanime',
  /** Arranjos classificados de formas diferentes — não se escolhe uma. */
  DIVERGENTE: 'divergente',
  AUSENTE: 'ausente',
})

/** Disponibilidade de um dado do arranjo. */
export const ESTADO_DADO = Object.freeze({
  DISPONIVEL: 'disponivel',
  AUSENTE: 'ausente',
  /** Existe dado, mas não é atribuível a ESTE arranjo sem inventar a atribuição. */
  AMBIGUO: 'ambiguo',
})

const _num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const _lista = (v) => (Array.isArray(v) ? v : [])

/**
 * Inversores DO ARRANJO.
 *
 * Fonte preferida: `arranjos[].inversores[]`. `equipamentos.inversor` só entra
 * como fallback LEGADO e só quando o projeto tem UM arranjo — num projeto de
 * dois, o inversor da raiz não pertence a nenhum deles em particular, e
 * atribuí-lo a um seria exatamente o `[0]` implícito que este módulo remove.
 */
function resolverInversores(arranjo, projeto, multiarranjo) {
  const doArranjo = _lista(arranjo?.inversores).filter((i) => i?.modelo || i?.marca || i?.fabricante)
  if (doArranjo.length > 0) {
    return {
      estado: ESTADO_DADO.DISPONIVEL,
      fonte: FONTE.ARRANJO,
      itens: doArranjo.map((i) => ({
        equipamento_id: i?.equipamento_id ?? null,
        fabricante: i?.fabricante ?? i?.marca ?? null,
        modelo: i?.modelo ?? null,
        potencia_kw: _num(i?.potencia_kw),
        quantidade: _num(i?.quantidade) ?? 1,
      })),
    }
  }

  const raiz = projeto?.equipamentos?.inversor
  const temRaiz = !!(raiz && (raiz.modelo || raiz.marca || raiz.fabricante))
  if (temRaiz && !multiarranjo) {
    return {
      estado: ESTADO_DADO.DISPONIVEL,
      fonte: FONTE.LEGACY_EQUIPAMENTO,
      itens: [{
        equipamento_id: raiz?.equipamento_id ?? null,
        fabricante: raiz?.fabricante ?? raiz?.marca ?? null,
        modelo: raiz?.modelo ?? null,
        potencia_kw: _num(raiz?.potencia_kw),
        quantidade: _num(raiz?.quantidade) ?? 1,
      }],
    }
  }
  if (temRaiz && multiarranjo) {
    // Há inversor na raiz e vários arranjos: o dado existe, mas dizer de qual
    // arranjo ele é seria inventar. Estado nomeado, não escolha silenciosa.
    return { estado: ESTADO_DADO.AMBIGUO, fonte: FONTE.LEGACY_EQUIPAMENTO, itens: [] }
  }
  return { estado: ESTADO_DADO.AUSENTE, fonte: FONTE.AUSENTE, itens: [] }
}

/**
 * Topologia DO ARRANJO.
 *
 * Preferência: o que está no próprio arranjo — `micros[]` (canônico desde a
 * FV-DOM-031) ou `mppts[]` (LEGACY isolado da F-04, hoje 0/589).
 *
 * Fallback: `engenharia_eletrica.arranjo`, que é UMA topologia por projeto.
 * Só é atribuível quando existe UM arranjo. Com dois ou mais, a topologia do
 * projeto não tem dono, e o estado é `ambiguo` — é precisamente aqui que a
 * arquitetura atual deixa de representar o segundo arranjo.
 */
function resolverTopologia(arranjo, projeto, multiarranjo) {
  const micros = _lista(arranjo?.configuracao_eletrica?.micros)
  const mppts = _lista(arranjo?.configuracao_eletrica?.mppts)
  const legado = _lista(projeto?.engenharia_eletrica?.arranjo?.mppts)

  // DECLARADA — a escolha do projetista, persistida (`arranjos[].topologia`,
  // enum do schema). Vem de `topologia_declarada`, que `enriquecerArranjo`
  // preserva ANTES de sobrescrever o campo com a heurística.
  const declarada = arranjo?.topologia_declarada ?? null

  // HEURÍSTICA — o que `detectarTopologia` inferiu do nome do inversor quando
  // não havia declaração. Informativa, NUNCA entra em `efetiva` (Regra 4:
  // ausência não se infere). Sai à parte para que `composicaoDoProjeto`, que
  // hoje a consome, possa ser migrado depois com a diferença visível.
  const heuristica = declarada === null ? (arranjo?.topologia ?? null) : null

  // ESTRUTURAL — só `micros[]` classifica. `mppts[]` NÃO promove a `string`:
  // nenhum consumidor o usa para isso e a cobertura é 0/589; promovê-lo mudaria
  // o contrato sem evidência. Ele continua preservado abaixo, como DADO
  // elétrico, separado da classificação.
  const estrutural = micros.length > 0 ? 'micro' : null

  const base = { declarada, estrutural, heuristica, micros, mppts }
  // `conflito` é sobre a CLASSIFICAÇÃO, não sobre a estrutura: só existe quando
  // o projetista declarou uma coisa e a estrutura diz outra.
  const conflito = declarada !== null && estrutural !== null && declarada !== estrutural

  // ── Regra 1 · estrutura de microinversores vence a declaração ─────────────
  // FV-DOM-031C: `micros[]` preenchido é o fato. A declaração NÃO é descartada
  // — continua em `declarada`, e a divergência sai marcada em `conflito`.
  if (estrutural !== null) {
    return { ...base, conflito, efetiva: estrutural, origem: ORIGEM_TOPOLOGIA.ESTRUTURAL_MICROS,
      estado: ESTADO_DADO.DISPONIVEL, fonte: FONTE.ARRANJO, tipo: 'micro' }
  }

  // ── Regra 2 · topologia declarada pelo projetista ─────────────────────────
  if (declarada !== null) {
    return { ...base, conflito: false, efetiva: declarada, origem: ORIGEM_TOPOLOGIA.DECLARADA,
      estado: ESTADO_DADO.DISPONIVEL, fonte: FONTE.ARRANJO,
      tipo: declarada === 'micro' ? 'micro' : (mppts.length > 0 ? 'string' : null) }
  }

  // ── Regra 3 · LEGADO, só quando atribuível E sem estrutura própria ────────
  // `mppts[]` do próprio arranjo não CLASSIFICA, mas é dado do arranjo e tem
  // precedência de FONTE sobre a topologia do projeto: ler o legado quando o
  // arranjo tem estrutura própria seria preferir o projeto ao arranjo, que é o
  // contrário da direção desta migração.
  if (mppts.length === 0 && legado.length > 0) {
    if (multiarranjo) {
      // A topologia do projeto é UMA e há vários arranjos: não tem dono.
      // Escolher um seria o `[0]` implícito que este módulo existe para remover.
      return { ...base, conflito: false, efetiva: null, origem: ORIGEM_TOPOLOGIA.AUSENTE,
        estado: ESTADO_DADO.AMBIGUO, fonte: FONTE.LEGACY_TOPOLOGIA, tipo: 'string' }
    }
    return { ...base, conflito: false, efetiva: 'string', origem: ORIGEM_TOPOLOGIA.LEGADO,
      estado: ESTADO_DADO.DISPONIVEL, fonte: FONTE.LEGACY_TOPOLOGIA, tipo: 'string',
      mppts: legado }
  }

  // ── Regra 4 · ausência ────────────────────────────────────────────────────
  // Sem estrutura, sem declaração e sem legado atribuível. A heurística existe
  // e está exposta, mas não preenche `efetiva`: inferir aqui seria fabricar.
  return { ...base, conflito: false, efetiva: null, origem: ORIGEM_TOPOLOGIA.AUSENTE,
    estado: mppts.length > 0 ? ESTADO_DADO.DISPONIVEL : ESTADO_DADO.AUSENTE,
    fonte: mppts.length > 0 ? FONTE.ARRANJO : FONTE.AUSENTE,
    tipo: mppts.length > 0 ? 'string' : null }
}

/**
 * Classificação do PROJETO, derivada dos arranjos — nunca de `[0]`.
 *
 * Unânime entre as classificações conhecidas → esse valor. Valores `null` não
 * contam como discordância: desconhecido não é divergência. Se duas
 * classificações conhecidas diferem, não se escolhe uma: `efetiva` fica `null`
 * e `origem` diz `divergente`, para que quem consome saiba que havia mais de
 * uma resposta em vez de receber a primeira.
 */
export function topologiaDoProjeto(canonico) {
  const arranjos = _lista(canonico?.arranjos)
  const conhecidas = [...new Set(arranjos.map((a) => a.topologia.efetiva).filter((v) => v !== null))]
  const conflito = arranjos.some((a) => a.topologia.conflito)
  const ambiguo = arranjos.some((a) => a.topologia.estado === ESTADO_DADO.AMBIGUO)

  if (conhecidas.length === 1) {
    return { efetiva: conhecidas[0], origem: ORIGEM_PROJETO.UNANIME, conflito, ambiguo, valores: conhecidas }
  }
  if (conhecidas.length > 1) {
    return { efetiva: null, origem: ORIGEM_PROJETO.DIVERGENTE, conflito, ambiguo, valores: conhecidas }
  }
  return { efetiva: null, origem: ORIGEM_PROJETO.AUSENTE, conflito, ambiguo, valores: [] }
}

/**
 * Representação canônica dos arranjos de um projeto.
 *
 * @param {object} projeto ProjetoFV (documento ou POJO).
 * @param {object} [opts] repassado a `obterTopologiaProjeto` (`instalacao`, `catalogo`).
 * @returns {{
 *   estado: string, origem: string, multiarranjo: boolean,
 *   arranjos: Array, totais: object, fontes: object, avisos: string[]
 * }}
 */
export function arranjosCanonicos(projeto, opts = {}) {
  const { origem, arranjos_normalizados, totais } = obterTopologiaProjeto(projeto, opts)
  const lista = _lista(arranjos_normalizados)
  const multiarranjo = lista.length > 1
  const estado = lista.length === 0 ? ESTADO_PROJETO.SEM_ARRANJOS
    : multiarranjo ? ESTADO_PROJETO.MULTIARRANJO : ESTADO_PROJETO.ARRANJO_UNICO

  const principais = principaisDoProjeto(lista)
  const avisos = []
  if (principais.length > 1) avisos.push('MAIS_DE_UM_PRINCIPAL')
  if (multiarranjo && _lista(projeto?.engenharia_eletrica?.arranjo?.mppts).length > 0) {
    avisos.push('TOPOLOGIA_DE_PROJETO_NAO_ATRIBUIVEL')
  }

  const arranjos = lista.map((a, i) => {
    const inversor = resolverInversores(a, projeto, multiarranjo)
    const topologia = resolverTopologia(a, projeto, multiarranjo)
    const modulos = _lista(a?.paineis).map((p) => ({
      equipamento_id: p?.equipamento_id ?? null,
      fabricante: p?.fabricante ?? p?.marca ?? null,
      modelo: p?.modelo ?? null,
      potencia_w: _num(p?.potencia_w),
      quantidade: _num(p?.quantidade),
    }))
    return {
      id: a?.id ?? null,
      // `ordem` é POSIÇÃO e existe só para exibir na mesma sequência da tela.
      // Identidade é `id` (F13). Nenhum consumidor deve casar arranjos por aqui.
      ordem: i,
      rotulo: a?.rotulo ?? null,
      tipo: a?.tipo ?? null,
      principal: a?.tipo === 'principal',
      somente_leitura: !!a?.somente_leitura,
      modulos: {
        estado: modulos.length > 0 ? ESTADO_DADO.DISPONIVEL : ESTADO_DADO.AUSENTE,
        fonte: modulos.length > 0 ? FONTE.ARRANJO : FONTE.AUSENTE,
        itens: modulos,
        total: _num(a?.dimensionamento?.n_modulos) ?? 0,
      },
      inversor,
      topologia,
      // Derivadas — `null` quando incompleta (F12). Nunca zero de conveniência.
      potencia: {
        cc_kwp: _num(a?.potencia_kwp),
        ca_kw: _num(a?.potencia_inversor_kw),
      },
    }
  })

  const resultado = {
    estado,
    origem,
    multiarranjo,
    arranjos,
    /** Agregados DERIVADOS — de `calcularTotaisProjeto`, nunca uma segunda fonte. */
    totais,
    fontes: {
      topologia: [...new Set(arranjos.map((a) => a.topologia.fonte).filter(Boolean))],
      inversor: [...new Set(arranjos.map((a) => a.inversor.fonte).filter(Boolean))],
    },
    avisos,
  }
  // Derivada dos arranjos já montados — por isso depois deles, e nunca de `[0]`.
  resultado.topologiaProjeto = topologiaDoProjeto(resultado)
  return resultado
}

/**
 * Arranjo por IDENTIDADE. Substitui `find(principal) ?? arranjos[0]` nos
 * consumidores que precisam de um arranjo específico — quando migrarem.
 * `null` se não existir; nunca devolve "o primeiro" como consolo.
 */
export function arranjoPorId(canonico, id) {
  if (!id) return null
  return canonico?.arranjos?.find((a) => a.id === id) ?? null
}

/**
 * O arranjo `principal`, quando há EXATAMENTE um.
 *
 * Devolve `null` quando há zero ou mais de um — em vez de escolher. Um
 * consumidor que receba `null` precisa decidir o que fazer, que é o
 * comportamento correto; `find()` devolvia o primeiro e escondia o problema.
 */
export function arranjoPrincipalUnico(canonico) {
  const p = _lista(canonico?.arranjos).filter((a) => a.principal)
  return p.length === 1 ? p[0] : null
}

export default arranjosCanonicos
