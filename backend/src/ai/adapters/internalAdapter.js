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
import { parseMatricial, parseColunaUnica } from '../parserMatricial.js'

export class InternalAdapter extends BaseAdapter {
  constructor() { super('internal') }

  isConfigured() { return true } // sempre disponível

  async _chamar(input) {
    const texto = input?.textoOCR || ''
    const fb = extrairFabricanteModelo(texto)
    // P0-INV-01: motor interno também expande série (N modelos) a partir do texto.
    const { modelos } = expandirModelosInversor(texto)
    const lista = modelos.length > 1 ? modelos : (fb.modelo ? [fb.modelo] : [])

    // P1-INV-MATRIX-01: datasheets MULTI-MODELO usam o parser MATRICIAL POSICIONAL
    // (coordenadas x/y do PDF) — cada modelo recebe a SUA coluna. Sem isso, o
    // parser de texto associa a coluna-1 a todos os modelos (bug GoodWe DT/Sungrow).
    let fonte = 'parser_deterministico'
    let variantes = null
    // P1-INV-HARDEN-PLUS-01: tenta matricial SEMPRE que houver PDF (auto-detecção
    // de colunas cobre casos em que a detecção textual achou 0–1 modelos).
    if (input?.pdfBuffer) {
      const mat = await parseMatricial(input.pdfBuffer, lista)
      if (mat.ok && mat.modelos.length > 1) {
        fonte = 'parser_matricial'
        // P1-INV-HARDEN-PLUS-01: complemento GLOBAL — campos normalmente iguais a
        // todos os modelos (dimensões, IP, certificações, temperatura, fases, peso,
        // garantia, efic. europeia) são extraídos do texto e preenchem o que a
        // matriz não capturou (marcados como inferido_alta = valor compartilhado).
        const globais = extrairSpecsTecnicas(texto, null)
        const CAMPOS_GLOBAIS = ['dimensoes', 'grau_protecao_ip', 'certificacoes', 'temperatura_operacao', 'fases', 'peso_kg', 'garantia_anos', 'eficiencia_maxima', 'eficiencia_europeia', 'tensao_max_entrada', 'tensao_mppt_min', 'tensao_mppt_max']
        variantes = mat.modelos.map(modelo_variante => {
          const esp = { ...mat.porModelo[modelo_variante].especificacoes }
          const _status = { ...mat.porModelo[modelo_variante]._status }
          for (const k of CAMPOS_GLOBAIS) {
            if ((esp[k] === undefined || esp[k] === null || esp[k] === '') && globais[k] != null) {
              esp[k] = globais[k]
              _status[k] = 'inferido_alta'
            }
          }
          return { modelo_variante, ...esp, _status }
        })
      }
    }

    // P1-INV-HARDEN-PLUS-02: datasheet SINGLE-MODEL column-major (ex.: Sungrow
    // SG110CX) — rótulo à esquerda, valor à direita na mesma linha visual. O parser
    // de texto não associa os dois; o posicional single-column sim.
    if (!variantes && input?.pdfBuffer && lista.length >= 1) {
      const col = await parseColunaUnica(input.pdfBuffer)
      if (col.ok) {
        fonte = 'parser_coluna_unica'
        // datasheet single-column: os modelos da lista compartilham a MESMA coluna
        // de dados (variantes de um único modelo físico). Aplica a todos.
        variantes = lista.map(modelo_variante => {
          const globais = extrairSpecsTecnicas(texto, modelo_variante)
          const esp = { ...col.especificacoes }
          for (const [k, val] of Object.entries(globais)) {
            if (esp[k] === undefined || esp[k] === null || esp[k] === '') esp[k] = val
          }
          return { modelo_variante, ...esp, _status: col._status }
        })
      }
    }

    // Fallback: parser de TEXTO por modelo (P0-CAT-09). Em MULTI-modelo, o texto
    // não separa colunas com segurança → marca confiança BAIXA (P1-INV-HARDEN-01).
    if (!variantes) {
      const multi = lista.length > 1
      variantes = lista.map(modelo_variante => {
        const esp = extrairSpecsTecnicas(texto, modelo_variante)
        const _status = multi
          ? Object.fromEntries(Object.keys(esp).map(k => [k, 'inferido_baixa']))
          : undefined
        return { modelo_variante, ...esp, _status }
      })
    }

    return {
      fabricante: fb.fabricante,
      modelo: fb.modelo,
      tipo: input?.tipoEsperado || (fb.fabricante ? 'inversor' : null),
      especificacoes: lista.length === 0 ? extrairSpecsTecnicas(texto, fb.modelo) : {},
      variantes,
      _meta: { confianca: fb.confianca ?? 0, evidencia: fb.evidencia ?? null, fonte },
    }
  }
}
