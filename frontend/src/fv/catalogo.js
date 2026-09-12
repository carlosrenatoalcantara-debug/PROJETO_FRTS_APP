/**
 * catalogo.js — catálogo canônico → subdocumento `equipamentos` — FV-UX-019.
 *
 * O `Equipamento` do Mongo é a fonte. Este módulo NÃO é um segundo catálogo:
 * não guarda modelo nenhum, não conhece nenhum fabricante, não completa dado
 * ausente. Ele só traduz o documento que o servidor devolveu para a forma que o
 * schema de `ProjetoFV.equipamentos` já exige — a mesma que o wizard grava.
 *
 * ── Por que a tradução existe ────────────────────────────────────────────────
 * `Equipamento.especificacoes` é Mixed: a potência de um módulo aparece como
 * `potencia`, `potencia_w` ou `potenciaW` conforme a origem do registro
 * (datasheet, planilha, importação). A precedência abaixo é a MESMA que o
 * adapter do wizard já usa — não é uma regra nova, é a leitura de sempre.
 *
 * ── A diferença em relação ao adapter do wizard ──────────────────────────────
 * `catalogoEngenhariaAdapter.js` fecha cada leitura com um default: `?? 0` para
 * potência, `?? 1` para fases e MPPTs, `?? 12`/`?? 25` para garantias. Isso
 * serve à tela de seleção do wizard, que precisa exibir algo. Aqui não serve:
 * o valor gravado no projeto vira entrada do motor elétrico, e um `0` fabricado
 * é indistinguível de um dado real. Ausente é `null`, sempre.
 *
 * ── Referência e cópia ───────────────────────────────────────────────────────
 * `equipamento_id` é o vínculo com o catálogo — a fonte. Os campos ao lado
 * (`marca`, `modelo`, `potencia_w`) são a cópia que o schema já mantinha e que
 * os leitores — adapter do unifilar em primeiro lugar — consultam diretamente.
 * Gravar só a referência deixaria o unifilar sem potência de módulo, e ele
 * cairia no default interno de 550 W sem avisar ninguém.
 *
 * Puro: sem React, sem I/O.
 */
import { tecnologiaInversor } from '@fortesolar/fv-shared/engenharia/regras-plausibilidade'
import { lerModulo, potenciaDoModulo } from '@fortesolar/fv-shared/modulos'
import { lerInversor } from '@fortesolar/fv-shared/inversores'
// Sprint E3 — cadastro contraditório não alimenta cálculo.
import { detectarConflitos, valorConfiavel } from '@fortesolar/fv-shared/inversores/conflitos'

/** Número finito ou `null`. Nunca 0 por omissão, nunca NaN. */
const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Primeira chave presente, na precedência do adapter de engenharia. */
function primeiroNumero(obj, chaves) {
  for (const k of chaves) {
    const v = num(obj?.[k])
    if (v !== null) return v
  }
  return null
}

/**
 * Potência do módulo (W) — como o catálogo a declarar, sem completar.
 * FV-DOM-031D: a lista de aliases MUDOU DE LUGAR para `fv-shared/modulos`, para
 * que o backend (unifilar de micro) leia o módulo pela mesma fonte. Mesmos
 * aliases, mesma ordem — reexportado aqui para não quebrar os importadores.
 */
export { potenciaDoModulo }

// ─── Inversor: leitura pela SSOT (A5b — FV-UX-028) ───────────────────────────
//
// Antes, cada função abaixo tinha a sua própria lista de aliases. Era um leitor
// PARALELO ao dicionário canônico `fv-shared/inversores`, e perdia dois aliases
// que o SSOT reconhece: `nMppts` e `num_mppt`. Um inversor cadastrado com
// qualquer um dos dois chegava à tela sem contagem de MPPT, e a etapa de
// topologia não inicializava.
//
// `lerInversor` devolve todos os campos canônicos, com `null` onde o catálogo
// não declarou. `paraDimensionamento` NÃO é usado: quando esta leitura foi
// escrita (FV-UX-028) ele fechava tudo com `?? 2`, `?? 600`, `?? 100`, `?? 550`
// e `?? 13` — limites de segurança fabricados. A FV-DOM-029 os removeu, mas a
// leitura direta pelo dicionário continua sendo a certa aqui: é o SSOT, sem a
// camada de projeção que o dimensionamento legado precisa.

/** Leitura canônica do inversor. `null` continua `null`. */
function canonico(equipamento) {
  if (!equipamento) return null
  return lerInversor(equipamento.especificacoes ?? {}, {
    fabricante: equipamento.fabricante,
    modelo: equipamento.modelo,
    subtipo: equipamento.especificacoes?.subtipo,
  })
}

/**
 * Potência CA do inversor (kW).
 *
 * Sprint E3: quando o cadastro é CONTRADITÓRIO sobre a potência — máximo menor
 * que o nominal, ou escala trocada entre W e kW — nenhum dos dois valores é
 * eleito, e a leitura devolve `null`. Escolher em silêncio é o que o §3 proíbe;
 * `detectarConflitos` diz qual é a contradição para a tela mostrar.
 */
export function potenciaDoInversor(equipamento) {
  return num(valorConfiavel(equipamento, 'potencia_kw'))
}

/** Fases de saída. `null` quando o catálogo não declara — não se infere aqui. */
export function fasesDoInversor(equipamento) {
  return num(canonico(equipamento)?.fases)
}

/**
 * Tecnologia do inversor (`string`, `micro`, `hibrido`, `otimizador`).
 *
 * Vem de `tecnologiaInversor`, a regra ÚNICA do domínio compartilhado — a mesma
 * que o catálogo do wizard consulta. Classificar aqui por conta própria criaria
 * a segunda opinião que a FV-DOM-008 já custou caro em outro lugar.
 *
 * O motor do unifilar distingue micro de string no desenho; deixar o campo
 * vazio faria um microinversor ser desenhado como inversor central.
 */
export function tipoDoInversor(equipamento) {
  const c = canonico(equipamento)
  const tec = tecnologiaInversor({
    fabricante: equipamento?.fabricante,
    modelo: equipamento?.modelo,
    voc_max_dc_v: num(c?.tensao_max_entrada),
    potencia_kw_ca: num(c?.potencia_kw),
    n_mppts: num(c?.n_mppts),
  })
  if (!tec) return null
  return tec === 'microinversor' ? 'micro' : tec
}

/** Rótulo de lista. Sem potência declarada, diz isso — não inventa um número. */
export function rotuloDoEquipamento(equipamento, potencia, unidade) {
  const nome = [equipamento?.fabricante, equipamento?.modelo].filter(Boolean).join(' ') || 'sem identificação'
  return potencia === null ? `${nome} — potência não informada` : `${nome} — ${potencia} ${unidade}`
}

/** Rótulos das tecnologias que `tecnologiaInversor` devolve. Lista fechada. */
export const TECNOLOGIAS_INVERSOR = Object.freeze([
  ['string', 'String'],
  ['micro', 'Microinversor'],
  ['hibrido', 'Híbrido'],
  ['otimizador', 'Otimizador'],
])

/** Rótulo da fase a partir do número de fases. `null` não vira "monofásico". */
export function rotuloDaFase(fases) {
  if (fases === 1) return 'Monofásico'
  if (fases === 2) return 'Bifásico'
  if (fases === 3) return 'Trifásico'
  return null
}

/**
 * Rótulo do inversor no seletor — A3 (FV-UX-028).
 *
 * Antes só havia `Fabricante Modelo — kW`, com string, micro, híbrido e
 * otimizador na mesma lista plana. A auditoria FV-UX-027 mostrou 50 opções em
 * que não dava para distinguir um trifásico de 25 kW de um micro de 400 W.
 *
 * Cada dado ausente vira `—`; nada é completado.
 */
export function rotuloDoInversor(equipamento) {
  const nome = [equipamento?.fabricante, equipamento?.modelo].filter(Boolean).join(' ') || 'sem identificação'
  const e = eletricoDoInversor(equipamento)
  const ou = (v, sufixo = '') => (v === null || v === undefined ? '—' : `${v}${sufixo}`)
  const partes = [
    ou(e?.potencia_ca_kw, ' kW'),
    rotuloDaFase(fasesDoInversor(equipamento)) ?? '—',
    `${ou(nMpptsDoInversor(equipamento))} MPPT`,
    `Vmax ${ou(e?.tensao_max_entrada, ' V')}`,
    `MPPT ${ou(e?.mppt_min)}–${ou(e?.mppt_max, ' V')}`,
    `Imax ${ou(e?.corrente_max_mppt, ' A')}`,
  ]
  return `${nome} — ${partes.join(' · ')}`
}

/**
 * Incompatibilidade de fase — A4 (FV-UX-028).
 *
 * NÃO é regra elétrica nova nem bloqueio: compara dois dados já persistidos e
 * devolve o texto do aviso, ou `null` quando não há o que avisar. Decisão do
 * usuário registrada na FV-UX-027B: mostrar, nunca esconder nem impedir.
 *
 * Ausência de qualquer um dos lados → `null`. Não se presume fase.
 */
export function avisoDeFase(tipoLigacaoInstalacao, fasesEquipamento) {
  const inst = String(tipoLigacaoInstalacao ?? '').trim()
  if (!inst || fasesEquipamento === null || fasesEquipamento === undefined) return null
  const fasesInstalacao = /trif/i.test(inst) ? 3 : /bif/i.test(inst) ? 2 : /monof/i.test(inst) ? 1 : null
  if (fasesInstalacao === null) return null
  if (fasesInstalacao === fasesEquipamento) return null
  const rotuloEquip = rotuloDaFase(fasesEquipamento)
  if (!rotuloEquip) return null
  return `Instalação atual: ${inst}. Este inversor é ${rotuloEquip} e pode exigir ` +
    'adequação da entrada elétrica.'
}

/**
 * Item de `equipamentos.paineis[]` a partir do catálogo.
 * `quantidade` é informada pelo usuário; nada aqui a deriva.
 */
export function painelDoCatalogo(equipamento, quantidade) {
  if (!equipamento) return null
  return {
    // O schema guarda `id` como texto livre. O adapter do wizard grava o `_id`
    // do catálogo, e é o que se mantém: um valor só, com um significado só.
    id: String(equipamento._id),
    marca: equipamento.fabricante ?? null,
    modelo: equipamento.modelo ?? null,
    potencia_w: potenciaDoModulo(equipamento),
    quantidade: num(quantidade),
    equipamento_id: String(equipamento._id),
  }
}

/** Subdocumento `equipamentos.inversor` a partir do catálogo. */
export function inversorDoCatalogo(equipamento) {
  if (!equipamento) return null
  return {
    id: String(equipamento._id),
    marca: equipamento.fabricante ?? null,
    modelo: equipamento.modelo ?? null,
    potencia_kw: potenciaDoInversor(equipamento),
    tipo: tipoDoInversor(equipamento),
    fases: fasesDoInversor(equipamento),
    equipamento_id: String(equipamento._id),
  }
}

// ─── Dados elétricos para o validador canônico — FV-UX-026 ───────────────────
//
// O `Equipamento.especificacoes` é Mixed e as chaves variam com a origem do
// registro. A precedência abaixo é a MESMA que `catalogoEngenhariaAdapter` e
// `extrairSpecsInversor` já usam — não é regra nova.
//
// A diferença, de novo, é a ausência de default: aquele adapter fecha cada
// leitura com `?? 0` / `?? 1`. Aqui o que o catálogo não declara vira `null` e
// sobe como LACUNA. Um zero fabricado num limite de tensão faria o validador
// aprovar qualquer coisa.

/** Parâmetros elétricos do módulo. Coeficiente em %/°C — Q4 converte no motor. */
export function eletricoDoModulo(equipamento) {
  // FV-DOM-031D: delega ao leitor SSOT. A ORDEM das chaves do objeto é a mesma
  // de antes porque os consumidores iteram sobre ela (`lacunasEletricas`).
  const c = lerModulo(equipamento)
  return {
    voc: c.voc, vmpp: c.vmpp, isc: c.isc, impp: c.impp,
    potencia_w: c.potencia_w,
    coef_temp_voc: c.coef_temp_voc, temp_noct: c.temp_noct,
  }
}

/** Limites do inversor, nos nomes que o validador espera. Tudo pela SSOT. */
export function eletricoDoInversor(equipamento) {
  const c = canonico(equipamento)
  if (!c) return null
  return {
    tensao_max_entrada: num(c.tensao_max_entrada),
    mppt_min: num(c.tensao_mppt_min),
    mppt_max: num(c.tensao_mppt_max),
    /**
     * ── Correção do falso bloqueio ────────────────────────────────────────
     * Havia aqui uma PRECEDÊNCIA entre dois campos que não são a mesma coisa:
     * `corrente_isc_max` (limite de curto-circuito) caía em `corrente_max_mppt`
     * (limite de trabalho) quando existisse. O outro chamador do mesmo motor
     * (`inversoresCompativeisService`) preenchia o mesmo parâmetro com
     * `corrente_max_por_mppt`. Ou seja: o motor recebia GRANDEZAS DIFERENTES no
     * mesmo campo conforme quem o chamasse.
     *
     * Agora cada limite viaja no seu próprio parâmetro. Ausência continua
     * `null` — o motor declara `nao_avaliado` e não troca um pelo outro.
     */
    corrente_max_mppt: num(c.corrente_max_por_mppt),
    corrente_isc_max_mppt: num(c.corrente_isc_max),
    // F10: limite TOTAL de entrada CC — terceira grandeza. Enviado pelos DOIS
    // chamadores do motor para que o critério não dependa de qual deles montou
    // o contrato, que foi exatamente o defeito descrito acima.
    corrente_max_entrada: num(c.corrente_max_entrada),
    potencia_ca_kw: num(c.potencia_kw),
  }
}

/** Quantidade de MPPTs declarada pelo catálogo. `null` se ausente. */
export function nMpptsDoInversor(equipamento) {
  return num(canonico(equipamento)?.n_mppts)
}

/**
 * Entradas físicas por MPPT. O SSOT normaliza para ARRAY (uma posição por
 * MPPT); a soma é o total de entradas do equipamento.
 */
export function entradasPorMppt(equipamento) {
  const v = canonico(equipamento)?.entradas_por_mppt
  return Array.isArray(v) && v.length ? v : null
}

// ─── Envelope do MICROINVERSOR — FV-DOM-031 ──────────────────────────────────
//
// A topologia do micro é `microinversor → entradas → módulos` (decisão 5). Estes
// três campos são o envelope completo: quantas entradas, quantos módulos por
// entrada e qual o limite CC/CA declarado. Vêm da SSOT, sem alias local, e sem
// default: o que o catálogo não declarou é `null` e vira lacuna.

/** Entradas CC independentes do microinversor. */
export function entradasDoMicro(equipamento) {
  return num(canonico(equipamento)?.entradas)
}

/** Módulos que cada entrada aceita. */
export function modulosPorEntradaDoMicro(equipamento) {
  return num(canonico(equipamento)?.modulos_por_entrada)
}

/**
 * Máximo de microinversores no mesmo ramal CA, quando o CATÁLOGO o declara.
 * Sprint E: `null` aqui não vira default — cai para a tabela de regras por
 * fabricante e, se ela também não tiver, a regra é declarada indisponível.
 */
export function maxMicrosPorArranjoDoCatalogo(equipamento) {
  return num(canonico(equipamento)?.max_por_cabo_tronco)
}

/** Limite CC/CA declarado pelo fabricante. Sem ele não há veredito (decisão 3). */
export function oversizingMaxDoInversor(equipamento) {
  return num(canonico(equipamento)?.oversizing_max)
}

/** O equipamento é um microinversor, pela classificação canônica única? */
export function ehMicro(equipamento) {
  return tipoDoInversor(equipamento) === 'micro'
}

/**
 * Envelope de micro no formato que o motor canônico espera.
 * Todos os campos podem ser `null` — o motor declara a lacuna.
 */
export function envelopeDoMicro(equipamento) {
  return {
    entradas: entradasDoMicro(equipamento),
    modulos_por_entrada: modulosPorEntradaDoMicro(equipamento),
    potencia_kw: potenciaDoInversor(equipamento),
    oversizing_max: oversizingMaxDoInversor(equipamento),
    // Sprint E — quem decide o agrupamento em ramais. `fabricante` entra no
    // envelope porque a regra é DELE quando o modelo não a declara.
    fabricante: equipamento?.fabricante ?? null,
    max_por_cabo_tronco: maxMicrosPorArranjoDoCatalogo(equipamento),
    // Sprint E2 — limites de corrente, para o motor `correnteMicro`. Ausentes
    // viram `null` e o veredito é `nao_avaliado`; nunca um valor assumido.
    corrente_max_por_mppt: num(canonico(equipamento)?.corrente_max_por_mppt),
    corrente_ac_saida: num(canonico(equipamento)?.corrente_ac_saida),
    // Sprint E3 — cadastro contraditório não vira número. `potencia_kw` acima
    // vem de `potenciaDoInversor`, que já devolve `null` em conflito; a lista
    // segue junto para a tela poder dizer POR QUE o valor sumiu.
    conflitos: detectarConflitos(equipamento),
  }
}

/** Campos elétricos que o catálogo não declarou — viram lacuna, não default. */
export function lacunasEletricas(eletricoMod, eletricoInv) {
  const faltando = []
  for (const [k, v] of Object.entries(eletricoMod ?? {})) {
    if (v === null && k !== 'temp_noct') faltando.push(`modulo.${k}`)
  }
  for (const [k, v] of Object.entries(eletricoInv ?? {})) {
    /**
     * `corrente_isc_max_mppt` fica de fora, como `temp_noct` já ficava: a
     * ausência dele NÃO impede a análise — o motor declara o critério de
     * curto-circuito como `nao_avaliado` e segue. Tratá-lo como lacuna
     * bloquearia 20 dos 39 inversores do catálogo, que declaram só o limite de
     * trabalho, e trocaria um falso bloqueio por outro.
     *
     * F10: `corrente_max_entrada` entra na MESMA exceção, e pela mesma razão —
     * sua ausência deixa `CORRENTE_ENTRADA_TOTAL_EXCEDIDA` em `nao_avaliado`,
     * não impede a análise. A cobertura hoje é 0/52: tratá-la como lacuna
     * bloquearia o catálogo INTEIRO, que é o oposto do objetivo de ligar o
     * caminho do campo.
     */
    const SEM_LACUNA = ['corrente_isc_max_mppt', 'corrente_max_entrada']
    if (v === null && !SEM_LACUNA.includes(k)) faltando.push(`inversor.${k}`)
  }
  return faltando
}

/** Id do catálogo já selecionado no projeto, para reabrir a tela no mesmo lugar. */
export function idSelecionado(item) {
  const ref = item?.equipamento_id ?? item?.id ?? null
  return ref === null || ref === undefined ? '' : String(ref)
}

/** Um `_id` de catálogo, e não um id do catálogo local de contingência. */
const EH_OBJECT_ID = /^[0-9a-f]{24}$/i

/**
 * F-03 — referência canônica ao equipamento do SSOT, a partir do objeto que a
 * tela tem em mãos.
 *
 * Os dois caminhos de escrita do wizard legado gravavam `equipamento_id:
 * item._id`, e esse campo nunca existe no objeto da tela:
 * `catalogoEngenhariaAdapter` devolve `id` (o `_id` do catálogo, como texto) e
 * guarda o documento original em `_catalogo_original`. O resultado era
 * `equipamento_id: null` em todo projeto salvo pelo wizard — e sem a referência
 * o reload não tem por onde buscar o envelope elétrico de volta.
 *
 * Procura a referência nas formas em que ela realmente aparece e exige que seja
 * um ObjectId. O catálogo LOCAL de contingência usa ids próprios (`cs550`,
 * `fr5`): não são referência ao SSOT e devolvem `null` — lacuna honesta, em vez
 * de um id que o schema recusaria no cast.
 */
export function referenciaDoCatalogo(item) {
  for (const c of [item?._catalogo_original?._id, item?.equipamento_id, item?._id, item?.id]) {
    if (c === null || c === undefined) continue
    const s = String(c)
    if (EH_OBJECT_ID.test(s)) return s
  }
  return null
}
