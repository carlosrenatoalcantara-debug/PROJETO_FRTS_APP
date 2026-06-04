/**
 * fabricanteModeloFallback.js — Sprint 8.6.1
 *
 * PURO. Regex robusto para extrair fabricante + modelo do TEXTO BRUTO do PDF
 * quando o Gemini/Claude falha ou devolve nulo. Filosofia: NUNCA aceitar
 * "Desconhecido"/"Inversor" como default; se há texto no PDF, tem que ter pista.
 *
 * Suporta os fabricantes mais comuns do mercado BR: Deye, Solis (Ginlong),
 * Growatt, Sungrow, Goodwe, Fronius, ABB/FIMER, SMA, Huawei, Canadian Solar,
 * Jinko, Trina, JA Solar, LONGi, Risen, Seraphim, BYD.
 */

// ── Catálogo de padrões: cada entrada tem nome canônico e regexes de modelo ─
const PADROES = [
  // ── Inversores ──────────────────────────────────────────────────────────
  {
    fabricante: 'Deye',
    aliases: ['deye', 'ningbo deye', 'deye inverter'],
    modelos: [
      // S8.6.2: faixa de potência no nome (SUN-23-30K-G04-LV, SUN-12-15-18K)
      /\b(SUN-\d{1,3}-\d{1,3}K-G\d+\w*)\b/i,
      // Híbridos: SUN-12K-SG04LP3, SUN-5K-SG03LP1...
      /\b(SUN-?\d{1,3}K-S?G\d+\w*)\b/i,
      // String inverters: SUN-30K-G04, SUN-12K-G05, SUN-50K-G03, SUN-110K-G04...
      /\b(SUN-?\d{1,3}K-G\d+\w*)\b/i,
      // Mais genérico (fallback): SUN-30K, SUN30K, SUN-110K, SUN-23-30K
      /\b(SUN-?\d{1,3}(?:-\d{1,3})?K[-\w]*)\b/i,
    ],
  },
  {
    fabricante: 'Solis',  // Ginlong Solis
    aliases: ['solis', 'ginlong', 'ginlong solis', 'Ginlong Technologies'],
    modelos: [
      /\b(S[1-9]-GR\d+[KP]-?\w*)\b/i,           // S6-GR1P5K, S6-GR3P10K
      /\b(RHI-\d{1,3}K-\w*)\b/i,                 // RHI-5K-48ES, RHI-50K-HV
      /\b(S[1-9]-EH\d+[KP]-?\w*)\b/i,            // S6-EH3P5K-H
      // P0-CAT-09: série 1P/3P 4G/5G (Solis-1P7K-4G, 3P5K-4G, 1P5K-5G)
      /\b(?:Solis-?)?([13]P\d{1,2}(?:\.\d)?K-\dG\w*)\b/i,
    ],
  },
  {
    fabricante: 'Growatt',
    aliases: ['growatt'],
    modelos: [
      /\b(MID\s*\d{1,3}KTL3-?X?\w*)\b/i,         // MID 25KTL3-X, MID 30KTL3-X3 (BUG-08)
      /\b(MIC\s*\d{3,5}TL-X)\b/i,                // MIC 750TL-X, MIC1000TL-X
      /\b(MIN\s*\d{3,5}TL-X\w*)\b/i,             // MIN 3000TL-XE
      /\b(MAX\s*\d{1,3}KTL3-?\w*)\b/i,           // MAX 50KTL3-XL
      /\b(MAC\s*\d{1,3}KTL3-?\w*)\b/i,           // MAC 50KTL3-XL
      /\b(MOD\s*\d{1,4}TL3-XH?\w*)\b/i,          // MOD 10KTL3-XH
      /\b(SPH\s*\d{3,5}\w*)\b/i,                 // SPH 5000 (híbrido)
      /\b(SPF\s*\d{3,5}\w*)\b/i,                 // SPF 5000ES
      // GENÉRICO de família Growatt: cobre séries futuras M?? + (K)TL(3)-X
      /\b(M[A-Z]{2}\s*\d{1,4}K?TL3?-?X?\w*)\b/i,
    ],
  },
  {
    fabricante: 'Sungrow',
    aliases: ['sungrow'],
    modelos: [
      /\b(SG\d{1,3}[KCRT]X?-?\w*)\b/i,           // SG110CX, SG10RT, SG5K-D
      /\b(SH\d{1,2}[KRT]\w*)\b/i,                // SH10RT, SH5K-30
    ],
  },
  {
    fabricante: 'Goodwe',
    aliases: ['goodwe'],
    modelos: [
      // BUG-08: \d{2,5} (não 3,5) — GW20KT-DT / GW25K-MT têm só 2 dígitos.
      /\b(GW\d{2,5}[A-Z]*-?[A-Z0-9]*)\b/i,       // GW20KT-DT, GW5000-NS, GW25K-MT
    ],
  },
  {
    // S8.6.2: confirmado nos testes reais (Datasheet_-_Solplanet_-_ASW7300-S.pdf)
    fabricante: 'Solplanet',
    aliases: ['solplanet', 'aiswei'],
    modelos: [
      /\b(ASW\s*\d{3,5}[A-Z]?-?[A-Z0-9]*)\b/i,   // ASW7300-S, ASW15K-LT-G2, ASW100KH-T2
    ],
  },
  {
    fabricante: 'Fronius',
    aliases: ['fronius'],
    modelos: [
      /\b(Symo\s*\d{1,3}\.\d-?\d-?M?\w*)\b/i,    // Symo 12.5-3-M
      /\b(Primo\s*\d{1,3}\.\d-?\d?\w*)\b/i,      // Primo 5.0-1
      /\b(Eco\s*\d{1,3}\.\d-?\d?\w*)\b/i,        // Eco 27.0-3-S
    ],
  },
  {
    fabricante: 'Huawei',
    aliases: ['huawei'],
    modelos: [
      /\b(SUN2000-\d{1,3}K?TL\w*)\b/i,           // SUN2000-100KTL-H1
      /\b(SUN2000-\d{1,3}\w*)\b/i,
    ],
  },
  {
    fabricante: 'SMA',
    aliases: ['sma solar', 'sma '],
    modelos: [
      /\b(Sunny\s*Tripower\s*\d+\.?\d*\w*)\b/i,
      /\b(Sunny\s*Boy\s*\d+\.?\d*\w*)\b/i,
      /\b(STP\s*\d{1,3}-\d+\w*)\b/i,
    ],
  },
  {
    fabricante: 'ABB',
    aliases: ['abb ', 'power-one'],
    modelos: [
      /\b(PVS-?\d{1,3}-?\w*)\b/i,                // PVS-100-TL
      /\b(TRIO-?\d{1,3}\.\d+-?\w*)\b/i,          // TRIO-50.0-TL-OUTD
    ],
  },
  {
    // BUG-08: Fimer (spin-off ABB Solar) — modelos PVS/REACT/TRIO
    fabricante: 'Fimer',
    aliases: ['fimer'],
    modelos: [
      /\b(PVS-?\d{1,3}-?\w*)\b/i,                // PVS-100-TL, PVS-175-TL
      /\b(REACT\d?-?\w*)\b/i,                    // REACT2-5.0-TL
      /\b(TRIO-?\d{1,3}\.\d+-?\w*)\b/i,          // TRIO-27.6-TL-OUTD
    ],
  },
  {
    // BUG-08: SolarEdge — séries SE / SExxxxH / SExxK-RWS
    fabricante: 'SolarEdge',
    aliases: ['solaredge', 'solar edge'],
    modelos: [
      /\b(SE\d{3,6}[A-Z]?-?[A-Z0-9]*)\b/i,      // SE5000H, SE27.6K, SE100K
    ],
  },
  {
    // BUG-08: Chint Power Systems (Astronergy) — séries CPS
    fabricante: 'Chint',
    aliases: ['chint', 'chint power', 'cps '],
    modelos: [
      /\b(CPS\s*SC[AH]?\d+[A-Z]*-?[A-Z0-9]*)\b/i, // CPS SCA50KTL-DO, CPS SCH100KTL
      /\b(CPS-?\d{1,3}K[A-Z0-9-]*)\b/i,            // CPS-50K
    ],
  },
  {
    // BUG-08: WEG inversores (série SIW) — distinto do WEG EV (WMO) mais abaixo
    fabricante: 'WEG',
    aliases: ['weg solar', 'weg inversor', 'siw'],
    modelos: [
      /\b(SIW\d{3}[A-Z]?-?[A-Z0-9]*)\b/i,       // SIW100G, SIW300H, SIW500H-ST
    ],
  },
  {
    // P1-INV-MATRIX-01: Hopewind (série HSSP/HSST) — datasheet com texto OCR.
    fabricante: 'Hopewind',
    aliases: ['hopewind'],
    modelos: [
      /\b(HSS[PT]\d{1,3}K-?[A-Z0-9]*)\b/i,      // HSSP6K-G01, HSST110K
    ],
  },
  {
    // P1-INV-HARDEN-PLUS-01: SAJ (séries R5/R6/Suntrio)
    fabricante: 'SAJ',
    aliases: ['saj'],
    modelos: [
      /\b(R[56]-\d{1,2}(?:\.\d)?K-?[A-Z0-9-]*)\b/i,   // R5-8K-S2, R6-25K-T2
      /\b(Suntrio[\s-]*\w*)\b/i,
    ],
  },
  // ── Microinversores (P1-MICRO-READINESS-01) — fabricante reconhecido ⇒
  //    derivarTopologia() classifica como MICRO. NÃO altera dimensionamento.
  {
    fabricante: 'Hoymiles',
    aliases: ['hoymiles'],
    modelos: [/\b(HM[ST]-?\d{3,4}\w*(?:-\w+)*)\b/i, /\b(MI-?\d{3,4}\w*)\b/i],  // HMS-2000DW-4T, MI-1500
  },
  {
    fabricante: 'APsystems',
    aliases: ['apsystems', 'ap systems', 'altenergy'],
    modelos: [/\b(QT\d[A-Z0-9-]*)\b/i, /\b(DS3[A-Z0-9-]*)\b/i, /\b(YC\d{3}[A-Z0-9-]*)\b/i, /\b(EZ\d[A-Z0-9-]*)\b/i],  // QT2D, DS3, YC600
  },
  {
    fabricante: 'TSUN',
    aliases: ['tsun', 'tsol'],
    modelos: [/\b(TSOL-?M[XH]\d{3,4}[A-Z0-9-]*)\b/i, /\b(M[XH]\d{3,4}D?)\b/i],  // TSOL-MX3000D, MH2000
  },
  {
    fabricante: 'NEP',
    aliases: ['nep ', 'northern electric power', 'northern ele'],
    modelos: [/\b(MINV[A-Z0-9-]*)\b/i, /\b(BDM-?\d{3,4}[A-Z0-9-]*)\b/i, /\b(PV-?MICRO[A-Z0-9-]*)\b/i],
  },
  {
    fabricante: 'Deye Micro',
    aliases: ['deye microinversor', 'sun microinverter'],
    modelos: [/\b(SUN-?\d{3,4}G\d[A-Z0-9-]*-?MI[A-Z0-9-]*)\b/i, /\b(SUN-?M\d{2,4}[A-Z0-9-]*)\b/i],
  },
  // ── Módulos ────────────────────────────────────────────────────────────
  {
    fabricante: 'Canadian Solar',
    aliases: ['canadian solar', 'canadiansolar'],
    modelos: [/\b(CS\d[A-Z]{1,2}-\d{3,4}\w*)\b/i],  // CS6W-550MS, CS7N-660MB-AG
  },
  {
    fabricante: 'Jinko Solar',
    aliases: ['jinko', 'jinko solar'],
    modelos: [/\b(JKM\d{3,4}[A-Z]+-\d+\w*)\b/i],    // JKM550M-7RL4-V
  },
  {
    fabricante: 'Trina Solar',
    aliases: ['trina', 'trina solar', 'trinasolar'],
    modelos: [/\b(TSM-\w*\d{3,4}\w*)\b/i],          // TSM-DE21-665
  },
  {
    fabricante: 'JA Solar',
    aliases: ['ja solar', 'jasolar'],
    modelos: [/\b(JAM\d{2}[A-Z]\d{2,3}-\d{3,4}\w*)\b/i],
  },
  {
    fabricante: 'LONGi',
    aliases: ['longi', 'longi solar'],
    modelos: [/\b(LR\d-\d{2,3}\w*-\d{3,4}\w*)\b/i],  // LR5-72HPH-545M
  },
  {
    fabricante: 'Risen',
    aliases: ['risen energy', 'risen'],
    modelos: [/\b(RSM\d{2,3}-\d-\d{3,4}\w*)\b/i],
  },
  {
    fabricante: 'BYD',
    aliases: ['byd'],
    modelos: [/\b(B-Box\s*\w*|Battery-Box\s*\w*)\b/i],
  },
  // ── Carregadores EV (EV-ALIGN-01) ─────────────────────────────────────
  {
    fabricante: 'Wallbox',
    aliases: ['wallbox', 'wallbox chargers'],
    modelos: [/\b(Pulsar\s*\w*|Commander\s*\w*|Copper\s*\w*|Quasar\s*\w*)\b/i],
  },
  {
    fabricante: 'Intelbras',
    aliases: ['intelbras'],
    modelos: [/\b(EVE\s*\w*|EWS\s*\w*|EVB\s*\d+\w*)\b/i],
  },
  {
    fabricante: 'EMOBI',
    aliases: ['emobi', 'e-mobi'],
    modelos: [/\b(EMOBI-?\w+|EM[A-Z]\d+\w*)\b/i],
  },
  {
    fabricante: 'Belenergy',
    aliases: ['belenergy', 'bel energy'],
    modelos: [/\b(BEL-?\w+|BLN-?\w+)\b/i],
  },
  {
    fabricante: 'Schneider Electric',
    aliases: ['schneider electric', 'schneider'],
    modelos: [/\b(EVlink\s*\w*|EVB1A\w*|EVH\w*)\b/i],
  },
  {
    fabricante: 'ABB EV',  // ABB Terra (carregadores)
    aliases: ['abb terra', 'terra ac', 'terra dc'],
    modelos: [/\b(Terra\s*(?:AC|DC|HP)?\s*\w*)\b/i],
  },
  {
    fabricante: 'WEG',
    aliases: ['weg wmo', 'weg wallbox', 'weg charging'],
    modelos: [/\b(WMO\s*\w*|WEMC\s*\w*)\b/i],
  },
  {
    fabricante: 'Tesla EV',
    aliases: ['tesla wall connector', 'wall connector'],
    modelos: [/\b(Wall\s*Connector\s*\w*|Mobile\s*Connector\s*\w*)\b/i],
  },
]

// CAT-KB-01: aliases de fabricante extra vindos da Base de Conhecimento (Mongo).
// Injeção inerte por padrão → quando vazio, comportamento idêntico ao atual.
let _aliasExtra = () => []
/** Liga aliases de fabricante extra (KB). Reversível. */
export function setAliasFabricanteExtra(fn) { _aliasExtra = (typeof fn === 'function') ? fn : (() => []) }
/** Catálogo de aliases de fabricante migrável para a KB (seed). */
export const ALIASES_FABRICANTE = PADROES.map(p => ({ fabricante: p.fabricante, aliases: p.aliases }))

// Normaliza texto: case-fold + remove acentos + colapsa espaços
function _norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ')
}

// BUG-08: tokens de MODELO GENÉRICO de inversor. Conservadores: exigem prefixo
// alfabético (2-5 letras) + número de potência + sufixo técnico (K/TL/dígito).
// Usados APENAS quando o fabricante já foi identificado por alias — reduz o
// risco de falso-positivo e dá extensibilidade a séries ainda não catalogadas.
const _MODELO_GENERICO_INVERSOR = [
  /\b([A-Z]{2,5}[- ]?\d{1,4}K(?:TL)?\d?-?[A-Z]{0,3}\d?(?:-[A-Z0-9]+){0,2})\b/, // MID25KTL3-X, SUN-75K-G
  /\b([A-Z]{2,5}[- ]?\d{3,5}-?[A-Z]{1,3}\d?(?:-[A-Z0-9]+){0,2})\b/,            // GW5000-NS
]
function _extrairModeloGenerico(texto) {
  for (const re of _MODELO_GENERICO_INVERSOR) {
    const m = texto.match(re)
    if (m) return (m[1] || m[0]).replace(/\s+/g, '').toUpperCase()
  }
  return null
}

/**
 * Tenta extrair fabricante + modelo do texto bruto do PDF.
 *
 * @param {string} texto  texto extraído por OCR/pdf-parse
 * @returns {{fabricante: ?string, modelo: ?string, confianca: number, evidencia: ?string, padrao_usado: ?string}}
 */
export function extrairFabricanteModelo(texto) {
  if (!texto || typeof texto !== 'string' || texto.trim().length < 5) {
    return { fabricante: null, modelo: null, confianca: 0, evidencia: null, padrao_usado: null }
  }
  const tNorm = _norm(texto)

  for (const padrao of PADROES) {
    // 1) Procura fabricante por aliases
    const aliasEncontrado = padrao.aliases.find(a => tNorm.includes(_norm(a)))
    if (!aliasEncontrado) continue

    // 2) Procura modelo no texto ORIGINAL (para preservar caixa)
    for (const regex of padrao.modelos) {
      const m = texto.match(regex)
      if (m) {
        // Normaliza espaços do modelo (MIC 1000TL-X → MIC1000TL-X é OK)
        const modeloRaw = (m[1] || m[0]).replace(/\s+/g, '').toUpperCase()
        return {
          fabricante: padrao.fabricante,
          modelo: modeloRaw,
          confianca: 0.85,
          evidencia: `alias "${aliasEncontrado}" + modelo /${regex.source}/`,
          padrao_usado: padrao.fabricante.toLowerCase(),
        }
      }
    }

    // BUG-08: fabricante achado mas nenhuma regex específica casou. Em vez de
    // desistir, tenta um token de MODELO GENÉRICO (extensível p/ séries novas).
    // Como o fabricante já é conhecido, um match genérico é seguro o bastante.
    const generico = _extrairModeloGenerico(texto)
    if (generico) {
      return {
        fabricante: padrao.fabricante,
        modelo: generico,
        confianca: 0.6,
        evidencia: `alias "${aliasEncontrado}" + modelo genérico`,
        padrao_usado: `${padrao.fabricante.toLowerCase()}_generico`,
      }
    }

    // Fabricante achado mas modelo não — devolve só o fabricante (parcial)
    return {
      fabricante: padrao.fabricante,
      modelo: null,
      confianca: 0.5,
      evidencia: `alias "${aliasEncontrado}" (modelo não casou regex)`,
      padrao_usado: padrao.fabricante.toLowerCase(),
    }
  }

  // Nenhum padrão casou. Última tentativa: procura modelos isolados (ex.: SUN-30K-G04 em PDF sem marca textual)
  const modelosOrfaos = [
    // S8.6.2: SUN-23-30K-G04-LV (faixa de potência no nome — caso real reportado)
    { regex: /\b(SUN-?\d{1,3}-?\d{0,3}K[\w-]*)\b/i, fabricante: 'Deye' },
    { regex: /\b(RHI-\d{1,3}K[\w-]*)\b/i,           fabricante: 'Solis' },
    { regex: /\b(MIC\s*\d{3,5}TL-X)\b/i,            fabricante: 'Growatt' },
    { regex: /\b(MID\s*\d{1,3}KTL3[\w-]*)\b/i,      fabricante: 'Growatt' }, // BUG-08
    { regex: /\b(MAX\s*\d{1,3}KTL3[\w-]*)\b/i,      fabricante: 'Growatt' },
    { regex: /\b(GW\d{2,5}[A-Z]+-?[A-Z0-9]*)\b/i,   fabricante: 'Goodwe' },  // BUG-08
    { regex: /\b(SE\d{3,6}[A-Z]?-?[A-Z0-9]*)\b/i,   fabricante: 'SolarEdge' }, // BUG-08
    { regex: /\b(ASW\s*\d{3,5}[A-Z]?-?[A-Z0-9]*)\b/i, fabricante: 'Solplanet' },
  ]
  for (const { regex, fabricante } of modelosOrfaos) {
    const m = texto.match(regex)
    if (m) {
      return {
        fabricante,
        modelo: (m[1] || m[0]).replace(/\s+/g, '').toUpperCase(),
        confianca: 0.65,
        evidencia: `modelo órfão (sem alias de fabricante)`,
        padrao_usado: `orfao_${fabricante.toLowerCase()}`,
      }
    }
  }

  // CAT-KB-01: último recurso — aliases de fabricante aprendidos na KB (Mongo).
  // Inerte enquanto a KB só contém o seed (mesmos aliases do PADROES acima).
  let extra = []
  try { extra = _aliasExtra() || [] } catch { extra = [] }
  for (const { alias, fabricante } of extra) {
    if (alias && tNorm.includes(_norm(alias))) {
      const generico = _extrairModeloGenerico(texto)
      return {
        fabricante,
        modelo: generico,
        confianca: generico ? 0.55 : 0.45,
        evidencia: `alias "${alias}" (Base de Conhecimento)`,
        padrao_usado: `kb_${String(fabricante).toLowerCase()}`,
      }
    }
  }

  return { fabricante: null, modelo: null, confianca: 0, evidencia: null, padrao_usado: null }
}

/**
 * Detecta se um valor de fabricante/modelo é um "default lixo" (Desconhecido/Inversor/Painel/null/'').
 * Usado para rejeitar persistência quando a IA falhou e o frontend tentou fallback.
 */
export function ehDefaultLixo(valor, campo = 'fabricante') {
  if (valor == null) return true
  const s = String(valor).trim()
  if (!s) return true
  const lixoComum = ['desconhecido', 'unknown', 'n/a', 'na', '-', '?', '???']
  const lixoCampo = {
    fabricante: [...lixoComum, 'fabricante'],
    modelo:     [...lixoComum, 'inversor', 'modulo', 'módulo', 'painel', 'painel solar', 'modelo', 'placa'],
  }
  return (lixoCampo[campo] || lixoComum).includes(s.toLowerCase())
}

/**
 * BUG-08 (FASE 3) — Normalização OBRIGATÓRIA da identificação de um equipamento.
 *
 * Consolida o que veio da IA (`dados`) com o fallback de regex sobre o texto
 * bruto, e GARANTE a presença de { tipo, fabricante, modelo } válidos — ou
 * informa exatamente quais campos faltam. Deve ser chamada ANTES de qualquer
 * POST: se `ok === false`, a requisição não deve ser enviada.
 *
 * @param {Object} dados        objeto retornado pela IA/parser ({fabricante, modelo, tipo, ...})
 * @param {string} textoBruto   texto OCR/PDF para fallback de regex
 * @param {string} [tipoPadrao] tipo a assumir quando ausente (ex.: 'inversor')
 * @returns {{ ok: boolean, tipo: ?string, fabricante: ?string, modelo: ?string,
 *            faltando: string[], aviso: ?string, recuperado: Object }}
 */
export function normalizarIdentificacao(dados = {}, textoBruto = '', tipoPadrao = null) {
  const tipo = dados.tipo || tipoPadrao || null
  let fabricante = ehDefaultLixo(dados.fabricante, 'fabricante') ? null : String(dados.fabricante).trim()
  let modelo     = ehDefaultLixo(dados.modelo, 'modelo')         ? null : String(dados.modelo).trim()

  const recuperado = {}
  let aviso = null

  // Fallback por regex no texto bruto quando fabricante e/ou modelo faltam.
  if ((!fabricante || !modelo) && textoBruto && String(textoBruto).trim().length >= 5) {
    const fb = extrairFabricanteModelo(textoBruto)
    if (!fabricante && fb.fabricante) {
      fabricante = fb.fabricante
      recuperado.fabricante = fb.fabricante
      aviso = `Fabricante recuperado por regex: ${fb.fabricante}`
    }
    if (!modelo && fb.modelo) {
      modelo = fb.modelo
      recuperado.modelo = fb.modelo
      aviso = aviso ? `${aviso}; modelo: ${fb.modelo}` : `Modelo recuperado por regex: ${fb.modelo}`
    }
  }

  const faltando = []
  if (!tipo)       faltando.push('tipo')
  if (!fabricante) faltando.push('fabricante')
  if (!modelo)     faltando.push('modelo')

  return { ok: faltando.length === 0, tipo, fabricante, modelo, faltando, aviso, recuperado }
}

// Exporta o catálogo para a UI mostrar quais fabricantes são reconhecidos.
export const FABRICANTES_RECONHECIDOS = PADROES.map(p => p.fabricante)
