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
    ],
  },
  {
    fabricante: 'Growatt',
    aliases: ['growatt'],
    modelos: [
      /\b(MIC\s*\d{3,5}TL-X)\b/i,                // MIC 750TL-X, MIC1000TL-X
      /\b(MIN\s*\d{3,5}TL-X\w*)\b/i,             // MIN 3000TL-XE
      /\b(MAX\s*\d{1,3}KTL3-?\w*)\b/i,           // MAX 50KTL3-XL
      /\b(MAC\s*\d{1,3}KTL3-?\w*)\b/i,           // MAC 50KTL3-XL
      /\b(MOD\s*\d{1,4}TL3-XH?\w*)\b/i,          // MOD 10KTL3-XH
      /\b(SPF\s*\d{3,5}\w*)\b/i,                 // SPF 5000ES
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
      /\b(GW\d{3,5}\w*)\b/i,                     // GW5000-NS, GW25K-MT
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
    aliases: ['abb ', 'fimer', 'power-one'],
    modelos: [
      /\b(PVS-?\d{1,3}-?\w*)\b/i,                // PVS-100-TL
      /\b(TRIO-?\d{1,3}\.\d+-?\w*)\b/i,          // TRIO-50.0-TL-OUTD
    ],
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

// Normaliza texto: case-fold + remove acentos + colapsa espaços
function _norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ')
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
    { regex: /\b(MAX\s*\d{1,3}KTL3[\w-]*)\b/i,      fabricante: 'Growatt' },
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

// Exporta o catálogo para a UI mostrar quais fabricantes são reconhecidos.
export const FABRICANTES_RECONHECIDOS = PADROES.map(p => p.fabricante)
