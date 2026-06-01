/**
 * baseAdapter.js — AI-ARCH-01 (FASE 4)
 *
 * Contrato comum a TODO adapter de provider. Garante que o restante do sistema
 * só veja o schema interno canônico (schema.js). Cada provider concreto
 * implementa `_chamar(input)` e `_normalizar(raw)`.
 *
 * Entrada padrão: { pdfBuffer?, textoOCR?, tipoEsperado? }
 * Saída padrão:   schema interno { fabricante, modelo, tipo, especificacoes, _meta }
 */

import { criarSchemaInterno } from '../schema.js'

export class AINaoConfiguradoError extends Error {
  constructor(nome) { super(`Provider ${nome} não configurado`); this.code = 'AI_NAO_CONFIGURADO'; this.provider = nome }
}

export class BaseAdapter {
  /** @param {string} nome */
  constructor(nome) { this.nome = nome }

  /** Provider tem credencial/condições para operar? Sobrescrever. */
  isConfigured() { return true }

  /** Chamada real ao provider. Deve devolver objeto cru. Sobrescrever. */
  async _chamar(_input) { throw new Error(`${this.nome}._chamar não implementado`) }

  /** Normaliza o objeto cru do provider para o schema interno. Sobrescrever se preciso. */
  _normalizar(raw) {
    const r = raw || {}
    const esp = r.especificacoes || r.especificacao || r.specs || {}
    return criarSchemaInterno({
      fabricante: r.fabricante ?? r.marca ?? null,
      modelo: r.modelo ?? null,
      tipo: r.tipo ?? null,
      especificacoes: esp,
      _meta: { provider: this.nome, ...(r._meta || {}) },
    })
  }

  /**
   * Executa a extração e devolve SEMPRE o schema interno (ou lança).
   * @param {Object} input { pdfBuffer?, textoOCR?, tipoEsperado? }
   */
  async extract(input = {}) {
    if (!this.isConfigured()) throw new AINaoConfiguradoError(this.nome)
    const raw = await this._chamar(input)
    return this._normalizar(raw)
  }
}
