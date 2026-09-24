/**
 * F10 — Fontes derivadas, elegibilidade e topologia por arranjo.
 *
 * Três dívidas residuais fechadas com evidência medida no acervo real:
 *
 *   `specs_canonicas` .... 106/106 presentes, NÃO órfã — tem um consumidor
 *                          legítimo (`detectarConflitos` → UI) e nenhum leitor
 *                          de engenharia. Mantida como projeção sem autoridade.
 *   elegibilidade ........ 6 documentos com `utilizavel_em_projeto = true`
 *                          gravado divergindo da regra F-06. Reprocessados pela
 *                          rotina oficial (hook `pre('save')`).
 *   topologia LEGACY ..... `arranjos[].configuracao_eletrica.mppts` em 0/589.
 *                          Mantida isolada; a evidência de requisito
 *                          multiarranjo (5 projetos reais) ficou registrada.
 */
import { describe, it, expect } from 'vitest'
import { processarEquipamento } from '../../../../backend/src/services/catalogoQualidade.js'
import { avaliarUtilizavel } from '@fortesolar/fv-shared/utilizavel-projeto'
import { paraDimensionamento } from '@fortesolar/fv-shared/inversores'

// Os 3 Growatt MID e os 3 Kehua SP*-B2 do catálogo real: declaram potência,
// MPPTs e corrente de trabalho, mas NENHUM campo do envelope de tensão.
const SEM_ENVELOPE = {
  tipo: 'inversor', fabricante: 'Growatt', modelo: 'MID15KTL3-X',
  especificacoes: { potencia_kw: 15, n_mppts: 2, strings_por_mppt: 2,
    corrente_max_por_mppt: 32, entradas_por_mppt: [2, 2], tipo_topologia: 'STRING' },
}
const COMPLETO = {
  tipo: 'inversor', fabricante: 'Kehua', modelo: 'SPI15K-B',
  especificacoes: { potencia_kw: 15, n_mppts: 2, tensao_max_entrada: 1100,
    tensao_mppt_min: 200, tensao_mppt_max: 1000, corrente_max_por_mppt: 30 },
}

describe('F10 · elegibilidade persistida é recalculada, não herdada', () => {
  it('1 · flag `true` gravado não sobrevive à regra F-06', () => {
    // Era exatamente o estado dos 6: documento afirmando ser utilizável sem ter
    // envelope de tensão. O gate não pode consultar o próprio flag.
    const r = processarEquipamento({ ...SEM_ENVELOPE, utilizavel_em_projeto: true }, { tipoEvento: 't' })
    expect(r.utilizavel_em_projeto).toBe(false)
    expect(r.bloqueio_engenharia).toContain('tensao_max_entrada')
    expect(r.bloqueio_engenharia).toContain('tensao_mppt_min')
    expect(r.bloqueio_engenharia).toContain('tensao_mppt_max')
  })

  it('2 · e o veredito independe do valor de partida — é idempotente', () => {
    const a = processarEquipamento({ ...SEM_ENVELOPE, utilizavel_em_projeto: true }, { tipoEvento: 't' })
    const b = processarEquipamento({ ...SEM_ENVELOPE, utilizavel_em_projeto: false }, { tipoEvento: 't' })
    expect(a.utilizavel_em_projeto).toBe(b.utilizavel_em_projeto)
    expect(a.bloqueio_engenharia).toEqual(b.bloqueio_engenharia)
  })

  it('3 · lacuna é lacuna, não incompatibilidade (F-06)', () => {
    // A distinção que a F-06 estabeleceu: falta de dado nunca vira veredito
    // técnico negativo. O motivo nomeia o campo ausente.
    const r = processarEquipamento(SEM_ENVELOPE, { tipoEvento: 't' })
    expect(JSON.stringify(r.bloqueio_engenharia)).not.toMatch(/incompativel/i)
    expect(r.bloqueio_engenharia.every((m) => typeof m === 'string' && m.length > 0)).toBe(true)
  })

  it('4 · equipamento completo permanece liberado — o gate não bloqueia por atacado', () => {
    const r = processarEquipamento(COMPLETO, { tipoEvento: 't' })
    expect(r.utilizavel_em_projeto).toBe(true)
    expect(r.bloqueio_engenharia).toHaveLength(0)
  })

  it('5 · falta do limite de curto não entra no gate de elegibilidade', () => {
    // F8 × F-06 são portões DIFERENTES. `corrente_isc_max` ausente impede
    // dimensionar string, mas não torna o inversor inelegível para catálogo.
    expect(COMPLETO.especificacoes.corrente_isc_max).toBeUndefined()
    const r = processarEquipamento(COMPLETO, { tipoEvento: 't' })
    expect(r.utilizavel_em_projeto).toBe(true)
    // ...e continua ausente no dimensionamento, declarada como lacuna.
    const d = paraDimensionamento(COMPLETO.especificacoes)
    expect(d.isc_max_mppt).toBeNull()
    expect(d.lacunas).toContain('corrente_isc_max')
  })
})

describe('F10 · `specs_canonicas` é projeção, não fonte', () => {
  it('6 · a projeção não supre campo ausente com o vizinho', () => {
    // O que a F8 removeu não pode voltar pela porta da projeção.
    const r = processarEquipamento(COMPLETO, { tipoEvento: 't' })
    expect(r.specs_canonicas.isc_max_por_mppt_a).toBeNull()
    expect(r.specs_canonicas.isc_max_por_mppt_a).not.toBe(30)  // a corrente de trabalho
  })

  it('7 · e reflete o SSOT quando o dado existe', () => {
    const comIsc = { ...COMPLETO,
      especificacoes: { ...COMPLETO.especificacoes, corrente_isc_max: 40 } }
    const r = processarEquipamento(comIsc, { tipoEvento: 't' })
    expect(r.specs_canonicas.isc_max_por_mppt_a).toBe(40)
  })

  it('8 · o gate de elegibilidade não consulta a projeção', () => {
    // `avaliarUtilizavel` recebe `especificacoes` — nunca `specs_canonicas`.
    // Uma projeção generosa não pode liberar equipamento sem dado real.
    const av = avaliarUtilizavel('inversor', SEM_ENVELOPE.especificacoes, {
      ...SEM_ENVELOPE,
      specs_canonicas: { voc_max_dc_v: 1000, mppt_min_v: 200, mppt_max_v: 850 },
    })
    expect(av.utilizavel).toBe(false)
    expect(av.faltando).toContain('tensao_max_entrada')
  })
})
