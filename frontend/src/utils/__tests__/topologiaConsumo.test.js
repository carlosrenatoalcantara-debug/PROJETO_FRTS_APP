import { describe, it, expect } from 'vitest'
import {
  obterTopologiaProjeto, instalacaoValida,
  mapearGeradoresInstalacao, totaisTopologia, entradaCompatibilidadeString,
  montarGerador, montarString,
} from '../../../../backend/src/dominio/topologia/index.js'

/**
 * S3-FV-ENGINE-TOPOLOGY-CONSUMPTION-01 — consumo da topologia pela Engenharia.
 * Prova: Arranjo e Instalação equivalentes → MESMOS totais de engenharia.
 * Ordem de resolução (regra 3) e não-mistura (regra 4). Sem persistir derivados.
 */

const MOD = '000000000000000000000aaa'
const MOD_B = '000000000000000000000bbb'
const INV = '000000000000000000000fff'

// Catálogo resolvido por id (specs que o adapter lê para o caminho Instalação).
const catalogo = {
  [MOD]: { _id: MOD, modelo: 'CS-550', potencia_w: 550, especificacoes: { potencia_wp: 550, voc: 49.8, isc: 13.9, vmpp: 41.8 } },
  [MOD_B]: { _id: MOD_B, modelo: 'JK-560', potencia_w: 560, especificacoes: { potencia_wp: 560, voc: 50.4, isc: 14.0, vmpp: 42.1 } },
  [INV]: { _id: INV, modelo: 'MIN-10', potencia_kw: 10, especificacoes: { n_mppts: 2, entradas_por_mppt: 2 } },
}

// Projeto LEGADO equivalente (arranjo único implícito via equipamentos): 24×550W + 1×10kW.
const projetoArranjo = {
  equipamentos: {
    paineis: [{ modelo: 'CS-550', potencia_w: 550, quantidade: 24 }],
    inversor: { marca: 'Growatt', modelo: 'MIN-10', potencia_kw: 10, quantidade: 1 },
  },
}

// Instalação equivalente: 1 gerador (INV), 2 MPPTs, 2 strings de 12 módulos = 24.
function instalacaoEquivalente() {
  const inv = { _id: INV, especificacoes: { n_mppts: 2 } }
  const g = montarGerador(inv)
  g.mppts[0].strings.push(montarString({ indice_entrada: 1, composicao: [{ modulo_ref: MOD, quantidade: 12 }], superficie_id: 'sup1' }))
  g.mppts[1].strings.push(montarString({ indice_entrada: 1, composicao: [{ modulo_ref: MOD, quantidade: 12 }], superficie_id: 'sup1' }))
  return { geradores: [g] }
}

describe('instalacaoValida', () => {
  it('vazia → inválida', () => expect(instalacaoValida({ geradores: [] })).toBe(false))
  it('null → inválida', () => expect(instalacaoValida(null)).toBe(false))
  it('com gerador → válida', () => expect(instalacaoValida(instalacaoEquivalente())).toBe(true))
})

describe('EQUIVALÊNCIA — Arranjo vs Instalação (mesmos totais de engenharia)', () => {
  const viaArranjo = obterTopologiaProjeto(projetoArranjo)
  const viaInstalacao = obterTopologiaProjeto(null, { instalacao: instalacaoEquivalente(), catalogo })

  it('origens corretas', () => {
    expect(viaArranjo.origem).toBe('arranjo')
    expect(viaInstalacao.origem).toBe('instalacao')
  })
  it('nº de módulos idêntico', () => {
    expect(viaArranjo.totais.n_modulos_total).toBe(24)
    expect(viaInstalacao.totais.n_modulos_total).toBe(24)
  })
  it('potência DC (kWp) idêntica', () => {
    expect(viaArranjo.totais.potencia_total_kwp).toBe(13.2)
    expect(viaInstalacao.totais.potencia_total_kwp).toBe(13.2)
  })
  it('nº de inversores idêntico', () => {
    expect(viaArranjo.totais.n_inversores_total).toBe(1)
    expect(viaInstalacao.totais.n_inversores_total).toBe(1)
  })
  it('potência AC (kW) idêntica', () => {
    expect(viaArranjo.totais.potencia_inversor_total_kw).toBe(10)
    expect(viaInstalacao.totais.potencia_inversor_total_kw).toBe(10)
  })
})

describe('oversizing por Gerador (derivado em leitura, DC/AC)', () => {
  it('13,2 kWp / 10 kW = 1,32', () => {
    const g = mapearGeradoresInstalacao(instalacaoEquivalente(), catalogo)[0]
    expect(g.oversizing).toBe(1.32)
    expect(g.dimensionamento.n_modulos).toBe(24)
  })
})

describe('String HETEROGÊNEA — kWp soma por item da composição', () => {
  it('17×555 + 3×560 = 11,115 kWp', () => {
    const inv = { _id: INV, especificacoes: { n_mppts: 1 } }
    const g = montarGerador(inv)
    g.mppts[0].strings.push(montarString({
      indice_entrada: 1,
      composicao: [{ modulo_ref: MOD, quantidade: 17 }, { modulo_ref: MOD_B, quantidade: 3 }],
      superficie_id: 'sup1',
    }))
    const cat = { ...catalogo, [MOD]: { ...catalogo[MOD], potencia_w: 555 } }
    const totais = totaisTopologia(mapearGeradoresInstalacao({ geradores: [g] }, cat))
    expect(totais.n_modulos_total).toBe(20)
    expect(totais.potencia_total_kwp).toBe(11.115)
  })
})

describe('REGRA 4 — nunca mistura modelos', () => {
  it('Instalação válida vence, mesmo com arranjo presente no projeto', () => {
    // projeto tem arranjo de 24 módulos; instalação tem 24 também mas origem deve ser instalacao
    const out = obterTopologiaProjeto(projetoArranjo, { instalacao: instalacaoEquivalente(), catalogo })
    expect(out.origem).toBe('instalacao')          // regra 3: Instalação válida vence
    expect(out.geradores[0].origem).toBe('instalacao')
  })
  it('sem Instalação válida → cai 100% no Arranjo', () => {
    const out = obterTopologiaProjeto(projetoArranjo, { instalacao: { geradores: [] } })
    expect(out.origem).toBe('arranjo')
  })
})

describe('String canônica alimenta a compatibilidade EXISTENTE (reuso, não reimplementação)', () => {
  it('projeta entrada com modulos_por_string e flag homogênea', () => {
    const s = montarString({ indice_entrada: 1, composicao: [{ modulo_ref: MOD, quantidade: 18 }], superficie_id: 'sup1' })
    const entrada = entradaCompatibilidadeString(s, catalogo)
    expect(entrada.homogenea).toBe(true)
    expect(entrada.modulos_por_string).toBe(18)
    expect(entrada.itens[0].especificacoes).toBeTruthy()   // specs resolvidas do catálogo
    expect(entrada.superficie_id).toBe('sup1')
  })
  it('heterogênea expõe múltiplos itens', () => {
    const s = montarString({ composicao: [{ modulo_ref: MOD, quantidade: 10 }, { modulo_ref: MOD_B, quantidade: 2 }], superficie_id: 'sup1' })
    const entrada = entradaCompatibilidadeString(s, catalogo)
    expect(entrada.homogenea).toBe(false)
    expect(entrada.itens).toHaveLength(2)
    expect(entrada.modulos_por_string).toBe(12)
  })
})

describe('nenhum derivado persistido — só projeção em leitura', () => {
  it('mapear não muta a Instalação de entrada', () => {
    const inst = instalacaoEquivalente()
    const antes = JSON.stringify(inst)
    mapearGeradoresInstalacao(inst, catalogo)
    expect(JSON.stringify(inst)).toBe(antes)   // entrada intacta
  })
})
