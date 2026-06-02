/**
 * internalAdapter.js — AI-ARCH-01 (FASE 4 / FASE 5 último nível)
 *
 * Motor INTERNO (sem IA externa, sem chave): extrai fabricante+modelo do texto
 * OCR via catálogo de regex. É o último elo da cascata antes do "preenchimento
 * assistido". SEMPRE disponível — nunca depende de fornecedor único.
 *
 * P0-CAT-09: agora também extrai DADOS TÉCNICOS de forma determinística (sem IA),
 * via parserTecnicoInversor sobre o texto OCR. A IA passa a ser complemento.
 */

import { BaseAdapter } from './baseAdapter.js'
import { extrairFabricanteModelo } from '../../utils/catalogo/fabricanteModeloFallback.js'
import { expandirModelosInversor } from '../serieInversor.js'
import { extrairSpecsTecnicas } from '../parserTecnicoInversor.js'

export class InternalAdapter extends BaseAdapter {
  constructor() { super('internal') }

  isConfigured() { return true } // sempre disponível

  async _chamar(input) {
    const texto = input?.textoOCR || ''
    const fb = extrairFabricanteModelo(texto)
    // P0-INV-01: motor interno também expande série (N modelos) a partir do texto.
    const { modelos } = expandirModelosInversor(texto)
    const lista = modelos.length > 1 ? modelos : (fb.modelo ? [fb.modelo] : [])
    // P0-CAT-09: cada variante já carrega as specs técnicas extraídas do texto
    // (chaves canônicas → mapearEspecificacoes as repassa direto).
    const variantes = lista.map(modelo_variante => ({
      modelo_variante,
      ...extrairSpecsTecnicas(texto, modelo_variante),
    }))
    return {
      fabricante: fb.fabricante,
      modelo: fb.modelo,
      tipo: input?.tipoEsperado || (fb.fabricante ? 'inversor' : null),
      especificacoes: lista.length === 0 ? extrairSpecsTecnicas(texto, fb.modelo) : {},
      variantes,
      _meta: { confianca: fb.confianca ?? 0, evidencia: fb.evidencia ?? null, fonte: 'parser_deterministico' },
    }
  }
}
