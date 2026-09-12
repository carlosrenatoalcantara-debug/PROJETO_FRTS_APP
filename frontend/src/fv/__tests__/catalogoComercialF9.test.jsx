/**
 * F9 — Catálogo comercial isolado do SSOT de inversores.
 *
 * A auditoria cruzou os 41 inversores de `catalogoInversores.js` contra os 52
 * do SSOT Mongo: ZERO correspondências. 10 dos 14 fabricantes coincidem, nenhum
 * modelo. São datasets disjuntos — a tabela comercial descreve equipamento
 * residencial de demonstração, o SSOT descreve o estoque real.
 *
 * Por isso o defeito nunca foi "valor divergente do SSOT": era o recomendador
 * rodando um quarto motor elétrico sobre esse dataset e devolvendo ao usuário
 * "✓ Validação elétrica OK (Voc, Vmpp, Isc dentro dos limites)" — um veredito
 * de engenharia emitido por uma camada comercial, sobre equipamento que o SSOT
 * sequer conhece, com tolerâncias que afrouxavam os limites do fabricante.
 *
 * Estes testes travam a fronteira, não os valores.
 */
import { describe, it, expect } from 'vitest'
import { INVERSORES } from '../../../../backend/src/data/catalogoInversores.js'
import { PAINEIS } from '../../../../backend/src/data/catalogoPaineis.js'
import { recomendarKits } from '../../../../backend/src/services/kitRecommendationService.js'
import { FONTE_COMERCIAL, COMPAT_NAO_AVALIADA } from '../../../../backend/src/data/procedenciaComercial.js'

describe('F9 · fronteira entre catálogo comercial e SSOT', () => {
  it('1 · candidato com dados completos continua sendo recomendado', () => {
    // A feature não pode morrer em nome da honestidade: o objetivo é rotular,
    // não desligar. Se isto quebrar, a correção foi longe demais.
    const r = recomendarKits({ potencia_kwp: 5 })
    expect(r.top10.length).toBeGreaterThan(0)
    expect(r.total_candidatos).toBeGreaterThan(0)
  })

  it('2 · divergência não é escondida: a saída declara a fonte', () => {
    // `dy8` (Deye SUN-8K-SG04LP1) foi o exemplo citado na F7 por divergir em
    // Vmáx (500 vs 1000 V). A F9 mostrou que a divergência era entre DUAS
    // tabelas de demonstração — o SSOT não tem este modelo. O que o usuário
    // precisa saber não é qual valor "vence", e sim que o dado não é do SSOT.
    const dy8 = INVERSORES.find((i) => i.id === 'dy8')
    expect(dy8).toBeTruthy()
    const r = recomendarKits({ potencia_kwp: 8 })
    expect(r.fonte).toBe(FONTE_COMERCIAL)
    expect(r.compatibilidade_eletrica).toBe(COMPAT_NAO_AVALIADA)
  })

  it('3 · nenhum candidato é declarado tecnicamente compatível', () => {
    const r = recomendarKits({ potencia_kwp: 10 })
    for (const kit of r.top10) {
      expect(kit.compatibilidade_eletrica).toBe(COMPAT_NAO_AVALIADA)
      expect(kit.fonte).toBe(FONTE_COMERCIAL)
      // O veredito técnico não existe neste payload, em nenhuma grafia.
      expect(kit).not.toHaveProperty('valido')
      expect(kit).not.toHaveProperty('valido_eletrico')
      expect(kit).not.toHaveProperty('compativel')
    }
  })

  it('4 · a explicação do score não afirma validação elétrica', () => {
    const r = recomendarKits({ potencia_kwp: 5 })
    const textos = r.top10.flatMap((k) => k.explicacao_score || [])
    const rotulos = r.top10.flatMap((k) => (k.score_breakdown || []).map((b) => b.descricao || ''))
    expect(textos.length).toBeGreaterThan(0)       // sanidade
    expect(rotulos.length).toBeGreaterThan(0)      // sanidade
    expect(textos.some((t) => /Validação elétrica OK/.test(t))).toBe(false)
    expect(textos.some((t) => /compatibilidade elétrica NÃO avaliada/i.test(t))).toBe(true)
    // O rótulo do critério também afirmava "validade elétrica".
    expect(rotulos.some((d) => /validade elétrica/i.test(d))).toBe(false)
  })

  it('5 · o pré-filtro perdeu as tolerâncias que afrouxavam o teto', () => {
    // Antes, um arranjo com Voc até 5% ACIMA da tensão máxima do inversor era
    // aceito. Tolerância que afrouxa teto de segurança não é margem de erro.
    // Buscar um alvo alto força a varredura até o limite de módulos por string.
    const r = recomendarKits({ potencia_kwp: 20 })
    for (const kit of r.top10) {
      const inv = INVERSORES.find((i) => i.id === kit.inversor.id)
      const vocArray = kit.arranjo.modulos_por_string * _vocDoPainel(kit.painel.id)
      expect(vocArray).toBeLessThanOrEqual(inv.vocMax)
    }
  })

  it('6 · unidade: potência do inversor em kW, do painel em W — sem confusão de escala', () => {
    // `potenciaKW` (kW) × `pmpp` (W) é o par de maior risco de escala do
    // dataset. O oversizing só fecha se as duas forem convertidas certo.
    const r = recomendarKits({ potencia_kwp: 5 })
    for (const kit of r.top10) {
      const inv = INVERSORES.find((i) => i.id === kit.inversor.id)
      const esperado = kit.arranjo.potencia_total_kwp / inv.potenciaKW
      expect(kit.arranjo.oversizing_fator).toBeCloseTo(esperado, 2)
      // Faixa sã: um erro de 1000× apareceria aqui imediatamente.
      expect(kit.arranjo.oversizing_fator).toBeGreaterThan(0.5)
      expect(kit.arranjo.oversizing_fator).toBeLessThan(3)
    }
  })

  it('7 · equipamento sem os atributos declarados não vira candidato', () => {
    // Antes, os defaults `?? 1000` / `?? 100` / `?? 20` supriam a ausência e o
    // candidato entrava validado contra números inventados. Agora ausência
    // descarta — nunca aprova.
    const r = recomendarKits({ potencia_kwp: 5 })
    for (const kit of r.top10) {
      const inv = INVERSORES.find((i) => i.id === kit.inversor.id)
      for (const campo of ['vocMax', 'mpptMin', 'imaxMppt', 'nMppts', 'potenciaKW']) {
        expect(inv[campo]).not.toBeNull()
        expect(inv[campo]).not.toBeUndefined()
      }
    }
  })

  it('8 · os 41 modelos comerciais não foram promovidos ao SSOT', () => {
    // O dataset continua sendo 41 registros comerciais. Se alguém "resolver" a
    // divergência importando-os, o número muda e este teste avisa.
    expect(INVERSORES).toHaveLength(41)
    expect(INVERSORES.every((i) => typeof i.id === 'string' && i.id.length <= 8)).toBe(true)
  })
})

// Voc do painel pelo id — lido do próprio dataset comercial, sem duplicar valor.
function _vocDoPainel(id) {
  const p = PAINEIS.find((x) => x.id === id)
  if (!p) throw new Error(`painel ${id} não encontrado no dataset comercial`)
  return p.voc
}
