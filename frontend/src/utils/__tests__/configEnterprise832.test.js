import { describe, it, expect } from 'vitest'
import { mesclarMatriz, pode, MATRIZ_RBAC } from '../rbac'
import { apenasAtivos, mascararConta, mascararDadosBancarios, podeVerBancoCompleto } from '../gestaoUtils'
import { montarSnapshotRT } from '../../../../backend/src/utils/snapshotRT.js'

/**
 * Sprint 8.3.2 — Configurações Enterprise Final.
 */
describe('S8.3.2 — RBAC flexível', () => {
  // 1) Técnico: catálogo visualizar → editar concede acesso de edição.
  it('matriz customizada eleva técnico de catálogo visualizar→editar', () => {
    expect(pode('tecnico', 'catalogo', 'editar')).toBe(false) // padrão
    const custom = { tecnico: { catalogo: 'editar' } }
    const matriz = mesclarMatriz(custom)
    expect(pode('tecnico', 'catalogo', 'editar', matriz)).toBe(true)
    expect(pode('tecnico', 'catalogo', 'visualizar', matriz)).toBe(true) // inclui inferiores
    expect(pode('tecnico', 'catalogo', 'aprovar', matriz)).toBe(false)   // não eleva além
  })

  // 2) Fallback: custom vazio → matriz padrão intacta (não quebra usuários existentes).
  it('mesclarMatriz(null) devolve a matriz padrão', () => {
    expect(mesclarMatriz(null)).toEqual(MATRIZ_RBAC)
    expect(mesclarMatriz({})).toEqual(MATRIZ_RBAC)
  })

  // 3) Custom não contamina outros perfis/módulos.
  it('customização isolada não afeta outros perfis', () => {
    const matriz = mesclarMatriz({ tecnico: { catalogo: 'administrar' } })
    expect(matriz.comercial.catalogo).toBe(MATRIZ_RBAC.comercial.catalogo)
    expect(matriz.tecnico.fv).toBe(MATRIZ_RBAC.tecnico.fv)
  })
})

describe('S8.3.2 — dados bancários (máscara por perfil)', () => {
  const conta = { banco: 'Banco X', agencia: '0001', conta: '987654', pix: 'a@b.com', titular: 'Empresa', documento: '12345678900' }

  // 4) Perfis privilegiados veem completo; demais veem mascarado.
  it('mascara conta/pix/documento para perfis sem permissão', () => {
    expect(podeVerBancoCompleto('financeiro')).toBe(true)
    expect(podeVerBancoCompleto('comercial')).toBe(false)

    const completo = mascararDadosBancarios(conta, 'diretor')
    expect(completo.conta).toBe('987654')

    const mascarado = mascararDadosBancarios(conta, 'comercial')
    expect(mascarado.conta).toBe('****7654')
    expect(mascarado.pix).toBe('••••••')
    expect(mascarado.banco).toBe('Banco X') // banco não é sigiloso
  })

  it('mascararConta deixa só os últimos 4 dígitos', () => {
    expect(mascararConta('123456')).toBe('****3456')
    expect(mascararConta('')).toBe('')
  })
})

describe('S8.3.2 — snapshot RT + filtro ativo', () => {
  // 5) Snapshot do RT congela os campos do técnico no momento do freeze.
  it('montarSnapshotRT congela campos do técnico', () => {
    const tec = { nome: 'Eng. Ana', tipo_registro: 'CREA', registro: '123', uf: 'SP', formacao: 'Eng. Elétrica', modalidade: 'Eletrotécnica', numero_art_padrao: 'ART-9' }
    const snap = montarSnapshotRT(tec, new Date('2026-05-29T00:00:00Z'))
    expect(snap).toMatchObject({ nome: 'Eng. Ana', tipo_registro: 'CREA', numero_registro: '123', uf: 'SP', art_trt: 'ART-9' })
    expect(snap.data_snapshot).toBe('2026-05-29T00:00:00.000Z')
    expect(montarSnapshotRT(null)).toBeNull()
  })

  it('apenasAtivos remove inativos nos seletores de novo projeto', () => {
    const tecnicos = [{ _id: 't1', ativo: true }, { _id: 't2', ativo: false }, { _id: 't3' }]
    expect(apenasAtivos(tecnicos).map((t) => t._id)).toEqual(['t1', 't3'])
  })
})
