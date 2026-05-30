/**
 * alertDetectors.js — Sprint 8.8
 *
 * Detectores PUROS de alertas operacionais. Cada função recebe uma lista de
 * documentos JÁ carregados (POJOs lean) e devolve [{ id, titulo, descricao,
 * origem, severidade, data, acao_recomendada, link, contexto }].
 *
 * NÃO acessa banco, NÃO chama IA. As ações de I/O ficam no agregador (route).
 * Filosofia: consolidar eventos que JÁ existem (Tecnico.validade_carteira,
 * Equipamento.aprovacao_tecnica, FaturaEnergia.alertas, etc.). Não cria
 * sistema paralelo.
 */

export const SEVERIDADES = ['info', 'aviso', 'erro', 'critico']
export const ORIGENS = ['rt', 'catalogo', 'documento', 'projeto', 'fatura']

const DIA_MS = 24 * 60 * 60 * 1000

function _id(prefixo, ...partes) {
  return `${prefixo}:${partes.filter(Boolean).join(':')}`
}

// ── 1. ALERTAS DE RT (técnicos) ────────────────────────────────────────────

/**
 * Detecta RTs com carteira vencendo ou vencida.
 * 90 dias → info, 30 dias → aviso, vencido → crítico.
 *
 * @param {Array<object>} tecnicos  lista de Tecnico (lean)
 * @param {Date} [hoje]             para testes reprodutíveis
 */
export function detectarAlertasRT(tecnicos, hoje = new Date()) {
  const alertas = []
  for (const t of tecnicos || []) {
    if (t.ativo === false) continue
    const v = t.validade_carteira_profissional
    if (!v) continue
    const validade = new Date(v)
    if (Number.isNaN(validade.getTime())) continue
    const diasRestantes = Math.floor((validade.getTime() - hoje.getTime()) / DIA_MS)

    if (diasRestantes < 0) {
      alertas.push({
        id: _id('rt_vencido', t._id),
        origem: 'rt', severidade: 'critico',
        titulo: `Carteira do RT ${t.nome} VENCIDA`,
        descricao: `Vencida há ${Math.abs(diasRestantes)} dia(s) (${validade.toLocaleDateString('pt-BR')}). Não pode assinar projetos.`,
        data: validade.toISOString(),
        acao_recomendada: 'Renovar registro profissional e atualizar cadastro.',
        link: `/configuracoes#tecnicos/${t._id}`,
        contexto: { tecnico_id: t._id, dias: diasRestantes },
      })
    } else if (diasRestantes <= 30) {
      alertas.push({
        id: _id('rt_30d', t._id),
        origem: 'rt', severidade: 'aviso',
        titulo: `Carteira do RT ${t.nome} vence em ${diasRestantes} dia(s)`,
        descricao: `Validade: ${validade.toLocaleDateString('pt-BR')}.`,
        data: validade.toISOString(),
        acao_recomendada: 'Providenciar renovação antes do vencimento.',
        link: `/configuracoes#tecnicos/${t._id}`,
        contexto: { tecnico_id: t._id, dias: diasRestantes },
      })
    } else if (diasRestantes <= 90) {
      alertas.push({
        id: _id('rt_90d', t._id),
        origem: 'rt', severidade: 'info',
        titulo: `Carteira do RT ${t.nome} vence em ${diasRestantes} dias`,
        descricao: `Validade: ${validade.toLocaleDateString('pt-BR')}.`,
        data: validade.toISOString(),
        acao_recomendada: 'Programar renovação.',
        link: `/configuracoes#tecnicos/${t._id}`,
        contexto: { tecnico_id: t._id, dias: diasRestantes },
      })
    }
  }
  return alertas
}

// ── 2. ALERTAS DE CATÁLOGO ──────────────────────────────────────────────────

const COMPLETUDE_MINIMA = 80

export function detectarAlertasCatalogo(equipamentos, diagnosticadores = {}) {
  const { diagnosticarFicha } = diagnosticadores
  const alertas = []
  for (const eq of equipamentos || []) {
    const status = eq.aprovacao_tecnica?.status

    // Bloqueado
    if (status === 'bloqueado') {
      alertas.push({
        id: _id('cat_bloqueado', eq._id),
        origem: 'catalogo', severidade: 'erro',
        titulo: `${eq.fabricante || '?'} ${eq.modelo || '?'} bloqueado`,
        descricao: eq.aprovacao_tecnica?.motivo || 'Status técnico: bloqueado.',
        data: (eq.updatedAt || eq.createdAt || new Date()).toString(),
        acao_recomendada: 'Revisar e desbloquear ou substituir.',
        link: `/catalogo?eq=${eq._id}`,
        contexto: { equipamento_id: eq._id, tipo: eq.tipo },
      })
      continue
    }

    // Pendente
    if (status === 'pendente') {
      alertas.push({
        id: _id('cat_pendente', eq._id),
        origem: 'catalogo', severidade: 'aviso',
        titulo: `${eq.fabricante || '?'} ${eq.modelo || '?'} aguarda aprovação`,
        descricao: 'Equipamento pendente de aprovação técnica.',
        data: (eq.updatedAt || eq.createdAt || new Date()).toString(),
        acao_recomendada: 'Revisar ficha técnica e aprovar.',
        link: `/catalogo?eq=${eq._id}`,
        contexto: { equipamento_id: eq._id },
      })
    }

    // Sem datasheet
    const temDatasheet = (Array.isArray(eq.documentos_tecnicos) && eq.documentos_tecnicos.some(d => String(d?.tipo || '').toLowerCase() === 'datasheet')) || !!eq.datasheet_original?.hash
    if (!temDatasheet) {
      alertas.push({
        id: _id('cat_sem_datasheet', eq._id),
        origem: 'catalogo', severidade: 'aviso',
        titulo: `${eq.fabricante || '?'} ${eq.modelo || '?'} sem datasheet`,
        descricao: 'Equipamento sem datasheet original anexado.',
        data: (eq.updatedAt || new Date()).toString(),
        acao_recomendada: 'Anexar datasheet PDF.',
        link: `/catalogo?eq=${eq._id}`,
        contexto: { equipamento_id: eq._id },
      })
    }

    // Sem certificação (apenas inversores/módulos relevantes)
    const certs = eq.certificacao || {}
    const semCert = !certs.inmetro?.numero && (!Array.isArray(certs.normas_iec) || certs.normas_iec.length === 0)
    if (semCert && ['inversor', 'modulo'].includes(eq.tipo)) {
      alertas.push({
        id: _id('cat_sem_cert', eq._id),
        origem: 'catalogo', severidade: 'aviso',
        titulo: `${eq.fabricante || '?'} ${eq.modelo || '?'} sem certificação`,
        descricao: 'Sem INMETRO nem normas IEC declaradas.',
        data: (eq.updatedAt || new Date()).toString(),
        acao_recomendada: 'Cadastrar certificações em Ficha Técnica.',
        link: `/catalogo?eq=${eq._id}`,
        contexto: { equipamento_id: eq._id },
      })
    }

    // Completude < 80% (se diagnosticador disponível)
    if (typeof diagnosticarFicha === 'function') {
      const d = diagnosticarFicha(eq)
      if (d && d.completude_pct < COMPLETUDE_MINIMA && d.completude_pct > 0) {
        alertas.push({
          id: _id('cat_incompleto', eq._id),
          origem: 'catalogo', severidade: 'info',
          titulo: `${eq.fabricante || '?'} ${eq.modelo || '?'} — completude ${d.completude_pct}%`,
          descricao: `Ficha técnica abaixo de ${COMPLETUDE_MINIMA}% (${d.campos_ausentes} campos ausentes).`,
          data: (eq.updatedAt || new Date()).toString(),
          acao_recomendada: 'Reprocessar com IA ou completar manualmente.',
          link: `/catalogo?eq=${eq._id}`,
          contexto: { equipamento_id: eq._id, completude_pct: d.completude_pct },
        })
      }
    }
  }
  return alertas
}

// ── 3. ALERTAS DOCUMENTAIS ─────────────────────────────────────────────────

export function detectarAlertasDocumentos(documentos, hoje = new Date()) {
  const alertas = []
  for (const d of documentos || []) {
    if (d.validade) {
      const v = new Date(d.validade)
      if (!Number.isNaN(v.getTime()) && v.getTime() < hoje.getTime()) {
        const dias = Math.floor((hoje.getTime() - v.getTime()) / DIA_MS)
        alertas.push({
          id: _id('doc_vencido', d._id),
          origem: 'documento', severidade: 'critico',
          titulo: `${(d.tipo || 'Documento').toUpperCase()} vencido há ${dias} dia(s)`,
          descricao: `Validade ${v.toLocaleDateString('pt-BR')}. ${d.nome || ''}`,
          data: v.toISOString(),
          acao_recomendada: 'Substituir por documento atualizado.',
          link: `/catalogo?doc=${d._id}`,
          contexto: { documento_id: d._id, tipo: d.tipo },
        })
      }
    }

    // Físico ausente: documento referenciado mas storage_path/hash null
    if (!d.hash && !d.conteudo_base64 && !d.storage_path) {
      alertas.push({
        id: _id('doc_ausente', d._id),
        origem: 'documento', severidade: 'erro',
        titulo: `${d.tipo || 'Documento'} físico ausente`,
        descricao: `Registro existe mas o arquivo não foi encontrado. ${d.nome || ''}`,
        data: (d.updatedAt || new Date()).toString(),
        acao_recomendada: 'Reanexar o arquivo original.',
        link: `/catalogo?doc=${d._id}`,
        contexto: { documento_id: d._id },
      })
    }
  }
  return alertas
}

// ── 4. ALERTAS DE PROJETO ──────────────────────────────────────────────────

function _rateioOk(beneficiarias) {
  const ativas = (beneficiarias || []).filter(b => b.ativa !== false && b.tipoRateio === 'percentual')
  if (!ativas.length) return { ok: false, motivo: 'sem_beneficiarias', soma: 0 }
  const soma = ativas.reduce((s, b) => s + (Number(b.valor) || 0), 0)
  return { ok: Math.abs(100 - soma) < 0.01, soma, motivo: soma > 100 ? 'excedido' : 'incompleto' }
}

/**
 * @param {Array} projetos   ProjetoFV (lean) — espera campos: _id, nome, tecnico_principal_id, governanca, legacy
 * @param {Map<string,Array>} beneficiariasPorProjeto  mapa projetoId → beneficiárias
 */
export function detectarAlertasProjetos(projetos, beneficiariasPorProjeto = new Map()) {
  const alertas = []
  for (const p of projetos || []) {
    if (p.excluido) continue
    const status = p.status_display || p.status

    // Sem RT
    if (!p.tecnico_principal_id && !p.tecnico_id) {
      alertas.push({
        id: _id('proj_sem_rt', p._id),
        origem: 'projeto', severidade: 'aviso',
        titulo: `Projeto "${p.nome || p._id}" sem RT atribuído`,
        descricao: 'Projeto ativo sem responsável técnico.',
        data: (p.updatedAt || p.createdAt || new Date()).toString(),
        acao_recomendada: 'Atribuir RT em Detalhes do Projeto > Equipe.',
        link: `/projetos-fv/${p._id}`,
        contexto: { projeto_id: p._id },
      })
    }

    // Legacy
    if (p.legacy === true || p.necessita_revisao === true) {
      alertas.push({
        id: _id('proj_legacy', p._id),
        origem: 'projeto', severidade: 'info',
        titulo: `Projeto "${p.nome || p._id}" precisa revisão`,
        descricao: `Sinalizadores: ${(p.legacy_motivos || []).join(', ') || 'projeto legado'}.`,
        data: (p.updatedAt || p.createdAt || new Date()).toString(),
        acao_recomendada: 'Completar dados no wizard.',
        link: `/projetos-fv/${p._id}`,
        contexto: { projeto_id: p._id },
      })
    }

    // Congelado/aprovado sem snapshot RT
    const congelado = ['CONGELADO', 'HOMOLOGADO'].includes(p.governanca?.freeze_status)
    if (congelado && !p.governanca?.snapshot_responsavel_tecnico) {
      alertas.push({
        id: _id('proj_sem_snap_rt', p._id),
        origem: 'projeto', severidade: 'aviso',
        titulo: `Projeto "${p.nome || p._id}" congelado sem snapshot RT`,
        descricao: 'Documentos futuros usarão cadastro vivo (risco de inconsistência histórica).',
        data: (p.governanca?.congelado_em || new Date()).toString(),
        acao_recomendada: 'Reabrir e congelar novamente para capturar snapshot.',
        link: `/projetos-fv/${p._id}?tab=governanca`,
        contexto: { projeto_id: p._id },
      })
    }

    // Rateio
    const beneficiarias = beneficiariasPorProjeto.get(String(p._id)) || []
    if (beneficiarias.length > 0) {
      const r = _rateioOk(beneficiarias)
      if (!r.ok) {
        alertas.push({
          id: _id('proj_rateio', p._id),
          origem: 'projeto', severidade: 'aviso',
          titulo: `Rateio do projeto "${p.nome || p._id}" = ${r.soma.toFixed(2)}%`,
          descricao: `Soma das beneficiárias diferente de 100% (${r.motivo}).`,
          data: (p.updatedAt || new Date()).toString(),
          acao_recomendada: 'Ajustar percentuais em Beneficiárias.',
          link: `/projetos-fv/${p._id}?tab=beneficiarias`,
          contexto: { projeto_id: p._id, soma: r.soma },
        })
      }
    }
  }
  return alertas
}

// ── 5. ALERTAS DE FATURAS ──────────────────────────────────────────────────

export function detectarAlertasFaturas(faturas) {
  const alertas = []
  for (const f of faturas || []) {
    // Falha de OCR / não processada
    const ocrFalhou = f.origem?.tipo === 'PDF' && (!f.unidade_consumidora?.numero_uc?.valor)
    if (ocrFalhou) {
      alertas.push({
        id: _id('fat_ocr', f._id),
        origem: 'fatura', severidade: 'erro',
        titulo: `OCR falhou — ${f.origem?.arquivo_nome || 'fatura'}`,
        descricao: 'PDF processado mas UC não foi extraída.',
        data: (f.createdAt || new Date()).toString(),
        acao_recomendada: 'Reprocessar ou preencher manualmente.',
        link: `/faturas/revisao/${f._id}`,
        contexto: { fatura_id: f._id },
      })
    }

    // Histórico incompleto
    if (f.flags?.historico_incompleto) {
      alertas.push({
        id: _id('fat_hist', f._id),
        origem: 'fatura', severidade: 'aviso',
        titulo: 'Histórico de consumo incompleto',
        descricao: `Apenas ${(f.historico_consumo || []).length} mês(es) extraído(s). Mínimo 12 para análise robusta.`,
        data: (f.createdAt || new Date()).toString(),
        acao_recomendada: 'Completar manualmente o histórico.',
        link: `/faturas/revisao/${f._id}`,
        contexto: { fatura_id: f._id },
      })
    }

    // Grupo A sem demanda contratada
    if (f.flags?.grupo_a && !f.grupo_a?.demanda_contratada?.valor) {
      alertas.push({
        id: _id('fat_demanda', f._id),
        origem: 'fatura', severidade: 'aviso',
        titulo: 'Cliente Grupo A sem demanda contratada',
        descricao: 'Demanda contratada não extraída — dimensionamento pode ficar incompleto.',
        data: (f.createdAt || new Date()).toString(),
        acao_recomendada: 'Confirmar demanda na fatura.',
        link: `/faturas/revisao/${f._id}`,
        contexto: { fatura_id: f._id },
      })
    }

    // Alertas internos da fatura (severidade 'erro' → erro; senão aviso/info)
    for (const a of (f.alertas || [])) {
      alertas.push({
        id: _id('fat_int', f._id, a.campo),
        origem: 'fatura',
        severidade: a.severidade === 'erro' ? 'erro' : (a.severidade === 'aviso' ? 'aviso' : 'info'),
        titulo: a.campo ? `${a.campo}: ${(a.mensagem || '').slice(0, 70)}` : 'Inconsistência na fatura',
        descricao: a.mensagem || '',
        data: (f.createdAt || new Date()).toString(),
        acao_recomendada: 'Revisar o campo na fatura.',
        link: `/faturas/revisao/${f._id}`,
        contexto: { fatura_id: f._id, campo: a.campo },
      })
    }
  }
  return alertas
}

// ── 6. AGREGADOR PRINCIPAL ─────────────────────────────────────────────────

/**
 * Combina todos os detectores em uma lista única + KPIs.
 * Recebe um objeto `fontes` para evitar I/O dentro deste módulo.
 */
export function agregarAlertas({ tecnicos = [], equipamentos = [], documentos = [], projetos = [], beneficiariasPorProjeto = new Map(), faturas = [], diagnosticarFicha = null, hoje = new Date() } = {}) {
  const alertas = [
    ...detectarAlertasRT(tecnicos, hoje),
    ...detectarAlertasCatalogo(equipamentos, { diagnosticarFicha }),
    ...detectarAlertasDocumentos(documentos, hoje),
    ...detectarAlertasProjetos(projetos, beneficiariasPorProjeto),
    ...detectarAlertasFaturas(faturas),
  ]
  return alertas
}

export function calcularKPIs(alertas, statusPorId = new Map()) {
  const ativos = (alertas || []).filter(a => {
    const st = statusPorId.get(a.id)?.status
    return !st || st === 'aberto'
  })
  const por_severidade = { info: 0, aviso: 0, erro: 0, critico: 0 }
  const por_origem = { rt: 0, catalogo: 0, documento: 0, projeto: 0, fatura: 0 }
  for (const a of ativos) {
    if (a.severidade in por_severidade) por_severidade[a.severidade]++
    if (a.origem in por_origem) por_origem[a.origem]++
  }
  return {
    total_ativos: ativos.length,
    por_severidade,
    por_origem,
    cards: {
      rt_vencidos: ativos.filter(a => a.id.startsWith('rt_vencido')).length,
      equipamentos_pendentes: ativos.filter(a => a.origem === 'catalogo' && (a.id.startsWith('cat_pendente') || a.id.startsWith('cat_bloqueado'))).length,
      projetos_com_problemas: ativos.filter(a => a.origem === 'projeto').length,
      documentos_faltantes: ativos.filter(a => a.origem === 'documento').length,
      faturas_inconsistentes: ativos.filter(a => a.origem === 'fatura').length,
    },
  }
}

/**
 * Aplica filtros sobre a lista (severidade, origem, período em dias, status, texto livre).
 */
export function filtrarAlertas(alertas, filtros = {}, statusPorId = new Map(), hoje = new Date()) {
  const { severidade, origem, periodo_dias, status = 'aberto', texto } = filtros
  const cutoff = periodo_dias ? hoje.getTime() - periodo_dias * DIA_MS : null
  const txt = texto ? String(texto).toLowerCase() : null
  return (alertas || []).filter(a => {
    const st = statusPorId.get(a.id)?.status || 'aberto'
    if (status && status !== 'todos' && st !== status) return false
    if (severidade && severidade !== 'todos' && a.severidade !== severidade) return false
    if (origem && origem !== 'todos' && a.origem !== origem) return false
    if (cutoff) {
      const t = new Date(a.data).getTime()
      if (Number.isFinite(t) && t < cutoff) return false
    }
    if (txt) {
      const hay = `${a.titulo} ${a.descricao}`.toLowerCase()
      if (!hay.includes(txt)) return false
    }
    return true
  })
}
