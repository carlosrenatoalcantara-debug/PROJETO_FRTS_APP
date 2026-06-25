// P1-EV-OCR-PHASE-DETECTION-FIX-01 — certificação da detecção genérica de fases.
// Run: node backend/scripts/test-phase-detection.mjs
import { detectarTipoFases } from '../src/controllers/carregadorEVControllerGemini.js'
const casos = [
  { nome: 'BelEnergy CVBE-MO-220V-7 (multi-variante: doc mono E tri)', texto: 'CVBE-MO-220V-7 MONOFÁSICO 220V 7.4KW\nCVBE-TR-380V-11 TRIFÁSICO 380V 11KW\nTYPE 2 IEC 61851', modelo: 'CVBE-MO-220V-7', v: null, esperado: { tipo: 'AC_Mono', numero_fases: 1 } },
  { nome: 'Intelbras EVE 0074B (mono)', texto: 'INTELBRAS EVE 0074B MONOFÁSICO 7.4KW TYPE 2', modelo: 'EVE 0074B', v: 220, esperado: { tipo: 'AC_Mono', numero_fases: 1 } },
  { nome: 'Solplanet SOL7.4H (220V)', texto: 'SOLPLANET SOL7.4H WALLBOX 7.4KW TYPE 2 220V', modelo: 'SOL7.4H', v: 220, esperado: { tipo: 'AC_Mono', numero_fases: 1 } },
  { nome: 'Trifásico real', texto: 'WALLBOX 22KW TRIFÁSICO 380V THREE PHASE', modelo: 'XYZ-22K-400V', v: 380, esperado: { tipo: 'AC_Tri', numero_fases: 3 } },
  { nome: 'Multi-variante, modelo TRI', texto: 'CVBE-MO-220V-7 MONOFÁSICO\nCVBE-TR-380V-11 TRIFÁSICO', modelo: 'CVBE-TR-380V-11', v: null, esperado: { tipo: 'AC_Tri', numero_fases: 3 } },
  { nome: 'DC fast charger', texto: 'DC FAST CHARGER 60KW CCS2 DIRECT CURRENT OUTPUT', modelo: 'DC60', v: null, esperado: { tipo: 'DC', numero_fases: 3 } },
]
let ok = 0
for (const c of casos) {
  const r = detectarTipoFases(c.texto.toUpperCase(), c.modelo, c.v)
  const pass = r.tipo === c.esperado.tipo && r.numero_fases === c.esperado.numero_fases
  if (pass) ok++
  console.log(`${pass ? 'PASS' : 'FAIL'} ${c.nome} => ${r.tipo}/${r.numero_fases}`)
}
console.log(`${ok}/${casos.length} passaram`)
process.exit(ok === casos.length ? 0 : 1)
