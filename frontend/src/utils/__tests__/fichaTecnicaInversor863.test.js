import { describe, it, expect } from 'vitest'
import { montarFichaTecnica } from '../../../../backend/src/utils/catalogo/fichaTecnicaMap.js'

/**
 * Sprint 8.6.3 — regressão da causa real do "specs vazios".
 *
 * Causa exata diagnosticada (auditoria do pipeline pós-8.6.2):
 *   - ModalNovoInversor salva especificacoes com as chaves do prompt Claude:
 *     n_mppts, tensao_max_entrada, tensao_mppt_min, tensao_mppt_max,
 *     corrente_max_por_mppt, corrente_isc_max, potencia_kw, potencia_maxima_kw,
 *     tensao_ac, frequencia_hz, corrente_ac_saida, eficiencia_maxima, garantia_anos
 *   - fichaTecnicaMap (8.6) buscava chaves DIFERENTES:
 *     mppts, voc_max, faixa_mppt_min, faixa_mppt_max, corrente_max_mppt,
 *     corrente_curto_mppt, potencia, potencia_max, tensao_saida, frequencia,
 *     corrente_max, eficiencia, garantia
 *   → 13/15 campos do inversor apareciam como "ausente" na UI.
 *
 * Correção: fichaTecnicaMap agora aceita ARRAY de aliases por slot.
 */

// Inversor Deye real EXATAMENTE como ModalNovoInversor persiste no Mongo
const deyeReal = {
  tipo: 'inversor',
  fabricante: 'Deye',
  modelo: 'SUN-30K-G04',
  especificacoes: {
    subtipo: 'string',
    potencia_kw: 30,
    potencia_maxima_kw: 33,
    potencia_aparente_kva: 33,
    tensao_ac: '380/400',
    fases: 3,
    frequencia_hz: 60,
    corrente_ac_saida: 45.5,
    n_mppts: 3,
    strings_por_mppt: 2,
    tensao_max_entrada: 1000,
    tensao_mppt_min: 200,
    tensao_mppt_max: 850,
    tensao_partida: 250,
    corrente_max_por_mppt: 26,
    corrente_isc_max: 33,
    potencia_max_entrada_cc: 39,
    eficiencia_maxima: 98.6,
    eficiencia_europeia: 98.1,
    grau_protecao_ip: 'IP65',
    temperatura_operacao: '-40~+60°C',
    tipo_refrigeracao: 'Forçada',
    comunicacao: 'WiFi/RS485',
    peso_kg: 42,
    dimensoes: '510x440x180',
    garantia_anos: 5,
  },
}

describe('S8.6.3 — ficha técnica do inversor Deye real (causa 1)', () => {
  const ficha = montarFichaTecnica(deyeReal)
  const todosCampos = ficha.grupos.flatMap(g => g.campos)
  const visiveis = todosCampos.filter(c => !c.ausente && c.chave !== '__tipo')

  it('renderiza > 20 campos do Deye 30k (antes do fix: apenas 2-3)', () => {
    expect(visiveis.length).toBeGreaterThan(20)
  })

  it('Entrada CC: n_mppts é lido (era órfão como "mppts")', () => {
    const mppt = todosCampos.find(c => c.rotulo === 'Nº MPPT')
    expect(mppt.valor).toBe(3)
    expect(mppt.ausente).toBe(false)
  })

  it('Entrada CC: tensao_max_entrada lê como "Tensão máx CC" (era voc_max)', () => {
    const v = todosCampos.find(c => c.rotulo === 'Tensão máx CC')
    expect(v.valor).toBe(1000)
    expect(v.ausente).toBe(false)
  })

  it('Entrada CC: tensao_mppt_min/max lê como "MPPT mín/máx" (era faixa_mppt_)', () => {
    const min = todosCampos.find(c => c.rotulo === 'MPPT mín')
    const max = todosCampos.find(c => c.rotulo === 'MPPT máx')
    expect(min.valor).toBe(200)
    expect(max.valor).toBe(850)
  })

  it('Entrada CC: corrente_max_por_mppt lê (era corrente_max_mppt)', () => {
    const c = todosCampos.find(c => c.rotulo === 'Corrente máx MPPT')
    expect(c.valor).toBe(26)
  })

  it('Entrada CC: corrente_isc_max lê como "Isc máxima" (era corrente_curto_mppt)', () => {
    const c = todosCampos.find(c => c.rotulo === 'Isc máxima')
    expect(c.valor).toBe(33)
  })

  it('Saída CA: potencia_kw lê como "Pot. nominal" (era "potencia")', () => {
    const c = todosCampos.find(c => c.rotulo === 'Pot. nominal')
    expect(c.valor).toBe(30)
  })

  it('Saída CA: potencia_maxima_kw lê como "Pot. máxima"', () => {
    const c = todosCampos.find(c => c.rotulo === 'Pot. máxima')
    expect(c.valor).toBe(33)
  })

  it('Saída CA: tensao_ac, frequencia_hz, corrente_ac_saida, fases', () => {
    expect(todosCampos.find(c => c.rotulo === 'Tensão nominal').valor).toBe('380/400')
    expect(todosCampos.find(c => c.rotulo === 'Frequência').valor).toBe(60)
    expect(todosCampos.find(c => c.rotulo === 'Corrente CA').valor).toBe(45.5)
    expect(todosCampos.find(c => c.rotulo === 'Fases').valor).toBe(3)
  })

  it('Eficiência: eficiencia_maxima e eficiencia_europeia', () => {
    expect(todosCampos.find(c => c.rotulo === 'Eficiência máxima').valor).toBe(98.6)
    expect(todosCampos.find(c => c.rotulo === 'Eficiência europeia').valor).toBe(98.1)
  })

  it('Garantia: garantia_anos lê como "Garantia"', () => {
    expect(todosCampos.find(c => c.rotulo === 'Garantia').valor).toBe(5)
  })

  it('Proteções: grau_protecao_ip, comunicacao, peso_kg, dimensoes', () => {
    expect(todosCampos.find(c => c.rotulo === 'Grau de proteção').valor).toBe('IP65')
    expect(todosCampos.find(c => c.rotulo === 'Comunicação').valor).toBe('WiFi/RS485')
    expect(todosCampos.find(c => c.rotulo === 'Peso').valor).toBe(42)
  })
})

describe('S8.6.3 — retrocompatibilidade (catálogo antigo)', () => {
  // Inversor velho com chaves "canônicas" antigas continua renderizando
  const deyeAntigo = {
    tipo: 'inversor', fabricante: 'Deye', modelo: 'SUN-10K-G03',
    especificacoes: {
      mppts: 2, voc_max: 1100, faixa_mppt_min: 180, faixa_mppt_max: 850,
      potencia: 10, potencia_max: 11, eficiencia: 97.6, garantia: 5,
      tensao_saida: 380, frequencia: 50, corrente_max: 16.5,
    },
  }

  it('chaves antigas (mppts, voc_max, faixa_mppt_*, potencia, eficiencia, garantia) continuam funcionando', () => {
    const ficha = montarFichaTecnica(deyeAntigo)
    const todos = ficha.grupos.flatMap(g => g.campos)
    expect(todos.find(c => c.rotulo === 'Nº MPPT').valor).toBe(2)
    expect(todos.find(c => c.rotulo === 'Tensão máx CC').valor).toBe(1100)
    expect(todos.find(c => c.rotulo === 'MPPT mín').valor).toBe(180)
    expect(todos.find(c => c.rotulo === 'Pot. nominal').valor).toBe(10)
    expect(todos.find(c => c.rotulo === 'Eficiência máxima').valor).toBe(97.6)
    expect(todos.find(c => c.rotulo === 'Garantia').valor).toBe(5)
  })
})

describe('S8.6.3 — campos ausentes continuam marcados (não inventa valores)', () => {
  it('inversor sem dados continua mostrando ausente', () => {
    const vazio = { tipo: 'inversor', fabricante: 'X', modelo: 'Y', especificacoes: {} }
    const todos = montarFichaTecnica(vazio).grupos.flatMap(g => g.campos)
    const mppts = todos.find(c => c.rotulo === 'Nº MPPT')
    expect(mppts.ausente).toBe(true)
    expect(mppts.valor).toBeNull()
  })
})
