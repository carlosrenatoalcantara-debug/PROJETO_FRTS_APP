import { describe, it, expect } from 'vitest'
import { gerarMemorialDescritivo, gerarCartaConcessionaria, gerarDadosART } from '../../../../backend/src/services/memorialDescritivoService.js'

/**
 * P1-PARECER-ENGINEERING-WIRE-01 — conexão engenharia/Atlas/beneficiárias ao memorial.
 */
const cliente = { nome: 'Cliente Teste', cpf_cnpj: '000' }
const projetoSnake = { potencia_kwp: 10, inversor: { marca: 'GoodWe', modelo: 'GW10K', potencia_kw: 10, n_mppts: 2, fases: 3 } }

describe('FASE 1 — dialeto snake/camel', () => {
  it('memorial mostra potência do inversor com potencia_kw (snake) — não "N/A"', () => {
    const m = gerarMemorialDescritivo(projetoSnake, cliente)
    expect(m).toMatch(/Potência Nominal: 10 kW/)
    expect(m).not.toMatch(/Potência Nominal: N\/A kW/)
  })
  it('carta e ART também resolvem o dialeto', () => {
    expect(gerarCartaConcessionaria(projetoSnake, cliente)).toMatch(/Potência CA: 10 kW/)
    expect(gerarDadosART(projetoSnake, cliente).potencia_ac).toBe('10 kW')
  })
  it('compatibilidade: chamada antiga (2 args) continua funcionando', () => {
    expect(() => gerarMemorialDescritivo(projetoSnake, cliente)).not.toThrow()
  })
})

describe('FASE 2 — Atlas vivo > snapshot', () => {
  it('usa especificacoes do Atlas e marca a fonte', () => {
    const equipamentos = [{ tipo: 'inversor', fabricante: 'Huawei', modelo: 'SUN2000-30KTL-M3', especificacoes: { potencia_kw: 30, n_mppts: 4 } }]
    const m = gerarMemorialDescritivo(projetoSnake, cliente, { equipamentos })
    expect(m).toMatch(/Marca: Huawei/)
    expect(m).toMatch(/Potência Nominal: 30 kW/)        // veio do Atlas, não do snapshot (10)
    expect(m).toMatch(/Fonte dos dados: Especificações técnicas obtidas do catálogo \(Atlas\)/)
  })
})

describe('FASE 3 — valores inferidos identificados', () => {
  it('inversor sem tensao_partida → disclaimer de fallback no documento', () => {
    const equipamentos = [{ tipo: 'inversor', fabricante: 'X', modelo: 'Y', especificacoes: { potencia_kw: 5, faixa_mppt_min: 80 } }]
    const m = gerarMemorialDescritivo(projetoSnake, cliente, { equipamentos })
    expect(m).toMatch(/Valores inferidos.*tensao_partida/)
    expect(m).toMatch(/Valor estimado conservadoramente — sujeito à validação técnica/)
  })
  it('inversor com tensao_partida real → SEM disclaimer', () => {
    const equipamentos = [{ tipo: 'inversor', modelo: 'Z', especificacoes: { potencia_kw: 5, tensao_partida: 200 } }]
    expect(gerarMemorialDescritivo(projetoSnake, cliente, { equipamentos })).not.toMatch(/Valor estimado conservadoramente/)
  })
})

describe('FASE 4 — beneficiárias no memorial', () => {
  it('UC principal + beneficiárias + rateio aparecem com soma', () => {
    const beneficiarias = [
      { contaContrato: 'UC-100', titular: 'Principal', tipoRateio: 'percentual', valor: 60, ativa: true },
      { contaContrato: 'UC-200', titular: 'Filial', tipoRateio: 'percentual', valor: 40, ativa: true },
    ]
    const m = gerarMemorialDescritivo(projetoSnake, cliente, { beneficiarias })
    expect(m).toMatch(/UC Principal: UC UC-100/)
    expect(m).toMatch(/Beneficiária 1: UC UC-200/)
    expect(m).toMatch(/Soma do rateio percentual: 100% ✓/)
  })
})

describe('FASE 5 — certificações automáticas', () => {
  it('INMETRO + IEC do equipamento entram no documento', () => {
    const equipamentos = [{ tipo: 'inversor', fabricante: 'GoodWe', modelo: 'GW10K', especificacoes: { potencia_kw: 10 },
      certificacao: { inmetro: { numero: '012345/2023' }, normas_iec: [{ norma: 'IEC 62109' }, { norma: 'IEC 62116' }] } }]
    const m = gerarMemorialDescritivo(projetoSnake, cliente, { equipamentos })
    expect(m).toMatch(/INMETRO 012345\/2023/)
    expect(m).toMatch(/IEC 62109/); expect(m).toMatch(/IEC 62116/)
  })
})
