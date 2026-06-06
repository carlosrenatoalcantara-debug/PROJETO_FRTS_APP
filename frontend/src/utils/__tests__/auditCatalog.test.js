import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { scoreDe, outliersDe, CAMPOS_SCORE, PESO_TOTAL, runAudit } from '../../../../backend/src/scripts/auditCatalog.js'

/**
 * P1-CATALOG-AUDIT-01 — auditoria READ-ONLY do catálogo.
 * Valida o motor de score/outliers e garante que a auditoria não escreve no banco.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const MEM = resolve(__dirname, '../../../../backend/data/memory-storage.json')

describe('FASE 2 — score de completude (pesos do enunciado)', () => {
  it('soma de pesos = 24 (4×3 + 4×2 + 4×1)', () => {
    expect(PESO_TOTAL).toBe(24)
    expect(CAMPOS_SCORE.filter(c => c.peso === 3)).toHaveLength(4)
    expect(CAMPOS_SCORE.filter(c => c.peso === 2)).toHaveLength(4)
    expect(CAMPOS_SCORE.filter(c => c.peso === 1)).toHaveLength(4)
  })
  it('registro completo → score 100%', () => {
    const canon = {
      potencia_kw: 10, n_mppts: 2, entradas_por_mppt: [2, 2], corrente_max_por_mppt: 15,
      corrente_isc_max: 18, tensao_max_entrada: 1100, tensao_mppt_min: 180, tensao_mppt_max: 1000,
      tensao_partida: 180, eficiencia_maxima: 98.6, peso_kg: 16, dimensoes: '460x420x182', grau_protecao_ip: 'IP66',
    }
    expect(scoreDe(canon).score).toBe(100)
  })
  it('vazio → score 0% e todos os campos faltantes', () => {
    const r = scoreDe({})
    expect(r.score).toBe(0)
    expect(r.faltantes).toHaveLength(CAMPOS_SCORE.length)
  })
  it('só CRÍTICOS preenchidos → 12/24 = 50%', () => {
    const canon = { potencia_kw: 5, n_mppts: 2, strings_por_mppt: 1, corrente_max_por_mppt: 13 }
    expect(scoreDe(canon).score).toBe(50)
  })
  it('strings_por_mppt OU entradas_por_mppt satisfaz o campo crítico', () => {
    expect(scoreDe({ strings_por_mppt: 2 }).faltantes).not.toContain('strings_entradas')
    expect(scoreDe({ entradas_por_mppt: [2, 2] }).faltantes).not.toContain('strings_entradas')
    expect(scoreDe({ entradas_por_mppt: [] }).faltantes).toContain('strings_entradas')
  })
})

describe('FASE 4 — detecção de outliers (apenas detecta, justificativa obrigatória)', () => {
  it('R1: ≥20kW e peso ≤10kg', () => {
    const o = outliersDe({ potencia_kw: 30, peso_kg: 8 }).find(x => x.regra === 1)
    expect(o).toBeTruthy(); expect(o.justificativa).toMatch(/improvável/)
  })
  it('R2: eficiência fora de [80,100]', () => {
    expect(outliersDe({ eficiencia_maxima: 105 }).some(x => x.regra === 2)).toBe(true)
    expect(outliersDe({ eficiencia_maxima: 70 }).some(x => x.regra === 2)).toBe(true)
    expect(outliersDe({ eficiencia_maxima: 98 }).some(x => x.regra === 2)).toBe(false)
  })
  it('R3: ≤5kW e tensão CC ≥1500V', () => {
    expect(outliersDe({ potencia_kw: 3, tensao_max_entrada: 1500 }).some(x => x.regra === 3)).toBe(true)
  })
  it('R4: corrente incompatível com potência', () => {
    // 100kW com 2A/MPPT (1 MPPT) → razão 50 kW/A → incompatível
    expect(outliersDe({ potencia_kw: 100, corrente_max_por_mppt: 2, n_mppts: 1 }).some(x => x.regra === 4)).toBe(true)
    // caso coerente não dispara R4
    expect(outliersDe({ potencia_kw: 10, corrente_max_por_mppt: 15, n_mppts: 2 }).some(x => x.regra === 4)).toBe(false)
  })
  it('R5: campos críticos nulos', () => {
    expect(outliersDe({ potencia_kw: 5 }).some(x => x.regra === 5)).toBe(true)
  })
  it('toda suspeita traz justificativa', () => {
    for (const o of outliersDe({ potencia_kw: 30, peso_kg: 8, eficiencia_maxima: 200 }))
      expect(typeof o.justificativa).toBe('string')
  })
})

describe('READ-ONLY — auditoria não escreve no banco/fonte', () => {
  it('runAudit() não altera memory-storage.json', async () => {
    const antes = readFileSync(MEM, 'utf8')
    const rel = await runAudit()
    const depois = readFileSync(MEM, 'utf8')
    expect(depois).toBe(antes)                          // byte-idêntico
    expect(rel.meta.somente_leitura).toBe(true)
    expect(rel.meta.escreveu_no_banco).toBe(false)
  })
  it('verificação inicial registra persistência de topologia/entradas/strings', async () => {
    const rel = await runAudit()
    const v = rel.verificacao_inicial
    expect(v).toHaveProperty('tipo_topologia_persistido')
    expect(v).toHaveProperty('entradas_por_mppt_persistido')
    expect(v).toHaveProperty('strings_por_mppt_persistido')
    expect(v).toHaveProperty('mistura_de_formatos')
    expect(typeof v.conclusao).toBe('string')
  })
})
