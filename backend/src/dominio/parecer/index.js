/**
 * parecer/ — Parecer de Acesso — FV-DOM-042.
 *
 * Implementa o contrato de `FV-CONTRATO-PARECER-ACESSO.md` (FV-UX-042) com as
 * sete decisões tomadas nesta sprint. Domínio PURO: sem Mongoose, sem Express,
 * sem I/O, sem provedor externo.
 *
 *     DOCUMENTO → EXTRAÇÃO → NORMALIZAÇÃO → DADOS CANÔNICOS → DECISÃO → FLUXO
 *
 * Este módulo cobre NORMALIZAÇÃO, VALIDAÇÃO e a decisão de CONFLITO. Não extrai
 * (não é o meio) e não grava (não é o destino).
 *
 * ── As decisões, e onde cada uma aparece ────────────────────────────────────
 *   D1  o parecer tem identidade: `numero_parecer` + `emitido_em`, e um ESTADO
 *       que distingue documento extraído de parecer emitido → `ESTADOS_PARECER`
 *   D2  pertence a um ProjetoFV existente — este módulo nunca cria nada, e a
 *       vinculação exige confirmação humana → `confirmado_pelo_usuario`
 *   D3  `GD I` não entra no enum: vira LACUNA declarada → `normalizarModalidadeGD`
 *   D4  nada é sobrescrito em silêncio: divergência vira conflito declarado
 *       → `compararComCanonico`
 *   D5  nenhum provedor externo é chamado nem descoberto aqui; `metodo` é
 *       declarado por quem chama → `METODOS_EXTRACAO`
 *   D6  nenhuma coleta para treino em lugar nenhum deste módulo
 *   D7  envelope PRÓPRIO (`parecer_extracao`), irmão de `fatura_extracao`,
 *       nunca o mesmo campo → `envelopeVazio`
 */

/** Métodos de extração aceitos. `manual` é o único que não depende de provedor. */
export const METODOS_EXTRACAO = Object.freeze(['manual', 'pdf_parse', 'llm_externo'])

/**
 * Estado do parecer — D1.
 *
 * A sprint pediu distinguir "documento extraído" de "parecer efetivamente
 * emitido". São coisas diferentes: o operador pode anexar o PDF e conferir os
 * dados sem que a concessionária tenha emitido parecer favorável.
 *
 *   extraido    o documento foi lido; os dados são CANDIDATOS
 *   confirmado  um humano conferiu; os dados podem alimentar o fluxo
 *
 * NÃO existe estado de deferimento/indeferimento aqui: a FV-UX-040 mediu que o
 * "parecer de acesso" como etapa do processo não tem regra definida, e inventá-la
 * seria decidir por negócio. O que esta sprint modela é o DOCUMENTO.
 */
export const ESTADOS_PARECER = Object.freeze(['extraido', 'confirmado'])

export const MOTIVOS_PARECER = Object.freeze({
  SEM_IDENTIFICACAO_CLIENTE: 'SEM_IDENTIFICACAO_CLIENTE',
  SEM_GERACAO: 'SEM_GERACAO',
  METODO_INVALIDO: 'METODO_INVALIDO',
  EXTRACAO_INVALIDA: 'EXTRACAO_INVALIDA',
  SEM_EXTRACAO: 'SEM_EXTRACAO',
  JA_CONFIRMADO: 'JA_CONFIRMADO',
  PROVEDOR_NAO_CONFIGURADO: 'PROVEDOR_NAO_CONFIGURADO',
})

export class ErroParecer extends Error {
  constructor(motivo, mensagem) {
    super(mensagem)
    this.name = 'ErroParecer'
    this.codigo = motivo
    this.status = motivo === MOTIVOS_PARECER.JA_CONFIRMADO ? 409
      : motivo === MOTIVOS_PARECER.PROVEDOR_NAO_CONFIGURADO ? 501
      : 400
  }
}

// ─── Normalização ────────────────────────────────────────────────────────────

const texto = (v) => {
  const s = typeof v === 'string' ? v.trim() : (v === 0 ? '0' : '')
  return s === '' ? null : s
}
const numero = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const data = (v) => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}
/** Inteiro positivo, ou `null`. Zero e negativo NÃO são quantidade. */
const quantidade = (v) => {
  const n = numero(v)
  return n !== null && Number.isInteger(n) && n > 0 ? n : null
}

/** Vocabulários — citados da fonte, não escolhidos aqui. */
export const TIPOS_LIGACAO = Object.freeze(['Monofásico', 'Bifásico', 'Trifásico'])
export const TENSOES_V = Object.freeze([127, 220, 380])
export const GRUPOS_TARIFARIOS = Object.freeze(['A', 'B'])
/** `unidades_consumidoras[].regra` aceita SÓ estes. `GD I` fica de fora — D3. */
export const MODALIDADES_GD_ACEITAS = Object.freeze(['GD II', 'GD III'])

/**
 * Modalidade de GD — D3.
 *
 * O enum do schema aceita só `GD II` e `GD III`. Um parecer que declare `GD I`
 * é um fato do documento, não um erro do operador: o valor é PRESERVADO no
 * envelope e a lacuna é declarada, para que ninguém o converta em `GD II` só
 * porque cabe. Ampliar o enum é decisão de negócio, e não foi tomada.
 */
export function normalizarModalidadeGD(bruto) {
  const v = texto(bruto)
  if (v === null) return { valor: null, aceita_pelo_dominio: false, lacuna: null }
  const aceita = MODALIDADES_GD_ACEITAS.includes(v)
  return {
    valor: v,
    aceita_pelo_dominio: aceita,
    lacuna: aceita ? null
      : `modalidade "${v}" fora do vocabulário do domínio (${MODALIDADES_GD_ACEITAS.join(', ')})`,
  }
}

/** Um item de geração — módulo ou inversor. Quantidade é obrigatória na forma. */
function normalizarItem(bruto, { potencia }) {
  const marca = texto(bruto?.marca ?? bruto?.fabricante)
  const modelo = texto(bruto?.modelo)
  if (marca === null && modelo === null) return null
  return {
    marca,
    modelo,
    [potencia]: numero(bruto?.[potencia]),
    quantidade: quantidade(bruto?.quantidade),
    // Preenchido só com match real de catálogo, por quem tem acesso a ele.
    equipamento_id: bruto?.equipamento_id ?? null,
  }
}

/**
 * Normaliza a extração bruta para a forma canônica do contrato.
 *
 * PURO e sem default: campo ausente vira `null`. O extrator legado preenchia
 * seis campos com valor plausível (`|| 'Monofásico'`, `|| 220`, `|| 'GD II'`,
 * `|| 0` três vezes) — é exatamente isso que não acontece aqui.
 *
 * Aceita tanto a forma do contrato quanto a forma do extrator legado
 * (`instalacao`, `equipamento.paineis` objeto único), para que um dado já
 * extraído possa ser normalizado sem passar de novo pelo documento.
 */
export function normalizarExtracao(bruto = {}) {
  const uc = bruto.uc ?? bruto.instalacao ?? {}
  const ger = bruto.geracao ?? bruto.equipamento ?? {}
  const rede = bruto.rede ?? {}

  // Módulos e inversores são LISTA — a forma que `composicaoDoProjeto` consome.
  const listar = (v, potencia, qtdLegado) => {
    if (Array.isArray(v)) return v.map((x) => normalizarItem(x, { potencia })).filter(Boolean)
    if (v && typeof v === 'object') {
      const item = normalizarItem({ ...v, quantidade: v.quantidade ?? qtdLegado }, { potencia })
      return item ? [item] : []
    }
    return []
  }

  const gd = normalizarModalidadeGD(uc.modalidade_gd ?? uc.gd_tier)

  return {
    documento: {
      numero_parecer: texto(uc.numero_parecer ?? bruto.numero_parecer),
      numero_contrato: texto(uc.numero_contrato ?? bruto.numero_contrato),
      emitido_em: data(bruto.emitido_em ?? uc.emitido_em),
      distribuidora: texto(uc.distribuidora ?? bruto.distribuidora),
    },
    cliente: {
      nome: texto(bruto.cliente?.nome),
      cpf_cnpj: texto(bruto.cliente?.cpf_cnpj),
      // Nunca sintetizado. Ausente é ausente.
      email: texto(bruto.cliente?.email),
      endereco: texto(bruto.cliente?.endereco),
    },
    uc: {
      numero_cliente: texto(uc.numero_cliente),
      tipo_ligacao: texto(uc.tipo_ligacao ?? uc.fase_tensao),
      tensao_v: numero(uc.tensao_v ?? uc.voltagem),
      grupo_tarifario: texto(uc.grupo_tarifario ?? rede.grupo_tarifario),
      modalidade_gd: gd.valor,
      modalidade_gd_aceita: gd.aceita_pelo_dominio,
      potencia_contratada_kw: numero(uc.potencia_contratada_kw ?? rede.potencia_contratada_kw),
    },
    geracao: {
      modulos: listar(ger.modulos ?? ger.paineis, 'potencia_w', ger.quantidade_paineis),
      inversores: listar(ger.inversores ?? ger.inversor, 'potencia_kw', null),
      potencia_instalada_kwp: numero(ger.potencia_instalada_kwp),
    },
  }
}

// ─── Validação ───────────────────────────────────────────────────────────────

const RE_CPF = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/
const RE_CNPJ = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/

/**
 * Valida a extração normalizada. PURO — não lança, não escreve.
 *
 * Três níveis, como no contrato:
 *   impeditivos  não há o que oferecer à confirmação
 *   bloqueios    há dado, mas precisa de correção humana antes de confirmar
 *   lacunas      campos ausentes, nomeados; não impedem nada
 *
 * NÃO calcula "taxa de completude": o contrato descartou esse número — importa
 * QUAIS campos faltam, não quantos.
 */
export function validarExtracao(dados) {
  const impeditivos = []
  const bloqueios = []
  const lacunas = []

  // ── Impeditivos ───────────────────────────────────────────────────────────
  if (!dados?.cliente?.cpf_cnpj && !dados?.uc?.numero_cliente) {
    impeditivos.push('Sem identificação do cliente: nem CPF/CNPJ, nem número de cliente.')
  }
  const modulos = dados?.geracao?.modulos ?? []
  const inversores = dados?.geracao?.inversores ?? []
  if (modulos.length === 0 && inversores.length === 0) {
    impeditivos.push('Sem geração: nenhum módulo e nenhum inversor no documento.')
  }

  // ── Bloqueios ─────────────────────────────────────────────────────────────
  const doc = dados?.cliente?.cpf_cnpj
  if (doc && !RE_CPF.test(doc) && !RE_CNPJ.test(doc)) {
    bloqueios.push(`CPF/CNPJ com formato não reconhecido: "${doc}".`)
  }
  const tensao = dados?.uc?.tensao_v
  if (tensao !== null && tensao !== undefined && !TENSOES_V.includes(tensao)) {
    bloqueios.push(`Tensão fora de ${TENSOES_V.join('/')} V: ${tensao}.`)
  }
  const ligacao = dados?.uc?.tipo_ligacao
  if (ligacao && !TIPOS_LIGACAO.includes(ligacao)) {
    bloqueios.push(`Tipo de ligação fora do vocabulário: "${ligacao}".`)
  }
  const grupo = dados?.uc?.grupo_tarifario
  if (grupo && !GRUPOS_TARIFARIOS.includes(grupo)) {
    bloqueios.push(`Grupo tarifário fora de ${GRUPOS_TARIFARIOS.join('/')}: "${grupo}".`)
  }
  for (const [rot, lista] of [['módulo', modulos], ['inversor', inversores]]) {
    for (const item of lista) {
      if (item.quantidade === null) {
        bloqueios.push(`Quantidade ausente ou inválida no ${rot} `
          + `"${[item.marca, item.modelo].filter(Boolean).join(' ')}".`)
      }
    }
  }

  // Coerência interna: potência declarada × potência somada dos módulos.
  //
  // F12: a soma era `(m.potencia_w ?? 0) * (m.quantidade ?? 0)`. Um módulo sem
  // `potencia_w` entrava valendo zero, e a comparação passava a confrontar a
  // potência declarada contra uma soma PARCIAL — produzindo divergência falsa
  // (ou, se todos faltassem, `somada = 0` e a checagem era pulada em silêncio).
  // Agora a incompletude é dita: não dá para afirmar coerência sem a potência.
  const declarada = dados?.geracao?.potencia_instalada_kwp
  const incompleto = modulos.find((m) => {
    const w = Number(m?.potencia_w)
    return !Number.isFinite(w) || w <= 0
  })
  if (incompleto) {
    bloqueios.push('Potência do módulo ausente em '
      + `"${[incompleto.marca, incompleto.modelo].filter(Boolean).join(' ') || 'módulo sem identificação'}"`
      + ' — não é possível conferir a potência declarada contra a soma dos módulos.')
  }
  const somada = incompleto ? null : modulos.reduce((a, m) => a
    + (Number(m.potencia_w) * (m.quantidade ?? 0)), 0) / 1000
  if (declarada !== null && declarada !== undefined && somada !== null && somada > 0) {
    const div = Math.abs(somada - declarada) / declarada
    if (div > 0.01) {
      bloqueios.push(`Potência declarada (${declarada} kWp) diverge da soma dos `
        + `módulos (${somada.toFixed(3)} kWp) em ${(div * 100).toFixed(1)} %.`)
    }
  }

  // ── Lacunas ───────────────────────────────────────────────────────────────
  const nomear = (caminho, valor) => { if (valor === null || valor === undefined) lacunas.push(caminho) }
  nomear('documento.numero_parecer', dados?.documento?.numero_parecer)
  nomear('documento.emitido_em', dados?.documento?.emitido_em)
  nomear('documento.distribuidora', dados?.documento?.distribuidora)
  nomear('cliente.nome', dados?.cliente?.nome)
  nomear('cliente.cpf_cnpj', dados?.cliente?.cpf_cnpj)
  nomear('cliente.email', dados?.cliente?.email)
  nomear('cliente.endereco', dados?.cliente?.endereco)
  nomear('uc.numero_cliente', dados?.uc?.numero_cliente)
  nomear('uc.tipo_ligacao', dados?.uc?.tipo_ligacao)
  nomear('uc.tensao_v', dados?.uc?.tensao_v)
  nomear('uc.grupo_tarifario', dados?.uc?.grupo_tarifario)
  nomear('uc.modalidade_gd', dados?.uc?.modalidade_gd)
  if (modulos.length === 0) lacunas.push('geracao.modulos')
  if (inversores.length === 0) lacunas.push('geracao.inversores')
  // D3 — modalidade presente mas fora do domínio é lacuna, nunca conversão.
  const gd = normalizarModalidadeGD(dados?.uc?.modalidade_gd)
  if (gd.lacuna) lacunas.push(`uc.modalidade_gd: ${gd.lacuna}`)
  // O parecer não informa estrutura — FV-DOM-039 manda declarar, não assumir.
  lacunas.push('equipamentos.estrutura: não informada pelo parecer')

  return {
    aproveitavel: impeditivos.length === 0,
    confirmavel: impeditivos.length === 0 && bloqueios.length === 0,
    impeditivos,
    bloqueios,
    lacunas,
  }
}

// ─── Conflito com o dado canônico — D4 ───────────────────────────────────────

/** Campos que o parecer e o projeto podem afirmar ao mesmo tempo. */
const COMPARAVEIS = Object.freeze([
  ['cliente.nome', (p) => p.cliente?.nome, (c) => c.cliente?.nome],
  ['cliente.cpf_cnpj', (p) => p.cliente?.cpf_cnpj, (c) => c.cliente?.cpf_cnpj],
  ['uc.numero_cliente', (p) => p.uc?.numero_cliente, (c) => c.uc?.numero_cliente],
  ['uc.tipo_ligacao', (p) => p.uc?.tipo_ligacao, (c) => c.uc?.tipo_ligacao],
  ['uc.tensao_v', (p) => p.uc?.tensao_v, (c) => c.uc?.tensao_v],
  ['documento.distribuidora', (p) => p.documento?.distribuidora, (c) => c.concessionaria],
])

/**
 * Compara o parecer com o que o projeto já afirma — D4.
 *
 * NÃO decide, NÃO sobrescreve. Classifica cada campo em:
 *
 *   novo        o projeto não tinha o dado; o parecer tem
 *   igual       os dois dizem a mesma coisa
 *   conflito    os dois dizem coisas diferentes → precisa de humano
 *
 * A regra da sprint é explícita: "nenhum campo deve ser substituído apenas
 * porque o parecer tem valor diferente". Por isso `conflito` é uma saída, não
 * um lado vencedor — e a origem de cada dado permanece rastreável no envelope
 * de cada documento (`parecer_extracao` × `fatura_extracao`).
 */
export function compararComCanonico(parecer, canonico = {}) {
  const novos = []
  const iguais = []
  const conflitos = []

  for (const [campo, doParecer, doCanonico] of COMPARAVEIS) {
    const a = doParecer(parecer ?? {}) ?? null
    const b = doCanonico(canonico ?? {}) ?? null
    if (a === null) continue
    if (b === null || b === '') { novos.push({ campo, parecer: a }); continue }
    // Comparação frouxa só no que é notoriamente formatado de formas diferentes.
    const igual = String(a).trim().toLowerCase() === String(b).trim().toLowerCase()
    if (igual) iguais.push({ campo, valor: a })
    else conflitos.push({ campo, parecer: a, projeto: b })
  }

  return { novos, iguais, conflitos, tem_conflito: conflitos.length > 0 }
}

// ─── Envelope — D7 ───────────────────────────────────────────────────────────

/**
 * Envelope vazio de `parecer_extracao`.
 *
 * Irmão de `fatura_extracao`, nunca o mesmo campo (D7): os dois documentos
 * afirmam sobre os mesmos assuntos, e misturá-los apagaria a ORIGEM de cada
 * afirmação — que é justamente o que D4 exige preservar.
 */
export function envelopeVazio() {
  return {
    arquivo_original_nome: null,
    extraido_em: null,
    metodo: null,
    confianca: null,
    confirmado_pelo_usuario: false,
    confirmado_em: null,
    confirmado_por: null,
    estado: null,
    numero_parecer: null,
    emitido_em: null,
    dados: null,
    validacao: null,
  }
}

/**
 * Monta o envelope a partir de uma extração já feita. PURO.
 *
 * `metodo` é DECLARADO por quem chama — este módulo não descobre provedor nem
 * credencial (D5). `llm_externo` só é aceito quando o chamador comprova que há
 * provedor configurado; sem isso, lança, e o fluxo segue seguro.
 */
export function montarEnvelope({ bruto, metodo, arquivo = null, confianca = null,
  provedorConfigurado = false, agora = new Date() }) {
  if (!METODOS_EXTRACAO.includes(metodo)) {
    throw new ErroParecer(MOTIVOS_PARECER.METODO_INVALIDO,
      `Método de extração inválido: ${metodo ?? 'ausente'}. `
      + `Esperado: ${METODOS_EXTRACAO.join(', ')}.`)
  }
  if (metodo === 'llm_externo' && !provedorConfigurado) {
    throw new ErroParecer(MOTIVOS_PARECER.PROVEDOR_NAO_CONFIGURADO,
      'Extração por provedor externo não está configurada. '
      + 'Nenhum documento foi enviado para fora.')
  }

  const dados = normalizarExtracao(bruto)
  const validacao = validarExtracao(dados)
  if (!validacao.aproveitavel) {
    throw new ErroParecer(MOTIVOS_PARECER.EXTRACAO_INVALIDA, validacao.impeditivos[0])
  }

  return {
    ...envelopeVazio(),
    arquivo_original_nome: arquivo,
    extraido_em: agora,
    metodo,
    confianca: typeof confianca === 'number' ? confianca : null,
    estado: 'extraido',
    numero_parecer: dados.documento.numero_parecer,
    emitido_em: dados.documento.emitido_em,
    dados,
    validacao,
  }
}

/**
 * Confirmação humana — o portão. PURO: devolve o envelope confirmado.
 *
 * Sem esta passagem, os dados do parecer são candidatos e não alimentam nada.
 */
export function confirmar(envelope, { usuario = null, agora = new Date() } = {}) {
  if (!envelope?.estado) {
    throw new ErroParecer(MOTIVOS_PARECER.SEM_EXTRACAO,
      'Não há extração de parecer para confirmar.')
  }
  if (envelope.confirmado_pelo_usuario === true) {
    throw new ErroParecer(MOTIVOS_PARECER.JA_CONFIRMADO,
      'Este parecer já foi confirmado.')
  }
  if (envelope.validacao && envelope.validacao.confirmavel === false) {
    throw new ErroParecer(MOTIVOS_PARECER.EXTRACAO_INVALIDA,
      envelope.validacao.bloqueios?.[0] ?? 'Extração precisa de correção antes da confirmação.')
  }
  return {
    ...envelope,
    confirmado_pelo_usuario: true,
    confirmado_em: agora,
    confirmado_por: usuario,
    estado: 'confirmado',
  }
}
