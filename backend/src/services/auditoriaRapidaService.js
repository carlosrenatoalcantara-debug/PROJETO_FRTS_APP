/**
 * auditoriaRapidaService.js — Orquestrador da Auditoria Rápida (AE ⇄ Forte Solar)
 *
 * ORQUESTRADOR PURO. Não normaliza, não faz match, não decide merge e
 * NÃO ESCREVE NO BANCO. Toda regra vem de componentes já existentes:
 *
 *   normalizarExtracaoGemini()      dispatcher por família (módulo/inversor/carregador/bateria)
 *   encontrarMatch()                pareamento com o catálogo
 *   montarAtualizacaoIncremental()  cálculo do update (dry-run nativo)
 *
 * Depende da PORTA IAEProvider — nunca da origem física dos dados (API,
 * diretório, Git, S3...). A troca de adaptador não altera este arquivo.
 *
 * Fluxo:
 *   1. provider.listarIndice()                   metadados, sem abrir datasheets
 *   2. parear catálogo × índice                  reusa encontrarMatch
 *   3. comparar KnowledgeVersion                 iguais ⇒ NÃO abre arquivo
 *   4. abrir apenas os divergentes               provider.obterDatasheet()
 *   5. normalizar → reparear com specs → montar update
 *   6. relatório agrupado por família
 */

import { assertProvider } from '../integracoes/ae/IAEProvider.js'
import { avaliarAtualizacao } from '../integracoes/ae/knowledgeVersion.js'
import {
  normalizarExtracaoGemini,
  encontrarMatch,
  montarAtualizacaoIncremental,
} from './catalogoDatasheetEnriquecimento.js'

/** Situações possíveis por equipamento do catálogo. */
export const SITUACAO = Object.freeze({
  ATUALIZADO: 'atualizado',
  ATUALIZACAO_DISPONIVEL: 'atualizacao_disponivel',
  NUNCA_AUDITADO: 'nunca_auditado',
  SEM_DATASHEET: 'sem_datasheet_ae',
  REVISAO: 'revisao',
})

const FAMILIAS_RELATORIO = ['modulo', 'inversor', 'carregador_ev', 'bateria']

const ROTULO_FAMILIA = {
  modulo: 'Módulos',
  inversor: 'Inversores',
  carregador_ev: 'Carregadores',
  bateria: 'Baterias',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Índice pareável: entrada do AE no formato aceito por encontrarMatch(). */
function entradaDeIndice(item) {
  return {
    tipo: item.familia,
    fabricante: item.fabricante,
    modelo: item.modelo,
    specs_canonicas: {},   // fase de versão não abre o datasheet
  }
}

/** Descritor de arquivo esperado pelos normalizadores existentes. */
function arquivoDeRef(datasheet) {
  return {
    fullPath: datasheet.ref,
    fileName: 'product.json',
    tipo: datasheet.familia,
    modeloHint: datasheet.modelo,
  }
}

function resumoEquipamento(eq) {
  return {
    id: String(eq._id ?? eq.id ?? ''),
    tipo: eq.tipo,
    fabricante: eq.fabricante,
    modelo: eq.modelo,
  }
}

function contadorVazio() {
  const base = {}
  for (const f of FAMILIAS_RELATORIO) base[f] = 0
  return base
}

// ─── Serviço ─────────────────────────────────────────────────────────────────

/**
 * @param {object} deps
 * @param {object} deps.provider              implementação de IAEProvider
 * @param {() => Promise<object[]>} deps.listarEquipamentos  leitura do catálogo
 * @param {object} [deps.matchOptions]        {threshold, desconhecidoThreshold}
 * @returns {{executar: (opcoes?: object) => Promise<object>}}
 */
export function criarAuditoriaRapidaService({ provider, listarEquipamentos, matchOptions = {} } = {}) {
  assertProvider(provider)
  if (typeof listarEquipamentos !== 'function') {
    throw new Error('auditoriaRapidaService: "listarEquipamentos" é obrigatório.')
  }

  /**
   * Executa a auditoria. SEMPRE read-only: devolve o que MUDARIA.
   *
   * @param {object} [opcoes]
   * @param {'preservar'|'sobrescrever'} [opcoes.politicaConflito='sobrescrever']
   *   O AE é a fonte oficial: com KnowledgeVersion superior, sobrescreve.
   * @returns {Promise<object>} relatório
   */
  async function executar(opcoes = {}) {
    const { politicaConflito = 'sobrescrever' } = opcoes
    const iniciadoEm = new Date()

    const [indice, equipamentos] = await Promise.all([
      provider.listarIndice(),
      listarEquipamentos(),
    ])

    const relatorio = {
      gerado_em: iniciadoEm.toISOString(),
      provider: provider.descrever(),
      analisados: equipamentos.length,
      datasheets_ae: indice.length,
      datasheets_abertos: 0,
      totais_por_familia: contadorVazio(),
      total_atualizacoes: 0,
      atualizacoes: [],
      sem_datasheet: [],
      atualizados: [],
      nunca_auditados: [],
      revisao: [],
      erros: [],
    }

    // ── Passo 1–2: parear catálogo × índice (sem abrir datasheets) ───────────
    // Percorre o CATÁLOGO e localiza o Datasheet Técnico AE correspondente.
    const paresPorEquipamento = new Map()
    for (const item of indice) {
      const match = encontrarMatch(entradaDeIndice(item), equipamentos, matchOptions)
      if (!match) continue
      const chave = String(match.equipamento._id ?? match.equipamento.id ?? '')
      const anterior = paresPorEquipamento.get(chave)
      // Mantém o melhor score quando dois datasheets disputam o mesmo equipamento.
      if (!anterior || match.score > anterior.score) {
        paresPorEquipamento.set(chave, { item, score: match.score, equipamento: match.equipamento })
      }
    }

    for (const equipamento of equipamentos) {
      const chave = String(equipamento._id ?? equipamento.id ?? '')
      const par = paresPorEquipamento.get(chave)

      if (!par) {
        relatorio.sem_datasheet.push(resumoEquipamento(equipamento))
        continue
      }

      // ── Passo 3: comparação por KnowledgeVersion ─────────────────────────
      const versaoCatalogo = equipamento.origem?.knowledge_version ?? null
      const avaliacao = avaliarAtualizacao(par.item.knowledgeVersion, versaoCatalogo)

      const base = {
        ...resumoEquipamento(equipamento),
        familia: par.item.familia,
        versao_catalogo: versaoCatalogo,
        versao_ae: par.item.knowledgeVersion ?? null,
        ref: par.item.ref,
      }

      // Versões iguais: equipamento atualizado. O arquivo NÃO é aberto.
      if (avaliacao.situacao === 'atualizado') {
        relatorio.atualizados.push(base)
        continue
      }

      if (avaliacao.situacao === 'inferior' || avaliacao.situacao === 'nao_comparavel'
        || avaliacao.situacao === 'sem_versao_ae') {
        relatorio.revisao.push({ ...base, motivo: avaliacao.situacao })
        continue
      }

      // ── Passo 4: abre o datasheet apenas para divergentes ────────────────
      let datasheet
      try {
        datasheet = await provider.obterDatasheet(par.item.ref)
        relatorio.datasheets_abertos++
      } catch (err) {
        relatorio.erros.push({ ...base, erro: err.message, codigo: err.code || null })
        continue
      }

      // ── Passo 5: reuso integral do pipeline existente ────────────────────
      const payload = {
        ...datasheet.dados,
        fabricante: datasheet.fabricante,
        modelo: datasheet.modelo,
      }
      const entradas = normalizarExtracaoGemini({ dados: payload }, arquivoDeRef(datasheet))
      if (!entradas.length) {
        relatorio.revisao.push({ ...base, motivo: 'datasheet_nao_normalizavel' })
        continue
      }

      for (const entrada of entradas) {
        // Repareamento com specs completas (inclui potência): protege contra
        // casar 610 W com 600 W. Divergir do pareamento por índice é sinal de
        // ambiguidade — vai para revisão, nunca é aplicado.
        const matchCompleto = encontrarMatch(entrada, equipamentos, matchOptions)
        const idCompleto = matchCompleto ? String(matchCompleto.equipamento._id ?? matchCompleto.equipamento.id ?? '') : null

        if (idCompleto !== chave) {
          relatorio.revisao.push({ ...base, motivo: 'match_divergente' })
          continue
        }

        const update = montarAtualizacaoIncremental(equipamento, entrada, {
          origem: 'import_ae',
          politicaConflito,
          knowledgeVersion: par.item.knowledgeVersion,
          tipoEvento: 'import',
          por: 'auditoria_rapida_ae',
        })

        const bloqueados = (update.bloqueados || []).map(b => ({
          campo: b.campo,
          atual: b.atual,
          proposto: b.extraido,
          status: 'bloqueado_por_protecao_manual',
        }))

        if (!update.aplicar) {
          // Nunca auditado sem nada a mudar não é "atualização disponível".
          if (avaliacao.situacao === 'nunca_auditado' && update.motivo === 'sem_campos_novos') {
            relatorio.nunca_auditados.push({ ...base, motivo: update.motivo, bloqueados })
          } else if (update.motivo === 'sem_campos_novos' && bloqueados.length === 0) {
            relatorio.atualizados.push({ ...base, motivo: update.motivo })
          } else {
            relatorio.revisao.push({ ...base, motivo: update.motivo, bloqueados, alertas: update.alertas || [] })
          }
          continue
        }

        const campos = [
          ...(update.preenchidos || []).map(campo => ({
            campo, atual: null, proposto: update.after.specs_canonicas[campo], status: 'preenchimento',
          })),
          ...(update.sobrescritos || []).map(s => ({
            campo: s.campo, atual: s.anterior, proposto: s.novo, status: 'sobrescrita',
          })),
        ]

        const registro = {
          ...base,
          situacao: avaliacao.situacao === 'nunca_auditado'
            ? SITUACAO.NUNCA_AUDITADO
            : SITUACAO.ATUALIZACAO_DISPONIVEL,
          campos,
          bloqueados,
          alertas: update.alertas || [],
          // Plano de escrita pré-calculado — consumido apenas na fase de aplicação.
          plano: { set: update.set, push: update.push },
        }

        if (registro.situacao === SITUACAO.NUNCA_AUDITADO) {
          relatorio.nunca_auditados.push(registro)
        } else {
          relatorio.atualizacoes.push(registro)
          relatorio.totais_por_familia[par.item.familia] =
            (relatorio.totais_por_familia[par.item.familia] || 0) + 1
          relatorio.total_atualizacoes++
        }
      }
    }

    relatorio.finalizado_em = new Date().toISOString()
    relatorio.duracao_ms = Date.now() - iniciadoEm.getTime()
    return relatorio
  }

  return { executar }
}

/**
 * Renderiza o resumo textual da auditoria no formato acordado.
 * @param {object} relatorio
 * @returns {string}
 */
export function formatarResumo(relatorio) {
  const linhas = [
    'Auditoria concluída',
    '',
    `Equipamentos analisados: ${relatorio.analisados}`,
    '',
    'Atualizações encontradas',
    '',
  ]
  for (const familia of FAMILIAS_RELATORIO) {
    const rotulo = ROTULO_FAMILIA[familia]
    const pontos = '.'.repeat(Math.max(1, 16 - rotulo.length))
    linhas.push(`${rotulo} ${pontos} ${relatorio.totais_por_familia[familia] || 0}`)
  }
  linhas.push('', '-'.repeat(28), `Total .......... ${relatorio.total_atualizacoes}`)
  return linhas.join('\n')
}
