// Certificação de integração — Sprint P2-EV-WORKFLOW-CONSOLIDATION-01
// Guard de regressão do pipeline: engenharia NBR → BOM centralizado →
// orçamento (fonte única). Cobre a propagação etapa 2 → etapa 3.
import { describe, it, expect } from 'vitest'
import { calcularParametrosNBR5410, validarNBR5410 } from '../../services/calculosNBR5410EV'
import { calcularOrcamento } from '../calcularOrcamento'
import { bomParaMateriais, carregadoresParaEquipamentos, DEFAULT_SERVICOS_EV } from '../../components/ev/OrcamentoEV'

const find = (bom, nome) => bom.find(i => i.item === nome)

describe('CERT — Engenharia NBR (etapa 2)', () => {
  it('mono 7.4kW/220V/35m: disjuntor=catálogo Ib com margem mínima 5% (32A→40A), NBR válido', () => {
    const r = calcularParametrosNBR5410({ potencia_kw: 7.4, tensao_entrada_v: 220, numero_fases: 1, comprimento_cabo_m: 35, tipo_carregador: 'AC Monofásico', corrente_nominal_a: 32, tipo_conector: 'Tipo 2' })
    expect(r.disjuntor_a).toBe(40)
    expect(validarNBR5410(r).valido).toBe(true)
  })
  it('tri 22kW/380V/35m: NBR válido (Ib≤In≤Iz)', () => {
    const r = calcularParametrosNBR5410({ potencia_kw: 22, tensao_entrada_v: 380, numero_fases: 3, comprimento_cabo_m: 35, tipo_carregador: 'AC Trifásico', corrente_nominal_a: 32 })
    expect(validarNBR5410(r).valido).toBe(true)
  })
})

describe('CERT — Lista de materiais centralizada (etapa 2)', () => {
  it('mono: 3 condutores=105m, 6 terminais, 4 conectores perfurantes', () => {
    const r = calcularParametrosNBR5410({ potencia_kw: 7.4, tensao_entrada_v: 220, numero_fases: 1, comprimento_cabo_m: 35, tipo_carregador: 'AC Monofásico', corrente_nominal_a: 32 })
    const cabos = r.materiais.filter(i => i.item.startsWith('Cabo'))
    expect(cabos).toHaveLength(3)
    expect(cabos.reduce((s, c) => s + c.quantidade, 0)).toBe(105)
    expect(find(r.materiais, 'Terminal tubular').quantidade).toBe(6)
    expect(find(r.materiais, 'Conector perfurante').quantidade).toBe(4)
  })
  it('tri + mob box: 5 condutores=175m, 10 terminais, 6 conectores, Mob Box', () => {
    const r = calcularParametrosNBR5410({ potencia_kw: 22, tensao_entrada_v: 380, numero_fases: 3, comprimento_cabo_m: 35, tipo_carregador: 'AC Trifásico', corrente_nominal_a: 32, incluir_mob_box: true })
    const cabos = r.materiais.filter(i => i.item.startsWith('Cabo'))
    expect(cabos).toHaveLength(5)
    expect(cabos.reduce((s, c) => s + c.quantidade, 0)).toBe(175)
    expect(find(r.materiais, 'Terminal tubular').quantidade).toBe(10)
    expect(find(r.materiais, 'Conector perfurante').quantidade).toBe(6)
    expect(find(r.materiais, 'Mob Box')).toBeDefined()
  })
})

describe('CERT — Fonte única: engenharia → orçamento (etapa 2 → etapa 3)', () => {
  it('propaga BOM e carregadores para o orçamento e calcula o valor final', () => {
    const r = calcularParametrosNBR5410({ potencia_kw: 22, tensao_entrada_v: 380, numero_fases: 3, comprimento_cabo_m: 35, tipo_carregador: 'AC Trifásico', corrente_nominal_a: 32 })
    const carregadores = [{ marca: 'WEG', modelo: 'EVC', potencia_kw: 22, quantidade: 1, preco: 8000 }]
    const orcamento = {
      equipamentos: carregadoresParaEquipamentos(carregadores),
      materiais: bomParaMateriais(r.materiais).map(m => ({ ...m, preco_unitario: 10 })),
      servicos: DEFAULT_SERVICOS_EV.map(s => ({ ...s, preco_unitario: 500 })),
      margem_pct: 20, desconto_pct: 5,
    }
    const resumo = calcularOrcamento(orcamento)
    expect(resumo.subtotal_equipamentos).toBe(8000)         // preço do catálogo propagado
    expect(resumo.subtotal_servicos).toBe(2500)             // 5 serviços × 500
    // FEATURE-002: margem 20% SOMENTE sobre materiais; desconto 5% sobre o total.
    const matComMargem = +(resumo.subtotal_materiais * 1.2).toFixed(2)
    expect(resumo.materiais_com_margem).toBe(matComMargem)
    const total = +(resumo.subtotal_equipamentos + matComMargem + resumo.subtotal_servicos).toFixed(2)
    expect(resumo.preco_final).toBe(+(total * 0.95).toFixed(2))
  })
  it('serviços incluem os custos exigidos: Projeto elétrico, ART/CFT, Deslocamento', () => {
    const d = DEFAULT_SERVICOS_EV.map(s => s.descricao)
    expect(d).toContain('Projeto elétrico')
    expect(d).toContain('ART/CFT')
    expect(d).toContain('Deslocamento')
  })
})
