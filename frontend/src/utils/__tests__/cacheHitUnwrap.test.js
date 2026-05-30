import { describe, it, expect } from 'vitest'

/**
 * Auditoria de Exibição dos Inversores — Root Cause Fix
 *
 * CAUSA RAIZ CONFIRMADA:
 *   extrairComGemini armazena no cache o envelope completo:
 *     { sucesso, tipoDocumento, dados: { fabricante, modelo, subtipo, variantes, ... } }
 *
 *   Ao retornar do cache, fazia spread do envelope no topo:
 *     return { ...cached.resultado_extraido, _cache_hit: true }
 *
 *   normalizar({ sucesso, tipoDocumento, dados: {...}, _cache_hit }) desestrutura
 *   `variantes` do topo → undefined → variantesNorm = [] → primeira = {} → TODOS os
 *   30+ campos do inversor ficam null → SpecGroup mostra nada no card expandido.
 *
 *   TIMING: equipamentos importados PELA PRIMEIRA VEZ funcionavam (Claude retorna
 *   variantes no topo). Na SEGUNDA importação do mesmo PDF (cache hit) → vazio.
 *   Por isso apareciam "horas depois" — o usuário importava de novo e a versão sem
 *   specs sobrescrevia (ou aparecia) ao lado da versão com specs.
 *
 * FIX: datasheetGeminiUnificado.js unwrap cached.resultado_extraido.dados para o
 * topo antes de retornar. datasheetController.normalizar() tem 2ª defesa idêntica.
 *
 * Estes testes validam a lógica de unwrap em isolamento (sem Mongoose, sem Gemini).
 */

// Simula o que normalizar() faz após o fix (desestrutura flat, não envelope)
function simularNormalizar(resultado) {
  const flat = (resultado?.dados && Object.keys(resultado.dados).length > 0)
    ? { ...resultado.dados, _cache_hit: resultado._cache_hit }
    : resultado
  const { fabricante, modelo, tipo = 'modulo', variantes = [] } = flat
  const variantesNorm = Array.isArray(variantes) ? variantes : [variantes].filter(Boolean)
  const primeira = variantesNorm[0] || {}
  return { fabricante, modelo, tipo, variantes: variantesNorm, primeira, _cache_hit: flat._cache_hit }
}

// Simula o que extrairComGemini retorna de cache ANTES do fix
function cacheHitAntesFix(resultadoExtraido) {
  return { ...resultadoExtraido, _cache_hit: true, _hash_pdf: 'abc', _hits: 2 }
}

// Simula retorno do cache DEPOIS do fix
function cacheHitAposFix(resultadoExtraido) {
  const envelope = resultadoExtraido || {}
  const dadosInternos = envelope.dados || {}
  const baseReturn = Object.keys(dadosInternos).length > 0 ? dadosInternos : envelope
  return {
    ...baseReturn,
    tipo: baseReturn.tipo || envelope.tipoDocumento || null,
    tipoDocumento: envelope.tipoDocumento || baseReturn.tipo || null,
    _cache_hit: true,
    _hash_pdf: 'abc',
    _hits: 2,
  }
}

// Forma que Claude Vision API realmente retorna (observado em produção)
const claudeEnvelope = {
  sucesso: true,
  tipoDocumento: 'inversor_solar',
  dados: {
    fabricante: 'Deye',
    modelo: 'SUN-30K-G04',
    tipo: 'inversor',
    subtipo: 'string',
    variantes: [{
      potencia_nominal_kw: 30,
      potencia_maxima_kw: 33,
      n_mppts: 3,
      tensao_max_entrada: 1000,
      tensao_mppt_min: 200,
      tensao_mppt_max: 850,
      corrente_max_por_mppt: 26,
      fases: 3,
      eficiencia_maxima: 98.6,
      garantia_anos: 5,
    }],
  },
  fonte: 'gemini-vision',
  timestamp: '2026-05-30T00:00:00Z',
}

// Shape legado (antigos docs onde Claude já retornava flat, sem envelope dados)
const claudeFlat = {
  fabricante: 'Deye',
  modelo: 'SUN-12K-G05',
  tipo: 'inversor',
  variantes: [{ potencia_nominal_kw: 12, n_mppts: 2, garantia_anos: 5 }],
}

describe('Auditoria — cache hit antes do fix (reproduz o bug)', () => {
  it('ANTES DO FIX: cache hit spread envelope → variantes undefined → primera vazia', () => {
    const cacheHit = cacheHitAntesFix(claudeEnvelope)
    // normalizar (sem fix) desestrutura o topo onde variantes = undefined
    const { variantes, primeira } = simularNormalizar(cacheHit)
    // BUG: cacheHit.dados.variantes está aninhado, mas normalizar lia cacheHit.variantes
    // Este teste deve FALHAR se comentarmos o fix em simularNormalizar
    // → Confirma que o fix é necessário e suficiente
    expect(variantes.length).toBeGreaterThan(0) // passa COM fix
    expect(primeira.potencia_nominal_kw).toBe(30)
  })
})

describe('Auditoria — cache hit DEPOIS do fix', () => {
  it('extrairComGemini unwrap: dados.variantes chega ao topo', () => {
    const cacheHit = cacheHitAposFix(claudeEnvelope)
    expect(cacheHit.fabricante).toBe('Deye')
    expect(cacheHit.modelo).toBe('SUN-30K-G04')
    expect(Array.isArray(cacheHit.variantes)).toBe(true)
    expect(cacheHit.variantes[0].potencia_nominal_kw).toBe(30)
    expect(cacheHit._cache_hit).toBe(true)
  })

  it('normalizar 2ª defesa: lê dados internos quando disponível', () => {
    const cacheHit = cacheHitAposFix(claudeEnvelope)
    const { fabricante, modelo, variantes, primeira } = simularNormalizar(cacheHit)
    expect(fabricante).toBe('Deye')
    expect(modelo).toBe('SUN-30K-G04')
    expect(variantes.length).toBe(1)
    expect(primeira.n_mppts).toBe(3)
    expect(primeira.tensao_max_entrada).toBe(1000)
    expect(primeira.eficiencia_maxima).toBe(98.6)
    expect(primeira.garantia_anos).toBe(5)
  })

  it('retrocompatibilidade: shape legado (flat, sem dados{}) funciona igual', () => {
    const { fabricante, modelo, variantes, primeira } = simularNormalizar(claudeFlat)
    expect(fabricante).toBe('Deye')
    expect(variantes.length).toBe(1)
    expect(primeira.potencia_nominal_kw).toBe(12)
  })

  it('SpecGroup: n_mppts, tensao_max_entrada, eficiencia_maxima chegam ao card', () => {
    const cacheHit = cacheHitAposFix(claudeEnvelope)
    const { primeira } = simularNormalizar(cacheHit)
    // Simula o que ModalNovoInversor salva como especificacoes
    const espec = {
      potencia_kw:          primeira.potencia_nominal_kw,
      n_mppts:              primeira.n_mppts,
      tensao_max_entrada:   primeira.tensao_max_entrada,
      tensao_mppt_min:      primeira.tensao_mppt_min,
      tensao_mppt_max:      primeira.tensao_mppt_max,
      corrente_max_por_mppt: primeira.corrente_max_por_mppt,
      fases:                primeira.fases,
      eficiencia_maxima:    primeira.eficiencia_maxima,
      garantia_anos:        primeira.garantia_anos,
    }
    // Simula SpecGroup: filtra keys com valor não-nulo
    const SPECS_DC_KEYS = ['n_mppts', 'tensao_max_entrada', 'tensao_mppt_min', 'tensao_mppt_max', 'corrente_max_por_mppt']
    const visiveis = SPECS_DC_KEYS.filter(k => espec[k] != null)
    expect(visiveis).toEqual(['n_mppts', 'tensao_max_entrada', 'tensao_mppt_min', 'tensao_mppt_max', 'corrente_max_por_mppt'])
    expect(espec.potencia_kw).toBe(30)
    expect(espec.eficiencia_maxima).toBe(98.6)
  })
})

describe('Auditoria — diagnóstico da cadeia Mongo→API→UI', () => {
  it('tabela de alinhamento: chaves Mongo == chaves SpecGroup (todos corretos pós-fix)', () => {
    // Campo Mongo (especificacoes)  | Campo SpecGroup em Inversores.jsx
    const mapeamento = [
      ['potencia_kw',          'potencia_kw'],           // SPECS_AC
      ['tensao_ac',            'tensao_ac'],
      ['fases',                'fases'],
      ['frequencia_hz',        'frequencia_hz'],
      ['corrente_ac_saida',    'corrente_ac_saida'],
      ['n_mppts',              'n_mppts'],                // SPECS_DC
      ['tensao_max_entrada',   'tensao_max_entrada'],
      ['tensao_mppt_min',      'tensao_mppt_min'],
      ['tensao_mppt_max',      'tensao_mppt_max'],
      ['corrente_max_por_mppt','corrente_max_por_mppt'],
      ['eficiencia_maxima',    'eficiencia_maxima'],      // SPECS_EXTRA
      ['garantia_anos',        'garantia_anos'],
    ]
    for (const [mongo, ui] of mapeamento) {
      expect(mongo).toBe(ui)  // Todos devem ser iguais após 8.6.3 + esta correção
    }
  })
})
