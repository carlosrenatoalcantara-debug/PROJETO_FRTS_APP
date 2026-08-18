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

/** Potência do módulo (W) — como o catálogo a declarar, sem completar. */
export function potenciaDoModulo(equipamento) {
  return primeiroNumero(equipamento?.especificacoes, ['potencia', 'potencia_w', 'potenciaW'])
}

/** Potência do inversor (kW). */
export function potenciaDoInversor(equipamento) {
  return primeiroNumero(equipamento?.especificacoes, ['potencia', 'potencia_kw', 'potencia_ca'])
}

/** Fases de saída do inversor. */
export function fasesDoInversor(equipamento) {
  return primeiroNumero(equipamento?.especificacoes, ['fases', 'fases_saida'])
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
  const e = equipamento?.especificacoes ?? {}
  const tec = tecnologiaInversor({
    fabricante: equipamento?.fabricante,
    modelo: equipamento?.modelo,
    voc_max_dc_v: primeiroNumero(e, ['tensao_max_entrada', 'voc_max', 'voc_max_dc', 'tensao_max_dc']),
    potencia_kw_ca: potenciaDoInversor(equipamento),
    n_mppts: primeiroNumero(e, ['n_mppts', 'mppts', 'numero_mppt']),
  })
  if (!tec) return null
  return tec === 'microinversor' ? 'micro' : tec
}

/** Rótulo de lista. Sem potência declarada, diz isso — não inventa um número. */
export function rotuloDoEquipamento(equipamento, potencia, unidade) {
  const nome = [equipamento?.fabricante, equipamento?.modelo].filter(Boolean).join(' ') || 'sem identificação'
  return potencia === null ? `${nome} — potência não informada` : `${nome} — ${potencia} ${unidade}`
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
  const e = equipamento?.especificacoes ?? {}
  return {
    voc: primeiroNumero(e, ['voc', 'voc_v']),
    vmpp: primeiroNumero(e, ['vmpp', 'vmp', 'vmpp_v']),
    isc: primeiroNumero(e, ['isc', 'isc_a']),
    impp: primeiroNumero(e, ['impp', 'imp', 'impp_a', 'imp_a']),
    potencia_w: potenciaDoModulo(equipamento),
    coef_temp_voc: primeiroNumero(e, ['coef_temp_voc_pct_c', 'coef_temp_voc']),
    temp_noct: primeiroNumero(e, ['noct_c', 'noct', 'temp_noct']),
  }
}

/** Limites do inversor, nos nomes que o validador espera. */
export function eletricoDoInversor(equipamento) {
  const e = equipamento?.especificacoes ?? {}
  return {
    tensao_max_entrada: primeiroNumero(e, ['tensao_max_entrada', 'voc_max', 'voc_max_dc', 'tensao_max_dc']),
    mppt_min: primeiroNumero(e, ['tensao_mppt_min', 'faixa_mppt_min', 'mppt_min']),
    mppt_max: primeiroNumero(e, ['tensao_mppt_max', 'faixa_mppt_max', 'mppt_max']),
    corrente_max_mppt: primeiroNumero(e, ['corrente_max_por_mppt', 'corrente_max_mppt', 'isc_max_mppt', 'ipv_max']),
    potencia_ca_kw: potenciaDoInversor(equipamento),
  }
}

/** Quantidade de MPPTs declarada pelo catálogo. `null` se ausente. */
export function nMpptsDoInversor(equipamento) {
  return primeiroNumero(equipamento?.especificacoes, ['n_mppts', 'mppts', 'numero_mppt'])
}

/** Entradas físicas por MPPT declaradas pelo catálogo. `null` se ausente. */
export function entradasPorMppt(equipamento) {
  return primeiroNumero(equipamento?.especificacoes, ['strings_por_mppt', 'entradas_por_mppt'])
}

/** Campos elétricos que o catálogo não declarou — viram lacuna, não default. */
export function lacunasEletricas(eletricoMod, eletricoInv) {
  const faltando = []
  for (const [k, v] of Object.entries(eletricoMod ?? {})) {
    if (v === null && k !== 'temp_noct') faltando.push(`modulo.${k}`)
  }
  for (const [k, v] of Object.entries(eletricoInv ?? {})) {
    if (v === null) faltando.push(`inversor.${k}`)
  }
  return faltando
}

/** Id do catálogo já selecionado no projeto, para reabrir a tela no mesmo lugar. */
export function idSelecionado(item) {
  const ref = item?.equipamento_id ?? item?.id ?? null
  return ref === null || ref === undefined ? '' : String(ref)
}
