/**
 * projetoFVApi.js — S2.8
 *
 * Camada de serviço para o endpoint ProjetoFV v3.
 * Centraliza:
 *   - URL base (sem hardcoded localhost)
 *   - Adapters camelCase (Context v2) → snake_case (API v3)
 *   - Chamadas CRUD e de slice
 */

// ⚠️ FIX (FV-07): URL relativa forçada — Vercel proxy → Railway.
// VITE_API_URL em .env.production apontava para https://fortesolar.com.br/api
// (site institucional Wix), causando GET /api/api/clientes contra domínio errado
// e falha "Erro ao salvar: Failed to fetch" no Salvar Proposta do E8.
// Mesmo padrão usado em ProjetosEV.jsx, ProjetosEVDetalhes.jsx, E1Upload.jsx.
const API_URL = ''

// ─── Adapters camelCase → snake_case ─────────────────────────────────────────
// Cada adapter recebe o slice do ProjetoFVContext e retorna o payload v3.

/**
 * Adapter: localizacao
 * Context: { endereco, lat, lon, cidadeEstado, uf, geocoding_origem, geocoding_confianca, geocodificado_em }
 * v3:      { endereco_completo, latitude, longitude, cidade, estado, geocoding_*, irradiancia_kwh_kwp_dia }
 */
export function adaptarLocalizacao(loc, irrad) {
  if (!loc) return null
  // Extrai cidade e estado de cidadeEstado "Natal, RN" ou usa uf diretamente
  const partes   = loc.cidadeEstado ? loc.cidadeEstado.split(',') : []
  const cidade   = partes[0]?.trim()  || null
  const estadoStr = loc.uf || partes[1]?.trim() || null

  return {
    endereco_completo:       loc.endereco            || null,
    latitude:                loc.lat                 ?? null,
    longitude:               loc.lon                 ?? null,
    cidade,
    estado:                  estadoStr,
    geocoding_origem:        loc.geocoding_origem     || null,
    geocoding_confianca:     loc.geocoding_confianca  ?? null,
    geocodificado_em:        loc.geocodificado_em     || null,
    // Irradiância vem do slice irradiancia quando disponível
    irradiancia_kwh_kwp_dia: irrad?.mediaAnual        ?? null,
    fonte_irradiancia:       irrad?.mediaAnual ? (irrad.fonte === 'nasa' ? 'nasa_power' : 'padrao_regional') : null,
  }
}

/**
 * Adapter: dimensionamento
 * Context: { potenciaKwp, potenciaRealKwp, numPaineis, numInversores, energiaDiaria,
 *            energiaNecessaria, areaMinima, potenciaPainelW, capacidadeInversorKW }
 * v3:      { potencia_kwp, geracao_mensal_kwh, num_paineis, num_inversores,
 *            performance_ratio, area_total_m2, metodo, calculado_em }
 */
export function adaptarDimensionamento(dim, irrad) {
  if (!dim || !dim.potenciaKwp) return null
  const kwp   = dim.potenciaRealKwp ?? dim.potenciaKwp ?? null
  const irr   = irrad?.mediaAnual ?? null
  // Estimativa de geração: potência × irradiância × 30d × PR=0.80
  const gMes  = kwp && irr ? parseFloat((kwp * irr * 30 * 0.80).toFixed(1)) : null

  return {
    potencia_kwp:        kwp,
    geracao_mensal_kwh:  gMes,
    geracao_anual_kwh:   gMes ? parseFloat((gMes * 12).toFixed(1)) : null,
    num_paineis:         dim.numPaineis      ?? null,
    num_strings:         null,               // calculado em S2.9 com stringing
    num_inversores:      dim.numInversores   ?? null,
    performance_ratio:   0.80,               // fixo no calcDimensionamento atual
    fator_capacidade:    null,
    area_total_m2:       dim.areaMinima      ?? null,
    metodo:              'automatico',
    calculado_em:        new Date().toISOString(),
  }
}

/**
 * Adapter: equipamentos
 * Context: { painel (objeto singular), inversor (objeto), estrutura (objeto) }
 * v3:      { paineis (array), inversor (objeto), estrutura (objeto) }
 * ATENÇÃO: painel singular → paineis[] — shape muda.
 */
export function adaptarEquipamentos(equip, dim) {
  if (!equip) return null
  const { painel, inversor, estrutura } = equip

  return {
    paineis: painel ? [{
      id:           painel._id   || painel.id   || null,
      marca:        painel.marca                || null,
      modelo:       painel.modelo               || null,
      potencia_w:   painel.potenciaW || painel.potencia_w || null,
      quantidade:   dim?.numPaineis             ?? null,
      // equipamento_id preenchido em S2.9 com referência ao catálogo
      equipamento_id: painel._id || null,
    }] : [],
    inversor: inversor ? {
      id:          inversor._id  || inversor.id  || null,
      marca:       inversor.marca                || null,
      modelo:      inversor.modelo               || null,
      potencia_kw: inversor.potenciaKW || inversor.potencia_kw || null,
      tipo:        inversor.tipo || null,
      fases:       inversor.fases || null,
    } : undefined,
    estrutura: estrutura ? {
      tipo:      estrutura.tipo      || null,
      descricao: estrutura.descricao || null,
    } : undefined,
  }
}

/**
 * Adapter: layout_solar
 * Context.area: { areaDisponivel, orientacao, inclinacao, suficiente }
 * v3: { area_util_m2, orientacao, inclinacao_graus }
 */
export function adaptarLayoutSolar(area) {
  if (!area || !area.areaDisponivel) return null
  return {
    area_util_m2:     parseFloat(area.areaDisponivel) || null,
    orientacao:       area.orientacao   || null,
    inclinacao_graus: parseFloat(area.inclinacao) || null,
  }
}

/**
 * Adapter: orcamento
 * Estado local do E8Orcamento (preços, subtotais, total).
 */
export function adaptarOrcamento({ total, subtotalPaineis, subtotalInversores,
  subtotalEstrutura, subtotalMaoDeTrabaho, subtotalCabosProtecao }) {
  return {
    custo_total_r:        total                ?? null,
    custo_equipamentos_r: (subtotalPaineis ?? 0) + (subtotalInversores ?? 0) + (subtotalEstrutura ?? 0),
    custo_mao_obra_r:     subtotalMaoDeTrabaho ?? null,
    custo_outros_r:       subtotalCabosProtecao ?? null,
    calculado_em:         new Date().toISOString(),
  }
}

/**
 * Adapter: workflow
 * Context: { etapa, dadosCliente }
 * v3: { etapa_atual, etapas_completas, fluxo_origem, ultima_atividade }
 */
export function adaptarWorkflow(etapa, etapasCompletas = []) {
  return {
    etapa_atual:         etapa,
    etapas_completas:    etapasCompletas,
    fluxo_origem:        'wizard_v2',
    ultima_atividade:    new Date().toISOString(),
  }
}

// ─── Chamadas à API ───────────────────────────────────────────────────────────

async function _fetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.erro || `HTTP ${res.status}: ${path}`)
  }
  return res.json()
}

/**
 * Cria um novo ProjetoFV.
 */
export function criarProjeto({ clienteId, nome, status = 'rascunho',
  latitude, longitude, endereco_completo }) {
  return _fetch('/api/projetos-fv', {
    method: 'POST',
    body: JSON.stringify({ clienteId, nome, status, latitude, longitude, endereco_completo }),
  })
}

/**
 * Salva um slice individualmente via PUT /api/projetos-fv/:id/etapa.
 * etapa: 'localizacao' | 'dimensionamento' | 'equipamentos' |
 *        'layout_solar' | 'orcamento' | 'workflow' | ...
 */
export function salvarEtapa(projetoId, etapa, dados) {
  return _fetch(`/api/projetos-fv/${projetoId}/etapa`, {
    method: 'PUT',
    body: JSON.stringify({ etapa, dados }),
  })
}

/**
 * Busca um ProjetoFV pelo ID (para retomada).
 */
export function buscarProjeto(projetoId) {
  return _fetch(`/api/projetos-fv/${projetoId}`)
}

/**
 * FV-04: Persiste beneficiárias locais no DB (em lote) após criação do projeto.
 * Recebe array do context (podem ter localId em vez de _id).
 * Apenas registros sem _id são criados (os que têm _id já estão no DB).
 */
export async function criarBeneficiariasLote(projetoId, beneficiarias = []) {
  const locais = beneficiarias.filter(b => !b._id)
  const resultado = { salvo: [], falhou: [] }

  for (const b of locais) {
    const { localId, ...dados } = b   // remove localId antes de enviar
    try {
      await _fetch(`/api/projetos-fv/${projetoId}/beneficiarias`, {
        method: 'POST',
        body: JSON.stringify(dados),
      })
      resultado.salvo.push(b.contaContrato)
    } catch (err) {
      console.warn(`[projetoFVApi] Beneficiária "${b.contaContrato}" falhou:`, err.message)
      resultado.falhou.push({ contaContrato: b.contaContrato, erro: err.message })
    }
  }

  return resultado
}

/**
 * Lista todos os clientes.
 */
export function buscarClientes() {
  return _fetch('/api/clientes')
}

// ─── S3.5: Governança técnica ───────────────────────────────────────────────────

/**
 * Congela os snapshots do projeto e trava recálculo.
 * @param {string} projetoId
 * @param {{ snapshots, engineering_version, usuario, motivo, novo_status }} payload
 */
export function congelarProjeto(projetoId, payload) {
  return _fetch(`/api/projetos-fv/${projetoId}/governanca/congelar`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** Cria nova revisão (Rev A→B) e reabre a engenharia (EM_REVISAO). */
export function criarRevisao(projetoId, { usuario, motivo, alteracoes } = {}) {
  return _fetch(`/api/projetos-fv/${projetoId}/governanca/revisao`, {
    method: 'POST',
    body: JSON.stringify({ usuario, motivo, alteracoes }),
  })
}

/** Altera manualmente o status de governança. */
export function alterarStatusGovernanca(projetoId, status, usuario = null) {
  return _fetch(`/api/projetos-fv/${projetoId}/governanca/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, usuario }),
  })
}

/** Detecta divergência entre o snapshot congelado e o catálogo vivo. */
export function buscarDivergencia(projetoId) {
  return _fetch(`/api/projetos-fv/${projetoId}/governanca/divergencia`)
}

/**
 * Resolve clienteId a partir do nome do cliente (mesmo comportamento de E8 legado).
 * Retorna null se não encontrado.
 */
export async function resolverClientePorNome(nomeCliente) {
  if (!nomeCliente?.trim()) return null
  const clientes = await buscarClientes()
  return clientes.find(c =>
    c.nome.toLowerCase() === nomeCliente.trim().toLowerCase()
  ) || null
}

/**
 * Salva todos os slices acumulados após a criação do projeto.
 * Fire-and-forget por slice — falha silenciosa para não bloquear o usuário.
 * Retorna relatório de { salvo: [], falhou: [] }
 */
export async function salvarTodosSlices(projetoId, state, orcamentoLocal) {
  const { localizacao, irradiancia, dimensionamento, area, equipamentos, etapa, beneficiarias } = state

  const slices = [
    { etapa: 'localizacao',     dados: adaptarLocalizacao(localizacao, irradiancia) },
    { etapa: 'dimensionamento', dados: adaptarDimensionamento(dimensionamento, irradiancia) },
    { etapa: 'equipamentos',    dados: adaptarEquipamentos(equipamentos, dimensionamento) },
    { etapa: 'layout_solar',    dados: adaptarLayoutSolar(area) },
    { etapa: 'orcamento',       dados: orcamentoLocal ? adaptarOrcamento(orcamentoLocal) : null },
    { etapa: 'workflow',        dados: adaptarWorkflow(etapa, Array.from({length: etapa}, (_, i) => i + 1)) },
  ].filter(s => s.dados !== null)

  const resultado = { salvo: [], falhou: [] }

  for (const s of slices) {
    try {
      await salvarEtapa(projetoId, s.etapa, s.dados)
      resultado.salvo.push(s.etapa)
    } catch (err) {
      console.warn(`[projetoFVApi] Slice "${s.etapa}" falhou:`, err.message)
      resultado.falhou.push({ etapa: s.etapa, erro: err.message })
    }
  }

  // FV-04: persiste beneficiárias locais no DB
  if (Array.isArray(beneficiarias) && beneficiarias.length > 0) {
    try {
      const resBenef = await criarBeneficiariasLote(projetoId, beneficiarias)
      if (resBenef.salvo.length > 0)
        resultado.salvo.push(`beneficiarias(${resBenef.salvo.length})`)
      if (resBenef.falhou.length > 0)
        resultado.falhou.push(...resBenef.falhou.map(f => ({ etapa: 'beneficiaria', ...f })))
    } catch (err) {
      console.warn('[projetoFVApi] Beneficiárias em lote falharam:', err.message)
    }
  }

  return resultado
}
