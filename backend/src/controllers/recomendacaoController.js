import { PAINEIS } from '../data/catalogoPaineis.js'
import { INVERSORES } from '../data/catalogoInversores.js'

function vocPorTemperatura(modulo, tempMin = -2) {
  const coef = modulo.tempCoefVoc ?? -0.28
  const fator = 1 + (coef / 100) * (tempMin - 25)
  return modulo.voc * fator
}

function validarCombinacao(painel, inversor, numPaineis) {
  const erros = []
  
  const vocFrio = vocPorTemperatura(painel, -2)
  const vocString = vocFrio * numPaineis
  const vmpString = painel.vmpp * numPaineis

  if (vocString > inversor.vocMax) {
    erros.push('Voc acima do limite')
  }
  if (vmpString < inversor.mpptMin || vmpString > inversor.mpptMax) {
    erros.push('Vmpp fora do range MPPT')
  }

  return { valido: erros.length === 0, erros }
}

function gerarCombinacoes(consumoKwh, areaDisponivel, orcamentoMax) {
  const combinacoes = []
  
  const consumoDiario = consumoKwh / 30
  const consumoHoras = consumoDiario / 5
  
  for (const painel of PAINEIS) {
    for (const inversor of INVERSORES) {
      const potenciaRequeridaKw = consumoHoras
      const numPainelsBruto = Math.ceil((potenciaRequeridaKw * 1000) / painel.pmpp)
      
      const areaRequerida = numPainelsBruto * painel.area
      if (areaRequerida > areaDisponivel * 1.3) continue
      
      const numInversores = Math.ceil((numPainelsBruto * painel.pmpp) / (inversor.potenciaKW * 1000 * 0.8))
      
      const custoTotal = (numPainelsBruto * painel.precoUnitario) + (numInversores * inversor.precoUnitario)
      if (orcamentoMax && custoTotal > orcamentoMax * 1.2) continue
      
      const validacao = validarCombinacao(painel, inversor, numPainelsBruto)
      
      combinacoes.push({
        painel,
        inversor,
        numPaineis: numPainelsBruto,
        numInversores,
        areaRequerida: +areaRequerida.toFixed(2),
        potenciaKwp: +(numPainelsBruto * painel.pmpp / 1000).toFixed(2),
        custoEstimado: custoTotal,
        valido: validacao.valido,
        erros: validacao.erros,
      })
    }
  }

  return combinacoes
}

function calcularPontuacao(combo) {
  let pontos = 0

  pontos += combo.potenciaKwp * 50
  pontos += (100 - combo.numPaineis) * 0.5
  pontos -= combo.numInversores * 20
  
  if (!combo.valido) pontos -= 1000

  return pontos
}

export function recomendarSistema(req, res) {
  try {
    const { consumo, area_disponivel, orcamento_max } = req.body

    if (!consumo || Number(consumo) <= 0) {
      return res.status(400).json({ erro: 'Campo "consumo" obrigatório e deve ser > 0.' })
    }
    if (!area_disponivel || Number(area_disponivel) <= 0) {
      return res.status(400).json({ erro: 'Campo "area_disponivel" obrigatório e deve ser > 0.' })
    }

    const consumoKwh = Number(consumo)
    const area = Number(area_disponivel)
    const orcamento = orcamento_max ? Number(orcamento_max) : null

    const combinacoes = gerarCombinacoes(consumoKwh, area, orcamento)

    if (!combinacoes.length) {
      return res.status(400).json({ erro: 'Nenhuma combinação válida encontrada para os parâmetros informados.' })
    }

    const combosComPontos = combinacoes.map(combo => ({
      ...combo,
      pontuacao: calcularPontuacao(combo),
    }))

    combosComPontos.sort((a, b) => b.pontuacao - a.pontuacao)

    const melhor = combosComPontos[0]
    const alternativas = combosComPontos.slice(1, 4)

    const formatarResposta = (combo) => ({
      painel: {
        marca: combo.painel.marca,
        modelo: combo.painel.modelo,
        potencia: combo.painel.pmpp,
      },
      inversor: {
        marca: combo.inversor.marca,
        modelo: combo.inversor.modelo,
        potencia: combo.inversor.potenciaKW,
      },
      numPaineis: combo.numPaineis,
      numInversores: combo.numInversores,
      potenciaKwp: combo.potenciaKwp,
      areaRequerida: combo.areaRequerida,
      custoEstimado: Math.round(combo.custoEstimado),
      pontuacao: +combo.pontuacao.toFixed(1),
    })

    res.json({
      melhor: formatarResposta(melhor),
      justificativa: `Melhor relação custo-benefício: ${melhor.potenciaKwp} kWp com ${melhor.numPaineis} painéis`,
      alternativas: alternativas.map(formatarResposta),
    })
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
}
