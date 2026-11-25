/**
 * importacaoDatasheetMicro.check.js — caso BDM-2500 (2026-11-25).
 *
 * PDF de 15,3 MB virava "Erro 500" mudo, e a leitura de micro não trazia entradas.
 *
 *   node backend/src/dominio/__checks__/importacaoDatasheetMicro.check.js
 */
import http from 'node:http'
import crypto from 'node:crypto'
import express from 'express'
import * as mupdf from 'mupdf'
import { normalizarMulti, completarEntradasDoMicro } from '../../ai/normalizarMulti.js'
import { compactarPdf } from '../../ai/compactarPdf.js'
import { uploadDatasheet, LIMITE_DATASHEET_MB } from '../../middleware/uploadDatasheet.js'
import errorHandler from '../../middleware/errorHandler.js'

let falhas = 0
function ok(cond, nome) {
  if (!cond) falhas++
  console.log(`${cond ? '  ok   ' : '  FALHA'} ${nome}`)
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ── Entradas do micro ───────────────────────────────────────────────────────
const bdm = { modelo_variante: 'BDM-2500', potencia_nominal_kw: 2.5, tensao_max_entrada: 60, fases: 1, entradas: 6, n_mppts: 3, max_por_cabo_tronco: 3, potencia_modulo_max_w: 750 }
const ler = (variante, subtipo = 'microinversor', fabricante = 'NEP') =>
  normalizarMulti({ fabricante, modelo: variante.modelo_variante, tipo: 'inversor', subtipo, variantes: [variante] })[0]

{
  const { especificacoes: e, _meta } = ler(bdm)
  ok(e.entradas === 6 && e.modulos_por_entrada === 1, 'BDM-2500: 6 entradas de 1 módulo')
  ok(igual(e.entradas_por_mppt, [2, 2, 2]), 'BDM-2500: 3 MPPTs de 2 entradas')
  ok(e.max_por_cabo_tronco === 3 && e.potencia_modulo_max_w === 750, 'BDM-2500: 3 por ramal, módulo até 750 W')
  ok(_meta.status?.modulos_por_entrada === 'inferido_alta' && !_meta.status?.entradas, 'só o que foi deduzido é marcado como inferido')
}
{
  const { especificacoes: e, _meta } = ler({ modelo_variante: 'BDM-2250', potencia_nominal_kw: 2.25, tensao_max_entrada: 60, n_mppts: 4, strings_por_mppt: 1 })
  ok(e.entradas === 4 && _meta.status?.entradas === 'inferido_media', '4 MPPTs de 1 entrada: total somado e marcado')
}
{
  const { especificacoes: e } = ler({ ...bdm, n_mppts: 3, strings_por_mppt: 1 })
  ok(igual(e.entradas_por_mppt, [2, 2, 2]), 'total declarado vence "1 por MPPT" que não fecha com ele')
}
{
  const { especificacoes: e } = ler({ ...bdm, n_mppts: 4 })
  ok(e.entradas === 6 && e.entradas_por_mppt === undefined, '6 entradas em 4 MPPTs não se repartem: nada é inventado')
}
{
  const { especificacoes: e } = ler({ ...bdm, n_mppts: undefined, entradas: undefined })
  ok(e.entradas === undefined, 'sem entradas nem MPPTs declarados, continua vazio')
}
{
  const e = { n_mppts: 2, entradas: 2, modulos_por_entrada: 2, tensao_max_entrada: 60 }
  completarEntradasDoMicro(e)
  ok(e.modulos_por_entrada === 2, 'módulos por entrada declarado não é sobrescrito')
  const alta = { n_mppts: 2, entradas: 2, tensao_max_entrada: 120 }
  completarEntradasDoMicro(alta)
  ok(alta.modulos_por_entrada === undefined, 'entrada de 120 V aceita série: não deduz 1 módulo')
  const semV = { n_mppts: 2, entradas: 2 }
  completarEntradasDoMicro(semV)
  ok(semV.modulos_por_entrada === undefined, 'sem tensão máxima não deduz nada')
}
{
  const { especificacoes: e } = ler({ modelo_variante: 'MID25KTL3-X', potencia_nominal_kw: 25, tensao_max_entrada: 1100, n_mppts: 3, strings_por_mppt: '2/2/1' }, 'string', 'Growatt')
  ok(e.entradas === undefined && e.modulos_por_entrada === undefined, 'inversor string não ganha campos de micro')
}

// ── Compactação do PDF ──────────────────────────────────────────────────────
function pdfPesado(paginas, lado) {
  const doc = new mupdf.PDFDocument()
  for (let p = 0; p < paginas; p++) {
    const dados = doc.addStream(crypto.randomBytes(lado * lado * 3), {
      Type: 'XObject', Subtype: 'Image', Width: lado, Height: lado, ColorSpace: 'DeviceRGB', BitsPerComponent: 8,
    })
    const img = doc.addObject({ XObject: { I: dados } })
    doc.insertPage(-1, doc.addPage([0, 0, 595, 842], 0, img, 'q 595 0 0 842 0 0 cm /I Do Q'))
  }
  return Buffer.from(doc.saveToBuffer('').asUint8Array().slice())
}
{
  const grande = pdfPesado(2, 1500)
  const menor = await compactarPdf(grande)
  ok(grande.length > 10 * 1024 * 1024 && menor.length < 10 * 1024 * 1024, `PDF de ${(grande.length / 1048576).toFixed(1)} MB cai para ${(menor.length / 1048576).toFixed(1)} MB`)
  const lido = mupdf.Document.openDocument(menor, 'application/pdf')
  ok(lido.countPages() === 2 && igual(lido.loadPage(0).getBounds().map(Math.round), [0, 0, 595, 842]), 'mesmas páginas e mesmo formato')
  const pequeno = Buffer.from('%PDF-1.4 pequeno')
  ok(await compactarPdf(pequeno) === pequeno, 'PDF que já cabe não é tocado')
  const lixo = Buffer.alloc(11 * 1024 * 1024, 7)
  ok(await compactarPdf(lixo) === lixo, 'arquivo ilegível segue como veio, sem lançar')
  ok(await compactarPdf(null) === null, 'sem arquivo não lança')
}

// ── Upload ──────────────────────────────────────────────────────────────────
const app = express()
app.post('/pdf', uploadDatasheet(), (req, res) => res.json({ bytes: req.file?.size ?? null }))
app.post('/quebra', () => { throw new Error('segredo interno') })
app.use(errorHandler)
const servidor = http.createServer(app).listen(0)
const base = `http://127.0.0.1:${servidor.address().port}`
const enviar = async (bytes, campo = 'pdf') => {
  const fd = new FormData()
  fd.append(campo, new Blob([Buffer.alloc(bytes)], { type: 'application/pdf' }), 'a.pdf')
  const r = await fetch(`${base}/pdf`, { method: 'POST', body: fd })
  return { status: r.status, json: await r.json() }
}
{
  const cabe = await enviar(15274468)
  ok(cabe.status === 200 && cabe.json.bytes === 15274468, 'PDF de 15,3 MB é aceito')
  const passa = await enviar(LIMITE_DATASHEET_MB * 1024 * 1024 + 1)
  ok(passa.status === 413 && /25 MB/.test(passa.json.erro), 'acima do limite: 413 dizendo o tamanho')
  const campo = await enviar(10, 'outro')
  ok(campo.status === 400 && /"pdf"/.test(campo.json.erro), 'campo errado: 400 com o nome certo')
  const r = await fetch(`${base}/quebra`, { method: 'POST' })
  const j = await r.json()
  ok(r.status === 500 && j.ref && !/segredo/.test(JSON.stringify(j)), 'erro inesperado sai em JSON, com ref e sem detalhe interno')
}
servidor.closeAllConnections()
servidor.close()

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo ok')
process.exitCode = falhas ? 1 : 0
