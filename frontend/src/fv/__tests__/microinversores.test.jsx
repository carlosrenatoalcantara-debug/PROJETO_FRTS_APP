import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * FV-DOM-031 — microinversores.
 *
 * O que estes testes protegem:
 *  1. a classificação é ÚNICA (decisão 4) — um micro é micro nos três caminhos;
 *  2. `entradas`/`modulos_por_entrada` chegam do catálogo ao consumidor (decisão 2);
 *  3. a topologia é `micro → entradas → módulos`, nunca MPPT/strings (decisão 5);
 *  4. o oversizing usa o micro MAIS CARREGADO e o limite DO CATÁLOGO (decisão 3);
 *  5. sem limite declarado não há veredito — avisa, não aprova nem reprova;
 *  6. o exemplo 24 × 650 W em 6 micros de 2 kW REPROVA e explica (decisão 6);
 *  7. modelos MISTOS: cada um com sua quantidade, entradas e distribuição (decisão 1);
 *  8. a composição da FV-UX-029 continua a fonte (decisão 8) e a estrutura
 *     da FV-UX-030 é preservada (decisão 9);
 *  9. múltiplas opções continuam fora (decisão 10).
 */

const salvarEtapa = vi.fn()
const listarCatalogo = vi.fn()

vi.mock('../api/agregadosFvApi', () => ({
  listarCatalogo: (...a) => listarCatalogo(...a),
  validarCompatibilidadeEletrica: vi.fn(),
}))

const M650 = {
  _id: 'm1', tipo: 'modulo', fabricante: 'Znshine', modelo: 'ZXM7-UHLD144-650/M',
  especificacoes: { potencia_w: 650, voc_v: 45.5, isc_a: 18.35, vmpp_v: 38.1, impp_a: 17.06,
    coef_temp_voc_pct_c: -0.25, noct_c: 44 },
}
/** Hoymiles HMS-2000-4T — 4 entradas, 1 módulo/entrada, 2,0 kW, CC/CA máx 1,25×. */
const MICRO_A = {
  _id: 'a1', tipo: 'inversor', fabricante: 'Hoymiles', modelo: 'HMS-2000-4T',
  especificacoes: { potencia: 2.0, fases: 1, tensao_max_entrada: 60, tensao_mppt_min: 16,
    tensao_mppt_max: 60, corrente_max_por_mppt: 16, entradas: 4, modulos_por_entrada: 1,
    oversizing_max: 1.25, topologia: 'micro' },
}
/** APsystems QS1 — 4 entradas, 1,6 kW. */
const MICRO_B = {
  _id: 'b1', tipo: 'inversor', fabricante: 'APsystems', modelo: 'QS1',
  especificacoes: { potencia: 1.6, fases: 1, tensao_max_entrada: 60, tensao_mppt_min: 16,
    tensao_mppt_max: 60, corrente_max_por_mppt: 14, entradas: 4, modulos_por_entrada: 1,
    oversizing_max: 1.25, topologia: 'micro' },
}
/** Micro sem envelope declarado — a lacuna. */
const MICRO_SEM = {
  _id: 'c1', tipo: 'inversor', fabricante: 'Hoymiles', modelo: 'HMS-800-2T',
  especificacoes: { potencia: 0.8, fases: 1, tensao_max_entrada: 60, topologia: 'micro' },
}
const STRING15 = {
  _id: 'i1', tipo: 'inversor', fabricante: 'Sungrow', modelo: 'SG15RT',
  especificacoes: { potencia: 15, fases: 3, tensao_max_entrada: 1000, tensao_mppt_min: 200,
    tensao_mppt_max: 850, corrente_max_por_mppt: 25, n_mppts: 3 },
}

const painel = (q) => ({ id: 'm1', marca: 'Znshine', modelo: 'ZXM7-UHLD144-650/M', potencia_w: 650, quantidade: q, equipamento_id: 'm1' })
const invComp = (eq, q) => ({ id: eq._id, marca: eq.fabricante, modelo: eq.modelo,
  potencia_kw: eq.especificacoes.potencia, tipo: 'micro', fases: 1, quantidade: q, equipamento_id: eq._id })

const projetoCom = (inversores, extras = {}) => ({
  _id: 'p1', nome: 'P',
  dimensionamento: { num_paineis: 24 },
  localizacao: { estado: 'RN' },
  equipamentos: {
    paineis: [painel(24)],
    inversor: { ...inversores[0] },
    estrutura: { tipo: 'Fibrocimento', descricao: 'gancho' },
  },
  arranjos: [{
    id: 'principal', rotulo: 'Arranjo principal', tipo: 'principal',
    paineis: [painel(24)], inversores,
    ...extras,
  }],
})

let projetoAtual = null
vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({
    projetoId: 'p1', projeto: projetoAtual, carregando: false, erro: null,
    recarregar: vi.fn(), acoes: { salvarEtapa },
  }),
}))

import EtapaMppt from '../paginas/etapas/EtapaMppt'
import {
  avaliar, capacidadeDoBloco, composicaoEhMicro, composicaoMista, configDaComposicao,
  coerenciaComComposicao, daConfigPersistida, distribuicaoDoBloco,
  microsNecessariosNoBloco, modulosAtribuidos, paraArranjoComMicros,
  paraConfigPersistida, totalDeMicros,
} from '../microinversores'
import { entradasDoMicro, modulosPorEntradaDoMicro, oversizingMaxDoInversor, ehMicro, tipoDoInversor } from '../catalogo'
import { classificarTopologiaInversor, TOPOLOGIA, lerInversor, paraDimensionamento } from '@fortesolar/fv-shared/inversores'
import { avaliarModeloMicro, capacidadeDoMicro, distribuirEntreMicros, distribuirEntreEntradas, microsNecessarios, microsParaLimite, modulosQueCabem } from '@fortesolar/fv-shared/engenharia/microinversores'

const CATALOGO = [MICRO_A, MICRO_B, MICRO_SEM, STRING15]

beforeEach(() => {
  vi.clearAllMocks()
  projetoAtual = projetoCom([invComp(MICRO_A, 6)])
  listarCatalogo.mockImplementation((t) =>
    Promise.resolve({ equipamentos: t === 'modulo' ? [M650] : CATALOGO }))
  salvarEtapa.mockResolvedValue(undefined)
})

// ═══ 1 · Classificação única (decisão 4) ════════════════════════════════════
describe('FV-DOM-031 · classificação canônica', () => {
  it('1 · o campo explícito manda', () => {
    expect(classificarTopologiaInversor({ tipo_topologia: 'MICRO' })).toBe(TOPOLOGIA.MICRO)
    expect(classificarTopologiaInversor({ topologia: 'micro' })).toBe(TOPOLOGIA.MICRO)
    expect(classificarTopologiaInversor({ tipo_topologia: 'otimizador' })).toBe(TOPOLOGIA.OTIMIZADOR)
    expect(classificarTopologiaInversor({ topologia: 'hibrido' })).toBe(TOPOLOGIA.HYBRID)
  })

  it('2 · o Deye SUN-M2000G4 é micro — era STRING antes da consolidação', () => {
    expect(classificarTopologiaInversor({}, { fabricante: 'Deye', modelo: 'SUN-M2000G4' }))
      .toBe(TOPOLOGIA.MICRO)
  })

  it('3 · SolarEdge é otimizador — a SSOT dizia STRING', () => {
    expect(classificarTopologiaInversor({}, { fabricante: 'SolarEdge', modelo: 'SE5000H HD-Wave' }))
      .toBe(TOPOLOGIA.OTIMIZADOR)
  })

  it('4 · híbrido antes de micro: "SUN-5K-SG" não é micro', () => {
    expect(classificarTopologiaInversor({}, { fabricante: 'Deye', modelo: 'SUN-5K-SG04LP1' }))
      .toBe(TOPOLOGIA.HYBRID)
  })

  it('5 · string permanece string', () => {
    expect(classificarTopologiaInversor({ tensao_max_entrada: 1000 },
      { fabricante: 'Sungrow', modelo: 'SG15RT' })).toBe(TOPOLOGIA.STRING)
  })

  it('6 · `tipoDoInversor` da nova UX concorda com o canônico', () => {
    for (const eq of [MICRO_A, MICRO_B, MICRO_SEM]) {
      expect(tipoDoInversor(eq)).toBe('micro')
      expect(ehMicro(eq)).toBe(true)
    }
    expect(tipoDoInversor(STRING15)).toBe('string')
    expect(ehMicro(STRING15)).toBe(false)
  })
})

// ═══ 2 · SSOT (decisão 2) ═══════════════════════════════════════════════════
describe('FV-DOM-031 · o envelope do micro chega ao consumidor', () => {
  it('7 · `entradas` e `modulos_por_entrada` são canônicos agora', () => {
    const c = lerInversor(MICRO_A.especificacoes, { fabricante: 'Hoymiles', modelo: 'HMS-2000-4T' })
    expect(c.entradas).toBe(4)
    expect(c.modulos_por_entrada).toBe(1)
  })

  it('8 · `paraDimensionamento` expõe o envelope e declara a lacuna do micro', () => {
    const completo = paraDimensionamento(MICRO_A.especificacoes, {})
    expect(completo.entradas).toBe(4)
    expect(completo.modulos_por_entrada).toBe(1)
    expect(completo.oversizing_max).toBe(1.25)
    expect(completo.lacunas_micro).toEqual([])

    const sem = paraDimensionamento(MICRO_SEM.especificacoes, {})
    expect(sem.entradas).toBe(null)
    expect(sem.modulos_por_entrada).toBe(null)
    expect(sem.lacunas_micro).toEqual(['entradas', 'modulos_por_entrada', 'oversizing_max'])
  })

  it('9 · fora da topologia micro, `lacunas_micro` é sempre vazio', () => {
    expect(paraDimensionamento(STRING15.especificacoes, {}).lacunas_micro).toEqual([])
  })

  it('10 · os leitores da nova UX não inventam default', () => {
    expect(entradasDoMicro(MICRO_A)).toBe(4)
    expect(modulosPorEntradaDoMicro(MICRO_A)).toBe(1)
    expect(oversizingMaxDoInversor(MICRO_A)).toBe(1.25)
    expect(entradasDoMicro(MICRO_SEM)).toBe(null)
    expect(modulosPorEntradaDoMicro(MICRO_SEM)).toBe(null)
    expect(oversizingMaxDoInversor(MICRO_SEM)).toBe(null)
  })
})

// ═══ 3 · Motor canônico (decisões 3, 5, 6, 7) ═══════════════════════════════
describe('FV-DOM-031 · motor de microinversores', () => {
  it('11 · capacidade é entradas × módulos/entrada — nunca 1 por omissão', () => {
    expect(capacidadeDoMicro({ entradas: 4, modulos_por_entrada: 1 })).toBe(4)
    expect(capacidadeDoMicro({ entradas: 2, modulos_por_entrada: 2 })).toBe(4)
    expect(capacidadeDoMicro({ entradas: 4 })).toBe(null)
    expect(capacidadeDoMicro({})).toBe(null)
  })

  it('12 · distribuição EQUILIBRADA (FV-DOM-031B)', () => {
    expect(distribuirEntreMicros(24, 6, 4)).toEqual([4, 4, 4, 4, 4, 4])
    // o exemplo do enunciado da FV-DOM-031B
    expect(distribuirEntreMicros(6, 2, 4)).toEqual([3, 3])
    // sobra inevitável: a menor diferença possível
    expect(distribuirEntreMicros(7, 2, 4)).toEqual([4, 3])
    expect(distribuirEntreMicros(26, 7, 4)).toEqual([4, 4, 4, 4, 4, 3, 3])
    expect(distribuirEntreMicros(10, 4, 4)).toEqual([3, 3, 2, 2])
    expect(distribuirEntreMicros(10, 4, null)).toBe(null)
  })

  it('12b · a soma é sempre o total, e ninguém passa da capacidade', () => {
    for (const [t, q, c] of [[24, 6, 4], [26, 7, 4], [7, 2, 4], [6, 2, 4], [1, 3, 2], [100, 7, 20]]) {
      const d = distribuirEntreMicros(t, q, c)
      expect(d.reduce((a, b) => a + b, 0), `${t}/${q}/${c}`).toBe(t)
      expect(Math.max(...d) <= c, `${t}/${q}/${c} respeita a capacidade`).toBe(true)
      // equilibrada: a diferença entre o mais e o menos carregado é 0 ou 1
      expect(Math.max(...d) - Math.min(...d)).toBeLessThanOrEqual(1)
    }
  })

  it('12c · acima da capacidade total, o excedente é RECUSADO, não empilhado', () => {
    // 24 módulos em 4 micros de capacidade 4 = 16. Ninguém recebe 6.
    const d = distribuirEntreMicros(24, 4, 4)
    expect(d).toEqual([4, 4, 4, 4])
    expect(d.reduce((a, b) => a + b, 0)).toBe(16)   // quem bloqueia é o avaliador
  })

  it('12d · dentro do micro, os módulos também se repartem entre as entradas', () => {
    expect(distribuirEntreEntradas(3, 4, 1)).toEqual([1, 1, 1, 0])
    expect(distribuirEntreEntradas(4, 4, 1)).toEqual([1, 1, 1, 1])
    expect(distribuirEntreEntradas(6, 4, 2)).toEqual([2, 2, 1, 1])
    expect(distribuirEntreEntradas(6, 4, null)).toBe(null)
  })

  it('13 · O EXEMPLO DO ENUNCIADO REPROVA e explica (decisão 6)', () => {
    const r = avaliarModeloMicro({
      modulos: 24, quantidade: 6,
      micro: { entradas: 4, modulos_por_entrada: 1, potencia_kw: 2.0, oversizing_max: 1.25 },
      potenciaModuloW: 650,
    })
    expect(r.valido).toBe(false)
    // O resumo CONTINUA preenchido: o bloqueio é de regra, não de dado ausente.
    // Quem reprova precisa ver os números que reprovaram.
    expect(r.resumo.oversizing_mais_carregado).toBe(1.3)
    expect(r.resumo.oversizing_max).toBe(1.25)
    expect(r.resumo.distribuicao).toEqual([4, 4, 4, 4, 4, 4])
  })

  it('13b · a reprovação traz número medido, limite e quantos módulos cabem', () => {
    const r = avaliarModeloMicro({
      modulos: 24, quantidade: 6,
      micro: { entradas: 4, modulos_por_entrada: 1, potencia_kw: 2.0, oversizing_max: 1.25 },
      potenciaModuloW: 650,
    })
    const m = r.bloqueios.join(' ')
    expect(m).toMatch(/1\.30×/)
    expect(m).toMatch(/1\.25×/)
    expect(m).toMatch(/Cabem 3 módulo/)
    expect(modulosQueCabem(2.0, 1.25, 650)).toBe(3)
  })

  it('14 · a MESMA configuração passa com módulo menor (decisão 7)', () => {
    const r = avaliarModeloMicro({
      modulos: 24, quantidade: 6,
      micro: { entradas: 4, modulos_por_entrada: 1, potencia_kw: 2.0, oversizing_max: 1.25 },
      potenciaModuloW: 550,
    })
    expect(r.valido).toBe(true)
    expect(r.resumo.oversizing_mais_carregado).toBe(1.1)
  })

  it('15 · MAIS MICROS destravam os mesmos 24 módulos (decisão 7 + FV-DOM-031B)', () => {
    // Este é o defeito que a FV-DOM-031 reportou e a 031B corrigiu: com
    // "encher e sobrar" o primeiro micro ficava sempre cheio, então acrescentar
    // micros não mudava o veredito e ainda criava ociosos. Equilibrada, muda.
    const micro = { entradas: 4, modulos_por_entrada: 1, potencia_kw: 2.0, oversizing_max: 1.25 }
    const seis = avaliarModeloMicro({ modulos: 24, quantidade: 6, micro, potenciaModuloW: 650 })
    expect(seis.resumo.distribuicao).toEqual([4, 4, 4, 4, 4, 4])
    expect(seis.resumo.oversizing_mais_carregado).toBe(1.3)
    expect(seis.valido).toBe(false)

    const oito = avaliarModeloMicro({ modulos: 24, quantidade: 8, micro, potenciaModuloW: 650 })
    expect(oito.resumo.distribuicao).toEqual([3, 3, 3, 3, 3, 3, 3, 3])
    expect(oito.resumo.oversizing_mais_carregado).toBe(0.975)
    expect(oito.valido).toBe(true)
    expect(oito.bloqueios).toEqual([])
  })

  it('15b · a reprovação diz QUANTOS micros bastariam (decisão 7)', () => {
    const r = avaliarModeloMicro({
      modulos: 24, quantidade: 6,
      micro: { entradas: 4, modulos_por_entrada: 1, potencia_kw: 2.0, oversizing_max: 1.25 },
      potenciaModuloW: 650,
    })
    expect(r.bloqueios.join(' ')).toMatch(/8 microinversor\(es\) acomodariam os 24 módulos/)
    expect(microsParaLimite(24, 2.0, 1.25, 650, 4)).toBe(8)
  })

  it('15c · a distribuição por ENTRADA é registrada (decisão 5)', () => {
    const r = avaliarModeloMicro({
      modulos: 6, quantidade: 2,
      micro: { entradas: 4, modulos_por_entrada: 1, potencia_kw: 2.0, oversizing_max: 1.25 },
      potenciaModuloW: 550,
    })
    expect(r.resumo.distribuicao).toEqual([3, 3])
    expect(r.resumo.entradas_por_micro_usadas).toEqual([[1, 1, 1, 0], [1, 1, 1, 0]])
  })

  it('16 · oversizing no MAIS CARREGADO, não na média (decisão 3)', () => {
    // 7 módulos em 2 micros → [4,3]. média 3,5 · mais carregado 4.
    const r = avaliarModeloMicro({
      modulos: 7, quantidade: 2,
      micro: { entradas: 4, modulos_por_entrada: 1, potencia_kw: 1.0, oversizing_max: 2.5 },
      potenciaModuloW: 650,
    })
    expect(r.resumo.distribuicao).toEqual([4, 3])
    expect(r.resumo.modulos_no_mais_carregado).toBe(4)
    expect(r.resumo.oversizing_mais_carregado).toBe(2.6)   // 4×650/1000 ÷ 1,0
    expect(r.valido).toBe(false)                            // média daria 2,275 e passaria
  })

  it('17 · sem limite declarado NÃO há veredito — avisa (decisão 3)', () => {
    const r = avaliarModeloMicro({
      modulos: 24, quantidade: 6,
      micro: { entradas: 4, modulos_por_entrada: 1, potencia_kw: 2.0 },
      potenciaModuloW: 650,
    })
    expect(r.valido).toBe(true)
    expect(r.bloqueios).toEqual([])
    expect(r.avisos.join(' ')).toMatch(/não declara `oversizing_max`/)
    expect(r.lacunas).toContain('oversizing_max')
    expect(r.resumo.oversizing_mais_carregado).toBe(1.3)
  })

  it('18 · sem envelope, o motor recusa — não assume micro de 1 entrada', () => {
    const r = avaliarModeloMicro({ modulos: 24, quantidade: 6, micro: {}, potenciaModuloW: 650 })
    expect(r.valido).toBe(false)
    expect(r.bloqueios.join(' ')).toMatch(/Nenhuma capacidade é assumida/)
    expect(r.lacunas).toEqual(['entradas', 'modulos_por_entrada', 'potencia_kw', 'oversizing_max'])
  })

  it('19 · módulos além da capacidade bloqueiam e dizem quantos micros faltam', () => {
    const r = avaliarModeloMicro({
      modulos: 24, quantidade: 4,
      micro: { entradas: 4, modulos_por_entrada: 1, potencia_kw: 2.0, oversizing_max: 1.25 },
      potenciaModuloW: 650,
    })
    expect(r.valido).toBe(false)
    expect(r.bloqueios.join(' ')).toMatch(/Faltam 2 microinversor/)
    expect(microsNecessarios(24, 4)).toBe(6)
  })

  it('20 · NUNCA fala em MPPT ou string (decisão 5)', () => {
    const r = avaliarModeloMicro({
      modulos: 24, quantidade: 4,
      micro: { entradas: 4, modulos_por_entrada: 1, potencia_kw: 2.0, oversizing_max: 1.25 },
      potenciaModuloW: 650,
    })
    const texto = JSON.stringify(r)
    expect(/mppt/i.test(texto)).toBe(false)
    expect(/\bstring/i.test(texto)).toBe(false)
    expect(Object.keys(r.resumo)).toContain('entradas')
  })
})

// ═══ 4 · Modelos mistos (decisão 1) ═════════════════════════════════════════
describe('FV-DOM-031 · modelos mistos', () => {
  it('21 · 4 × Micro A + 2 × Micro B, cada um com o SEU envelope', () => {
    // A: 4 un. × 4 entradas × 2,0 kW → 16 módulos, 4 por micro, 1,10×
    // B: 2 un. × 3 entradas × 1,6 kW →  6 módulos, 3 por micro, 1,03×
    const r = avaliar([
      { marca: 'Hoymiles', modelo: 'HMS-2000-4T', quantidade: 4, entradas_por_micro: 4,
        modulos_por_entrada: 1, modulos: 16, _potencia_kw: 2.0, _oversizing_max: 1.25 },
      { marca: 'APsystems', modelo: 'QS1', quantidade: 2, entradas_por_micro: 3,
        modulos_por_entrada: 1, modulos: 6, _potencia_kw: 1.6, _oversizing_max: 1.25 },
    ], 550, 22)
    expect(r.valido).toBe(true)
    expect(r.por_modelo).toHaveLength(2)
    expect(r.por_modelo[0].resumo.distribuicao).toEqual([4, 4, 4, 4])
    expect(r.por_modelo[1].resumo.distribuicao).toEqual([3, 3])
    expect(r.por_modelo[0].resumo.oversizing_mais_carregado).toBe(1.1)
    expect(r.por_modelo[1].resumo.oversizing_mais_carregado).toBe(1.031)
    expect(r.resumo.quantidade_micros).toBe(6)
    expect(r.resumo.potencia_ca_kw).toBe(11.2)   // 4×2,0 + 2×1,6
  })

  it('21b · o caso que a distribuição desigual reprovava — agora aprova', () => {
    // 6 módulos em 2 micros de capacidade 4. "Encher e sobrar" dava [4,2] e
    // 1,375× > 1,25× → reprovava. Equilibrada dá [3,3] e 1,031× → aprova.
    // Nenhum limite foi afrouxado: o limite continua o do catálogo.
    const r = avaliar([
      { marca: 'A', modelo: 'A', quantidade: 2, entradas_por_micro: 4, modulos_por_entrada: 1,
        modulos: 6, _potencia_kw: 1.6, _oversizing_max: 1.25 },
    ], 550, 6)
    expect(r.por_modelo[0].resumo.distribuicao).toEqual([3, 3])
    expect(r.por_modelo[0].resumo.oversizing_mais_carregado).toBe(1.031)
    expect(r.valido).toBe(true)
  })

  it('21c · e o que estava fora do limite CONTINUA fora (decisão 6)', () => {
    // Equilibrar não é afrouxar: com 2 micros e 8 módulos, [4,4] = 1,375×.
    const r = avaliar([
      { marca: 'A', modelo: 'A', quantidade: 2, entradas_por_micro: 4, modulos_por_entrada: 1,
        modulos: 8, _potencia_kw: 1.6, _oversizing_max: 1.25 },
    ], 550, 8)
    expect(r.por_modelo[0].resumo.distribuicao).toEqual([4, 4])
    expect(r.valido).toBe(false)
    expect(r.por_modelo[0].bloqueios.join(' ')).toMatch(/excede o limite/)
  })

  it('22 · os módulos atribuídos têm de fechar com a composição', () => {
    const r = avaliar([
      { marca: 'A', modelo: 'A', quantidade: 4, entradas_por_micro: 4, modulos_por_entrada: 1,
        modulos: 12, _potencia_kw: 2.0, _oversizing_max: 1.25 },
    ], 550, 24)
    expect(r.valido).toBe(false)
    expect(r.bloqueios.join(' ')).toMatch(/Faltam 12/)
  })

  it('23 · um modelo reprovado reprova a composição', () => {
    const r = avaliar([
      { marca: 'A', modelo: 'A', quantidade: 3, entradas_por_micro: 4, modulos_por_entrada: 1,
        modulos: 12, _potencia_kw: 2.0, _oversizing_max: 1.25 },
      { marca: 'B', modelo: 'B', quantidade: 3, entradas_por_micro: 4, modulos_por_entrada: 1,
        modulos: 12, _potencia_kw: 1.6, _oversizing_max: 1.25 },
    ], 650, 24)
    expect(r.valido).toBe(false)
    expect(r.por_modelo[1].valido).toBe(false)
  })
})

// ═══ 5 · Persistência (decisões 1, 8, 9) ════════════════════════════════════
describe('FV-DOM-031 · persistência', () => {
  it('24 · a composição da FV-UX-029 é a fonte dos modelos (decisão 8)', () => {
    const c = configDaComposicao(
      [invComp(MICRO_A, 4), invComp(MICRO_B, 2)], CATALOGO, 24)
    expect(c).toHaveLength(2)
    expect(c[0]).toMatchObject({ modelo: 'HMS-2000-4T', quantidade: 4, entradas_por_micro: 4, modulos_por_entrada: 1 })
    expect(c[1]).toMatchObject({ modelo: 'QS1', quantidade: 2 })
    // 4 micros × 4 = 16 no primeiro; sobram 8 e o segundo comporta 8.
    expect(c[0].modulos).toBe(16)
    expect(c[1].modulos).toBe(8)
    expect(modulosAtribuidos(c)).toBe(24)
    expect(totalDeMicros(c)).toBe(6)
  })

  it('25 · ida e volta preserva quantidade, entradas e distribuição', () => {
    const c = configDaComposicao([invComp(MICRO_A, 6)], CATALOGO, 24)
    const persistido = paraConfigPersistida(c)
    expect(persistido[0]).toMatchObject({
      equipamento_id: 'a1', marca: 'Hoymiles', modelo: 'HMS-2000-4T',
      quantidade: 6, entradas_por_micro: 4, modulos_por_entrada: 1,
    })
    expect(persistido[0].distribuicao).toEqual([4, 4, 4, 4, 4, 4])

    const devolta = daConfigPersistida(persistido, CATALOGO)
    expect(devolta[0].quantidade).toBe(6)
    expect(devolta[0].modulos).toBe(24)
    // Potência e limite vêm do CATÁLOGO, não da cópia persistida.
    expect(devolta[0]._potencia_kw).toBe(2.0)
    expect(devolta[0]._oversizing_max).toBe(1.25)
  })

  it('26 · o arranjo gravado preserva composição e não cria MPPT (decisões 5 e 8)', () => {
    const arranjo = projetoAtual.arranjos[0]
    const c = configDaComposicao(arranjo.inversores, CATALOGO, 24)
    const novo = paraArranjoComMicros(arranjo, c)
    expect(novo.paineis).toEqual(arranjo.paineis)
    expect(novo.inversores).toEqual(arranjo.inversores)
    expect(novo.topologia).toBe('micro')
    expect(novo.configuracao_eletrica.micros).toHaveLength(1)
    expect(novo.configuracao_eletrica.mppts).toBe(undefined)
  })

  it('26b · divergência com a composição é INFORMADA, não imposta (decisão 8)', () => {
    const composicao = [invComp(MICRO_A, 6)]
    const config = configDaComposicao(composicao, CATALOGO, 24)
    expect(coerenciaComComposicao(config, composicao)).toEqual([])

    // o operador testa 12 micros de 2 entradas (decisão 7) — a composição fica para trás
    const ajustado = [{ ...config[0], quantidade: 12, entradas_por_micro: 2 }]
    const d = coerenciaComComposicao(ajustado, composicao)
    expect(d).toHaveLength(1)
    expect(d[0]).toMatchObject({ previsto: 6, naTopologia: 12, diferenca: 6 })
  })

  it('27 · capacidade e micros necessários por bloco', () => {
    const b = { quantidade: 6, entradas_por_micro: 4, modulos_por_entrada: 1, modulos: 24 }
    expect(capacidadeDoBloco(b)).toBe(24)
    expect(distribuicaoDoBloco(b)).toEqual([4, 4, 4, 4, 4, 4])
    expect(microsNecessariosNoBloco(b)).toBe(6)
    expect(capacidadeDoBloco({ quantidade: 6 })).toBe(null)
  })
})

// ═══ 6 · A tela (decisões 5, 6) ═════════════════════════════════════════════
describe('FV-DOM-031 · a etapa de topologia bifurca', () => {
  const montar = async () => {
    render(<EtapaMppt />)
    await waitFor(() => expect(screen.queryByText('Carregando…')).toBe(null))
  }

  it('28 · composição de micro abre o editor de ENTRADAS, não o de MPPT', async () => {
    await montar()
    await waitFor(() => expect(screen.getByText(/Topologia — microinversores/)).toBeTruthy())
    expect(screen.queryByText('Topologia MPPT')).toBe(null)
    expect(screen.getByLabelText('Entradas por micro 1')).toBeTruthy()
    expect(screen.getByLabelText('Módulos por entrada 1')).toBeTruthy()
  })

  it('29 · composição de string continua no editor de MPPT', async () => {
    projetoAtual = projetoCom([{ ...invComp(STRING15, 1), tipo: 'string' }])
    projetoAtual.equipamentos.inversor = { ...invComp(STRING15, 1), tipo: 'string' }
    await montar()
    await waitFor(() => expect(screen.getByText('Topologia MPPT')).toBeTruthy())
    expect(screen.queryByText(/Topologia — microinversores/)).toBe(null)
  })

  it('30 · o exemplo do enunciado aparece REPROVADO na tela (decisão 6)', async () => {
    await montar()
    await waitFor(() => expect(screen.getByText(/Topologia — microinversores/)).toBeTruthy())
    const alertas = screen.getAllByRole('alert').map((e) => e.textContent).join(' ')
    expect(alertas).toMatch(/1\.30×/)
    expect(alertas).toMatch(/excede o limite de 1\.25×/)
    expect(alertas).toMatch(/Cabem 3 módulo/)
  })

  it('31 · salvar grava `micros[]` e preserva a composição e a estrutura', async () => {
    await montar()
    await waitFor(() => expect(screen.getByText(/Topologia — microinversores/)).toBeTruthy())
    fireEvent.click(screen.getByText('Salvar topologia'))
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())

    const [etapa, dados] = salvarEtapa.mock.calls[0]
    expect(etapa).toBe('arranjos')
    const arranjo = dados.lista[0]
    expect(arranjo.configuracao_eletrica.micros[0]).toMatchObject({
      modelo: 'HMS-2000-4T', quantidade: 6, entradas_por_micro: 4, modulos_por_entrada: 1,
    })
    expect(arranjo.configuracao_eletrica.micros[0].distribuicao).toEqual([4, 4, 4, 4, 4, 4])
    // decisão 8: a composição não é tocada
    expect(arranjo.paineis[0].quantidade).toBe(24)
    expect(arranjo.inversores[0].quantidade).toBe(6)
    // decisão 9: nenhuma escrita em `equipamentos`, onde vive a estrutura
    expect(salvarEtapa.mock.calls.map(([e]) => e)).toEqual(['arranjos'])
    expect(projetoAtual.equipamentos.estrutura).toEqual({ tipo: 'Fibrocimento', descricao: 'gancho' })
  })

  it('32 · composição mista é DECLARADA, não resolvida sozinha', async () => {
    projetoAtual = projetoCom([invComp(MICRO_A, 4), { ...invComp(STRING15, 1), tipo: 'string' }])
    await montar()
    await waitFor(() => expect(screen.getByText(/mistura microinversores/)).toBeTruthy())
    expect(composicaoMista([invComp(MICRO_A, 4), invComp(STRING15, 1)], CATALOGO)).toBe(true)
    expect(composicaoEhMicro([invComp(MICRO_A, 4)], CATALOGO)).toBe(true)
    expect(composicaoEhMicro([invComp(STRING15, 1)], CATALOGO)).toBe(false)
  })

  it('33 · micro sem envelope: lacuna declarada, nenhum valor assumido', async () => {
    projetoAtual = projetoCom([invComp(MICRO_SEM, 6)])
    await montar()
    await waitFor(() => expect(screen.getByText(/Topologia — microinversores/)).toBeTruthy())
    expect(screen.getByText(/O catálogo não declara/)).toBeTruthy()
    expect(screen.getByText(/sem limite CC\/CA declarado/)).toBeTruthy()
  })

  it('34 · não implementa múltiplas opções (decisão 10)', async () => {
    await montar()
    await waitFor(() => expect(screen.getByText(/Topologia — microinversores/)).toBeTruthy())
    fireEvent.click(screen.getByText('Salvar topologia'))
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    // um arranjo principal, uma opção — nada de `projeto_origem_id` nem lista de opções
    expect(salvarEtapa.mock.calls[0][1].lista).toHaveLength(1)
  })
})
