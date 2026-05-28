/**
 * geoEngine.js — Sprint 6
 *
 * Motor geoespacial FV profissional leve. Funções puras e determinísticas.
 *
 * Princípio: a GEOMETRIA alimenta a ENGENHARIA. Área útil real, obstáculos,
 * sombreamento e orientação por pano definem a capacidade máxima de módulos —
 * que por sua vez limita E7 e alimenta o snapshot técnico (engineering lock).
 *
 * NÃO faz raytracing/3D/LiDAR — sombreamento é um fator simplificado por pano.
 */

const n = (v, def = 0) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : def
}
const round1 = (v) => +(n(v)).toFixed(1)

// ─── 1. Área geodésica de polígono (lat/lng → m²) ───────────────────────────────
// Projeção equiretangular local + fórmula do shoelace. Boa precisão em telhados.
export function areaPoligonoGeodesica(pontos) {
  if (!Array.isArray(pontos) || pontos.length < 3) return 0
  const R = 6378137 // raio da Terra (m)
  const latMedia = pontos.reduce((s, p) => s + n(p[0]), 0) / pontos.length
  const cosLat = Math.cos((latMedia * Math.PI) / 180)
  // Converte cada vértice para metros (x=lng, y=lat)
  const xy = pontos.map(([lat, lng]) => [
    (n(lng) * Math.PI / 180) * R * cosLat,
    (n(lat) * Math.PI / 180) * R,
  ])
  let soma = 0
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i]
    const [x2, y2] = xy[(i + 1) % xy.length]
    soma += x1 * y2 - x2 * y1
  }
  return Math.abs(soma) / 2
}

// ─── 2. Orientação → azimute (graus, 0 = Norte, horário) ────────────────────────
export const AZIMUTE_ORIENTACAO = {
  Norte: 0, Nordeste: 45, Leste: 90, Sudeste: 135,
  Sul: 180, Sudoeste: 225, Oeste: 270, Noroeste: 315, Plano: 0,
}
export function orientacaoParaAzimute(orientacao) {
  return AZIMUTE_ORIENTACAO[orientacao] ?? 0
}

// ─── 3. Fator de geração por orientação/inclinação (Brasil, hemisfério sul) ─────
// Ideal: face Norte. Penaliza desvio do Norte e inclinações fora do ótimo (~20°).
export function fatorOrientacaoTilt(orientacao, inclinacaoGraus) {
  const azimute = orientacaoParaAzimute(orientacao)
  // Desvio angular do Norte (0–180)
  const desvio = Math.min(Math.abs(azimute), 360 - Math.abs(azimute))
  // Norte=1.0, Leste/Oeste≈0.88, Sul≈0.72 (perdas típicas no Brasil)
  const fatorAz = 1 - (desvio / 180) * 0.28
  // Inclinação: ótimo ~20°; telhado plano perde um pouco; muito íngreme também
  const tilt = n(inclinacaoGraus)
  const fatorTilt = 1 - Math.min(Math.abs(tilt - 20) / 100, 0.12)
  return +(Math.max(0.5, fatorAz * fatorTilt)).toFixed(3)
}

// ─── 4. Área útil (desconta obstáculos, recuos e corredores técnicos) ───────────
export function calcularAreaUtil(areaBruta, { obstaculos = [], recuoPct = 10, corredorPct = 8 } = {}) {
  const bruta = n(areaBruta)
  const areaObst = (obstaculos || []).reduce((s, o) => s + n(o.area_m2 ?? o.area), 0)
  const aposObst = Math.max(0, bruta - areaObst)
  const util = aposObst * (1 - (n(recuoPct) + n(corredorPct)) / 100)
  return { area_bruta: round1(bruta), area_obstaculos: round1(areaObst), area_util: round1(Math.max(0, util)) }
}

// ─── 5. Capacidade máxima de módulos por pano ───────────────────────────────────
// Considera a área do módulo (m²), um fator de empacotamento e a orientação do
// módulo (retrato/paisagem não muda a área, mas afeta o empacotamento real).
export function maxModulosPorArea(areaUtil, { moduloAreaM2 = 2.4, packing = 0.82 } = {}) {
  if (n(areaUtil) <= 0 || n(moduloAreaM2) <= 0) return 0
  return Math.floor((n(areaUtil) * n(packing)) / n(moduloAreaM2))
}

// ─── 6. Cálculo completo de um pano ─────────────────────────────────────────────
/**
 * @param {object} pano { id, nome, poligono?, area_bruta?, orientacao, inclinacao,
 *                         fator_sombra (0–100 %), obstaculos[], orientacao_modulo }
 * @param {object} opts { moduloAreaM2, recuoPct, corredorPct, packing }
 */
export function calcularPano(pano = {}, opts = {}) {
  const areaBruta = pano.area_bruta != null && pano.area_bruta !== ''
    ? n(pano.area_bruta)
    : areaPoligonoGeodesica(pano.poligono)

  const { area_util, area_obstaculos } = calcularAreaUtil(areaBruta, {
    obstaculos: pano.obstaculos || [],
    recuoPct: opts.recuoPct ?? 10,
    corredorPct: opts.corredorPct ?? 8,
  })

  const sombraPct = Math.min(Math.max(n(pano.fator_sombra), 0), 90)
  const fatorSombra = 1 - sombraPct / 100
  const fatorOrient = fatorOrientacaoTilt(pano.orientacao, pano.inclinacao)
  const fatorGeracao = +(fatorOrient * fatorSombra).toFixed(3)

  // Sombra severa reduz a área aproveitável de módulos
  const areaUtilEfetiva = sombraPct >= 50 ? area_util * 0.6 : area_util
  const capacidade = maxModulosPorArea(areaUtilEfetiva, {
    moduloAreaM2: opts.moduloAreaM2 ?? 2.4,
    packing: (pano.orientacao_modulo === 'paisagem' ? 0.80 : 0.82),
  })

  return {
    id: pano.id,
    nome: pano.nome || 'Pano',
    area_bruta: round1(areaBruta),
    area_obstaculos,
    area_util: round1(area_util),
    azimute: orientacaoParaAzimute(pano.orientacao),
    orientacao: pano.orientacao || 'Norte',
    inclinacao: n(pano.inclinacao),
    orientacao_modulo: pano.orientacao_modulo || 'retrato',
    fator_sombra_pct: sombraPct,
    fator_geracao: fatorGeracao,
    capacidade_modulos: capacidade,
  }
}

// ─── 7. Consolidação multi-pano ─────────────────────────────────────────────────
export function consolidarPanos(panos = [], opts = {}) {
  const calc = (panos || []).map((p) => calcularPano(p, opts))
  const area_bruta_total = round1(calc.reduce((s, p) => s + p.area_bruta, 0))
  const area_util_total = round1(calc.reduce((s, p) => s + p.area_util, 0))
  const max_modulos_total = calc.reduce((s, p) => s + p.capacidade_modulos, 0)
  // Fator de geração médio ponderado pela capacidade de cada pano
  const somaCap = calc.reduce((s, p) => s + p.capacidade_modulos, 0)
  const fator_geracao_medio = somaCap > 0
    ? +(calc.reduce((s, p) => s + p.fator_geracao * p.capacidade_modulos, 0) / somaCap).toFixed(3)
    : (calc.length ? +(calc.reduce((s, p) => s + p.fator_geracao, 0) / calc.length).toFixed(3) : 1)

  return {
    panos: calc,
    total_panos: calc.length,
    area_bruta_total,
    area_util_total,
    max_modulos_total,
    fator_geracao_medio,
    fator_sombra_medio: calc.length
      ? +(calc.reduce((s, p) => s + p.fator_sombra_pct, 0) / calc.length).toFixed(1)
      : 0,
  }
}

// ─── 8. Sincronização com a engenharia (capacidade × módulos pretendidos) ───────
export function validarCapacidade(maxModulos, modulosPretendidos) {
  const max = n(maxModulos)
  const pretendidos = n(modulosPretendidos)
  if (max <= 0) return { ok: true, nivel: 'sem_layout', mensagem: null }
  if (pretendidos > max) {
    return {
      ok: false, nivel: 'bloqueio',
      mensagem: `O layout do telhado comporta no máximo ${max} módulos, mas a engenharia tenta usar ${pretendidos}. Ajuste o layout (E6) ou reduza os módulos.`,
      excedente: pretendidos - max,
    }
  }
  if (pretendidos > max * 0.92) {
    return { ok: true, nivel: 'alerta', mensagem: `Ocupação alta: ${pretendidos}/${max} módulos (${Math.round((pretendidos / max) * 100)}% do telhado).` }
  }
  return { ok: true, nivel: 'ok', mensagem: null, ocupacao_pct: Math.round((pretendidos / max) * 100) }
}

// ─── Config de UI ────────────────────────────────────────────────────────────────
export const ORIENTACOES_PANO = ['Norte', 'Nordeste', 'Leste', 'Sudeste', 'Sul', 'Sudoeste', 'Oeste', 'Noroeste', 'Plano']
export function panoNovo(idx = 0) {
  return {
    id: `pano-${Date.now()}-${idx}`,
    nome: `Pano ${idx + 1}`,
    area_bruta: '',
    orientacao: 'Norte',
    inclinacao: 20,
    fator_sombra: 0,
    orientacao_modulo: 'retrato',
    obstaculos: [],
  }
}
