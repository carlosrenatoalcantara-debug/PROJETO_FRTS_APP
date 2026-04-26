export const calcularDimensionamentoAuto = (consumoMensal, irradiancia = 5.5) => {
  const consumoDiario = consumoMensal / 30
  const potenciaIdealkWp = (consumoDiario / irradiancia) * 1.2

  const potenciaArredondada = Math.ceil(potenciaIdealkWp / 5) * 5

  const potenciaPainelW = 550
  const numPaineis = Math.ceil((potenciaArredondada * 1000) / potenciaPainelW)

  const potenciaInversorMax = potenciaArredondada * 1.3
  const inversoresDisponiveis = [3, 5, 8, 10, 15, 20, 25, 30]
  const numInversores = inversoresDisponiveis.find(inv => inv >= (potenciaArredondada / 1.3)) || 1

  const modulosPorString = 13
  const numStrings = Math.ceil(numPaineis / modulosPorString)

  const geracaoMensalEstimada = (potenciaArredondada * irradiancia * 30 * 0.75)

  const tarifaMedia = 1.50
  const economiaAnual = geracaoMensalEstimada * 12 * tarifaMedia

  const payback = (potenciaArredondada * 12000) / economiaAnual

  return {
    consumoDiario: consumoDiario.toFixed(1),
    potenciaIdealkWp: potenciaIdealkWp.toFixed(2),
    potenciaArredondada,
    numPaineis,
    numInversores,
    numStrings,
    potenciaPainelW,
    geracaoMensalEstimada: geracaoMensalEstimada.toFixed(0),
    economiaAnual: economiaAnual.toFixed(0),
    payback: payback.toFixed(1),
  }
}

export const selecionarKitsAuto = (potenciakWp) => {
  const precosPorKW = {
    economico: 8000,
    balanceado: 10000,
    premium: 12000,
  }

  const kits = [
    {
      nome: 'ECONÔMICO',
      tag: 'economico',
      subtitulo: 'Melhor custo/Wp',
      precoUnitariokWp: precosPorKW.economico,
      precoTotal: potenciakWp * precosPorKW.economico,
      paineis: {
        modelo: 'JINKO JKM-550W',
        potenciaW: 550,
        quantidade: Math.ceil((potenciakWp * 1000) / 550),
        precoUnitario: 1200,
      },
      inversor: {
        modelo: 'FRONIUS SYMO GEN24 PLUS',
        potenciaKW: Math.ceil(potenciakWp / 1.3),
        quantidade: 1,
        precoUnitario: 8000,
      },
      payback: (potenciakWp * precosPorKW.economico) / (potenciakWp * 5.5 * 0.75 * 12 * 1.50),
    },
    {
      nome: 'BALANCEADO',
      tag: 'balanceado',
      subtitulo: 'Melhor custo-benefício (Recomendado)',
      precoUnitariokWp: precosPorKW.balanceado,
      precoTotal: potenciakWp * precosPorKW.balanceado,
      paineis: {
        modelo: 'CANADIAN SOLAR HiKu7 585W',
        potenciaW: 585,
        quantidade: Math.ceil((potenciakWp * 1000) / 585),
        precoUnitario: 1400,
      },
      inversor: {
        modelo: 'FRONIUS SYMO GEN24 PLUS',
        potenciaKW: Math.ceil(potenciakWp / 1.3),
        quantidade: 1,
        precoUnitario: 8500,
      },
      payback: (potenciakWp * precosPorKW.balanceado) / (potenciakWp * 5.5 * 0.75 * 12 * 1.50),
    },
    {
      nome: 'PREMIUM',
      tag: 'premium',
      subtitulo: 'Maior eficiência',
      precoUnitariokWp: precosPorKW.premium,
      precoTotal: potenciakWp * precosPorKW.premium,
      paineis: {
        modelo: 'LONGI Hi-Mo 6 600W',
        potenciaW: 600,
        quantidade: Math.ceil((potenciakWp * 1000) / 600),
        precoUnitario: 1600,
      },
      inversor: {
        modelo: 'VICTRON MULTIPLUS-II',
        potenciaKW: Math.ceil(potenciakWp / 1.3),
        quantidade: 1,
        precoUnitario: 9500,
      },
      payback: (potenciakWp * precosPorKW.premium) / (potenciakWp * 5.5 * 0.82 * 12 * 1.50),
    },
  ]

  return kits.map(kit => ({
    ...kit,
    payback: kit.payback.toFixed(1),
    precoTotal: Math.round(kit.precoTotal),
    precoUnitario: kit.paineis.precoUnitario,
  }))
}

export const gerarOrcamentoAuto = (kit, configuracoes = {}) => {
  const {
    margemLucro = 20,
    precoMaoDObra = 50,
    percentualMateriais = 15,
    percentualProjeto = 5,
    percentualImpostos = 8,
  } = configuracoes

  const custoKit = kit.precoTotal
  const custoPaineis = kit.paineis.precoUnitario * kit.paineis.quantidade
  const custoInversor = kit.inversor.precoUnitario * kit.inversor.quantidade
  const custoMaoDObra = precoMaoDObra * kit.paineis.quantidade
  const custoMateriais = custoKit * (percentualMateriais / 100)
  const custoProjeto = custoKit * (percentualProjeto / 100)
  const custoImpostos = (custoKit + custoMaoDObra + custoMateriais + custoProjeto) * (percentualImpostos / 100)

  const subtotalSemMargem = custoKit + custoMaoDObra + custoMateriais + custoProjeto + custoImpostos
  const margemValor = subtotalSemMargem * (margemLucro / 100)
  const totalFinal = subtotalSemMargem + margemValor

  const potenciakWp = kit.precoTotal / kit.precoUnitariokWp
  const precoWp = (totalFinal / (potenciakWp * 1000)).toFixed(2)

  return {
    itens: [
      { descricao: 'Kit Belenergy (painéis + inversor + estrutura)', valor: custoKit, percentual: (custoKit / totalFinal * 100).toFixed(1) },
      { descricao: 'Mão de obra instalação', valor: custoMaoDObra, percentual: (custoMaoDObra / totalFinal * 100).toFixed(1) },
      { descricao: 'Materiais elétricos (cabos, proteções)', valor: custoMateriais, percentual: (custoMateriais / totalFinal * 100).toFixed(1) },
      { descricao: 'Projeto elétrico e ART', valor: custoProjeto, percentual: (custoProjeto / totalFinal * 100).toFixed(1) },
      { descricao: 'Impostos e taxas', valor: custoImpostos, percentual: (custoImpostos / totalFinal * 100).toFixed(1) },
    ],
    subtotal: Math.round(subtotalSemMargem),
    margem: {
      percentual: margemLucro,
      valor: Math.round(margemValor),
    },
    total: Math.round(totalFinal),
    precoWp,
    detalhesEquipamentos: {
      paineis: `${kit.paineis.quantidade} × ${kit.paineis.modelo}`,
      inversor: `${kit.inversor.quantidade} × ${kit.inversor.modelo}`,
    },
  }
}

export const calcularPayback = (investimento, economiaAnual) => {
  const anos = investimento / economiaAnual
  const meses = (anos % 1) * 12
  return {
    anos: Math.floor(anos),
    meses: Math.round(meses),
    total: anos.toFixed(1),
  }
}
