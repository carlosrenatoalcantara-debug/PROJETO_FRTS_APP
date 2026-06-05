import { describe, it, expect } from 'vitest'
import { extrairSpecsTecnicas } from '../../../../backend/src/ai/parserTecnicoInversor.js'
import { montarColunaUnica } from '../../../../backend/src/ai/parserMatricial.js'
import { lerInversor } from '../../../../backend/src/equipamentos/inversores/index.js'

/**
 * P1-MICRO-EXTRACT-01 — Extração de microinversores e formatos compostos.
 *
 * FAMÍLIAS SEMÂNTICAS (sem hardcode por fabricante):
 *  - Corrente composta "N × corrente" (Hoymiles "4 × 14", APsystems "20A x 4"):
 *    o MENOR é a CONTAGEM de entradas; o MAIOR é a CORRENTE por entrada/MPPT.
 *  - Número de entradas CC ("Quantidade de Entradas CC", "N canais", "DC inputs").
 *  - Módulos suportados como aproximação de entradas (micro: 1 módulo ≈ 1 entrada).
 *  - Sanidade física (FASE 4): rejeita interpretações impossíveis — NÃO corrige.
 */

// ── FASE 2/3 — texto: composto N×corrente ────────────────────────────────────
describe('FASE 2 — corrente composta "N × corrente" → corrente = MAIOR', () => {
  it('Hoymiles-like "Corrente de entrada máxima (A) 4 × 14" → 14 (não 4)', () => {
    const esp = extrairSpecsTecnicas('Corrente de entrada máxima (A) 4 × 14', null)
    expect(esp.corrente_max_por_mppt).toBe(14)
  })
  it('APsystems-like "Máxima corrente de entrada 20A x 4" → 20 (não 4)', () => {
    const esp = extrairSpecsTecnicas('Máxima corrente de entrada 20A x 4', null)
    expect(esp.corrente_max_por_mppt).toBe(20)
  })
  it('Isc composta "Isc PV 20A x 4" → corrente_isc_max = 20', () => {
    const esp = extrairSpecsTecnicas('Isc PV 20A x 4', null)
    expect(esp.corrente_isc_max).toBe(20)
  })
})

describe('FASE 2 — contagem de entradas (o MENOR do composto) e rótulos diretos', () => {
  it('"20A x 4" → total_entradas_cc = 4 (a contagem)', () => {
    const esp = extrairSpecsTecnicas('Máxima corrente de entrada 20A x 4', null)
    expect(esp.total_entradas_cc).toBe(4)
  })
  it('"4 canais de entrada" → total_entradas_cc = 4', () => {
    const esp = extrairSpecsTecnicas('Unidade com 4 canais de entrada independentes', null)
    expect(esp.total_entradas_cc).toBe(4)
  })
  it('rótulo direto "Quantidade de Entradas CC 6" → 6', () => {
    const esp = extrairSpecsTecnicas('Quantidade de Entradas CC 6', null)
    expect(esp.total_entradas_cc).toBe(6)
  })
})

// ── FASE 4 — sanidade física: rejeitar, nunca corrigir ───────────────────────
describe('FASE 4 — rejeita interpretações impossíveis (sem auto-correção)', () => {
  it('total_entradas_cc < n_mppts → rejeitado (null)', () => {
    // 4 MPPTs mas o composto sugere 1 entrada → fisicamente impossível
    const esp = extrairSpecsTecnicas('Número de MPPTs 4\nMáxima corrente de entrada 20A x 1', null)
    expect(esp.total_entradas_cc).toBeUndefined()
  })
  it('>12 entradas por MPPT → rejeitado (suspeito)', () => {
    const esp = extrairSpecsTecnicas('Número de MPPTs 1\nQuantidade de Entradas CC 20', null)
    expect(esp.total_entradas_cc).toBeUndefined()
  })
  it('proporção plausível é aceita: 3 MPPTs / 6 entradas → 6', () => {
    const esp = extrairSpecsTecnicas('Número de MPPTs 3\nQuantidade de Entradas CC 6', null)
    expect(esp.total_entradas_cc).toBe(6)
    expect(esp.n_mppts).toBe(3)
  })
})

// ── FASE 3 — entradas_por_mppt corretas, assimetria preservada ───────────────
describe('FASE 3 — distribuição entradas_por_mppt (via SSOT lerInversor)', () => {
  it('3 MPPT + 6 entradas → [2,2,2]', () => {
    const r = lerInversor({ n_mppts: 3, total_entradas_cc: 6 }, {})
    expect(r.entradas_por_mppt).toEqual([2, 2, 2])
  })
  it('2 MPPT + 4 entradas → [2,2]', () => {
    const r = lerInversor({ n_mppts: 2, total_entradas_cc: 4 }, {})
    expect(r.entradas_por_mppt).toEqual([2, 2])
  })
  it('4 MPPT + 4 entradas → [1,1,1,1]', () => {
    const r = lerInversor({ n_mppts: 4, total_entradas_cc: 4 }, {})
    expect(r.entradas_por_mppt).toEqual([1, 1, 1, 1])
  })
})

// ── posicional: composto e entradas em datasheet column-major (coluna única) ──
describe('Posicional (coluna única) — composto e nº de entradas', () => {
  // rótulo à esquerda (x=22), valor à direita (x=380), mesma linha (y).
  const tok = (y, label, val) => ([
    { page: 1, x: 22, y, s: label },
    { page: 1, x: 380, y, s: val },
  ])
  const tokens = [
    ...tok(700, 'Faixa de Tensão MPPT por Entrada [V]', '16 ~ 60'),
    ...tok(680, 'Corrente Máxima por Entrada [A]', '18'),
    ...tok(660, 'Corrente de Curto-circuito [A]', '4 × 25'),   // composto → 25
    ...tok(640, 'Quantidade de MPPTs', '3'),
    ...tok(620, 'Quantidade de Entradas CC', '6'),
  ]
  const col = montarColunaUnica(tokens)

  it('extrai ≥3 campos (ok)', () => {
    expect(col.ok).toBe(true)
  })
  it('Isc composta "4 × 25" → 25 (maior), não 4', () => {
    expect(col.especificacoes.corrente_isc_max).toBe(25)
  })
  it('"Quantidade de Entradas CC 6" recuperado posicionalmente → 6', () => {
    expect(col.especificacoes.total_entradas_cc).toBe(6)
  })
  it('n_mppts=3 + total=6 → entradas_por_mppt [2,2,2]', () => {
    const r = lerInversor(col.especificacoes, {})
    expect(r.entradas_por_mppt).toEqual([2, 2, 2])
  })
})

// ── FASE 6 — não regredir inversores STRING (sem composto) ───────────────────
describe('FASE 6 — regressão: inversor STRING (valor simples) intacto', () => {
  it('"Max. Input Current 26 A" (sem composto) → 26', () => {
    const esp = extrairSpecsTecnicas('Max. Input Current per MPPT 26 A', null)
    expect(esp.corrente_max_por_mppt).toBe(26)
  })
  it('"Max. Short-circuit Current 32 A" (sem composto) → 32', () => {
    const esp = extrairSpecsTecnicas('Max. Short-circuit Current per MPPT 32 A', null)
    expect(esp.corrente_isc_max).toBe(32)
  })
})
