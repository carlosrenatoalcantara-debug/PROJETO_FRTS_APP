/**
 * healthMonitor.js — AI-ARCH-01 (FASE 7)
 *
 * Registro centralizado de saúde dos providers de IA. Alimentado pelo
 * AIOrchestrator a cada chamada. Exposto via GET /api/ai/health.
 *
 * Métricas por provider: status, última validação, latência, taxa de sucesso,
 * último erro. Mantém uma janela móvel de resultados para a taxa de sucesso.
 */

const JANELA = 20 // amostras para taxa de sucesso

export class HealthMonitor {
  constructor({ now = () => Date.now() } = {}) {
    this._now = now
    this._providers = new Map() // nome → estado
  }

  _get(nome) {
    if (!this._providers.has(nome)) {
      this._providers.set(nome, {
        nome,
        configurado: false,
        ultimaValidacao: null,
        ultimaLatenciaMs: null,
        ultimoErro: null,
        amostras: [], // booleans recentes
        totalChamadas: 0,
        totalSucessos: 0,
      })
    }
    return this._providers.get(nome)
  }

  setConfigurado(nome, configurado) {
    this._get(nome).configurado = !!configurado
  }

  /** Registra o resultado de uma chamada. */
  registrar(nome, { sucesso, latenciaMs = null, erro = null } = {}) {
    const p = this._get(nome)
    p.ultimaValidacao = this._now()
    p.ultimaLatenciaMs = latenciaMs
    p.totalChamadas += 1
    if (sucesso) { p.totalSucessos += 1; p.ultimoErro = null }
    else p.ultimoErro = erro
    p.amostras.push(!!sucesso)
    if (p.amostras.length > JANELA) p.amostras.shift()
  }

  /** Status legível derivado de configurado + amostras + breaker opcional. */
  _statusDe(p, estadoBreaker) {
    if (!p.configurado) return 'NAO_CONFIGURADO'
    if (estadoBreaker === 'open') return 'EM_COOLDOWN'
    if (p.totalChamadas === 0) return 'DESCONHECIDO'
    const ult = p.amostras[p.amostras.length - 1]
    return ult ? 'ONLINE' : 'ERRO'
  }

  /**
   * Snapshot completo. `breakers` é um mapa opcional nome→estado para enriquecer.
   * @param {Object<string,string>} [breakers]
   */
  snapshot(breakers = {}) {
    const out = []
    for (const p of this._providers.values()) {
      const taxa = p.amostras.length
        ? Math.round((p.amostras.filter(Boolean).length / p.amostras.length) * 100)
        : null
      out.push({
        provider: p.nome,
        status: this._statusDe(p, breakers[p.nome]),
        configurado: p.configurado,
        ultimaValidacao: p.ultimaValidacao,
        latenciaMs: p.ultimaLatenciaMs,
        taxaSucessoPct: taxa,
        ultimoErro: p.ultimoErro,
        totalChamadas: p.totalChamadas,
        estadoBreaker: breakers[p.nome] || null,
      })
    }
    return out
  }
}
