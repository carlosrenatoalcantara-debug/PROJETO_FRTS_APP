import { describe, it, expect, beforeEach } from 'vitest'
import { validarMicroinversores } from '../../../../backend/src/utils/fv/validacaoMicroinversores.js'
import {
  chaveProjetoValida,
  salvarDiagramaLocal,
  carregarDiagramaLocal,
} from '../../components/diagram/utils/diagramPersistence.js'

/**
 * Sprint P0-FV-STABILITY — testes das correções de estabilidade do núcleo FV.
 *  P1-03: validação física de microinversores
 *  P0-03: chave de diagrama por _id (nunca por nome) — guarda anti-cruzamento
 */

describe('P1-03 — validarMicroinversores (validação física)', () => {
  it('BLOQUEIA o caso reproduzido: 20 módulos / 5 micros / 1 entrada', () => {
    const r = validarMicroinversores({ numModulos: 20, numMicros: 5, entradasPorMicro: 1 })
    expect(r.valido).toBe(false)
    expect(r.bloqueios.join(' ')).toMatch(/excedem a capacidade/i)
  })

  it('ACEITA 20 módulos / 5 micros / 4 entradas (cabe exatamente)', () => {
    const r = validarMicroinversores({ numModulos: 20, numMicros: 5, entradasPorMicro: 4 })
    expect(r.valido).toBe(true)
    expect(r.bloqueios).toHaveLength(0)
  })

  it('ACEITA 20 módulos / 10 micros / 2 entradas', () => {
    const r = validarMicroinversores({ numModulos: 20, numMicros: 10, entradasPorMicro: 2 })
    expect(r.valido).toBe(true)
  })

  it('BLOQUEIA micro ocioso: 4 módulos / 5 micros', () => {
    const r = validarMicroinversores({ numModulos: 4, numMicros: 5, entradasPorMicro: 2 })
    expect(r.valido).toBe(false)
    expect(r.bloqueios.join(' ')).toMatch(/sem nenhum módulo/i)
  })

  it('BLOQUEIA limite do fabricante por micro', () => {
    const r = validarMicroinversores({
      numModulos: 12, numMicros: 3, entradasPorMicro: 4, maxModulosPorMicro: 2,
    })
    expect(r.valido).toBe(false)
    expect(r.bloqueios.join(' ')).toMatch(/limite do fabricante/i)
  })

  it('BLOQUEIA oversizing CC/CA acima do limite DECLARADO', () => {
    // 4 módulos de 550W por micro = 2200W CC; micro de 800W CA → 2.75×.
    // FV-DOM-031 (decisão 3): o limite é o do CATÁLOGO. Antes esta asserção
    // passava contra `?? 1.5`, um default fabricado — o mesmo defeito que a
    // FV-DOM-029 removeu do lado string. Agora o limite é informado.
    const r = validarMicroinversores({
      numModulos: 4, numMicros: 1, entradasPorMicro: 4,
      potenciaModuloW: 550, potenciaMicroCA_W: 800, oversizingMax: 1.25,
    })
    expect(r.valido).toBe(false)
    expect(r.bloqueios.join(' ')).toMatch(/CC\/CA/i)
  })

  it('SEM limite declarado não há veredito de oversizing — avisa, não bloqueia', () => {
    // FV-DOM-031 (decisão 3): "remover defaults artificiais". Ausência de
    // `oversizing_max` no catálogo é lacuna, não aprovação nem reprovação.
    const r = validarMicroinversores({
      numModulos: 4, numMicros: 1, entradasPorMicro: 4,
      potenciaModuloW: 550, potenciaMicroCA_W: 800,
    })
    expect(r.valido).toBe(true)
    expect(r.bloqueios).toHaveLength(0)
    expect(r.avisos.join(' ')).toMatch(/não declara `oversizing_max`/i)
    expect(r.resumo.oversizing_mais_carregado).toBe(2.75)
  })

  it('mede o oversizing no micro MAIS CARREGADO, não na média', () => {
    // 7 módulos de 550W em 2 micros de 2000W → [4,3].
    // média = 3,5 → 1,93×  ·  mais carregado = 4 → 2,20×
    // Com limite 2,0 a média passaria e o mais carregado reprova (decisão 3).
    const r = validarMicroinversores({
      numModulos: 7, numMicros: 2, entradasPorMicro: 4,
      potenciaModuloW: 550, potenciaMicroCA_W: 2000, oversizingMax: 2.0,
    })
    expect(r.resumo.distribuicao).toEqual([4, 3])
    expect(r.resumo.oversizing_mais_carregado).toBe(1.1)
    expect(r.valido).toBe(true)

    const apertado = validarMicroinversores({
      numModulos: 7, numMicros: 2, entradasPorMicro: 4,
      potenciaModuloW: 550, potenciaMicroCA_W: 1000, oversizingMax: 2.0,
    })
    expect(apertado.resumo.oversizing_mais_carregado).toBe(2.2)
    expect(apertado.valido).toBe(false)
  })

  it('ACEITA oversizing saudável e calcula potência total', () => {
    // 1 módulo 400W / micro 350W CA → 1.14× OK
    const r = validarMicroinversores({
      numModulos: 8, numMicros: 8, entradasPorMicro: 1,
      potenciaModuloW: 400, potenciaMicroCA_W: 350,
    })
    expect(r.valido).toBe(true)
    expect(r.resumo.potenciaTotalCC_W).toBe(3200)
  })

  it('AVISA distribuição desbalanceada sem bloquear', () => {
    const r = validarMicroinversores({ numModulos: 7, numMicros: 2, entradasPorMicro: 4 })
    expect(r.valido).toBe(true)
    expect(r.avisos.join(' ')).toMatch(/desbalanceada/i)
  })

  it('BLOQUEIA entradas inválidas', () => {
    const r = validarMicroinversores({ numModulos: 10, numMicros: 5, entradasPorMicro: 0 })
    expect(r.valido).toBe(false)
  })
})

describe('P0-03 — chave de diagrama por _id (anti-cruzamento)', () => {
  it('rejeita chaves ambíguas/compartilhadas', () => {
    expect(chaveProjetoValida('')).toBe(false)
    expect(chaveProjetoValida('   ')).toBe(false)
    expect(chaveProjetoValida(null)).toBe(false)
    expect(chaveProjetoValida(undefined)).toBe(false)
    expect(chaveProjetoValida('undefined')).toBe(false)
    expect(chaveProjetoValida('sem-nome')).toBe(false)
    expect(chaveProjetoValida('proposta-sem-nome')).toBe(false)
  })

  it('aceita chaves estáveis por _id / draft', () => {
    expect(chaveProjetoValida('projeto-fv-507f1f77bcf86cd799439011')).toBe(true)
    expect(chaveProjetoValida('projeto-ev-507f1f77bcf86cd799439011')).toBe(true)
    expect(chaveProjetoValida('ev-draft-1700000000000-abc123')).toBe(true)
    expect(chaveProjetoValida('507f1f77bcf86cd799439011')).toBe(true)
  })

  describe('persistência não cruza projetos', () => {
    beforeEach(() => {
      const store = {}
      global.localStorage = {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v) },
        removeItem: (k) => { delete store[k] },
        clear: () => { for (const k in store) delete store[k] },
        key: (i) => Object.keys(store)[i] ?? null,
        get length() { return Object.keys(store).length },
      }
    })

    it('NÃO salva sob chave ambígua (retorna false)', () => {
      const ok = salvarDiagramaLocal('sem-nome', [{ id: 'n1' }], [])
      expect(ok).toBe(false)
      expect(carregarDiagramaLocal('sem-nome')).toBeNull()
    })

    it('dois _id distintos têm diagramas independentes', () => {
      salvarDiagramaLocal('projeto-fv-aaa', [{ id: 'A' }], [])
      salvarDiagramaLocal('projeto-fv-bbb', [{ id: 'B' }], [])
      expect(carregarDiagramaLocal('projeto-fv-aaa').nodes[0].id).toBe('A')
      expect(carregarDiagramaLocal('projeto-fv-bbb').nodes[0].id).toBe('B')
    })
  })
})
