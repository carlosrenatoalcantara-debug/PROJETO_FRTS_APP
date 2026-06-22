/**
 * referenciaTopologiaService.js — P1-COSERN-REFERENCE-TOPOLOGIES-01
 *
 * Motor de sugestão de topologia de referência. Função pura, sem I/O.
 * Entrada: { concessionaria, classe, arquitetura } → topologia de referência.
 * NÃO substitui o dimensionamento — apenas pré-configura.
 */
import { COSERN_CLASSES, COSERN_TOPOLOGIAS, COSERN_META } from '../data/cosernTopologiasReferencia.js'

const CONCESSIONARIAS = { COSERN: { classes: COSERN_CLASSES, topologias: COSERN_TOPOLOGIAS, meta: COSERN_META } }

const normClasse = (c) => String(c || '').trim().toUpperCase()
const normArq = (a) => {
  const s = String(a || '').trim().toLowerCase()
  if (s.startsWith('micro')) return 'micro'
  if (s.startsWith('otim')) return 'otimizador'
  if (s.startsWith('string')) return 'string'
  return s
}
const normConc = (c) => String(c || '').trim().toUpperCase().replace(/\s+/g, '')

/**
 * @returns {{ ok, concessionaria, classe, arquitetura, limites, topologia, aviso } | { ok:false, erro, ... }}
 */
export function sugerirTopologia({ concessionaria, classe, arquitetura } = {}) {
  const conc = normConc(concessionaria)
  const base = CONCESSIONARIAS[conc]
  if (!base) {
    return { ok: false, erro: 'CONCESSIONARIA_NAO_SUPORTADA', concessionarias_suportadas: Object.keys(CONCESSIONARIAS) }
  }
  const cls = normClasse(classe)
  if (!base.classes[cls]) {
    return { ok: false, erro: 'CLASSE_NAO_ENCONTRADA', classe: cls, classes_validas: Object.keys(base.classes) }
  }
  const arq = normArq(arquitetura)
  const topo = base.topologias[cls]?.[arq]
  if (!topo) {
    return { ok: false, erro: 'ARQUITETURA_NAO_ENCONTRADA', arquitetura: arq, arquiteturas_validas: base.meta.arquiteturas }
  }
  return {
    ok: true,
    concessionaria: conc,
    classe: cls,
    arquitetura: arq,
    limites: base.classes[cls],
    topologia: topo,
    aviso: base.meta.aviso,
  }
}

/** Catálogo de referência completo (todas as classes × arquiteturas). */
export function listarReferencias(concessionaria = 'COSERN') {
  const conc = normConc(concessionaria)
  const base = CONCESSIONARIAS[conc]
  if (!base) return { ok: false, erro: 'CONCESSIONARIA_NAO_SUPORTADA' }
  return { ok: true, concessionaria: conc, meta: base.meta, classes: base.classes, topologias: base.topologias }
}

export default { sugerirTopologia, listarReferencias }
