/**
 * F13 — Identidade do arranjo: única, estável, independente de posição.
 *
 * A F11 encontrou dois arranjos com `id = 'arr_primario'` no mesmo projeto. A
 * causa não foi colisão de gerador: eram QUATRO mecanismos de identidade, e um
 * deles gravava um LITERAL — `E7Equipamentos` emitia sempre `'arr_primario'`
 * para o bloco primário. Bastava um arranjo já persistido com esse id voltar na
 * lista para o documento ficar com dois, e daí em diante
 * `find(tipo === 'principal')` escolhia o primeiro em silêncio — inclusive ao
 * montar o documento de homologação para a distribuidora.
 *
 * Contrato: obrigatório · único DENTRO do projeto · estável entre reloads ·
 * preservado em edição e reordenação · novo quando se cria nova entidade.
 *
 * Índice de array não é identidade: reordenar não pode trocar quem é quem.
 */
import { describe, it, expect } from 'vitest'
import {
  novoIdArranjo, idValido, idsDuplicados, garantirIdentidade, principaisDoProjeto,
} from '@fortesolar/fv-shared/projeto/identidade-arranjo'

const arr = (id, extra = {}) => ({ id, paineis: [], inversores: [], ...extra })

describe('F13 · identidade única e estável', () => {
  it('1 · dois arranjos novos recebem IDs distintos', () => {
    const a = novoIdArranjo()
    const b = novoIdArranjo()
    expect(a).not.toBe(b)
    expect(idValido(a)).toBe(true)
    expect(idValido(b)).toBe(true)
  })

  it('2 · reordenar não altera identidade', () => {
    const A = arr('arr_A', { rotulo: 'A' })
    const B = arr('arr_B', { rotulo: 'B' })
    const original = garantirIdentidade([A, B])
    const invertido = garantirIdentidade([B, A])
    expect(original.map((x) => x.id)).toEqual(['arr_A', 'arr_B'])
    expect(invertido.map((x) => x.id)).toEqual(['arr_B', 'arr_A'])
    // O que importa: cada arranjo mantém SEU id, não o da posição.
    expect(invertido.find((x) => x.rotulo === 'A').id).toBe('arr_A')
  })

  it('3 · reload não altera identidade — a função é idempotente', () => {
    const lista = [arr('arr_A'), arr('arr_B')]
    const salvo = garantirIdentidade(lista)
    const recarregado = garantirIdentidade(JSON.parse(JSON.stringify(salvo)))
    expect(recarregado.map((x) => x.id)).toEqual(['arr_A', 'arr_B'])
  })

  it('4 · duplicar cria identidade NOVA e preserva a original', () => {
    const A = arr('arr_A', { rotulo: 'Arranjo A' })
    const copia = { ...JSON.parse(JSON.stringify(A)), id: novoIdArranjo(), rotulo: 'Arranjo A (cópia)' }
    const lista = garantirIdentidade([A, copia])
    expect(lista[0].id).toBe('arr_A')
    expect(lista[1].id).not.toBe('arr_A')
    expect(idValido(lista[1].id)).toBe(true)
  })

  it('5 · id duplicado é desempatado, mantendo a PRIMEIRA ocorrência', () => {
    // É o caso real de "Sistema FV novo kWp": dois `arr_primario`.
    const lista = garantirIdentidade([
      arr('arr_primario', { rotulo: 'A' }),
      arr('arr_primario', { rotulo: 'A-bis' }),
      arr('arr_B'),
    ])
    expect(lista[0].id).toBe('arr_primario')      // quem já estava correto não muda
    expect(lista[1].id).not.toBe('arr_primario')
    expect(lista[2].id).toBe('arr_B')
    expect(idsDuplicados(lista)).toEqual([])
  })

  it('6 · id ausente ou inválido recebe um novo', () => {
    const lista = garantirIdentidade([arr(null), arr(''), arr('   '), arr(42)])
    expect(lista.every((x) => idValido(x.id))).toBe(true)
    expect(idsDuplicados(lista)).toEqual([])
  })

  it('7 · nenhum campo além do id é tocado', () => {
    const A = arr('arr_primario', {
      rotulo: 'Arranjo A', tipo: 'principal',
      paineis: [{ modelo: 'TSM', quantidade: 211, potencia_w: 445, equipamento_id: 'abc' }],
      inversores: [{ modelo: 'SUN2000', quantidade: 1, potencia_kw: 60 }],
    })
    const B = { ...JSON.parse(JSON.stringify(A)), rotulo: 'Arranjo A-bis' }
    const lista = garantirIdentidade([A, B])
    // B mudou de id; tudo o mais é byte a byte o que era.
    const semId = (x) => { const { id, ...resto } = x; return resto }
    expect(semId(lista[1])).toEqual(semId(B))
    expect(lista[1].paineis[0].quantidade).toBe(211)
    expect(lista[1].paineis[0].equipamento_id).toBe('abc')
  })

  it('8 · arranjo incompleto tem identidade — completude é outra coisa', () => {
    // Rascunho com arranjo sem inversor e sem módulo continua válido.
    const lista = garantirIdentidade([{ id: null, tipo: 'ampliacao', paineis: [], inversores: [] }])
    expect(idValido(lista[0].id)).toBe(true)
    expect(lista[0].paineis).toEqual([])
    expect(lista[0].inversores).toEqual([])
  })

  it('9 · `idsDuplicados` detecta sem corrigir — leitura não reescreve identidade', () => {
    const lista = [arr('x'), arr('x'), arr('y')]
    expect(idsDuplicados(lista)).toEqual(['x'])
    expect(lista.map((a) => a.id)).toEqual(['x', 'x', 'y'])   // intacta
  })

  it('10 · a identidade não deriva do índice', () => {
    // Se derivasse, duas listas de mesmo tamanho teriam os mesmos ids.
    const um = garantirIdentidade([arr(null), arr(null)])
    const dois = garantirIdentidade([arr(null), arr(null)])
    expect(um[0].id).not.toBe(dois[0].id)
    expect(um.map((x) => x.id)).not.toEqual(['0', '1'])
  })
})

describe('F13 · no máximo um principal', () => {
  it('11 · `principaisDoProjeto` distingue um de vários', () => {
    // `find()` devolve o primeiro e não sabe dizer que havia dois — era isso
    // que deixava `homologacaoController` escolher em silêncio.
    const dois = [arr('a', { tipo: 'principal' }), arr('b', { tipo: 'principal' }), arr('c', { tipo: 'secundario' })]
    expect(principaisDoProjeto(dois)).toHaveLength(2)
    const um = [arr('a', { tipo: 'principal' }), arr('b', { tipo: 'secundario' })]
    expect(principaisDoProjeto(um)).toHaveLength(1)
    expect(principaisDoProjeto([arr('a', { tipo: 'secundario' })])).toHaveLength(0)
  })
})
