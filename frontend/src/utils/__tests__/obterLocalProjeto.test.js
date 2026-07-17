import { describe, it, expect } from 'vitest'
import { obterLocalProjeto, localPopulado } from '../../../../backend/src/dominio/local/index.js'

/**
 * S1.5-FV-LOCAL-CONSUMERS-MIGRATION-01 — adapter oficial de leitura do Local.
 * Cobre: projeto novo (local_ref populado), legado (sem ref), local_ref null,
 * Local parcial (fallback por campo), geometria sempre do legado.
 */

// Simula um Local [AR-2] populado (shape do model S1).
function localPopuladoFixture(over = {}) {
  return {
    _id: 'local1',
    _schema_versao: '1.0',
    coordenadas: { latitude: -21.17, longitude: -47.81 },
    endereco: { endereco_completo: 'Rua Nova, 100', cidade: 'Ribeirão Preto', estado: 'SP', cep: '14000-000' },
    hsp0_kwh_m2_dia: 5.42,
    fonte_irradiancia: 'nasa_power',
    temperatura_min_c: 8,
    temperatura_max_c: 38,
    temperatura_media_c: 23,
    fonte_climatica: 'nasa_power',
    superficies: [
      { _id: 'sup1', nome: 'Telhado Sul', area_disponivel_m2: 80, azimute_graus: 180, inclinacao_graus: 20, tipo_cobertura: 'ceramico', sombreamento_parcial: false, estado: 'ativa' },
    ],
    ...over,
  }
}

describe('obterLocalProjeto — detecção de Local populado', () => {
  it('reconhece Local populado', () => {
    expect(localPopulado({ local_ref: localPopuladoFixture() })).not.toBeNull()
  })
  it('trata ObjectId não populado como ausente', () => {
    // ObjectId-like: objeto sem propriedades de domínio do Local
    const fakeObjectId = { toString: () => '64f...', _bsontype: 'ObjectId' }
    expect(localPopulado({ local_ref: fakeObjectId })).toBeNull()
  })
  it('trata null como ausente', () => {
    expect(localPopulado({ local_ref: null })).toBeNull()
  })
})

describe('obterLocalProjeto — projeto NOVO (local_ref populado)', () => {
  const projeto = { local_ref: localPopuladoFixture(), localizacao: null }
  const out = obterLocalProjeto(projeto)

  it('origem = local', () => expect(out.origem).toBe('local'))
  it('coordenadas vêm do Local', () => {
    expect(out.latitude).toBe(-21.17)
    expect(out.longitude).toBe(-47.81)
  })
  it('endereço vem do Local', () => {
    expect(out.cidade).toBe('Ribeirão Preto')
    expect(out.estado).toBe('SP')
    expect(out.endereco.endereco_completo).toBe('Rua Nova, 100')
  })
  it('clima vem do Local', () => {
    expect(out.clima.hsp0_kwh_m2_dia).toBe(5.42)
    expect(out.clima.temperatura_min_c).toBe(8)
  })
  it('superfície vem do Local com orientação derivada do azimute', () => {
    expect(out.superficies).toHaveLength(1)
    expect(out.superficies[0].id).toBe('sup1')
    expect(out.superficies[0].azimute_graus).toBe(180)
    expect(out.superficies[0].orientacao).toBe('Sul')
    expect(out.superficies[0].origem).toBe('local')
  })
})

describe('obterLocalProjeto — projeto LEGADO (sem local_ref, subdoc localizacao v3)', () => {
  const projeto = {
    local_ref: null,
    localizacao: {
      latitude: -23.5, longitude: -46.6, cidade: 'São Paulo', estado: 'SP',
      endereco_completo: 'Av. Velha, 1', irradiancia_kwh_kwp_dia: 4.9,
      temperatura_min_historica_c: 10, fonte_climatica: 'manual',
    },
    layoutSolar: { area_util_m2: 50, orientacao: 'Norte', inclinacao_graus: 15, tipo_telhado: 'metalico', pontos: [[1, 2], [3, 4]] },
  }
  const out = obterLocalProjeto(projeto)

  it('origem = legado', () => expect(out.origem).toBe('legado'))
  it('lê coordenadas/endereço do subdoc legado', () => {
    expect(out.latitude).toBe(-23.5)
    expect(out.cidade).toBe('São Paulo')
    expect(out.endereco_completo).toBe('Av. Velha, 1')
  })
  it('lê HSP diário do subdoc legado (não do flat mensal)', () => {
    expect(out.clima.hsp0_kwh_m2_dia).toBe(4.9)
  })
  it('deriva 1 superfície do layoutSolar legado', () => {
    expect(out.superficies).toHaveLength(1)
    expect(out.superficies[0].orientacao).toBe('Norte')
    expect(out.superficies[0].area_m2).toBe(50)
    expect(out.superficies[0].origem).toBe('legado')
  })
})

describe('obterLocalProjeto — flat v2 puro (sem subdoc localizacao)', () => {
  const projeto = { local_ref: null, latitude: -22.9, longitude: -43.2, endereco_completo: 'Flat 1' }
  const out = obterLocalProjeto(projeto)
  it('cai no flat v2', () => {
    expect(out.latitude).toBe(-22.9)
    expect(out.endereco_completo).toBe('Flat 1')
  })
  it('NUNCA inventa HSP a partir do flat mensal irradiancia_local', () => {
    expect(out.clima.hsp0_kwh_m2_dia).toBeNull()
  })
})

describe('obterLocalProjeto — Local PARCIAL (fallback por campo)', () => {
  // Local tem coordenadas mas hsp0 e cidade nulos → cai no legado SÓ nesses campos.
  const projeto = {
    local_ref: localPopuladoFixture({
      hsp0_kwh_m2_dia: null,
      endereco: { endereco_completo: null, cidade: null, estado: null, cep: null },
    }),
    localizacao: { cidade: 'Cidade Legada', irradiancia_kwh_kwp_dia: 4.1 },
  }
  const out = obterLocalProjeto(projeto)

  it('coordenada não-nula continua vindo do Local', () => {
    expect(out.latitude).toBe(-21.17)
  })
  it('campo nulo no Local cai no legado (cidade)', () => {
    expect(out.cidade).toBe('Cidade Legada')
  })
  it('campo nulo no Local cai no legado (hsp0)', () => {
    expect(out.clima.hsp0_kwh_m2_dia).toBe(4.1)
  })
})

describe('obterLocalProjeto — geometria SEMPRE do legado', () => {
  // Mesmo com Local presente, pontos/roof_planes vêm do legado (não existem no Local S1).
  const projeto = {
    local_ref: localPopuladoFixture(),
    telhado: { pontos: [[10, 20], [30, 40]], area_m2: 77 },
    layoutSolar: { roof_planes: [{ id: 'p1' }], obstaculos: [{ tipo: 'chamine' }], imagem_satelite_url: 'http://x/y.png' },
  }
  const out = obterLocalProjeto(projeto)

  it('pontos do telhado vêm do legado mesmo com Local presente', () => {
    expect(out.telhado.pontos).toEqual([[10, 20], [30, 40]])
    expect(out.geometria.pontos).toEqual([[10, 20], [30, 40]])
  })
  it('roof_planes/obstaculos/imagem vêm do legado', () => {
    expect(out.geometria.roof_planes).toEqual([{ id: 'p1' }])
    expect(out.geometria.obstaculos).toEqual([{ tipo: 'chamine' }])
    expect(out.geometria.imagem_satelite_url).toBe('http://x/y.png')
  })
})

describe('obterLocalProjeto — projeto vazio / defensivo', () => {
  it('projeto sem nada não quebra', () => {
    const out = obterLocalProjeto({})
    expect(out.origem).toBe('legado')
    expect(out.latitude).toBeNull()
    expect(out.superficies).toEqual([])
    expect(out.telhado).toBeNull()          // passthrough fiel: sem telhado legado → null
    expect(out.geometria.pontos).toEqual([]) // visão normalizada
  })
  it('undefined não quebra', () => {
    expect(() => obterLocalProjeto(undefined)).not.toThrow()
  })
})
