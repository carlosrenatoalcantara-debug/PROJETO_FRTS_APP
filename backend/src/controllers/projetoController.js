// Orquestrador central que coordena a simulação completa de um projeto

async function simularProjetoCompleto(req, res) {
  try {
    const input = req.body

    // Validações básicas
    if (!input) {
      return res.status(400).json({ erro: 'Corpo da requisição vazio.' })
    }

    const resultado = {
      carga: null,
      strings: null,
      validacao: null,
      sombreamento: null,
      bess: null,
      financeiro: null,
      recomendacao: null,
    }

    // 1. Analisar carga
    if (input.carga) {
      try {
        resultado.carga = analisarCargaLocal(input.carga)
      } catch (e) {
        resultado.carga = null
      }
    }

    // 2. Gerar strings
    if (input.strings && input.strings.modulo && input.strings.inversor && input.strings.modulos) {
      try {
        resultado.strings = gerarStringsLocal(
          input.strings.modulos,
          input.strings.modulo,
          input.strings.inversor,
          input.strings.tempMin ?? -2
        )
      } catch (e) {
        resultado.strings = null
      }
    }

    // 3. Validar sistema
    if (input.validacao && resultado.strings) {
      try {
        resultado.validacao = validarSistemaLocal(
          resultado.strings.strings,
          input.validacao.modulo || input.strings.modulo,
          input.validacao.inversor || input.strings.inversor,
          input.validacao.temperatura
        )
      } catch (e) {
        resultado.validacao = null
      }
    }

    // 4. Calcular sombreamento
    if (input.sombreamento && input.sombreamento.altura && input.sombreamento.distancia) {
      try {
        resultado.sombreamento = calcularSombreamentoLocal(
          input.sombreamento.altura,
          input.sombreamento.distancia,
          input.sombreamento.latitude,
          input.sombreamento.inclinacao
        )
      } catch (e) {
        resultado.sombreamento = null
      }
    }

    // 5. Dimensionar BESS (se houver dados de bateria)
    if (input.bess && input.bess.carga_kw && input.bess.horas_backup) {
      try {
        resultado.bess = dimensionarBESSLocal(input.bess.carga_kw, input.bess.horas_backup)
      } catch (e) {
        resultado.bess = null
      }
    }

    // 6. Simular financeiro (sempre calcular se houver dados)
    if (input.financeiro && input.financeiro.investimento && input.financeiro.economia_anual) {
      try {
        resultado.financeiro = simularFinanceiroLocal(
          input.financeiro.investimento,
          input.financeiro.economia_anual,
          input.financeiro.inflacao_energia ?? 0.08,
          input.financeiro.taxa_desconto ?? 0.10
        )
      } catch (e) {
        resultado.financeiro = null
      }
    }

    // 7. Gerar recomendação (se houver dados de carga e área)
    if (input.recomendacao && input.recomendacao.consumo && input.recomendacao.area_disponivel) {
      try {
        resultado.recomendacao = recomendarSistemaLocal(
          input.recomendacao.consumo,
          input.recomendacao.area_disponivel,
          input.recomendacao.orcamento_max
        )
      } catch (e) {
        resultado.recomendacao = null
      }
    }

    res.json(resultado)
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
}

// ── Funções locais que implementam a lógica (não chamam endpoints) ──────────

function analisarCargaLocal(config) {
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

  // Modo 1: consumo mensal único
  if (config.consumo_mensal) {
    const valor = Number(config.consumo_mensal)
    if (isNaN(valor) || valor <= 0) throw new Error('Consumo mensal inválido.')
    return {
      fonte: 'entrada_manual',
      potencia_media: valor,
      potencia_maxima: valor * 1.2,
      perfil: MESES.map((mes, i) => ({
        mes,
        consumo: Math.round(valor * (0.9 + Math.random() * 0.2)),
      })),
    }
  }

  // Modo 2: array de 12 meses
  if (Array.isArray(config.consumo_mensal)) {
    const vals = config.consumo_mensal.map(Number).filter(v => !isNaN(v) && v >= 0)
    if (!vals.length) throw new Error('Nenhum valor de consumo válido.')
    while (vals.length < 12) vals.push(vals[vals.length - 1] ?? 0)
    const perfil = vals.slice(0, 12)
    return {
      fonte: 'conta_energia',
      potencia_media: Math.round(perfil.reduce((a, b) => a + b) / perfil.length),
      potencia_maxima: Math.max(...perfil),
      perfil: MESES.map((mes, i) => ({ mes, consumo: perfil[i] })),
    }
  }

  throw new Error('Forneça "consumo_mensal" (número ou array de 12 meses).')
}

function gerarStringsLocal(modulos, modulo, inversor, tempMin = -2) {
  if (!modulo || !inversor || !modulos) {
    throw new Error('Parâmetros insuficientes para gerar strings.')
  }

  const numModulos = Number(modulos)
  if (isNaN(numModulos) || numModulos <= 0) {
    throw new Error('Número de módulos inválido.')
  }

  function vocPorTemperatura(mod, tMin) {
    const coef = mod.tempCoefVoc ?? -0.28
    const fator = 1 + (coef / 100) * (tMin - 25)
    return mod.voc * fator
  }

  const vocFrio = vocPorTemperatura(modulo, Number(tempMin))
  const maxPorVoc = Math.floor(inversor.vocMax / vocFrio)
  const minPorMPPT = Math.ceil(inversor.mpptMin / modulo.vmpp)
  const maxPorMPPT = Math.floor(inversor.mpptMax / modulo.vmpp)
  const maxPorString = Math.min(maxPorVoc, maxPorMPPT)
  const minPorString = minPorMPPT

  if (maxPorString < minPorString) {
    throw new Error('Combinação módulo-inversor incompatível.')
  }

  let melhorPps = maxPorString, melhorSobra = Infinity
  for (let pps = maxPorString; pps >= minPorString; pps--) {
    const sobra = numModulos % pps
    if (sobra < melhorSobra) { melhorSobra = sobra; melhorPps = pps }
  }

  const paineisPorString = melhorPps
  const totalStrings = Math.ceil(numModulos / paineisPorString)
  const totalModulos = totalStrings * paineisPorString

  const maxStringsPorMPPT = Math.floor(inversor.nStringsTotal / inversor.nMppts)
  const stringsArr = []
  let restantes = totalStrings
  for (let m = 1; m <= inversor.nMppts && restantes > 0; m++) {
    const s = Math.min(maxStringsPorMPPT, restantes)
    for (let k = 0; k < s; k++) {
      stringsArr.push({ mppt: m, modulos: paineisPorString })
    }
    restantes -= s
  }

  const vocString = vocFrio * paineisPorString
  const vmpString = modulo.vmpp * paineisPorString
  const potDC = totalModulos * modulo.pmpp
  const potAC = inversor.potenciaKW * 1000
  const oversizing = (potDC / potAC) * 100

  return {
    strings: stringsArr,
    paineisPorString,
    totalStrings,
    totalModulos,
    vocFrio: +vocString.toFixed(1),
    vmpString: +vmpString.toFixed(1),
    oversizing: +oversizing.toFixed(1),
    potenciaRealKwp: +(potDC / 1000).toFixed(2),
    alertas: [],
    erros: vocString > inversor.vocMax ? ['Voc em frio acima do limite'] : [],
  }
}

function validarSistemaLocal(strings, modulo, inversor, temperatura = {}) {
  if (!strings?.length || !modulo || !inversor) {
    throw new Error('Parâmetros insuficientes para validar.')
  }

  const tempMin = Number(temperatura.min ?? -2)
  const modulosPorString = strings[0]?.modulos ?? 0
  const coef = modulo.tempCoefVoc ?? -0.28
  const fatorTemp = 1 + (coef / 100) * (tempMin - 25)
  const vocFrio = modulo.voc * fatorTemp
  const vocString = vocFrio * modulosPorString
  const vmpString = modulo.vmpp * modulosPorString

  const erros = []
  const alertas = []

  if (vocString > inversor.vocMax) {
    erros.push(`Voc frio (${vocString.toFixed(0)}V) > Voc_max (${inversor.vocMax}V)`)
  }
  if (vmpString < inversor.mpptMin || vmpString > inversor.mpptMax) {
    erros.push(`Vmpp (${vmpString.toFixed(0)}V) fora da faixa MPPT`)
  }

  return {
    valido: erros.length === 0,
    alertas,
    erros,
    detalhes: {
      vocFrio: +vocString.toFixed(1),
      vmpString: +vmpString.toFixed(1),
    },
  }
}

function calcularSombreamentoLocal(altura, distancia, latitude = -15, inclinacao = 20) {
  const h = Number(altura)
  const d = Number(distancia)
  const lat = Math.abs(Number(latitude) || 15)

  if (h <= 0 || d <= 0) throw new Error('Altura e distância devem ser > 0.')

  const declinacao = 23.45
  const elevNoonDeg = 90 - lat - declinacao
  const elevNoonRad = Math.max(0.01, elevNoonDeg) * Math.PI / 180
  const distanciaMinima = h / Math.tan(elevNoonRad)

  if (d >= distanciaMinima) {
    return {
      perda_percentual: 0,
      distanciaMinima: +distanciaMinima.toFixed(2),
      distanciaAtual: +d.toFixed(2),
      sem_sombra_ao_meio_dia: true,
      classificacao: 'adequada',
      descricao: 'Distância entre fileiras adequada. Sem sombreamento ao meio-dia solar.',
    }
  }

  const fracao = (distanciaMinima - d) / distanciaMinima
  const perda = Math.min(32, fracao * 18 * 1.25)

  return {
    perda_percentual: +perda.toFixed(1),
    distanciaMinima: +distanciaMinima.toFixed(2),
    distanciaAtual: +d.toFixed(2),
    fracaoDeficite: +fracao.toFixed(2),
    sem_sombra_ao_meio_dia: false,
    classificacao: fracao < 0.2 ? 'atencao' : fracao < 0.5 ? 'problema' : 'critico',
    descricao: `Sombreamento estimado: ${perda.toFixed(1)}%`,
  }
}

function dimensionarBESSLocal(carga_kw, horas_backup) {
  const cargaKW = Number(carga_kw)
  const horasBackup = Number(horas_backup)

  if (isNaN(cargaKW) || cargaKW <= 0) throw new Error('Carga em kW deve ser > 0.')
  if (isNaN(horasBackup) || horasBackup <= 0) throw new Error('Horas de backup deve ser > 0.')

  const capacidadeKWh = +((cargaKW * horasBackup) / 0.8).toFixed(2)
  const potenciaKW = +cargaKW.toFixed(2)
  const autonomiaHoras = +horasBackup.toFixed(1)

  return {
    capacidade_kwh: capacidadeKWh,
    potencia_kw: potenciaKW,
    autonomia: autonomiaHoras,
  }
}

function calcularTIRLocal(fluxos) {
  let low = -0.99, high = 10.0
  for (let i = 0; i < 300; i++) {
    const mid = (low + high) / 2
    let npv = 0
    for (let t = 0; t < fluxos.length; t++) {
      npv += fluxos[t] / Math.pow(1 + mid, t)
    }
    if (Math.abs(npv) < 0.5) return mid
    npv > 0 ? (low = mid) : (high = mid)
  }
  return (low + high) / 2
}

function simularFinanceiroLocal(investimento, economia_anual, inflacao_energia = 0.08, taxa_desconto = 0.10) {
  const inv = Number(investimento)
  const econAnual = Number(economia_anual)
  const inflacao = Number(inflacao_energia)
  const taxa = Number(taxa_desconto)
  const periodos = 25

  if (isNaN(inv) || inv <= 0) throw new Error('Investimento deve ser > 0.')
  if (isNaN(econAnual) || econAnual <= 0) throw new Error('Economia anual deve ser > 0.')

  const fluxos = [-inv]
  const fluxoCaixa = []
  let saldoAcumulado = -inv
  let saldoDescontado = -inv
  let paybackSimples = null

  for (let ano = 1; ano <= periodos; ano++) {
    const fatorInflacao = Math.pow(1 + inflacao, ano - 1)
    const economia = econAnual * fatorInflacao

    saldoAcumulado += economia

    const vp = economia / Math.pow(1 + taxa, ano)
    saldoDescontado += vp

    if (saldoAcumulado >= 0 && !paybackSimples) {
      paybackSimples = ano
    }

    fluxos.push(economia)
    fluxoCaixa.push({
      ano,
      economia: +economia.toFixed(2),
      saldoAcumulado: +saldoAcumulado.toFixed(2),
      valorPresente: +vp.toFixed(2),
      saldoDescontado: +saldoDescontado.toFixed(2),
    })
  }

  const tir = calcularTIRLocal(fluxos)
  const vpl = saldoDescontado

  return {
    payback: paybackSimples ?? `> ${periodos}`,
    tir: +(tir * 100).toFixed(2),
    vpl: +vpl.toFixed(2),
    fluxo_caixa: fluxoCaixa,
  }
}

function recomendarSistemaLocal(consumoKwh, areaDisponivel, orcamentoMax = null) {
  // Catálogos simplificados
  const painelsPequenos = [
    { marca: 'Canadian Solar', modelo: 'CS400', pmpp: 400, area: 1.75, precoUnitario: 680 },
    { marca: 'LONGi', modelo: 'LR450', pmpp: 450, area: 2.0, precoUnitario: 760 },
    { marca: 'BYD', modelo: 'BYD415', pmpp: 415, area: 1.72, precoUnitario: 660 },
  ]

  const painelsGrandes = [
    { marca: 'Risen', modelo: 'RSM550', pmpp: 550, area: 2.26, precoUnitario: 820 },
    { marca: 'JA Solar', modelo: 'JAM550', pmpp: 550, area: 2.27, precoUnitario: 800 },
    { marca: 'Trina Solar', modelo: 'TSM610', pmpp: 610, area: 2.58, precoUnitario: 980 },
  ]

  const inversoresString = [
    { marca: 'Growatt', modelo: 'MOD5000TL3', potenciaKW: 5, precoUnitario: 2800 },
    { marca: 'Sungrow', modelo: 'SG5', potenciaKW: 5, precoUnitario: 3100 },
    { marca: 'Sungrow', modelo: 'SG10', potenciaKW: 10, precoUnitario: 7800 },
  ]

  const consumoDiario = consumoKwh / 30
  const consumoHoras = consumoDiario / 5

  const combinacoes = []

  for (const painel of [...painelsPequenos, ...painelsGrandes]) {
    for (const inversor of inversoresString) {
      const numPainelsBruto = Math.ceil((consumoHoras * 1000) / painel.pmpp)
      const areaRequerida = numPainelsBruto * painel.area

      if (areaRequerida > areaDisponivel * 1.3) continue

      const numInversores = Math.ceil((numPainelsBruto * painel.pmpp) / (inversor.potenciaKW * 1000 * 0.8))
      const custoTotal = (numPainelsBruto * painel.precoUnitario) + (numInversores * inversor.precoUnitario)

      if (orcamentoMax && custoTotal > orcamentoMax * 1.2) continue

      const potenciaKwp = +(numPainelsBruto * painel.pmpp / 1000).toFixed(2)

      let pontos = potenciaKwp * 50 + (100 - numPainelsBruto) * 0.5 - numInversores * 20

      combinacoes.push({
        painel,
        inversor,
        numPaineis: numPainelsBruto,
        numInversores,
        potenciaKwp,
        areaRequerida: +areaRequerida.toFixed(2),
        custoEstimado: Math.round(custoTotal),
        pontuacao: +pontos.toFixed(1),
      })
    }
  }

  if (!combinacoes.length) {
    throw new Error('Nenhuma combinação válida para os parâmetros')
  }

  combinacoes.sort((a, b) => b.pontuacao - a.pontuacao)

  const melhor = combinacoes[0]

  return {
    melhor: {
      painel: `${melhor.painel.marca} ${melhor.painel.modelo}`,
      inversor: `${melhor.inversor.marca} ${melhor.inversor.modelo}`,
      numPaineis: melhor.numPaineis,
      numInversores: melhor.numInversores,
      potenciaKwp: melhor.potenciaKwp,
      custoEstimado: melhor.custoEstimado,
    },
    justificativa: `${melhor.potenciaKwp} kWp com ${melhor.numPaineis} painéis — melhor relação custo-benefício`,
    alternativas: combinacoes.slice(1, 3).map(c => ({
      painel: `${c.painel.marca} ${c.painel.modelo}`,
      inversor: `${c.inversor.marca} ${c.inversor.modelo}`,
      numPaineis: c.numPaineis,
      potenciaKwp: c.potenciaKwp,
      custoEstimado: c.custoEstimado,
    })),
  }
}

export { simularProjetoCompleto }
