import { describe, it, expect } from 'vitest'
import { calcularOrcamento } from '../calcularOrcamento'

const mat = (v) => [{ descricao: 'm', quantidade: 1, preco_unitario: v }]
const srv = (v) => [{ descricao: 's', quantidade: 1, preco_unitario: v }]
const eq = (v) => [{ descricao: 'e', quantidade: 1, preco_unitario: v }]

describe('FEATURE-002 — Orçamento Profissional EV', () => {
  it('ITEM 1: margem incide SOMENTE sobre materiais (nunca serviços/equipamentos)', () => {
    const r = calcularOrcamento({ materiais: mat(100), servicos: srv(100), equipamentos: eq(100), margem_pct: 20 })
    expect(r.subtotal_materiais).toBe(100)
    expect(r.margem_valor).toBe(20)                 // 20% de 100 (materiais)
    expect(r.materiais_com_margem).toBe(120)        // Subtotal Materiais
    expect(r.subtotal_servicos).toBe(100)           // serviços inalterados
    expect(r.subtotal_equipamentos).toBe(100)       // equipamentos inalterados
  })

  it('ITEM 1: sem materiais → margem zero (serviços não recebem margem)', () => {
    const r = calcularOrcamento({ materiais: [], servicos: srv(500), margem_pct: 30 })
    expect(r.margem_valor).toBe(0)
    expect(r.materiais_com_margem).toBe(0)
    expect(r.subtotal_servicos).toBe(500)
  })

  it('ITEM 2: impostos incidem sobre (materiais com margem + serviços), separados', () => {
    const r = calcularOrcamento({ materiais: mat(100), servicos: srv(100), margem_pct: 20, impostos_pct: 10 })
    // materiais_com_margem=120 ; base=120+100=220 ; impostos=22
    expect(r.base_impostos).toBe(220)
    expect(r.impostos_valor).toBe(22)
    // imposto NÃO está embutido na margem
    expect(r.margem_valor).toBe(20)
  })

  it('ITEM 6: Valor Final = Equipamentos + Subtotal Materiais + Serviços + Impostos', () => {
    const r = calcularOrcamento({ equipamentos: eq(500), materiais: mat(100), servicos: srv(100), margem_pct: 20, impostos_pct: 10 })
    // 500 + 120 + 100 + 22 = 742
    expect(r.total).toBe(742)
    expect(r.preco_final).toBe(742)
  })

  it('impostos sobre equipamentos = 0 (equipamento não entra na base de impostos)', () => {
    const r = calcularOrcamento({ equipamentos: eq(1000), materiais: [], servicos: [], impostos_pct: 10 })
    expect(r.impostos_valor).toBe(0)
    expect(r.preco_final).toBe(1000)
  })

  it('compat: desconto (%) aplica ao total ao final', () => {
    const r = calcularOrcamento({ materiais: mat(100), margem_pct: 0, impostos_pct: 0, desconto_pct: 10 })
    expect(r.total).toBe(100)
    expect(r.desconto_valor).toBe(10)
    expect(r.preco_final).toBe(90)
  })

  it('margem e impostos zero → valor final = soma pura', () => {
    const r = calcularOrcamento({ equipamentos: eq(200), materiais: mat(300), servicos: srv(500) })
    expect(r.preco_final).toBe(1000)
    expect(r.custo).toBe(1000)
  })
})
