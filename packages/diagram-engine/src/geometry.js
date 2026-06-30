/**
 * geometry.js — GEOMETRIA EXECUTIVA ÚNICA (A4 paisagem).
 *
 * FONTE ÚNICA de toda a geometria do documento executivo. Define APENAS os LIMITES
 * (caixas) de cada área. O algoritmo de layout (layout.js) calcula as posições dos
 * componentes automaticamente DENTRO de DIAGRAM_BOX — nenhuma coordenada fixa por
 * equipamento. Consumido por svgRenderer (SVG/PDF) e pelo Editor.
 *
 * Áreas reservadas (nenhuma pode invadir a outra):
 *   HEADER_BOX · CLIENT_BOX · EQUIPMENT_BOX · DIAGRAM_BOX · BOM_BOX · NOTES_BOX · QR_BOX
 */

export const A4 = Object.freeze({ W: 1123, H: 794 }) // A4 paisagem @ ~96dpi
export const MARGEM = 20

// ── Caixas do documento (todas em coordenadas A4) ────────────────────────────
export const HEADER_BOX    = Object.freeze({ x: 20,  y: 20,  w: A4.W - 40, h: 70 })
export const CLIENT_BOX    = Object.freeze({ x: 20,  y: 100, w: 320, h: 128 })
export const EQUIPMENT_BOX = Object.freeze({ x: 360, y: 100, w: 320, h: 128 })
// Área EXCLUSIVA do diagrama — entre os blocos de dados (≤228) e o BOM/NOTAS (≥470).
export const DIAGRAM_BOX   = Object.freeze({ x: 40,  y: 236, w: A4.W - 80, h: 226 })
export const BOM_BOX       = Object.freeze({ x: 20,  y: 470, w: 320, h: 290 })
export const NOTES_BOX     = Object.freeze({ x: 360, y: 470, w: A4.W - 40 - 360 - 150, h: 160 })
export const QR_BOX        = Object.freeze({ x: A4.W - 180, y: A4.H - 130, w: 120, h: 120 })

// Conjunto nomeado (para checagem de containment e iteração).
export const BOXES = Object.freeze({
  HEADER_BOX, CLIENT_BOX, EQUIPMENT_BOX, DIAGRAM_BOX, BOM_BOX, NOTES_BOX, QR_BOX,
})

// Compat: blocos usados pelo svgRenderer.
export const BLOCOS = Object.freeze({
  HEADER: HEADER_BOX, CLIENTE: CLIENT_BOX, EQUIP: EQUIPMENT_BOX,
  BOM: BOM_BOX, NOTAS: NOTES_BOX, QR: QR_BOX,
})

// Caixa nominal de um componente do diagrama (símbolo).
export const COMPONENTE = Object.freeze({ W: 120, H: 90 })

// Espaçamento entre condutores paralelos desenhados num mesmo cabo.
export const COND_GAP = 4
