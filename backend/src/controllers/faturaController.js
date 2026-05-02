import { PDFParse } from 'pdf-parse'

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

    console.log('📄 Processando PDF:', req.file.originalname)

    let textoOriginal = ''
    let texto = ''

    try {
      const parser = new PDFParse({ data: req.file.buffer })
      const textResult = await parser.getText()
      textoOriginal = textResult.text || ''
      texto = textoOriginal.toLowerCase()
      await parser.destroy()
      console.log('📖 Texto (300 chars):', textoOriginal.substring(0, 300))
    } catch (pdfErr) {
      console.warn('⚠️ PDF parse falhou:', pdfErr.message)
      return res.json(templateVazio('Não foi possível extrair dados do PDF.'))
    }

    const distribuidora = extrairDistribuidora(textoOriginal)
    const historico = extrairHistorico12Meses(texto)
    const consumoUnico = extrairConsumo(texto)

    const dados = {
      // Dados do cliente
      nome:           extrairNomeCliente(textoOriginal, distribuidora),
      cpfCnpj:        extrairCpfCnpj(textoOriginal),
      numeroCliente:  extrairNumeroCliente(textoOriginal),

      // Endereço
      endereco:       extrairEnderecoCliente(textoOriginal, distribuidora),
      cep:            extrairCep(textoOriginal),
      cidade:         extrairCidade(textoOriginal),
      estado:         extrairEstado(textoOriginal),

      // Distribuidora e classificação
      distribuidora,
      classificacao:  extrairClassificacao(textoOriginal),  // B1, B2, B3, C1...
      subgrupo:       extrairSubgrupo(textoOriginal),        // Residencial, Comercial, Rural...
      tipoLigacao:    extrairTipoLigacao(textoOriginal, distribuidora), // Monofásico 220V, Trifásico 380V...

      // Consumo
      consumoKwh:     historico?.mediaAnual || consumoUnico,
      mediaAnual:     historico?.mediaAnual || null,
      historico12Meses: historico?.historico || null,
      periodoMeses:   historico?.periodoMeses || null,

      // Financeiro
      valorR:         extrairValor(texto),
      valorKwh:       extrairValorKwh(textoOriginal),        // Tarifa R$/kWh
    }

    console.log('✓ Extraído:', {
      nome: dados.nome, cpfCnpj: dados.cpfCnpj, numeroCliente: dados.numeroCliente,
      distribuidora: dados.distribuidora, classificacao: dados.classificacao,
      subgrupo: dados.subgrupo, tipoLigacao: dados.tipoLigacao,
      consumo: dados.consumoKwh, valorKwh: dados.valorKwh,
    })

    res.json(dados)
  } catch (err) {
    console.error('❌ Erro:', err.message)
    res.status(500).json({ erro: 'Erro ao processar PDF' })
  }
}

// ─── DADOS DO CLIENTE ────────────────────────────────────────────────────────

function extrairNomeCliente(texto, distribuidora) {
  const nomesIgnorar = ['COSERN', 'COELBA', 'CELPE', 'CEMIG', 'CPFL', 'LIGHT', 'ENEL',
    'NEOENERGIA', 'ENERGISA', 'EQUATORIAL', 'ELEKTRO', 'CEEE', 'RGE', 'COELCE',
    'CELG', 'CEB', 'CERON', 'ELETROACRE', 'AME', 'BOA VISTA']

  const padroes = [
    /(?:NOME\s*DO\s*CLIENTE|NOME\s*DO\s*TITULAR|CLIENTE|CONSUMIDOR|TITULAR)[\s:]+([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ][A-ZÁÉÍÓÚÀÂÊÔÃÕÇa-záéíóúàâêôãõç\s]{4,70})(?=\n|CPF|CNPJ|RUA|AV\b|END|R\.)/im,
    /RAZ[ÃA]O\s*SOCIAL[\s:]+([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ][A-ZÁÉÍÓÚÀÂÊÔÃÕÇa-záéíóúàâêôãõç\s]{4,80})(?=\n|CPF|CNPJ)/im,
  ]

  for (const padrao of padroes) {
    const match = texto.match(padrao)
    if (match) {
      const nome = match[1].trim()
      if (!nomesIgnorar.some(n => nome.toUpperCase().includes(n)) && nome.length > 3) {
        return nome
      }
    }
  }
  return null
}

function extrairCpfCnpj(texto) {
  // CPF: 000.000.000-00
  const cpfs = [...texto.matchAll(/\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/g)]
  if (cpfs.length > 0) return cpfs[cpfs.length - 1][1] // último (do cliente)

  // CNPJ: 00.000.000/0000-00
  const cnpjs = [...texto.matchAll(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/g)]
  if (cnpjs.length > 1) return cnpjs[1][1] // segundo (o primeiro é da distribuidora)
  if (cnpjs.length === 1) return cnpjs[0][1]

  return null
}

function extrairNumeroCliente(texto) {
  const padroes = [
    /(?:N[ºO°]?\.?\s*DO\s*CLIENTE|C[ÓO]DIGO\s*(?:DO\s*)?CLIENTE|NÚMERO\s*(?:DO\s*)?CLIENTE|CLIENTE\s*N[ºO°]?)[\s:]+(\d{5,15})/im,
    /(?:INSTALA[ÇC][ÃA]O|MATRÍCULA|MATR[ÍI]CULA)[\s:]+(\d{5,15})/im,
    /\bUC[\s:]+(\d{5,15})/im,
    /UNIDADE\s*CONSUMIDORA[\s:#]+(\d{5,15})/im,
    /CONTA[\s:]+N[ºO°]?[\s:]*(\d{5,15})/im,
  ]
  for (const padrao of padroes) {
    const match = texto.match(padrao)
    if (match) return match[1].trim()
  }
  return null
}

// ─── ENDEREÇO ────────────────────────────────────────────────────────────────

function extrairEnderecoCliente(texto, distribuidora) {
  // Endereços de distribuidoras a ignorar
  const enderecoDistribuidora = {
    'COSERN': ['mermoz', 'baldo'],
    'COELBA': ['dique do tororo', 'lobato'],
    'CELPE':  ['caruaru', 'recife'],
  }
  const ignorar = enderecoDistribuidora[distribuidora] || []

  const linhas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  let blocoCliente = false
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    const linhaLow = linha.toLowerCase()

    if (/DADOS\s*DO\s*CLIENTE|LOCAL\s*DE\s*FORNECIMENTO|ENDERE[ÇC]O\s*DE\s*(?:FORNECIMENTO|INSTALA|ENTREGA)|UNIDADE\s*CONSUMIDORA/i.test(linha)) {
      blocoCliente = true
      continue
    }

    if (blocoCliente && /^(?:rua|av(?:enida)?\.?|alameda|travessa|praça|pça|rodovia|estrada|via|praia|lote|sítio|beco|conjunto|cond(?:omínio)?\.?|qd|quadra)/i.test(linhaLow)) {
      if (!ignorar.some(e => linhaLow.includes(e)) && linha.match(/\d+/)) {
        return linha
      }
    }
  }

  // Segunda passagem: qualquer endereço que não seja da distribuidora
  for (const linha of linhas) {
    const linhaLow = linha.toLowerCase()
    if (/^(?:rua|av(?:enida)?\.?|alameda|travessa|praça|rodovia|estrada|lote|qd|quadra)/i.test(linhaLow)) {
      if (!ignorar.some(e => linhaLow.includes(e)) && linha.match(/\d+/)) {
        return linha
      }
    }
  }

  return null
}

function extrairCep(texto) {
  const ceps = [...texto.matchAll(/\b(\d{5}-\d{3})\b/g)]
  if (ceps.length === 0) return null
  // Pegar o último (normalmente é o do cliente)
  return ceps[ceps.length - 1][1]
}

function extrairCidade(texto) {
  // "Natal/RN" ou "Natal - RN"
  const match = texto.match(/([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ][a-záéíóúàâêôãõç\s]{2,30})[\s\/\-]+([A-Z]{2})\b/)
  if (match) return match[1].trim()
  const match2 = texto.match(/(?:MUNIC[ÍI]PIO|CIDADE)[\s:]+([A-Za-záéíóúàâêôãõç\s]{3,30})(?=\n|\/|–|-)/i)
  if (match2) return match2[1].trim()
  return null
}

function extrairEstado(texto) {
  const match = texto.match(/[A-Za-záéíóúàâêôãõç\s]{2,30}[\s\/\-]+([A-Z]{2})\b/)
  if (match) {
    const ufs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
    if (ufs.includes(match[1])) return match[1]
  }
  return null
}

// ─── CLASSIFICAÇÃO E TIPO ─────────────────────────────────────────────────────

function extrairClassificacao(texto) {
  // Subgrupos tarifários ANEEL: B1, B2, B3, B4, A1, A2, A3, A3a, A4, AS
  const match = texto.match(/\b(B1|B2|B3|B4|A1|A2|A3[Aa]?|A4|AS)\b/)
  if (match) return match[1].toUpperCase()

  // Buscar por descrição
  if (/RESIDENCIAL/i.test(texto)) return 'B1'
  if (/RURAL/i.test(texto)) return 'B2'
  if (/ILUMINA[ÇC][ÃA]O\s*P[ÚU]BLICA/i.test(texto)) return 'B4'

  return null
}

function extrairSubgrupo(texto) {
  // Tipo de consumidor
  const tipos = [
    { nome: 'Residencial',           padrao: /RESIDENCIAL/i },
    { nome: 'Residencial Baixa Renda', padrao: /BAIXA\s*RENDA|SOCIAL/i },
    { nome: 'Comercial',             padrao: /COMERCIAL/i },
    { nome: 'Industrial',            padrao: /INDUSTRIAL/i },
    { nome: 'Rural',                 padrao: /RURAL/i },
    { nome: 'Poder Público',         padrao: /PODER\s*P[ÚU]BLICO/i },
    { nome: 'Iluminação Pública',    padrao: /ILUMINA[ÇC][ÃA]O\s*P[ÚU]BLICA/i },
    { nome: 'Serviço Público',       padrao: /SERVI[ÇC]O\s*P[ÚU]BLICO/i },
  ]
  for (const { nome, padrao } of tipos) {
    if (padrao.test(texto)) return nome
  }
  return null
}

function extrairTipoLigacao(texto, distribuidora) {
  // Detectar número de fases
  const textoLow = texto.toLowerCase()

  const isMonofasico = /monof[aá]sico|mono\s*f[aá]sico|\bm\b(?=.*fase)|1\s*fase/i.test(texto)
  const isBifasico   = /bif[aá]sico|bi\s*f[aá]sico|2\s*fases/i.test(texto)
  const isTrifasico  = /trif[aá]sico|tri\s*f[aá]sico|3\s*fases/i.test(texto)

  // Tensão explícita
  const tensaoMatch = texto.match(/\b(127|220|380)\s*[Vv]\b/)
  const tensao = tensaoMatch ? tensaoMatch[1] : null

  // COSERN/Neoenergia/RN: Monofásico 220V, Trifásico 380V
  const redeNeo = ['COSERN', 'COELBA', 'CELPE', 'ELEKTRO', 'NEOENERGIA']
  const isNeo = redeNeo.includes(distribuidora)

  if (isTrifasico) {
    const v = tensao || (isNeo ? '380' : '220')
    return `Trifásico ${v}V`
  }
  if (isBifasico) {
    const v = tensao || (isNeo ? '220' : '220')
    return `Bifásico ${v}V`
  }
  if (isMonofasico) {
    const v = tensao || (isNeo ? '220' : '127')
    return `Monofásico ${v}V`
  }

  // Se não achou frase explícita, tentar pelo número de fios/disjuntores
  if (/disjuntor\s*(?:de\s*)?\d+\s*[Aa]/i.test(texto)) {
    if (/3\s*[Pp]|trifásico/i.test(texto)) return isNeo ? 'Trifásico 380V' : 'Trifásico 220V'
    return isNeo ? 'Monofásico 220V' : 'Monofásico 127V'
  }

  return tensao ? `${tensao}V` : null
}

// ─── CONSUMO ─────────────────────────────────────────────────────────────────

function extrairConsumo(texto) {
  const padroes = [
    /consumo.*?(\d+(?:[.,]\d+)?)\s*kwh/,
    /kwh\s*(?:consumido|lido|total).*?(\d+(?:[.,]\d+)?)/,
    /total\s*de\s*kwh.*?(\d+(?:[.,]\d+)?)/,
  ]
  for (const padrao of padroes) {
    const match = texto.match(padrao)
    if (match) return Math.round(parseFloat(match[1].replace(',', '.')))
  }
  return null
}

function extrairHistorico12Meses(texto) {
  const meses = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ']
  const historico = []
  let somaConsumo = 0

  for (let i = 0; i < meses.length; i++) {
    const padrao = new RegExp(`${meses[i]}\\d*[:\\s]+([\\d.,]+)`, 'i')
    const match = texto.match(padrao)
    if (match) {
      const consumo = Math.round(parseFloat(match[1].replace(',', '.')))
      historico.push({ mes: meses[i], consumo, indice: i + 1 })
      somaConsumo += consumo
    }
  }

  // Verificar se há campo de média explícita na fatura
  const mediaExplicita = texto.match(/m[eé]dia\s*(?:de\s*)?(?:consumo\s*)?[\s:]+(\d+(?:[.,]\d+)?)\s*kwh/i)
  if (historico.length === 0 && mediaExplicita) {
    return {
      historico: [],
      mediaAnual: Math.round(parseFloat(mediaExplicita[1].replace(',', '.'))),
      periodoMeses: 0,
      fontMedia: 'campo_fatura'
    }
  }

  if (historico.length === 0) return null

  return {
    historico,
    mediaAnual: Math.round(somaConsumo / historico.length),
    periodoMeses: historico.length,
    fontMedia: 'historico'
  }
}

// ─── FINANCEIRO ───────────────────────────────────────────────────────────────

function extrairValor(texto) {
  const padroes = [
    /total\s*(?:a\s*pagar|devido).*?r\$\s*([\d.,]+)/,
    /valor\s*total.*?r\$\s*([\d.,]+)/,
    /r\$\s*([\d.,]+)(?=\s*$)/m,
  ]
  for (const padrao of padroes) {
    const match = texto.match(padrao)
    if (match) return parseFloat(match[1].replace('.', '').replace(',', '.'))
  }
  return null
}

function extrairValorKwh(texto) {
  // Procurar por tarifa em R$/kWh
  const padroes = [
    /tarifa.*?(?:kwh|kw\/h)[\s:R$]*([\d.,]+)/i,
    /pre[çc]o\s*(?:unit[aá]rio|do\s*kwh|por\s*kwh)[\s:R$]*([\d.,]+)/i,
    /(?:kwh|kw\/h)\s*R?\$?\s*(0[,.][\d]{2,6})/i,   // 0,XXXXX
    /custo\s*(?:unit[aá]rio|por\s*kwh)[\s:R$]*([\d.,]+)/i,
  ]
  for (const padrao of padroes) {
    const match = texto.match(padrao)
    if (match) {
      const valor = parseFloat(match[1].replace(',', '.'))
      // Tarifa kWh deve estar entre R$0,30 e R$2,50
      if (valor >= 0.3 && valor <= 2.5) return valor
    }
  }
  return null
}

// ─── DISTRIBUIDORA ────────────────────────────────────────────────────────────

function extrairDistribuidora(texto) {
  // Nomes específicos antes dos grupos corporativos
  const distribuidoras = [
    { nome: 'COSERN',    padrao: /cosern/i },
    { nome: 'COELBA',    padrao: /coelba/i },
    { nome: 'CELPE',     padrao: /celpe/i },
    { nome: 'COELCE',    padrao: /coelce/i },
    { nome: 'CERON',     padrao: /ceron/i },
    { nome: 'ELEKTRO',   padrao: /elektro/i },
    { nome: 'ELETROPAULO', padrao: /eletropaulo/i },
    { nome: 'CEMIG',     padrao: /cemig/i },
    { nome: 'CPFL',      padrao: /cpfl/i },
    { nome: 'LIGHT',     padrao: /\blight\b/i },
    { nome: 'EDP',       padrao: /\bedp\b/i },
    { nome: 'CEEE',      padrao: /\bceee\b/i },
    { nome: 'RGE',       padrao: /\brge\b/i },
    { nome: 'CELG',      padrao: /\bcelg\b/i },
    { nome: 'CEB',       padrao: /\bceb\b/i },
    { nome: 'ELETROACRE',padrao: /eletroacre/i },
    { nome: 'AME',       padrao: /\bame\b.*energia/i },
    { nome: 'EQUATORIAL',padrao: /equatorial/i },
    { nome: 'ENERGISA',  padrao: /energisa/i },
    { nome: 'ENEL',      padrao: /\benel\b/i },
    { nome: 'NEOENERGIA',padrao: /neoenergia/i },
  ]
  for (const { nome, padrao } of distribuidoras) {
    if (padrao.test(texto)) return nome
  }
  return null
}

function templateVazio(aviso) {
  return {
    nome: null, cpfCnpj: null, numeroCliente: null,
    endereco: null, cep: null, cidade: null, estado: null,
    distribuidora: null, classificacao: null, subgrupo: null, tipoLigacao: null,
    consumoKwh: null, mediaAnual: null, historico12Meses: null, periodoMeses: null,
    valorR: null, valorKwh: null,
    aviso,
  }
}
