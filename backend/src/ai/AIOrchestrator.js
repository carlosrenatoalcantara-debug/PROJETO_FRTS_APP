/**
 * AIOrchestrator.js — AI-ARCH-01 (FASE 3 + FASE 5)
 *
 * PONTO ÚNICO de toda extração por IA. Elimina chamadas diretas a Claude/Gemini/
 * OpenAI espalhadas pelos controllers. Implementa a cascata resiliente:
 *
 *   (OCR já feito pelo chamador)
 *     → Gemini → Claude → GPT → Motor Interno → Preenchimento Assistido
 *
 * Integra Circuit Breaker (FASE 6), Health Monitor (FASE 7) e Quality Score (FASE 8).
 * O usuário não percebe a troca de provider: a saída é sempre o schema interno.
 */

import { ordenarProviders, CONFIG_PADRAO } from './aiConfig.js'
import { CircuitBreaker } from './circuitBreaker.js'
import { HealthMonitor } from './healthMonitor.js'
import { calcularQualidade } from './qualityScore.js'
import { criarSchemaInterno } from './schema.js'

export class AIOrchestrator {
  /**
   * @param {Object} opts
   * @param {Object<string, import('./adapters/baseAdapter.js').BaseAdapter>} opts.adapters  nome→adapter
   * @param {Array}  [opts.config]        config de providers (provider/enabled/priority)
   * @param {HealthMonitor} [opts.health]
   * @param {number} [opts.cooldownMs]    cooldown do breaker
   * @param {number} [opts.limiteFalhas]
   * @param {() => number} [opts.now]
   */
  constructor({ adapters, config = CONFIG_PADRAO, health = new HealthMonitor(), cooldownMs = 60000, limiteFalhas = 3, now = () => Date.now() } = {}) {
    if (!adapters || typeof adapters !== 'object') throw new Error('AIOrchestrator requer adapters')
    this.adapters = adapters
    this.config = config
    this.health = health
    this._now = now
    this.breakers = {}
    for (const nome of Object.keys(adapters)) {
      this.breakers[nome] = new CircuitBreaker({ nome, cooldownMs, limiteFalhas, now })
      this.health.setConfigurado(nome, !!adapters[nome]?.isConfigured?.())
    }
  }

  /** Providers na ordem da cascata, restritos aos que têm adapter registrado. */
  _fila() {
    return ordenarProviders(this.config)
      .map(c => c.provider)
      .filter(nome => this.adapters[nome])
  }

  /**
   * Executa a cascata e devolve SEMPRE o schema interno + metadados.
   * @param {Object} input { pdfBuffer?, textoOCR?, tipoEsperado? }
   * @returns {Promise<{ok:boolean, provider:?string, dados:Object, qualidade:Object, tentativas:Array, preenchimentoAssistido:boolean}>}
   */
  async extrair(input = {}) {
    const tentativas = []

    for (const nome of this._fila()) {
      const adapter = this.adapters[nome]
      const breaker = this.breakers[nome]
      const configurado = !!adapter.isConfigured?.()
      this.health.setConfigurado(nome, configurado)

      if (!configurado) {
        tentativas.push({ provider: nome, pulado: 'nao_configurado' })
        continue
      }
      if (!breaker.permite()) {
        tentativas.push({ provider: nome, pulado: 'circuit_open' })
        continue
      }

      const inicio = this._now()
      try {
        const dados = await adapter.extract(input)
        const latenciaMs = this._now() - inicio
        breaker.registrarSucesso()
        this.health.registrar(nome, { sucesso: true, latenciaMs })

        // Resultado só é "bom" se trouxe ao menos identidade.
        const temIdentidade = !!(dados.fabricante && dados.modelo)
        const qualidade = calcularQualidade(dados)
        tentativas.push({ provider: nome, ok: true, latenciaMs, score: qualidade.score })

        if (temIdentidade) {
          return {
            ok: true,
            provider: nome,
            dados: { ...dados, _meta: { ...(dados._meta || {}), provider: nome } },
            qualidade,
            tentativas,
            preenchimentoAssistido: qualidade.decisao === 'solicitar_preenchimento',
          }
        }
        // Sem identidade → trata como falha "soft" e segue a cascata.
        tentativas[tentativas.length - 1].ok = false
        tentativas[tentativas.length - 1].motivo = 'sem_identidade'
      } catch (err) {
        const latenciaMs = this._now() - inicio
        breaker.registrarFalha(err?.message || 'erro')
        this.health.registrar(nome, { sucesso: false, latenciaMs, erro: err?.message || 'erro' })
        tentativas.push({ provider: nome, ok: false, latenciaMs, motivo: err?.message || 'erro' })
      }
    }

    // Cascata esgotada → preenchimento assistido (schema vazio porém válido).
    const vazio = criarSchemaInterno({ tipo: input?.tipoEsperado || null, _meta: { provider: 'nenhum' } })
    return {
      ok: false,
      provider: null,
      dados: vazio,
      qualidade: calcularQualidade(vazio),
      tentativas,
      preenchimentoAssistido: true,
    }
  }

  /** FASE 7 — snapshot de saúde (monitor + breakers). */
  health_snapshot() {
    const estados = {}
    for (const [nome, b] of Object.entries(this.breakers)) estados[nome] = b.snapshot().estado
    return this.health.snapshot(estados)
  }

  /** Sondagem ativa de todos os providers que suportam ping(). */
  async pingTodos() {
    const out = {}
    for (const [nome, adapter] of Object.entries(this.adapters)) {
      if (typeof adapter.ping === 'function') {
        out[nome] = await adapter.ping()
        this.health.registrar(nome, { sucesso: !!out[nome].ok, latenciaMs: out[nome].latenciaMs ?? null, erro: out[nome].ok ? null : out[nome].motivo })
      } else {
        out[nome] = { ok: adapter.isConfigured?.() ?? true, motivo: 'sem ping' }
      }
    }
    return out
  }
}
