import { describe, it, expect } from 'vitest'
import {
  contarMpptsInversor, montarGerador, montarString, stringHomogenea,
} from '../../../../backend/src/dominio/topologia/index.js'

/**
 * S2-FV-TOPOLOGY-FOUNDATION-01 — fábrica pura da topologia Gerador/MPPT/String.
 * Cobre os itens de teste do escopo: criação de Gerador/MPPT/String, String→Superfície,
 * inversor mono e multi MPPT, string homogênea e heterogênea.
 */

// Inversores do Catálogo (só o que o SSOT lê de especificacoes).
const invMono = { _id: 'inv-mono', especificacoes: { potencia_kw: 3, n_mppts: 1, entradas_por_mppt: 2 } }
const invMulti = { _id: 'inv-multi', especificacoes: { potencia_kw: 33, n_mppts: 4, entradas_por_mppt: 2 } }
const invSemMppt = { _id: 'inv-x', especificacoes: { potencia_kw: 5 } }

const SUP = '64b000000000000000000001'   // _id de uma Superfície (dentro de um Local)
const MOD_A = 'mod-canadian-555'
const MOD_B = 'mod-jinko-560'

describe('contarMpptsInversor — quantidade vem só do Catálogo', () => {
  it('mono MPPT', () => expect(contarMpptsInversor(invMono)).toBe(1))
  it('multi MPPT', () => expect(contarMpptsInversor(invMulti)).toBe(4))
  it('sem n_mppts → null', () => expect(contarMpptsInversor(invSemMppt)).toBeNull())
})

describe('montarGerador — inversor MONO MPPT', () => {
  const g = montarGerador(invMono, { apelido: 'Inversor da garagem' })
  it('referencia o inversor do Catálogo', () => expect(g.inversor_ref).toBe('inv-mono'))
  it('materializa exatamente 1 MPPT', () => expect(g.mppts).toHaveLength(1))
  it('MPPT nasce com índice 1 e sem strings', () => {
    expect(g.mppts[0].indice).toBe(1)
    expect(g.mppts[0].strings).toEqual([])
  })
  it('Ramal CA deferido (null)', () => expect(g.ramal_ca_ref).toBeNull())
  it('apelido opcional preservado', () => expect(g.apelido).toBe('Inversor da garagem'))
  it('NÃO carrega derivados nem letra/tipo', () => {
    expect(g).not.toHaveProperty('rotulo')
    expect(g).not.toHaveProperty('potencia_kwp')
    expect(g).not.toHaveProperty('oversizing')
    expect(g).not.toHaveProperty('letra')
    expect(g).not.toHaveProperty('tipo')
  })
})

describe('montarGerador — inversor MULTI MPPT', () => {
  const g = montarGerador(invMulti)
  it('materializa 4 MPPTs com índices 1..4', () => {
    expect(g.mppts).toHaveLength(4)
    expect(g.mppts.map((m) => m.indice)).toEqual([1, 2, 3, 4])
  })
  it('não aceita parametrização manual de MPPTs (só Catálogo)', () => {
    // montarGerador ignora qualquer tentativa de opts.mppts — sempre deriva do Catálogo
    const g2 = montarGerador(invMulti, { mppts: [{ indice: 1 }] })
    expect(g2.mppts).toHaveLength(4)
  })
})

describe('montarGerador — inversor sem n_mppts falha (não inventa)', () => {
  it('lança erro claro', () => {
    expect(() => montarGerador(invSemMppt)).toThrow(/n_mppts ausente/)
  })
})

describe('montarString — criação e referência à Superfície', () => {
  const s = montarString({ indice_entrada: 1, composicao: [{ modulo_ref: MOD_A, quantidade: 12 }], superficie_id: SUP })
  it('referencia a Superfície por _id', () => expect(s.superficie_id).toBe(SUP))
  it('guarda a entrada física do MPPT', () => expect(s.indice_entrada).toBe(1))
  it('composição é lista de {modulo, quantidade}', () => {
    expect(s.composicao).toEqual([{ modulo_ref: MOD_A, quantidade: 12 }])
  })
  it('NÃO tem quantidade própria (K é derivado)', () => {
    expect(s).not.toHaveProperty('quantidade')
  })
  it('NÃO carrega Voc/Vmpp/Isc/potência', () => {
    for (const k of ['voc', 'vmpp', 'isc', 'potencia', 'kwp', 'pmax', 'area']) {
      expect(s).not.toHaveProperty(k)
    }
  })
})

describe('montarString — string HOMOGÊNEA', () => {
  const s = montarString({ composicao: [{ modulo_ref: MOD_A, quantidade: 18 }], superficie_id: SUP })
  it('1 modelo na composição', () => expect(s.composicao).toHaveLength(1))
  it('classificada como homogênea', () => expect(stringHomogenea(s)).toBe(true))
})

describe('montarString — string HETEROGÊNEA (retrofit/otimizadores)', () => {
  const s = montarString({
    composicao: [
      { modulo_ref: MOD_A, quantidade: 17 },
      { modulo_ref: MOD_B, quantidade: 3 },
    ],
    superficie_id: SUP,
    otimizador_ref: 'otim-tigo',
  })
  it('2 modelos na composição', () => expect(s.composicao).toHaveLength(2))
  it('classificada como heterogênea', () => expect(stringHomogenea(s)).toBe(false))
  it('otimizador opcional preservado', () => expect(s.otimizador_ref).toBe('otim-tigo'))
})

describe('montarString — validações defensivas', () => {
  it('composição vazia falha', () => {
    expect(() => montarString({ composicao: [], superficie_id: SUP })).toThrow(/≥1 item/)
  })
  it('quantidade não-positiva falha', () => {
    expect(() => montarString({ composicao: [{ modulo_ref: MOD_A, quantidade: 0 }], superficie_id: SUP })).toThrow(/quantidade/)
  })
  it('sem superficie_id falha', () => {
    expect(() => montarString({ composicao: [{ modulo_ref: MOD_A, quantidade: 10 }] })).toThrow(/Superf/)
  })
  it('item sem modulo_ref falha', () => {
    expect(() => montarString({ composicao: [{ quantidade: 10 }], superficie_id: SUP })).toThrow(/modulo_ref/)
  })
})

describe('topologia completa montada — Gerador→MPPT→String', () => {
  it('anexa strings aos MPPTs de um gerador multi', () => {
    const g = montarGerador(invMulti)
    g.mppts[0].strings.push(montarString({ indice_entrada: 1, composicao: [{ modulo_ref: MOD_A, quantidade: 12 }], superficie_id: SUP }))
    g.mppts[0].strings.push(montarString({ indice_entrada: 2, composicao: [{ modulo_ref: MOD_A, quantidade: 12 }], superficie_id: SUP }))
    expect(g.mppts[0].strings).toHaveLength(2)
    expect(g.mppts[1].strings).toHaveLength(0)
    expect(g.mppts[0].strings[0].superficie_id).toBe(SUP)
  })
})
