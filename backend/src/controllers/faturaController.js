import { PDFParse } from 'pdf-parse'

export async function extrairDadosFatura(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo enviado' })
    }

    console.log('📄 Processando PDF:', req.file.originalname, 'Size:', req.file.size)

    let texto = ''
    let textoOriginal = ''
    try {
      const parser = new PDFParse({ data: req.file.buffer })
      const textResult = await parser.getText()
      textoOriginal = textResult.text || ''
      texto = textoOriginal.toLowerCase()
      await parser.destroy()
      console.log('📖 Texto extraído (primeiros 300 chars):', textoOriginal.substring(0, 300))
    } catch (pdfErr) {
      console.warn('⚠️ PDF parse falhou:', pdfErr.message)
      return res.json({
        nome: null, cpfCnpj: null, consumoKwh: null, valorR: null,
        distribuidora: null, endereco: null, cep: null, cidade: null, estado: null,
        historico12Meses: null, mediaAnual: null, periodoMeses: null,
        aviso: 'Não foi possível extrair dados. Preencha manualmente.'
      })
    }

    const historico = extrairHistorico12Meses(texto)
    const consumoUnico = extrairConsumo(texto)
    const distribuidora = extrairDistribuidora(textoOriginal)

    const dados = {
      nome: extrairNomeCliente(textoOriginal, distribuidora),
      cpfCnpj: extrairCpfCnpj(textoOriginal),
      numeroCliente: extrairNumeroCliente(textoOriginal),
      consumoKwh: historico?.mediaAnual || consumoUnico,
      valorR: extrairValor(texto),
      distribuidora,
      endereco: extrairEnderecoCliente(textoOriginal, distribuidora),
      cep: extrairCep(textoOriginal),
      cidade: extrairCidade(textoOriginal),
      estado: extrairEstado(textoOriginal),
      historico12Meses: historico?.historico || null,
      mediaAnual: historico?.mediaAnual || null,
      periodoMeses: historico?.periodoMeses || null,
    }

    console.log('✓ Dados extraídos:', {
      nome: dados.nome,
      cpfCnpj: dados.cpfCnpj,
      numeroCliente: dados.numeroCliente,
      distribuidora: dados.distribuidora,
      endereco: dados.endereco,
      cep: dados.cep,
    })

    res.json(dados)
  } catch (err) {
    console.error('❌ Erro ao processar fatura:', err.message)
    res.status(500).json({ erro: 'Erro ao processar PDF' })
  }
}

function extrairNomeCliente(texto, distribuidora) {
  // Padrões para encontrar o nome do cliente em faturas brasileiras
  const padroes = [
    // "NOME DO CLIENTE: João Silva" ou "NOME: João Silva"
    /NOME\s*(?:DO\s*CLIENTE|CONSUMIDOR|TITULAR)?[\s:]+([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ][A-ZÁÉÍÓÚÀÂÊÔÃÕÇ\s]{5,60})(?=\n|CPF|CNPJ|RUA|AV|END)/i,
    // "Razão Social: Nome da Empresa"
    /RAZ[ÃA]O\s*SOCIAL[\s:]+([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ][A-Za-záéíóúàâêôãõç\s]{5,80})(?=\n|CPF|CNPJ)/i,
    // Após "CLIENTE:" ou "CONSUMIDOR:"
    /(?:CLIENTE|CONSUMIDOR)[\s:]+([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ][A-Za-záéíóúàâêôãõç\s]{5,60})(?=\n|CPF|CNPJ|RUA)/i,
  ]

  // Ignorar nomes da distribuidora
  const nomesIgnorar = ['COSERN', 'ENEL', 'CEMIG', 'LIGHT', 'CPFL', 'NEOENERGIA', 'ENERGISA', 'COELBA', 'CELPE']

  for (const padrao of padroes) {
    const match = texto.match(padrao)
    if (match) {
      const nome = match[1].trim()
      const ignorar = nomesIgnorar.some(n => nome.toUpperCase().includes(n))
      if (!ignorar && nome.length > 3) {
        return nome
      }
    }
  }
  return null
}

function extrairCpfCnpj(texto) {
  // CPF: 000.000.000-00
  const cpfMatch = texto.match(/\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/)
  if (cpfMatch) return cpfMatch[1]

  // CNPJ: 00.000.000/0000-00
  const cnpjMatch = texto.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/)
  if (cnpjMatch) {
    // Ignorar CNPJ da distribuidora (geralmente aparece primeiro no topo)
    const cnpjs = [...texto.matchAll(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/g)]
    if (cnpjs.length > 1) {
      // Retornar o segundo CNPJ (o cliente, não a distribuidora)
      return cnpjs[1][1]
    }
    return cnpjMatch[1]
  }
  return null
}

function extrairEnderecoCliente(texto, distribuidora) {
  const linhas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  // Endereços conhecidos de distribuidoras a ignorar
  const enderecosCosern = ['mermoz', 'baldo']
  const enderecosEnel = ['avenue', 'enel']

  // Procurar pelo bloco de dados do cliente
  let blocoCliente = false
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    const linhaLow = linha.toLowerCase()

    // Identificar início do bloco do cliente
    if (/DADOS\s*DO\s*(?:CLIENTE|CONSUMIDOR)|LOCAL\s*DE\s*FORNECIMENTO|ENDERE[ÇC]O\s*DE\s*INSTALA|UNIDADE\s*CONSUMIDORA/i.test(linha)) {
      blocoCliente = true
      continue
    }

    // No bloco do cliente, pegar o primeiro endereço válido
    if (blocoCliente) {
      if (/^(?:rua|avenida|av\.?|alameda|travessa|praça|pça|rodovia|estrada|via|praia|lote|sítio|servidão|beco|conjunto|condomínio|cond\.)/i.test(linhaLow)) {
        // Verificar se não é endereço da distribuidora
        const eDistribuidora = enderecosCosern.some(e => linhaLow.includes(e)) ||
                               enderecosEnel.some(e => linhaLow.includes(e))
        if (!eDistribuidora) {
          return linha
        }
      }
    }
  }

  // Segunda tentativa: pegar qualquer endereço que não seja da distribuidora
  for (const linha of linhas) {
    const linhaLow = linha.toLowerCase()
    if (/^(?:rua|avenida|av\.?|alameda|travessa|praça|pça|rodovia|estrada|via|praia|lote|sítio|beco|conjunto|cond\.)/i.test(linhaLow)) {
      const eDistribuidora = enderecosCosern.some(e => linhaLow.includes(e))
      if (!eDistribuidora && linha.match(/\d+/)) {
        return linha
      }
    }
  }

  return null
}

function extrairCep(texto) {
  // Padrão CEP: 00000-000 — pegar o do cliente (não da distribuidora)
  const ceps = [...texto.matchAll(/\b(\d{5}-\d{3})\b/g)]
  if (ceps.length === 0) return null
  // Retornar o último CEP encontrado (geralmente é o do cliente)
  return ceps[ceps.length - 1][1]
}

function extrairCidade(texto) {
  // Padrão: "Natal/RN" ou "Natal - RN" ou "Cidade: Natal"
  const match = texto.match(/\b([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ][a-záéíóúàâêôãõç\s]{2,30})[\s\/\-]+([A-Z]{2})\b/)
  if (match) return match[1].trim()

  // Procurar por "MUNICÍPIO:" ou "CIDADE:"
  const match2 = texto.match(/(?:MUNIC[ÍI]PIO|CIDADE)[\s:]+([A-Za-záéíóúàâêôãõç\s]{3,30})(?=\n|\/|–|-)/i)
  if (match2) return match2[1].trim()

  return null
}

function extrairEstado(texto) {
  // Procurar por UF de 2 letras após cidade
  const match = texto.match(/\b[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ][a-záéíóúàâêôãõç\s]{2,30}[\s\/\-]+([A-Z]{2})\b/)
  if (match) return match[1]
  return null
}

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
  const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
  const historico = []
  let somaConsumo = 0

  for (let i = 0; i < meses.length; i++) {
    const padraoBusca = new RegExp(`${meses[i]}\\d*[:\\s]+([\\d.,]+)`, 'i')
    const match = texto.match(padraoBusca)
    if (match) {
      const consumo = Math.round(parseFloat(match[1].replace(',', '.')))
      historico.push({ mes: meses[i], consumo, indice: i + 1 })
      somaConsumo += consumo
    }
  }

  if (historico.length === 0) return null

  return {
    historico,
    mediaAnual: Math.round(somaConsumo / historico.length),
    periodoMeses: historico.length
  }
}

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

function extrairNumeroCliente(texto) {
  const padroes = [
    // "Nº DO CLIENTE: 123456" ou "CÓDIGO DO CLIENTE: 123456"
    /(?:N[ºO°]?\.?\s*DO\s*CLIENTE|C[ÓO]DIGO\s*(?:DO\s*)?CLIENTE|NÚMERO\s*DO\s*CLIENTE)[\s:]+(\d{5,15})/i,
    // "CLIENTE Nº: 123456"
    /CLIENTE\s*N[ºO°]?\.?[\s:]+(\d{5,15})/i,
    // "UC: 123456" ou "UNIDADE CONSUMIDORA: 123456"
    /(?:\bUC\b|UNIDADE\s*CONSUMIDORA)[\s:]+(\d{5,15})/i,
    // "INSTALAÇÃO: 123456"
    /INSTALA[ÇC][ÃA]O[\s:]+(\d{5,15})/i,
    // "MATRÍCULA: 123456"
    /MATR[ÍI]CULA[\s:]+(\d{5,15})/i,
  ]
  for (const padrao of padroes) {
    const match = texto.match(padrao)
    if (match) return match[1].trim()
  }
  return null
}

function extrairDistribuidora(texto) {
  // Ordem importa: verificar nomes específicos antes dos grupos
  const distribuidoras = [
    // Nomes específicos (antes dos grupos)
    { nome: 'COSERN',     padrao: /cosern/i },
    { nome: 'COELBA',     padrao: /coelba/i },
    { nome: 'CELPE',      padrao: /celpe/i },
    { nome: 'ELEKTRO',    padrao: /elektro/i },
    { nome: 'ELETROPAULO',padrao: /eletropaulo/i },
    { nome: 'CEMIG',      padrao: /cemig/i },
    { nome: 'CPFL',       padrao: /cpfl/i },
    { nome: 'LIGHT',      padrao: /light\s*s\.?a/i },
    { nome: 'EDP',        padrao: /\bedp\b/i },
    { nome: 'CEEE',       padrao: /ceee/i },
    { nome: 'RGE',        padrao: /\brge\b/i },
    { nome: 'EQUATORIAL', padrao: /equatorial/i },
    { nome: 'ENERGISA',   padrao: /energisa/i },
    // Grupos (verificar depois dos específicos)
    { nome: 'ENEL',       padrao: /\benel\b/i },
    { nome: 'NEOENERGIA', padrao: /neoenergia/i },
  ]

  for (const { nome, padrao } of distribuidoras) {
    if (padrao.test(texto)) return nome
  }
  return null
}
