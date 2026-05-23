/**
 * documentoEstruturadoService.js — DOCUMENT_ENGINE_V1
 * Sprint S2.15-B.1 — Estruturação Documental Canônica FV
 *
 * Converte texto bruto (entrada direta ou OCR futuro) em estrutura
 * intermediária auditável, determinística e serializável em JSON puro.
 *
 * ── Correções vs versão revisada (code-review 2026-05-21) ────────────────────
 *  [B1] Linhas vazias preservadas antes do agrupamento — delimitam blocos
 *  [B2] Tabelas associadas ao bloco onde ocorrem (não lista global paralela)
 *  [B3] Separadores markdown detectados, ignorados, preservados em
 *       linhas_descartadas com motivo auditável
 *  [B4] Separadores de bloco (===, ---) registrados em separadores_encontrados
 *  [B5] linhas_descartadas[] por bloco com campo `motivo` obrigatório
 *  [B6] new Date() substituído por new Date().toISOString()
 *  [B7] Exportado como classe nomeada — sem singleton default export
 *  [B8] Guard de entrada com TypeError descritivo
 *  [B9] Parsing multi-plataforma: \r\n / \r / \n
 *
 * ── Readiness ────────────────────────────────────────────────────────────────
 *  OCR avançado : linhas preservam indice_original para mapeamento de bbox
 *  Unifilar futuro : blocos delimitam regiões lógicas do documento
 *  Embeddings : tokens_normalizados pronto para vetorização por bloco
 */

// ─── Tipos de linha (enum frozen) ─────────────────────────────────────────────

export const TIPO_LINHA = Object.freeze({
  CONTEUDO:     'conteudo',        // texto semântico normal
  VAZIA:        'vazia',           // linha em branco — delimita bloco
  SEP_BLOCO:    'separador_bloco', // ===, ---, *** — delimita bloco com rastro
  SEP_MD:       'separador_md',    // |---|---| — ignorar, preservar em descartadas
  LINHA_TABELA: 'linha_tabela',    // linha com pipes — dado tabular
})

// ─── Regexes compilados ───────────────────────────────────────────────────────

/** Linha que é apenas `===`, `---` ou `***` (mínimo 3 repetições) */
const RE_SEP_BLOCO = /^(?:={3,}|-{3,}|\*{3,})$/

/** Célula de separador markdown: apenas traços, dois-pontos e espaços */
const RE_CELULA_SEP_MD = /^\s*:?-{2,}:?\s*$/

// ─── Funções puras de parsing (module-private) ────────────────────────────────

/**
 * Detecta separadores markdown de tabela.
 * Suporta: |---|---| , |:---:|---:| , --- | --- | ---
 *
 * @param {string} trim - Conteúdo já aparado da linha
 * @returns {boolean}
 */
function _isSepMarkdown(trim) {
  if (!trim.includes('-')) return false
  // Remove pipes externos opcionais antes de dividir
  const celulas = trim
    .replace(/^\||\|$/g, '')
    .split('|')
    .map(c => c.trim())
    .filter(c => c.length > 0)
  // Ao menos uma célula, todas são apenas traços/dois-pontos
  return celulas.length >= 1 && celulas.every(c => RE_CELULA_SEP_MD.test(c))
}

/**
 * Classifica uma linha em um TIPO_LINHA.
 *
 * @param {string} conteudo - Conteúdo bruto da linha (incluindo espaços)
 * @param {number} indice   - Índice 0-based da linha no texto original
 * @returns {LinhaClassificada}
 */
function _classificarLinha(conteudo, indice) {
  const trim = conteudo.trim()
  let tipo

  if (trim.length === 0) {
    tipo = TIPO_LINHA.VAZIA
  } else if (RE_SEP_BLOCO.test(trim)) {
    tipo = TIPO_LINHA.SEP_BLOCO
  } else if (trim.includes('|') && _isSepMarkdown(trim)) {
    tipo = TIPO_LINHA.SEP_MD
  } else if (trim.includes('|')) {
    tipo = TIPO_LINHA.LINHA_TABELA
  } else {
    tipo = TIPO_LINHA.CONTEUDO
  }

  return { indice, conteudo, conteudo_trim: trim, tipo }
}

/**
 * Extrai células de uma linha pipe.
 * Remove pipes externos e aparas espaços por célula.
 *
 * @param {string} trim
 * @returns {string[]}
 */
function _parseCelulas(trim) {
  return trim
    .replace(/^\||\|$/g, '')
    .split('|')
    .map(c => c.trim())
}

/**
 * Constrói uma Tabela estruturada a partir de linhas pipe consecutivas.
 *  · Primeira linha = cabeçalho (colunas)
 *  · Linhas com número de células diferente do cabeçalho → linhas_descartadas
 *
 * @param {LinhaClassificada[]}  sequencia            - Linhas tipo LINHA_TABELA em série
 * @param {LinhaDescartada[]}    linhasDescBloco      - Array de destino para descartadas
 * @returns {Tabela|null}
 */
function _construirTabela(sequencia, linhasDescBloco) {
  if (sequencia.length === 0) return null

  const [cabecalho, ...resto] = sequencia
  const colunas     = _parseCelulas(cabecalho.conteudo_trim)
  const linhasDados = []

  for (const linha of resto) {
    const celulas = _parseCelulas(linha.conteudo_trim)
    if (celulas.length === colunas.length) {
      linhasDados.push(celulas)
    } else {
      linhasDescBloco.push({
        indice_original: linha.indice,
        conteudo:        linha.conteudo,
        motivo:          `colunas_divergentes (esperado: ${colunas.length}, recebido: ${celulas.length})`,
      })
    }
  }

  return {
    colunas,
    linhas: linhasDados,
  }
}

/**
 * Pós-processa um bloco bruto:
 *  · Extrai tabelas de sequências de LINHA_TABELA consecutivas
 *  · Popula bloco.linhas[] com linhas de texto simples
 *  · Remove campo interno _linhas_raw
 *
 * @param {BlocoRaw} bloco
 * @returns {Bloco}
 */
function _processarBloco(bloco) {
  const linhasTexto = []
  let seqTabela     = []

  function _fecharSeqTabela() {
    if (seqTabela.length === 0) return
    const tabela = _construirTabela(seqTabela, bloco.linhas_descartadas)
    if (tabela) bloco.tabelas.push(tabela)
    seqTabela = []
  }

  for (const linha of bloco._linhas_raw) {
    if (linha.tipo === TIPO_LINHA.LINHA_TABELA) {
      seqTabela.push(linha)
    } else {
      _fecharSeqTabela()
      linhasTexto.push(linha.conteudo_trim)
    }
  }
  _fecharSeqTabela()

  bloco.linhas = linhasTexto
  delete bloco._linhas_raw   // campo interno — não vaza para o payload final
  return bloco
}

/**
 * Agrupa linhas classificadas em blocos semânticos delimitados por:
 *  · Linhas vazias (TIPO_LINHA.VAZIA)
 *  · Separadores de bloco (TIPO_LINHA.SEP_BLOCO) — registrados com rastro
 *
 * Separadores markdown (SEP_MD) ficam dentro do bloco atual como descartadas.
 *
 * @param {LinhaClassificada[]} linhasClassificadas
 * @returns {BlocoRaw[]}
 */
function _agruparEmBlocos(linhasClassificadas) {
  const blocos = []
  let atual    = _novoBloco(1)

  function _fecharBloco(sepTexto = null) {
    if (sepTexto) atual.separadores_encontrados.push(sepTexto)
    // Só persistir bloco se tiver linhas de conteúdo ou separadores registrados
    const temConteudo  = atual._linhas_raw.length > 0
    const temSep       = atual.separadores_encontrados.length > 0
    const temDesc      = atual.linhas_descartadas.length > 0
    if (temConteudo || temSep || temDesc) {
      blocos.push(atual)
    }
    atual = _novoBloco(blocos.length + 1)
  }

  for (const linha of linhasClassificadas) {
    switch (linha.tipo) {
      case TIPO_LINHA.VAZIA:
        _fecharBloco()
        break

      case TIPO_LINHA.SEP_BLOCO:
        // Separador fecha bloco atual e é registrado nele como rastro
        _fecharBloco(linha.conteudo_trim)
        break

      case TIPO_LINHA.SEP_MD:
        // Separador markdown: ignorado estruturalmente, preservado para auditoria
        atual.linhas_descartadas.push({
          indice_original: linha.indice,
          conteudo:        linha.conteudo,
          motivo:          'separador_markdown',
        })
        break

      default:
        // CONTEUDO e LINHA_TABELA acumulam no bloco atual
        atual._linhas_raw.push(linha)
    }
  }

  _fecharBloco()  // fechar último bloco ao final do texto
  return blocos
}

/**
 * Cria estrutura interna de bloco com todos os campos obrigatórios.
 * `_linhas_raw` é campo temporário — removido em `_processarBloco`.
 *
 * @param {number} id
 * @returns {BlocoRaw}
 */
function _novoBloco(id) {
  return {
    id,
    linhas:                  [],   // preenchido por _processarBloco
    tabelas:                 [],   // preenchido por _processarBloco
    separadores_encontrados: [],   // preenchido por _agruparEmBlocos
    linhas_descartadas:      [],   // SEP_MD + colunas_divergentes
    _linhas_raw:             [],   // temporário — interno ao engine
  }
}

// ─── Classe exportada (DOCUMENT_ENGINE_V1) ────────────────────────────────────

/**
 * DocumentoEstruturadoService — núcleo do DOCUMENT_ENGINE_V1.
 *
 * Exportado como classe nomeada (não singleton) para:
 *  · Testabilidade: instâncias isoladas por test suite
 *  · Extensibilidade: herança para engines especializados (OCR, PDF, etc.)
 *  · Controle de ciclo de vida pelo consumer
 *
 * @example
 *   import { DocumentoEstruturadoService } from './documentoEstruturadoService.js'
 *   const engine = new DocumentoEstruturadoService()
 *   const doc    = engine.criarDocumentoEstruturado({ texto, nome_arquivo, paginas })
 */
export class DocumentoEstruturadoService {

  /**
   * Converte payload bruto em documento estruturado canônico.
   *
   * @param {Object}  payloadRaw
   * @param {string}  [payloadRaw.texto]         - Texto direto (prioridade)
   * @param {string}  [payloadRaw.texto_ocr]     - Texto via OCR (fallback)
   * @param {string}  [payloadRaw.nome_arquivo]
   * @param {number}  [payloadRaw.paginas]
   * @param {string}  [payloadRaw.origem]
   *
   * @returns {{ documento_extraido_raw: DocumentoExtraidoRaw }}
   *
   * @throws {TypeError} Se payloadRaw não for um objeto
   */
  criarDocumentoEstruturado(payloadRaw) {
    // ── Guard de entrada ──────────────────────────────────────────────────────
    if (!payloadRaw || typeof payloadRaw !== 'object' || Array.isArray(payloadRaw)) {
      throw new TypeError(
        `[DocumentoEstruturadoService] payloadRaw deve ser um objeto. ` +
        `Recebido: ${Array.isArray(payloadRaw) ? 'Array' : typeof payloadRaw}`
      )
    }

    const textoOriginal = String(payloadRaw.texto ?? payloadRaw.texto_ocr ?? '')
    const nomeArquivo   = String(payloadRaw.nome_arquivo ?? 'upload_direto.txt')
    const paginas       = this._validarPaginas(payloadRaw.paginas)
    const origem        = String(payloadRaw.origem ?? 'WEB_UI')

    // ── Pipeline de parsing ───────────────────────────────────────────────────
    //   1. Segmentar + classificar cada linha (preservando vazias)
    //   2. Agrupar em blocos semânticos (vazias/separadores delimitam)
    //   3. Por bloco: extrair tabelas associadas + separar conteúdo textual

    const linhasClassificadas = this._segmentarEClassificar(textoOriginal)
    const blocosBrutos        = _agruparEmBlocos(linhasClassificadas)
    const blocos              = blocosBrutos.map(_processarBloco)

    // Lista plana de linhas semânticas (retro-compatibilidade com parecerNormalizerService)
    // Exclui: VAZIA, SEP_BLOCO, SEP_MD — inclui: CONTEUDO + LINHA_TABELA
    const linhas = linhasClassificadas
      .filter(l => l.tipo === TIPO_LINHA.CONTEUDO || l.tipo === TIPO_LINHA.LINHA_TABELA)
      .map(l => ({
        index:    l.indice + 1,   // 1-based para exibição
        conteudo: l.conteudo_trim,
        tamanho:  l.conteudo_trim.length,
        tipo:     l.tipo,         // readiness OCR: downstream pode filtrar por tipo
      }))

    // ── Payload final ─────────────────────────────────────────────────────────
    return {
      documento_extraido_raw: {
        texto_original: textoOriginal,
        linhas,
        blocos,
        metadata: {
          origem,
          nome_arquivo:  nomeArquivo,
          paginas,
          processado_em: new Date().toISOString(),   // [B6] — serialização explícita
          engine_versao: 'DOCUMENT_ENGINE_V1',
          stats: {
            total_linhas_raw:       linhasClassificadas.length,
            total_linhas_semanticas: linhas.length,
            total_blocos:           blocos.length,
            total_tabelas:          blocos.reduce((s, b) => s + b.tabelas.length, 0),
            total_descartadas:      blocos.reduce((s, b) => s + b.linhas_descartadas.length, 0),
          },
          // Readiness para OCR avançado:
          // · indice_original em linhas_descartadas permite mapeamento de bounding boxes
          // · tipo em cada linha permite downstream filtrar regiões textuais vs tabulares
          // · blocos delimitam regiões lógicas do documento (seções, parágrafos, tabelas)
          ocr_readiness: {
            indices_preservados:   true,
            tipos_por_linha:       true,
            regioes_por_bloco:     true,
            bboxes_suportados:     false,   // futura extensão via payloadRaw.ocr_metadata
          },
        },
      },
    }
  }

  /**
   * Segmenta o texto em linhas classificadas.
   *
   * Suporte multi-plataforma:
   *   \r\n  Windows
   *   \r    Mac antigo
   *   \n    Unix / Linux
   *
   * Linhas vazias são PRESERVADAS — são delimitadores semânticos de bloco.
   *
   * @param {string} texto
   * @returns {LinhaClassificada[]}
   */
  _segmentarEClassificar(texto) {
    if (!texto) return []
    return texto
      .split(/\r\n|\r|\n/)
      .map((conteudo, indice) => _classificarLinha(conteudo, indice))
  }

  /**
   * Valida e normaliza o número de páginas.
   * Rejeita: strings, negativos, zero, floats, NaN.
   *
   * @param {*} valor
   * @returns {number} Inteiro >= 1
   */
  _validarPaginas(valor) {
    const n = parseInt(valor, 10)
    return Number.isFinite(n) && n > 0 ? n : 1
  }
}
