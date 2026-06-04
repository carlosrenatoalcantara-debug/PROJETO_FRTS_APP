import { describe, it, expect } from 'vitest'
import { montarMatriz, rotuloParaCampo } from '../../../../backend/src/ai/parserMatricial.js'
import { classificarCampos, resumirQualidade, PROVENIENCIA } from '../../../../backend/src/ai/camposEquipamento.js'

/**
 * P1-INV-MATRIX-01 — parser matricial posicional (sem IA).
 *
 * Reproduz o layout posicional de um datasheet GoodWe DT multi-coluna:
 *   colunas GW17K-DT@200 / GW20K-DT@300 / GW25K-DT@400 (mesma linha y=700);
 *   cada linha de spec tem o rótulo à esquerda (x=40) e 3 valores por coluna.
 * Prova que cada modelo recebe a SUA coluna (não a coluna-1 de todos).
 */

// y maior = mais acima (origem PDF). Cabeçalho em cima, specs abaixo.
const T = (x, y, s) => ({ page: 1, x, y, s })
const TOKENS = [
  // cabeçalho de modelos
  T(200, 700, 'GW17K-DT'), T(300, 700, 'GW20K-DT'), T(400, 700, 'GW25K-DT'),
  // Rated AC Output Power (W) → potencia_kw (W→kW)
  T(40, 660, 'Rated AC Output Power (W)'), T(200, 660, '17000'), T(300, 660, '20000'), T(400, 660, '25000'),
  // Max. AC Output Power (W) → potencia_maxima_kw
  T(40, 640, 'Max. AC Output Power (W)'), T(200, 640, '18700'), T(300, 640, '22000'), T(400, 640, '27500'),
  // No. of MPPT
  T(40, 620, 'No. of MPPT'), T(200, 620, '2'), T(300, 620, '2'), T(400, 620, '2'),
  // Strings per MPPT
  T(40, 600, 'Strings per MPPT'), T(200, 600, '2'), T(300, 600, '2'), T(400, 600, '2'),
  // Max. Input Current (A) → corrente_max_por_mppt
  T(40, 580, 'Max. Input Current (A)'), T(200, 580, '22'), T(300, 580, '22'), T(400, 580, '27'),
  // Max. Short Current (A) → corrente_isc_max
  T(40, 560, 'Max. Short Current (A)'), T(200, 560, '27.5'), T(300, 560, '27.5'), T(400, 560, '33.8'),
  // MPPT Range (V) — COMPARTILHADO (1 valor) → broadcast min/max
  T(40, 540, 'MPPT Range (V)'), T(200, 540, '260~850'),
  // Max. DC Input Voltage (V) — compartilhado
  T(40, 520, 'Max. DC Input Voltage (V)'), T(200, 520, '1000'),
  // Max. Efficiency — compartilhado
  T(40, 500, 'Max. Efficiency'), T(200, 500, '98.6%'),
]

describe('rotuloParaCampo', () => {
  it('mapeia rótulos PT/EN para campos canônicos', () => {
    expect(rotuloParaCampo('Rated AC Output Power (W)')).toBe('potencia_kw')
    expect(rotuloParaCampo('Max. Short Current (A)')).toBe('corrente_isc_max')
    expect(rotuloParaCampo('Max. Efficiency')).toBe('eficiencia_maxima')
  })
})

describe('montarMatriz — GoodWe DT (GW17/20/25 com valores distintos)', () => {
  const r = montarMatriz(TOKENS, ['GW17K-DT', 'GW20K-DT', 'GW25K-DT'])

  it('detecta as 3 colunas', () => {
    expect(r.ok).toBe(true)
    expect(r.modelos).toEqual(['GW17K-DT', 'GW20K-DT', 'GW25K-DT'])
  })

  it('potência NOMINAL distinta por modelo (não todos coluna-1)', () => {
    expect(r.porModelo['GW17K-DT'].especificacoes.potencia_kw).toBe(17)
    expect(r.porModelo['GW20K-DT'].especificacoes.potencia_kw).toBe(20)
    expect(r.porModelo['GW25K-DT'].especificacoes.potencia_kw).toBe(25)
  })

  it('potência MÁXIMA distinta por modelo', () => {
    expect(r.porModelo['GW17K-DT'].especificacoes.potencia_maxima_kw).toBe(18.7)
    expect(r.porModelo['GW20K-DT'].especificacoes.potencia_maxima_kw).toBe(22)
    expect(r.porModelo['GW25K-DT'].especificacoes.potencia_maxima_kw).toBe(27.5)
  })

  it('correntes distintas no GW25 (27A / 33.8A) vs GW17 (22A / 27.5A)', () => {
    expect(r.porModelo['GW17K-DT'].especificacoes.corrente_max_por_mppt).toBe(22)
    expect(r.porModelo['GW25K-DT'].especificacoes.corrente_max_por_mppt).toBe(27)
    expect(r.porModelo['GW17K-DT'].especificacoes.corrente_isc_max).toBe(27.5)
    expect(r.porModelo['GW25K-DT'].especificacoes.corrente_isc_max).toBe(33.8)
  })

  it('campos COMPARTILHADOS são replicados em todos os modelos', () => {
    for (const m of r.modelos) {
      expect(r.porModelo[m].especificacoes.tensao_max_entrada).toBe(1000)
      expect(r.porModelo[m].especificacoes.tensao_mppt_min).toBe(260)
      expect(r.porModelo[m].especificacoes.tensao_mppt_max).toBe(850)
      expect(r.porModelo[m].especificacoes.n_mppts).toBe(2)
    }
  })

  it('marca proveniência ENCONTRADO nos campos da tabela', () => {
    expect(r.porModelo['GW17K-DT']._status.potencia_kw).toBe('encontrado')
    expect(r.porModelo['GW17K-DT']._status.corrente_isc_max).toBe('encontrado')
  })
})

describe('Importação Assistida — status 🟢/🟡/🔴 e qualidade', () => {
  it('classifica proveniência por campo (encontrado/inferido/faltante)', () => {
    const esp = { potencia_kw: 20, n_mppts: 2, tensao_max_entrada: 1000 }
    const statusMap = { potencia_kw: 'inferido' } // veio do nome do modelo
    const campos = classificarCampos('inversor', esp, statusMap)
    const byKey = Object.fromEntries(campos.map(c => [c.key, c]))
    expect(byKey.potencia_kw.proveniencia).toBe(PROVENIENCIA.INFERIDO)   // 🟡
    expect(byKey.n_mppts.proveniencia).toBe(PROVENIENCIA.ENCONTRADO)     // 🟢
    expect(byKey.tensao_mppt_min.proveniencia).toBe(PROVENIENCIA.FALTANTE) // 🔴
  })

  it('resumirQualidade conta encontrados/inferidos/pendentes + legenda externa', () => {
    const esp = { potencia_kw: 20, n_mppts: 2 }
    const q = resumirQualidade('inversor', esp, { potencia_kw: 'inferido' })
    expect(q.encontrados).toBe(1)
    expect(q.inferidos).toBe(1)
    expect(q.pendentes).toBeGreaterThan(0)
    expect(q.faltantes.length).toBe(q.pendentes)
    // legenda externa existe nos campos
    const campos = classificarCampos('inversor', esp)
    expect(campos.find(c => c.key === 'strings_por_mppt').info).toMatch(/strings/i)
  })
})
