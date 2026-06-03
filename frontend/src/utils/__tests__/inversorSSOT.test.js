import { describe, it, expect } from 'vitest'
import { lerInversor, paraDimensionamento, valorCampo } from '../../../../backend/src/equipamentos/inversores/index.js'
import { processarEquipamento, _internals } from '../../../../backend/src/services/catalogoQualidade.js'
import { extrairSpecsInversor } from '../../../../backend/src/services/compatibilidadeFV.js'
import { validarEquipamento } from '../catalogQualityEngine.js'

/**
 * P0-INV-SSOT-01 — Single Source of Truth dos inversores.
 *
 * Prova que catálogo (frontend), qualidade (backend) e dimensionamento leem o
 * MESMO objeto persistido via o dicionário canônico único, e que a divergência
 * histórica (campos presentes lidos como null) desapareceu.
 */

// Vocabulário do PARSER (o que o sistema realmente grava no Mongo)
const AMOSTRAS = {
  GoodWe:    { potencia_kw:17, n_mppts:2, strings_por_mppt:2, tensao_max_entrada:1000, tensao_mppt_min:260, tensao_mppt_max:850, tensao_ac:380, corrente_isc_max:27.5, eficiencia_maxima:98.6, fases:3 },
  Solis:     { potencia_kw:10, n_mppts:2, strings_por_mppt:1, tensao_max_entrada:1000, tensao_mppt_min:90,  tensao_mppt_max:850, tensao_ac:380, corrente_isc_max:20,   eficiencia_maxima:98.7, fases:3 },
  SAJ:       { potencia_kw:8,  n_mppts:2, tensao_max_entrada:1000, tensao_mppt_min:90,  tensao_mppt_max:850, tensao_ac:380, corrente_isc_max:25, eficiencia_maxima:98.2, fases:3 },
  Deye:      { potencia_kw:8,  n_mppts:2, tensao_max_entrada:1000, tensao_mppt_min:80,  tensao_mppt_max:850, tensao_ac:380, corrente_isc_max:26, eficiencia_maxima:98.3, fases:3 },
  Solplanet: { potencia_kw:15, n_mppts:2, tensao_max_entrada:1000, tensao_mppt_min:200, tensao_mppt_max:850, tensao_ac:380, corrente_isc_max:26, eficiencia_maxima:98.3, fases:3 },
}

// Réplica do normalizador ANTES da SSOT (pick legado) para medir regressão.
function completudeAntes(eq) {
  const esp = eq.especificacoes
  const pick = (ks) => { for (const k of ks) { const v = esp[k]; if (v!=null&&v!=='') return v } return null }
  const n = (v) => (v==null||v===''||!Number.isFinite(Number(v))?null:Number(v))
  const sc = {
    potencia_kw_ca:n(pick(['potencia_kw','potencia_kw_ca'])), fases_saida:n(pick(['fases','fases_saida'])),
    tensao_saida_v:n(pick(['tensao_saida_v','tensao_saida','tensao_nominal_v'])),
    voc_max_dc_v:n(pick(['voc_max_dc','voc_max_dc_v','vpv_max'])), mppt_min_v:n(pick(['mppt_min_v','faixa_mppt_min'])),
    mppt_max_v:n(pick(['mppt_max_v','faixa_mppt_max'])), isc_max_por_mppt_a:n(pick(['isc_max_mppt','ipv_max'])),
    n_mppts:n(pick(['n_mppts'])), eficiencia_max_pct:n(pick(['eficiencia_max','eficiencia'])),
  }
  return _internals.calcularCompletude(eq, sc).score
}

describe('SSOT — dicionário canônico lê o vocabulário do parser', () => {
  it('lerInversor resolve os nomes que o parser grava', () => {
    const c = lerInversor(AMOSTRAS.GoodWe)
    expect(c.tensao_max_entrada).toBe(1000)
    expect(c.tensao_mppt_min).toBe(260)
    expect(c.corrente_isc_max).toBe(27.5)
    expect(c.eficiencia_maxima).toBe(98.6)
    expect(c.tensao_ac).toBe(380)
  })

  it('compatibilidade: vocabulário LEGADO (seed) continua sendo lido', () => {
    const legado = { potencia_kw:5, vpv_max:600, ipv_max:32, eficiencia:97.2, entrada_monofalor:true }
    const c = lerInversor(legado)
    expect(c.tensao_max_entrada).toBe(600)      // vpv_max
    expect(c.corrente_max_por_mppt).toBe(32)    // ipv_max
    expect(c.eficiencia_maxima).toBe(97.2)      // eficiencia
    expect(c.fases).toBe(1)                      // entrada_monofalor
  })
})

describe('0 divergência: Catálogo ≈ Qualidade ≈ Dimensionamento (5 fabricantes)', () => {
  for (const [marca, esp] of Object.entries(AMOSTRAS)) {
    const eq = { tipo:'inversor', fabricante:marca, modelo:`${marca}-TST`, especificacoes:esp }

    it(`${marca}: completude sobe de ~45% para 100% (bug eliminado)`, () => {
      expect(completudeAntes(eq)).toBeLessThan(60)          // ANTES: campos presentes lidos como null
      const r = processarEquipamento(eq)
      expect(r.qualidade.completude_score).toBe(100)        // DEPOIS: SSOT lê tudo
    })

    it(`${marca}: Qualidade (backend) e Dimensionamento usam os MESMOS valores`, () => {
      const sc = _internals.normalizarSpecsInversor(eq)
      const dim = extrairSpecsInversor(eq)
      expect(dim.voc_max_dc).toBe(sc.voc_max_dc_v)
      expect(dim.mppt_min_v).toBe(sc.mppt_min_v)
      expect(dim.mppt_max_v).toBe(sc.mppt_max_v)
      expect(dim.isc_max_mppt).toBe(sc.isc_max_por_mppt_a)
      expect(dim.n_mppts).toBe(sc.n_mppts)
    })

    it(`${marca}: Catálogo (frontend engine) também marca 100% de completude`, () => {
      const v = validarEquipamento(eq)
      // Alinhamento real = COMPLETUDE (cobertura de campos). Idêntica à qualidade backend.
      expect(v.completude_score).toBe(100)
      // O score combinado pondera confiança (axis de proveniência) — base 70 no front.
      expect(v.score).toBeGreaterThanOrEqual(80)
    })
  }
})

describe('score_global reflete proveniência (não regride dados reais)', () => {
  it('inversor 100% completo + origem manual → score_global ≈ 100', () => {
    const eq = { tipo:'inversor', fabricante:'GoodWe', modelo:'GW17K-DT',
      especificacoes: AMOSTRAS.GoodWe, origem:{ tipo:'manual', em:new Date() } }
    const r = processarEquipamento(eq)
    expect(r.qualidade.completude_score).toBe(100)
    expect(r.qualidade.score_global).toBeGreaterThanOrEqual(95)
  })
})
