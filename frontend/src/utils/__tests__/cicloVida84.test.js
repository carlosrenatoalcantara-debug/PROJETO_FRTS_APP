import { describe, it, expect } from 'vitest'
import { formatarDataSegura, isDataValida } from '../dataSegura'
import {
  STATUS, derivarStatusSeguro, podeExcluirDefinitivo, avaliarLegacy, MOTIVOS_ARQUIVAMENTO,
} from '../../../../backend/src/utils/statusLifecycle.js'

/**
 * Sprint 8.4 — Higiene Operacional e Ciclo de Vida.
 */
describe('S8.4 — status seguro (compat projetos antigos)', () => {
  // 1) Projeto antigo SEM status: cai em RASCUNHO; com freeze → PROPOSTA; com assinatura → APROVADO.
  it('deriva status seguro de projetos legados', () => {
    expect(derivarStatusSeguro({})).toBe('RASCUNHO')
    expect(derivarStatusSeguro({ governanca: { freeze_status: 'CONGELADO' } })).toBe('PROPOSTA')
    expect(derivarStatusSeguro({ governanca: { freeze_status: 'HOMOLOGADO' } })).toBe('PROPOSTA')
    expect(derivarStatusSeguro({ governanca: { comercial: { assinaturas: [{ hash: 'x' }] } } })).toBe('APROVADO')
  })

  it('respeita status existente (mapeia legados → ciclo canônico)', () => {
    expect(derivarStatusSeguro({ status: 'em_simulacao' })).toBe('RASCUNHO')
    expect(derivarStatusSeguro({ status: 'aprovado' })).toBe('APROVADO')
    expect(derivarStatusSeguro({ status: 'em_execucao' })).toBe('EXECUCAO')
    expect(STATUS).toContain('ARQUIVADO')
  })
})

describe('S8.4 — exclusão segura', () => {
  // 2) Hard delete só em rascunho + sem freeze + sem assinatura + sem documentos.
  it('permite hard delete em rascunho limpo', () => {
    expect(podeExcluirDefinitivo({ status: 'rascunho' })).toBe(true)
    expect(podeExcluirDefinitivo({})).toBe(true) // sem status → RASCUNHO
  })
  it('bloqueia hard delete quando há freeze/assinatura/documentos', () => {
    expect(podeExcluirDefinitivo({ governanca: { freeze_status: 'CONGELADO' } })).toBe(false)
    expect(podeExcluirDefinitivo({ governanca: { comercial: { assinaturas: [{}] } } })).toBe(false)
    expect(podeExcluirDefinitivo({ documentos_tecnicos: [{ _id: 'd' }] })).toBe(false)
  })
})

describe('S8.4 — legacy checker', () => {
  // 3) Detecta cliente ausente, data inválida, snapshot ausente.
  it('sinaliza projeto legado com motivos', () => {
    const r = avaliarLegacy({
      // sem cliente, sem _schema, data quebrada, freeze sem snapshots
      createdAt: 'foo',
      governanca: { freeze_status: 'CONGELADO' },
    })
    expect(r.legacy).toBe(true)
    expect(r.motivos).toEqual(expect.arrayContaining(['cliente_ausente', 'data_invalida', 'schema_antigo', 'snapshot_ausente']))
    expect(r.necessita_revisao).toBe(true)
  })

  it('motivos de arquivamento exigidos pela spec', () => {
    expect(MOTIVOS_ARQUIVAMENTO).toEqual(['Cliente desistiu', 'Duplicado', 'Teste', 'Perdeu venda', 'Outro'])
  })
})

describe('S8.4 — data segura (sem "Invalid Date" na UI)', () => {
  // 4) Nunca devolve "Invalid Date"; usa fallback.
  it('formata data válida e devolve fallback para inválidas', () => {
    expect(isDataValida('foo')).toBe(false)
    expect(isDataValida('2026-05-29')).toBe(true)
    expect(formatarDataSegura('foo')).toBe('—')
    expect(formatarDataSegura(null, { fallback: 'sem data' })).toBe('sem data')
    // qualquer ISO válida produz string não-vazia ≠ "Invalid Date"
    const ok = formatarDataSegura('2026-05-29T12:00:00Z')
    expect(ok).not.toBe('Invalid Date')
    expect(ok.length).toBeGreaterThan(0)
  })
})
