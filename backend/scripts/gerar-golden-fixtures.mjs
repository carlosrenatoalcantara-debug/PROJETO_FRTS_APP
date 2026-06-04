/**
 * gerar-golden-fixtures.mjs — P1-INV-HARDEN-01 (LOCAL-ONLY)
 * Lê os datasheets reais (máquina do operador) e congela os TOKENS posicionais
 * em fixtures JSON committáveis. O Golden Suite roda sobre os fixtures (CI-safe),
 * sem depender dos PDFs. Re-rode este script só ao adicionar/atualizar um PDF.
 */
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { PDFParse } from 'pdf-parse'
import { extrairTokensPosicionais } from '../src/ai/parserMatricial.js'
const D = 'C:/Users/Forte Solar/OneDrive/Área de Trabalho/PROJETO FORTE SOLAR APP/datasheets/inversor/'
const OUT = 'src/ai/__fixtures__/golden/'
const CASOS = [
  { id: 'sungrow_rt',  f: 'DS_20230228_SG5.0_6.0_7.0_8.0_10_12RT_Datasheet_V18_EN.pdf', fabricante: 'Sungrow', modo: 'matricial', modelos: ['SG5.0RT','SG6.0RT','SG7.0RT','SG8.0RT','SG10RT','SG12RT'] },
  { id: 'goodwe_ms',   f: 'Inversor Monofásico Goodwe 10 K.pdf', fabricante: 'GoodWe', modo: 'matricial', modelos: ['GW7000-MS-30','GW8500-MS-30','GW10K-MS-30'] },
  { id: 'goodwe_dt',   f: 'Datasheet - Goodwe GW20KT-DT.pdf', fabricante: 'GoodWe', modo: 'matricial', modelos: [] },
  { id: 'solplanet_7300', f: 'Datasheet_-_Solplanet_-_ASW7300-S.pdf', fabricante: 'Solplanet', modo: 'matricial', modelos: [] },
  { id: 'deye_2330',   f: 'datasheet_sun-23-30k-g04-lv_240809_pt.pdf', fabricante: 'Deye', modo: 'matricial', modelos: [] },
  { id: 'chint_60k',   f: 'Datasheet CHINT CPS SCA60KTL-T.EU.pdf', fabricante: 'Chint', modo: 'matricial', modelos: [] },
  { id: 'deye_lv',     f: 'datasheet_sun-23-30k-g04-lv_240809_pt.pdf', fabricante: 'Deye', modo: 'texto', modelo: 'SUN-23K-G04-LV' },
  { id: 'hopewind',    f: 'HSSP6K-G01 Hopewind-datasheet1.pdf', fabricante: 'Hopewind', modo: 'texto', modelo: 'HSSP6K-G01' },
  { id: 'tsun_mx3000d', f: 'Micro/Datasheet_GEN3-Microinverter-6-in-1-TSOL-MX3000D-Cabo-Tronco-WiFi-Brazil.pdf', fabricante: 'TSUN', modo: 'matricial', modelos: [] },
]
for (const c of CASOS) {
  const path = D + c.f
  if (!existsSync(path)) { console.log('SKIP (ausente):', c.id); continue }
  const buf = readFileSync(path)
  const fx = { id: c.id, fabricante: c.fabricante, modo: c.modo, modelos: c.modelos, modelo: c.modelo }
  if (c.modo === 'matricial') {
    // só os tokens da página de cabeçalho + região da tabela (reduz tamanho)
    const tokens = await extrairTokensPosicionais(buf)
    fx.tokens = tokens.map(t => ({ page: t.page, x: t.x, y: t.y, s: t.s }))
  } else {
    fx.texto = (await new PDFParse({ data: new Uint8Array(buf) }).getText()).text
  }
  writeFileSync(OUT + c.id + '.json', JSON.stringify(fx))
  console.log('OK', c.id, c.modo, fx.tokens ? `${fx.tokens.length} tokens` : `${fx.texto.length} chars`)
}
