import { describe, it, expect } from 'vitest'
import {
  montarInstalacao, validarIntencao, resumoIntencao, ErroIntencaoInvalida,
} from '../../../../backend/src/dominio/topologia/montarInstalacao.js'

/**
 * S4C-1 (ADR-019 Etapa 1) — tradutor IntencaoTopologia → PayloadInstalacao.
 * Puro: sem I/O, sem banco, sem HTTP, sem catálogo.
 */

const INV_2MPPT = { _id: 'inv-2', especificacoes: { n_mppts: 2, entradas_por_mppt: 2 } }
const INV_1MPPT = { _id: 'inv-1', especificacoes: { n_mppts: 1, entradas_por_mppt: 2 } }
const INV_SEM = { _id: 'inv-x', especificacoes: { potencia_kw: 5 } }
const MOD = 'mod-a'
const MOD_B = 'mod-b'
const SUP = 'sup-1'
const SUP_2 = 'sup-2'

/** topologia com 1 entrada por MPPT contendo 1 string de N módulos */
const topo = (mppts) => mppts.map((n) => ({ entradas: [{ strings: n > 0 ? [{ modulos: n }] : [] }] }))

const gerador = (over = {}) => ({
  inversor: INV_1MPPT, modulo_ref: MOD, superficie_id: SUP, topologia: topo([12]), ...over,
})

describe('1. entrada mínima válida', () => {
  const out = montarInstalacao({ geradores: [gerador()] })
  it('produz 1 gerador', () => expect(out.geradores).toHaveLength(1))
  it('local_ref default null', () => expect(out.local_ref).toBeNull())
  it('string traduzida com composição', () => {
    expect(out.geradores[0].mppts[0].strings[0]).toEqual({
      indice_entrada: 1,
      composicao: [{ modulo_ref: MOD, quantidade: 12 }],
      superficie_id: SUP,
      otimizador_ref: null,
    })
  })
})

describe('2. múltiplos geradores', () => {
  const out = montarInstalacao({
    local_ref: 'loc-1',
    geradores: [gerador({ apelido: 'Sul' }), gerador({ inversor: INV_2MPPT, topologia: topo([10, 10]) })],
  })
  it('2 geradores', () => expect(out.geradores).toHaveLength(2))
  it('local_ref propagado', () => expect(out.local_ref).toBe('loc-1'))
  it('apelido preservado', () => expect(out.geradores[0].apelido).toBe('Sul'))
  it('inversor_ref por gerador', () => {
    expect(out.geradores[0].inversor_ref).toBe('inv-1')
    expect(out.geradores[1].inversor_ref).toBe('inv-2')
  })
})

describe('3. múltiplos MPPTs', () => {
  const out = montarInstalacao({ geradores: [gerador({ inversor: INV_2MPPT, topologia: topo([12, 8]) })] })
  it('2 MPPTs com índices 1..2', () => {
    expect(out.geradores[0].mppts.map((m) => m.indice)).toEqual([1, 2])
  })
  it('strings distribuídas no MPPT correto', () => {
    expect(out.geradores[0].mppts[0].strings[0].composicao[0].quantidade).toBe(12)
    expect(out.geradores[0].mppts[1].strings[0].composicao[0].quantidade).toBe(8)
  })
  it('múltiplas entradas geram indice_entrada crescente', () => {
    const g = montarInstalacao({ geradores: [gerador({
      inversor: INV_1MPPT,
      topologia: [{ entradas: [{ strings: [{ modulos: 10 }] }, { strings: [{ modulos: 11 }] }] }],
    })] }).geradores[0]
    expect(g.mppts[0].strings.map((s) => s.indice_entrada)).toEqual([1, 2])
  })
})

describe('4. strings vazias descartadas', () => {
  it('modulos = 0 é descartado', () => {
    const out = montarInstalacao({ geradores: [gerador({
      topologia: [{ entradas: [{ strings: [{ modulos: 0 }, { modulos: 9 }] }] }],
    })] })
    expect(out.geradores[0].mppts[0].strings).toHaveLength(1)
    expect(out.geradores[0].mppts[0].strings[0].composicao[0].quantidade).toBe(9)
  })
  it('MPPT sem strings fica vazio (entrada vazia é legítima)', () => {
    const out = montarInstalacao({ geradores: [gerador({ inversor: INV_2MPPT, topologia: topo([12, 0]) })] })
    expect(out.geradores[0].mppts[1].strings).toEqual([])
  })
})

describe('5. override de módulo (composição heterogênea)', () => {
  it('string usa modulo_ref próprio', () => {
    const out = montarInstalacao({ geradores: [gerador({
      topologia: [{ entradas: [{ strings: [{ modulos: 17 }, { modulos: 3, modulo_ref: MOD_B }] }] }],
    })] })
    const strs = out.geradores[0].mppts[0].strings
    expect(strs[0].composicao[0].modulo_ref).toBe(MOD)
    expect(strs[1].composicao[0].modulo_ref).toBe(MOD_B)
  })
})

describe('6. override de superfície', () => {
  it('string usa superficie_id própria', () => {
    const out = montarInstalacao({ geradores: [gerador({
      topologia: [{ entradas: [{ strings: [{ modulos: 10 }, { modulos: 10, superficie_id: SUP_2 }] }] }],
    })] })
    const strs = out.geradores[0].mppts[0].strings
    expect(strs[0].superficie_id).toBe(SUP)
    expect(strs[1].superficie_id).toBe(SUP_2)
  })
})

describe('7. erro de intenção inválida', () => {
  const falha = (int, trecho) => {
    expect(() => montarInstalacao(int)).toThrow(ErroIntencaoInvalida)
    expect(validarIntencao(int).some((e) => e.includes(trecho))).toBe(true)
  }
  it('sem geradores', () => falha({ geradores: [] }, 'ao menos 1 gerador'))
  it('geradores não-array', () => falha({}, 'deve ser um array'))
  it('sem inversor', () => falha({ geradores: [gerador({ inversor: undefined })] }, 'inversor'))
  it('inversor sem n_mppts', () => falha({ geradores: [gerador({ inversor: INV_SEM })] }, 'n_mppts'))
  it('topologia ≠ n_mppts (INV-03)', () =>
    falha({ geradores: [gerador({ inversor: INV_2MPPT, topologia: topo([12]) })] }, 'INV-03'))
  it('sem modulo_ref padrão', () => falha({ geradores: [gerador({ modulo_ref: undefined })] }, 'modulo_ref'))
  it('sem superficie_id padrão', () => falha({ geradores: [gerador({ superficie_id: undefined })] }, 'superficie_id'))
  it('modulos negativo', () =>
    falha({ geradores: [gerador({ topologia: [{ entradas: [{ strings: [{ modulos: -1 }] }] }] })] }, 'modulos'))
  it('intenção válida não lança', () => expect(validarIntencao({ geradores: [gerador()] })).toEqual([]))
})

describe('8. saída idêntica ao PayloadInstalacao esperado', () => {
  it('deep equal do payload completo', () => {
    const out = montarInstalacao({
      local_ref: 'loc-9',
      geradores: [{
        inversor: INV_2MPPT, apelido: 'G1', modulo_ref: MOD, superficie_id: SUP,
        topologia: [
          { entradas: [{ strings: [{ modulos: 12 }] }, { strings: [{ modulos: 12 }] }] },
          { entradas: [{ strings: [] }] },
        ],
      }],
    })
    expect(out).toEqual({
      local_ref: 'loc-9',
      geradores: [{
        inversor_ref: 'inv-2',
        ramal_ca_ref: null,
        apelido: 'G1',
        mppts: [
          { indice: 1, strings: [
            { indice_entrada: 1, composicao: [{ modulo_ref: MOD, quantidade: 12 }], superficie_id: SUP, otimizador_ref: null },
            { indice_entrada: 2, composicao: [{ modulo_ref: MOD, quantidade: 12 }], superficie_id: SUP, otimizador_ref: null },
          ] },
          { indice: 2, strings: [] },
        ],
      }],
    })
  })
  it('nenhum derivado no payload (K/Voc/kWp/quantidade na string)', () => {
    const s = montarInstalacao({ geradores: [gerador()] }).geradores[0].mppts[0].strings[0]
    for (const k of ['K', 'voc', 'vmpp', 'isc', 'kwp', 'potencia', 'quantidade']) {
      expect(s).not.toHaveProperty(k)
    }
  })
})

describe('resumoIntencao (derivado, nunca persistido)', () => {
  it('conta módulos/strings/mppts usados', () => {
    const r = resumoIntencao({ geradores: [gerador({ inversor: INV_2MPPT, topologia: topo([12, 8]) })] })
    expect(r).toEqual({ modulos: 20, strings: 2, mpptsUsados: 2, geradores: 1 })
  })
  it('ignora strings vazias', () => {
    const r = resumoIntencao({ geradores: [gerador({ inversor: INV_2MPPT, topologia: topo([12, 0]) })] })
    expect(r).toEqual({ modulos: 12, strings: 1, mpptsUsados: 1, geradores: 1 })
  })
  it('intenção vazia não quebra', () => {
    expect(resumoIntencao({})).toEqual({ modulos: 0, strings: 0, mpptsUsados: 0, geradores: 0 })
  })
})

describe('pureza / determinismo', () => {
  it('não muta a intenção de entrada', () => {
    const intencao = { geradores: [gerador()] }
    const antes = JSON.stringify(intencao)
    montarInstalacao(intencao)
    expect(JSON.stringify(intencao)).toBe(antes)
  })
  it('determinístico — duas chamadas produzem saída idêntica', () => {
    const intencao = { geradores: [gerador({ inversor: INV_2MPPT, topologia: topo([12, 8]) })] }
    expect(montarInstalacao(intencao)).toEqual(montarInstalacao(intencao))
  })
})
