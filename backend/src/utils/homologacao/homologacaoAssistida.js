/**
 * homologacaoAssistida.js — Sprint 9.0
 *
 * Helpers PUROS para homologação assistida. Consome estruturas existentes
 * (ProjetoFV, UnidadeBeneficiaria, Equipamento) e produz:
 *   • Checklist automático (RT, snapshot RT, equipamentos, certificações, rateio…)
 *   • Validador documental (vencidos, ausentes, INMETRO/IEC obrigatórias)
 *   • Status sugerido (não iniciado → em preparação → pendente X → homologado/reprovado)
 *   • Pacote documental (referências rastreáveis — NÃO copia arquivos)
 *
 * Filosofia: consolidação sem duplicação. Cada item do pacote é um link para
 * o documento original no DB; o status_homologacao é DERIVADO automaticamente
 * mas pode ser sobrescrito manualmente pelo operador.
 */
import { obterRegras } from './concessionariaProvider.js'

// ── Statuses do ciclo de homologação ────────────────────────────────────────
export const STATUS_HOMOLOGACAO = [
  'nao_iniciado',
  'em_preparacao',
  'pendente_documentacao',
  'pendente_engenharia',
  'pendente_concessionaria',
  'homologado',
  'reprovado',
]

const LABELS_STATUS = {
  nao_iniciado: 'Não iniciado',
  em_preparacao: 'Em preparação',
  pendente_documentacao: 'Pendente documentação',
  pendente_engenharia: 'Pendente engenharia',
  pendente_concessionaria: 'Pendente concessionária',
  homologado: 'Homologado',
  reprovado: 'Reprovado',
}

export function labelStatus(s) { return LABELS_STATUS[s] || s }

// ── Helpers internos ────────────────────────────────────────────────────────
const _norm = (s) => String(s ?? '').toLowerCase().trim()
const _temDatasheet = (eq) => Boolean(
  (Array.isArray(eq?.documentos_tecnicos) && eq.documentos_tecnicos.some(d => _norm(d?.tipo) === 'datasheet')) ||
  eq?.datasheet_original?.hash
)
const _aprovado = (eq) => (eq?.aprovacao_tecnica?.status || 'aprovado') === 'aprovado'

function _temCert(eq, normaId) {
  if (!eq?.certificacao) return false
  const inm = eq.certificacao?.inmetro?.numero
  if (normaId === 'inmetro' && inm) return true
  const iec = Array.isArray(eq.certificacao?.normas_iec) ? eq.certificacao.normas_iec : []
  return iec.some(n => _norm(n?.norma || n).includes(normaId.replace('iec_', 'iec ').replace('_', ' ')))
}

function _rateioOk(beneficiarias) {
  const ativas = (beneficiarias || []).filter(b => b.ativa !== false && b.tipoRateio === 'percentual')
  if (!ativas.length) return { exigido: false, ok: true, soma: 0 }
  const soma = ativas.reduce((s, b) => s + (Number(b.valor) || 0), 0)
  return { exigido: true, ok: Math.abs(100 - soma) < 0.01, soma }
}

// ── Checklist principal ────────────────────────────────────────────────────

/**
 * Gera o checklist a partir do projeto + suas dependências (já carregadas).
 *
 * @param {object} args
 * @param {object} args.projeto                  ProjetoFV lean
 * @param {Array}  args.equipamentos             Equipamento[] referenciados pelo projeto
 * @param {Array}  args.beneficiarias            UnidadeBeneficiaria[] do projeto
 * @param {string} [args.concessionaria]         Nome/grupo da concessionária (opcional)
 * @returns {{ itens: Array<{chave,titulo,severidade,status:'ok'|'pendente'|'erro',detalhe}>,
 *             resumo: { total, ok, pendentes, erros, percentual_completo, status_geral, status_sugerido } }}
 */
export function gerarChecklist({ projeto = {}, equipamentos = [], beneficiarias = [], concessionaria = null } = {}) {
  const itens = []
  const regras = obterRegras(concessionaria || projeto?.governanca?.snapshot_empresa?.concessionaria)

  // 1) RT atribuído
  itens.push({
    chave: 'rt_atribuido',
    titulo: 'Responsável Técnico atribuído',
    severidade: 'critico',
    status: (projeto.tecnico_principal_id || projeto.tecnico_id) ? 'ok' : 'erro',
    detalhe: (projeto.tecnico_principal_id || projeto.tecnico_id) ? 'RT vinculado ao projeto.' : 'Projeto sem RT — bloqueante para homologação.',
  })

  // 2) Snapshot RT (recomendado quando congelado)
  const congelado = ['CONGELADO', 'HOMOLOGADO'].includes(projeto?.governanca?.freeze_status)
  if (congelado) {
    itens.push({
      chave: 'snapshot_rt',
      titulo: 'Snapshot do RT capturado',
      severidade: 'erro',
      status: projeto?.governanca?.snapshot_responsavel_tecnico ? 'ok' : 'erro',
      detalhe: projeto?.governanca?.snapshot_responsavel_tecnico
        ? 'Snapshot RT preservado no congelamento.'
        : 'Projeto congelado sem snapshot do RT — risco de inconsistência histórica.',
    })
  }

  // 3) Equipamentos aprovados
  const ativos = equipamentos.filter(e => !!e)
  const naoAprovados = ativos.filter(e => !_aprovado(e))
  itens.push({
    chave: 'equipamentos_aprovados',
    titulo: 'Equipamentos com aprovação técnica',
    severidade: 'critico',
    status: naoAprovados.length === 0 && ativos.length > 0 ? 'ok' : (ativos.length === 0 ? 'pendente' : 'erro'),
    detalhe: ativos.length === 0
      ? 'Projeto sem equipamentos selecionados.'
      : (naoAprovados.length > 0
          ? `${naoAprovados.length} equipamento(s) sem aprovação: ${naoAprovados.map(e => `${e.fabricante} ${e.modelo}`).slice(0, 3).join(', ')}`
          : `${ativos.length} equipamento(s) aprovados.`),
  })

  // 4) Datasheets presentes
  const semDS = ativos.filter(e => !_temDatasheet(e))
  itens.push({
    chave: 'datasheets_presentes',
    titulo: 'Datasheets dos equipamentos',
    severidade: 'erro',
    status: ativos.length === 0 ? 'pendente' : (semDS.length === 0 ? 'ok' : 'erro'),
    detalhe: semDS.length === 0 && ativos.length > 0
      ? 'Todos os equipamentos têm datasheet anexado.'
      : `${semDS.length} equipamento(s) sem datasheet: ${semDS.map(e => `${e.fabricante} ${e.modelo}`).slice(0, 3).join(', ')}`,
  })

  // 5) Certificações por norma (segundo a concessionária)
  const certPorTipo = regras?.normas_obrigatorias || {}
  for (const [tipo, normas] of Object.entries(certPorTipo)) {
    const equipsTipo = ativos.filter(e => e.tipo === tipo)
    if (equipsTipo.length === 0) continue
    for (const norma of normas) {
      const semNorma = equipsTipo.filter(e => !_temCert(e, norma))
      itens.push({
        chave: `cert_${tipo}_${norma}`,
        titulo: `${tipo === 'modulo' ? 'Módulos' : 'Inversores'} com ${norma.toUpperCase().replace('_', ' ')}`,
        severidade: 'erro',
        status: semNorma.length === 0 ? 'ok' : 'erro',
        detalhe: semNorma.length === 0
          ? `Todos os ${tipo === 'modulo' ? 'módulos' : 'inversores'} têm ${norma}.`
          : `${semNorma.length} ${tipo}(s) sem ${norma}: ${semNorma.map(e => `${e.fabricante} ${e.modelo}`).slice(0, 2).join(', ')}`,
      })
    }
  }

  // 6) Beneficiárias / rateio (só se houver UCs cadastradas)
  const r = _rateioOk(beneficiarias)
  if (r.exigido) {
    itens.push({
      chave: 'rateio_100',
      titulo: 'Rateio das beneficiárias = 100%',
      severidade: 'erro',
      status: r.ok ? 'ok' : 'erro',
      detalhe: r.ok ? `${beneficiarias.length} UC(s), soma 100%.` : `Soma das beneficiárias = ${r.soma.toFixed(2)}% (≠ 100%).`,
    })
  }

  // 7) Documentos obrigatórios do projeto (memorial/ART/carta — checklist legado)
  const cl = projeto?.homologacao?.checklist_documentos || {}
  const docsObrig = regras?.documentos_obrigatorios || []
  const mapaDocsProjeto = {
    memorial: cl.memoria_descritivo,
    art: cl.art,
    carta_concessionaria: cl.carta_concessionaria,
    projeto_execucao: cl.projeto_execucao,
    laudo_conformidade: cl.laudo_conformidade,
  }
  for (const doc of docsObrig) {
    if (doc === 'datasheet') continue // já verificado acima
    const presente = mapaDocsProjeto[doc]
    if (presente === undefined) continue // documento exigido mas sem flag no projeto
    itens.push({
      chave: `doc_${doc}`,
      titulo: `Documento: ${doc.replace(/_/g, ' ')}`,
      severidade: 'erro',
      status: presente ? 'ok' : 'pendente',
      detalhe: presente ? 'Documento marcado como presente.' : 'Documento obrigatório ainda não anexado.',
    })
  }

  // ── Resumo ──────────────────────────────────────────────────────────────
  const ok = itens.filter(i => i.status === 'ok').length
  const pendentes = itens.filter(i => i.status === 'pendente').length
  const erros = itens.filter(i => i.status === 'erro').length
  const total = itens.length
  const percentual_completo = total > 0 ? Math.round((ok / total) * 100) : 0

  // Status sugerido derivado das contagens
  let status_sugerido
  if (total === 0) status_sugerido = 'nao_iniciado'
  else if (erros === 0 && pendentes === 0) status_sugerido = 'em_preparacao' // checklist ok mas falta envio
  else if (erros > 0) {
    // Identifica predominância da pendência
    const errosRT = itens.find(i => i.chave === 'rt_atribuido' && i.status === 'erro')
    const errosDocs = itens.filter(i => i.chave.startsWith('doc_') && i.status !== 'ok').length
    const errosCert = itens.filter(i => i.chave.startsWith('cert_') && i.status === 'erro').length
    if (errosRT || errosCert > 0) status_sugerido = 'pendente_engenharia'
    else if (errosDocs > 0) status_sugerido = 'pendente_documentacao'
    else status_sugerido = 'pendente_engenharia'
  } else {
    status_sugerido = 'pendente_documentacao'
  }

  const status_atual = projeto?.homologacao?.status_homologacao || (projeto?.homologacao?.status === 'aprovado' ? 'homologado' : 'nao_iniciado')

  return {
    itens,
    resumo: {
      total, ok, pendentes, erros,
      percentual_completo,
      status_atual,
      status_sugerido,
      apto_para_envio: erros === 0 && pendentes === 0 && total > 0,
      concessionaria: concessionaria || null,
      observacoes_concessionaria: regras?.observacoes || null,
    },
  }
}

// ── Validador documental ────────────────────────────────────────────────────

/**
 * Detecta pendências nos documentos do projeto/equipamentos.
 * Retorna lista de pendências classificadas.
 */
export function validarDocumentos({ projeto = {}, equipamentos = [], hoje = new Date(), concessionaria = null } = {}) {
  const pendencias = []
  const regras = obterRegras(concessionaria || projeto?.governanca?.snapshot_empresa?.concessionaria)

  for (const eq of equipamentos) {
    if (!eq) continue
    // Datasheet ausente
    if (!_temDatasheet(eq)) {
      pendencias.push({
        tipo: 'datasheet_ausente',
        severidade: 'erro',
        equipamento: `${eq.fabricante} ${eq.modelo}`,
        descricao: 'Datasheet do equipamento não está anexado.',
      })
    }
    // INMETRO obrigatório
    const normas = regras?.normas_obrigatorias?.[eq.tipo] || []
    if (normas.includes('inmetro') && !_temCert(eq, 'inmetro')) {
      pendencias.push({
        tipo: 'inmetro_ausente',
        severidade: 'erro',
        equipamento: `${eq.fabricante} ${eq.modelo}`,
        descricao: 'INMETRO obrigatório para esta concessionária.',
      })
    }
    // Outras IEC obrigatórias
    for (const n of normas) {
      if (n === 'inmetro') continue
      if (!_temCert(eq, n)) {
        pendencias.push({
          tipo: `${n}_ausente`,
          severidade: 'erro',
          equipamento: `${eq.fabricante} ${eq.modelo}`,
          descricao: `Norma ${n.toUpperCase().replace('_', ' ')} obrigatória ausente.`,
        })
      }
    }
    // Documentos vencidos
    for (const d of (eq.documentos_tecnicos || [])) {
      if (!d.validade) continue
      const v = new Date(d.validade)
      if (!Number.isNaN(v.getTime()) && v.getTime() < hoje.getTime()) {
        pendencias.push({
          tipo: 'documento_vencido',
          severidade: 'critico',
          equipamento: `${eq.fabricante} ${eq.modelo}`,
          documento: d.nome || d.tipo,
          descricao: `Documento ${d.tipo || ''} vencido em ${v.toLocaleDateString('pt-BR')}.`,
        })
      }
    }
  }

  return {
    pendencias,
    total: pendencias.length,
    bloqueantes: pendencias.filter(p => p.severidade === 'erro' || p.severidade === 'critico').length,
  }
}

// ── Pacote documental (referências) ────────────────────────────────────────

/**
 * Monta o pacote de homologação. Cada item é uma REFERÊNCIA (id + tipo + metadados),
 * nunca uma cópia do arquivo. O frontend resolve os links sob demanda.
 */
export function montarPacoteDocumental({ projeto = {}, cliente = null, equipamentos = [], beneficiarias = [], concessionaria = null } = {}) {
  const regras = obterRegras(concessionaria)
  const pacote = {
    gerado_em: new Date().toISOString(),
    concessionaria_alvo: concessionaria || null,
    projeto: {
      id: projeto._id || null,
      nome: projeto.nome || null,
      potencia_kwp: projeto?.dimensionamento?.potenciaArredondada ?? projeto?.dimensionamento?.potencia_kwp ?? null,
      endereco: projeto.endereco || null,
      status_homologacao: projeto?.homologacao?.status_homologacao || projeto?.homologacao?.status || null,
    },
    cliente: cliente ? {
      id: cliente._id, nome: cliente.nome, cpf_cnpj: cliente.cpf_cnpj, endereco: cliente.endereco,
    } : null,
    responsavel_tecnico: projeto?.governanca?.snapshot_responsavel_tecnico || null,
    equipamentos: equipamentos.map(eq => ({
      id: eq._id, tipo: eq.tipo, fabricante: eq.fabricante, modelo: eq.modelo,
      aprovacao: eq.aprovacao_tecnica?.status || 'aprovado',
      tem_datasheet: _temDatasheet(eq),
      datasheet_ref: eq.datasheet_original?.hash || (eq.documentos_tecnicos || []).find(d => _norm(d?.tipo) === 'datasheet')?._id || null,
      certificacoes: {
        inmetro: eq.certificacao?.inmetro?.numero || null,
        normas_iec: (eq.certificacao?.normas_iec || []).map(n => n.norma || n).filter(Boolean),
      },
    })),
    beneficiarias: (beneficiarias || []).map(b => ({
      id: b._id, uc: b.contaContrato, titular: b.titular, percentual: b.valor, ativa: b.ativa !== false,
    })),
    snapshots: {
      tecnico: projeto?.governanca?.snapshot_tecnico ? '✓' : null,
      empresa: projeto?.governanca?.snapshot_empresa ? '✓' : null,
      financeiro: projeto?.governanca?.snapshot_financeiro ? '✓' : null,
      catalogo: projeto?.governanca?.snapshot_catalogo ? '✓' : null,
      unifilar: projeto?.governanca?.snapshot_unifilar ? '✓' : null,
    },
    documentos_obrigatorios: regras?.documentos_obrigatorios || [],
    formularios_concessionaria: regras?.formularios || [],
    observacoes: regras?.observacoes || null,
  }
  return pacote
}
