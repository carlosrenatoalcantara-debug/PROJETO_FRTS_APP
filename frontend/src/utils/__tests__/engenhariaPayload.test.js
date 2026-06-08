import { describe, it, expect } from 'vitest'
import {
  payloadEngenharia, itemPorChave, visaoCanonica, DIALETO_CANONICO, STATUS,
} from '../engenharia/engenhariaPayload.js'

/**
 * P1-ENGINEERING-CONSUME-01 — ponte UI ↔ contratos de engenharia (frontend).
 * Puro: não grava no Atlas, não muta o equipamento.
 */

describe('dialeto → canônico', () => {
  it('mapeia chaves de exibição do catálogo para os campos canônicos', () => {
    expect(DIALETO_CANONICO.faixa_mppt_min).toBe('tensao_mppt_min')
    expect(DIALETO_CANONICO.mppts).toBe('n_mppts')
    expect(DIALETO_CANONICO.voc_max).toBe('tensao_max_entrada')
    expect(visaoCanonica({ especificacoes: { faixa_mppt_min: '180', mppts: 3 } })).toMatchObject({ tensao_mppt_min: 180, n_mppts: 3 })
  })
})

describe('payload + badges por chave de exibição', () => {
  const equip = { especificacoes: { potencia_kw: 25, faixa_mppt_min: 180, faixa_mppt_max: 1000, mppts: 3 } }
  it('não muta o equipamento de entrada', () => {
    const copia = JSON.parse(JSON.stringify(equip))
    payloadEngenharia(equip)
    expect(equip).toEqual(copia)
  })
  it('tensao_partida (ausente) → item 🟠 Fallback com justificativa', () => {
    const p = payloadEngenharia(equip)
    const item = itemPorChave(p, 'tensao_partida')
    expect(item.status).toBe(STATUS.FALLBACK)
    expect(item.badge.emoji).toBe('🟠')
    expect(item.valor).toBe(180)                       // = mppt_min (conservador)
    expect(item.real).toBe(false)
    expect(item.justificativa.origem).toBe('fallback_conservador')
  })
  it('voc_max presente → 🟢 Extraído (real, sem justificativa)', () => {
    const p = payloadEngenharia({ especificacoes: { voc_max: 1100, faixa_mppt_min: 180 } })
    const item = itemPorChave(p, 'voc_max')
    expect(item.status).toBe(STATUS.EXTRAIDO)
    expect(item.badge.emoji).toBe('🟢')
    expect(item.real).toBe(true)
  })
  it('chave sem mapeamento → null (não renderiza badge)', () => {
    expect(itemPorChave(payloadEngenharia(equip), 'campo_inexistente')).toBeNull()
  })
})
