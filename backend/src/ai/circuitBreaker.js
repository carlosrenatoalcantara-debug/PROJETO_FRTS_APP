/**
 * circuitBreaker.js — AI-ARCH-01 (FASE 6)
 *
 * Circuit breaker por provider. Evita martelar um provider que está falhando.
 *
 *   CLOSED    → operando normal. N falhas consecutivas → OPEN.
 *   OPEN      → em cooldown; recusa chamadas. Após cooldown → HALF_OPEN.
 *   HALF_OPEN → permite 1 tentativa de sondagem. Sucesso → CLOSED; falha → OPEN.
 *
 * PURO em relação a I/O. Usa um relógio injetável (`now`) para testes determinísticos.
 */

export const ESTADOS = { CLOSED: 'closed', OPEN: 'open', HALF_OPEN: 'half_open' }

export class CircuitBreaker {
  /**
   * @param {Object} opts
   * @param {string} [opts.nome]
   * @param {number} [opts.limiteFalhas=3]  falhas consecutivas para abrir
   * @param {number} [opts.cooldownMs=60000] tempo em OPEN antes de sondar
   * @param {() => number} [opts.now] relógio (default Date.now)
   */
  constructor({ nome = 'provider', limiteFalhas = 3, cooldownMs = 60000, now = () => Date.now() } = {}) {
    this.nome = nome
    this.limiteFalhas = limiteFalhas
    this.cooldownMs = cooldownMs
    this._now = now
    this.estado = ESTADOS.CLOSED
    this.falhasConsecutivas = 0
    this.abertoEm = null
    this.ultimoErro = null
  }

  /** Atualiza o estado com base no tempo (OPEN → HALF_OPEN após cooldown). */
  _refresh() {
    if (this.estado === ESTADOS.OPEN && this.abertoEm != null) {
      if (this._now() - this.abertoEm >= this.cooldownMs) {
        this.estado = ESTADOS.HALF_OPEN
      }
    }
  }

  /** Pode fazer uma requisição agora? */
  permite() {
    this._refresh()
    return this.estado !== ESTADOS.OPEN
  }

  registrarSucesso() {
    this.falhasConsecutivas = 0
    this.ultimoErro = null
    this.estado = ESTADOS.CLOSED
    this.abertoEm = null
  }

  /** @param {string} [erro] */
  registrarFalha(erro = null) {
    this.ultimoErro = erro
    this._refresh()
    if (this.estado === ESTADOS.HALF_OPEN) {
      // sondagem falhou → reabre imediatamente
      this._abrir()
      return
    }
    this.falhasConsecutivas += 1
    if (this.falhasConsecutivas >= this.limiteFalhas) {
      this._abrir()
    }
  }

  _abrir() {
    this.estado = ESTADOS.OPEN
    this.abertoEm = this._now()
  }

  /** Snapshot para o Health Monitor. */
  snapshot() {
    this._refresh()
    return {
      nome: this.nome,
      estado: this.estado,
      falhasConsecutivas: this.falhasConsecutivas,
      ultimoErro: this.ultimoErro,
      cooldownMs: this.cooldownMs,
      limiteFalhas: this.limiteFalhas,
    }
  }
}
