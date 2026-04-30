import PDFParse from 'pdf-parse'

export async function extrairDadosFatura(req, res) {
  try {
    if (!req.file) {
      console.log('❌ Nenhum arquivo enviado')
      return res.status(400).json({ erro: 'Nenhum arquivo enviado' })
    }

    console.log('📄 Processando PDF:', req.file.originalname, 'Size:', req.file.size)
    // Parse PDF
    const data = await PDFParse(req.file.buffer)
    const texto = (data.text || '').toLowerCase()
    console.log('📖 Texto extraído:', texto.substring(0, 100))

    // Extrair dados da fatura
    const historico = extrairHistorico12Meses(texto)
    const consumoUnico = extrairConsumo(texto)

    const dados = {
      consumoKwh: historico?.mediaAnual || consumoUnico,
      valorR: extrairValor(texto),
      distribuidora: extrairDistribuidora(texto),
      endereco: extrairEndereco(texto),
      historico12Meses: historico?.historico || null,
      mediaAnual: historico?.mediaAnual || null,
      periodoMeses: historico?.periodoMeses || null,
    }

    console.log('✓ Fatura processada:', {
      consumo: dados.consumoKwh,
      meses: dados.periodoMeses,
      distribuidora: dados.distribuidora
    })
    res.json(dados)
  } catch (err) {
    console.error('❌ Erro ao processar fatura:', err.message)
    res.status(500).json({ erro: 'Erro ao processar PDF' })
  }
}

function extrairConsumo(texto) {
  // Padrões comuns em faturas brasileiras
  const padroes = [
    /consumo.*?(\d+(?:[.,]\d+)?)\s*kwh/,
    /kwh\s*(?:consumido|lido|total).*?(\d+(?:[.,]\d+)?)/,
    /total\s*de\s*kwh.*?(\d+(?:[.,]\d+)?)/,
  ]

  for (const padrao of padroes) {
    const match = texto.match(padrao)
    if (match) {
      return Math.round(parseFloat(match[1].replace(',', '.')))
    }
  }
  return null
}

function extrairHistorico12Meses(texto) {
  // Padrões para extrair tabela de consumo de 12 meses
  // Busca por padrões como: "JAN26: 262", "FEV26: 354", etc.
  const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
  const historico = []
  let somaConsumo = 0

  // Tenta encontrar consumo por mês
  for (let i = 0; i < meses.length; i++) {
    const padraoBusca = new RegExp(`${meses[i]}\\d*[:\\s]+([\\d.,]+)`, 'i')
    const match = texto.match(padraoBusca)

    if (match) {
      const consumo = Math.round(parseFloat(match[1].replace(',', '.')))
      historico.push({
        mes: meses[i],
        consumo: consumo,
        indice: i + 1
      })
      somaConsumo += consumo
    }
  }

  // Se encontrou 12 meses, retorna o histórico
  if (historico.length === 12) {
    return {
      historico: historico,
      mediaAnual: Math.round(somaConsumo / 12),
      periodoMeses: 12
    }
  }

  // Se encontrou menos, retorna o que achou
  if (historico.length > 0) {
    return {
      historico: historico,
      mediaAnual: historico.length > 0 ? Math.round(somaConsumo / historico.length) : null,
      periodoMeses: historico.length
    }
  }

  return null
}

function extrairValor(texto) {
  // Procura por valores em R$
  const padroes = [
    /total\s*(?:a\s*pagar|devido).*?r\$\s*([\d.,]+)/,
    /valor\s*total.*?r\$\s*([\d.,]+)/,
    /r\$\s*([\d.,]+)(?=\s*$)/m,
  ]

  for (const padrao of padroes) {
    const match = texto.match(padrao)
    if (match) {
      return parseFloat(match[1].replace('.', '').replace(',', '.'))
    }
  }
  return null
}

function extrairDistribuidora(texto) {
  // Nomes comuns de distribuidoras brasileiras
  const distribuidoras = [
    { nome: 'Cosern', padrao: /cosern/ },
    { nome: 'Enel', padrao: /enel|energisa/ },
    { nome: 'Cemig', padrao: /cemig/ },
    { nome: 'Light', padrao: /light/ },
    { nome: 'CPFL', padrao: /cpfl/ },
    { nome: 'Eletropaulo', padrao: /eletropaulo/ },
    { nome: 'EDP', padrao: /edp|energisa/ },
    { nome: 'Neoenergia', padrao: /neoenergia/ },
  ]

  for (const { nome, padrao } of distribuidoras) {
    if (padrao.test(texto)) {
      return nome
    }
  }
  return null
}

function extrairEndereco(texto) {
  // Estratégia: procurar por "ENDEREÇO:" do cliente (não da empresa)
  // Ignorar linhas com "COMPANHIA ENERGÉTICA", "RUA MERMOZ", etc.

  const linhas = texto.split('\n')

  // Procurar pelo padrão "ENDEREÇO:" seguido do endereço do cliente
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim()

    // Pular linhas da companhia energética
    if (
      linha.includes('COMPANHIA ENERGÉTICA') ||
      linha.includes('RUA MERMOZ') ||
      linha.includes('BALDO') ||
      linha.includes('CNPJ')
    ) {
      continue
    }

    // Procurar por "ENDEREÇO:" seguido de endereço válido
    if (
      linha.includes('ENDEREÇO') ||
      linha.match(/^(?:rua|avenida|av\.?|alameda|travessa|pça|praça|rodovia|via|trav|rod|estrada|praia|lote|lota|sítio|servidão|beco|beco|conjunto|condomínio|cond\.)/i)
    ) {
      // Extrair a linha e as próximas se necessário
      let enderecoCompleto = linha.replace(/^ENDEREÇO[:\s]*/i, '').trim()

      // Se a linha não tem número, tentar próxima linha
      if (!enderecoCompleto.match(/\d+/)) {
        if (i + 1 < linhas.length) {
          const proximaLinha = linhas[i + 1].trim()
          if (!proximaLinha.includes('CÓDIGO') && proximaLinha.length < 100) {
            enderecoCompleto += ' ' + proximaLinha
          }
        }
      }

      // Validar: deve conter logradouro e número
      if (enderecoCompleto.match(/(?:rua|avenida|av\.?|alameda|travessa|pça|praça|estrada|rodovia|via|praia|lote|lota|sítio|servidão|beco|beco|conjunto|condomínio|cond\.)/i) &&
          enderecoCompleto.match(/\d+/)) {
        return enderecoCompleto.replace(/\s+/g, ' ').trim()
      }
    }
  }

  return null
}
