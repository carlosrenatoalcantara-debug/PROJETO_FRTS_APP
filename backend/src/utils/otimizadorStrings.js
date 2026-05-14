/**
 * Otimizador de Strings - Calcula a melhor configuração de strings
 * baseado nas características dos painéis e inversores
 */

/**
 * Calcular número de painéis em série compatível com inversor
 *
 * @param {Object} painel - Dados do painel (Voc, Isc, potencia_w)
 * @param {Object} inversor - Dados do inversor (Vpv_max, Ipv_max, potencia_kw)
 * @returns {Object} Configuração otimizada de strings
 */
export function otimizarStrings(painel, inversor) {
  // Default values if specs not available
  const vocPainel = painel.voc || 48 // Tensão em circuito aberto típica
  const iscPainel = painel.isc || 10 // Corrente de curto-circuito típica
  const potenciaPainel = painel.potencia_w || 400

  const vpvMax = inversor.vpv_max || 600 // Tensão máxima do lado DC do inversor
  const ipvMax = inversor.ipv_max || 100 // Corrente máxima de entrada
  const potenciaInversor = (inversor.potencia_kw || 5) * 1000 // Converter para W

  // Calcular número máximo de painéis em série
  // Considerar Voc (tensão máxima quando não há carga)
  // Usar 1.25x como margem de segurança (norma)
  const vocMaximo = vpvMax / 1.25
  const paineisPorSerie = Math.floor(vocMaximo / vocPainel)

  if (paineisPorSerie < 1) {
    console.warn('⚠️  Inversor não compatível com painel - Vpv_max muito baixa')
    return {
      valido: false,
      motivo: 'Inversor não suporta tensão do painel',
      paineisPorSerie: 0,
      numStrings: 0,
      totalPaineis: 0,
    }
  }

  // Potência de uma string
  const potenciaString = potenciaPainel * paineisPorSerie

  // Número máximo de strings baseado na potência do inversor
  // Usar ~20% de margem para perdas e operação eficiente
  const numStringsMaxPotencia = Math.floor(potenciaInversor / potenciaString * 0.8)

  // Número máximo de strings baseado na corrente
  const numStringsMaxCorrente = Math.floor(ipvMax / iscPainel)

  // Usar o menor dos dois
  const numStrings = Math.min(numStringsMaxPotencia, numStringsMaxCorrente, 4)

  if (numStrings < 1) {
    return {
      valido: false,
      motivo: 'Impossível formar strings compatíveis',
      paineisPorSerie,
      numStrings: 0,
      totalPaineis: 0,
    }
  }

  const totalPaineis = paineisPorSerie * numStrings
  const potenciaTotal = potenciaPainel * totalPaineis
  const tensaoNominal = vocPainel * paineisPorSerie * 0.85 // ~85% de Voc
  const correnteTotal = iscPainel * numStrings

  return {
    valido: true,
    paineisPorSerie,
    numStrings,
    totalPaineis,
    potenciaTotal,
    tensaoNominal,
    correnteTotal,
    utilizacaoPotencia: Math.round((potenciaTotal / potenciaInversor) * 100),
    utilizacaoCorrente: Math.round((correnteTotal / ipvMax) * 100),
    strings: Array.from({ length: numStrings }, (_, i) => ({
      numero: i + 1,
      paineis: paineisPorSerie,
      potencia: potenciaString,
      tensao: vocPainel * paineisPorSerie * 0.85,
      corrente: iscPainel,
    })),
  }
}

/**
 * Dividir número total de painéis em strings otimizadas
 *
 * @param {number} totalPaineis - Número total de painéis do parecer
 * @param {Object} painel - Dados do painel
 * @param {Object} inversor - Dados do inversor
 * @returns {Object} Configuração de strings
 */
export function dividirPainelEmStrings(totalPaineis, painel, inversor) {
  const otimizado = otimizarStrings(painel, inversor)

  if (!otimizado.valido) {
    return {
      ...otimizado,
      aviso: 'Não foi possível otimizar. Usando configuração padrão.',
      paineisPorSerie: Math.max(1, Math.ceil(totalPaineis / 4)),
      numStrings: Math.min(4, totalPaineis),
    }
  }

  // Se o total de painéis é menor que o recomendado
  if (totalPaineis < otimizado.totalPaineis) {
    const paineisPorSerie = Math.ceil(totalPaineis / 2)
    return {
      valido: true,
      aviso: `Parecer especifica ${totalPaineis} painéis (menos que o ideal ${otimizado.totalPaineis})`,
      paineisPorSerie,
      numStrings: Math.ceil(totalPaineis / paineisPorSerie),
      totalPaineis,
      potenciaTotal: painel.potencia_w * totalPaineis,
      strings: Array.from({ length: Math.ceil(totalPaineis / paineisPorSerie) }, (_, i) => ({
        numero: i + 1,
        paineis: i === Math.ceil(totalPaineis / paineisPorSerie) - 1
          ? totalPaineis % paineisPorSerie || paineisPorSerie
          : paineisPorSerie,
      })),
    }
  }

  // Se o total é maior, ajustar para número inteiro de strings
  if (totalPaineis > otimizado.totalPaineis) {
    const numStrings = otimizado.numStrings
    const paineisPorSerie = Math.ceil(totalPaineis / numStrings)
    return {
      valido: true,
      aviso: `Parecer especifica ${totalPaineis} painéis. Configurado em ${numStrings} strings de ${paineisPorSerie}.`,
      paineisPorSerie,
      numStrings,
      totalPaineis,
      potenciaTotal: painel.potencia_w * totalPaineis,
      strings: Array.from({ length: numStrings }, (_, i) => ({
        numero: i + 1,
        paineis: i === numStrings - 1
          ? totalPaineis % paineisPorSerie || paineisPorSerie
          : paineisPorSerie,
      })),
    }
  }

  // Caso ideal - usar configuração otimizada
  return otimizado
}

/**
 * Gerar resumo de configuração para o diagrama unifilar
 */
export function gerarResumoPadraoStrings(dados) {
  const { equipamento, quantidade_paineis } = dados

  const painel = {
    potencia_w: equipamento.paineis.potencia_w || 400,
    voc: equipamento.paineis.voc || 48,
    isc: equipamento.paineis.isc || 10,
  }

  const inversor = {
    potencia_kw: equipamento.inversor.potencia_kw || 5,
    vpv_max: equipamento.inversor.vpv_max || 600,
    ipv_max: equipamento.inversor.ipv_max || 100,
  }

  return dividirPainelEmStrings(quantidade_paineis || 20, painel, inversor)
}
