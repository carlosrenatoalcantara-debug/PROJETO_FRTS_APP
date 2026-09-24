/**
 * F12 — Lacuna de potência não vira zero.
 *
 * `potenciaPaineisKwp` fazia `Number(p.potencia_w) || 0`. Esse padrão colapsa
 * TRÊS estados distintos num só:
 *
 *   ausência  (`null`/`undefined`)  → o dado não está disponível
 *   inválido  (`"abc"`, negativo)   → o dado viola o contrato
 *   zero real (`0`)                 → valor numérico legítimo
 *
 * Todos viravam `0` e entravam na soma. O resultado era um total numericamente
 * plausível e falso: no projeto real "Mercado Avelino", o MESMO objeto devolvia
 * `n_modulos_total = 399` e `potencia_total_kwp = 77,43`, quando 399 × 445 W =
 * 177,6 kWp. Nada sinalizava que um dos dois era parcial.
 *
 * A regra desde a FV-DOM-029 vale aqui: a agregação é COMPLETA ou
 * EXPLICITAMENTE INCOMPLETA. Somar os conhecidos e apresentar como total seria
 * inventar a diferença.
 *
 * Medido no acervo: 12 de 13 projetos com `arranjos[]` exibiam potência
 * parcial ou fabricada. É lacuna de CADASTRO (`potencia_w` não preenchida),
 * não de código — e este sprint não faz backfill.
 */
import { describe, it, expect } from 'vitest'
import {
  potenciaPaineisKwp, potenciaInversoresKw, calcularTotaisProjeto, potenciaTotalKwp,
} from '../../../../backend/src/services/arranjosService.js'
import { compradaDoProjeto, MOTIVOS_POTENCIA } from '../../../../backend/src/dominio/potencia/index.js'

const p = (q, w) => ({ marca: 'Talesun', modelo: 'TSM', potencia_w: w, quantidade: q })
const inv = (kw) => ({ marca: 'Huawei', modelo: 'SUN2000', potencia_kw: kw, quantidade: 1 })
const arranjo = (id, paineis, inversores = [inv(60)]) => ({ id, tipo: 'principal', paineis, inversores })

describe('F12 · agregação completa ou explicitamente incompleta', () => {
  it('1 · potência completa soma corretamente', () => {
    expect(potenciaPaineisKwp([p(14, 585)])).toBe(8.19)
  })

  it('2 · 14 módulos SEM potência não valem 0 kWp', () => {
    const r = potenciaPaineisKwp([p(14, null)])
    expect(r).toBeNull()
    expect(r).not.toBe(0)
  })

  it('3 · parcial não é apresentado como total', () => {
    // 6 × 585 = 3,51 kWp seria a soma dos conhecidos. Não é o total: faltam 4.
    const r = potenciaPaineisKwp([p(6, 585), p(4, null)])
    expect(r).toBeNull()
    expect(r).not.toBe(3.51)
  })

  it('4 · dois arranjos completos somam', () => {
    const t = calcularTotaisProjeto({ arranjos: [
      arranjo('A', [p(14, 585)]), arranjo('B', [p(10, 585)]),
    ] })
    expect(t.potencia_total_kwp).toBe(14.04)
    expect(t.n_modulos_total).toBe(24)
  })

  it('5 · dois arranjos, um incompleto → total não avaliável', () => {
    const t = calcularTotaisProjeto({ arranjos: [
      arranjo('A', [p(14, 585)]), arranjo('B', [p(10, null)]),
    ] })
    expect(t.potencia_total_kwp).toBeNull()
    expect(t.potencia_total_kwp).not.toBe(8.19)   // só o arranjo A
    // A CONTAGEM continua correta — F-01 intacta. É a potência que não se afirma.
    expect(t.n_modulos_total).toBe(24)
  })

  it('6 · potência não numérica é lacuna, não zero', () => {
    expect(potenciaPaineisKwp([p(10, 'abc')])).toBeNull()
    expect(potenciaPaineisKwp([p(10, {})])).toBeNull()
  })

  it('7 · potência negativa é lacuna', () => {
    expect(potenciaPaineisKwp([p(10, -585)])).toBeNull()
  })

  it('8 · quantidade inválida é lacuna', () => {
    expect(potenciaPaineisKwp([p(null, 585)])).toBeNull()
    expect(potenciaPaineisKwp([p('x', 585)])).toBeNull()
    expect(potenciaPaineisKwp([p(-3, 585)])).toBeNull()
  })

  it('9 · a lacuna sobrevive à releitura — nunca vira zero', () => {
    // Simula persistir → recarregar: o documento é o mesmo objeto JSON.
    const doc = { arranjos: [arranjo('A', [p(14, 585)]), arranjo('B', [p(10, null)])] }
    const recarregado = JSON.parse(JSON.stringify(doc))
    const t = calcularTotaisProjeto(recarregado)
    expect(t.potencia_total_kwp).toBeNull()
    expect(t.potencia_total_kwp).not.toBe(0)
  })
})

describe('F12 · o contrato canônico diz POR QUÊ', () => {
  it('10 · composição incompleta não é reportada como composição vazia', () => {
    // Dizer "COMPOSICAO_VAZIA" para um projeto de 24 módulos escolhidos seria
    // trocar uma informação falsa por outra.
    const r = compradaDoProjeto({ arranjos: [
      arranjo('A', [p(14, 585)]), arranjo('B', [p(10, null)]),
    ] })
    expect(r.valor).toBeNull()
    expect(r.motivo).toBe(MOTIVOS_POTENCIA.SEM_POTENCIA_MODULO)
  })

  it('11 · projeto sem nenhum módulo continua sendo composição vazia', () => {
    const r = compradaDoProjeto({ arranjos: [{ id: 'A', paineis: [], inversores: [] }] })
    expect(r.valor).toBeNull()
    expect(r.motivo).toBe(MOTIVOS_POTENCIA.SEM_COMPOSICAO)
  })

  it('12 · composição completa continua reportando o valor e a fonte', () => {
    const r = compradaDoProjeto({ arranjos: [arranjo('A', [p(14, 585)])] })
    expect(r.valor).toBe(8.19)
    expect(r.motivo).toBeNull()
    expect(r.fonte).toContain('arranjos[]')
  })
})

describe('F12 · potência CA tem a mesma disciplina', () => {
  it('13 · inversores completos somam', () => {
    expect(potenciaInversoresKw([inv(60), inv(50)])).toBe(110)
  })

  it('14 · inversor sem potência torna o total CA não avaliável', () => {
    expect(potenciaInversoresKw([inv(60), inv(null)])).toBeNull()
  })

  it('15 · arranjo sem PAINÉIS não contamina — não há potência a somar', () => {
    // O arranjo de ampliação ainda vazio é ausência de composição, não lacuna
    // de dado. Contaminar aqui bloquearia projetos legítimos.
    const t = calcularTotaisProjeto({ arranjos: [
      arranjo('A', [p(14, 585)]),
      { id: 'B', tipo: 'ampliacao', paineis: [], inversores: [] },
    ] })
    expect(t.potencia_total_kwp).toBe(8.19)
  })

  it('16 · `potenciaTotalKwp` e `calcularTotaisProjeto` dão a MESMA resposta', () => {
    // Eram duas implementações da mesma soma, ambas com `|| 0`. Uma fonte só.
    const doc = { arranjos: [arranjo('A', [p(14, 585)]), arranjo('B', [p(10, null)])] }
    expect(potenciaTotalKwp(doc)).toBe(calcularTotaisProjeto(doc).potencia_total_kwp)
    expect(potenciaTotalKwp(doc)).toBeNull()
  })
})
