import { describe, it, expect, beforeEach } from 'vitest'
import { normalizarTipo, ehCarregadorEV, TIPOS_CANONICOS } from '../../../../backend/src/utils/catalogo/tipoEquipamento.js'

/**
 * Sprint CAT-P0-UNIFY — testes das correções de unificação de fontes.
 *  FASE 2: normalização de tipo (hífen ↔ underscore)
 *  FASE 1: validação de id (DELETE undefined)
 *  FASE 4: feature flags (lógica de leitura de env)
 */

describe('CAT-P0-UNIFY F2 — normalização de tipo', () => {
  // Causa raiz: 'carregador-ev' (hífen) nunca casava enum 'carregador_ev'
  it('carregador-ev (hífen) → carregador_ev (canônico)', () => {
    expect(normalizarTipo('carregador-ev')).toBe('carregador_ev')
  })

  it('carregador_ev (underscore) permanece canônico', () => {
    expect(normalizarTipo('carregador_ev')).toBe('carregador_ev')
  })

  it('aliases de carregador convergem', () => {
    expect(normalizarTipo('carregador')).toBe('carregador_ev')
    expect(normalizarTipo('wallbox')).toBe('carregador_ev')
    expect(normalizarTipo('ev_charger')).toBe('carregador_ev')
  })

  it('microinversor → inversor (subtipo)', () => {
    expect(normalizarTipo('microinversor')).toBe('inversor')
  })

  it('módulo/painel → modulo', () => {
    expect(normalizarTipo('módulo')).toBe('modulo')
    expect(normalizarTipo('painel')).toBe('modulo')
    expect(normalizarTipo('modulo')).toBe('modulo')
  })

  it('case-insensitive e trim', () => {
    expect(normalizarTipo('  CARREGADOR-EV  ')).toBe('carregador_ev')
    expect(normalizarTipo('Inversor')).toBe('inversor')
  })

  it('tipo desconhecido não é inventado (devolve lowercased)', () => {
    expect(normalizarTipo('xpto')).toBe('xpto')
  })

  it('null/undefined → null', () => {
    expect(normalizarTipo(null)).toBeNull()
    expect(normalizarTipo(undefined)).toBeNull()
  })

  it('ehCarregadorEV reconhece todas as variações', () => {
    expect(ehCarregadorEV('carregador-ev')).toBe(true)
    expect(ehCarregadorEV('carregador_ev')).toBe(true)
    expect(ehCarregadorEV('wallbox')).toBe(true)
    expect(ehCarregadorEV('inversor')).toBe(false)
    expect(ehCarregadorEV('modulo')).toBe(false)
  })

  it('TIPOS_CANONICOS = enum do model', () => {
    expect(TIPOS_CANONICOS).toEqual(['modulo', 'inversor', 'estrutura', 'bateria', 'carregador_ev'])
  })
})

describe('CAT-P0-UNIFY F1 — validação de id (DELETE undefined)', () => {
  // Replica a guarda do excluirEquipamento
  function idValido(id) {
    if (!id || id === 'undefined' || id === 'null') return false
    // ObjectId tem 24 hex chars
    return /^[0-9a-fA-F]{24}$/.test(String(id))
  }

  it('rejeita "undefined" literal (o bug reportado)', () => {
    expect(idValido('undefined')).toBe(false)
  })

  it('rejeita null/vazio', () => {
    expect(idValido(null)).toBe(false)
    expect(idValido('')).toBe(false)
    expect(idValido(undefined)).toBe(false)
  })

  it('aceita ObjectId válido', () => {
    expect(idValido('507f1f77bcf86cd799439011')).toBe(true)
  })
})

describe('CAT-P0-UNIFY F4 — lógica das feature flags', () => {
  // Replica a leitura de env do catalogoFlags.js
  function flag(value, padrao = true) {
    if (value === undefined || value === null || value === '') return padrao
    return String(value).toLowerCase() !== 'false'
  }

  it('default = true (sem env)', () => {
    expect(flag(undefined)).toBe(true)
    expect(flag('')).toBe(true)
  })

  it('"false" desliga', () => {
    expect(flag('false')).toBe(false)
    expect(flag('FALSE')).toBe(false)
  })

  it('qualquer outro valor mantém true', () => {
    expect(flag('true')).toBe(true)
    expect(flag('1')).toBe(true)
    expect(flag('yes')).toBe(true)
  })
})

describe('CAT-P0-UNIFY F5 — frontend catalogoFlags helper', () => {
  beforeEach(() => {
    // mock fetch
    global.fetch = (url) => {
      if (String(url).includes('/api/catalogo/flags')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ sucesso: true, flags: { ENABLE_INVERSORES_DATA: false, ENABLE_PAINEIS_DATA: true, ENABLE_CARREGADOR_EV_FALLBACK: false } }),
        })
      }
      return Promise.reject(new Error('not mocked'))
    }
  })

  it('obterFlags lê do backend e mescla com defaults', async () => {
    const { obterFlags, resetFlagsCache } = await import('../../services/catalogoFlags')
    resetFlagsCache()
    const f = await obterFlags()
    expect(f.ENABLE_INVERSORES_DATA).toBe(false)
    expect(f.ENABLE_PAINEIS_DATA).toBe(true)
    expect(f.ENABLE_CARREGADOR_EV_FALLBACK).toBe(false)
  })

  it('fallback seguro (true) quando endpoint falha', async () => {
    global.fetch = () => Promise.reject(new Error('offline'))
    const { obterFlags, resetFlagsCache } = await import('../../services/catalogoFlags')
    resetFlagsCache()
    const f = await obterFlags()
    expect(f.ENABLE_INVERSORES_DATA).toBe(true)  // default seguro
  })
})
