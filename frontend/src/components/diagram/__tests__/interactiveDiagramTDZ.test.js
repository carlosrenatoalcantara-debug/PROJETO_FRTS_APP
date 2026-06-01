import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

/**
 * P0-EV-01 — Regressão TDZ no InteractiveDiagram.
 *
 * Bug (provado via sourcemap em index-B13Mq-Kk.js:1191:1399):
 *   handleSalvarCustomizado.useCallback listava `handleAdicionarNode` no array de
 *   dependências, avaliado durante o render, enquanto o `const handleAdicionarNode`
 *   ainda estava na TDZ → "Cannot access 'handleAdicionarNode' before initialization".
 *   Quebrava o Projeto EV ao entrar no editor do unifilar (após selecionar carregador).
 *
 * Guarda: qualquer useCallback que dependa de `handleAdicionarNode` DEVE ser declarado
 * DEPOIS da declaração de `handleAdicionarNode`.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(__dirname, '../InteractiveDiagram.jsx')
const src = readFileSync(SRC, 'utf8')

describe('InteractiveDiagram — ordem de declaração (anti-TDZ)', () => {
  it('handleAdicionarNode é declarado antes de handleSalvarCustomizado', () => {
    const iAdicionar = src.indexOf('const handleAdicionarNode = useCallback')
    const iSalvar = src.indexOf('const handleSalvarCustomizado = useCallback')
    expect(iAdicionar).toBeGreaterThan(-1)
    expect(iSalvar).toBeGreaterThan(-1)
    expect(iAdicionar).toBeLessThan(iSalvar)
  })

  it('handleSalvarCustomizado depende de handleAdicionarNode (a ordem importa)', () => {
    // confirma que a dependência que causava o TDZ ainda existe (portanto a ordem é crítica)
    const bloco = src.slice(src.indexOf('const handleSalvarCustomizado = useCallback'))
    const fim = bloco.indexOf('// Exportar diagrama como JSON')
    expect(bloco.slice(0, fim)).toMatch(/\[novoCustomizado,\s*handleAdicionarNode\]/)
  })

  it('cada handler é declarado exatamente uma vez (sem duplicação do swap)', () => {
    const nAdicionar = (src.match(/const handleAdicionarNode = useCallback/g) || []).length
    const nSalvar = (src.match(/const handleSalvarCustomizado = useCallback/g) || []).length
    expect(nAdicionar).toBe(1)
    expect(nSalvar).toBe(1)
  })
})
