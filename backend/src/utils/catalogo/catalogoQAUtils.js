/**
 * catalogoQAUtils.js — Sprint 8.6.4
 * Helpers PUROS de QA do catálogo de inversores.
 * Sem I/O. Recebe documentos Equipamento em POJO e devolve métricas.
 */

// Campos críticos do inversor mapeados para os aliases do banco (pós-8.6.3)
export const CAMPOS_CRITICOS_INVERSOR = [
  { rotulo: 'Fabricante',        aliases: ['fabricante'],   nivel: 'topo' },
  { rotulo: 'Modelo',            aliases: ['modelo'],       nivel: 'topo' },
  { rotulo: 'Potência nominal',  aliases: ['potencia_kw', 'potencia_nominal_kw', 'potenciaKW', 'potencia'] },
  { rotulo: 'Nº MPPT',          aliases: ['n_mppts', 'mppts', 'nMppts'] },
  { rotulo: 'Tensão máx CC',    aliases: ['tensao_max_entrada', 'voc_max', 'tensao_max_cc'] },
  { rotulo: 'Faixa MPPT mín',   aliases: ['tensao_mppt_min', 'faixa_mppt_min'] },
  { rotulo: 'Faixa MPPT máx',   aliases: ['tensao_mppt_max', 'faixa_mppt_max'] },
  { rotulo: 'Corrente máx MPPT', aliases: ['corrente_max_por_mppt', 'corrente_max_mppt'] },
  { rotulo: 'Fases',             aliases: ['fases', 'faseAC'] },
  { rotulo: 'Eficiência máx',   aliases: ['eficiencia_maxima', 'eficiencia'] },
  { rotulo: 'Garantia',          aliases: ['garantia_anos', 'garantia'] },
]

/**
 * Lê o primeiro alias disponível num objeto flat (especificacoes ou topo do eq).
 */
function lerCampo(eq, campo) {
  if (campo.nivel === 'topo') {
    const k = campo.aliases[0]
    const v = eq?.[k]
    return (v != null && v !== '') ? v : null
  }
  const esp = eq?.especificacoes || {}
  for (const a of campo.aliases) {
    const v = esp[a]
    if (v != null && v !== '') return v
  }
  return null
}

/**
 * Audita um equipamento do tipo inversor.
 * @returns {{ _id, fabricante, modelo, camposOk, camposFaltando, completude_pct, precisa_reprocessamento }}
 */
export function auditarInversor(eq) {
  const camposOk = []
  const camposFaltando = []

  for (const campo of CAMPOS_CRITICOS_INVERSOR) {
    const valor = lerCampo(eq, campo)
    if (valor != null) camposOk.push(campo.rotulo)
    else camposFaltando.push(campo.rotulo)
  }

  const total = CAMPOS_CRITICOS_INVERSOR.length
  const completude_pct = Math.round((camposOk.length / total) * 100)
  const temDatasheet = (
    Array.isArray(eq?.documentos_tecnicos) && eq.documentos_tecnicos.some(d => String(d?.tipo || '').toLowerCase() === 'datasheet')
  ) || !!eq?.datasheet_original?.hash

  return {
    _id: eq._id || null,
    fabricante: eq?.fabricante || null,
    modelo: eq?.modelo || null,
    completude_pct,
    campos_ok: camposOk,
    campos_faltando: camposFaltando,
    tem_datasheet: temDatasheet,
    aprovacao_status: eq?.aprovacao_tecnica?.status || 'aprovado',
    precisa_reprocessamento: camposFaltando.length > 3 && temDatasheet,
    createdAt: eq?.createdAt || null,
  }
}

/**
 * Constrói o relatório de saúde de um array de inversores.
 * @returns {{ total, por_status, campos_faltando: {[rotulo]: number}, completude_media_pct, lista }}
 */
export function relatorioSaudeInversores(inversores) {
  const por_status = { aprovado: 0, pendente: 0, bloqueado: 0, rascunho: 0 }
  const campos_faltando = {}
  const lista = []
  let somaCompletude = 0

  for (const campo of CAMPOS_CRITICOS_INVERSOR) campos_faltando[campo.rotulo] = 0

  for (const eq of inversores) {
    const a = auditarInversor(eq)
    lista.push(a)
    somaCompletude += a.completude_pct
    for (const f of a.campos_faltando) {
      campos_faltando[f] = (campos_faltando[f] || 0) + 1
    }
    const st = eq?.aprovacao_tecnica?.status || 'aprovado'
    if (st in por_status) por_status[st]++
    else por_status.aprovado++
  }

  const total = inversores.length
  return {
    total,
    por_status,
    campos_faltando,
    completude_media_pct: total > 0 ? Math.round(somaCompletude / total) : 0,
    precisam_reprocessamento: lista.filter(e => e.precisa_reprocessamento).length,
    lista,
  }
}

/**
 * Detecta prováveis duplicatas em uma lista (mesmo fabricante + prefixo de modelo).
 * Não apaga — apenas sinaliza para o operador.
 * @returns Array de grupos: [{ chave, docs[] }]
 */
export function detectarDuplicatas(equipamentos) {
  const grupos = {}
  for (const eq of equipamentos) {
    const fab = String(eq?.fabricante || '').trim().toUpperCase()
    const mod = String(eq?.modelo || '').trim().toUpperCase()
    if (!fab || !mod) continue
    // Chave: fabricante + primeiros 8 chars do modelo
    const chave = `${fab}||${mod.slice(0, 8)}`
    if (!grupos[chave]) grupos[chave] = []
    grupos[chave].push({ _id: eq._id, fabricante: eq.fabricante, modelo: eq.modelo, completude_pct: auditarInversor(eq).completude_pct, createdAt: eq.createdAt })
  }
  return Object.entries(grupos)
    .filter(([, docs]) => docs.length > 1)
    .map(([chave, docs]) => ({ chave, prefixo: chave.split('||')[1], fabricante: docs[0].fabricante, docs: docs.sort((a, b) => b.completude_pct - a.completude_pct) }))
}
