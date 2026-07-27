/**
 * auditoriaAplicacaoService.js — F6: aplicação das atualizações do AE
 *
 * Consome o plano JÁ CALCULADO pela Auditoria Rápida. Não recalcula merge,
 * não compara KnowledgeVersion e não conhece o AE: a comparação de versões
 * permanece encapsulada em `integracoes/ae/knowledgeVersion.js`, com um único
 * call site (o orquestrador da auditoria).
 *
 * ─── Atomicidade por equipamento ───────────────────────────────────────────
 *
 * Cada equipamento é uma unidade indivisível. Em uma única operação:
 *   1. dados técnicos (specs_canonicas)
 *   2. evento de histórico (validacao.historico)
 *   3. origem + knowledge_version
 *
 * Ou tudo é gravado, ou nada é — não existe estado parcial por equipamento.
 * A porta `aplicarNoRepositorio` deve honrar esse contrato (no MongoDB, uma
 * atualização de documento único já é atômica).
 *
 * ─── Concorrência ──────────────────────────────────────────────────────────
 *
 * O plano nasce de um retrato do catálogo. Se o equipamento mudou depois da
 * auditoria, aplicar seria sobrescrever às cegas. Por isso toda gravação leva
 * a versão esperada como guarda: se não bater, o item é ignorado com
 * `estado_alterado` e exige nova auditoria.
 */

/** Resultado possível por equipamento. */
export const RESULTADO = Object.freeze({
  APLICADO: 'aplicado',
  IGNORADO: 'ignorado',
  ESTADO_ALTERADO: 'estado_alterado',
  ERRO: 'erro',
})

/**
 * @param {object} deps
 * @param {(cmd: object) => Promise<{status: string, motivo?: string}>} deps.aplicarNoRepositorio
 *   Recebe { id, versaoEsperada, set, push } e grava atomicamente.
 * @param {(cmd: object) => Promise<{status: string, motivo?: string}>} [deps.reverterNoRepositorio]
 *   Recebe { id, estadoAnterior, evento } e restaura atomicamente.
 */
export function criarAplicadorAuditoria({ aplicarNoRepositorio, reverterNoRepositorio } = {}) {
  if (typeof aplicarNoRepositorio !== 'function') {
    throw new Error('auditoriaAplicacaoService: "aplicarNoRepositorio" é obrigatório.')
  }

  /**
   * Aplica as atualizações de um relatório de Auditoria Rápida.
   *
   * @param {object} relatorio            saída de auditoriaRapidaService.executar()
   * @param {object} [opcoes]
   * @param {string[]|null} [opcoes.selecionados]
   *   ids a aplicar. `null` = todos. Itens desmarcados na tela ficam de fora.
   * @param {boolean} [opcoes.incluirNuncaAuditados=false]
   *   Primeira auditoria não é "atualização"; só entra se pedido explicitamente.
   * @returns {Promise<object>} relatório de aplicação
   */
  async function aplicar(relatorio, opcoes = {}) {
    const { selecionados = null, incluirNuncaAuditados = false } = opcoes
    const permitido = selecionados === null ? null : new Set(selecionados)

    const candidatos = [
      ...(relatorio?.atualizacoes || []),
      ...(incluirNuncaAuditados ? (relatorio?.nunca_auditados || []).filter(i => i.plano) : []),
    ]

    const resultado = {
      iniciado_em: new Date().toISOString(),
      total_candidatos: candidatos.length,
      aplicados: 0,
      ignorados: 0,
      estado_alterado: 0,
      erros: 0,
      detalhes: [],
    }

    for (const item of candidatos) {
      const base = {
        id: item.id,
        familia: item.familia,
        fabricante: item.fabricante,
        modelo: item.modelo,
        versao_anterior: item.versao_catalogo ?? null,
        versao_nova: item.versao_ae ?? null,
        campos: (item.campos || []).map(c => c.campo),
      }

      if (permitido && !permitido.has(item.id)) {
        resultado.ignorados++
        resultado.detalhes.push({ ...base, status: RESULTADO.IGNORADO, motivo: 'desmarcado pelo usuário' })
        continue
      }

      if (!item.plano?.set) {
        resultado.erros++
        resultado.detalhes.push({ ...base, status: RESULTADO.ERRO, motivo: 'plano ausente' })
        continue
      }

      try {
        const r = await aplicarNoRepositorio({
          id: item.id,
          // Guarda de concorrência: estado esperado no momento da auditoria.
          versaoEsperada: item.versao_catalogo ?? null,
          set: item.plano.set,
          push: item.plano.push,
        })

        if (r.status === RESULTADO.APLICADO) {
          resultado.aplicados++
          resultado.detalhes.push({ ...base, status: RESULTADO.APLICADO })
        } else if (r.status === RESULTADO.ESTADO_ALTERADO) {
          resultado.estado_alterado++
          resultado.detalhes.push({
            ...base,
            status: RESULTADO.ESTADO_ALTERADO,
            motivo: r.motivo || 'equipamento alterado após a auditoria — execute nova auditoria',
          })
        } else {
          resultado.erros++
          resultado.detalhes.push({ ...base, status: RESULTADO.ERRO, motivo: r.motivo || 'falha desconhecida' })
        }
      } catch (err) {
        // Falha em um equipamento não interrompe os demais: cada um é atômico
        // e independente. Nada ficou parcialmente gravado neste item.
        resultado.erros++
        resultado.detalhes.push({ ...base, status: RESULTADO.ERRO, motivo: err.message })
      }
    }

    resultado.finalizado_em = new Date().toISOString()
    return resultado
  }

  /**
   * Reverte a última aplicação do AE em um equipamento, a partir do estado
   * anterior registrado no histórico. Também atômico.
   *
   * @param {object} equipamento  documento com validacao.historico
   * @returns {Promise<object>}
   */
  async function reverter(equipamento) {
    if (typeof reverterNoRepositorio !== 'function') {
      throw new Error('auditoriaAplicacaoService: "reverterNoRepositorio" não foi fornecido.')
    }

    const historico = equipamento?.validacao?.historico || []
    // Último evento gravado pela Auditoria Rápida.
    const evento = [...historico].reverse().find(e => e.por === 'auditoria_rapida_ae')

    if (!evento) {
      return { status: RESULTADO.IGNORADO, motivo: 'nenhuma aplicação do AE registrada' }
    }
    if (!evento.antes) {
      return { status: RESULTADO.ERRO, motivo: 'evento sem estado anterior registrado' }
    }

    return reverterNoRepositorio({
      id: String(equipamento._id ?? equipamento.id ?? ''),
      estadoAnterior: evento.antes,
      evento,
    })
  }

  return { aplicar, reverter }
}

/**
 * Adaptador MongoDB da porta de aplicação.
 *
 * `updateOne` sobre documento único é atômico: specs técnicas, histórico e
 * knowledge_version são confirmados juntos ou nenhum deles.
 *
 * O filtro carrega a versão esperada — se outro processo alterou o
 * equipamento após a auditoria, `matchedCount` é 0 e nada é gravado.
 *
 * @param {object} Modelo  model Mongoose (Equipamento)
 */
export function criarRepositorioMongo(Modelo) {
  return {
    async aplicarNoRepositorio({ id, versaoEsperada, set, push }) {
      const filtro = { _id: id, 'origem.knowledge_version': versaoEsperada ?? null }
      const update = { $set: set }
      if (push) update.$push = push

      const r = await Modelo.updateOne(filtro, update, { runValidators: false })

      if ((r.matchedCount ?? r.n ?? 0) === 0) {
        return {
          status: RESULTADO.ESTADO_ALTERADO,
          motivo: 'knowledge_version divergente do momento da auditoria',
        }
      }
      return { status: RESULTADO.APLICADO }
    },

    async reverterNoRepositorio({ id, estadoAnterior, evento }) {
      const set = {
        specs_canonicas: estadoAnterior.specs_canonicas,
        origem: estadoAnterior.origem,
      }
      if (estadoAnterior.identificacao) set.identificacao = estadoAnterior.identificacao
      if (estadoAnterior.qualidade) set.qualidade = estadoAnterior.qualidade
      if (estadoAnterior.fabricante !== undefined) set.fabricante = estadoAnterior.fabricante
      if (estadoAnterior.modelo !== undefined) set.modelo = estadoAnterior.modelo

      const r = await Modelo.updateOne(
        { _id: id },
        {
          $set: set,
          $push: {
            'validacao.historico': {
              $each: [{
                em: new Date(),
                tipo: 'correcao_manual',
                por: 'auditoria_rapida_ae:rollback',
                antes: { origem: { knowledge_version: evento?.depois?.origem?.knowledge_version ?? null } },
                depois: { origem: estadoAnterior.origem },
                campos_alterados: evento?.campos_alterados || [],
                observacao: 'Rollback da aplicação do Datasheet Técnico AE',
              }],
              $slice: -50,
            },
          },
        },
        { runValidators: false },
      )

      if ((r.matchedCount ?? r.n ?? 0) === 0) {
        return { status: RESULTADO.ERRO, motivo: 'equipamento não encontrado' }
      }
      return { status: RESULTADO.APLICADO }
    },
  }
}
