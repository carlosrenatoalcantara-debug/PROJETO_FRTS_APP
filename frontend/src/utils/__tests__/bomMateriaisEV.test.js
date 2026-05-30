import { describe, it, expect } from 'vitest'
import { gerarBOM, REGRAS_BOM } from '../bomMateriaisEV'

/**
 * EV-BUGFIX-02 — testes da lista de materiais (BOM) de instalação EV.
 *
 * Regras validadas:
 *  • DPS: mínimo 2 unidades (NBR 5410 6.3.5.2)
 *  • Eletroduto: ceil(distância / 3m) barras
 *  • Abraçadeiras: 3 por barra
 *  • Bucha + parafuso: 4 por barra
 */

const baseArgs = {
  potencia_kw: 7.4, tipo_carregador: 'AC Trifásico',
  bitola_mm2: 6, disjuntor_a: 40, dr_ma: 30, dps_kv: 420,
}

function item(bom, nome) {
  return bom.find(i => i.item === nome)
}

describe('EV-BUGFIX-02 — DPS mínimo 2 unidades', () => {
  it('DPS sempre = 2 (mesmo com cabo curto)', () => {
    const bom = gerarBOM({ ...baseArgs, comprimento_m: 5 })
    expect(item(bom, 'DPS (Proteção contra Surtos)').quantidade).toBe(2)
  })

  it('DPS = 2 (cabo longo, sem multiplicação errada)', () => {
    const bom = gerarBOM({ ...baseArgs, comprimento_m: 100 })
    expect(item(bom, 'DPS (Proteção contra Surtos)').quantidade).toBe(2)
  })

  it('REGRAS_BOM.DPS_MINIMO === 2', () => {
    expect(REGRAS_BOM.DPS_MINIMO).toBe(2)
  })
})

describe('EV-BUGFIX-02 — Eletroduto em barras de 3m', () => {
  it('1 metro → 1 barra (ceil)', () => {
    const bom = gerarBOM({ ...baseArgs, comprimento_m: 1 })
    expect(item(bom, 'Eletroduto rígido').quantidade).toBe(1)
  })

  it('3 metros → 1 barra', () => {
    const bom = gerarBOM({ ...baseArgs, comprimento_m: 3 })
    expect(item(bom, 'Eletroduto rígido').quantidade).toBe(1)
  })

  it('4 metros → 2 barras (ceil)', () => {
    const bom = gerarBOM({ ...baseArgs, comprimento_m: 4 })
    expect(item(bom, 'Eletroduto rígido').quantidade).toBe(2)
  })

  it('9 metros → 3 barras', () => {
    const bom = gerarBOM({ ...baseArgs, comprimento_m: 9 })
    expect(item(bom, 'Eletroduto rígido').quantidade).toBe(3)
  })

  it('50 metros → 17 barras (ceil(50/3))', () => {
    const bom = gerarBOM({ ...baseArgs, comprimento_m: 50 })
    expect(item(bom, 'Eletroduto rígido').quantidade).toBe(17)
  })

  it('0 metros → 1 barra mínimo (não pode ser 0)', () => {
    const bom = gerarBOM({ ...baseArgs, comprimento_m: 0 })
    expect(item(bom, 'Eletroduto rígido').quantidade).toBe(1)
  })

  it('barras de eletroduto vêm em unidade "barra"', () => {
    const bom = gerarBOM({ ...baseArgs, comprimento_m: 9 })
    expect(item(bom, 'Eletroduto rígido').unidade).toBe('barra')
  })
})

describe('EV-BUGFIX-02 — Abraçadeiras (3 por barra de eletroduto)', () => {
  it('1 barra → 3 abraçadeiras', () => {
    const bom = gerarBOM({ ...baseArgs, comprimento_m: 3 })
    expect(item(bom, 'Abraçadeira').quantidade).toBe(3)
  })

  it('3 barras (9m) → 9 abraçadeiras', () => {
    const bom = gerarBOM({ ...baseArgs, comprimento_m: 9 })
    expect(item(bom, 'Abraçadeira').quantidade).toBe(9)
  })

  it('17 barras (50m) → 51 abraçadeiras', () => {
    const bom = gerarBOM({ ...baseArgs, comprimento_m: 50 })
    expect(item(bom, 'Abraçadeira').quantidade).toBe(51)
  })
})

describe('EV-BUGFIX-02 — Bucha + parafuso (4 por barra)', () => {
  it('1 barra → 4 fixações', () => {
    const bom = gerarBOM({ ...baseArgs, comprimento_m: 3 })
    expect(item(bom, 'Bucha + parafuso').quantidade).toBe(4)
  })

  it('5 barras (15m) → 20 fixações', () => {
    const bom = gerarBOM({ ...baseArgs, comprimento_m: 15 })
    expect(item(bom, 'Bucha + parafuso').quantidade).toBe(20)
  })

  it('vem em unidade "jogo" (bucha+parafuso = 1 jogo)', () => {
    const bom = gerarBOM({ ...baseArgs, comprimento_m: 10 })
    expect(item(bom, 'Bucha + parafuso').unidade).toBe('jogo')
  })
})

describe('EV-BUGFIX-02 — Itens básicos (regressão)', () => {
  it('cabo: quantidade = comprimento_m em metros', () => {
    const bom = gerarBOM({ ...baseArgs, comprimento_m: 25 })
    expect(item(bom, 'Cabo de alimentação').quantidade).toBe(25)
    expect(item(bom, 'Cabo de alimentação').unidade).toBe('m')
  })

  it('carregador, disjuntor, DR, haste = 1', () => {
    const bom = gerarBOM({ ...baseArgs, comprimento_m: 10 })
    expect(item(bom, 'Carregador EV').quantidade).toBe(1)
    expect(item(bom, 'Disjuntor termomagnético').quantidade).toBe(1)
    expect(item(bom, 'Dispositivo DR').quantidade).toBe(1)
    expect(item(bom, 'Haste de aterramento').quantidade).toBe(1)
  })

  it('BOM inclui todos os 11 itens esperados', () => {
    const bom = gerarBOM({ ...baseArgs, comprimento_m: 10 })
    expect(bom.length).toBe(11)
    const nomes = bom.map(i => i.item)
    expect(nomes).toContain('DPS (Proteção contra Surtos)')
    expect(nomes).toContain('Eletroduto rígido')
    expect(nomes).toContain('Abraçadeira')
    expect(nomes).toContain('Bucha + parafuso')
  })
})

describe('EV-BUGFIX-02 — Constantes expostas', () => {
  it('REGRAS_BOM tem todas as constantes', () => {
    expect(REGRAS_BOM.BARRA_ELETRODUTO_M).toBe(3)
    expect(REGRAS_BOM.ABRACADEIRAS_POR_BARRA).toBe(3)
    expect(REGRAS_BOM.FIXACAO_POR_BARRA).toBe(4)
    expect(REGRAS_BOM.DPS_MINIMO).toBe(2)
  })
})
