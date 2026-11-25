import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import {
  opcoesDeArranjo, planejarComposicaoMicro, planejarMicros, planoObsoleto, repartirMicrosPorFase,
} from '@fortesolar/fv-shared/engenharia/arranjos-micro'
import { caboDoRamal } from '@fortesolar/fv-shared/engenharia/corrente-micro'
import { paraConfigPersistida, politicaDaConfig, sugestoesDeArranjo } from '../microinversores'

/** Pedido de 2026-11-25: o quadro Fases sugere arranjos válidos, equilibrado primeiro. */
const salvarEtapa = vi.fn().mockResolvedValue({})
let projeto
vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({ projetoId: 'p1', projeto, carregando: false, erro: null, recarregar: vi.fn(), acoes: { salvarEtapa } }),
}))
const { default: EtapaMicroinversores } = await import('../paginas/etapas/EtapaMicroinversores')

const MICRO = { entradas: 4, modulos_por_entrada: 1, fabricante: 'Hoymiles', max_por_cabo_tronco: 3 }
const SEM = { ...MICRO, max_por_cabo_tronco: null }
const modelo = (quantidade, micro = MICRO) => ({ modulos: quantidade * 4, quantidade, micro })
const ramais = (o) => o.ramais.map((r) => `${r.fase}:${r.micros}`)
const op = (q, fases = 'Trifásico 380V', micro = MICRO) => opcoesDeArranjo({ modelos: [modelo(q, micro)], fases })

const eq = (extra = {}) => ({
  _id: 'mi', tipo: 'inversor', fabricante: 'Hoymiles', modelo: 'HMS-2250DW-4T',
  especificacoes: { subtipo: 'microinversor', potencia_kw: 2.25, fases: 1, entradas: 4,
    modulos_por_entrada: 1, corrente_ac_saida: 10.23, max_por_cabo_tronco: 3, ...extra },
})
const bloco = (extra = {}) => ({ equipamento_id: 'mi', marca: 'Hoymiles', modelo: 'HMS-2250DW-4T', quantidade: 6,
  entradas_por_micro: 4, modulos_por_entrada: 1, modulos: 24, _max_por_cabo_tronco: 3, _corrente_ac_saida: 10.23, ...extra })

describe('sugestão de arranjos por fase', () => {
  it('6 micros, limite 3: 2+2+2 recomendada e 3+3 como alternativa', () => {
    const [a, b, ...resto] = op(6)
    expect(resto).toEqual([])
    expect(ramais(a)).toEqual(['L1:2', 'L2:2', 'L3:2'])
    expect(a.fases.equilibrado).toBe(true)
    expect(ramais(b)).toEqual(['L1:3', 'L2:3'])
    expect(b.fases.fases_sem_arranjo).toEqual(['L3'])
  })
  it('7 micros: 3/2/2 contra 3/3/1', () => {
    expect(op(7).map(ramais)).toEqual([['L1:3', 'L2:2', 'L3:2'], ['L1:3', 'L2:3', 'L3:1']])
  })
  it('fase com mais micros que o limite forma mais de um ramal, nunca acima dele', () => {
    const [a] = op(12)
    expect(ramais(a)).toEqual(['L1:3', 'L1:1', 'L2:3', 'L2:1', 'L3:3', 'L3:1'])
    for (let q = 1; q <= 40; q += 1) {
      for (const o of op(q)) {
        expect(o.ramais.reduce((s, r) => s + r.micros, 0)).toBe(q)
        expect(Math.max(...o.ramais.map((r) => r.micros))).toBeLessThanOrEqual(3)
      }
      expect(op(q)[0].fases.desequilibrio).toBeLessThanOrEqual(1)
    }
  })
  it('políticas com o mesmo resultado viram uma opção; bifásico usa duas fases', () => {
    expect(op(9)).toHaveLength(1)
    expect(ramais(op(6, 'Bifásico')[0])).toEqual(['L1:3', 'L2:3'])
  })
  it('monofásico, fase ausente e quantidade inválida não geram sugestão', () => {
    expect(op(6, 'Monofásico')).toEqual([])
    expect(op(6, null)).toEqual([])
    for (const q of [null, 0, -1, 'x']) expect(op(q)).toEqual([])
    expect(opcoesDeArranjo()).toEqual([])
    expect(repartirMicrosPorFase([6], 1)).toBeNull()
    expect(repartirMicrosPorFase([6], 4)).toBeNull()
  })
  it('sem limite declarado é só referência equilibrada', () => {
    const r = op(6, 'Trifásico', SEM)
    expect(r).toHaveLength(1)
    expect(r[0].limite_declarado).toBe(false)
    expect(ramais(r[0])).toEqual(['L1:2', 'L2:2', 'L3:2'])
    // O PLANO continua sem arranjo: a sugestão não vira regra.
    expect(planejarMicros({ ...modelo(6, SEM), fases: 'Trifásico', politica: 'equilibrar_fases' }).arranjos).toBeNull()
  })
  it('dois modelos dividem a mesma carga: o segundo continua de onde o primeiro parou', () => {
    const c = planejarComposicaoMicro({ modelos: [modelo(2), modelo(4)], fases: 'Trifásico', politica: 'equilibrar_fases' })
    expect(c.fases.por_fase).toEqual({ L1: 2, L2: 2, L3: 2 })
    expect(c.por_modelo[0].arranjos.map((a) => a.fase)).toEqual(['L1', 'L2'])
    expect(c.por_modelo[1].arranjos.flatMap((a) => a.micros)).toEqual([1, 2, 3, 4])
  })
  it('modelo sem regra não ocupa fase no plano', () => {
    const c = planejarComposicaoMicro({ modelos: [modelo(3, SEM), modelo(3)], fases: 'Trifásico', politica: 'equilibrar_fases' })
    expect(c.por_modelo[0].arranjos).toBeNull()
    expect(c.fases.por_fase).toEqual({ L1: 1, L2: 1, L3: 1 })
  })
  it('mesma quantidade de ramais com divisão diferente é obsolescência', () => {
    const a = planejarMicros({ ...modelo(7), fases: 'Trifásico', politica: 'equilibrar_fases' })
    const b = planejarMicros({ ...modelo(7), fases: 'Trifásico' })
    expect(planoObsoleto(a.arranjos, a).obsoleto).toBe(false)
    expect(planoObsoleto(b.arranjos, a).motivos.join()).toMatch(/divisão dos microinversores/)
  })
})

describe('corrente e cabo do ramal', () => {
  it('2 micros → 20,46 A · 4 mm²; 3 micros → 30,69 A · 6 mm²', () => {
    const [a, b] = sugestoesDeArranjo([bloco()], 'Trifásico')
    expect(a.ramais.map((r) => [r.corrente_a, r.cabo_mm2])).toEqual([[20.46, 4], [20.46, 4], [20.46, 4]])
    expect(b.ramais.map((r) => [r.corrente_a, r.cabo_mm2])).toEqual([[30.69, 6], [30.69, 6]])
  })
  it('sem corrente cadastrada não há cabo; acima da tabela também não', () => {
    expect(sugestoesDeArranjo([bloco({ _corrente_ac_saida: null })], 'Trifásico')[0].ramais[0])
      .toMatchObject({ corrente_a: null, cabo_mm2: null })
    expect([null, '', 0, -5, 'x', NaN, 211].map(caboDoRamal)).toEqual(Array(7).fill(null))
    expect([26, 26.01, 210].map(caboDoRamal)).toEqual([4, 6, 120])
  })
})

describe('política salva', () => {
  it('sem arranjos salvos vale a recomendada; salvos, a que os reproduz', () => {
    expect(politicaDaConfig([bloco()], 'Trifásico')).toBe('equilibrar_fases')
    expect(politicaDaConfig(null, 'Trifásico')).toBe('equilibrar_fases')
    for (const p of ['minimo_de_ramais', 'equilibrar_fases']) {
      const { arranjos } = paraConfigPersistida([bloco()], 'Trifásico', p)[0]
      expect(politicaDaConfig([bloco({ arranjos })], 'Trifásico')).toBe(p)
    }
  })
})

describe('quadro Fases', () => {
  const montar = (equipamento = eq()) => render(<EtapaMicroinversores
    catalogoInversores={[equipamento]} totalModulos={24} potenciaModuloW={620} fases="Trifásico 380V"
    arranjoPrincipal={projeto.arranjos[0]} aoAtualizarCatalogo={vi.fn()} />)
  beforeEach(() => {
    salvarEtapa.mockClear()
    projeto = { _id: 'p1', fatura_extracao: { tipo_ligacao: 'Trifásico 380V' },
      arranjos: [{ id: 'principal', tipo: 'principal', inversores: [{ equipamento_id: 'mi', quantidade: 6, tipo: 'micro' }] }] }
  })

  it('traz o aviso de fase e as duas opções, com a recomendada marcada', () => {
    montar()
    const quadro = screen.getByLabelText('Fases da composição')
    expect(quadro.textContent).toContain('pode exigir adequação da entrada elétrica')
    expect(quadro.textContent).toContain('L1: 2 micros · 20.46 A · cabo 4 mm²')
    expect(quadro.textContent).toContain('L1: 3 micros · 30.69 A · cabo 6 mm²')
    expect(screen.getByLabelText('Opção 1: Fases equilibradas').checked).toBe(true)
    expect(screen.getByLabelText('Fase L3').textContent).toContain('2 micro(s)')
  })
  it('escolher a opção 2 refaz os arranjos e grava os dela', async () => {
    montar()
    fireEvent.click(screen.getByLabelText('Opção 2: Mínimo de ramais'))
    expect(screen.getByLabelText('Fase L3').textContent).toContain('0 micro(s)')
    expect(salvarEtapa).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Salvar topologia'))
    await waitFor(() => expect(salvarEtapa).toHaveBeenCalled())
    expect(salvarEtapa.mock.calls[0][1].lista[0].configuracao_eletrica.micros[0].arranjos)
      .toEqual([{ micros: [1, 2, 3], fase: 'L1' }, { micros: [4, 5, 6], fase: 'L2' }])
  })
  it('sem limite no cadastro: mostra a referência, sem permitir aplicar', () => {
    montar(eq({ max_por_cabo_tronco: null }))
    const quadro = screen.getByLabelText('Fases da composição')
    expect(quadro.textContent).toContain('L3: 2 micros')
    expect(quadro.textContent).toContain('falta o máximo de micros por arranjo')
    expect(quadro.textContent).not.toContain('recomendada')
    expect(quadro.querySelectorAll('input[type=radio]')).toHaveLength(0)
  })
})
