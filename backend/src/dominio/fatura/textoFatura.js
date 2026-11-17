/**
 * textoFatura — extração DETERMINÍSTICA dos dados de uma fatura a partir do
 * TEXTO (pdf-parse). Puro: sem I/O, sem IA, sem Express.
 *
 * Saiu de controllers/faturaController.js sem mudança de comportamento, para ser
 * testável com fixture sintética (nenhuma fatura real entra no repositório).
 */
import { obterIrradianciaCity, obterIrradianciaFallback } from '../../data/irradianciaRN.js'

/** Texto da fatura → objeto devolvido por POST /api/fatura/extrair (caminho PDF). */
export function extrairDadosDoTexto(textoOriginal) {
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
  return dados
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

/** UC no formato da REN 1.095/2024: NNN.NNN.NNN-NN. */
const FORMATO_UC = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/

function extrairNumeroCliente(linhas) {
  // Formato ATUAL: rótulo "NÚMERO DA UNIDADE CONSUMIDORA" e o valor
  // NNN.NNN.NNN-NN na mesma linha ou na seguinte. Só aceita esse formato:
  // código de débito (9 dígitos), medidor (10) e chave de acesso (44) ficam
  // na mesma página e não podem ser confundidos com a UC.
  const idxUc = findLine(linhas, /N[ÚU]MERO\s*DA\s*UNIDADE\s*CONSUMIDORA/i)
  if (idxUc >= 0) {
    const mesma = linhas[idxUc].match(/CONSUMIDORA\s*:?\s*(\d{3}\.\d{3}\.\d{3}-\d{2})\b/i)
    if (mesma) return mesma[1]
    const val = nextLine(linhas, idxUc)
    if (val && FORMATO_UC.test(val)) return val
  }

  // Formato LEGADO COSERN: rótulo "CÓDIGO DO CLIENTE" na linha N, número na N+1
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
  // P1-TENSAO-380V-PARSER-01: detecta voltagem explícita na linha (440V, 380V, 220V, 127V)
  const tensaoNaLinha = (linha) => {
    const m = linha.match(/\b(440|380|220|127)\s*V\b/i)
    return m ? m[1] : null
  }

  // COSERN: "TIPO DE FORNECIMENTO: Conv. Monômia - Trifásico 380V"
  // Verifica a linha com o rótulo E a próxima linha (layout com quebra)
  for (let i = 0; i < linhas.length; i++) {
    if (/TIPO\s*DE\s*FORNECIMENTO/i.test(linhas[i])) {
      const candidatas = [linhas[i], linhas[i + 1] || '']
      for (const l of candidatas) {
        const v = tensaoNaLinha(l)
        if (/TRIF[AÁ]SICO/i.test(l)) return `Trifásico ${v || '380'}V`
        if (/BIF[AÁ]SICO/i.test(l)) return `Bifásico ${v || '220'}V`
        if (/MONOF[AÁ]SICO/i.test(l)) return `Monofásico ${v || '220'}V`
      }
    }
  }

  // Busca livre: procura tensão explícita na linha que contém o tipo de ligação
  const linhaTipo = linhas.find(l => /TRIF[AÁ]SICO|BIF[AÁ]SICO|MONOF[AÁ]SICO/i.test(l))
  const tensaoExplicita = linhaTipo ? tensaoNaLinha(linhaTipo) : null

  const redeNeo = ['COSERN','COELBA','CELPE','ELEKTRO','NEOENERGIA']
  const isNeo = redeNeo.includes(distribuidora)

  if (/TRIF[AÁ]SICO/i.test(textoOriginal)) {
    // Prioridade: tensão explícita no texto; fallback: 380V (padrão BR para trifásico)
    const v = tensaoExplicita || '380'
    return `Trifásico ${v}V`
  }
  if (/BIF[AÁ]SICO/i.test(textoOriginal)) return 'Bifásico 220V'
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
  let historico = []
  let somaConsumo = 0

  // COSERN: "MAR26 438 30" (mês+ano consumo dias). Consumo pode vir com
  // separador de milhar ("1.050") — antes esse mês era descartado em silêncio.
  const comAno = []
  for (const linha of linhas) {
    for (let i = 0; i < meses.length; i++) {
      const m = linha.match(new RegExp(`^(${meses[i]})(\\d{2})\\s+(\\d{1,3}(?:\\.\\d{3})+|\\d+)\\s+\\d+$`, 'i'))
      if (m) {
        const consumo = parseInt(m[3].replace(/\./g, ''), 10)
        // Ignorar valores claramente errados (ex: 30 que é número de dias padrão)
        if (consumo > 10) comAno.push({ mes: meses[i], ano: m[2], consumo, indice: i + 1 })
      }
    }
  }

  /**
   * A COSERN imprime 13 pontos: o mês atual e o mesmo mês do ano anterior. A
   * média anual usa só os 12 MAIS RECENTES — com 13, o mês repetido pesa duas
   * vezes e a média desvia (fatura real: 383,7 com 13 × 387,2 com 12).
   * Ordena por ano/mês (não confia na ordem do texto) e descarta mês repetido.
   */
  if (comAno.length > 0) {
    const chave = (h) => Number(h.ano) * 100 + h.indice
    const vistos = new Set()
    historico = [...comAno]
      .sort((a, b) => chave(b) - chave(a))
      .filter((h) => (vistos.has(chave(h)) ? false : vistos.add(chave(h))))
      .slice(0, 12)
    somaConsumo = historico.reduce((s, h) => s + h.consumo, 0)
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

export function mapeiaGrupoTarifario(classificacao) {
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

export function extrairFaseETensao(tipoLigacao) {
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

