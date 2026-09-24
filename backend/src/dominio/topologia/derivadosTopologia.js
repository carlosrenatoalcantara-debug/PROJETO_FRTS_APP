/**
 * derivadosTopologia.js — S3-FV-ENGINE-TOPOLOGY-CONSUMPTION-01
 *
 * Derivados da topologia calculados EM LEITURA (nunca persistidos, INV-58):
 * mapeia os Geradores de uma Instalação para a MESMA forma canônica que
 * `arranjosService.enriquecerArranjo` produz (paineis/inversores agregados +
 * potências), e soma os totais na MESMA forma de `calcularTotaisProjeto`.
 *
 * Assim o caminho novo (Instalação) e o legado (Arranjo) convergem para uma única
 * forma, e os TOTAIS de casos equivalentes coincidem.
 *
 * PURO, sem I/O. NÃO altera nenhum algoritmo elétrico — apenas projeta/soma.
 * A resolução de specs (Wp do módulo, kW/n_mppts do inversor) vem do Catálogo,
 * lido via SSOT `lerInversor` (nunca parametrização manual).
 */

import { lerInversor } from '../../equipamentos/inversores/index.js'
// F12: a MESMA agregação dos dois caminhos (`arranjos[]` e `instalacao`) vem de
// uma função só. Duas cópias da soma já produziram duas regras divergentes.
import { potenciaPaineisKwp, potenciaInversoresKw } from '../../services/arranjosService.js'

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

/** Resolve um doc do Catálogo por referência. `catalogo` pode ser função ou mapa {id:doc}. */
function resolverCatalogo(catalogo, ref) {
  if (ref == null) return null
  if (typeof catalogo === 'function') return catalogo(ref) || null
  if (catalogo && typeof catalogo === 'object') return catalogo[String(ref)] || null
  return null
}

function wpDoModulo(doc) {
  return num(doc?.potencia_w ?? doc?.especificacoes?.potencia_wp ?? doc?.especificacoes?.potencia_w)
}
function kwDoInversor(doc) {
  const c = lerInversor(doc?.especificacoes || doc || {}, doc || {})
  return num(c.potencia_kw ?? doc?.potencia_kw)
}

/**
 * Mapeia UM Gerador da Instalação para a forma canônica de arranjo:
 * agrega a composição de todas as Strings em `paineis[{modelo,potencia_w,quantidade}]`
 * e o inversor em `inversores[{modelo,potencia_kw,quantidade:1}]`.
 * @returns objeto no mesmo shape de enriquecerArranjo (subset relevante aos totais).
 */
export function mapearGerador(gerador, catalogo, idx = 0) {
  // Agrega módulos por modelo (modulo_ref) somando as quantidades das composições.
  const porModelo = new Map()
  for (const mppt of (gerador?.mppts || [])) {
    for (const str of (mppt?.strings || [])) {
      for (const item of (str?.composicao || [])) {
        const key = String(item.modulo_ref)
        const q = num(item.quantidade)
        const acc = porModelo.get(key) || { modulo_ref: item.modulo_ref, quantidade: 0 }
        acc.quantidade += q
        porModelo.set(key, acc)
      }
    }
  }
  const paineis = [...porModelo.values()].map((m) => {
    const doc = resolverCatalogo(catalogo, m.modulo_ref)
    return { modelo: doc?.modelo ?? String(m.modulo_ref), potencia_w: wpDoModulo(doc), quantidade: m.quantidade }
  })

  const invDoc = resolverCatalogo(catalogo, gerador?.inversor_ref)
  const inversores = gerador?.inversor_ref
    ? [{ modelo: invDoc?.modelo ?? String(gerador.inversor_ref), potencia_kw: kwDoInversor(invDoc), quantidade: 1 }]
    : []

  // F12: `num()` devolve 0 para ausente/não-numérico, e essa soma colapsava
  // lacuna em zero exatamente como `potenciaPaineisKwp` fazia no caminho
  // `arranjos[]`. Este é o caminho `instalacao` — mesma agregação, mesmo
  // defeito. A contagem de módulos continua somando; a potência, não.
  const n_modulos = paineis.reduce((s, p) => s + num(p.quantidade), 0)
  const potencia_kwp = potenciaPaineisKwp(paineis)
  const potencia_inversor_kw = potenciaInversoresKw(inversores)

  return {
    id: gerador?._id != null ? String(gerador._id) : `gerador_${idx + 1}`,
    rotulo: gerador?.apelido || `Inversor ${idx + 1}`,
    tipo: 'gerador',
    origem: 'instalacao',
    somente_leitura: false,
    paineis,
    inversores,
    baterias: [],
    // Já vêm arredondados e com `null` para ausente das funções canônicas.
    potencia_kwp,
    potencia_inversor_kw,
    capacidade_bateria_kwh: null,
    // oversizing DC/AC calculado em leitura (nunca persistido).
    // F12: exige AS DUAS potências. Antes, com CC nula, `null / x` dava 0 e o
    // oversizing saía 0,000 — um número fabricado a partir de uma lacuna.
    oversizing: (potencia_kwp !== null && potencia_inversor_kw !== null && potencia_inversor_kw > 0)
      ? Number((potencia_kwp / potencia_inversor_kw).toFixed(3))
      : null,
    dimensionamento: {
      potencia_kwp,
      geracao_mensal_kwh: null,   // geração não deriva da estrutura da topologia
      n_modulos,
      n_inversores: inversores.length,
    },
  }
}

/** Mapeia todos os Geradores da Instalação para a forma canônica. */
export function mapearGeradoresInstalacao(instalacao, catalogo) {
  return (instalacao?.geradores || []).map((g, i) => mapearGerador(g, catalogo, i))
}

/**
 * Totais de uma lista canônica de geradores — MESMA forma de calcularTotaisProjeto.
 * @returns {{n_arranjos,n_modulos_total,n_inversores_total,potencia_total_kwp,
 *            potencia_inversor_total_kw,capacidade_bateria_total_kwh,geracao_mensal_total_kwh}}
 */
export function totaisTopologia(geradoresCanonicos = []) {
  const t = {
    n_arranjos: geradoresCanonicos.length,
    n_modulos_total: 0,
    n_inversores_total: 0,
    potencia_total_kwp: 0,
    potencia_inversor_total_kw: 0,
    capacidade_bateria_total_kwh: 0,
    geracao_mensal_total_kwh: 0,
  }
  // F12: mesma regra do caminho `arranjos[]` — gerador com painéis mas sem
  // potência conhecida torna o total NÃO AVALIÁVEL, em vez de contribuir zero.
  let potenciaIncompleta = false
  let potenciaInversorIncompleta = false
  for (const g of geradoresCanonicos) {
    t.n_modulos_total            += num(g.dimensionamento?.n_modulos)
    t.n_inversores_total         += num(g.dimensionamento?.n_inversores)
    t.capacidade_bateria_total_kwh += num(g.capacidade_bateria_kwh)
    t.geracao_mensal_total_kwh   += num(g.dimensionamento?.geracao_mensal_kwh)

    // `num()` deste arquivo devolve 0 para ausente, e `Number(null)` também é 0:
    // qualquer um dos dois recriaria o defeito. A presença é testada direto.
    const pcc = g.potencia_kwp
    if (pcc !== null && pcc !== undefined && Number.isFinite(Number(pcc))) t.potencia_total_kwp += Number(pcc)
    else if ((g.paineis?.length ?? 0) > 0) potenciaIncompleta = true

    const pca = g.potencia_inversor_kw
    if (pca !== null && pca !== undefined && Number.isFinite(Number(pca))) t.potencia_inversor_total_kw += Number(pca)
    else if ((g.inversores?.length ?? 0) > 0) potenciaInversorIncompleta = true
  }
  t.potencia_total_kwp = potenciaIncompleta
    ? null : Number(t.potencia_total_kwp.toFixed(3))
  t.potencia_inversor_total_kw = potenciaInversorIncompleta
    ? null : Number(t.potencia_inversor_total_kw.toFixed(3))
  t.capacidade_bateria_total_kwh = Number(t.capacidade_bateria_total_kwh.toFixed(3))
  t.geracao_mensal_total_kwh = Number(t.geracao_mensal_total_kwh.toFixed(1))
  return t
}

/**
 * Projeta UMA String canônica para a ENTRADA da compatibilidade elétrica EXISTENTE
 * (`analisarCompatibilidade`), sem alterar o algoritmo. Reuso, não reimplementação.
 * Para composição heterogênea, expõe os itens; o consumidor decide (Isc limitante).
 * @returns entrada compatível com analisarCompatibilidade (1 modelo) ou multi-item.
 */
export function entradaCompatibilidadeString(str, catalogo) {
  const itens = (str?.composicao || []).map((it) => {
    const doc = resolverCatalogo(catalogo, it.modulo_ref)
    return { modulo: doc || { _id: it.modulo_ref }, quantidade: num(it.quantidade), especificacoes: doc?.especificacoes || null }
  })
  const k = itens.reduce((s, i) => s + i.quantidade, 0)
  return {
    homogenea: itens.length === 1,
    modulos_por_string: k,
    itens,
    superficie_id: str?.superficie_id ?? null,
  }
}

export default { mapearGerador, mapearGeradoresInstalacao, totaisTopologia, entradaCompatibilidadeString }
