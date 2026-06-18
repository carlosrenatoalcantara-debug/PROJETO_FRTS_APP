/**
 * 🔎 Derivação de specs a partir do NOME DO MODELO — P0-FV-CATALOG-QUALITY-RECAL-01
 *
 * Funções PURAS, determinísticas, sem I/O. Inferem potência / tecnologia / tensão
 * a partir do nome do modelo do inversor quando o catálogo não tem especificações
 * (import identity-only do SolarMarket). Cada derivação registra um nível de
 * confiança e o método usado — NUNCA inventa MPPT/Voc (não deriváveis do nome).
 *
 * Categorias de saída:
 *   'derivavel'      — potência extraída com alta confiança (kW explícito no nome)
 *   'parcial'        — potência inferida de watts no nome (confiança média; revisar)
 *   'nao_derivavel'  — nome não codifica potência → depende de datasheet
 *
 * As chaves de `especificacoes` derivadas usam aliases reconhecidos pelo SSOT
 * (dicionarioInversor): potencia_kw, tensao_ac.
 */

import { tecnologiaInversor } from './regrasPlausibilidade.js'

const VOLTAGENS_BR = new Set([110, 120, 127, 208, 220, 230, 240, 277, 380, 400, 415, 440, 480, 600])

/**
 * Deriva a potência (kW) do nome do modelo.
 * @returns {{ potencia_kw:number, confianca:'alta'|'media', metodo:string } | null}
 */
export function derivarPotenciaKwDoModelo(modelo) {
  if (!modelo || typeof modelo !== 'string') return null
  const nome = modelo.toUpperCase()

  // ── Regra A (alta): número seguido de 'K' (kW explícito) ──────────────────
  // Ex.: SUN-25K-G → 25 · MID 36KTL3-X → 36 · 7.5KTLM → 7.5 · X1-BOOST-6K-G4 → 6
  const kMatches = [...nome.matchAll(/(\d+(?:[.,]\d+)?)\s*K(?![A-Z]*\d*\.?\d*K)/g)]
  for (const m of kMatches) {
    const v = parseFloat(m[1].replace(',', '.'))
    if (Number.isFinite(v) && v >= 1 && v <= 150) {
      return { potencia_kw: v, confianca: 'alta', metodo: 'regex_kW' }
    }
  }

  // ── Regra B (média): inteiro de 4–6 dígitos = watts → kW ───────────────────
  // Ex.: MIN 6000TL-X → 6 · 50000TL3-S → 50 · GW8000-DT → 8 · BDM-2250 → 2.25
  // Exclui voltagens (3 dígitos) e números < 1500 (ambíguos, ex.: SUN1000G3).
  const wattMatches = [...nome.matchAll(/(?<![\d.])(\d{4,6})(?![\d.])/g)]
  for (const m of wattMatches) {
    const w = parseInt(m[1], 10)
    if (VOLTAGENS_BR.has(w)) continue
    if (w >= 1500 && w <= 125000) {
      return { potencia_kw: +(w / 1000).toFixed(2), confianca: 'media', metodo: 'regex_watts' }
    }
  }

  return null
}

/**
 * Deriva a tensão de saída (V) quando explícita no nome. null se ambígua.
 */
export function derivarTensaoSaidaDoModelo(modelo) {
  if (!modelo || typeof modelo !== 'string') return null
  const nome = modelo.toUpperCase()
  // Tokens de voltagem explícitos: "@220", "380/220V", "-220", "LV"
  const m = nome.match(/(?:@|\/|-|\s)(127|220|230|240|380|400|440|480)\s*V?\b/)
  if (m) return Number(m[1])
  if (/-LV\b|\bLV\b/.test(nome)) return 220   // low-voltage típico BR
  return null
}

/**
 * Deriva o conjunto de specs inferíveis do nome do inversor.
 * @param {{fabricante?:string, modelo?:string}} eq
 * @returns {{
 *   especificacoes: object,        // chaves SSOT (potencia_kw, tensao_ac)
 *   tecnologia: string,            // micro|string|otimizador|hibrido
 *   campos_derivados: string[],
 *   confianca: 'alta'|'media'|null,
 *   categoria: 'derivavel'|'parcial'|'nao_derivavel',
 *   metodo_potencia: string|null,
 * }}
 */
export function derivarInversorPorModelo(eq = {}) {
  const fabricante = eq.fabricante || ''
  const modelo = eq.modelo || ''
  const pot = derivarPotenciaKwDoModelo(modelo)
  const tensao = derivarTensaoSaidaDoModelo(modelo)
  const tecnologia = tecnologiaInversor({ fabricante, modelo })

  const especificacoes = {}
  const campos_derivados = []
  if (pot) { especificacoes.potencia_kw = pot.potencia_kw; campos_derivados.push('potencia_kw') }
  if (tensao) { especificacoes.tensao_ac = tensao; campos_derivados.push('tensao_ac') }

  let categoria = 'nao_derivavel'
  if (pot?.confianca === 'alta') categoria = 'derivavel'
  else if (pot?.confianca === 'media') categoria = 'parcial'

  return {
    especificacoes,
    tecnologia,
    campos_derivados,
    confianca: pot?.confianca || null,
    categoria,
    metodo_potencia: pot?.metodo || null,
  }
}

export const _internals = { VOLTAGENS_BR }
