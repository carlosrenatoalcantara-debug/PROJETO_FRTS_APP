import { describe, it, expect } from 'vitest'
import { calcularOrcamento } from '../calcularOrcamento'
import { POLITICA_PADRAO, normalizarPolitica, margemDaPolitica, flagsApresentacao, MODOS_APRESENTACAO } from '../politicaComercial'

const mat = (v) => [{ descricao: 'm', quantidade: 1, preco_unitario: v }]
const srv = (v) => [{ descricao: 's', quantidade: 1, preco_unitario: v }]
const eq = (v) => [{ descricao: 'e', quantidade: 1, preco_unitario: v }]

describe('FEATURE-004 — Política Comercial', () => {
  it('retrocompat: sem `margem` → comportamento FEATURE-002 (margem só materiais)', () => {
    const r = calcularOrcamento({ materiais: mat(100), servicos: srv(100), equipamentos: eq(100), margem_pct: 20, impostos_pct: 10 })
    expect(r.margem_valor).toBe(20)
    expect(r.materiais_com_margem).toBe(120)
    expect(r.equipamentos_com_margem).toBe(100)  // sem margem
    expect(r.servicos_com_margem).toBe(100)      // sem margem
    expect(r.impostos_valor).toBe(22)            // (120+100)*10%
    expect(r.preco_final).toBe(100 + 120 + 100 + 22)
  })

  it('margem por categoria: aplica em materiais/equipamentos/serviços independentes', () => {
    const r = calcularOrcamento({
      equipamentos: eq(1000), materiais: mat(100), servicos: srv(200),
      margem: { aplicar_materiais: true, materiais_pct: 20, aplicar_equipamentos: true, equipamentos_pct: 10, aplicar_servicos: true, servicos_pct: 5 },
      impostos_pct: 0,
    })
    expect(r.margem_valor).toBe(20)                  // 20% de 100
    expect(r.margem_equipamentos_valor).toBe(100)    // 10% de 1000
    expect(r.margem_servicos_valor).toBe(10)         // 5% de 200
    expect(r.equipamentos_com_margem).toBe(1100)
    expect(r.materiais_com_margem).toBe(120)
    expect(r.servicos_com_margem).toBe(210)
    expect(r.margem_total).toBe(130)
    expect(r.preco_final).toBe(1100 + 120 + 210)     // 1430
  })

  it('margem só equipamentos (materiais/serviços sem margem)', () => {
    const r = calcularOrcamento({
      equipamentos: eq(500), materiais: mat(300), servicos: srv(200),
      margem: { aplicar_materiais: false, materiais_pct: 20, aplicar_equipamentos: true, equipamentos_pct: 20, aplicar_servicos: false, servicos_pct: 0 },
    })
    expect(r.margem_valor).toBe(0)
    expect(r.margem_equipamentos_valor).toBe(100)
    expect(r.preco_final).toBe(600 + 300 + 200)      // 1100
  })

  it('impostos incidem sobre (materiais c/ margem + serviços c/ margem)', () => {
    const r = calcularOrcamento({
      materiais: mat(100), servicos: srv(100),
      margem: { aplicar_materiais: true, materiais_pct: 20, aplicar_servicos: true, servicos_pct: 10 },
      impostos_pct: 10,
    })
    // mat_c_margem=120 ; serv_c_margem=110 ; base=230 ; impostos=23
    expect(r.base_impostos).toBe(230)
    expect(r.impostos_valor).toBe(23)
  })

  it('normalizarPolitica preenche defaults e valida modo', () => {
    const p = normalizarPolitica({ margem: { materiais_pct: 30 }, modo_apresentacao: 'inexistente' })
    expect(p.margem.materiais_pct).toBe(30)
    expect(p.margem.aplicar_materiais).toBe(true)          // default
    expect(p.impostos_pct).toBe(0)
    expect(p.modo_apresentacao).toBe('detalhada_com_precos') // fallback
  })

  it('margemDaPolitica mapeia para o formato do calcularOrcamento', () => {
    const m = margemDaPolitica(POLITICA_PADRAO)
    expect(m.aplicar_materiais).toBe(true)
    expect(m.materiais_pct).toBe(20)
    expect(m.aplicar_equipamentos).toBe(false)
  })

  it('flagsApresentacao cobre os 4 modos', () => {
    expect(Object.keys(MODOS_APRESENTACAO)).toEqual(['detalhada_com_precos', 'detalhada_sem_precos', 'resumo', 'valor_final'])
    expect(flagsApresentacao('detalhada_sem_precos').precos).toBe(false)
    expect(flagsApresentacao('resumo').itens).toBe(false)
    expect(flagsApresentacao('valor_final').resumo).toBe(false)
    expect(flagsApresentacao('valor_final').final).toBe(true)
    expect(flagsApresentacao('xyz').precos).toBe(true) // fallback detalhada_com_precos
  })
})
