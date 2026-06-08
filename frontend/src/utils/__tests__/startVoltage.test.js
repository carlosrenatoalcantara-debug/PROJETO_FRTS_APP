import { describe, it, expect } from 'vitest'
import { extrairSpecsTecnicas } from '../../../../backend/src/ai/parserTecnicoInversor.js'
import { montarMatriz } from '../../../../backend/src/ai/parserMatricial.js'
import deye from '../../../../backend/src/ai/__fixtures__/golden/deye_2330.json'
import goodweDt from '../../../../backend/src/ai/__fixtures__/golden/goodwe_dt.json'
import huawei2 from '../../../../backend/src/ai/__fixtures__/golden/huawei_m2.json'

/**
 * P1-PARSER-STARTVOLTAGE-01 — extração REAL de tensao_partida.
 * Rótulos confirmados em fixtures: "Start Voltage" (Huawei/Chint), "Start-up Voltage"
 * (Goodwe DT), "Starting voltage" (Kehua), "Tensão de partida" (Goodwe MS/Hopewind/Sungrow),
 * "Tensão de inicialização" (Deye). Proibido inventar — todos os rótulos têm evidência.
 */

describe('FASE 3/4 — texto: rótulos reais → valor correto', () => {
  it.each([
    ['Start Voltage 200 V', 200],                         // Huawei/Chint (sem -up)
    ['Start-up Voltage (V) 250', 250],                    // Goodwe DT
    ['Starting voltage\t180Vdc', 180],                    // Kehua
    ['Startup voltage 210 V', 210],
    ['Tensão de partida 55 Vcc', 55],                     // Hopewind
    ['Tensão de inicialização (V) 250', 250],             // Deye
    ['Mín. tensão de entrada FV / Tensão de partida 200', 200], // Sungrow (rótulo composto)
  ])('"%s" → %i V', (texto, esperado) => {
    expect(extrairSpecsTecnicas(texto, null).tensao_partida).toBe(esperado)
  })
})

describe('FASE 4 — ausência NÃO gera falso positivo', () => {
  it('texto sem rótulo de partida → tensao_partida ausente', () => {
    const esp = extrairSpecsTecnicas('Rated AC output voltage 380V\nMPPT voltage range 180-1000V\nMax efficiency 98.6%', null)
    expect(esp.tensao_partida).toBeUndefined()
  })
  it('"Output Voltage"/"Input Voltage" NÃO são confundidos com partida', () => {
    expect(extrairSpecsTecnicas('Output Voltage 220 V', null).tensao_partida).toBeUndefined()
    expect(extrairSpecsTecnicas('Max. Input Voltage 1100 V', null).tensao_partida).toBeUndefined()
  })
  it('valor fora da faixa física [30,600] é rejeitado', () => {
    expect(extrairSpecsTecnicas('Start Voltage 1000 V', null).tensao_partida).toBeUndefined()
  })
})

describe('FASE 4 — fixtures reais (posicional/matricial)', () => {
  it('Deye SUN-23/25/30K: Tensão de inicialização → 250 por modelo', () => {
    const m = montarMatriz(deye.tokens, deye.modelos || [])
    expect(m.modelos.map(x => m.porModelo[x].especificacoes.tensao_partida)).toEqual([250, 250, 250])
  })
  it('GoodWe DT: Start-up Voltage → 250 por modelo', () => {
    const m = montarMatriz(goodweDt.tokens, goodweDt.modelos || [])
    expect(m.modelos.every(x => m.porModelo[x].especificacoes.tensao_partida === 250)).toBe(true)
  })
  it('Huawei: "Start Voltage 200" extraído do texto', () => {
    const texto = huawei2.texto || (huawei2.tokens || []).map(t => t.s).join('\n')
    expect(extrairSpecsTecnicas(texto, null).tensao_partida).toBe(200)
  })
})
