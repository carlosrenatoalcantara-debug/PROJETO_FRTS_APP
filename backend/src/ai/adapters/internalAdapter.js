/**
 * internalAdapter.js — AI-ARCH-01 (FASE 4 / FASE 5 último nível)
 *
 * Motor INTERNO (sem IA externa, sem chave): extrai fabricante+modelo do texto
 * OCR via catálogo de regex. É o último elo da cascata antes do "preenchimento
 * assistido". SEMPRE disponível — nunca depende de fornecedor único.
 *
 * Honesto: o motor de texto recupera IDENTIDADE (fabricante/modelo), não os
 * dados técnicos (esses exigem provider de IA). especificacoes vem vazio.
 */

import { BaseAdapter } from './baseAdapter.js'
import { extrairFabricanteModelo } from '../../utils/catalogo/fabricanteModeloFallback.js'

export class InternalAdapter extends BaseAdapter {
  constructor() { super('internal') }

  isConfigured() { return true } // sempre disponível

  async _chamar(input) {
    const texto = input?.textoOCR || ''
    const fb = extrairFabricanteModelo(texto)
    return {
      fabricante: fb.fabricante,
      modelo: fb.modelo,
      tipo: input?.tipoEsperado || (fb.fabricante ? 'inversor' : null),
      especificacoes: {}, // motor de texto não extrai specs técnicas
      _meta: { confianca: fb.confianca ?? 0, evidencia: fb.evidencia ?? null, fonte: 'regex_interno' },
    }
  }
}
