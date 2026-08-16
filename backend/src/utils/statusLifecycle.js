/**
 * statusLifecycle.js — Sprint 8.4
 *
 * Helpers PUROS do ciclo de vida do projeto FV. Sem dependências (mongoose).
 *
 * FV-UX-006 (F3.1): o VOCABULÁRIO e os MAPEAMENTOS do ciclo de vida deixaram de
 * viver aqui — vivem em @fortesolar/fv-shared/estados/ciclo-vida, junto com os
 * metadados de apresentação que o frontend mantinha em paralelo. Este arquivo
 * reexporta para preservar o caminho de import histórico e guarda apenas o que
 * NÃO é máquina de estados: derivações de compatibilidade e diagnóstico legado.
 */
export {
  STATUS, paraModel, paraDisplay, ehStatusValido, badgeDe, ESTADOS_CICLO,
} from '@fortesolar/fv-shared/estados/ciclo-vida'
import { projetoEstaCongelado } from '@fortesolar/fv-shared/estados/congelamento'
import { paraDisplay } from '@fortesolar/fv-shared/estados/ciclo-vida'

/**
 * Calcula um status SEGURO para projetos antigos sem `status`.
 * Regras (aditivas): se já existe status válido, devolve-o em UPPERCASE.
 *  - assinatura presente → APROVADO
 *  - freeze_status congelado/homologado → PROPOSTA
 *  - senão → RASCUNHO
 * Não persiste nada — só deriva.
 */
export function derivarStatusSeguro(projeto) {
  if (!projeto) return 'RASCUNHO'
  const arquivado = projeto.arquivado_em || projeto.motivo_arquivamento
  if (arquivado) return 'ARQUIVADO'
  if (projeto.status) return paraDisplay(projeto.status)

  const gov = projeto.governanca || {}
  const com = gov.comercial || {}
  const temAssinatura = Array.isArray(com.assinaturas) && com.assinaturas.length > 0
  if (temAssinatura) return 'APROVADO'

  // FV-DOM-002A: contrato único de congelamento.
  if (projetoEstaCongelado(projeto)) return 'PROPOSTA'

  return 'RASCUNHO'
}

/**
 * Regra de exclusão definitiva (hard delete).
 * Só permite quando: rascunho + sem freeze + sem documentos + sem assinatura.
 */
export function podeExcluirDefinitivo(projeto) {
  if (!projeto) return false
  const status = derivarStatusSeguro(projeto)
  if (status !== 'RASCUNHO') return false
  const gov = projeto.governanca || {}
  if (projetoEstaCongelado(projeto)) return false
  if (Array.isArray(gov.comercial?.assinaturas) && gov.comercial.assinaturas.length > 0) return false
  if (Array.isArray(projeto.documentos_tecnicos) && projeto.documentos_tecnicos.length > 0) return false
  // Compat: campo legado documentos[] (se existir)
  if (Array.isArray(projeto.documentos) && projeto.documentos.length > 0) return false
  return true
}

/**
 * Diagnóstico de projeto LEGACY. Devolve { legacy, necessita_revisao, motivos[] }.
 * Heurísticas:
 *  - cliente ausente (sem clienteId nem nomeCliente)
 *  - data inválida (createdAt/dataCriacao quebradas)
 *  - schema antigo (sem `_schema` v3 OU sem `wizard_versao`)
 *  - snapshot ausente quando freeze_status indica congelamento
 */
export function avaliarLegacy(projeto) {
  const motivos = []
  if (!projeto) return { legacy: true, necessita_revisao: true, motivos: ['projeto_ausente'] }

  if (!projeto.clienteId && !projeto.nomeCliente) motivos.push('cliente_ausente')

  const d = projeto.createdAt || projeto.dataCriacao
  if (d != null) {
    const t = new Date(d).getTime()
    if (Number.isNaN(t)) motivos.push('data_invalida')
  } else {
    motivos.push('data_ausente')
  }

  if (!projeto._schema && !projeto.wizard_versao) motivos.push('schema_antigo')

  const gov = projeto.governanca || {}
  if (projetoEstaCongelado(projeto)) {
    if (!gov.snapshot_tecnico && !gov.snapshot_geoespacial) motivos.push('snapshot_ausente')
  }

  return {
    legacy: motivos.length > 0,
    necessita_revisao: motivos.some((m) => ['cliente_ausente', 'snapshot_ausente'].includes(m)),
    motivos,
  }
}

// Motivos válidos para arquivamento (spec).
export const MOTIVOS_ARQUIVAMENTO = ['Cliente desistiu', 'Duplicado', 'Teste', 'Perdeu venda', 'Outro']
