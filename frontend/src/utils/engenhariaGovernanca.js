/**
 * engenhariaGovernanca.js — Sprint 3.5
 *
 * Governança técnica do projeto FV: snapshots congelados, versionamento de
 * engenharia, hash determinístico e detecção de divergência com o catálogo.
 *
 * Princípio: um projeto congelado NÃO depende mais do catálogo vivo. Os
 * snapshots construídos aqui são a fonte única de verdade da proposta.
 *
 * Funções puras e determinísticas — sem I/O, sem side-effects.
 */

import { montarModeloEletrico } from './engenhariaNormativa'
import { validarEquipamento } from './catalogQualityEngine'

/**
 * Versão do motor de engenharia.
 * ENG-1.x = motor legado (pré-Sprint 2.5).
 * ENG-2.0 = motor normativo introduzido na Sprint 2.5 (temperatura por UF,
 *           Voc/Vmpp corrigidos, fórmula bifásica corrigida, cabos NBR 16690).
 *
 * Incrementar ao alterar qualquer fórmula elétrica/normativa que afete o
 * resultado dos snapshots. Cada projeto congelado registra a versão usada.
 */
export const ENGINEERING_VERSION = 'ENG-2.0'

// ─── Hash determinístico (djb2 → hex) ──────────────────────────────────────────
// Não-criptográfico, suficiente para detectar mudança de conteúdo entre snapshots.
// Síncrono (diferente de crypto.subtle.digest, que é async).

export function hashTecnico(valor) {
  const str = typeof valor === 'string' ? valor : JSON.stringify(valor ?? null)
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0  // h * 33 + c, mantém uint32
  }
  return 'h' + h.toString(16).padStart(8, '0')
}

// ─── Snapshot técnico ───────────────────────────────────────────────────────────

/**
 * Congela a engenharia elétrica: módulo, inversor, strings, MPPTs, Voc, Vmpp,
 * Isc, oversizing, cabos, proteções, temperaturas, normas e versão do motor.
 *
 * Reaproveita montarModeloEletrico (mesma engenharia da Sprint 2.5) para
 * garantir que o snapshot reflita exatamente o que o unifilar/memorial mostram.
 */
export function construirSnapshotTecnico({ painel, inversor, arranjoMPPTs, dimensionamento, dadosConsumo, uf }) {
  let modelo = null
  try {
    modelo = montarModeloEletrico({ painel, inversor, arranjoMPPTs, dimensionamento, dadosConsumo, uf })
  } catch (e) {
    modelo = { erro: e.message }
  }

  const potCC = modelo?.sistema?.potenciaCC ?? null
  const potCA = modelo?.sistema?.potenciaCA ?? null
  const oversizing = (potCC && potCA) ? +(potCC / potCA).toFixed(3) : null

  const snapshot = {
    engineering_version: ENGINEERING_VERSION,
    criado_em: new Date().toISOString(),
    temperatura: modelo?.temperatura ?? null,
    sistema: modelo?.sistema ?? null,
    modulo: modelo?.modulos ?? null,
    inversor: modelo?.inversor ?? null,
    mppts: modelo?.mppts ?? null,
    resumo: modelo?.resumo ?? null,
    oversizing,
    cabos: modelo?.cabos ?? null,
    protecoes: modelo?.protecoes ?? null,
    normas_aplicadas: ['NBR 16690', 'NBR 5410', 'NBR 16274', 'PRODIST Módulo 3'],
  }
  snapshot.hash = hashTecnico(snapshot)
  return snapshot
}

// ─── Snapshot do catálogo ───────────────────────────────────────────────────────

/**
 * Congela os dados do equipamento no momento da proposta: modelo, fabricante,
 * score, validações, dados elétricos, garantias, OCR confidence e hash técnico.
 * Após congelar, o projeto não é afetado por mudanças no catálogo vivo.
 */
function snapshotEquipamento(tipo, eq, quantidade = null) {
  if (!eq) return null

  // Avalia qualidade no momento (espelha o que o catálogo mostraria hoje)
  let qualidade = null
  try {
    qualidade = validarEquipamento({
      tipo,
      fabricante: eq.marca || eq.fabricante,
      modelo: eq.modelo,
      especificacoes: eq.especificacoes || eq,
    })
  } catch { /* qualidade fica null */ }

  const especificacoes = eq.especificacoes || {
    potencia:   eq.potenciaW ?? eq.potencia_w ?? eq.potencia ?? null,
    voc:        eq.voc ?? null,
    vmpp:       eq.vmpp ?? eq.vmp ?? null,
    isc:        eq.isc ?? null,
    voc_max:    eq.voc_max ?? null,
    mppt_min:   eq.mppt_min ?? null,
    mppt_max:   eq.mppt_max ?? null,
    mppts:      eq.nMppts ?? eq.mppts ?? null,
  }

  const base = {
    equipamento_id: eq._id || eq.id || null,
    tipo,
    fabricante: eq.marca || eq.fabricante || null,
    modelo: eq.modelo || null,
    quantidade,
    especificacoes,
    score: qualidade?.score ?? eq.qualidade?.score_global ?? null,
    nivel: qualidade?.nivel ?? eq.qualidade?.nivel ?? null,
    validacoes: qualidade?.alertas ?? eq.qualidade?.alertas ?? [],
    garantia_produto: eq.garantia_produto ?? null,
    garantia_performance: eq.garantia_performance ?? null,
    ocr_confidence: eq.ocr_confidence ?? eq.confianca_ocr ?? null,
  }
  base.hash_tecnico = hashTecnico({
    fabricante: base.fabricante, modelo: base.modelo, especificacoes: base.especificacoes,
  })
  return base
}

export function construirSnapshotCatalogo({ painel, inversor, bateria, carregadorEV, dimensionamento }) {
  return {
    criado_em: new Date().toISOString(),
    modulo:       snapshotEquipamento('modulo',   painel,       dimensionamento?.numPaineis ?? null),
    inversor:     snapshotEquipamento('inversor', inversor,     dimensionamento?.numInversores ?? null),
    bateria:      bateria      ? snapshotEquipamento('bateria',      bateria)      : null,
    carregadorEV: carregadorEV ? snapshotEquipamento('carregador_ev', carregadorEV) : null,
  }
}

// ─── Snapshot do unifilar ───────────────────────────────────────────────────────

/**
 * Congela o SVG do unifilar. Projetos homologados não regeneram o unifilar
 * automaticamente — este SVG é o documento técnico estável.
 */
export function construirSnapshotUnifilar(svg) {
  if (!svg) return null
  return {
    svg,
    hash: hashTecnico(svg),
    criado_em: new Date().toISOString(),
    versao: ENGINEERING_VERSION,
  }
}

// ─── Snapshot do memorial ───────────────────────────────────────────────────────

export function construirSnapshotMemorial({ snapshotTecnico, dadosConsumo, localizacao, concessionaria }) {
  const t = snapshotTecnico || {}
  return {
    criado_em: new Date().toISOString(),
    engineering_version: ENGINEERING_VERSION,
    normas: t.normas_aplicadas ?? ['NBR 16690', 'NBR 5410', 'NBR 16274'],
    tensao: t.sistema ? { fasesAC: t.sistema.fasesAC, tensaoAC: t.sistema.tensaoAC, tipoLigacao: t.sistema.tipoLigacao } : null,
    protecoes: t.protecoes ?? null,
    cabos: t.cabos ?? null,
    temperatura: t.temperatura ?? null,
    concessionaria: concessionaria || dadosConsumo?.concessionaria || dadosConsumo?.distribuidora || null,
    localizacao: localizacao ? { cidadeEstado: localizacao.cidadeEstado, uf: localizacao.uf } : null,
    engenharia_utilizada: {
      potenciaCC: t.sistema?.potenciaCC ?? null,
      potenciaCA: t.sistema?.potenciaCA ?? null,
      oversizing: t.oversizing ?? null,
      vocMaxGlobal: t.resumo?.vocMaxGlobal ?? null,
    },
  }
}

// ─── Snapshot financeiro (arquitetura — Sprint 4) ───────────────────────────────

/**
 * Congela a estrutura financeira da proposta. NÃO recalcula ROI/payback
 * avançado (isso é Sprint 4) — apenas persiste o que o E8 já tem disponível.
 */
export function construirSnapshotFinanceiro({ orcamento, dadosConsumo, dimensionamento }) {
  const o = orcamento || {}
  return {
    criado_em: new Date().toISOString(),
    custo_kit: o.subtotalPaineis != null
      ? +(((o.subtotalPaineis || 0) + (o.subtotalInversores || 0) + (o.subtotalEstrutura || 0))).toFixed(2)
      : null,
    custo_mao_obra: o.subtotalMaoDeTrabaho ?? null,
    custo_cabos_protecao: o.subtotalCabosProtecao ?? null,
    custo_total: o.total ?? null,
    // Campos arquiteturais reservados para Sprint 4 (preenchidos quando houver motor)
    margem_pct: o.margem_pct ?? null,
    impostos_pct: o.impostos_pct ?? null,
    desconto_pct: o.desconto_pct ?? null,
    roi_pct: o.roi_pct ?? null,
    payback_anos: o.payback_anos ?? null,
    proposta_cliente: o.preco_venda ?? o.total ?? null,
    preco_wp: (o.total && dimensionamento?.potenciaRealKwp)
      ? +(o.total / (dimensionamento.potenciaRealKwp * 1000)).toFixed(2)
      : null,
  }
}

// ─── Builder agregado ───────────────────────────────────────────────────────────

/**
 * Constrói todos os snapshots a partir do estado do wizard + SVG do unifilar.
 * Retorna o payload pronto para POST /governanca/congelar.
 */
export function construirTodosSnapshots({ state, orcamentoLocal, unifilarSVG }) {
  const { equipamentos, dimensionamento, dadosConsumo, localizacao } = state
  const painel = equipamentos?.painel || null
  const inversor = equipamentos?.inversor || null

  const tecnico = construirSnapshotTecnico({
    painel, inversor,
    arranjoMPPTs: equipamentos?.arranjoMPPTs || null,
    dimensionamento, dadosConsumo,
    uf: localizacao?.uf || null,
  })

  return {
    tecnico,
    catalogo: construirSnapshotCatalogo({ painel, inversor, dimensionamento }),
    unifilar: construirSnapshotUnifilar(unifilarSVG),
    memorial: construirSnapshotMemorial({ snapshotTecnico: tecnico, dadosConsumo, localizacao }),
    financeiro: construirSnapshotFinanceiro({ orcamento: orcamentoLocal, dadosConsumo, dimensionamento }),
  }
}

// ─── Config de UI ───────────────────────────────────────────────────────────────

export const FREEZE_STATUS_CONFIG = {
  RASCUNHO:   { label: 'RASCUNHO',   cor: 'cinza',   corHex: '#64748b', descricao: 'Em edição — pode ser recalculado livremente.' },
  EM_REVISAO: { label: 'EM REVISÃO', cor: 'azul',    corHex: '#3b82f6', descricao: 'Revisão aberta para ajustes de engenharia.' },
  CONGELADO:  { label: 'CONGELADO',  cor: 'laranja', corHex: '#f97316', descricao: 'Snapshots travados — não recalcula automaticamente.' },
  HOMOLOGADO: { label: 'HOMOLOGADO', cor: 'verde',   corHex: '#10b981', descricao: 'Aprovado e estável — documento técnico definitivo.' },
}

export function getFreezeStatusConfig(status) {
  return FREEZE_STATUS_CONFIG[status] || FREEZE_STATUS_CONFIG.RASCUNHO
}

export const HISTORICO_TIPO_CONFIG = {
  criado:                 { label: 'Projeto criado',          icon: '🆕' },
  engenharia_recalculada: { label: 'Engenharia recalculada',  icon: '⚙️' },
  catalogo_atualizado:    { label: 'Catálogo atualizado',     icon: '📦' },
  revisao:                { label: 'Revisão criada',          icon: '📝' },
  em_revisao:             { label: 'Reaberto para revisão',   icon: '📝' },
  congelado:              { label: 'Proposta congelada',      icon: '🔒' },
  homologado:             { label: 'Proposta homologada',     icon: '✅' },
  rascunho:               { label: 'Voltou a rascunho',       icon: '✏️' },
}

export function getHistoricoTipoConfig(tipo) {
  return HISTORICO_TIPO_CONFIG[tipo] || { label: tipo || 'Evento', icon: '•' }
}
