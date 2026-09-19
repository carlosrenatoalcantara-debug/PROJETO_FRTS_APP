/**
 * adaptarProjeto.js — ProjetoFV → entrada do motor de Unifilar — FV-DOM-007B.
 *
 * O motor (`@fortesolar/fv-shared/engenharia/unifilar-svg`) nasceu dentro do
 * wizard e por isso espera o formato do CONTEXTO do wizard: `painel`, `inversor`,
 * `arranjoMPPTs`, `tipo_ligacao`, `tensao`, `nomeCliente` — tudo camelCase e
 * tudo no topo do objeto.
 *
 * O documento PERSISTIDO tem outra forma: `equipamentos.paineis[]`,
 * `equipamentos.inversor`, `dimensionamento.num_paineis`, `fatura_extracao.
 * tipo_ligacao`… em snake_case e aninhado.
 *
 * ── Por que este arquivo existe ──────────────────────────────────────────────
 * As duas formas nunca foram reconciliadas. A aba legada entrega o documento
 * persistido direto ao motor, e o motor — que não encontra nenhum dos campos que
 * procura — cai nos DEFAULTS internos: módulo de 550 W / 49,5 V, inversor de
 * 5 kW com 1 MPPT, ligação monofásica 220 V, 6 módulos.
 *
 * Ou seja: para um projeto salvo, boa parte do diagrama que hoje é exibido não
 * descreve o projeto. Este adapter é o que corrige isso — e é a única razão pela
 * qual o desenho servido pela API difere do desenho da aba antiga.
 *
 * ── Proveniência (M-3) ───────────────────────────────────────────────────────
 * Cada campo declara de onde veio em `proveniencia`. Campo sem fonte no projeto
 * aparece como `null` ali, e o motor aplica o default DELE. A diferença é que o
 * default deixa de ser invisível: quem chama sabe o que foi assumido.
 *
 * Puro: recebe um objeto (lean ou documento), devolve objeto. Sem I/O.
 */
import { lerModulo } from '@fortesolar/fv-shared/modulos'
// FV-UX-038 (D5): classificador ÚNICO da topologia (FV-DOM-031, decisão 4).
import { classificarTopologiaInversor, TOPOLOGIA } from '@fortesolar/fv-shared/inversores/dicionario'

/** Primeiro valor não-nulo, junto com o rótulo da fonte que o forneceu. */
function primeiro(candidatos) {
  for (const [fonte, valor] of candidatos) {
    if (valor !== null && valor !== undefined && valor !== '') return { valor, fonte }
  }
  return { valor: null, fonte: null }
}

/**
 * Normaliza o arranjo por MPPT persistido para o formato do motor.
 *
 * `engenharia_eletrica.arranjo.mppts[]` guarda CONTAGEM por MPPT
 * (`strings_paralelo`, `modulos_por_string`) — é o resumo derivado que o próprio
 * schema declara manter para compatibilidade com o unifilar. O array `entradas`
 * (topologia real por entrada física) NÃO é usado aqui: o motor desenha por
 * string dentro do MPPT, não por entrada.
 */
export function adaptarMppts(arranjo) {
  const lista = Array.isArray(arranjo?.mppts) ? arranjo.mppts : []
  const uteis = lista
    .filter((m) => Number(m?.strings_paralelo) > 0 && Number(m?.modulos_por_string) > 0)
    .map((m) => ({
      numStrings: Number(m.strings_paralelo),
      modulosPorString: Number(m.modulos_por_string),
    }))
  return uteis.length > 0 ? uteis : null
}

/**
 * Topologia de MICROINVERSORES do arranjo principal — FV-DOM-031C.
 *
 * Lê `arranjos[].configuracao_eletrica.micros[]`, que a FV-DOM-031 (decisão 1)
 * abriu e a etapa de topologia grava. `null` quando o projeto não é micro — e
 * é esse `null` que faz o desenho seguir pelo caminho de strings.
 *
 * Não deriva topologia por heurística de nome: `micros[]` preenchido é o fato.
 */
function adaptarMicros(projeto) {
  const arranjos = Array.isArray(projeto?.arranjos) ? projeto.arranjos : []
  const a = arranjos.find((x) => x?.tipo === 'principal') ?? arranjos[0] ?? null
  return microsDoArranjo(a)
}

/**
 * A mesma leitura, para UM arranjo nomeado — F14-6B.
 *
 * `adaptarMicros` escolhe o arranjo e delega aqui. A composição multiarranjo
 * chama esta função diretamente, uma vez por arranjo, sem escolher nenhum.
 */
export function microsDoArranjo(a) {
  const lista = a?.configuracao_eletrica?.micros
  if (!Array.isArray(lista) || lista.length === 0) return null

  // A potência CA de cada modelo vem do inversor da COMPOSIÇÃO, que é onde o
  // catálogo já foi resolvido (FV-UX-029). Não se relê o catálogo aqui.
  const porId = new Map((a?.inversores ?? [])
    .map((i) => [String(i?.equipamento_id ?? i?.id), Number(i?.potencia_kw)]))

  return lista.map((m) => {
    const p = porId.get(String(m?.equipamento_id))
    return {
      equipamento_id: m?.equipamento_id ?? null,
      marca: m?.marca ?? null,
      modelo: m?.modelo ?? null,
      quantidade: m?.quantidade ?? null,
      entradas_por_micro: m?.entradas_por_micro ?? null,
      modulos_por_entrada: m?.modulos_por_entrada ?? null,
      distribuicao: Array.isArray(m?.distribuicao) ? m.distribuicao : [],
      potencia_kw: Number.isFinite(p) ? p : null,
    }
  })
}

/** Painel do arranjo principal, com os dados elétricos que o catálogo guarda. */
function adaptarPainel(projeto) {
  return adaptarPainelDe(projeto?.equipamentos?.paineis?.[0])
}

/** A mesma tradução, para um painel já escolhido (F14-6B: um por arranjo). */
export function adaptarPainelDe(p) {
  if (!p) return null
  const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
  return {
    // `id` é a chave do catálogo elétrico (Voc/Vmpp/Isc/coef. térmico). Sem ele o
    // motor usa os parâmetros genéricos.
    id: p.id ?? null,
    marca: p.marca ?? p.fabricante ?? null,
    modelo: p.modelo ?? null,
    potenciaW: num(p.potencia_w),
    // FV-DOM-031C: repasse do que o PROJETO já persistiu sobre o módulo. Não é
    // consulta nova nem valor derivado — é o dado que estiver lá, e `null`
    // quando não estiver. O caminho string ignora estes campos (continua lendo
    // o catálogo elétrico por `id`); o caminho micro os usa e, na ausência,
    // declara lacuna em vez de assumir um módulo genérico.
    voc: num(p.voc ?? p.voc_v),
    vmpp: num(p.vmpp ?? p.vmpp_v),
    isc: num(p.isc ?? p.isc_a),
    coef_temp_voc: num(p.coef_temp_voc ?? p.coef_temp_voc_pct_c),
    temp_noct: num(p.temp_noct ?? p.noct_c),
  }
}

/**
 * Inversor do arranjo principal.
 *
 * `equipamentos.inversor` é um subdocumento: existe como objeto vazio mesmo em
 * projeto que nunca escolheu inversor. Testar só a presença do objeto declararia
 * uma proveniência que não existe — por isso exige ao menos um campo com valor.
 */
function adaptarInversor(projeto) {
  const i = projeto?.equipamentos?.inversor
  const vazio = !i || (!i.marca && !i.fabricante && !i.modelo && !i.potencia_kw)
  if (vazio) return null
  const nMpptsArranjo = Number(projeto?.engenharia_eletrica?.arranjo?.num_mppts_usados) || null
  const nMpptsTopologia = Array.isArray(projeto?.engenharia_eletrica?.arranjo?.mppts)
    ? projeto.engenharia_eletrica.arranjo.mppts.length || null
    : null
  return {
    marca: i.marca ?? i.fabricante ?? null,
    modelo: i.modelo ?? null,
    potenciaKW: Number(i.potencia_kw) || null,
    tipo: i.tipo ?? null,
    // INV-03: a contagem de MPPT é do catálogo, não inventada aqui. Na ausência
    // dele, usa a topologia que a engenharia elétrica já confirmou.
    nMppts: nMpptsArranjo ?? nMpptsTopologia,
  }
}

/**
 * Converte um ProjetoFV na entrada que o motor de unifilar espera.
 *
 * @param {object} projeto  documento (lean ou hidratado)
 * @param {object} [opts]
 * @param {string} [opts.nomeCliente]  nome do cliente, quando já resolvido
 * @returns {{ entrada: object, proveniencia: object }}
 */
/**
 * O projeto é de microinversor? Pergunta ao dicionário CANÔNICO.
 *
 * O contrato de `classificarTopologiaInversor(esp, ctx)` é específico: `esp` são
 * as ESPECIFICAÇÕES persistidas (onde `topologia`/`tipo_topologia` é o campo
 * explícito) e `ctx` carrega `{ fabricante, modelo, subtipo }` — é de `ctx` que
 * sai o casamento por nome. Passar `{ tipo, modelo, fabricante }` num objeto só
 * faz tudo classificar como STRING, silenciosamente: foi o que aconteceu na
 * primeira tentativa desta correção, e a validação pegou.
 */
function projetoEhMicro(projeto = {}) {
  const inv = projeto.equipamentos?.inversor
    ?? projeto.arranjos?.[0]?.inversores?.[0]
    ?? projeto.inversor
    ?? {}
  return ehMicroPorEquipamento(inv)
}

/**
 * O EQUIPAMENTO é micro? Mesma pergunta, feita a um inversor nomeado — F14-6B.
 *
 * `projetoEhMicro` escolhe o inversor do projeto e delega aqui. A composição
 * multiarranjo pergunta pelo inversor DE CADA arranjo, sem escolher nenhum.
 */
export function ehMicroPorEquipamento(inv = {}) {
  if (!inv?.modelo && !inv?.marca && !inv?.fabricante && !inv?.tipo) return false
  return classificarTopologiaInversor(
    { topologia: inv.tipo ?? null },
    { fabricante: inv.marca ?? inv.fabricante ?? null,
      modelo: inv.modelo ?? null,
      subtipo: inv.subtipo ?? null },
  ) === TOPOLOGIA.MICRO
}

export function adaptarProjetoParaUnifilar(projeto, { nomeCliente = null, moduloCatalogo = null } = {}) {
  if (!projeto) throw new Error('adaptarProjetoParaUnifilar: projeto ausente')

  const fatura = projeto.fatura_extracao ?? {}
  const dim = projeto.dimensionamento ?? {}
  const arranjo = projeto.engenharia_eletrica?.arranjo ?? null

  const ligacao = primeiro([
    ['fatura_extracao.tipo_ligacao', fatura.tipo_ligacao],
    ['projeto.tipo_ligacao', projeto.tipo_ligacao],
  ])
  const tensao = primeiro([
    ['fatura_extracao.tensao_v', fatura.tensao_v],
    ['projeto.tensao', projeto.tensao],
  ])
  const distribuidora = primeiro([
    ['projeto.distribuidora', projeto.distribuidora],
    ['fatura_extracao.concessionaria', fatura.concessionaria],
  ])
  // A UF decide Tmin/Tmax de projeto, e Tmin decide a Voc_max da string — é o
  // campo com maior efeito elétrico deste adapter. `estado` vive dentro de
  // `localizacao` (não na raiz, apesar de o wizard mandá-lo solto e o
  // strict-mode descartá-lo); `clima_utilizado.uf` é o que a engenharia elétrica
  // efetivamente usou na análise, então tem precedência.
  const uf = primeiro([
    ['engenharia_eletrica.clima_utilizado.uf', projeto.engenharia_eletrica?.clima_utilizado?.uf],
    ['localizacao.estado', projeto.localizacao?.estado],
    ['localizacao.uf', projeto.localizacao?.uf],
  ])
  const cliente = primeiro([
    ['opts.nomeCliente', nomeCliente],
    ['clienteId.nome', projeto.clienteId?.nome],
  ])

  const painel = adaptarPainel(projeto)
  const inversor = adaptarInversor(projeto)
  const arranjoMPPTs = adaptarMppts(arranjo)
  const micros = adaptarMicros(projeto)
  /**
   * FV-UX-038 (D5) — a topologia segue o EQUIPAMENTO, não o preenchimento.
   *
   * Antes, `micros[]` preenchido era a única forma de chegar ao motor micro. A
   * FV-UX-037 mediu a consequência: um projeto com Hoymiles HMS-2000-4T cuja
   * etapa de topologia ainda não fora feita caía no motor de STRING, recebia a
   * lacuna `arranjoMPPTs` — MPPT que aquele sistema não tem — e era desenhado
   * com valores padrão de MPPT. A tela dizia "o motor usou valores padrão", o
   * que era verdade e por isso mesmo grave.
   *
   * `micros[]` continua sendo o FATO da configuração; o que ele deixa de ser é
   * a única forma de saber que o projeto é micro. Quem classifica é o
   * dicionário canônico (`classificarTopologiaInversor`, FV-DOM-031 decisão 4)
   * — o mesmo de toda a aplicação, sem heurística nova aqui.
   *
   * Sem `micros[]`, o motor micro NÃO inventa: declara `configuracao_eletrica.
   * micros` como lacuna e deixa os campos em branco. É melhor que desenhar um
   * MPPT inexistente.
   */
  const topologia = (micros || projetoEhMicro(projeto)) ? 'micro' : 'string'

  const entrada = {
    nome: projeto.nome ?? 'Projeto FV',
    nomeCliente: cliente.valor ?? 'Cliente',
    // FV-DOM-031C: a topologia decide QUAL motor desenha. Ela não é adivinhada
    // aqui — vem de `micros[]` estar preenchido, que é o que a etapa de
    // topologia grava (FV-DOM-031, decisão 1).
    topologia,
    painel,
    inversor,
    arranjoMPPTs,
    micros,
    /**
     * FV-DOM-031D (item 2) — parâmetros elétricos do módulo lidos pela SSOT
     * (`fv-shared/modulos`) a partir do `Equipamento` do catálogo.
     *
     * Campo SEPARADO de propósito. Injetá-los em `painel` mudaria os números de
     * TODO projeto string: `montarModeloEletrico` fecha cada leitura com
     * `catEletrico?.voc || painel?.voc || 49.5`, e hoje `painel.voc` é undefined
     * em todo projeto do fluxo canônico — ou seja, o caminho string usa 49,5 /
     * 41,2 / 13,9 há tempo. Corrigir isso é decisão de outra sprint; aqui o
     * campo novo é consumido SÓ pelo caminho micro.
     */
    painelMicro: moduloCatalogo ? lerModulo(moduloCatalogo) : null,
    estrutura: projeto.equipamentos?.estrutura?.tipo || null,
    // O motor lê `numPaineis`/`numStrings`/`potenciaArredondada` (camelCase do
    // wizard); o documento guarda snake_case. Sem esta tradução o motor usaria
    // 6 módulos e 5 kW em qualquer projeto.
    dimensionamento: {
      numPaineis: Number(dim.num_paineis) || null,
      numStrings: Number(dim.num_strings) || null,
      numInversores: Number(dim.num_inversores) || null,
      potenciaArredondada: Number(dim.potencia_kwp) || null,
    },
    tipo_ligacao: ligacao.valor ?? 'monofasico',
    tensao: tensao.valor != null ? String(tensao.valor) : '220',
    distribuidora: distribuidora.valor ?? 'CONCESSIONÁRIA',
    uf: uf.valor ?? null,
  }

  /**
   * FV-DOM-031C (item 3) — a proveniência do ARRANJO depende da topologia.
   *
   * Antes, todo projeto declarava `arranjoMPPTs` e um projeto de micro saía
   * com essa lacuna para sempre: o operador era mandado preencher uma topologia
   * de strings que aquele sistema não tem e nunca terá. Agora cada topologia
   * declara o que de fato exige:
   *
   *   STRING → `engenharia_eletrica.arranjo.mppts`
   *   MICRO  → `arranjos[].configuracao_eletrica.micros`
   *
   * A chave também muda de nome, para que nenhum consumidor confunda as duas.
   */
  const proveniencia = {
    painel: painel ? 'equipamentos.paineis[0]' : null,
    inversor: inversor ? 'equipamentos.inversor' : null,
    ...(topologia === 'micro'
      ? { topologiaMicro: micros ? 'arranjos[].configuracao_eletrica.micros' : null }
      : { arranjoMPPTs: arranjoMPPTs ? 'engenharia_eletrica.arranjo.mppts' : null }),
    dimensionamento: dim.num_paineis != null ? 'dimensionamento' : null,
    tipo_ligacao: ligacao.fonte,
    tensao: tensao.fonte,
    distribuidora: distribuidora.fonte,
    uf: uf.fonte,
    nomeCliente: cliente.fonte,
  }

  return { entrada, proveniencia }
}

/**
 * Campos que o projeto não forneceu — o motor usará o default dele.
 * Serve para a UX avisar em vez de exibir um número inventado como se fosse dado.
 */
export function lacunasDaProveniencia(proveniencia) {
  return Object.entries(proveniencia)
    .filter(([, fonte]) => fonte === null)
    .map(([campo]) => campo)
}
