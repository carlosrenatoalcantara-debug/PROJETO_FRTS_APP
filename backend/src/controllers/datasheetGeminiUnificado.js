import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import path from 'path'

// S2.6.3 — Cache semântico de datasheets
import {
  computarHashPDF,
  consultarCache,
  salvarCache,
  VERSAO_PARSER_ATUAL,
} from '../services/datasheetCacheService.js'

/**
 * Versão do parser — deve ser idêntica à VERSAO_PARSER_ATUAL no datasheetCacheService.
 * Bump aqui (e no serviço) para invalidar o cache quando o prompt ou a
 * lógica de extração mudar de forma incompatível.
 */
const VERSAO_PARSER = VERSAO_PARSER_ATUAL

/**
 * CONTROLLER UNIFICADO GEMINI VISION API
 *
 * Lê TODOS os tipos de documentos usando Gemini Vision:
 * ✅ Datasheets de Módulos Solares
 * ✅ Datasheets de Inversores
 * ✅ Datasheets de Carregadores EV
 * ✅ Datasheets de Baterias
 * ✅ Parecer de Acesso
 *
 * Benefícios:
 * - Uma única ferramenta, sem conflitos de API
 * - Gemini é gratuito (no tier apropriado)
 * - Otimizado para visão de documentos
 * - Melhor reconhecimento de tabelas e especificações
 */

const client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
// P0-INV-02-CLOSE: candidatos de modelo. Tenta o primeiro; se a credencial não
// tiver acesso ao modelo (404 / not found / not supported / unavailable), faz
// fallback automático ao próximo. gemini-1.5-flash é GA e o mais disponível.
// Erros de credencial (403/PERMISSION) NÃO disparam fallback — propagam para a
// cascata do orchestrator tratar com honestidade.
const MODELOS_GEMINI = ['gemini-2.0-flash', 'gemini-1.5-flash']

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT UNIFICADO - Otimizado para todos os tipos de documentos
// ═══════════════════════════════════════════════════════════════════════════

function montarPromptGemini(tipoDocumento) {
  const promptsSpecificos = {
    // MÓDULOS SOLARES
    modulo: `Você é especialista em painéis fotovoltaicos. Analise este datasheet de módulo solar e extraia TODOS os dados técnicos.

INSTRUÇÕES CRÍTICAS:
1. Leia TODAS as tabelas, gráficos e especificações no documento
2. Se houver múltiplas potências (ex: 450W, 500W, 550W), crie uma entrada para CADA potência
3. Garanta que a garantia de performance (25-30 anos) está no documento - procure em gráficos de degradação linear
4. Para coeficientes de temperatura, use os valores de %/°C (não valores absolutos em V/A)
5. Converta todas as medidas para unidades SI (Watts, Volts, Amps, %, °C, kg, mm)

RETORNE EXATAMENTE ESTE JSON (sem markdown, sem explicação):
{
  "tipo_documento": "modulo_solar",
  "fabricante": "Nome oficial da empresa",
  "modelo": "Código técnico exato (ex: CS6W-550MS, ZXMR-560M)",
  "tipo": "modulo",
  "dimensoes_mm": "LxAxP em mm (ex: 2278x1134x35)",
  "peso_kg": número,
  "numero_celulas": número ou null,
  "tipo_celula": "Tipo exato (ex: Monocristalino N-type, Bifacial)",
  "garantia_produto_anos": número (procure em TODA página, selos, imagens),
  "garantia_performance_anos": número (procure em TODA página e gráficos),
  "coef_temp_pmax_pct_c": número negativo (ex: -0.35),
  "coef_temp_voc_pct_c": número negativo,
  "coef_temp_isc_pct_c": número positivo,
  "variantes": [
    {
      "potencia_w": número,
      "voc_v": número,
      "isc_a": número,
      "vmpp_v": número,
      "impp_a": número,
      "eficiencia_pct": número
    }
  ],
  "notas": "Observações importantes sobre o módulo"
}`,

    // INVERSORES
    inversor: `Você é especialista em inversores solares. Analise este datasheet de inversor e extraia TODAS as especificações.

INSTRUÇÕES CRÍTICAS:
1. Leia TODAS as tabelas de especificações no documento
2. Se houver múltiplos modelos ou fases (1F/3F), crie uma entrada para CADA variante
3. SEMPRE converta potência em W para kW (ex: 5000W = 5.0 kW)
4. Classifique como "string" se > 3kW ou tensão DC > 60V; "microinversor" se ≤ 3kW e ≤ 60V
5. Procure TODAS as proteções e funcionalidades no documento

RETORNE EXATAMENTE ESTE JSON:
{
  "tipo_documento": "inversor_solar",
  "fabricante": "Nome oficial",
  "modelo": "Código exato (ex: SUN2000-5K-SG01LP1, MOD 5000TL3-LV)",
  "tipo": "inversor",
  "subtipo": "string ou microinversor",
  "numero_variantes": número,
  "variantes": [
    {
      "modelo_variante": "Se múltiplos, especificar cada um",
      "potencia_nominal_kw": número,
      "potencia_maxima_kw": número ou null,
      "tensao_ac_nominal_v": "220 ou 380 ou similar",
      "fases_ac": 1 ou 3,
      "frequencia_hz": 50 ou 60,
      "corrente_ac_saida_a": número,
      "fator_potencia": número ou string (ex: >0.99),
      "thdi_pct": número ou string,
      "n_mppts": número,
      "strings_por_mppt": número ou string,
      "tensao_max_entrada_dc_v": número,
      "tensao_mppt_min_v": número,
      "tensao_mppt_max_v": número,
      "corrente_max_entrada_dc_a": número,
      "corrente_isc_max_a": número ou null,
      "eficiencia_maxima_pct": número,
      "eficiencia_europeia_pct": número ou null,
      "protecao_antiilhamento": boolean,
      "protecao_sobretensao_dc": "Tipo II ou similar",
      "grau_protecao_ip": "IP66 ou IP67 ou similar",
      "temperatura_operacao_c": "-40~+65 ou similar",
      "tipo_refrigeracao": "Natural ou Forçada",
      "peso_kg": número,
      "dimensoes_mm": "LxAxP",
      "garantia_anos": número
    }
  ],
  "notas": "Informações importantes"
}`,

    // CARREGADORES EV
    carregador_ev: `Você é especialista em carregadores de veículos elétricos. Analise este datasheet de carregador EV.

INSTRUÇÕES CRÍTICAS:
1. Identifique a marca CORRETAMENTE (ex: Intelbras, não confunda com distribuidor)
2. Procure a potência em kW (AC output power)
3. Procure tensão de entrada (220V ou 380V, monofásica ou trifásica)
4. Procure corrente máxima de saída (A)
5. Procure tipo de conector (Tipo 2, Tesla, CCS, etc)
6. Procure certificações e proteções

RETORNE EXATAMENTE ESTE JSON:
{
  "tipo_documento": "carregador_ev",
  "fabricante": "Nome exato",
  "modelo": "Código exato (ex: EVE 0074C, KS1207A21)",
  "tipo": "carregador_ev",
  "potencia_kw": número,
  "tensao_entrada_v": "220 ou 380",
  "numero_fases_entrada": 1 ou 3,
  "corrente_entrada_maxima_a": número ou null,
  "corrente_saida_maxima_a": número,
  "tipo_conector": "Tipo 2 ou Tesla ou CCS ou similar",
  "tipo_carregamento": "AC Mono ou AC Tri ou DC ou similar",
  "eficiencia_pct": número ou null,
  "ciclo_operacao_horas": "Contínuo ou horário específico",
  "temperatura_operacao_c": "-20~+50 ou similar",
  "grau_protecao_ip": "IP54 ou IP66 ou similar",
  "peso_kg": número ou null,
  "dimensoes_mm": "LxAxP ou null",
  "garantia_anos": número,
  "certificacoes": "CE, IEC, etc",
  "notas": "Características especiais"
}`,

    // BATERIAS
    bateria: `Você é especialista em baterias de armazenamento. Analise este datasheet de bateria.

INSTRUÇÕES CRÍTICAS:
1. Identifique o tipo (LiFePO4, Li-Ion, Chumbo-ácido, etc)
2. Procure capacidade em kWh
3. Procure tensão nominal (V)
4. Procure correntes (I de carga e descarga, A)
5. Procure ciclos de vida útil
6. Procure temperatura de operação

RETORNE EXATAMENTE ESTE JSON:
{
  "tipo_documento": "bateria",
  "fabricante": "Nome exato",
  "modelo": "Código exato",
  "tipo": "bateria",
  "quimica": "LiFePO4 ou Li-Ion ou similar",
  "capacidade_kwh": número,
  "capacidade_nominal_v": número,
  "corrente_maxima_carga_a": número,
  "corrente_maxima_descarga_a": número,
  "profundidade_descarga_pct": número,
  "ciclos_vida_uteis": número,
  "temperatura_operacao_c": "-10~+45 ou similar",
  "sistema_gerenciamento": "BMS type ou similar",
  "peso_kg": número ou null,
  "dimensoes_mm": "LxAxP ou null",
  "garantia_anos": número,
  "notas": "Características especiais"
}`,

    // PARECER DE ACESSO
    parecer_acesso: `Você é especialista em pareceres de acesso à rede. Analise este documento de parecer de acesso.

INSTRUÇÕES CRÍTICAS:
1. Procure número do parecer/protocolo
2. Procure data de emissão
3. Procure potência autorizada (kW ou kWp)
4. Procure tensão de conexão (127V, 220V, 380V)
5. Procure ponto de conexão (alimentador/ramal)
6. Procure condições especiais ou restrições
7. Procure assinatura/validade

RETORNE EXATAMENTE ESTE JSON:
{
  "tipo_documento": "parecer_acesso",
  "numero_parecer": "Número ou protocolo",
  "data_emissao": "DD/MM/YYYY",
  "solicitante": "Nome do requerente",
  "cnpj_cpf": "Número ou null",
  "concessionaria": "Distribuidora de energia",
  "potencia_autorizada_kw": número,
  "tipo_geracao": "Fotovoltaica ou similar",
  "tensao_conexao_v": "127/220 ou 380 ou similar",
  "numero_fases": 1 ou 3,
  "ponto_conexao": "Descrição do ponto",
  "tipo_ligacao": "Monofásica ou Trifásica",
  "condicoes_especiais": "Texto de condições",
  "validade_meses": número ou null,
  "assinatura_digital": boolean,
  "notas": "Observações importantes"
}`,
  }

  return promptsSpecificos[tipoDocumento] || promptsSpecificos.modulo
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL DE EXTRAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extrai dados de um PDF de datasheet usando Gemini Vision.
 *
 * S2.6.3 — Cache semântico transparente:
 *  1. Computa SHA-256 do buffer (< 5 ms para PDFs típicos)
 *  2. Consulta MongoDB: se cache hit → retorna sem chamar Gemini
 *  3. Se cache miss → chama Gemini → salva resultado no cache → retorna
 *
 * Fallback seguro: se o banco estiver indisponível em qualquer etapa,
 * o pipeline continua normalmente chamando o Gemini (degradação graciosa).
 *
 * @param {Buffer} pdfBuffer        Buffer do arquivo PDF
 * @param {string} tipoDocumento    Tipo do documento ('modulo', 'inversor', ...)
 * @param {object} [opcoes={}]      Opções opcionais (não altera lógica principal)
 * @param {string} [opcoes.arquivo_nome]  Nome do arquivo para rastreabilidade
 * @param {boolean} [opcoes.forcarReprocessamento]  Ignora cache mesmo se existir
 */
export async function extrairComGemini(pdfBuffer, tipoDocumento = 'auto', opcoes = {}) {
  const { arquivo_nome = null, forcarReprocessamento = false } = opcoes

  // ── STEP 1: Compute hash SHA-256 ─────────────────────────────────────────
  let hashPdf = null
  try {
    hashPdf = computarHashPDF(pdfBuffer)
  } catch (err) {
    console.warn('[Cache] Falha ao calcular hash (fallback para Gemini):', err.message)
  }

  // ── STEP 2: Consulta de cache ──────────────────────────────────────────────
  if (hashPdf && !forcarReprocessamento) {
    try {
      const cached = await consultarCache(hashPdf, VERSAO_PARSER)
      if (cached) {
        const fab    = cached.fabricante || '?'
        const mod    = cached.modelo     || '?'
        const hits   = cached.total_hits
        console.log(
          `[Cache Hit] hash:${hashPdf.slice(0, 12)} | ${fab} ${mod} | hits:${hits + 1}`
        )
        // AUDITORIA 2025 — ROOT CAUSE FIX:
        // resultado_extraido armazena o envelope COMPLETO:
        //   { sucesso, tipoDocumento, dados: { fabricante, modelo, variantes, ... }, ... }
        // normalizar() e ModalNovoInversor.processarItem() esperam receber o shape
        // com variantes (e outros campos) no TOPO, não aninhados em "dados".
        // Se retornamos o envelope, resultado.variantes = undefined → primeira = {} → specs vazio.
        // Fix: unwrap dados para o topo, preservando metadados de cache como _cache_hit.
        const envelope = cached.resultado_extraido || {}
        const dadosInternos = envelope.dados || {}
        // Se "dados" tem variantes, é o envelope novo; se não, é o shape legado direto no topo
        const baseReturn = Object.keys(dadosInternos).length > 0 ? dadosInternos : envelope
        return {
          ...baseReturn,
          // Preserva metadados do envelope quando útil (tipoDocumento = alias de tipo)
          tipo:         baseReturn.tipo || envelope.tipoDocumento || null,
          tipoDocumento: envelope.tipoDocumento || baseReturn.tipo || null,
          _cache_hit:   true,
          _hash_pdf:    hashPdf,
          _hits:        hits + 1,
        }
      }
      console.log(`[Cache Miss] hash:${hashPdf.slice(0, 12)} — chamando Gemini Vision...`)
    } catch (err) {
      console.warn('[Cache] Falha na consulta (fallback para Gemini):', err.message)
    }
  }

  // ── STEP 3: Chamada real ao Gemini Vision ─────────────────────────────────
  try {
    // Se tipo não for especificado, tentar detectar
    if (tipoDocumento === 'auto') {
      tipoDocumento = detectarTipoDocumento(pdfBuffer)
    }

    console.log(`[Gemini Vision] Processando documento tipo: ${tipoDocumento}`)

    // Preparar a chamada para Gemini
    const base64Data = pdfBuffer.toString('base64')
    const prompt = montarPromptGemini(tipoDocumento)

    const requestBody = {
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Data,
            },
          },
        ],
      }],
    }

    // P0-INV-02-CLOSE: tenta cada modelo candidato; fallback só em erro de MODELO.
    let response = null
    let modeloUsado = null
    let ultimoErroModelo = null
    for (const nomeModelo of MODELOS_GEMINI) {
      try {
        const m = client.getGenerativeModel({ model: nomeModelo })
        response = await m.generateContent(requestBody)
        modeloUsado = nomeModelo
        break
      } catch (e) {
        ultimoErroModelo = e
        const msg = String(e?.message || '')
        if (/not found|not supported|404|does not exist|unavailable/i.test(msg)) {
          console.warn(`[Gemini] modelo ${nomeModelo} indisponível — tentando próximo: ${msg}`)
          continue
        }
        throw e // credencial/quota/outro → propaga (vira sucesso:false na cascata)
      }
    }
    if (!response) throw (ultimoErroModelo || new Error('Nenhum modelo Gemini disponível'))
    console.log('[Gemini] modelo usado:', modeloUsado)

    // Extrair texto da resposta
    const responseText = response.response.text()
    console.log('[Gemini] Resposta recebida, tamanho:', responseText.length)

    // Limpar markdown e parse JSON
    const jsonLimpo = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const dados = JSON.parse(jsonLimpo)
    console.log('[Parse] JSON extraído com sucesso')

    const resultado = {
      sucesso: true,
      tipoDocumento,
      dados,
      fonte: 'gemini-vision',
      timestamp: new Date().toISOString(),
    }

    // ── STEP 4: Persiste no cache ─────────────────────────────────────────────
    if (hashPdf) {
      salvarCache(hashPdf, resultado, {
        arquivo_nome,
        versao_parser: VERSAO_PARSER,
      })
        .then(() => console.log(`[Cache Salvo] hash:${hashPdf.slice(0, 12)} | ${dados.fabricante || '?'} ${dados.modelo || '?'}`))
        .catch(err => console.warn('[Cache] Falha ao salvar (não bloqueante):', err.message))
    }

    return resultado
  } catch (erro) {
    console.error('[Gemini Error]', erro.message)
    return {
      sucesso: false,
      erro: erro.message,
      fonte: 'gemini-vision',
      timestamp: new Date().toISOString(),
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DETECÇÃO AUTOMÁTICA DE TIPO
// ═══════════════════════════════════════════════════════════════════════════

function detectarTipoDocumento(pdfBuffer) {
  // Tentar extrair alguns bytes iniciais para análise rápida
  const preambulo = pdfBuffer.toString('utf-8', 0, 10000).toLowerCase()

  // Padrões de detecção
  if (/carregador|ev|charging|evcharger|kw.*220|380.*kw|intelbras|solplanet|belenergy|emobi|wallbox/i.test(preambulo)) {
    return 'carregador_ev'
  }
  if (/inversor|inverter|string|mppt|voc.*isc|fronius|growatt|sungrow|deye|goodwe/i.test(preambulo)) {
    return 'inversor'
  }
  if (/módulo|painel|solar|module|pv|eficiência.*%|temperatura.*coef/i.test(preambulo)) {
    return 'modulo'
  }
  if (/bateria|battery|kwh|lifepo|armazenamento|energy storage/i.test(preambulo)) {
    return 'bateria'
  }
  if (/parecer|acesso|rede|concessionaire|distribuidora|potência.*kw|autorização/i.test(preambulo)) {
    return 'parecer_acesso'
  }

  // Default para módulo (tipo mais comum)
  return 'modulo'
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export async function testarGeminiComAmostra(caminhoAmostra) {
  console.log(`\n[Teste] Carregando amostra: ${caminhoAmostra}`)

  if (!fs.existsSync(caminhoAmostra)) {
    return { erro: `Arquivo não encontrado: ${caminhoAmostra}` }
  }

  const buffer = fs.readFileSync(caminhoAmostra)
  console.log(`[Teste] Buffer carregado: ${buffer.length} bytes`)

  const resultado = await extrairComGemini(buffer, 'auto')

  console.log(`[Teste] Resultado:`, JSON.stringify(resultado, null, 2))

  return resultado
}

export async function testarTodosOsSamples() {
  const dirSamples = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '../../pdfs_teste'
  )

  if (!fs.existsSync(dirSamples)) {
    return { erro: `Diretório de samples não encontrado: ${dirSamples}` }
  }

  const arquivos = fs.readdirSync(dirSamples).filter(f => f.endsWith('.pdf'))
  const resultados = []

  for (const arquivo of arquivos) {
    console.log(`\n${'═'.repeat(80)}`)
    console.log(`Processando: ${arquivo}`)
    console.log('═'.repeat(80))

    const resultado = await testarGeminiComAmostra(path.join(dirSamples, arquivo))
    resultados.push({ arquivo, resultado })

    // Pequeno delay para não sobrecarregar a API
    await new Promise(r => setTimeout(r, 1000))
  }

  return resultados
}
