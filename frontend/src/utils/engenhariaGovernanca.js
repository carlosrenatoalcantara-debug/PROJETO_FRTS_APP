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
import { calcularFinanceiroCompleto } from './financeiroEngine'
import { consolidarPanos, dimensoesModulo } from './geoEngine'

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
// ─── Snapshot geoespacial (S6) ──────────────────────────────────────────────────

/**
 * Congela a geometria do telhado: panos, área útil real, obstáculos, capacidade
 * máxima de módulos e fator de geração (orientação/inclinação/sombra). Alimenta
 * o snapshot técnico (engineering lock geoespacial).
 */
export function construirSnapshotGeoespacial({ panos, lat, lon, painel }) {
  if (!Array.isArray(panos) || panos.length === 0) return null
  const c = consolidarPanos(panos, { moduloDims: dimensoesModulo(painel) })
  const snap = {
    criado_em: new Date().toISOString(),
    coordenadas: (lat != null && lon != null) ? { lat, lon } : null,
    total_panos: c.total_panos,
    area_bruta_total: c.area_bruta_total,
    area_util_total: c.area_util_total,
    max_modulos_total: c.max_modulos_total,
    fator_geracao_medio: c.fator_geracao_medio,
    fator_sombra_medio: c.fator_sombra_medio,
    panos: c.panos,
  }
  snap.hash = hashTecnico(snap)
  return snap
}

export function construirSnapshotTecnico({ painel, inversor, arranjoMPPTs, dimensionamento, dadosConsumo, uf, irradiancia, geoespacial }) {
  let modelo = null
  try {
    modelo = montarModeloEletrico({ painel, inversor, arranjoMPPTs, dimensionamento, dadosConsumo, uf })
  } catch (e) {
    modelo = { erro: e.message }
  }

  const potCC = modelo?.sistema?.potenciaCC ?? null
  const potCA = modelo?.sistema?.potenciaCA ?? null
  const oversizing = (potCC && potCA) ? +(potCC / potCA).toFixed(3) : null

  // Geração anual congelada (engineering lock p/ ROI/payback no módulo financeiro).
  // potenciaCC (kWp) × irradiância média (kWh/m²/dia) × 365 × PR(0.80).
  const irradDia = irradiancia?.mediaAnual ?? dimensionamento?.irradianciaMediaDia ?? null
  const PR = 0.80
  // S6: fator de geração geoespacial (orientação/inclinação/sombra) ajusta a geração
  const fatorGeo = geoespacial?.fator_geracao_medio ?? 1
  const geracaoAnualKwh = (potCC && irradDia)
    ? +(potCC * irradDia * 365 * PR * fatorGeo).toFixed(0)
    : (dimensionamento?.geracao_anual_kwh ?? null)

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
    geracao_anual_kwh: geracaoAnualKwh,
    performance_ratio: PR,
    // S6: resumo geoespacial embutido no snapshot técnico (engineering lock)
    geoespacial: geoespacial ? {
      area_util_total: geoespacial.area_util_total,
      max_modulos_total: geoespacial.max_modulos_total,
      fator_geracao_medio: geoespacial.fator_geracao_medio,
      fator_sombra_medio: geoespacial.fator_sombra_medio,
      total_panos: geoespacial.total_panos,
    } : null,
    cabos: modelo?.cabos ?? null,
    protecoes: modelo?.protecoes ?? null,
    normas_aplicadas: ['NBR 16690', 'NBR 5410', 'NBR 16274', 'PRODIST Módulo 3'],
  }
  snapshot.hash = hashTecnico(snapshot)
  return snapshot
}

// ─── Snapshot institucional (S7.1) ──────────────────────────────────────────────

/**
 * Congela os dados da empresa no momento da proposta. Projetos congelados
 * continuam exibindo a identidade institucional da época (governança).
 */
export function construirSnapshotEmpresa(empresa) {
  if (!empresa) return null
  const snap = {
    criado_em: new Date().toISOString(),
    razao_social: empresa.razaoSocial ?? null,
    nome_fantasia: empresa.nomeFantasia ?? empresa.nomeEmpresa ?? null,
    cnpj: empresa.cnpj ?? null,
    ie: empresa.ie ?? null,
    endereco: empresa.endereco ?? null,
    cidade: empresa.cidade ?? null,
    uf: empresa.estado ?? null,
    cep: empresa.cep ?? null,
    telefone: empresa.telefone ?? null,
    whatsapp: empresa.whatsapp ?? null,
    email: empresa.email ?? null,
    website: empresa.site ?? null,
    logo: empresa.logo ?? null,
    cor_primaria: empresa.corPrimaria ?? null,
    cor_secundaria: empresa.corSecundaria ?? null,
  }
  snap.hash = hashTecnico(snap)
  return snap
}

/**
 * Congela a identificação do responsável técnico (CREA/CFT, modalidade) —
 * rastreabilidade de quem respondeu tecnicamente pela proposta congelada.
 */
export function construirSnapshotTecnicoIdentificacao(empresa) {
  const rt = empresa?.responsavelTecnico
  if (!rt) return null
  const snap = {
    criado_em: new Date().toISOString(),
    nome: rt.nome ?? null,
    tipo_registro: rt.tipoRegistro ?? null,
    registro: rt.registro ?? null,
    uf_registro: rt.uf ?? null,
    modalidade: rt.modalidade ?? null,
    cargo: rt.cargo ?? null,
    telefone: rt.telefone ?? null,
    email: rt.email ?? null,
    assinatura: empresa?.uploads?.assinatura ?? null,
    carimbo: empresa?.uploads?.carimbo ?? null,
  }
  snap.hash = hashTecnico(snap)
  return snap
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

// ─── Snapshot financeiro (Sprint 4 — módulo financeiro EPC) ──────────────────────

/**
 * Congela a análise financeira completa da proposta.
 *
 * ENGINEERING LOCK: o resultado financeiro é calculado a partir do
 * snapshotTecnico (geração/potência congeladas), nunca do state vivo.
 *
 * Aceita DUAS formas:
 *  1. `resultadoFinanceiro` já calculado pelo CentroFinanceiroFV (preferido) —
 *     apenas congela e normaliza.
 *  2. `orcamento` legado do E8 (precos/subtotais) — recalcula via engine para
 *     manter compatibilidade com o fluxo antigo.
 */
export function construirSnapshotFinanceiro({ resultadoFinanceiro, orcamento, snapshotTecnico, tarifa, dimensionamento }) {
  // Caminho 1: já temos o resultado do centro financeiro
  if (resultadoFinanceiro && resultadoFinanceiro.orcamento) {
    const r = resultadoFinanceiro
    return {
      criado_em: new Date().toISOString(),
      modo: r.modo,
      composicao: r.orcamento.composicao ?? null,
      custos: r.orcamento.composicao?.itens ?? null,
      custo_total: r.orcamento.custo_total ?? r.margem?.custo_total ?? null,
      markup_percentual: r.orcamento.markup_percentual ?? null,
      desconto_percentual: r.orcamento.desconto_percentual ?? null,
      margem: r.margem ?? null,
      financiamento: r.financiamento ?? null,
      parcelamento: r.parcelamento ?? null,
      retorno: r.retorno ?? null,
      // S4.1: cenário regulatório congelado (Lei 14.300)
      retorno_realista: r.retorno_realista ?? null,
      regulatorio: r.regulatorio ?? null,
      comparacao: r.comparacao ?? null,
      cenario_exibicao: r.cenario_exibicao ?? 'otimista',
      tarifa: r.tarifa ?? null,
      proposta_final: r.orcamento.preco_venda ?? null,
      visao_cliente: r.visao_cliente ?? null,
      preco_wp: (r.orcamento.preco_venda && snapshotTecnico?.sistema?.potenciaCC)
        ? +(r.orcamento.preco_venda / (snapshotTecnico.sistema.potenciaCC * 1000)).toFixed(2)
        : null,
    }
  }

  // Caminho 2: compatibilidade com o orçamento legado do E8
  const o = orcamento || {}
  const custos = {
    custo_painel:    o.subtotalPaineis ?? 0,
    custo_inversor:  o.subtotalInversores ?? 0,
    custo_estrutura: o.subtotalEstrutura ?? 0,
    custo_mao_obra:  o.subtotalMaoDeTrabaho ?? 0,
    custo_cabos:     o.subtotalCabosProtecao ?? 0,
  }
  let calc = null
  try {
    calc = calcularFinanceiroCompleto({
      modo: 'kit_fechado',
      valorVendaKit: o.total ?? 0,
      custos,
      snapshotTecnico,
      tarifa: tarifa || {},
    })
  } catch { /* ignora — snapshot básico abaixo */ }

  return {
    criado_em: new Date().toISOString(),
    modo: 'kit_fechado',
    composicao: calc?.orcamento?.composicao ?? null,
    custos,
    custo_total: calc?.orcamento?.custo_total ?? null,
    margem: calc?.margem ?? null,
    retorno: calc?.retorno ?? null,
    tarifa: calc?.tarifa ?? null,
    proposta_final: o.total ?? null,
    visao_cliente: calc?.visao_cliente ?? null,
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
export function construirTodosSnapshots({ state, orcamentoLocal, unifilarSVG, resultadoFinanceiro, tarifa, empresa }) {
  const { equipamentos, dimensionamento, dadosConsumo, localizacao, irradiancia, area } = state
  const painel = equipamentos?.painel || null
  const inversor = equipamentos?.inversor || null

  // S6: snapshot geoespacial (panos) → alimenta o snapshot técnico
  const geoespacial = construirSnapshotGeoespacial({
    panos: area?.panos || [],
    lat: localizacao?.lat ?? null,
    lon: localizacao?.lon ?? null,
    painel,
  })

  const tecnico = construirSnapshotTecnico({
    painel, inversor,
    arranjoMPPTs: equipamentos?.arranjoMPPTs || null,
    dimensionamento, dadosConsumo,
    uf: localizacao?.uf || null,
    irradiancia,
    geoespacial,
  })

  return {
    tecnico,
    geoespacial,
    empresa: construirSnapshotEmpresa(empresa),
    tecnico_identificacao: construirSnapshotTecnicoIdentificacao(empresa),
    catalogo: construirSnapshotCatalogo({ painel, inversor, dimensionamento }),
    unifilar: construirSnapshotUnifilar(unifilarSVG),
    memorial: construirSnapshotMemorial({ snapshotTecnico: tecnico, dadosConsumo, localizacao }),
    financeiro: construirSnapshotFinanceiro({
      resultadoFinanceiro,
      orcamento: orcamentoLocal,
      snapshotTecnico: tecnico,
      tarifa,
      dimensionamento,
    }),
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
