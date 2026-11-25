import { describe, it, expect } from 'vitest'
import {
  STATUS_SUGESTAO, climaDoProjeto, dividirModulos, sugestaoParaInversor,
  agrupamentoUniforme, topologiaDaSugestao, rotuloDistribuicao, semRessalvas,
} from '../sugestaoStrings'

/** Ponte catálogo → motor de distribuição (2026-11-25). */
const MOD = {
  _id: 'm', tipo: 'modulo', fabricante: 'Z', modelo: 'M',
  especificacoes: { potencia_w: 650, voc_v: 45.5, isc_a: 18.35, vmpp_v: 38.1, impp_a: 17.06,
    coef_temp_voc_pct_c: -0.25, noct_c: 44 },
}
const inv = (entradas, n, extra = {}) => ({
  _id: 'i', tipo: 'inversor', fabricante: 'S', modelo: 'X',
  especificacoes: { potencia: 15, fases: 3, tensao_max_entrada: 1000, tensao_mppt_min: 200,
    tensao_mppt_max: 850, corrente_max_por_mppt: 40, corrente_isc_max: 50, n_mppts: n,
    entradas_por_mppt: entradas, ...extra },
})
const CLIMA = { temperatura_min_historica_c: 18, temperatura_max_historica_c: 38 }
const sugerir = (inversorCat, totalModulos, quantidade = 1) =>
  sugestaoParaInversor({ inversorCat, moduloCat: MOD, totalModulos, quantidade, clima: CLIMA })

describe('sugestaoStrings', () => {
  it('1 · entradas iguais: distribui tudo e monta a topologia editável', () => {
    const s = sugerir(inv([2, 2], 2), 60)
    expect(s.status).toBe(STATUS_SUGESTAO.PRELIMINAR)
    const r = s.porUnidade[0].resultado
    expect(r.resumo.total_modulos).toBe(60)
    expect(rotuloDistribuicao(r)).toContain('MPPT')
    const t = topologiaDaSugestao(r, 2)
    const total = t.flatMap((m) => m.entradas.flatMap((e) => e.strings.map((x) => Number(x.modulos))))
      .reduce((a, b) => a + b, 0)
    expect(total).toBe(60)
  })

  // MPPTs com número de entradas diferente: o motor assume MPPTs iguais, então
  // "sem solução" com o MENOR não prova incompatibilidade — não pode bloquear.
  it('2 · entradas desiguais nunca viram incompatibilidade', () => {
    for (const e of [[2, 1], [1, 2]]) {
      const s = sugerir(inv(e, 2), 54)
      expect(s.status).not.toBe(STATUS_SUGESTAO.SEM_SOLUCAO)
    }
  })

  it('3 · entradas iguais e módulos demais: incompatível de verdade', () => {
    expect(sugerir(inv([1], 1), 60).status).toBe(STATUS_SUGESTAO.SEM_SOLUCAO)
  })

  it('4 · quantidade 2 divide os módulos; resto vai para uma unidade', () => {
    expect(dividirModulos(25, 2)).toEqual([13, 12])
    const s = sugerir(inv([2, 2], 2), 60, 2)
    expect(s.porUnidade.map((u) => u.modulos)).toEqual([30, 30])
  })

  it('5 · dado ausente é sem_dados, nunca aprovação nem bloqueio', () => {
    expect(sugerir(inv(undefined, 2), 24).status).toBe(STATUS_SUGESTAO.SEM_DADOS)
    expect(sugerir(inv([2, 2], 2), 0).status).toBe(STATUS_SUGESTAO.SEM_DADOS)
    expect(sugerir(null, 24).status).toBe(STATUS_SUGESTAO.SEM_DADOS)
    expect(agrupamentoUniforme(sugerir(null, 24))).toBe(null)
  })

  it('5b · entradas implausíveis no catálogo (2132) são dado ausente', () => {
    expect(sugerir(inv([2132, 2132], 2), 24).status).toBe(STATUS_SUGESTAO.SEM_DADOS)
  })

  it('5c · ✓ só com tensão E corrente avaliadas e compatíveis', () => {
    expect(semRessalvas(sugerir(inv([2, 2], 2, { corrente_max_por_mppt: 60, corrente_isc_max: 80 }), 60))).toBe(true)
    // Corrente em atenção não é ✓.
    expect(semRessalvas(sugerir(inv([2, 2], 2), 60))).toBe(false)
    // Sem limite de curto no catálogo: há sugestão, mas com ressalva.
    const semIsc = sugerir(inv([2, 2], 2, { corrente_isc_max: undefined, corrente_max_por_mppt: undefined }), 60)
    expect(semIsc.status).toBe(STATUS_SUGESTAO.PRELIMINAR)
    expect(semRessalvas(semIsc)).toBe(false)
    expect(semRessalvas(sugerir(null, 24))).toBe(false)
  })

  it('6 · clima: medido → tabela da UF → nada', () => {
    expect(climaDoProjeto({ localizacao: { temperatura_min_historica_c: 10, temperatura_max_historica_c: 35 } }).fonte).toBe('localizacao')
    expect(climaDoProjeto({ localizacao: { estado: 'RN' } }).fonte).toBe('uf')
    expect(climaDoProjeto({}).fonte).toBe(null)
  })
})
