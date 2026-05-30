import { describe, it, expect } from 'vitest'
import {
  analisarDemanda, analisarTarifacao, analisarGD, analisarSazonalidade,
  detectarInconsistencias, gerarDashboardEnergetico, TOLERANCIA_ULTRAPASSAGEM,
} from '../../../../backend/src/utils/fatura/analisadorEnergetico.js'

/**
 * Sprint 8.9 — Inteligência Avançada de Faturas (analisador energético).
 * Helpers puros sobre uma FaturaEnergia já parseada.
 */

// Helper p/ montar campo {valor, fonte, confianca}
const c = (valor) => ({ valor, fonte: 'PDF', confianca: 0.8 })

describe('S8.9 — Grupo A: demanda e ultrapassagem', () => {
  // 1) Ultrapassagem: medida > 105% da contratada
  it('detecta ultrapassagem quando medida excede 105% da contratada', () => {
    const r = analisarDemanda({ demanda_contratada: c(100), demanda_medida: c(112) })
    expect(r.ultrapassou).toBe(true)
    expect(r.excedente_kw).toBe(12)
    expect(r.limite_sem_multa).toBe(105)
  })

  // 2) Dentro do limite (medida ≤ 105%)
  it('não acusa ultrapassagem dentro da tolerância de 5%', () => {
    const r = analisarDemanda({ demanda_contratada: c(100), demanda_medida: c(104) })
    expect(r.ultrapassou).toBe(false)
    expect(r.folga_kw).toBe(1)  // 105 - 104
  })

  // 3) Subutilização → recomenda reduzir
  it('recomenda redução quando utilização < 60%', () => {
    const r = analisarDemanda({ demanda_contratada: c(100), demanda_medida: c(45) })
    expect(r.utilizacao_pct).toBe(45)
    expect(r.recomendacao).toMatch(/subutilizada|redução/i)
  })

  it('TOLERANCIA é 5%', () => {
    expect(TOLERANCIA_ULTRAPASSAGEM).toBe(0.05)
  })
})

describe('S8.9 — Tarifação ponta/fora-ponta', () => {
  // 4) Split de consumo
  it('calcula percentuais de ponta e fora-ponta', () => {
    const r = analisarTarifacao({ consumo_ponta: c(2000), consumo_fora_ponta: c(8000), modalidade: c('verde') })
    expect(r.consumo_total).toBe(10000)
    expect(r.pct_ponta).toBe(20)
    expect(r.pct_fora_ponta).toBe(80)
    expect(r.modalidade).toBe('verde')
  })
})

describe('S8.9 — GD: saldo e compensação', () => {
  // 5) Autossuficiência a partir da compensação
  it('calcula autossuficiência da GD', () => {
    const r = analisarGD(
      { possui_gd: c(true), energia_injetada: c(400), creditos: c(150), compensacao: c(300) },
      c(500)
    )
    expect(r.possui_gd).toBe(true)
    expect(r.saldo_acumulado_kwh).toBe(150)
    expect(r.autossuficiencia_pct).toBe(60)  // 300/500
  })

  // 6) Sem GD
  it('retorna possui_gd=false quando não há GD', () => {
    expect(analisarGD({ possui_gd: c(false) }, c(500)).possui_gd).toBe(false)
  })
})

describe('S8.9 — Sazonalidade', () => {
  const hist = [
    { mes: 'JAN', ano: 2026, kwh: 600 }, { mes: 'FEV', ano: 2026, kwh: 580 },
    { mes: 'MAR', ano: 2026, kwh: 550 }, { mes: 'ABR', ano: 2026, kwh: 500 },
    { mes: 'MAI', ano: 2026, kwh: 450 }, { mes: 'JUN', ano: 2026, kwh: 400 },
    { mes: 'JUL', ano: 2026, kwh: 420 }, { mes: 'AGO', ano: 2026, kwh: 460 },
    { mes: 'SET', ano: 2026, kwh: 500 }, { mes: 'OUT', ano: 2026, kwh: 540 },
    { mes: 'NOV', ano: 2026, kwh: 580 }, { mes: 'DEZ', ano: 2026, kwh: 620 },
  ]

  // 7) Estatísticas + classificação
  it('calcula média, maior, menor e classifica sazonalidade', () => {
    const r = analisarSazonalidade(hist)
    expect(r.calculavel).toBe(true)
    expect(r.meses).toBe(12)
    expect(r.maior).toBe(620)
    expect(r.menor).toBe(400)
    expect(r.mes_maior).toBe('DEZ/2026')
    expect(r.mes_menor).toBe('JUN/2026')
    expect(['baixa', 'moderada', 'alta']).toContain(r.sazonalidade)
  })

  it('não calcula com menos de 3 meses', () => {
    expect(analisarSazonalidade([{ mes: 'JAN', ano: 2026, kwh: 500 }]).calculavel).toBe(false)
  })
})

describe('S8.9 — Consistência das leituras', () => {
  // 8) Pico anômalo
  it('detecta pico anômalo (>3x mediana)', () => {
    const fatura = {
      historico_consumo: [
        { mes: 'JAN', ano: 2026, kwh: 500 }, { mes: 'FEV', ano: 2026, kwh: 520 },
        { mes: 'MAR', ano: 2026, kwh: 2000 }, { mes: 'ABR', ano: 2026, kwh: 510 },
      ],
    }
    const r = detectarInconsistencias(fatura)
    expect(r.problemas.some(p => p.tipo === 'pico_anomalo')).toBe(true)
  })

  // 9) Consumo negativo = erro
  it('detecta consumo negativo como erro', () => {
    const fatura = { historico_consumo: [{ mes: 'JAN', ano: 2026, kwh: -50 }] }
    const r = detectarInconsistencias(fatura)
    expect(r.consistente).toBe(false)
    expect(r.problemas.some(p => p.tipo === 'consumo_negativo' && p.severidade === 'erro')).toBe(true)
  })

  // 10) Demanda incoerente (medida > 2x contratada)
  it('detecta demanda medida muito acima da contratada', () => {
    const fatura = { historico_consumo: [], grupo_a: { demanda_contratada: c(50), demanda_medida: c(150) } }
    const r = detectarInconsistencias(fatura)
    expect(r.problemas.some(p => p.tipo === 'demanda_incoerente')).toBe(true)
  })

  // 11) Leitura limpa = consistente
  it('histórico saudável = consistente', () => {
    const fatura = { historico_consumo: [{ mes: 'JAN', ano: 2026, kwh: 500 }, { mes: 'FEV', ano: 2026, kwh: 510 }] }
    const r = detectarInconsistencias(fatura)
    expect(r.consistente).toBe(true)
    expect(r.total_problemas).toBe(0)
  })
})

describe('S8.9 — Dashboard energético completo', () => {
  // 12) Integração: monta dashboard end-to-end
  it('gera dashboard com todas as seções', () => {
    const fatura = {
      classificacao: { grupo: c('A'), modalidade_tarifaria: c('verde') },
      consumo_atual_kwh: c(500),
      historico_consumo: Array.from({ length: 12 }, (_, i) => ({ mes: 'M' + i, ano: 2026, kwh: 450 + i * 10 })),
      grupo_a: { demanda_contratada: c(100), demanda_medida: c(95), consumo_ponta: c(1000), consumo_fora_ponta: c(4000), modalidade: c('verde') },
      geracao_existente: { possui_gd: c(false) },
    }
    const dash = gerarDashboardEnergetico(fatura)
    expect(dash.grupo).toBe('A')
    expect(dash.modalidade).toBe('verde')
    expect(dash.demanda.calculavel).toBe(true)
    expect(dash.tarifacao.pct_ponta).toBe(20)
    expect(dash.sazonalidade.calculavel).toBe(true)
    expect(dash.dimensionamento_sugerido.potencia_fv_estimada_kwp).toBeGreaterThan(0)
    expect(dash.prontidao_proposta).toBeGreaterThan(0)
    expect(dash.prontidao_proposta).toBeLessThanOrEqual(100)
  })

  // 13) Estimativa FV: consumo médio / 140 kWh/kWp/mês
  it('estima potência FV pela regra de bolso (140 kWh/kWp/mês)', () => {
    const fatura = {
      classificacao: { grupo: c('B') },
      consumo_atual_kwh: c(700),
      historico_consumo: [],
      geracao_existente: { possui_gd: c(false) },
    }
    const dash = gerarDashboardEnergetico(fatura)
    // 700 / 140 = 5.0 kWp
    expect(dash.dimensionamento_sugerido.potencia_fv_estimada_kwp).toBe(5)
  })
})
