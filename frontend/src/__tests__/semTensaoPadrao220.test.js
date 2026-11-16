import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** O '220' de reserva foi o defeito (trifásico exibido como 220 V). Não pode voltar. */
const fonte = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

describe('nenhum "|| \'220\'" de reserva nas telas de FV', () => {
  it.each([
    '../components/fv/etapas/E1Upload.jsx',
    '../components/fv/etapas/E8Orcamento.jsx',
    '../pages/ProjetosFVNovo.jsx',
  ])('%s', (arq) => {
    const s = fonte(arq)
    expect(s).not.toMatch(/\|\|\s*'220'/)
    expect(s).toMatch(/resolverTensaoRede/)
  })
})
