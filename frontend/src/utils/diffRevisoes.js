/**
 * diffRevisoes.js — Sprint 7.3.1
 *
 * Comparação VISUAL entre duas revisões congeladas. NÃO recalcula nada —
 * apenas lê snapshots e computa diferenças (igual / alterado / + / -).
 *
 * Fontes (governança):
 *  - revisao.snapshots = { tecnico, geoespacial, financeiro, unifilar, memorial, ... }
 *  - snapshot_empresa / snapshot_tecnico_identificacao (top-level → revisão "Atual")
 */

const g = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
const fmtNum = (v, suf = '') => (v == null || v === '' ? null : `${Number(v).toLocaleString('pt-BR')}${suf}`)
const brl = (v) => (v == null ? null : 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 }))

// Extrai os campos comparáveis de um bundle de snapshots
function extrair(bundle) {
  const t = bundle?.tecnico || {}
  const f = bundle?.financeiro || {}
  const ret = f.retorno_realista || f.retorno || {}
  const geo = bundle?.geoespacial || {}
  const emp = bundle?.empresa || {}
  const rt = bundle?.tecnico_identificacao || {}
  const panoOrient = Array.isArray(geo.panos) ? geo.panos.map((p) => p.orientacao).join(', ') : null

  return {
    tecnico: {
      'Potência CC (kWp)': fmtNum(g(t, 'sistema.potenciaCC')),
      'Módulos': fmtNum(g(t, 'resumo.numPaineis')),
      'Inversor (kW)': fmtNum(g(t, 'inversor.potencia')),
      'Strings': fmtNum(g(t, 'resumo.numStrings')),
      'MPPTs': Array.isArray(t.mppts) ? String(t.mppts.length) : fmtNum(g(t, 'inversor.nMppts')),
      'Voc máx (V)': fmtNum(g(t, 'resumo.vocMaxGlobal'), ' V'),
      'Vmpp (V)': fmtNum(g(t, 'modulo.vmpp'), ' V'),
      'Isc total (A)': fmtNum(g(t, 'resumo.iscTotalDC'), ' A'),
      'Cabo CC (mm²)': g(t, 'cabos.dc.secao') ?? g(t, 'cabos.dc.bitola') ?? null,
      'Cabo CA (mm²)': g(t, 'cabos.ac.secao') ?? g(t, 'cabos.ac.bitola') ?? null,
      'DPS': g(t, 'protecoes.dps') ? String(g(t, 'protecoes.dps')) : null,
    },
    financeiro: {
      'Investimento': brl(f.proposta_final),
      'Desconto (%)': fmtNum(f.desconto_percentual, '%'),
      'Margem líq. (%)': fmtNum(g(f, 'margem.margem_liquida_pct'), '%'),
      'Payback (anos)': fmtNum(ret.payback_anos),
      'ROI (%)': fmtNum(ret.roi_pct, '%'),
      'Economia 25a': brl(ret.economia_25_anos),
    },
    comercial: {
      'Cenário base': f.cenario_exibicao || null,
      'Proposta final': brl(f.proposta_final),
    },
    geoespacial: {
      'Área útil (m²)': fmtNum(geo.area_util_total, ' m²'),
      'Panos': fmtNum(geo.total_panos),
      'Capacidade (módulos)': fmtNum(geo.max_modulos_total),
      'Orientações': panoOrient,
      'Sombra média (%)': fmtNum(geo.fator_sombra_medio, '%'),
    },
    empresa: {
      'Empresa': emp.nome_fantasia || emp.razao_social || null,
      'Responsável Técnico': rt.nome ? `${rt.nome}${rt.registro ? ` (${rt.tipo_registro || 'CREA'} ${rt.registro})` : ''}` : null,
    },
  }
}

const LABEL_SECAO = {
  tecnico: 'Técnico', financeiro: 'Financeiro', comercial: 'Comercial',
  geoespacial: 'Geoespacial', empresa: 'Empresa',
}

/**
 * Compara dois bundles e retorna seções com linhas {campo, de, para, status}.
 * status: 'igual' | 'alterado' | 'adicionado' | 'removido'
 */
export function diffRevisoes(bundleA, bundleB) {
  const A = extrair(bundleA)
  const B = extrair(bundleB)
  const secoes = []
  for (const sec of Object.keys(LABEL_SECAO)) {
    const campos = new Set([...Object.keys(A[sec] || {}), ...Object.keys(B[sec] || {})])
    const linhas = []
    for (const campo of campos) {
      const de = A[sec]?.[campo] ?? null
      const para = B[sec]?.[campo] ?? null
      let status
      if (de == null && para == null) continue
      else if (de == null) status = 'adicionado'
      else if (para == null) status = 'removido'
      else if (String(de) === String(para)) status = 'igual'
      else status = 'alterado'
      linhas.push({ campo, de, para, status })
    }
    if (linhas.length) secoes.push({ secao: sec, label: LABEL_SECAO[sec], linhas })
  }
  const totalAlteracoes = secoes.reduce((s, x) => s + x.linhas.filter((l) => l.status !== 'igual').length, 0)
  return { secoes, totalAlteracoes }
}

export const STATUS_DIFF = {
  igual:      { icone: '✓', cor: 'text-slate-400', bg: '' },
  alterado:   { icone: '⚠', cor: 'text-amber-700', bg: 'bg-amber-50' },
  adicionado: { icone: '+', cor: 'text-emerald-700', bg: 'bg-emerald-50' },
  removido:   { icone: '−', cor: 'text-red-700', bg: 'bg-red-50' },
}
