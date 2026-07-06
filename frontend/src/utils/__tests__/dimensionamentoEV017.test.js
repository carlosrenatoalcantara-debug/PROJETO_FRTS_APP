import { describe, it, expect } from 'vitest'
import { calcularParametrosNBR5410 } from '../../services/calculosNBR5410EV'
import { executarCalculosProjetoEV } from '../../../../backend/src/utils/calculosCarregadorEV.js'

// Capacidade (Iz) por bitola — NBR 5410 Tab.36 (Cu 70°C), igual nos dois motores.
const IZ = { 1.5: 15.5, 2.5: 21, 4: 28, 6: 36, 10: 50, 16: 68, 25: 89, 35: 109, 50: 134 }

// disj: com a margem mínima de 5% (ajuste pós-BUG-017), Ib exatamente igual a um
// disjuntor comercial (folga 0%) pula para o próximo da série — evita desarme em
// uso contínuo (ex.: carregador de 32A não fica num disjuntor de exatos 32A).
const CASOS = [
  { nome: '7,4kW mono 220V cat32A 20m', pkw: 7.4, v: 220, fases: 1, corr: 32, L: 20, tipo: 'AC_Mono', disj: 40, bitola: 10 },
  { nome: '11kW tri 380V cat16A 20m',  pkw: 11,  v: 380, fases: 3, corr: 16, L: 20, tipo: 'AC_Tri', disj: 20, bitola: 4 },
  { nome: '22kW tri 380V cat32A 60m',  pkw: 22,  v: 380, fases: 3, corr: 32, L: 60, tipo: 'AC_Tri', disj: 40, bitola: 10 },
]

const front = (c) => calcularParametrosNBR5410({
  potencia_kw: c.pkw, tensao_entrada_v: c.v, numero_fases: c.fases,
  comprimento_cabo_m: c.L, tipo_carregador: c.tipo, corrente_nominal_a: c.corr,
})
const back = (c) => executarCalculosProjetoEV({
  carregadores: [{ potencia_kw: c.pkw, tipo: c.tipo, corrente_entrada_a: c.corr, numero_fases: c.fases, tensao_entrada_v: c.v }],
  comprimento_cabo_m: c.L,
}).calculos_nbr

describe('BUG-017 — motor de dimensionamento EV (auditoria)', () => {
  it('corrente de projeto = corrente nominal do catálogo (Ib), nunca inflada', () => {
    for (const c of CASOS) {
      expect(front(c).corrente_projeto_a).toBe(c.corr)   // usa o catálogo
    }
  })

  it('disjuntor coerente (Ib ≤ In ≤ Iz), SEM superdimensionamento absurdo (7,4kW ⇒ 40A, não 80A) e COM margem mínima de 5%', () => {
    for (const c of CASOS) {
      const f = front(c)
      expect(f.disjuntor_a).toBe(c.disj)
      expect(f.bitola_cabo_mm2).toBe(c.bitola)
      expect(c.corr).toBeLessThanOrEqual(f.disjuntor_a)          // Ib ≤ In
      expect(f.corrente_projeto_a).toBeLessThanOrEqual(f.disjuntor_a) // corrente ≤ disjuntor
      expect(f.disjuntor_a).toBeLessThanOrEqual(IZ[f.bitola_cabo_mm2]) // In ≤ Iz
    }
  })

  it('FRONTEND e BACKEND produzem valores IDÊNTICOS (consistência catálogo/projeto/PDF/tela)', () => {
    for (const c of CASOS) {
      const f = front(c); const b = back(c)
      expect(b.corrente_projeto_a).toBe(f.corrente_projeto_a)
      expect(b.bitola_cabo_mm2).toBe(f.bitola_cabo_mm2)
      expect(b.disjuntor_a).toBe(f.disjuntor_a)
      expect(b.queda_tensao_pct).toBe(f.queda_tensao_pct)
      expect(b.dps_kv).toBe(f.dps_kv)
    }
  })

  it('sem catálogo: Ib derivado de P/(V·√3·fp) e disjuntor ≥ Ib', () => {
    const c = { pkw: 7.4, v: 220, fases: 1, corr: null, L: 80, tipo: 'AC_Mono' }
    const f = calcularParametrosNBR5410({ potencia_kw: c.pkw, tensao_entrada_v: c.v, numero_fases: c.fases, comprimento_cabo_m: c.L, tipo_carregador: c.tipo, corrente_nominal_a: null })
    expect(f.corrente_projeto_a).toBeCloseTo(35.41, 1)
    expect(f.corrente_projeto_a).toBeLessThanOrEqual(f.disjuntor_a)
    expect(back(c).disjuntor_a).toBe(f.disjuntor_a)   // idêntico
  })
})
