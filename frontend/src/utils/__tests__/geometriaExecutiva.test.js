import { describe, it, expect } from 'vitest'
import { build } from '@diagram-engine'
import { BOXES, A4, COMPONENTE } from '@diagram-engine/geometry'
import { adaptarProjetoEV } from '../adapterDiagramaEV'

// BUG-014 — geometria congelada do documento executivo.
// Nenhum BOX invade outro; nenhum componente ultrapassa o DIAGRAM_BOX; nenhum overlap.

const R = (b) => ({ x1: b.x, y1: b.y, x2: b.x + b.w, y2: b.y + b.h })
const overlap = (a, b) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2
const dentro = (i, o) => i.x1 >= o.x1 - 0.01 && i.y1 >= o.y1 - 0.01 && i.x2 <= o.x2 + 0.01 && i.y2 <= o.y2 + 0.01
const rectComp = (pos) => ({ x1: pos.x, y1: pos.y, x2: pos.x + COMPONENTE.W, y2: pos.y + COMPONENTE.H })

const argsMono = (over = {}) => ({
  calculos: { disjuntor_a: 40, dr_ma: 30, dps_kv: 275, bitola_cabo_mm2: 10, comprimento_cabo_m: 25 },
  bom: [{ item: 'DPS', quantidade: 2 }],
  numero_fases: 1,
  carregador: { tipo: 'AC_Mono', potencia_kw: 7, tensao_entrada_v: 220 },
  projeto: { nome: 'P' },
  ...over,
})
const canonical = (over, buildOpts = {}) => {
  const { components, connections, metadata } = adaptarProjetoEV(over || argsMono())
  return build({ components, connections, metadata, ...buildOpts })
}
function semForaDoBox(c) {
  const DB = R(BOXES.DIAGRAM_BOX)
  return c.components.every(comp => dentro(rectComp(c.layout[comp.id]), DB))
}
function semOverlap(c) {
  const ids = c.components.map(x => x.id)
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    if (overlap(rectComp(c.layout[ids[i]]), rectComp(c.layout[ids[j]]))) return false
  }
  return true
}

describe('BUG-014 — BOXES oficiais', () => {
  it('todos os BOXES estão dentro da folha A4', () => {
    for (const b of Object.values(BOXES)) {
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.y).toBeGreaterThanOrEqual(0)
      expect(b.x + b.w).toBeLessThanOrEqual(A4.W)
      expect(b.y + b.h).toBeLessThanOrEqual(A4.H)
    }
  })

  it('nenhum BOX invade outro', () => {
    const nomes = Object.keys(BOXES)
    for (let i = 0; i < nomes.length; i++) for (let j = i + 1; j < nomes.length; j++) {
      expect(overlap(R(BOXES[nomes[i]]), R(BOXES[nomes[j]]))).toBe(false)
    }
  })
})

describe('BUG-014 — componentes contidos no DIAGRAM_BOX, sem sobreposição', () => {
  it('layout fresco (sem overrides): tudo dentro do box e sem overlap', () => {
    const c = canonical()
    expect(semForaDoBox(c)).toBe(true)
    expect(semOverlap(c)).toBe(true)
  })

  it('mono/tri/2DPS/4DPS: sempre dentro e sem overlap', () => {
    for (const args of [
      argsMono(),
      argsMono({ numero_fases: 3, carregador: { tipo: 'AC_Tri', potencia_kw: 22, tensao_entrada_v: 380 } }),
      argsMono({ bom: [{ item: 'DPS', quantidade: 4 }] }),
    ]) {
      const c = canonical(args)
      expect(semForaDoBox(c)).toBe(true)
      expect(semOverlap(c)).toBe(true)
    }
  })

  it('override fora do box → clampado/congelado, permanece dentro e sem overlap', () => {
    const c = canonical(argsMono(), { overrides: { carr: { position: { x: -500, y: 9999 } } } })
    expect(semForaDoBox(c)).toBe(true)
    expect(semOverlap(c)).toBe(true)
  })

  it('override que sobreporia → congela na geometria determinística (sem overlap)', () => {
    const c = canonical(argsMono(), { overrides: { rede: { position: { x: 160, y: 256 } } } })
    expect(semForaDoBox(c)).toBe(true)
    expect(semOverlap(c)).toBe(true)
  })

  it('override VÁLIDO (dentro, sem overlap) é preservado', () => {
    // zona livre (bottom-left do box, longe da linha principal e dos DPS)
    const c = canonical(argsMono(), { overrides: { carr: { position: { x: 250, y: 356 } } } })
    expect(c.layout.carr).toEqual({ x: 250, y: 356 })
    expect(semForaDoBox(c)).toBe(true)
    expect(semOverlap(c)).toBe(true)
  })
})
