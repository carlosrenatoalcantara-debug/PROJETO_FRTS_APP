/**
 * catalogoEngenhariaAdapter.js — Sprint 8.1
 *
 * Adapter ÚNICO: converte Equipamento (Mongo) → contrato consumido pelo E7
 * (SeletorPaineis / SeletorInversores). NÃO altera o E7 nem o motor elétrico.
 *
 * Preserva o documento original em `_catalogo_original` para uso futuro
 * (unifilar/memorial/homologação/certificados). Marca `_fonte: 'catalogo'`.
 */

const num = (v) => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null }
const pick = (e, ks) => { for (const k of ks) { const v = num(e?.[k]); if (v !== null) return v } return null }
const pickStr = (e, ks) => { for (const k of ks) { const v = e?.[k]; if (v != null && v !== '') return v } return null }
const anos = (g) => (g && typeof g === 'object' ? num(g.value) : num(g))

// ─── MÓDULO → shape de SeletorPaineis ────────────────────────────────────────────
export function adaptarModulo(eq) {
  const e = eq.especificacoes || {}
  return {
    id: String(eq._id),
    marca: eq.fabricante || '—',
    modelo: eq.modelo || '—',
    potenciaW: pick(e, ['potencia', 'potencia_w', 'potenciaW']) ?? 0,
    tecnologia: pickStr(e, ['tecnologia', 'tipo_celula']) || 'N-type',
    bifacial: !!(e.bifacial),
    eficiencia: pick(e, ['eficiencia', 'eficiencia_pct']) ?? 0,
    voc: pick(e, ['voc', 'voc_v']) ?? 0,
    vmpp: pick(e, ['vmpp', 'vmp', 'vmpp_v']) ?? 0,
    isc: pick(e, ['isc', 'isc_a']) ?? 0,
    coef_temp_voc: pick(e, ['coef_temp_voc', 'coef_temp_voc_pct_c']),  // engine usa este
    temp_noct: pick(e, ['noct', 'noct_c']),
    imp: pick(e, ['imp', 'impp', 'imp_a']),                          // audit S8.1.1
    coef_temp_pmax: pick(e, ['coef_temp_pmax', 'coef_temp_potencia']), // audit S8.1.1
    dimensoes: {
      comprimento: pick(e, ['comprimento', 'comprimento_mm', 'alturaMm']),
      largura: pick(e, ['largura', 'largura_mm', 'larguraMm']),
      espessura: pick(e, ['espessura', 'espessura_mm']),
      peso: pick(e, ['peso', 'peso_kg']),
    },
    registro_inmetro: eq.certificacao?.inmetro?.numero ?? null,        // audit S8.1.1
    garantiaProduto: anos(eq.garantia_produto) ?? pick(e, ['garantia_produto']) ?? 12,
    garantiaPerformance: anos(eq.garantia_performance) ?? pick(e, ['garantia_performance']) ?? 25,
    percentualPerformance: pick(e, ['percentual_performance']) ?? 80,
    precoUnitario: num(eq.preco_sugerido) ?? 0,
    // governança / proveniência
    utilizavel_em_projeto: eq.utilizavel_em_projeto !== false,
    bloqueio_engenharia: eq.bloqueio_engenharia || [],
    _fonte: 'catalogo',
    _catalogo_original: eq,
  }
}

export function agruparPaineis(equipamentos) {
  const grupos = {}
  for (const eq of equipamentos) {
    const m = adaptarModulo(eq)
    ;(grupos[m.marca] = grupos[m.marca] || []).push(m)
  }
  return grupos
}

// ─── INVERSOR → tree tipo→marca→fase de SeletorInversores ─────────────────────────
export function adaptarInversor(eq) {
  const e = eq.especificacoes || {}
  const fases = pick(e, ['fases', 'fases_saida']) ?? 1
  return {
    id: String(eq._id),
    modelo: eq.modelo || '—',
    potenciaKW: pick(e, ['potencia', 'potencia_kw', 'potencia_ca']) ?? 0,
    nMppts: pick(e, ['mppts', 'n_mppts', 'numero_mppt']) ?? 1,
    garantia: anos(eq.garantia_produto) ?? pick(e, ['garantia']) ?? 5,
    precoUnitario: num(eq.preco_sugerido) ?? 0,
    utilizavel_em_projeto: eq.utilizavel_em_projeto !== false,
    bloqueio_engenharia: eq.bloqueio_engenharia || [],
    _fonte: 'catalogo',
    _catalogo_original: eq,
    // Dados elétricos inline (substituem DADOS_ELETRICOS_INVERSORES p/ itens do catálogo)
    _eletrico: {
      tensao_max_entrada: pick(e, ['voc_max', 'voc_max_dc', 'tensao_max_dc']),
      mppt_min: pick(e, ['faixa_mppt_min', 'mppt_min']),
      mppt_max: pick(e, ['faixa_mppt_max', 'mppt_max']),
      corrente_max_mppt: pick(e, ['corrente_max_mppt', 'isc_max_mppt', 'ipv_max']),
      isc_max_mppt: pick(e, ['isc_max_mppt', 'corrente_curto_mppt', 'isc_max']),  // audit S8.1.1
      potencia_fv_max: pick(e, ['potencia_cc_max', 'potencia_dc_max', 'pdc_max']), // audit S8.1.1
      oversizing_max: pick(e, ['oversizing_max']) ?? 1.30,
      entradas_por_mppt: pick(e, ['strings_por_mppt', 'entradas_por_mppt']) ?? 1,
    },
    registro_inmetro: eq.certificacao?.inmetro?.numero ?? null,
    _fases: fases,
  }
}

export function agruparInversores(equipamentos) {
  // tree: tipo → marca → fase → [modelos]. Catálogo não traz tipo → assume 'string'.
  const tree = {}
  for (const eq of equipamentos) {
    const inv = adaptarInversor(eq)
    const tipo = 'string'
    const marca = eq.fabricante || '—'
    const fase = inv._fases === 3 ? 'trifasico' : 'monofasico'
    tree[tipo] = tree[tipo] || {}
    tree[tipo][marca] = tree[tipo][marca] || {}
    ;(tree[tipo][marca][fase] = tree[tipo][marca][fase] || []).push(inv)
  }
  return tree
}

// ─── Snapshot do equipamento no momento da seleção (versão congelada) ─────────────
// Clona em profundidade (snapshot IMUTÁVEL — independente de mudanças futuras no catálogo)
function clonar(v) {
  if (v == null) return v
  try { return structuredClone(v) } catch { return JSON.parse(JSON.stringify(v)) }
}

export function snapshotEquipamentoSelecao(obj) {
  const orig = obj?._catalogo_original || null
  return {
    equipamento_id: orig?._id || obj?.id || null,
    fabricante: obj?.marca || orig?.fabricante || null,
    modelo: obj?.modelo || orig?.modelo || null,
    versao_catalogo: orig?._schema_versao || null,
    fonte: obj?._fonte || 'local',
    data_selecao: new Date().toISOString(),
    // CÓPIA PROFUNDA — nunca referência ao documento vivo do catálogo
    dados_eletricos: orig ? clonar(orig.especificacoes || null) : {
      voc: obj?.voc, vmpp: obj?.vmpp, isc: obj?.isc, potenciaW: obj?.potenciaW,
      potenciaKW: obj?.potenciaKW, nMppts: obj?.nMppts,
    },
    // Prova documental futura: datasheet/hashes/versão (cópia de metadados)
    datasheet_original_url: orig?.datasheet_original?.nome || orig?.datasheet_url || null,
    hash_documento: orig?.datasheet_original?.hash || null,
    hash_certificado: orig?.certificacao?.inmetro?.certificado || null,
    documentos_tecnicos: (orig?.documentos_tecnicos || []).map((d) => ({ document_id: d._id || null, hash: d.hash, tipo: d.tipo })),
    certificacao: clonar(orig?.certificacao || null),
  }
}
