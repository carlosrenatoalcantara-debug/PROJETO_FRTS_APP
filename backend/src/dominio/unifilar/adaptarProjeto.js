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
function adaptarMppts(arranjo) {
  const lista = Array.isArray(arranjo?.mppts) ? arranjo.mppts : []
  const uteis = lista
    .filter((m) => Number(m?.strings_paralelo) > 0 && Number(m?.modulos_por_string) > 0)
    .map((m) => ({
      numStrings: Number(m.strings_paralelo),
      modulosPorString: Number(m.modulos_por_string),
    }))
  return uteis.length > 0 ? uteis : null
}

/** Painel do arranjo principal, com os dados elétricos que o catálogo guarda. */
function adaptarPainel(projeto) {
  const p = projeto?.equipamentos?.paineis?.[0]
  if (!p) return null
  return {
    // `id` é a chave do catálogo elétrico (Voc/Vmpp/Isc/coef. térmico). Sem ele o
    // motor usa os parâmetros genéricos.
    id: p.id ?? null,
    marca: p.marca ?? p.fabricante ?? null,
    modelo: p.modelo ?? null,
    potenciaW: Number(p.potencia_w) || null,
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
export function adaptarProjetoParaUnifilar(projeto, { nomeCliente = null } = {}) {
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

  const entrada = {
    nome: projeto.nome ?? 'Projeto FV',
    nomeCliente: cliente.valor ?? 'Cliente',
    painel,
    inversor,
    arranjoMPPTs,
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

  const proveniencia = {
    painel: painel ? 'equipamentos.paineis[0]' : null,
    inversor: inversor ? 'equipamentos.inversor' : null,
    arranjoMPPTs: arranjoMPPTs ? 'engenharia_eletrica.arranjo.mppts' : null,
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
