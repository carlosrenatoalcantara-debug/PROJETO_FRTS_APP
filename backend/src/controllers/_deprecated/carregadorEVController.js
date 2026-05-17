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
  return `ESPECIALISTA EM DATASHEETS DE CARREGADORES EV

Você é engenheiro especializado em analisar datasheets de carregadores de veículos elétricos.
Analise o documento PDF fornecido e extraia TODOS os dados técnicos disponíveis.

RETORNE APENAS UM JSON VÁLIDO E COMPLETO. Sem markdown, sem blocos de código, sem explicações.

JSON ESPERADO (CAMPOS OBRIGATÓRIOS = ★):
{
  "marca": "★ string - Nome do fabricante (ex: Intelbras, Solplanet, Belenergy, Evowatt, ABB, Wallbox)",
  "modelo": "★ string - Código/designação do modelo (ex: EVE 0074C, SOL7.4H, KS1207A21, IEC-TRIFASICO)",
  "tipo": "★ string - Um de: AC_Mono | AC_Tri | DC",
  "potencia_kw": "★ number - Potência nominal em kW (MAIOR potência se houver variantes)",
  "tensao_entrada_v": "number - Tensão entrada nominal em volts (ex: 220, 380, 120)",
  "corrente_entrada_a": "number - Corrente entrada em amperes",
  "numero_fases": "number - 1 (monofásico) ou 3 (trifásico)",
  "frequencia_hz": "number - 50 ou 60 Hz",
  "tensao_saida_dc_v": "number ou null - Saída DC em volts (apenas carregadores DC)",
  "corrente_saida_dc_a": "number ou null - Saída DC em amperes (apenas carregadores DC)",
  "protocolo_carregamento": "string - IEC 61851, GB/T 20234, CHAdeMO, CCS, etc.",
  "tipo_carregamento": "string - Type 1, Type 2, CCS Combo, CHAdeMO, etc.",
  "conector": "string - Tipo de conector (Type 2, Type Chinês, CCS2, CHAdeMO)",
  "comprimento_cabo_m": "number ou null - Comprimento do cabo integrado em metros",
  "ip_rating": "string - IP55, IP65, IP66, IP67, etc",
  "temperatura_operacao_min": "number - Temperatura mínima em °C (ex: -30)",
  "temperatura_operacao_max": "number - Temperatura máxima em °C (ex: 50)",
  "eficiencia_pct": "number ou null - Eficiência em % se informada",
  "fator_potencia": "number ou null - Fator de potência (0.95-0.99)",
  "peso_kg": "number ou null - Peso em quilogramas",
  "dimensoes_mm": "string ou null - Dimensões no formato LxAxP (ex: 222x405x104)",
  "comunicacao": "array - Interfaces de comunicação: WiFi, OCPP, RFID, Bluetooth, 4G, Ethernet, Modbus, etc",
  "ocpp_version": "string ou null - Versão OCPP (1.6, 1.6J, 2.0, etc)",
  "disjuntor_recomendado_a": "number ou null - Amperagem do disjuntor recomendado",
  "dr_recomendado_ma": "number - Sensibilidade do DR recomendado (típico 30 mA)",
  "bitola_cabo_minima_mm2": "number ou null - Bitola mínima de cabo em mm²",
  "garantia_anos": "number - Período de garantia em anos (padrão 2 se não encontrado)",
  "certificacao": "array - Certificações: CE, ANATEL, TUV, IEC, RoHS, etc",
  "condicoes_ambientes": "string ou null - Temperatura, umidade, altitude de operação"
}

INSTRUÇÕES CRÍTICAS:
1. MARCA: Procure no topo, cabeçalho ou capa do datasheet
2. MODELO: Código exato do produto (ler cuidadosamente, EVE vs EVA vs outro)
3. TIPO: Determinar de "entrada elétrica" → F+N+T (monofásico) | 3F+N+T (trifásico) | "DC output" (DC)
4. POTÊNCIA: Se múltiplas (ex: 7kW em 220V, 10.5kW em 380V) → use a MAIOR
5. CAMPOS NULL: Se não encontrado, use null (NUNCA omitir chaves)
6. COMUNICAÇÃO: Array vazio [] se nenhuma. Procure seções "Comunicação", "Conectividade", "Protocolos"
7. TEMPERATURA: Procure ranges tipo "-30°C a +50°C" ou em "Condições Ambientes"
8. GARANTIA: Padrão 2 anos se não informado
9. Se há múltiplas variantes na mesma página → extrai dados do modelo PRINCIPAL destacado

SEÇÕES PARA CONSULTAR:
✓ Capa / Title page
✓ Especificações Técnicas / Technical Specifications
✓ Dados de Entrada / Input Data
✓ Dados de Saída / Output Data
✓ Características Ambientais / Environmental
✓ Comunicação / Communication
✓ Proteções / Protections
✓ Garantia / Warranty
✓ Certificações / Certifications
✓ Tabelas técnicas / Technical tables

VALIDE ANTES DE RETORNAR:
- marca e modelo preenchidos (NOT "Desconhecido" ou "Sem modelo")
- tipo é um de: AC_Mono, AC_Tri, DC
- potencia_kw é um número > 0
- Sem explicações, sem markdown, APENAS JSON válido

Comece a análise agora:`
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

  // ✓ VALIDAÇÕES CRÍTICAS APENAS
  // Marca e modelo são OBRIGATÓRIOS para identificar o equipamento
  if (!dados.marca || dados.marca === 'Desconhecido') {
    avisos.push('⚠ Marca não identificada no PDF')
  }

  if (!dados.modelo || dados.modelo === 'Sem modelo') {
    avisos.push('⚠ Modelo não identificado no PDF')
  }

  // Potência é OBRIGATÓRIA
  if (!dados.potencia_kw || dados.potencia_kw <= 0) {
    avisos.push('⚠ Potência inválida ou não encontrada')
  }

  // Tipo deve ser válido
  if (!['AC_Mono', 'AC_Tri', 'DC'].includes(dados.tipo)) {
    avisos.push(`⚠ Tipo inválido: ${dados.tipo}`)
  }

  // ✗ NÃO AVISAR SOBRE CAMPOS OPCIONAIS
  // Tensão, corrente, garantia, etc. são opcionais - datasheet pode não ter
  // Aviso apenas se DC sem saída DC especificada
  if (dados.tipo === 'DC' && !dados.tensao_saida_dc_v) {
    avisos.push('⚠ Carregador DC: tensão de saída não encontrada')
  }

  // Dados essenciais para salvar
  const temDadosEssenciais = !!(
    dados.marca &&
    dados.marca !== 'Desconhecido' &&
    dados.modelo &&
    dados.modelo !== 'Sem modelo' &&
    dados.potencia_kw &&
    dados.potencia_kw > 0
  )

  return {
    valido: temDadosEssenciais,
    avisos: avisos.length > 0 ? avisos : [], // Array vazio se nenhum aviso
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
