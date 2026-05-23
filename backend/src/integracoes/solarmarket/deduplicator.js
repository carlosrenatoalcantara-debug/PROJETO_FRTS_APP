/**
 * deduplicator.js — S2.9 ETL SolarMarket
 *
 * Responsabilidade: decidir o que fazer quando o matcher encontra (ou não) um
 * Equipamento existente. Nunca sobrescreve dados de maior qualidade.
 *
 * Hierarquia de confiança dos dados (maior sobrescreve menor):
 *   manual > datasheet_gemini > datasheet_pdfparse > import_solarmarket > import_legado
 *
 * Política de merge:
 *  - Criação (sem match): cria novo Equipamento com origem 'import_solarmarket'
 *  - Atualização (com match):
 *    - Atualiza preco_sugerido SEMPRE (dado comercial volátil)
 *    - Atualiza especificacoes SOMENTE se campos estão nulos/ausentes
 *    - Nunca sobrescreve: fabricante, modelo, garantias, datasheet_url enriquecidos pelo Gemini
 *    - Adiciona SM como alias na identificacao.aliases se nome SM difere do cadastrado
 *    - Registra evento no historico de validacao
 */

import { Equipamento } from '../../models/Equipamento.js'

// ─── Hierarquia de origens ────────────────────────────────────────────────

const HIERARQUIA_ORIGEM = {
  'manual':              5,
  'datasheet_gemini':    4,
  'datasheet_pdfparse':  3,
  'import_planilha':     2,
  'import_solarmarket':  1,
  'import_legado':       0,
  'desconhecido':        0,
  null:                  0,
}

/**
 * Verifica se a origem de destino tem prioridade maior ou igual à origem de origem SM.
 *
 * @param {string|null} origemExistente  Origem do doc no banco
 * @returns {boolean}  true = SM NÃO pode sobrescrever campos enriquecidos
 */
function origemExistenteTemPrioridade(origemExistente) {
  const prioridadeExistente = HIERARQUIA_ORIGEM[origemExistente] ?? 0
  const prioridadeSM        = HIERARQUIA_ORIGEM['import_solarmarket']
  return prioridadeExistente > prioridadeSM
}

// ─── Helpers de merge ─────────────────────────────────────────────────────

/**
 * Merge seletivo de especificacoes.
 * Só adiciona campos que são null/undefined no doc existente.
 *
 * @param {object} specsExistentes
 * @param {object} specsNovas
 * @returns {{ specs: object, campos_adicionados: string[] }}
 */
function mergeSpecs(specsExistentes, specsNovas) {
  const specs = { ...specsExistentes }
  const campos_adicionados = []

  for (const [chave, valor] of Object.entries(specsNovas)) {
    if (valor === null || valor === undefined || valor === '') continue
    if (specsExistentes[chave] === null || specsExistentes[chave] === undefined) {
      specs[chave] = valor
      campos_adicionados.push(chave)
    }
  }

  return { specs, campos_adicionados }
}

/**
 * Gera evento de histórico para registro na validacao.historico.
 *
 * @param {string} tipo
 * @param {object} antes
 * @param {object} depois
 * @param {string[]} campos
 * @returns {object}
 */
function criarEventoHistorico(tipo, antes, depois, campos) {
  return {
    em:               new Date(),
    tipo:             'import',
    por:              'solarmarket_etl_v1',
    antes,
    depois,
    campos_alterados: campos,
    observacao:       `Import S2.9 SolarMarket ETL — ${tipo}`,
  }
}

// ─── Ações de deduplicação ────────────────────────────────────────────────

/**
 * Processa um item normalizado e seu resultado de matching.
 * Retorna a ação a tomar (sem executar ainda — responsabilidade do importer).
 *
 * @param {object} normalizado   Resultado de normalizer.normalizar()
 * @param {object} match         Resultado de matcher.encontrarMatch()
 * @param {object} opcoes
 * @param {number} [opcoes.confiancaMinimaUpdate=0.70]  Confiança mínima para atualizar
 * @returns {DeduplicatorAction}
 *
 * @typedef {object} DeduplicatorAction
 * @property {'criar'|'atualizar'|'ignorar'} acao
 * @property {object|null} payload           $set para atualizar, ou doc para criar
 * @property {object|null} docExistente      Doc do banco (se ação = atualizar/ignorar)
 * @property {string} motivo                 Razão da decisão
 * @property {string[]} campos_alterados     Campos que seriam modificados
 */
export function decidirAcao(normalizado, match, opcoes = {}) {
  const { confiancaMinimaUpdate = 0.70 } = opcoes
  const { equipamento: eqNovo, meta, alertas } = normalizado

  // ── Sem match: criar novo ─────────────────────────────────────────────────
  if (!match.encontrado) {
    return {
      acao:             'criar',
      payload:          eqNovo,
      docExistente:     null,
      motivo:           'nenhum equipamento correspondente encontrado no banco',
      campos_alterados: Object.keys(eqNovo),
    }
  }

  // ── Match com baixa confiança: ignorar ────────────────────────────────────
  if (match.confianca < confiancaMinimaUpdate) {
    return {
      acao:         'ignorar',
      payload:      null,
      docExistente: match.equipamento,
      motivo:       `confiança ${(match.confianca * 100).toFixed(0)}% abaixo do mínimo (${confiancaMinimaUpdate * 100}%)`,
      campos_alterados: [],
    }
  }

  // ── Match encontrado: calcular merge ─────────────────────────────────────
  const docExistente    = match.equipamento
  const origemExistente = docExistente.origem?.tipo || null
  const $set            = {}
  const camposAlterados = []
  const motivos         = []

  // Preco sugerido: SM sempre tem dado comercial atual → atualiza
  if (eqNovo.preco_sugerido !== undefined && eqNovo.preco_sugerido !== null) {
    if (docExistente.preco_sugerido !== eqNovo.preco_sugerido) {
      $set.preco_sugerido = eqNovo.preco_sugerido
      camposAlterados.push('preco_sugerido')
      motivos.push(`preço SM R$${eqNovo.preco_sugerido} atualizado`)
    }
  }

  // Especificações: só adiciona campos faltantes (sem sobrescrever Gemini)
  if (eqNovo.especificacoes && !origemExistenteTemPrioridade(origemExistente)) {
    const specsExistentes = docExistente.especificacoes || {}
    const { specs: specsNov, campos_adicionados } = mergeSpecs(specsExistentes, eqNovo.especificacoes)
    if (campos_adicionados.length > 0) {
      $set.especificacoes = specsNov
      camposAlterados.push(...campos_adicionados.map(c => `especificacoes.${c}`))
      motivos.push(`specs adicionadas: ${campos_adicionados.join(', ')}`)
    }
  }

  // Hash único: garante que identificacao.hash_unico está preenchido se estava nulo
  if (!docExistente.identificacao?.hash_unico && eqNovo.identificacao?.hash_unico) {
    $set['identificacao.hash_unico']             = eqNovo.identificacao.hash_unico
    $set['identificacao.fabricante_normalizado'] = eqNovo.identificacao.fabricante_normalizado
    $set['identificacao.modelo_normalizado']     = eqNovo.identificacao.modelo_normalizado
    camposAlterados.push('identificacao.hash_unico')
    motivos.push('hash_unico preenchido (estava nulo)')
  }

  // Alias: adiciona nome SM como alias se diferente do modelo registrado
  const nomeSmNorm   = (eqNovo.modelo || '').toUpperCase().trim()
  const nomeDocNorm  = (docExistente.modelo || '').toUpperCase().trim()
  const aliasesAtuais = docExistente.identificacao?.aliases || []
  if (nomeSmNorm && nomeSmNorm !== nomeDocNorm && !aliasesAtuais.includes(eqNovo.modelo)) {
    $set['identificacao.aliases'] = [...aliasesAtuais, eqNovo.modelo]
    camposAlterados.push('identificacao.aliases')
    motivos.push(`alias SM "${eqNovo.modelo}" adicionado`)
  }

  // Evento de histórico
  const evento = criarEventoHistorico(
    camposAlterados.length > 0 ? 'merge_sm' : 'revisao_sem_alteracao',
    { preco_sugerido: docExistente.preco_sugerido },
    { preco_sugerido: $set.preco_sugerido ?? docExistente.preco_sugerido },
    camposAlterados,
  )

  // Nada a atualizar
  if (Object.keys($set).length === 0) {
    return {
      acao:             'ignorar',
      payload:          null,
      docExistente,
      motivo:           'nenhum campo novo para atualizar',
      campos_alterados: [],
    }
  }

  // Adiciona evento ao histórico ($push)
  return {
    acao:         'atualizar',
    payload:      {
      $set,
      $push: { 'validacao.historico': evento },
    },
    docExistente,
    motivo:       motivos.join(' | '),
    campos_alterados: camposAlterados,
  }
}

/**
 * Executa a ação de deduplicação no banco (usado pelo importer em modo --apply).
 *
 * @param {DeduplicatorAction} acao
 * @param {boolean} dryRun  true = não escreve no banco
 * @returns {Promise<DeduplicatorResult>}
 *
 * @typedef {object} DeduplicatorResult
 * @property {'criado'|'atualizado'|'ignorado'|'erro'} status
 * @property {string|null} id  ObjectId do documento afetado
 * @property {string} motivo
 */
export async function executarAcao(acao, dryRun = true) {
  if (dryRun) {
    return {
      status: acao.acao === 'criar' ? 'criado' : acao.acao === 'atualizar' ? 'atualizado' : 'ignorado',
      id:     acao.docExistente?._id?.toString() ?? null,
      motivo: `[DRY-RUN] ${acao.motivo}`,
    }
  }

  try {
    if (acao.acao === 'criar') {
      // Cria novo Equipamento
      const novoDoc = new Equipamento(acao.payload)
      await novoDoc.save()
      return {
        status: 'criado',
        id:     novoDoc._id.toString(),
        motivo: acao.motivo,
      }
    }

    if (acao.acao === 'atualizar') {
      // Atualiza doc existente com $set e $push atômicos
      await Equipamento.findByIdAndUpdate(
        acao.docExistente._id,
        acao.payload,
        { runValidators: false }  // evita re-rodar hook qualidade (será recalculado no próximo backfill)
      )
      return {
        status: 'atualizado',
        id:     acao.docExistente._id.toString(),
        motivo: acao.motivo,
      }
    }

    // ignorar
    return {
      status: 'ignorado',
      id:     acao.docExistente?._id?.toString() ?? null,
      motivo: acao.motivo,
    }
  } catch (err) {
    console.error('[SM:deduplicator] Erro ao executar ação:', err.message)
    return {
      status: 'erro',
      id:     acao.docExistente?._id?.toString() ?? null,
      motivo: err.message,
    }
  }
}
