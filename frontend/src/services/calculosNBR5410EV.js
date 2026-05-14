// Cálculos segundo NBR 5410 para instalações de carregadores EV

export function calcularParametrosNBR5410({
  potencia_kw,
  tensao_entrada_v,
  numero_fases,
  comprimento_cabo_m,
  tipo_carregador, // 'AC_Mono', 'AC_Tri', 'DC'
}) {
  const potencia_w = potencia_kw * 1000

  // Cálculo da corrente (I = P / (V × √3 × FP))
  const fator_potencia = 0.95
  const fator_raiz3 = numero_fases === 3 ? Math.sqrt(3) : 1
  const corrente_projeto_a = potencia_w / (tensao_entrada_v * fator_raiz3 * fator_potencia)

  // Aplicar fator de segurança (NBR 5410 - Tabela 32)
  const fator_seguranca = 1.25
  const corrente_maxima_a = corrente_projeto_a * fator_seguranca

  // Seleção de bitola de cabo (NBR 5410)
  // Tabela de bitolas padrão (mm²) e capacidades (A) para cobre, 70°C
  const tabelaCobrecobre = [
    { bitola: 1.5, capacidade_a: 15.5 },
    { bitola: 2.5, capacidade_a: 21 },
    { bitola: 4, capacidade_a: 28 },
    { bitola: 6, capacidade_a: 36 },
    { bitola: 10, capacidade_a: 50 },
    { bitola: 16, capacidade_a: 68 },
    { bitola: 25, capacidade_a: 89 },
    { bitola: 35, capacidade_a: 109 },
    { bitola: 50, capacidade_a: 134 },
    { bitola: 70, capacidade_a: 170 },
    { bitola: 95, capacidade_a: 207 },
    { bitola: 120, capacidade_a: 239 },
    { bitola: 150, capacidade_a: 272 },
    { bitola: 185, capacidade_a: 309 },
    { bitola: 240, capacidade_a: 360 },
  ]

  // Encontrar bitola mínima que suporte a corrente máxima
  let bitola_cabo_mm2 = 2.5
  for (const cabo of tabelaCobrecobre) {
    if (cabo.capacidade_a >= corrente_maxima_a) {
      bitola_cabo_mm2 = cabo.bitola
      break
    }
  }

  // Aplicar fator de correção para temperatura ambiente (NBR 5410 - Tabela 36)
  // Considerando temperatura ambiente de 40°C (fator 0.95)
  const fator_temperatura = 0.95
  const corrente_corrigida_a = corrente_maxima_a / fator_temperatura

  // Recalcular bitola se necessário
  for (const cabo of tabelaCobrecobre) {
    if (cabo.capacidade_a >= corrente_corrigida_a) {
      bitola_cabo_mm2 = cabo.bitola
      break
    }
  }

  // Cálculo da queda de tensão (NBR 5410 - máximo 3% circuitos terminais)
  // ΔU = (ρ × L × I) / S
  // ρ = resistividade do cobre a 70°C = 0.0179 Ω·mm²/m
  const resistividade = 0.0179
  const corrente_para_queda = corrente_projeto_a
  const queda_tensao_v = (resistividade * comprimento_cabo_m * corrente_para_queda) / bitola_cabo_mm2
  const queda_tensao_pct = (queda_tensao_v / tensao_entrada_v) * 100

  // Se queda > 3%, aumentar bitola
  if (queda_tensao_pct > 3) {
    for (const cabo of tabelaCobrecobre) {
      const queda_temp = (resistividade * comprimento_cabo_m * corrente_para_queda) / cabo.bitola
      const queda_temp_pct = (queda_temp / tensao_entrada_v) * 100
      if (queda_temp_pct <= 3) {
        bitola_cabo_mm2 = cabo.bitola
        break
      }
    }
  }

  // Seleção de disjuntor (dispositivo de proteção contra sobrecarga)
  // NBR 5410: deve ser ≤ capacidade do cabo, próximo valor normalizado
  const disjuntores_normalizados = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200]
  let disjuntor_a = 20
  for (const dj of disjuntores_normalizados) {
    if (dj >= corrente_maxima_a) {
      disjuntor_a = dj
      break
    }
  }

  // Seleção de DR (Dispositivo de Proteção diferencial residual)
  // NBR 5410: máximo 30 mA para áreas úmidas/externas
  // Usar 300 mA para circuitos de força
  const dr_ma = corrente_maxima_a > 40 ? 300 : 30

  // Seleção de DPS (Dispositivo de Proteção contra Surtos)
  // NBR 5410: obrigatório para equipamentos eletrônicos sensíveis
  // Usar DPS tipo 2 (classe II) para proteção de surtos de comutação
  const dps_kv = tensao_entrada_v >= 380 ? 420 : 275 // Tensão nominal em V
  const dps_capacidade_a = corrente_maxima_a + 20 // Margem de segurança

  // Cálculo de tempo de seccionamento automático
  // Para eletrocussão (< 50V): até 5s
  // Para 120V a 230V: até 0.4s
  // Para > 230V: até 0.2s
  let tempo_seccionamento_s = 0.2
  if (tensao_entrada_v <= 120) tempo_seccionamento_s = 0.4
  if (tensao_entrada_v <= 50) tempo_seccionamento_s = 5

  return {
    corrente_projeto_a: parseFloat(corrente_projeto_a.toFixed(2)),
    corrente_maxima_a: parseFloat(corrente_maxima_a.toFixed(2)),
    bitola_cabo_mm2,
    disjuntor_a,
    dr_ma,
    dps_kv,
    dps_capacidade_a,
    queda_tensao_pct: parseFloat(queda_tensao_pct.toFixed(2)),
    tempo_seccionamento_s,
    materiais: gerarListaMateriais(potencia_kw, tipo_carregador, bitola_cabo_mm2, disjuntor_a, dr_ma, dps_kv, comprimento_cabo_m),
  }
}

function gerarListaMateriais(potencia_kw, tipo_carregador, bitola_mm2, disjuntor_a, dr_ma, dps_kv, comprimento_m) {
  const materiais = [
    { item: 'Carregador EV', especificacao: `${tipo_carregador} ${potencia_kw}kW`, quantidade: 1 },
    { item: 'Cabo de alimentação', especificacao: `${bitola_mm2} mm² (Cu, 0,6/1kV)`, quantidade: comprimento_m },
    { item: 'Disjuntor termomagnético', especificacao: `${disjuntor_a}A Curva C`, quantidade: 1 },
    { item: 'Dispositivo DR', especificacao: `${dr_ma}mA Tipo A`, quantidade: 1 },
    { item: 'DPS (Proteção contra Surtos)', especificacao: `${dps_kv}V Classe II`, quantidade: 1 },
    { item: 'Eletroduto rígido/conduíte', especificacao: 'Proteção mecânica', quantidade: comprimento_m },
    { item: 'Fita isolante', especificacao: 'Vedação de conexões', quantidade: 5 },
    { item: 'Cinta de fixação', especificacao: 'Suporte do cabo', quantidade: 10 },
    { item: 'Haste de aterramento', especificacao: '2,4m cobre 16mm dia', quantidade: 1 },
    { item: 'Tomadas/conectores', especificacao: 'Conforme carregador', quantidade: 2 },
  ]
  return materiais
}

// Validar se a instalação atende NBR 5410
export function validarNBR5410(calculos) {
  const erros = []
  const avisos = []

  if (calculos.queda_tensao_pct > 3) {
    erros.push(`Queda de tensão (${calculos.queda_tensao_pct}%) excede 3% permitido pela NBR 5410`)
  }

  if (calculos.tempo_seccionamento_s > 0.5) {
    avisos.push(`Tempo de seccionamento (${calculos.tempo_seccionamento_s}s) próximo ao limite`)
  }

  return { valido: erros.length === 0, erros, avisos }
}
