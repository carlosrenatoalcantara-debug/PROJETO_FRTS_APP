import { PDFParse } from 'pdf-parse'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Extração via IA (Claude) ──────────────────────────────────────────────────

async function extrairComIA(textoPDF) {
  // Limita o texto para não exceder tokens desnecessários
  const texto = textoPDF.substring(0, 12000)

  const prompt = `Você é um especialista em equipamentos fotovoltaicos. Analise o texto extraído de um datasheet de equipamento solar e retorne SOMENTE um JSON válido, sem markdown, sem explicações.

REGRAS IMPORTANTES:
- "modelo" deve ser o código técnico do produto (ex: JKM550M-72HL4, RS6-550W, LP182*182-M-72-MH). NUNCA use certificações (ISO, IEC, CE, UL) como modelo.
- "fabricante" deve ser o nome da empresa fabricante (ex: Jinko Solar, Risen Energy, Leapton Solar). NUNCA use "Desconhecido".
- Se o datasheet for de uma SÉRIE com múltiplas potências (ex: 590W, 595W, 600W, 605W), coloque cada variante em "variantes". Se for um único produto, coloque em "variantes" com um único item.
- Todos os valores numéricos devem ser números (não strings).
- Se não encontrar um campo, use null.

CAMPOS ESPERADOS NO JSON:
{
  "fabricante": "Nome do fabricante",
  "modelo": "Código do modelo base (sem a potência, ex: ZXMR-UPLDD144)",
  "tipo": "modulo" ou "inversor",
  "variantes": [
    {
      "potenciaW": 590,
      "voc": 52.0,
      "vmpp": 43.5,
      "isc": 14.47,
      "impp": 13.57,
      "eficiencia": 21.8
    }
  ],
  "dadosMecanicos": {
    "dimensoes": "2278x1134x35mm",
    "peso": 32.5,
    "celulas": "144 células monocristalinas",
    "vidro": "vidro temperado 3.2mm",
    "conector": "MC4"
  }
}

TEXTO DO DATASHEET:
${texto}`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const resposta = message.content[0].text.trim()

  // Remove possível markdown ```json ... ```
  const limpo = resposta.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  return JSON.parse(limpo)
}

// ── Endpoint principal ────────────────────────────────────────────────────────

export async function extrairDatasheet(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ sucesso: false, erro: 'Arquivo PDF não fornecido' })
    }

    // 1. Extrai texto do PDF
    const parser = new PDFParse({ data: req.file.buffer })
    const textResult = await parser.getText()
    await parser.destroy()

    const textoPDF = textResult.text
    console.log(`📄 PDF lido: ${textoPDF.length} chars`)

    // 2. Tenta extração com IA
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({
        sucesso: false,
        erro: 'ANTHROPIC_API_KEY não configurada. Configure a variável de ambiente no servidor.',
      })
    }

    let iaResultado
    try {
      iaResultado = await extrairComIA(textoPDF)
      console.log('✅ IA extraiu:', JSON.stringify(iaResultado, null, 2))
    } catch (iaErr) {
      console.error('❌ Erro na IA:', iaErr.message)
      return res.status(500).json({
        sucesso: false,
        erro: `Falha na extração com IA: ${iaErr.message}`,
      })
    }

    // 3. Normaliza a resposta da IA para o formato esperado pelo frontend
    const { fabricante, modelo, tipo = 'modulo', variantes = [], dadosMecanicos } = iaResultado

    // Garante que variantes é array
    const variantesNorm = Array.isArray(variantes) ? variantes : [variantes].filter(Boolean)

    // Dados compartilhados (primeira variante ou objeto único)
    const primeira = variantesNorm[0] || {}

    const dados = {
      fabricante: fabricante || 'Desconhecido',
      modelo: modelo || '',
      potenciaW: primeira.potenciaW || null,
      voc: primeira.voc || null,
      vmpp: primeira.vmpp || null,
      isc: primeira.isc || null,
      impp: primeira.impp || null,
      eficiencia: primeira.eficiencia || null,
      // campos para inversores
      potenciaKW: primeira.potenciaKW || iaResultado.potenciaKW || null,
      nMppts: primeira.nMppts || iaResultado.nMppts || null,
      correnteACSaida: primeira.correnteACSaida || iaResultado.correnteACSaida || null,
    }

    const camposEncontrados = Object.values(dados).filter(v => v !== null && v !== '').length

    const resposta = {
      sucesso: true,
      dados,
      qualityScore: Math.min(100, camposEncontrados * 12),
      avisos: [],
      _debug: { chars: textoPDF.length, campos_encontrados: camposEncontrados },
    }

    // Retorna variantes separadas apenas quando há mais de uma
    if (variantesNorm.length > 1) {
      resposta.variantes = variantesNorm
    }

    res.json(resposta)
  } catch (err) {
    console.error('❌ Erro ao extrair datasheet:', err)
    res.status(500).json({ sucesso: false, erro: 'Erro ao processar PDF: ' + err.message })
  }
}

export function criarPainelManual(req, res) {
  try {
    const { marca, modelo, potenciaW, voc, vmpp, isc, impp, eficiencia, garantiaProduto, garantiaPerformance } = req.body
    if (!marca || !modelo || !potenciaW)
      return res.status(400).json({ erro: 'Marca, modelo e potência (W) são obrigatórios' })

    res.status(201).json({
      sucesso: true,
      painel: {
        id: `custom-${Date.now()}`, marca, modelo,
        potenciaW: Number(potenciaW),
        voc: voc ? Number(voc) : null,
        vmpp: vmpp ? Number(vmpp) : null,
        isc: isc ? Number(isc) : null,
        impp: impp ? Number(impp) : null,
        eficiencia: eficiencia ? Number(eficiencia) : null,
        garantiaProduto: Number(garantiaProduto) || 10,
        garantiaPerformance: Number(garantiaPerformance) || 25,
        criacao: new Date().toISOString(),
      },
      mensagem: 'Painel cadastrado com sucesso',
    })
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message })
  }
}

export function criarInversorManual(req, res) {
  try {
    const { marca, modelo, potenciaKW, faseAC, nMppts, tensaoMpptMin, tensaoMpptMax, garantia } = req.body
    if (!marca || !modelo || !potenciaKW)
      return res.status(400).json({ erro: 'Marca, modelo e potência (kW) são obrigatórios' })

    res.status(201).json({
      sucesso: true,
      inversor: {
        id: `custom-${Date.now()}`, marca, modelo,
        potenciaKW: Number(potenciaKW),
        faseAC: faseAC ? Number(faseAC) : 1,
        nMppts: Number(nMppts) || 1,
        tensaoMpptMin: Number(tensaoMpptMin) || 200,
        tensaoMpptMax: Number(tensaoMpptMax) || 800,
        garantia: Number(garantia) || 10,
        criacao: new Date().toISOString(),
      },
      mensagem: 'Inversor cadastrado com sucesso',
    })
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message })
  }
}
