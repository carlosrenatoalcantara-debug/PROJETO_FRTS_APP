/**
 * obterLocalProjeto.js — S1.5-FV-LOCAL-CONSUMERS-MIGRATION-01
 *
 * ADAPTER OFICIAL DE LEITURA do Local de um ProjetoFV. Ponto ÚNICO por onde
 * toda LEITURA de localização/superfície do projeto deve passar. É PROIBIDO
 * ler `projeto.localizacao` / `projeto.telhado` / `projeto.area` / `projeto.layoutSolar`
 * diretamente fora deste módulo (leitores). Escritores de persistência (wizard
 * /etapa, salvarTelhado, E3Localizacao) são isentos — eles mantêm o espelho legado.
 *
 * PURO e ISOMÓRFICO (sem I/O, sem deps de node) — importável do backend e do
 * frontend por caminho relativo, mesmo padrão de equipamentos/inversores.
 *
 * CONTRATO:
 *  - Recebe um `projeto` cujo `local_ref` pode estar:
 *      • null / ObjectId não populado  → usa 100% o modelo legado
 *      • objeto Local populado         → prefere Local, CAMPO A CAMPO
 *  - FALLBACK POR CAMPO: para cada campo, usa o valor do Local se não-nulo;
 *    caso contrário, cai no equivalente legado. Garante resposta idêntica
 *    enquanto o Local não estiver 100% preenchido.
 *  - GEOMETRIA (pontos do telhado, roof_planes, obstáculos, imagem de satélite)
 *    NÃO existe no agregado Local (S1) → é SEMPRE lida do legado.
 *
 * NÃO altera nada. NÃO persiste. NÃO calcula engenharia. Somente leitura.
 */

// Azimute (graus) → orientação textual, para leitores que exibem texto.
const AZIMUTE_ORIENTACAO = [
  [0, 'Norte'], [45, 'Nordeste'], [90, 'Leste'], [135, 'Sudeste'],
  [180, 'Sul'], [225, 'Sudoeste'], [270, 'Oeste'], [315, 'Noroeste'], [360, 'Norte'],
]
function orientacaoDeAzimute(az) {
  if (az === null || az === undefined) return null
  let melhor = null, dmin = Infinity
  for (const [g, nome] of AZIMUTE_ORIENTACAO) {
    const d = Math.abs(Number(az) - g)
    if (d < dmin) { dmin = d; melhor = nome }
  }
  return melhor
}

// Primeiro valor não-nulo/não-vazio de uma lista (fallback por campo).
function coalesce(...vals) {
  for (const v of vals) {
    if (v !== null && v !== undefined && v !== '') return v
  }
  return null
}

/**
 * Detecta se `local_ref` é um Local POPULADO (objeto de domínio), e não um
 * ObjectId cru / string / referência não resolvida.
 */
export function localPopulado(projeto) {
  const ref = projeto && projeto.local_ref
  if (!ref || typeof ref !== 'object') return null
  // ObjectId (não populado) não tem propriedades de domínio do Local.
  const temCampoLocal = 'coordenadas' in ref || 'superficies' in ref ||
    'hsp0_kwh_m2_dia' in ref || 'endereco' in ref || '_schema_versao' in ref
  return temCampoLocal ? ref : null
}

/** Normaliza uma Superfície do Local para o shape de leitura. */
function superficieDoLocal(s) {
  return {
    id: s._id != null ? String(s._id) : null,
    nome: s.nome ?? null,
    area_m2: s.area_disponivel_m2 ?? null,
    azimute_graus: s.azimute_graus ?? null,
    orientacao: orientacaoDeAzimute(s.azimute_graus),
    inclinacao_graus: s.inclinacao_graus ?? null,
    tipo_cobertura: s.tipo_cobertura ?? null,
    sombreamento_parcial: s.sombreamento_parcial ?? null,
    estado: s.estado ?? null,
    origem: 'local',
  }
}

/** Deriva uma Superfície única a partir do legado (layoutSolar → area → telhado). */
function superficieDoLegado(projeto) {
  const ls = projeto.layoutSolar || {}
  const area = projeto.area || {}
  const telhado = projeto.telhado || {}
  const area_m2 = coalesce(ls.area_util_m2, area.area_m2, area.area_util_m2, telhado.area_m2)
  const orientacao = coalesce(ls.orientacao, area.orientacao, telhado.orientacao)
  const inclinacao = coalesce(ls.inclinacao_graus, area.inclinacao, telhado.inclinacao)
  const sombra = ls.sombreamento_pct
  if (area_m2 == null && orientacao == null && inclinacao == null) return []
  return [{
    id: null,
    nome: orientacao ? `Telhado ${orientacao}` : 'Telhado',
    area_m2: area_m2 ?? null,
    azimute_graus: null,
    orientacao: orientacao ?? null,
    inclinacao_graus: inclinacao ?? null,
    tipo_cobertura: ls.tipo_telhado ?? null,
    sombreamento_parcial: sombra != null ? Number(sombra) > 0 : null,
    estado: 'ativa',
    origem: 'legado',
  }]
}

/**
 * Leitura oficial do Local de um projeto.
 * @param {object} projeto  ProjetoFV (doc ou objeto plano); local_ref pode estar populado.
 * @returns {object} shape normalizado (superset compatível com `localizacao` legado).
 */
export function obterLocalProjeto(projeto) {
  const p = projeto || {}
  const L = localPopulado(p)            // Local populado ou null
  const loc = p.localizacao || {}       // subdoc legado v3
  const ls = p.layoutSolar || {}
  const telhado = p.telhado || {}

  // ── Coordenadas (Local → localizacao v3 → flat v2) ─────────────────────────
  const latitude = coalesce(L && L.coordenadas && L.coordenadas.latitude, loc.latitude, p.latitude)
  const longitude = coalesce(L && L.coordenadas && L.coordenadas.longitude, loc.longitude, p.longitude)

  // ── Endereço ───────────────────────────────────────────────────────────────
  const endObj = (L && L.endereco) || {}
  const endereco_completo = coalesce(endObj.endereco_completo, loc.endereco_completo, p.endereco_completo)
  const cep = coalesce(endObj.cep, loc.cep)
  const cidade = coalesce(endObj.cidade, loc.cidade, p.cidade)
  const estado = coalesce(endObj.estado, loc.estado, p.estado)

  // ── Clima / irradiância (HSP diário — NUNCA usa o flat mensal irradiancia_local) ─
  const hsp0 = coalesce(L && L.hsp0_kwh_m2_dia, loc.irradiancia_kwh_kwp_dia)
  const fonte_irradiancia = coalesce(L && L.fonte_irradiancia, loc.fonte_irradiancia)
  const temperatura_min_c = coalesce(L && L.temperatura_min_c, loc.temperatura_min_historica_c)
  const temperatura_max_c = coalesce(L && L.temperatura_max_c, loc.temperatura_max_historica_c)
  const temperatura_media_c = coalesce(L && L.temperatura_media_c, loc.temperatura_media_c)
  const fonte_climatica = coalesce(L && L.fonte_climatica, loc.fonte_climatica)

  // ── Superfícies (Local quando houver; senão deriva 1 do legado) ────────────
  const superficies = (L && Array.isArray(L.superficies) && L.superficies.length > 0)
    ? L.superficies.map(superficieDoLocal)
    : superficieDoLegado(p)

  // ── Geometria (SEMPRE legado — não existe no agregado Local S1) ─────────────
  const geometria = {
    pontos: coalesce(telhado.pontos, ls.pontos) || [],
    area_m2: coalesce(telhado.area_m2, ls.area_util_m2),
    roof_planes: ls.roof_planes ?? null,
    obstaculos: ls.obstaculos ?? null,
    imagem_satelite_url: ls.imagem_satelite_url ?? null,
  }

  const origem = L ? 'local' : 'legado'

  return {
    origem,                         // proveniência dominante (informativo)
    // objeto estruturado
    coordenadas: { latitude, longitude },
    endereco: { endereco_completo, cep, cidade, estado },
    clima: { hsp0_kwh_m2_dia: hsp0, fonte_irradiancia, temperatura_min_c, temperatura_max_c, temperatura_media_c, fonte_climatica },
    superficies,
    geometria,

    // ── aliases legados (drop-in): mesmos nomes que os leitores usam hoje ─────
    latitude, longitude, cidade, estado, endereco_completo, cep,
    // `telhado` = PASSTHROUGH fiel do valor legado (geometria é sempre legado):
    // preserva byte-a-byte o que o leitor obtinha de `projeto.telhado`, inclusive
    // ausência (null). A visão numérica normalizada fica em `geometria`.
    telhado: (p.telhado != null ? p.telhado : null),
  }
}

export default obterLocalProjeto
