import { PDFParse } from 'pdf-parse'
import { obterIrradianciaCity, obterIrradianciaFallback } from '../data/irradianciaRN.js'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ─── Gemini Vision para imagens de fatura ────────────────────────────────────
// Chave pode vir do env (Railway) ou do header X-Gemini-Key (enviado pelo frontend via localStorage)
const GEMINI_API_KEY_ENV = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY

const PROMPT_FATURA = `Você é especialista em faturas de energia elétrica brasileiras.
Analise esta imagem de conta de energia e extraia os dados do cliente.

Distribuidoras comuns: COSERN (RN), COELBA (BA), CELPE (PE), COELCE (CE), CEMIG (MG), COPEL (PR), ENEL, ENERGISA, EQUATORIAL, ELEKTRO, LIGHT, EDP, NEOENERGIA.

RETORNE APENAS JSON válido, sem markdown, sem explicação. Use null para campos não encontrados:
{
  "nome": "nome completo do cliente",
  "cpfCnpj": "CPF ou CNPJ do cliente (não da distribuidora)",
  "telefone": "telefone do cliente no formato (XX) 9XXXX-XXXX",
  "numeroCliente": "código/número do cliente",
  "codigoInstalacao": "código da instalação ou UC",
  "endereco": "endereço completo do cliente",
  "cep": "CEP formato 00000-000",
  "cidade": "cidade",
  "estado": "sigla UF 2 letras",
  "distribuidora": "nome curto da distribuidora (ex: COSERN, COELBA)",
  "classificacao": "código tarifário exato (B1, B2, B3, A1, A2, A3, A3a, A4, AS)",
  "subgrupo": "Residencial / Comercial / Industrial / Rural / Poder Público",
  "grupoTarifario": "B (baixa tensão até 2,3kV) ou A (alta/média tensão acima)",
  "tipoLigacao": "Monofásico / Bifásico / Trifásico",
  "tensaoV": número da tensão de fornecimento em volts (ex: 127, 220, 380),
  "demandaContratadaKw": número da demanda contratada em kW (só para grupo A, null para B),
  "consumoKwh": número do consumo mensal atual em kWh,
  "historico12meses": [
    {"mes": "JAN/26", "consumo": 450},
    {"mes": "FEV/26", "consumo": 480}
  ],
  "valorR": valor total da fatura em reais como número,
  "valorKwh": tarifa em R$/kWh como número decimal (ex: 0.987)
}`

async function extrairComGeminiVision(buffer, mimeType, apiKeyFromHeader) {
  const GEMINI_API_KEY = apiKeyFromHeader || GEMINI_API_KEY_ENV
  if (!GEMINI_API_KEY) {
    throw new Error('Chave Gemini não configurada. Acesse Configurações > Integrações e adicione a chave GeminiVision.')
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const imagePart = {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType,
    },
  }

  const result = await model.generateContent([PROMPT_FATURA, imagePart])
  const text = result.response.text().trim()

  // Remove markdown se presente
  const jsonStr = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  return JSON.parse(jsonStr)
}

// Endpoint de debug: retorna o texto bruto do PDF linha por linha
export async function debugFatura(req, res) {
  try {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' })
    const parser = new PDFParse({ data: req.file.buffer })
    const textResult = await parser.getText()
    await parser.destroy()
    const linhas = (textResult.text || '').split('\n').map((l, i) => ({ linha: i + 1, texto: l }))
    res.json({ totalLinhas: linhas.length, linhas })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
}

export async function extrairDadosFatura(req, res) {
  try {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' })

    const mimeType = req.file.mimetype || ''
    const isImagem = mimeType.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(req.file.originalname || '')

    console.log(`📄 Processando fatura: ${req.file.originalname} (${mimeType})`)

    // ── Imagem → Gemini Vision ────────────────────────────────────────────────
    if (isImagem) {
      console.log('🖼️ Usando Gemini Vision para imagem...')
      try {
        const imgMime = mimeType.startsWith('image/') ? mimeType : 'image/jpeg'
        const apiKeyFromHeader = req.headers['x-gemini-key'] || null
        const dadosGemini = await extrairComGeminiVision(req.file.buffer, imgMime, apiKeyFromHeader)

        // Complementar com dados calculados a partir do que Gemini extraiu
        const { fase, tensao } = extrairFaseETensao(dadosGemini.tipoLigacao)
        // Se Gemini retornou grupoTarifario explícito, usa; senão deriva da classificação
        const grupoTarifario = dadosGemini.grupoTarifario || mapeiaGrupoTarifario(dadosGemini.classificacao)
        const cidade = dadosGemini.cidade || null
        const estado = dadosGemini.estado || null
        const irradiancia = (cidade && estado)
          ? (obterIrradianciaCity(cidade, estado) || obterIrradianciaFallback(estado))
          : (estado ? obterIrradianciaFallback(estado) : null)

        // Calcular média anual a partir do histórico (se Gemini extraiu)
        const historico = Array.isArray(dadosGemini.historico12meses)
          ? dadosGemini.historico12meses.filter(h => h && typeof h.consumo === 'number' && h.consumo > 0)
          : []
        const mediaAnual = historico.length > 0
          ? Math.round(historico.reduce((s, h) => s + h.consumo, 0) / historico.length)
          : (dadosGemini.consumoKwh || null)

        console.log('✓ Gemini extraiu:', {
          nome: dadosGemini.nome,
          distribuidora: dadosGemini.distribuidora,
          consumo: dadosGemini.consumoKwh,
          historico: historico.length,
        })

        return res.json({
          ...dadosGemini,
          // Campos derivados / enriquecidos
          grupoTarifario,
          fase,
          tensao: dadosGemini.tensaoV || tensao,  // prefere extração direta da fatura
          irradiancia,
          mediaAnual,
          historico12Meses: historico.length > 0 ? historico : null,
          periodoMeses: historico.length || null,
          valorR: dadosGemini.valorR || null,
          // Metadados da extração
          _metodo: 'gemini_vision',
          _extraidoEm: new Date().toISOString(),
        })
      } catch (geminiErr) {
        console.warn('⚠️ Gemini Vision falhou:', geminiErr.message)
        return res.status(422).json({
          erro: geminiErr.message.includes('GOOGLE_API_KEY')
            ? geminiErr.message
            : 'Não foi possível extrair dados da imagem. Tente um PDF ou preencha manualmente.',
        })
      }
    }

    // ── PDF → PDFParse (lógica original) ────────────────────────────────────
    let textoOriginal = ''
    try {
      const parser = new PDFParse({ data: req.file.buffer })
      const textResult = await parser.getText()
      textoOriginal = textResult.text || ''
      await parser.destroy()
    } catch (pdfErr) {
      console.warn('⚠️ PDF parse falhou:', pdfErr.message)
      return res.json(templateVazio('Não foi possível extrair dados do PDF.'))
    }

    const linhas = textoOriginal.split('\n').map(l => l.trim())
    const texto = textoOriginal.toLowerCase()
    const distribuidora = extrairDistribuidora(textoOriginal)
    const historico = extrairHistorico12Meses(linhas)
    const classificacao = extrairClassificacao(linhas, textoOriginal)
    const tipoLigacao = extrairTipoLigacao(linhas, textoOriginal, distribuidora)
    const cidade = extrairCidade(linhas)
    const estado = extrairEstado(linhas)

    // Calcula dados para auto-preenchimento
    const { fase, tensao } = extrairFaseETensao(tipoLigacao)
    const grupoTarifario = mapeiaGrupoTarifario(classificacao)
    const irradiancia = obterIrradianciaCity(cidade, estado) || obterIrradianciaFallback(estado)

    const dados = {
      nome:            extrairNomeCliente(linhas),
      cpfCnpj:         extrairCpfCnpj(linhas, textoOriginal),
      numeroCliente:   extrairNumeroCliente(linhas),
      codigoInstalacao:extrairCodigoInstalacao(linhas),
      endereco:        extrairEnderecoCliente(linhas),
      cep:             extrairCep(linhas),
      cidade,
      estado,
      distribuidora,
      classificacao,
      subgrupo:        extrairSubgrupo(linhas, textoOriginal),
      tipoLigacao,
      consumoKwh:      historico?.mediaAnual || extrairConsumo(texto),
      mediaAnual:      historico?.mediaAnual || null,
      historico12Meses:historico?.historico || null,
      periodoMeses:    historico?.periodoMeses || null,
      valorR:          extrairValor(linhas, texto),
      valorKwh:        extrairValorKwh(linhas),
      // Dados auto-preenchimento etapa 2
      grupoTarifario,
      fase,
      tensao,
      irradiancia,
    }

    console.log('✓ Extraído:', {
      nome: dados.nome, distribuidora: dados.distribuidora,
      classificacao: dados.classificacao, tipoLigacao: dados.tipoLigacao,
      consumo: dados.consumoKwh, valorKwh: dados.valorKwh,
      cep: dados.cep, cidade: dados.cidade,
      grupoTarifario: dados.grupoTarifario,
      fase: dados.fase, tensao: dados.tensao,
      irradiancia: dados.irradiancia,
    })

    res.json(dados)
  } catch (err) {
    console.error('❌ Erro:', err.message)
    res.status(500).json({ erro: 'Erro ao processar PDF' })
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Retorna o índice da linha que contém o padrão, ou -1
function findLine(linhas, padrao) {
  return linhas.findIndex(l => padrao.test(l))
}

// Retorna o conteúdo da próxima linha não vazia após o índice
function nextLine(linhas, idx) {
  for (let i = idx + 1; i < linhas.length; i++) {
    if (linhas[i].trim()) return linhas[i].trim()
  }
  return null
}

// ─── DADOS DO CLIENTE ────────────────────────────────────────────────────────

function extrairNomeCliente(linhas) {
  // Padrão COSERN e similares: rótulo "NOME DO CLIENTE:" na linha N, nome na linha N+1
  const idx = findLine(linhas, /^NOME\s*DO\s*CLIENTE\s*:?\s*$/i)
  if (idx >= 0) {
    const nome = nextLine(linhas, idx)
    if (nome && nome.length > 3 && !/^CPF|^CNPJ|^END/i.test(nome)) return nome
  }

  // Rótulo e nome na mesma linha: "NOME DO CLIENTE: João Silva"
  for (const linha of linhas) {
    const m = linha.match(/NOME\s*DO\s*CLIENTE\s*:\s*(.{4,})/i)
    if (m) return m[1].trim()
  }

  return null
}

function extrairCpfCnpj(linhas, textoOriginal) {
  // CPF parcialmente mascarado: 000.0**.***-** ou completo
  for (const linha of linhas) {
    const m = linha.match(/CPF\s*:?\s*([\d.*]{3}\.[\d.*]{3}\.[\d.*]{3}-[\d.*]{2})/i)
    if (m) return m[1]
  }
  // CPF completo no texto
  const cpfs = [...textoOriginal.matchAll(/\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/g)]
  if (cpfs.length > 0) return cpfs[cpfs.length - 1][1]
  // CNPJ - segundo da lista (primeiro é da distribuidora)
  const cnpjs = [...textoOriginal.matchAll(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/g)]
  if (cnpjs.length > 1) return cnpjs[1][1]
  if (cnpjs.length === 1) return cnpjs[0][1]
  return null
}

function extrairNumeroCliente(linhas) {
  // Padrão COSERN: rótulo "CÓDIGO DO CLIENTE" na linha N, número na N+1
  const idx = findLine(linhas, /^C[ÓO]DIGO\s*DO\s*CLIENTE\s*$/i)
  if (idx >= 0) {
    const val = nextLine(linhas, idx)
    if (val && /^\d+$/.test(val.trim())) return val.trim()
  }
  // Na mesma linha ou variações
  for (const linha of linhas) {
    const m = linha.match(/(?:C[ÓO]DIGO|N[ºO°]?\.?)\s*DO\s*CLIENTE[\s:]+(\d{5,15})/i)
    if (m) return m[1]
  }
  return null
}

function extrairCodigoInstalacao(linhas) {
  // "CÓDIGO DA INSTALAÇÃO" → próxima linha
  const idx = findLine(linhas, /^C[ÓO]DIGO\s*DA\s*INSTALA[ÇC][ÃA]O\s*$/i)
  if (idx >= 0) {
    const val = nextLine(linhas, idx)
    if (val && /^\d+$/.test(val.trim())) return val.trim()
  }
  for (const linha of linhas) {
    const m = linha.match(/INSTALA[ÇC][ÃA]O[\s:]+(\d{5,15})/i)
    if (m) return m[1]
  }
  return null
}

// ─── ENDEREÇO ────────────────────────────────────────────────────────────────

function extrairEnderecoCliente(linhas) {
  // Padrão COSERN: rótulo "ENDEREÇO:" na linha N, endereço na N+1
  const idx = findLine(linhas, /^ENDERE[ÇC]O\s*:?\s*$/i)
  if (idx >= 0) {
    const end = nextLine(linhas, idx)
    if (end && end.length > 5) return end
  }
  // "ENDEREÇO: Rua..."
  for (const linha of linhas) {
    const m = linha.match(/^ENDERE[ÇC]O\s*:\s*(.{5,})/i)
    if (m) return m[1].trim()
  }
  return null
}

function extrairCep(linhas) {
  // Formato "59091-130 NATAL RN" ou "CEP 59091-130"
  for (const linha of linhas) {
    const m = linha.match(/\b(\d{5}-\d{3})\b/)
    if (m) {
      // Ignorar o CEP da distribuidora (Rua Mermoz CEP 59025-250)
      if (linha.toUpperCase().includes('MERMOZ') || linha.toUpperCase().includes('BALDO')) continue
      return m[1]
    }
  }
  return null
}

function extrairCidade(linhas) {
  // Formato "59091-130 NATAL RN"
  for (const linha of linhas) {
    const m = linha.match(/\d{5}-\d{3}\s+([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ][A-ZÁÉÍÓÚÀÂÊÔÃÕÇa-záéíóúàâêôãõç\s]+)\s+([A-Z]{2})$/)
    if (m) {
      if (linha.toUpperCase().includes('MERMOZ') || linha.toUpperCase().includes('BALDO')) continue
      return m[1].trim()
    }
  }
  return null
}

function extrairEstado(linhas) {
  const ufs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
  for (const linha of linhas) {
    if (linha.toUpperCase().includes('MERMOZ')) continue
    const m = linha.match(/\b([A-Z]{2})$/)
    if (m && ufs.includes(m[1])) return m[1]
  }
  return null
}

// ─── CLASSIFICAÇÃO E TIPO ─────────────────────────────────────────────────────

function extrairClassificacao(linhas, textoOriginal) {
  // COSERN: "CLASSIFICAÇÃO: B1 RESIDENCIAL -RESIDENCIAL TIPO DE FORNECIMENTO: ..."
  for (const linha of linhas) {
    const m = linha.match(/CLASSIFICA[ÇC][ÃA]O\s*:\s*(B[1-4]|A[1-4]|A3[Aa]?|AS)\b/i)
    if (m) return m[1].toUpperCase()
  }
  // Texto livre
  const m = textoOriginal.match(/\b(B1|B2|B3|B4|A1|A2|A3[Aa]?|A4|AS)\b/)
  if (m) return m[1].toUpperCase()
  return null
}

function extrairSubgrupo(linhas, textoOriginal) {
  // COSERN: "CLASSIFICAÇÃO: B1 RESIDENCIAL -RESIDENCIAL"
  for (const linha of linhas) {
    if (/CLASSIFICA[ÇC][ÃA]O/i.test(linha)) {
      if (/BAIXA\s*RENDA|SOCIAL/i.test(linha)) return 'Residencial Baixa Renda'
      if (/RESIDENCIAL/i.test(linha)) return 'Residencial'
      if (/COMERCIAL/i.test(linha)) return 'Comercial'
      if (/INDUSTRIAL/i.test(linha)) return 'Industrial'
      if (/RURAL/i.test(linha)) return 'Rural'
      if (/PODER\s*P[ÚU]BLICO/i.test(linha)) return 'Poder Público'
    }
  }
  const tipos = [
    { nome: 'Residencial Baixa Renda', padrao: /BAIXA\s*RENDA|SOCIAL/i },
    { nome: 'Residencial',  padrao: /RESIDENCIAL/i },
    { nome: 'Comercial',    padrao: /COMERCIAL/i },
    { nome: 'Industrial',   padrao: /INDUSTRIAL/i },
    { nome: 'Rural',        padrao: /RURAL/i },
  ]
  for (const { nome, padrao } of tipos) {
    if (padrao.test(textoOriginal)) return nome
  }
  return null
}

function extrairTipoLigacao(linhas, textoOriginal, distribuidora) {
  // COSERN: "TIPO DE FORNECIMENTO: Conv. Monômia - Monofásico"
  for (const linha of linhas) {
    if (/TIPO\s*DE\s*FORNECIMENTO/i.test(linha)) {
      if (/TRIF[AÁ]SICO/i.test(linha)) return 'Trifásico 380V'
      if (/BIF[AÁ]SICO/i.test(linha)) return 'Bifásico 220V'
      if (/MONOF[AÁ]SICO/i.test(linha)) return 'Monofásico 220V'
    }
  }

  // Busca livre no texto
  const redeNeo = ['COSERN','COELBA','CELPE','ELEKTRO','NEOENERGIA']
  const isNeo = redeNeo.includes(distribuidora)

  if (/TRIF[AÁ]SICO/i.test(textoOriginal)) return isNeo ? 'Trifásico 380V' : 'Trifásico 220V'
  if (/BIF[AÁ]SICO/i.test(textoOriginal)) return isNeo ? 'Bifásico 220V' : 'Bifásico 220V'
  if (/MONOF[AÁ]SICO/i.test(textoOriginal)) return isNeo ? 'Monofásico 220V' : 'Monofásico 127V'

  return null
}

// ─── CONSUMO ─────────────────────────────────────────────────────────────────

function extrairConsumo(texto) {
  const padroes = [
    /consumo.*?(\d+(?:[.,]\d+)?)\s*kwh/,
    /kwh\s*(?:consumido|lido|total).*?(\d+(?:[.,]\d+)?)/,
  ]
  for (const padrao of padroes) {
    const m = texto.match(padrao)
    if (m) return Math.round(parseFloat(m[1].replace(',', '.')))
  }
  return null
}

function extrairHistorico12Meses(linhas) {
  const meses = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ']
  const historico = []
  let somaConsumo = 0

  // COSERN: "MAR26 438 30" (mês+ano consumo dias)
  for (const linha of linhas) {
    for (let i = 0; i < meses.length; i++) {
      const m = linha.match(new RegExp(`^(${meses[i]}\\d{2})\\s+(\\d+)\\s+\\d+$`, 'i'))
      if (m) {
        const consumo = parseInt(m[2])
        // Ignorar valores claramente errados (ex: 30 que é número de dias padrão)
        if (consumo > 10) {
          historico.push({ mes: meses[i], ano: m[1].slice(3), consumo, indice: i + 1 })
          somaConsumo += consumo
        }
      }
    }
  }

  // Fallback: padrão "JAN26: 262"
  if (historico.length === 0) {
    for (let i = 0; i < meses.length; i++) {
      for (const linha of linhas) {
        const m = linha.match(new RegExp(`${meses[i]}\\d*[:\\s]+(\\d+)`, 'i'))
        if (m) {
          const consumo = parseInt(m[1])
          if (consumo > 10) {
            historico.push({ mes: meses[i], consumo, indice: i + 1 })
            somaConsumo += consumo
          }
          break
        }
      }
    }
  }

  if (historico.length === 0) return null

  return {
    historico,
    mediaAnual: Math.round(somaConsumo / historico.length),
    periodoMeses: historico.length,
  }
}

// ─── FINANCEIRO ───────────────────────────────────────────────────────────────

function extrairValor(linhas, texto) {
  // COSERN: "TOTAL A PAGAR R$" na linha N, valor na N+1
  const idx = findLine(linhas, /TOTAL\s*A\s*PAGAR\s*R\$\s*$/i)
  if (idx >= 0) {
    const val = nextLine(linhas, idx)
    if (val) {
      const v = parseFloat(val.replace('.', '').replace(',', '.'))
      if (!isNaN(v)) return v
    }
  }
  // Fallback texto
  const padroes = [
    /total\s*a\s*pagar\s*r\$\s*([\d.,]+)/i,
    /valor\s*total.*?r\$\s*([\d.,]+)/i,
  ]
  for (const padrao of padroes) {
    const m = texto.match(padrao)
    if (m) return parseFloat(m[1].replace('.', '').replace(',', '.'))
  }
  return null
}

function extrairValorKwh(linhas) {
  // COSERN: "Consumo-TUSD kWh 438,00 0,57575596 ..." e "Consumo-TE kWh 438,00 0,41476788 ..."
  // Tarifa total = TUSD + TE
  let tusd = null
  let te = null

  for (const linha of linhas) {
    const mTusd = linha.match(/Consumo[- ]TUSD\s+kWh\s+[\d.,]+\s+([\d.,]{6,})/i)
    if (mTusd) tusd = parseFloat(mTusd[1].replace(',', '.'))

    const mTe = linha.match(/Consumo[- ]TE\s+kWh\s+[\d.,]+\s+([\d.,]{6,})/i)
    if (mTe) te = parseFloat(mTe[1].replace(',', '.'))
  }

  if (tusd && te) {
    const total = parseFloat((tusd + te).toFixed(5))
    return total
  }

  // Fallback: buscar "TARIFA UNIT" ou preço por kWh genérico
  for (const linha of linhas) {
    const m = linha.match(/(?:tarifa|pre[çc]o)\s*unit(?:á|a)rio[\s:R$]+(0[,.][\d]{2,6})/i)
    if (m) {
      const v = parseFloat(m[1].replace(',', '.'))
      if (v >= 0.3 && v <= 2.5) return v
    }
  }

  return null
}

// ─── DISTRIBUIDORA ────────────────────────────────────────────────────────────

function extrairDistribuidora(texto) {
  const distribuidoras = [
    // Nomes por razão social (antes dos genéricos)
    { nome: 'COSERN',     padrao: /cosern|COMPANHIA ENERG[EÉ]TICA DO RIO GRANDE DO NORTE/i },
    { nome: 'COELBA',     padrao: /coelba|COMPANHIA DE ELETRICIDADE DO ESTADO DA BAHIA/i },
    { nome: 'CELPE',      padrao: /celpe|COMPANHIA ENERG[EÉ]TICA DE PERNAMBUCO/i },
    { nome: 'COELCE',     padrao: /coelce|COMPANHIA ENERG[EÉ]TICA DO CEAR[AÁ]/i },
    { nome: 'CERON',      padrao: /ceron/i },
    { nome: 'ELEKTRO',    padrao: /elektro/i },
    { nome: 'ELETROPAULO',padrao: /eletropaulo/i },
    { nome: 'CEMIG',      padrao: /cemig/i },
    { nome: 'CPFL',       padrao: /cpfl/i },
    { nome: 'LIGHT',      padrao: /\blight\b/i },
    { nome: 'EDP',        padrao: /\bedp\b/i },
    { nome: 'CEEE',       padrao: /\bceee\b/i },
    { nome: 'RGE',        padrao: /\brge\b/i },
    { nome: 'CELG',       padrao: /\bcelg\b/i },
    { nome: 'CEB',        padrao: /\bceb\b/i },
    { nome: 'EQUATORIAL', padrao: /equatorial/i },
    { nome: 'ENERGISA',   padrao: /energisa/i },
    { nome: 'ENEL',       padrao: /\benel\b/i },
    { nome: 'NEOENERGIA', padrao: /neoenergia/i },
  ]
  for (const { nome, padrao } of distribuidoras) {
    if (padrao.test(texto)) return nome
  }
  return null
}

function mapeiaGrupoTarifario(classificacao) {
  // Mapeia classificação ANEEL (B1, B2, B3, etc.) para grupo tarifário
  const mapeamento = {
    'B1': 'B1 - Residencial',
    'B2': 'B2 - Rural',
    'B3': 'B3 - Demais Classes',
    'B4': 'B4 - Iluminação Pública',
    'A1': 'A1 - Altíssima Tensão',
    'A2': 'A2 - Alta Tensão',
    'A3': 'A3 - Média Tensão',
    'A3a': 'A3a - Média Tensão (até 30 kV)',
    'A4': 'A4 - Baixa Tensão',
    'AS': 'AS - Subgrupo Especial',
  }
  return mapeamento[classificacao] || classificacao || null
}

function extrairFaseETensao(tipoLigacao) {
  // Extrai fase e tensão do tipo de ligação
  if (!tipoLigacao) return { fase: null, tensao: null }

  const tipo = tipoLigacao.toLowerCase()
  let fase = null
  let tensao = null

  if (tipo.includes('monof')) {
    fase = 'Monofásico'
    tensao = tipo.includes('220') ? '220' : '127'
  } else if (tipo.includes('bif')) {
    fase = 'Bifásico'
    tensao = '220'
  } else if (tipo.includes('trif')) {
    fase = 'Trifásico'
    tensao = tipo.includes('220') ? '220' : '380'
  }

  return { fase, tensao }
}

function templateVazio(aviso) {
  return {
    nome: null, cpfCnpj: null, numeroCliente: null, codigoInstalacao: null,
    endereco: null, cep: null, cidade: null, estado: null,
    distribuidora: null, classificacao: null, subgrupo: null, tipoLigacao: null,
    consumoKwh: null, mediaAnual: null, historico12Meses: null, periodoMeses: null,
    valorR: null, valorKwh: null, aviso,
    // Dados auto-preenchimento etapa 2
    grupoTarifario: null,
    fase: null,
    tensao: null,
    irradiancia: null,
  }
}
