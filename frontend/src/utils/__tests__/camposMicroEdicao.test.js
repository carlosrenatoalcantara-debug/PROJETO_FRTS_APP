import { describe, it, expect } from 'vitest'
import { classificarCampos } from '@fortesolar/fv-shared/ai/campos-equipamento'

const chaves = (c) => c.map((x) => x.key)

describe('edição do inversor — campos do micro', () => {
  it('inversor string não mostra entradas/módulos por entrada', () => {
    const c = chaves(classificarCampos('inversor', { potencia_kw: 10 }))
    expect(c).not.toContain('entradas')
    expect(c).not.toContain('modulos_por_entrada')
  })

  it('micro (pelo contexto ou pela topologia) mostra os dois campos', () => {
    expect(chaves(classificarCampos('inversor', {}, {}, { micro: true }))).toEqual(expect.arrayContaining(['entradas', 'modulos_por_entrada']))
    expect(chaves(classificarCampos('inversor', { tipo_topologia: 'MICRO' }))).toContain('entradas')
  })

  it('ausente aparece como ausente; gravado com outro nome é reconhecido', () => {
    const vazio = classificarCampos('inversor', {}, {}, { micro: true }).find((x) => x.key === 'entradas')
    expect(vazio.status).not.toBe('ok')
    expect(vazio.valor).toBeNull()
    const alias = classificarCampos('inversor', { total_entradas_cc: 4 }, {}, { micro: true }).find((x) => x.key === 'entradas')
    expect(alias.valor).toBe(4)
  })
})
