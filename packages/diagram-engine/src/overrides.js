/**
 * overrides.js — Edições manuais sobre o layout do Engine.
 *
 * Decisão de arquitetura: coordenadas absolutas NÃO são a verdade do projeto.
 * A verdade do layout é sempre o Engine; o usuário pode mover componentes e essas
 * edições ficam como `overrides` (por id). Quando o projeto muda eletricamente, o
 * Engine recalcula a base e os overrides de componentes que deixaram de existir são
 * podados (não há layout antigo inconsistente com o projeto).
 *
 * override por id: { position?: {x,y}, ... }
 */

/** Aplica overrides sobre o layout base (posição manual vence a calculada). */
export function aplicarOverrides(layoutBase = {}, overrides = {}) {
  const out = {}
  for (const [id, pos] of Object.entries(layoutBase)) {
    const ov = overrides?.[id]
    out[id] = ov?.position ? { x: ov.position.x, y: ov.position.y } : { ...pos }
  }
  return out
}

/**
 * Remove overrides cujos ids não existem mais entre os componentes atuais.
 * @returns {{ overrides: object, removidos: string[] }}
 */
export function podarOverridesOrfaos(overrides = {}, components = []) {
  const idsValidos = new Set(components.map(c => c.id))
  const limpos = {}
  const removidos = []
  for (const [id, ov] of Object.entries(overrides || {})) {
    if (idsValidos.has(id)) limpos[id] = ov
    else removidos.push(id)
  }
  return { overrides: limpos, removidos }
}
