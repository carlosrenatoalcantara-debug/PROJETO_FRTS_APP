import { describe, it, expect } from 'vitest'
import {
  montarPayloadEngenharia, badgeDe, BADGES, CAMPOS_EXIBICAO,
  validarSubstituicaoManual, PAYLOAD_SUBSTITUICAO,
} from '../../../../backend/src/services/engineeringPresentation.js'
import { STATUS } from '../../../../backend/src/services/engineeringFallback.js'

/**
 * P1-ENGINEERING-INTEGRATION-01 — exibição de proveniência + correção manual (contrato).
 * Tudo PURO: não grava no Atlas, não muta o catálogo.
 */

describe('FASE 3 — badges', () => {
  it('mapeia os 4 status com emoji e marca o fallback como NÃO-real', () => {
    expect(badgeDe(STATUS.EXTRAIDO).emoji).toBe('🟢')
    expect(badgeDe(STATUS.VALIDADO).emoji).toBe('🔵')
    expect(badgeDe(STATUS.INFERIDO_FORTE).emoji).toBe('🟡')
    expect(badgeDe(STATUS.FALLBACK).emoji).toBe('🟠')
    expect(BADGES[STATUS.FALLBACK].real).toBe(false)     // fallback não é dado real
    expect(BADGES[STATUS.EXTRAIDO].real).toBe(true)
  })
})

describe('FASE 2/4 — payload de exibição com justificativa', () => {
  const real = { potencia_kw: 25, tensao_mppt_min: 180, tensao_mppt_max: 1000, n_mppts: 3 }
  it('não muta o equipamento real (Atlas intacto)', () => {
    const copia = JSON.parse(JSON.stringify(real))
    montarPayloadEngenharia(real)
    expect(real).toEqual(copia)
  })
  it('campo extraído → 🟢 Extraído, real=true, sem justificativa', () => {
    const { campos } = montarPayloadEngenharia(real)
    expect(campos.potencia_kw.status).toBe(STATUS.EXTRAIDO)
    expect(campos.potencia_kw.badge.emoji).toBe('🟢')
    expect(campos.potencia_kw.real).toBe(true)
    expect(campos.potencia_kw.justificativa).toBeUndefined()
  })
  it('tensao_partida ausente → 🟠 Fallback com justificativa origem/confiança/motivo', () => {
    const { campos, tem_fallback, fallback_aplicado } = montarPayloadEngenharia(real)
    expect(campos.tensao_partida.status).toBe(STATUS.FALLBACK)
    expect(campos.tensao_partida.badge.emoji).toBe('🟠')
    expect(campos.tensao_partida.real).toBe(false)
    expect(campos.tensao_partida.valor).toBe(180)        // = mppt_min (conservador)
    expect(campos.tensao_partida.substituivel).toBe(true)
    expect(campos.tensao_partida.justificativa).toMatchObject({ origem: 'fallback_conservador', confianca: 'baixa', motivo: 'campo_ausente' })
    expect(campos.tensao_partida.justificativa.texto).toMatch(/fallback_conservador.*baixa.*campo ausente/)
    expect(tem_fallback).toBe(true)
    expect(fallback_aplicado).toEqual(['tensao_partida'])
  })
  it('campo inferido_alta → 🟡 Inferido (real)', () => {
    const { campos } = montarPayloadEngenharia(real, { statusExtracao: { n_mppts: 'inferido_alta' } })
    expect(campos.n_mppts.status).toBe(STATUS.INFERIDO_FORTE)
    expect(campos.n_mppts.badge.emoji).toBe('🟡')
  })
  it('valor real presente NÃO é marcado como fallback', () => {
    const { campos } = montarPayloadEngenharia({ ...real, tensao_partida: 200 })
    expect(campos.tensao_partida.status).toBe(STATUS.EXTRAIDO)
    expect(campos.tensao_partida.justificativa).toBeUndefined()
  })
})

describe('FASE 5 — substituição manual (validação de contrato, SEM gravar)', () => {
  const payload = { equipamento_id: '6a1edcda0ad225bb78a33ade', campo: 'tensao_partida', valor_real: 240 }
  it('role autorizada + payload válido → ok, e descreve o efeito (sem executar)', () => {
    const r = validarSubstituicaoManual(payload, 'engenheiro')
    expect(r.ok).toBe(true)
    expect(r.erros).toEqual([])
    expect(r.efeito.acao).toBe('gravar_valor_real_no_atlas')   // descrito, não feito
    expect(r.efeito.remove_fallback).toBe('fallback_conservador')
  })
  it('role NÃO autorizada → erro', () => {
    expect(validarSubstituicaoManual(payload, 'vendedor').ok).toBe(false)
    expect(validarSubstituicaoManual(payload, 'vendedor').erros).toContain('role_nao_autorizada')
  })
  it('payload incompleto → erros específicos, efeito null', () => {
    const r = validarSubstituicaoManual({ campo: 'x' }, 'administrador')
    expect(r.ok).toBe(false)
    expect(r.erros).toEqual(expect.arrayContaining(['equipamento_id_invalido', 'valor_real_ausente']))
    expect(r.efeito).toBeNull()
  })
  it('contrato de payload documentado', () => {
    expect(PAYLOAD_SUBSTITUICAO).toHaveProperty('valor_real')
    expect(CAMPOS_EXIBICAO).toContain('tensao_partida')
  })
})
