import { describe, it, expect } from 'vitest'
import { detectarConcessionaria, CONCESSIONARIAS_SUPORTADAS } from '../../../../backend/src/utils/fatura/concessionariaDetector.js'
import { parsearFatura, extrairHistorico, detectarGD, detectarLigacao, extrairGrupoA } from '../../../../backend/src/utils/fatura/faturaParser.js'
import { validarFatura, detectarDuplicidade } from '../../../../backend/src/utils/fatura/faturaValidador.js'
import { montarFaturaInteligente } from '../../../../backend/src/services/faturaIntelligenceService.js'

/**
 * Sprint 8.5 — Inteligência de Fatura.
 * Os endpoints HTTP exigem Mongo vivo; aqui testamos os helpers puros que são o
 * coração da "interpretação" e que rodam offline.
 */
describe('S8.5 — detector de concessionária', () => {
  it('identifica COSERN (Neoenergia/RN) em texto de cabeçalho', () => {
    const r = detectarConcessionaria('COSERN COMPANHIA ENERGETICA DO RIO GRANDE DO NORTE — fatura mensal')
    expect(r.concessionaria).toBe('COSERN')
    expect(r.grupo).toBe('NEOENERGIA')
    expect(r.estado).toBe('RN')
    expect(r.confianca).toBeGreaterThan(0.6)
  })
  it('cai em OUTRA quando não reconhece (sem travar)', () => {
    const r = detectarConcessionaria('Distribuidora Local Imaginária Ltda')
    expect(r.concessionaria).toBe('OUTRA')
    expect(r.confianca).toBe(0.2)
  })
  it('inclui Equatorial entre as suportadas (lista completa)', () => {
    expect(CONCESSIONARIAS_SUPORTADAS.some((c) => c.id.startsWith('EQUATORIAL'))).toBe(true)
  })
})

describe('S8.5 — parser inteligente', () => {
  const texto = `COSERN — Fatura de energia elétrica
    Unidade Consumidora: 12345678
    CPF/CNPJ: 123.456.789-00  CEP: 59000-000
    Tipo de ligação: Trifásico  Tensão: 380V
    Histórico de Consumo:
      JAN/26 450  FEV/26 480  MAR/26 510  ABR/26 470  MAI/26 500  JUN/26 520
      JUL/26 530  AGO/26 540  SET/26 510  OUT/26 490  NOV/26 470  DEZ/26 460
    Consumo faturado 460 kWh`

  it('extrai histórico 12 meses sem duplicados', () => {
    const h = extrairHistorico(texto)
    expect(h.itens.length).toBe(12)
    expect(h.historico_incompleto).toBe(false)
    expect(h.meses_repetidos).toBe(false)
  })

  it('detecta ligação trifásica com alta confiança', () => {
    expect(detectarLigacao(texto)).toEqual({ tipo: 'trifasico', confianca: 0.95 })
  })

  it('monta fatura normalizada com campos {valor,fonte,confianca}', () => {
    const f = parsearFatura(texto, { fonte: 'PDF' })
    expect(f.unidade_consumidora.numero_uc.valor).toBe('12345678')
    expect(f.unidade_consumidora.numero_uc.confianca).toBeGreaterThan(0.5)
    expect(f.cliente.cpf_cnpj.valor).toMatch(/123\.456\.789-00/)
    expect(f.ligacao.tipo.valor).toBe('trifasico')
    expect(f.analise.consumo_medio_12m).toBeGreaterThan(400)
  })
})

describe('S8.5 — detecção de GD (SCEE) sem confundir com consumo', () => {
  it('marca possui_gd=true e alerta quando há "energia injetada"', () => {
    const r = detectarGD('SCEE — energia compensada 200 kWh; energia injetada 380 kWh')
    expect(r.possui_gd).toBe(true)
    expect(r.energia_injetada).toBe(380)
    expect(r.alerta).toMatch(/NÃO usar energia injetada/i)
  })
  it('possui_gd=false em fatura comum', () => {
    expect(detectarGD('Cliente residencial, consumo regular.').possui_gd).toBe(false)
  })
})

describe('S8.5 — Grupo A (kW × kWh)', () => {
  const textoA = `Cliente Grupo A — Modalidade Tarifária Verde
    Demanda contratada 75 kW   Demanda medida 68 kW
    Consumo Ponta 1500 kWh   Consumo Fora Ponta 8500 kWh`

  it('detecta Grupo A e extrai demanda em kW', () => {
    const g = extrairGrupoA(textoA)
    expect(g.eh_grupo_a).toBe(true)
    expect(g.modalidade).toBe('verde')
    expect(g.demanda_contratada).toBe(75)
    expect(g.consumo_fora_ponta).toBe(8500)
  })
})

describe('S8.5 — validação + service orquestrador', () => {
  it('histórico incompleto + GD geram alerta de revisão humana', () => {
    const texto = 'COSERN UC 99887766 — JAN/26 500 FEV/26 510 SCEE energia injetada 100'
    const r = montarFaturaInteligente({ texto })
    expect(r.necessita_revisao).toBe(true)
    expect(r.alertas.some((a) => a.campo === 'historico_consumo')).toBe(true)
    expect(r.alertas.some((a) => a.campo === 'geracao_existente')).toBe(true)
    expect(r.concessionaria_detectada.concessionaria).toBe('COSERN')
  })

  it('UC ausente → erro bloqueante', () => {
    const v = validarFatura({ unidade_consumidora: { numero_uc: { valor: null } }, flags: {}, geracao_existente: { possui_gd: { valor: false } } })
    expect(v.ok).toBe(false)
    expect(v.alertas.some((a) => a.severidade === 'erro')).toBe(true)
  })

  it('detecta duplicidade por mesma UC', () => {
    const a = { unidade_consumidora: { numero_uc: { valor: '12345' } } }
    const b = { unidade_consumidora: { numero_uc: { valor: '12345' } } }
    expect(detectarDuplicidade(a, b).duplicada).toBe(true)
  })
})
