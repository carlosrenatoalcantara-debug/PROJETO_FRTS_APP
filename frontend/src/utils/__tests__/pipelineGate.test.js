import { describe, it, expect } from 'vitest'
import { AIOrchestrator } from '../../../../backend/src/ai/AIOrchestrator.js'

/**
 * P0-PIPELINE-GATE-01 — guarda de identidade do AIOrchestrator.
 *
 * Causa raiz (P1-SOLAX-AUDIT-01): `extrair()` exigia fabricante&&modelo de TOPO
 * e descartava o resultado mesmo com `_meta.variantesRaw` cheio (fabricantes
 * novos auto-detectados, ex.: SolaX). Correção: aceitar se houver identidade OU
 * modelos válidos. Estes testes blindam os 4 casos de aceite.
 */

// Adapter stub que devolve um schema interno controlado (já normalizado).
function orquestradorCom(dados) {
  const adapter = { isConfigured: () => true, extract: async () => dados }
  return new AIOrchestrator({ adapters: { internal: adapter } })
}
const schema = (fabricante, modelo, variantesModelos) => ({
  fabricante, modelo, tipo: 'inversor', especificacoes: {},
  _meta: { variantesRaw: variantesModelos.map(m => ({ modelo_variante: m, potencia_kw: 5 })) },
})

describe('Guarda de identidade — 4 casos de aceite', () => {
  it('Caso 1: sem identidade, COM variantes → extração ACEITA', async () => {
    const orch = orquestradorCom(schema(null, null, ['X3-ULT-15K', 'X3-ULT-20K']))
    const r = await orch.extrairMulti({ textoOCR: 'x', pdfBuffer: Buffer.from('x') })
    expect(r.ok).toBe(true)
    expect(r.itens.length).toBe(2)
    expect(r.itens.map(i => i.modelo)).toEqual(['X3-ULT-15K', 'X3-ULT-20K'])
    const tin = r.tentativas.find(t => t.provider === 'internal')
    expect(tin.motivo).toBe('modelos_validos')
  })

  it('Caso 2: sem identidade, SEM variantes → FALHA', async () => {
    const orch = orquestradorCom(schema(null, null, []))
    const r = await orch.extrairMulti({ textoOCR: 'x', pdfBuffer: Buffer.from('x') })
    expect(r.ok).toBe(false)
    expect(r.itens.length).toBe(0)
    const tin = r.tentativas.find(t => t.provider === 'internal')
    expect(tin.motivo).toBe('sem_identidade_nem_modelos')
  })

  it('Caso 3: GoodWe GW25K-DT (identidade presente) → SEM regressão', async () => {
    const orch = orquestradorCom(schema('GoodWe', 'GW25K-DT', ['GW25K-DT']))
    const r = await orch.extrairMulti({ textoOCR: 'x', pdfBuffer: Buffer.from('x') })
    expect(r.ok).toBe(true)
    expect(r.itens.length).toBe(1)
    expect(r.itens[0].fabricante).toBe('GoodWe')
    expect(r.itens[0].modelo).toBe('GW25K-DT')
    const tin = r.tentativas.find(t => t.provider === 'internal')
    expect(tin.motivo).toBe('identidade')
  })

  it('Caso 4: fabricante NOVO (nunca visto) + modelos detectados → NÃO descarta', async () => {
    const orch = orquestradorCom(schema(null, null, ['NOVA-MARCA-10K', 'NOVA-MARCA-20K', 'NOVA-MARCA-30K']))
    const r = await orch.extrairMulti({ textoOCR: 'x', pdfBuffer: Buffer.from('x') })
    expect(r.ok).toBe(true)
    expect(r.itens.length).toBe(3)
    expect(r.itens.map(i => i.modelo)).toEqual(['NOVA-MARCA-10K', 'NOVA-MARCA-20K', 'NOVA-MARCA-30K'])
  })
})
