import { describe, it, expect } from 'vitest'
import { gerarBOM, REGRAS_BOM } from '../bomMateriaisEV'

/**
 * Testes da lista de materiais (BOM) de instalação EV.
 *
 * Regras validadas:
 *  • FORTE SOLAR: monofásico = 3 condutores (L + N + PE)
 *  • FORTE SOLAR: trifásico  = 5 condutores (L1+L2+L3 + N + PE)
 *  • DPS: mínimo 2 unidades (NBR 5410 6.3.5.2)
 *  • Eletroduto: ceil(distância / 3m) barras
 *  • Abraçadeiras: 3 por barra
 *  • Bucha + parafuso: 4 por barra
 */

const baseArgsMono = {
  potencia_kw: 7.2, tipo_carregador: 'AC Monofásico',
  numero_fases: 1,
  bitola_mm2: 10, disjuntor_a: 40, dr_ma: 30, dps_kv: 275,
}

const baseArgsTri = {
  potencia_kw: 22, tipo_carregador: 'AC Trifásico',
  numero_fases: 3,
  bitola_mm2: 6, disjuntor_a: 40, dr_ma: 30, dps_kv: 420,
}

function item(bom, nome) {
  return bom.find(i => i.item === nome)
}

// ─── REGRA FORTE SOLAR: condutores ──────────────────────────────────────────

describe('FORTE SOLAR — Monofásico: L + N + PE (3 condutores)', () => {
  it('tem Cabo Fase (L)', () => {
    const bom = gerarBOM({ ...baseArgsMono, comprimento_m: 35 })
    const cabo = item(bom, 'Cabo Fase (L)')
    expect(cabo).toBeDefined()
    expect(cabo.quantidade).toBe(35)
    expect(cabo.unidade).toBe('m')
  })

  it('tem Cabo Neutro (N)', () => {
    const bom = gerarBOM({ ...baseArgsMono, comprimento_m: 35 })
    const cabo = item(bom, 'Cabo Neutro (N)')
    expect(cabo).toBeDefined()
    expect(cabo.quantidade).toBe(35)
  })

  it('tem Cabo Terra (PE)', () => {
    const bom = gerarBOM({ ...baseArgsMono, comprimento_m: 35 })
    const cabo = item(bom, 'Cabo Terra (PE)')
    expect(cabo).toBeDefined()
    expect(cabo.quantidade).toBe(35)
  })

  it('35m de percurso → 3 × 35m = 105m de cabo total', () => {
    const bom = gerarBOM({ ...baseArgsMono, comprimento_m: 35 })
    const cabos = bom.filter(i => ['Cabo Fase (L)', 'Cabo Neutro (N)', 'Cabo Terra (PE)'].includes(i.item))
    expect(cabos).toHaveLength(3)
    const total = cabos.reduce((s, c) => s + c.quantidade, 0)
    expect(total).toBe(105)
  })

  it('NÃO contém "Cabo de alimentação" (item antigo removido)', () => {
    const bom = gerarBOM({ ...baseArgsMono, comprimento_m: 35 })
    expect(item(bom, 'Cabo de alimentação')).toBeUndefined()
  })

  it('BOM monofásico tem 13 itens (1+3+1+1+1+1+1+1+1+1+1)', () => {
    const bom = gerarBOM({ ...baseArgsMono, comprimento_m: 25 })
    expect(bom.length).toBe(13)
  })

  it('REGRAS_BOM.CONDUTORES_MONO === 3', () => {
    expect(REGRAS_BOM.CONDUTORES_MONO).toBe(3)
  })
})

describe('FORTE SOLAR — Trifásico: L1+L2+L3+N+PE (5 condutores)', () => {
  it('tem Cabo Fase L1', () => {
    const bom = gerarBOM({ ...baseArgsTri, comprimento_m: 35 })
    const cabo = item(bom, 'Cabo Fase L1')
    expect(cabo).toBeDefined()
    expect(cabo.quantidade).toBe(35)
  })

  it('tem Cabo Fase L2', () => {
    const bom = gerarBOM({ ...baseArgsTri, comprimento_m: 35 })
    expect(item(bom, 'Cabo Fase L2')).toBeDefined()
  })

  it('tem Cabo Fase L3', () => {
    const bom = gerarBOM({ ...baseArgsTri, comprimento_m: 35 })
    expect(item(bom, 'Cabo Fase L3')).toBeDefined()
  })

  it('tem Cabo Neutro (N)', () => {
    const bom = gerarBOM({ ...baseArgsTri, comprimento_m: 35 })
    expect(item(bom, 'Cabo Neutro (N)')).toBeDefined()
  })

  it('tem Cabo Terra (PE)', () => {
    const bom = gerarBOM({ ...baseArgsTri, comprimento_m: 35 })
    expect(item(bom, 'Cabo Terra (PE)')).toBeDefined()
  })

  it('35m de percurso → 5 × 35m = 175m de cabo total', () => {
    const bom = gerarBOM({ ...baseArgsTri, comprimento_m: 35 })
    const cabos = bom.filter(i => i.item.startsWith('Cabo'))
    expect(cabos).toHaveLength(5)
    const total = cabos.reduce((s, c) => s + c.quantidade, 0)
    expect(total).toBe(175)
  })

  it('BOM trifásico tem 15 itens (1+5+1+1+1+1+1+1+1+1+1)', () => {
    const bom = gerarBOM({ ...baseArgsTri, comprimento_m: 25 })
    expect(bom.length).toBe(15)
  })

  it('REGRAS_BOM.CONDUTORES_TRI === 5', () => {
    expect(REGRAS_BOM.CONDUTORES_TRI).toBe(5)
  })
})

// ─── DPS mínimo 2 ────────────────────────────────────────────────────────────

describe('DPS — mínimo 2 unidades (NBR 5410 6.3.5.2)', () => {
  it('DPS sempre = 2 (cabo curto)', () => {
    const bom = gerarBOM({ ...baseArgsMono, comprimento_m: 5 })
    expect(item(bom, 'DPS (Proteção contra Surtos)').quantidade).toBe(2)
  })

  it('DPS = 2 (cabo longo, sem multiplicação)', () => {
    const bom = gerarBOM({ ...baseArgsMono, comprimento_m: 100 })
    expect(item(bom, 'DPS (Proteção contra Surtos)').quantidade).toBe(2)
  })

  it('REGRAS_BOM.DPS_MINIMO === 2', () => {
    expect(REGRAS_BOM.DPS_MINIMO).toBe(2)
  })
})

// ─── Eletroduto em barras de 3m ──────────────────────────────────────────────

describe('Eletroduto — barras de 3m', () => {
  it('1 metro → 1 barra (ceil)', () => {
    expect(item(gerarBOM({ ...baseArgsMono, comprimento_m: 1 }), 'Eletroduto rígido').quantidade).toBe(1)
  })

  it('3 metros → 1 barra', () => {
    expect(item(gerarBOM({ ...baseArgsMono, comprimento_m: 3 }), 'Eletroduto rígido').quantidade).toBe(1)
  })

  it('4 metros → 2 barras', () => {
    expect(item(gerarBOM({ ...baseArgsMono, comprimento_m: 4 }), 'Eletroduto rígido').quantidade).toBe(2)
  })

  it('9 metros → 3 barras', () => {
    expect(item(gerarBOM({ ...baseArgsMono, comprimento_m: 9 }), 'Eletroduto rígido').quantidade).toBe(3)
  })

  it('50 metros → 17 barras (ceil(50/3))', () => {
    expect(item(gerarBOM({ ...baseArgsMono, comprimento_m: 50 }), 'Eletroduto rígido').quantidade).toBe(17)
  })

  it('0 metros → 1 barra mínimo', () => {
    expect(item(gerarBOM({ ...baseArgsMono, comprimento_m: 0 }), 'Eletroduto rígido').quantidade).toBe(1)
  })

  it('unidade = "barra"', () => {
    expect(item(gerarBOM({ ...baseArgsMono, comprimento_m: 9 }), 'Eletroduto rígido').unidade).toBe('barra')
  })

  it('REGRAS_BOM.BARRA_ELETRODUTO_M === 3', () => {
    expect(REGRAS_BOM.BARRA_ELETRODUTO_M).toBe(3)
  })
})

// ─── Abraçadeiras (3/barra) ──────────────────────────────────────────────────

describe('Abraçadeiras — 3 por barra', () => {
  it('1 barra → 3 abraçadeiras', () => {
    expect(item(gerarBOM({ ...baseArgsMono, comprimento_m: 3 }), 'Abraçadeira').quantidade).toBe(3)
  })

  it('3 barras (9m) → 9 abraçadeiras', () => {
    expect(item(gerarBOM({ ...baseArgsMono, comprimento_m: 9 }), 'Abraçadeira').quantidade).toBe(9)
  })

  it('17 barras (50m) → 51 abraçadeiras', () => {
    expect(item(gerarBOM({ ...baseArgsMono, comprimento_m: 50 }), 'Abraçadeira').quantidade).toBe(51)
  })
})

// ─── Bucha + parafuso (4/barra) ──────────────────────────────────────────────

describe('Bucha + parafuso — 4 por barra', () => {
  it('1 barra → 4 fixações', () => {
    expect(item(gerarBOM({ ...baseArgsMono, comprimento_m: 3 }), 'Bucha + parafuso').quantidade).toBe(4)
  })

  it('5 barras (15m) → 20 fixações', () => {
    expect(item(gerarBOM({ ...baseArgsMono, comprimento_m: 15 }), 'Bucha + parafuso').quantidade).toBe(20)
  })

  it('unidade = "jogo"', () => {
    expect(item(gerarBOM({ ...baseArgsMono, comprimento_m: 10 }), 'Bucha + parafuso').unidade).toBe('jogo')
  })

  it('REGRAS_BOM.FIXACAO_POR_BARRA === 4', () => {
    expect(REGRAS_BOM.FIXACAO_POR_BARRA).toBe(4)
  })
})

// ─── Itens básicos (regressão) ───────────────────────────────────────────────

describe('Itens básicos — regressão', () => {
  it('carregador, disjuntor, DR, haste = 1 unidade', () => {
    const bom = gerarBOM({ ...baseArgsMono, comprimento_m: 10 })
    expect(item(bom, 'Carregador EV').quantidade).toBe(1)
    expect(item(bom, 'Disjuntor termomagnético').quantidade).toBe(1)
    expect(item(bom, 'Dispositivo DR').quantidade).toBe(1)
    expect(item(bom, 'Haste de aterramento').quantidade).toBe(1)
  })

  it('BOM mono contém todos os itens esperados', () => {
    const bom = gerarBOM({ ...baseArgsMono, comprimento_m: 10 })
    const nomes = bom.map(i => i.item)
    expect(nomes).toContain('Carregador EV')
    expect(nomes).toContain('Cabo Fase (L)')
    expect(nomes).toContain('Cabo Neutro (N)')
    expect(nomes).toContain('Cabo Terra (PE)')
    expect(nomes).toContain('Disjuntor termomagnético')
    expect(nomes).toContain('Dispositivo DR')
    expect(nomes).toContain('DPS (Proteção contra Surtos)')
    expect(nomes).toContain('Eletroduto rígido')
    expect(nomes).toContain('Abraçadeira')
    expect(nomes).toContain('Bucha + parafuso')
    expect(nomes).toContain('Haste de aterramento')
  })

  it('BOM tri contém todos os 5 condutores', () => {
    const bom = gerarBOM({ ...baseArgsTri, comprimento_m: 10 })
    const nomes = bom.map(i => i.item)
    expect(nomes).toContain('Cabo Fase L1')
    expect(nomes).toContain('Cabo Fase L2')
    expect(nomes).toContain('Cabo Fase L3')
    expect(nomes).toContain('Cabo Neutro (N)')
    expect(nomes).toContain('Cabo Terra (PE)')
  })
})

// ─── Constantes exportadas ───────────────────────────────────────────────────

describe('REGRAS_BOM — constantes exportadas', () => {
  it('tem todas as constantes', () => {
    expect(REGRAS_BOM.BARRA_ELETRODUTO_M).toBe(3)
    expect(REGRAS_BOM.ABRACADEIRAS_POR_BARRA).toBe(3)
    expect(REGRAS_BOM.FIXACAO_POR_BARRA).toBe(4)
    expect(REGRAS_BOM.DPS_MINIMO).toBe(2)
    expect(REGRAS_BOM.CONDUTORES_MONO).toBe(3)
    expect(REGRAS_BOM.CONDUTORES_TRI).toBe(5)
  })
})
