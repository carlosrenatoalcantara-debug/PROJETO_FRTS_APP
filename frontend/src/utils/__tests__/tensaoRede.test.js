import { describe, it, expect } from 'vitest'
import { resolverTensaoRede, tensaoDoTexto, ehTrifasico } from '../tensaoRede'

describe('tensaoRede — trifásico na COSERN/RN é 380 V', () => {
  it('trifásico + COSERN → 380 (caso do vídeo: aparecia 220)', () => {
    expect(resolverTensaoRede({ tipoLigacao: 'Trifásico', concessionaria: 'COSERN' }))
      .toEqual({ valor: '380', origem: 'regra_rn' })
  })
  it('"Neoenergia Cosern" e UF RN também casam', () => {
    expect(resolverTensaoRede({ tipoLigacao: 'trifasico', concessionaria: 'Neoenergia Cosern' }).valor).toBe('380')
    expect(resolverTensaoRede({ tipoLigacao: 'Trifásico', uf: 'rn' }).valor).toBe('380')
  })
  it('fatura "Conv. Monômia - Trifásico" é trifásico', () => {
    expect(ehTrifasico('Conv. Monômia - Trifásico')).toBe(true)
    expect(resolverTensaoRede({ tipoLigacao: 'Conv. Monômia - Trifásico', concessionaria: 'COSERN' }).valor).toBe('380')
  })
  it('número no texto da ligação vence a regra', () => {
    expect(resolverTensaoRede({ tipoLigacao: 'Trifásico 220V', concessionaria: 'COSERN' }))
      .toEqual({ valor: '220', origem: 'texto_ligacao' })
    expect(tensaoDoTexto('Trifásico 380V')).toBe('380')
  })
  it('tensão informada vence tudo', () => {
    expect(resolverTensaoRede({ tensao: '220', tipoLigacao: 'Trifásico', concessionaria: 'COSERN' }))
      .toEqual({ valor: '220', origem: 'informada' })
  })
  it('sem regra aplicável NÃO há default: null', () => {
    expect(resolverTensaoRede({ tipoLigacao: 'Monofásico', concessionaria: 'COSERN' }).valor).toBeNull()
    expect(resolverTensaoRede({ tipoLigacao: 'Trifásico', concessionaria: 'Enel', uf: 'SP' }).valor).toBeNull()
    expect(resolverTensaoRede({}).valor).toBeNull()
    expect(resolverTensaoRede().valor).toBeNull()
  })
  it('valor fora do conjunto conhecido é ignorado', () => {
    expect(resolverTensaoRede({ tensao: '999' }).valor).toBeNull()
  })
})
