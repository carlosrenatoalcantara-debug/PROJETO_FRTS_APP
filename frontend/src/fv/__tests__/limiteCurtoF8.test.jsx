/**
 * F8 — Eliminar a fabricação do limite de curto (Isc).
 *
 * O defeito: `paraDimensionamento` fazia
 *
 *     isc_max_mppt = corrente_isc_max ?? corrente_max_por_mppt
 *
 * e `catalogoQualidade.normalizarSpecsInversor` fazia o mesmo ao gravar
 * `specs_canonicas.isc_max_por_mppt_a`. Os dois campos são REAIS, mas são
 * grandezas diferentes: `corrente_isc_max` é o limite de CURTO-CIRCUITO da
 * entrada (IEC 62109-1) e `corrente_max_por_mppt` é o limite de corrente de
 * TRABALHO. O curto é sempre o maior dos dois — usar o de trabalho no lugar
 * dele produzia uma verificação sistematicamente MAIS PERMISSIVA do que o
 * fabricante declarou, exatamente onde `montarStrings` decide se a string cabe.
 *
 * No banco real o efeito era material: 24 dos 52 inversores tinham
 * `isc_max_por_mppt_a` idêntico à corrente de trabalho, sem nenhum
 * `corrente_isc_max` de origem. O valor falso era indistinguível de um dado
 * declarado.
 */
import { describe, it, expect } from 'vitest'
import { paraDimensionamento } from '@fortesolar/fv-shared/inversores'

// Envelope de tensão COMPLETO em todos os casos: isola a variável sob teste.
// Sem isso, uma lacuna de tensão mascararia o veredito sobre a corrente.
const TENSAO = { tensao_max_entrada: 1000, tensao_mppt_min: 200, tensao_mppt_max: 850, n_mppts: 2 }

describe('F8 · o limite de curto não é fabricado a partir do de trabalho', () => {
  it('1 · com `corrente_isc_max` declarado, usa o valor declarado', () => {
    const d = paraDimensionamento({ ...TENSAO, corrente_isc_max: 45, corrente_max_por_mppt: 36 })
    expect(d.isc_max_mppt).toBe(45)
    expect(d.lacunas).not.toContain('corrente_isc_max')
  })

  it('2 · SEM `corrente_isc_max`, não herda a corrente de trabalho', () => {
    // Este é o caso dos 14 Kehua do catálogo real: trabalho declarado, curto não.
    const d = paraDimensionamento({ ...TENSAO, corrente_max_por_mppt: 30 })
    expect(d.isc_max_mppt).toBeNull()
    expect(d.isc_max_mppt).not.toBe(30)
  })

  it('3 · a ausência viaja declarada em `lacunas`', () => {
    const d = paraDimensionamento({ ...TENSAO, corrente_max_por_mppt: 30 })
    expect(d.lacunas).toContain('corrente_isc_max')
  })

  it('4 · sem NENHUM dos dois campos, continua null — não há outro fallback', () => {
    const d = paraDimensionamento({ ...TENSAO })
    expect(d.isc_max_mppt).toBeNull()
    expect(d.lacunas).toContain('corrente_isc_max')
  })

  it('5 · o limite de TRABALHO continua disponível, com o próprio nome', () => {
    // A correção não é apagar o dado de trabalho: é parar de chamá-lo de curto.
    const d = paraDimensionamento({ ...TENSAO, corrente_max_por_mppt: 30 })
    expect(d.corrente_max_por_mppt).toBe(30)
    expect(d.isc_max_mppt).toBeNull()
  })

  it('6 · os dois convivem sem se confundir quando ambos existem', () => {
    const d = paraDimensionamento({ ...TENSAO, corrente_isc_max: 45, corrente_max_por_mppt: 36 })
    expect(d.isc_max_mppt).toBe(45)
    expect(d.corrente_max_por_mppt).toBe(36)
  })

  it('7 · valor inválido não é "corrigido" pelo campo vizinho', () => {
    // Antes, um `corrente_isc_max` não-numérico caía no `??` e virava 36.
    // Lixo tem de virar ausência, não virar o outro dado.
    for (const ruim of ['', null, undefined, 'n/d', NaN]) {
      const d = paraDimensionamento({ ...TENSAO, corrente_isc_max: ruim, corrente_max_por_mppt: 36 })
      expect(d.isc_max_mppt).toBeNull()
    }
  })

  it('8 · o alias `isc_max_por_mppt_a` continua sendo lido como limite de curto', () => {
    // `isc_max_por_mppt_a` é alias de `corrente_isc_max` no dicionário. Removida
    // a fabricação, ele volta a significar só o que o nome diz. Se um catálogo
    // declarar o campo por esse nome, é um Isc REAL — e deve ser aceito.
    const d = paraDimensionamento({ ...TENSAO, isc_max_por_mppt_a: 45 })
    expect(d.isc_max_mppt).toBe(45)
    expect(d.lacunas).not.toContain('corrente_isc_max')
  })
})
