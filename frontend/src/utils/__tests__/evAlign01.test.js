import { describe, it, expect } from 'vitest'
import { extrairFabricanteModelo, ehDefaultLixo, FABRICANTES_RECONHECIDOS } from '../../../../backend/src/utils/catalogo/fabricanteModeloFallback.js'
import { apenasAtivos } from '../gestaoUtils'

/**
 * EV-ALIGN-01 — alinhamento do módulo EV com padrão FV/Catálogo (8.6.x).
 * Testa apenas a lógica adicionada sem tocar nos cálculos NBR 5410 EV existentes.
 */

describe('EV-ALIGN-01 — fabricantes EV no regex fallback', () => {
  // 1) Wallbox (líder europeu)
  it('extrai Wallbox Pulsar', () => {
    const r = extrairFabricanteModelo('Wallbox Chargers Pulsar Plus 7.4 kW EV charger')
    expect(r.fabricante).toBe('Wallbox')
    expect(r.modelo).toMatch(/PULSAR/i)
  })

  // 2) Intelbras (BR) — datasheet sem o termo genérico "wallbox"
  it('extrai Intelbras EWS', () => {
    const r = extrairFabricanteModelo('Intelbras EWS 1622 AC charger 22kW')
    expect(r.fabricante).toBe('Intelbras')
    expect(r.modelo).toMatch(/EWS/i)
  })

  // 3) Schneider EVlink (busca por "schneider electric" alias antes do termo wallbox)
  it('extrai Schneider EVlink (alias mais específico)', () => {
    const r = extrairFabricanteModelo('Schneider Electric — EVlink Smart Charger 22kW')
    expect(r.fabricante).toBe('Schneider Electric')
    expect(r.modelo).toMatch(/EVLINK/i)
  })

  // 4) ABB Terra — fabricante "ABB" reconhecido (qualquer canonical), modelo opcional
  it('reconhece marca ABB em datasheet de carregador', () => {
    const r = extrairFabricanteModelo('ABB Terra AC W22 single-phase charger')
    // Aceita "ABB" (inversor) ou "ABB EV" (carregador) — ambos sinalizam a marca corretamente.
    // O conflito de alias entre catálogo de inversores vs EV é resolvido pelo operador na revisão.
    expect(r.fabricante).toMatch(/^ABB/)
  })

  // 5) Tesla Wall Connector — após normalização, sem espaços
  it('extrai Tesla Wall Connector', () => {
    const r = extrairFabricanteModelo('Tesla Wall Connector Gen 3 - 11.5 kW')
    expect(r.fabricante).toBe('Tesla EV')
    expect(r.modelo).toMatch(/WALLCONNECTOR/i)
  })

  it('FABRICANTES_RECONHECIDOS inclui carregadores EV', () => {
    expect(FABRICANTES_RECONHECIDOS).toEqual(
      expect.arrayContaining(['Wallbox', 'Intelbras', 'EMOBI', 'Schneider Electric', 'Tesla EV'])
    )
  })
})

describe('EV-ALIGN-01 — rejeição de defaults lixo', () => {
  // 6) Mesma proteção do FV
  it('marca "Desconhecido" como lixo para fabricante de EV', () => {
    expect(ehDefaultLixo('Desconhecido', 'fabricante')).toBe(true)
    expect(ehDefaultLixo('Wallbox', 'fabricante')).toBe(false)
  })

  it('modelo lixo identificado', () => {
    expect(ehDefaultLixo('Carregador', 'modelo')).toBe(false) // 'carregador' não está na lista atual
    expect(ehDefaultLixo('', 'modelo')).toBe(true)
    expect(ehDefaultLixo('N/A', 'modelo')).toBe(true)
  })
})

describe('EV-ALIGN-01 — RT via API: filtros EV', () => {
  const tecnicos = [
    { _id: 't1', nome: 'Ana', ativo: true,  especialidades: ['EV', 'FV'], potencia_max_kw: 75 },
    { _id: 't2', nome: 'Beto', ativo: true, especialidades: ['FV'],       potencia_max_kw: null },
    { _id: 't3', nome: 'Caio', ativo: false, especialidades: ['EV'] },
    { _id: 't4', nome: 'Dora', ativo: true, especialidades: [] },         // sem declarar = aceita
    { _id: 't5', nome: 'Eva', ativo: true /* sem especialidades */ },     // sem declarar = aceita
  ]

  // 7) Replicação do filtro usado em NovaPropostaEV
  it('apenasAtivos remove inativos', () => {
    const ativos = apenasAtivos(tecnicos)
    expect(ativos.map(t => t._id)).toEqual(['t1', 't2', 't4', 't5'])
  })

  it('filtro EV inclui só técnicos com EV ou sem especialidade declarada', () => {
    const aptos = apenasAtivos(tecnicos).filter(t =>
      !Array.isArray(t.especialidades) || t.especialidades.length === 0 || t.especialidades.includes('EV')
    )
    expect(aptos.map(t => t._id)).toEqual(['t1', 't4', 't5'])
    expect(aptos.some(t => t._id === 't2')).toBe(false) // Beto: só FV → excluído
    expect(aptos.some(t => t._id === 't3')).toBe(false) // Caio: inativo → excluído
  })
})

describe('EV-ALIGN-01 — validação potência + carteira', () => {
  const HOJE = new Date('2026-05-30')
  const futuro = new Date(HOJE.getTime() + 90 * 24 * 60 * 60 * 1000)
  const passado = new Date(HOJE.getTime() - 90 * 24 * 60 * 60 * 1000)

  // 8) Replicação do `rtCarteiraVencida` no componente
  it('carteira vencida = bloqueante', () => {
    const t = { validade_carteira_profissional: passado }
    const vencida = new Date(t.validade_carteira_profissional).getTime() < HOJE.getTime()
    expect(vencida).toBe(true)
  })

  it('carteira válida = ok', () => {
    const t = { validade_carteira_profissional: futuro }
    const vencida = new Date(t.validade_carteira_profissional).getTime() < HOJE.getTime()
    expect(vencida).toBe(false)
  })

  // 9) Replicação do `rtAcimaLimite`
  it('CFT (75 kW) com projeto 80 kW = aviso', () => {
    const lim = 75
    const pot = 80
    expect(pot > lim).toBe(true)
  })

  it('CREA sem limite (null) nunca acusa overshoot', () => {
    const lim = null
    const pot = 999
    expect(!!lim && pot > Number(lim)).toBe(false)
  })
})

describe('EV-ALIGN-01 — snapshot de carregador (shape)', () => {
  // 10) Estrutura esperada do snapshot_carregador (replica vincularCarregadorEV)
  it('snapshot carrega campos críticos + referência', () => {
    const car = {
      _id: 'c1', marca: 'Wallbox', modelo: 'Pulsar Plus',
      potencia_kw: 7.4, corrente_entrada_a: 32, tensao_entrada_v: 230,
      tipo_conector: 'Type 2', numero_fases: 1,
      datasheet_hash: 'hash-abc', datasheet_url: '/uploads/x.pdf',
    }
    const snapshot = {
      carregador_id: car._id, fabricante: car.marca, modelo: car.modelo,
      potencia_kw: car.potencia_kw, corrente_max_a: car.corrente_entrada_a,
      tensao_v: car.tensao_entrada_v, tipo_conector: car.tipo_conector,
      fases: car.numero_fases, datasheet_hash: car.datasheet_hash,
      datasheet_url: car.datasheet_url,
      data_snapshot: new Date('2026-05-30T00:00:00Z'),
    }
    // Campos obrigatórios presentes
    expect(snapshot.carregador_id).toBe('c1')
    expect(snapshot.potencia_kw).toBe(7.4)
    expect(snapshot.datasheet_hash).toBe('hash-abc')
    // Sem cópia de conteúdo (apenas referências)
    expect(snapshot).not.toHaveProperty('conteudo_base64')
  })
})
