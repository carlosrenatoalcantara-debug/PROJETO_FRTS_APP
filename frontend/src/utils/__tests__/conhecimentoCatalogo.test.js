import { describe, it, expect, afterEach } from 'vitest'
import {
  extrairSpecsTecnicas, setRotulosExtra, ROTULOS_BASE,
} from '../../../../backend/src/ai/parserTecnicoInversor.js'
import {
  extrairFabricanteModelo, setAliasFabricanteExtra, ALIASES_FABRICANTE,
} from '../../../../backend/src/utils/catalogo/fabricanteModeloFallback.js'
import {
  construirDocumentosSeed, DICIONARIO,
} from '../../../../backend/src/ai/conhecimentoCatalogo.js'

/**
 * CAT-KB-01 — migração do conhecimento hardcoded → Base de Conhecimento (Mongo).
 *
 * Prova, SEM Mongo, que:
 *  (1) o seed cobre todo o conhecimento hardcoded (rótulos + nomenclatura + fabricantes);
 *  (2) carregar a KB no parser NÃO altera o resultado (0 regressão) — Goodwe/Solis/Solplanet;
 *  (3) o FALLBACK (KB desligada) restaura o comportamento idêntico ao atual.
 */

// ── Datasheets reais (tabelas linearizadas) ──────────────────────────────────
const OCR_GOODWE = `
GoodWe GW17K-DT GW20K-DT GW25K-DT
Dual-MPPT, Three-Phase 17KW 20KW 25KW
Max. DC Input Voltage (V)* 1000 1000 1000
MPPT Range (V) 260~850 260~850 260~850
No. of MPPT 2 2 2
Strings per MPPT 2 2 2
Max. Input Current (A) 22/22 22/22 27/27
Max. Short Current (A) 27.5 27.5 33.8
Rated AC Output Power (W) 17000 20000 25000
Max. AC Output Power (W) 18700 22000 27500
Rated Grid Voltage (V) 380/400
Max. AC Output Current (A) 27.5 32.5 40.5
Max. Efficiency 98.6%
European Efficiency 98.3%
Operating Temperature Range (°C) -25~60
Weight (kg) 39 39 40
Dimension (WxHxD mm) 415x511x178
Protection Degree IP65
Warranty 10 years (standard)
Certificate IEC 62109, IEC 61727, NBR 16149
`
const OCR_SOLIS = `
Solis S5-GR3P10K
Max. Input Voltage (V) 1000
MPPT Voltage Range (V) 90~850
No. of MPPT 2
Max. Input Current (A) 13/13
Rated Output Power (W) 10000
Max. Output Power (W) 11000
Rated Grid Voltage (V) 380/400
Max. Output Current (A) 16.1
Max. Efficiency 98.7%
Operating Temperature Range (°C) -25~60
Weight (kg) 18.5
Protection Degree IP66
Warranty 5 years
`
const OCR_SOLPLANET = `
Solplanet ASW15K-LT-G2
Max. DC Input Voltage (V) 1000
MPPT Range (V) 200~850
Number of MPPT 2
Max. Input Current (A) 26
Rated AC Output Power (W) 15000
Max. AC Output Power (W) 16500
Rated Grid Voltage (V) 380
Max. AC Output Current (A) 24.2
Max. Efficiency 98.3%
Weight (kg) 19
Protection Degree IP66
Warranty 10 years
`

// Simula a carga da KB (Mongo) a partir do seed → injeta no parser/fallback.
function ligarKB() {
  const { aliases } = construirDocumentosSeed()
  const rotulos = new Map()
  const fabricantes = []
  for (const a of aliases) {
    if (a.tipo === 'rotulo') {
      const arr = rotulos.get(a.campo_canonico) || []
      arr.push(a.alias_original)
      rotulos.set(a.campo_canonico, arr)
    } else if (a.tipo === 'fabricante') {
      fabricantes.push({ alias: a.alias_original, fabricante: a.fabricante })
    }
  }
  setRotulosExtra((campo) => rotulos.get(campo) || [])
  setAliasFabricanteExtra(() => fabricantes)
}
function desligarKB() {
  setRotulosExtra(() => [])
  setAliasFabricanteExtra(() => [])
}

afterEach(() => desligarKB()) // garante fallback entre testes

describe('seed cobre o conhecimento hardcoded', () => {
  const { dicionario, aliases } = construirDocumentosSeed()

  it('dicionário canônico tem 23 campos', () => {
    expect(dicionario).toBe(DICIONARIO)
    expect(dicionario.length).toBe(23)
  })

  it('migra TODOS os rótulos do parser (1 alias por padrão de ROTULOS_BASE)', () => {
    const totalRotulosBase = Object.values(ROTULOS_BASE).reduce((n, arr) => n + arr.length, 0)
    const rotulosSeed = aliases.filter(a => a.tipo === 'rotulo')
    expect(rotulosSeed.length).toBe(totalRotulosBase)
  })

  it('migra TODOS os aliases de fabricante do código', () => {
    const totalFab = ALIASES_FABRICANTE.reduce((n, f) => n + f.aliases.length, 0)
    const fabSeed = aliases.filter(a => a.tipo === 'fabricante')
    expect(fabSeed.length).toBe(totalFab)
  })

  it('inclui nomenclatura IA e ≥130 aliases no total', () => {
    expect(aliases.filter(a => a.tipo === 'nomenclatura').length).toBeGreaterThan(0)
    expect(aliases.length).toBeGreaterThanOrEqual(130)
  })

  it('todo alias tem alias_normalizado e origem seed', () => {
    expect(aliases.every(a => a.alias_normalizado && a.origem === 'seed')).toBe(true)
  })
})

describe('0 regressão: parser idêntico com KB ligada/desligada', () => {
  for (const [nome, ocr, modelo] of [
    ['Goodwe', OCR_GOODWE, 'GW17K-DT'],
    ['Solis', OCR_SOLIS, 'S5-GR3P10K'],
    ['Solplanet', OCR_SOLPLANET, 'ASW15K-LT-G2'],
  ]) {
    it(`${nome}: mesmas especificações antes/depois da migração`, () => {
      desligarKB()
      const antes = extrairSpecsTecnicas(ocr, modelo)   // parser hardcoded (atual)
      ligarKB()
      const depois = extrairSpecsTecnicas(ocr, modelo)  // parser + KB (Mongo simulado)
      expect(depois).toEqual(antes)                     // ZERO divergência
      expect(Object.keys(antes).length).toBeGreaterThanOrEqual(8)
    })
  }
})

describe('FALLBACK: KB desligada = comportamento atual', () => {
  it('parser opera sem KB (rótulos extra = [])', () => {
    desligarKB()
    const esp = extrairSpecsTecnicas(OCR_GOODWE, 'GW17K-DT')
    expect(esp.eficiencia_maxima).toBe(98.6)
    expect(esp.tensao_max_entrada).toBe(1000)
    expect(esp.n_mppts).toBe(2)
  })

  it('fallback de fabricante inerte: Goodwe igual com/sem KB', () => {
    desligarKB()
    const antes = extrairFabricanteModelo(OCR_GOODWE)
    ligarKB()
    const depois = extrairFabricanteModelo(OCR_GOODWE)
    expect(depois.fabricante).toBe(antes.fabricante)
    expect(depois.modelo).toBe(antes.modelo)
  })
})
