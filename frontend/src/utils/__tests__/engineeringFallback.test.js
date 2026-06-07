import { describe, it, expect } from 'vitest'
import {
  aplicarFallbackEngenharia, statusDoCampo, STATUS, REGRAS_FALLBACK,
  CAMPOS_ENGENHARIA, ORIGEM_FALLBACK, podeSubstituir, ROLES_PODEM_SUBSTITUIR,
} from '../../../../backend/src/services/engineeringFallback.js'

/**
 * P1-ENGINEERING-FALLBACK-01 — camada conservadora RUNTIME-ONLY.
 */

describe('FASE 2 — fallback não muta o original (catálogo/Atlas intactos)', () => {
  it('o objeto de entrada permanece byte-idêntico após aplicar o fallback', () => {
    const real = { potencia_kw: 25, tensao_mppt_min: 180, tensao_mppt_max: 1000, n_mppts: 3 }
    const copiaAntes = JSON.parse(JSON.stringify(real))
    const { operacional } = aplicarFallbackEngenharia(real)
    expect(real).toEqual(copiaAntes)                 // original intocado
    expect(operacional).not.toBe(real)               // cópia distinta
  })
})

describe('FASE 4 — regra ATIVA é apenas tensao_partida', () => {
  it('só tensao_partida está ativa; demais documentadas e desligadas', () => {
    expect(REGRAS_FALLBACK.tensao_partida.ativa).toBe(true)
    const desligadas = Object.entries(REGRAS_FALLBACK).filter(([, r]) => !r.ativa).map(([k]) => k)
    expect(desligadas).toEqual(expect.arrayContaining(['n_mppts', 'strings_por_mppt', 'corrente_max_por_mppt', 'corrente_isc_max', 'peso_kg', 'dimensoes', 'grau_protecao_ip']))
  })
  it('NÃO preenche campos de regras desligadas (ex.: n_mppts ausente continua ausente)', () => {
    const { operacional, campos_inferidos } = aplicarFallbackEngenharia({ potencia_kw: 10, tensao_mppt_min: 200 })
    expect(operacional.n_mppts).toBeUndefined()
    expect(campos_inferidos).toEqual(['tensao_partida'])
  })
})

describe('FASE 2/4 — tensao_partida: valor conservador disponível para engenharia', () => {
  it('ausente + tem MPPT_min → usa o piso do MPPT (conservador)', () => {
    const { operacional, fallback } = aplicarFallbackEngenharia({ tensao_mppt_min: 180 })
    expect(operacional.tensao_partida).toBe(180)
    expect(fallback.tensao_partida.valor).toBe(180)
  })
  it('ausente + sem MPPT_min → default conservador 200 V', () => {
    const { operacional } = aplicarFallbackEngenharia({ potencia_kw: 5 })
    expect(operacional.tensao_partida).toBe(200)
  })
  it('presente → NÃO sobrescreve (sem fallback)', () => {
    const { operacional, fallback } = aplicarFallbackEngenharia({ tensao_partida: 250, tensao_mppt_min: 180 })
    expect(operacional.tensao_partida).toBe(250)
    expect(fallback.tensao_partida).toBeUndefined()
  })
})

describe('FASE 3 — rastreabilidade: proveniência do valor inferido', () => {
  it('carrega origem=fallback_conservador, confianca=baixa, motivo=campo_ausente', () => {
    const { fallback } = aplicarFallbackEngenharia({ tensao_mppt_min: 180 })
    expect(fallback.tensao_partida).toMatchObject({ origem: ORIGEM_FALLBACK, confianca: 'baixa', motivo: 'campo_ausente' })
  })
})

describe('FASE 5 — contrato de status p/ UI', () => {
  it('campo com fallback → fallback_conservador', () => {
    const { real, fallback } = { real: {}, fallback: { tensao_partida: {} } }
    expect(statusDoCampo('tensao_partida', { real, fallback })).toBe(STATUS.FALLBACK)
  })
  it('inferido_alta → inferido_forte; extraído → extraido; validado → validado', () => {
    expect(statusDoCampo('n_mppts', { real: { n_mppts: 2 }, statusExtracao: { n_mppts: 'inferido_alta' } })).toBe(STATUS.INFERIDO_FORTE)
    expect(statusDoCampo('potencia_kw', { real: { potencia_kw: 10 } })).toBe(STATUS.EXTRAIDO)
    expect(statusDoCampo('potencia_kw', { real: { potencia_kw: 10 }, validado: true })).toBe(STATUS.VALIDADO)
  })
})

describe('FASE 6 — permissão de substituição futura', () => {
  it('roles permitidos: engenheiro, técnico, administrador', () => {
    expect(ROLES_PODEM_SUBSTITUIR).toEqual(['engenheiro', 'tecnico', 'administrador'])
    expect(podeSubstituir('Engenheiro')).toBe(true)
    expect(podeSubstituir('vendedor')).toBe(false)
  })
})

describe('FASE 1 — classificação de campos', () => {
  it('tensao_partida é IMPORTANTE; potência/MPPT são CRÍTICOS', () => {
    expect(CAMPOS_ENGENHARIA.IMPORTANTE).toContain('tensao_partida')
    expect(CAMPOS_ENGENHARIA.CRITICO).toEqual(expect.arrayContaining(['potencia_kw', 'n_mppts', 'tensao_max_entrada']))
  })
})
