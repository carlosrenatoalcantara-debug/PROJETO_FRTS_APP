import Anthropic from '@anthropic-ai/sdk'

// ─────────────────────────────────────────────────────────────────────────────
// EXTRAÇÃO DE DATASHEETS EV COM CLAUDE VISION
// Especializado em carregadores elétricos veiculares (AC Mono, AC Tri, DC)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prompt otimizado para extrair dados de datasheets EV
 * Reconhece: Intelbras, Solplanet, Belenergy, Evowatt, ABB, Siemens, Wallbox, etc.
 */
function montarPromptExtracao() {
  return `Você é especialista em carregadores de veículos elétricos. Analise este datasheet EV e retorne SOMENTE um JSON válido, sem markdown, sem explicação adicional.

ESTRUTURA ESPERADA DO JSON:
{
  "marca": "string (Intelbras, Solplanet, Belenergy, Evowatt, ABB, Siemens, Wallbox, etc.)",
  "modelo": "string (código do modelo, ex: EVE 0074C, SOL7.4H, KS1207A21)",
  "tipo": "AC_Mono|AC_Tri|DC",
  "potencia_kw": number (potência nominal em kW),
  "tensao_entrada_v": number (tensão de entrada nominal em V),
  "corrente_entrada_a": number (corrente nominal de entrada em A),
  "numero_fases": number (1 para monofásico, 3 para trifásico),
  "frequencia_hz": number (50 ou 60),
  "tensao_saida_dc_v": number (só para DC, tensão de saída DC em V ou null),
  "corrente_saida_dc_a": number (só para DC, corrente de saída DC em A ou null),
  "conector": "Tipo 2|Tipo Chinês|CCS2|CHAdeMO",
  "comprimento_cabo_m": number (comprimento do cabo integrado em metros),
  "ip_rating": "IP55|IP65|IP66|IP67",
  "temperatura_operacao_min": number (mínima em °C),
  "temperatura_operacao_max": number (máxima em °C),
  "eficiencia_pct": number (eficiência em %, se disponível),
  "fator_potencia": number (fator de potência, típico 0.95-0.99),
  "peso_kg": number (peso do equipamento em kg, se disponível),
  "dimensoes_mm": "string (formato LxAxP em mm, ex: 222x405x104)",
  "protocolo_carregamento": "IEC 61851|GB/T 20234|outro",
  "tipo_carregamento": "Type 2|CCS|CHAdeMO|Type 2 Combo",
  "comunicacao": ["WiFi", "OCPP", "RFID", "Bluetooth", "4G", "Ethernet"] (array de strings, remova os não presentes),
  "ocpp_version": "1.6|1.6J|2.0",
  "rcd_tipo": "Tipo A|Tipo A integrado|outro",
  "rcd_sensibilidade_ma": number (sensibilidade do RCD em mA, típico 30 ou 6),
  "disjuntor_recomendado_a": number (amperagem do disjuntor recomendado),
  "dr_recomendado_ma": number (sensibilidade do DR recomendado),
  "bitola_cabo_minima_mm2": number (bitola mínima de cabo recomendada em mm²),
  "garantia_anos": number (período de garantia em anos),
  "certificacao": ["CE", "ANATEL", "TUV", "IEC"] (array),
  "padroes_certificacao": "string (ex: IEC 61851-1: 2017, IEC 61851-21-2: 2018)"
}

REGRAS CRÍTICAS:
1. TIPO: Inferir de "Conexão elétrica" → F+N+T ou 2F+T = AC_Mono, 3F+N+T = AC_Tri, DC output = DC
2. Se múltiplas potências (ex: 7.0 kW em 220V vs 10.5 kW em 380V), use a MAIOR
3. Se campo não encontrado no datasheet, use null (NÃO omitir chaves)
4. POTÊNCIA: sempre em kW (converter de W se necessário)
5. COMUNICAÇÃO: procure por seções "Comunicação", "Conectividade", "Interface"
6. GARANTIA: procure por "Warranty", "Garantia" em tabelas e seções de ambiente
7. TEMPERATURA: procure por ranges como "-30°C até +50°C"
8. DIMENSÕES: formato LxAxP em milímetros (ex: 325x181x87)
9. Se há variantes do mesmo modelo em uma página, crie um objeto único com dados do modelo PRINCIPAL

PROCURE NAS SEGUINTES SEÇÕES DO PDF:
- "Especificações técnicas" / "Technical Specifications"
- "Entrada CA" / "AC Input"
- "Saída CA" / "AC Output"
- "Interface do usuário" / "User Interface"
- "Comunicação" / "Communication"
- "Proteções elétricas" / "Electrical Protections"
- "Ambiente" / "Environment"
- "Garantia" / "Warranty"
- "Certificação" / "Certification"

RETORNE APENAS O JSON VÁLIDO, sem explicações, sem markdown.`
}

/**
 * Extrai dados de datasheet EV usando Claude Vision
 * @param {Buffer} pdfBuffer - Arquivo PDF convertido para buffer
 * @returns {Promise<Object>} Dados extraídos do datasheet
 */
export async function extrairDatasheetEV(pdfBuffer) {
  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBuffer.toString('base64'),
              },
            },
            {
              type: 'text',
              text: montarPromptExtracao(),
            },
          ],
        },
      ],
    })

    // Limpar resposta
    const textoResposta = message.content[0].text.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const dadosExtraidos = JSON.parse(textoResposta)
    return dadosExtraidos

  } catch (error) {
    console.error('Erro ao extrair datasheet EV:', error.message)
    throw new Error(`Falha na extração: ${error.message}`)
  }
}

/**
 * Normaliza dados extraídos para o schema CarregadorEV
 * @param {Object} dados - Dados brutos extraídos
 * @returns {Object} Dados normalizados
 */
export function normalizarDadosEV(dados) {
  // Validar potência contra enum válido
  const potenciasValidas = [3.6, 7.4, 11, 22, 30, 40, 60, 80, 90, 120, 150, 180]

  let potenciaFinal = dados.potencia_kw
  if (!potenciasValidas.includes(potenciaFinal)) {
    // Encontrar a mais próxima
    potenciaFinal = potenciasValidas.reduce((prev, curr) =>
      Math.abs(curr - dados.potencia_kw) < Math.abs(prev - dados.potencia_kw)
        ? curr
        : prev
    )
  }

  // Inferir tipo se não definido
  let tipoFinal = dados.tipo
  if (!['AC_Mono', 'AC_Tri', 'DC'].includes(tipoFinal)) {
    if (dados.numero_fases === 3) tipoFinal = 'AC_Tri'
    else if (dados.numero_fases === 1) tipoFinal = 'AC_Mono'
    else if (dados.tensao_saida_dc_v) tipoFinal = 'DC'
    else tipoFinal = 'AC_Mono' // default
  }

  // Montar objeto normalizado
  return {
    tipo: tipoFinal,
    potencia_kw: potenciaFinal,
    marca: dados.marca || 'Desconhecido',
    modelo: dados.modelo || 'Sem modelo',
    tensao_entrada_v: dados.tensao_entrada_v || null,
    corrente_entrada_a: dados.corrente_entrada_a || null,
    numero_fases: dados.numero_fases || (tipoFinal === 'AC_Tri' ? 3 : 1),
    frequencia_hz: dados.frequencia_hz || 60,
    tensao_saida_dc_v: dados.tensao_saida_dc_v || null,
    corrente_saida_dc_a: dados.corrente_saida_dc_a || null,
    eficiencia_pct: dados.eficiencia_pct || null,
    fator_potencia: dados.fator_potencia || null,
    grau_protecao_ip: dados.ip_rating || 'IP65',
    temperatura_operacao: `${dados.temperatura_operacao_min || -30}°C até ${dados.temperatura_operacao_max || 50}°C`,
    peso_kg: dados.peso_kg || null,
    dimensoes_mm: dados.dimensoes_mm || null,
    protocolo_carregamento: dados.protocolo_carregamento || 'IEC 61851',
    tipo_carregamento: dados.tipo_carregamento || 'Type 2',
    tipo_conector: dados.conector || 'Type 2',
    comunicacao: Array.isArray(dados.comunicacao)
      ? dados.comunicacao.join(',')
      : dados.comunicacao || '',
    disjuntor_recomendado_a: dados.disjuntor_recomendado_a || null,
    dr_recomendado_ma: dados.dr_recomendado_ma || 30,
    bitola_cabo_minima_mm2: dados.bitola_cabo_minima_mm2 || null,
    garantia_anos: dados.garantia_anos || 2,
    ativo: true,
  }
}

/**
 * Valida dados antes de salvar
 * @param {Object} dados - Dados a validar
 * @returns {Object} { valido: boolean, avisos: string[] }
 */
export function validarDadosEV(dados) {
  const avisos = []

  // Validações críticas
  if (!dados.marca || dados.marca === 'Desconhecido') {
    avisos.push('Marca não identificada - verifique o PDF')
  }

  if (!dados.modelo || dados.modelo === 'Sem modelo') {
    avisos.push('Modelo não identificado - verifique o PDF')
  }

  // Validações recomendadas
  if (!dados.tensao_entrada_v) {
    avisos.push('Tensão de entrada não encontrada')
  }

  if (!dados.corrente_entrada_a) {
    avisos.push('Corrente de entrada não encontrada')
  }

  if (!dados.garantia_anos) {
    avisos.push('Garantia não especificada')
  }

  // Validações específicas por tipo
  if (dados.tipo === 'DC' && !dados.tensao_saida_dc_v) {
    avisos.push('Carregador DC sem tensão de saída especificada')
  }

  // Dados completamente vazios
  const temDadosEssenciais = !!(
    dados.marca &&
    dados.modelo &&
    dados.potencia_kw &&
    (dados.tensao_entrada_v || dados.corrente_entrada_a)
  )

  return {
    valido: temDadosEssenciais,
    avisos,
  }
}

/**
 * Pipeline completo: extrai → normaliza → valida
 * @param {Buffer} pdfBuffer - Arquivo PDF
 * @returns {Promise<Object>} { sucesso, carregador, avisos, erro }
 */
export async function processarDatasheetEV(pdfBuffer) {
  try {
    // Etapa 1: Extração
    console.log('[EV] Iniciando extração com Claude Vision...')
    const dadosExtraidos = await extrairDatasheetEV(pdfBuffer)
    console.log('[EV] Extração concluída:', dadosExtraidos.marca, dadosExtraidos.modelo)

    // Etapa 2: Normalização
    const dadosNormalizados = normalizarDadosEV(dadosExtraidos)
    console.log('[EV] Normalização concluída')

    // Etapa 3: Validação
    const validacao = validarDadosEV(dadosNormalizados)
    console.log('[EV] Validação:', validacao.valido ? 'OK' : 'Com avisos')

    return {
      sucesso: validacao.valido,
      carregador: dadosNormalizados,
      avisos: validacao.avisos,
      erro: null,
    }

  } catch (error) {
    console.error('[EV] Erro no processamento:', error.message)
    return {
      sucesso: false,
      carregador: null,
      avisos: ['Falha ao processar datasheet - use Cadastro Manual'],
      erro: error.message,
    }
  }
}
