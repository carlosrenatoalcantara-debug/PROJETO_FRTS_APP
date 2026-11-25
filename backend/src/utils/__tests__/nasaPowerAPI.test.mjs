/**
 * HSP da NASA POWER — regressão do bug de 2026-11-24 (toda consulta caía no
 * fallback de 0,36 kWh/m²·dia). Fixture: forma real da climatologia
 * ALLSKY_SFC_SW_DWN para coordenada genérica de Natal/RN (-5.79, -35.21).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hspDaClimatologia, obterIrradianciaLocal } from '../nasaPowerAPI.js'

const SERIE = {
  JAN: 6.0252, FEB: 6.0048, MAR: 5.8526, APR: 5.3328, MAY: 5.0983, JUN: 4.6265,
  JUL: 4.8898, AUG: 5.6959, SEP: 6.2856, OCT: 6.5422, NOV: 6.6058, DEC: 6.3281, ANN: 5.773,
}
const resposta = (serie) => ({ properties: { parameter: { ALLSKY_SFC_SW_DWN: serie } } })

test('usa o ANN da climatologia como HSP diário', () => {
  const r = hspDaClimatologia(resposta(SERIE))
  assert.equal(r.hsp_dia, 5.77)
  assert.equal(r.hsp_mensal.JAN, 6.03)
  assert.equal(r.hsp_mensal.JUN, 4.63)
})

test('hsp_anual é a soma ponderada pelos dias de cada mês', () => {
  const r = hspDaClimatologia(resposta(SERIE))
  // 31·6.0252 + 28·6.0048 + … + 31·6.3281
  assert.ok(Math.abs(r.hsp_anual - 2107.05) < 0.05, `hsp_anual=${r.hsp_anual}`)
})

test('ANN ausente: HSP diário = anual / 365', () => {
  const { ANN, ...semAnn } = SERIE
  const r = hspDaClimatologia(resposta(semAnn))
  assert.equal(r.hsp_dia, +(r.hsp_anual / 365).toFixed(2))
})

test('fill value -999 ou mês faltando invalida a resposta (não vira HSP)', () => {
  assert.equal(hspDaClimatologia(resposta({ ...SERIE, MAR: -999 })), null)
  const { JUL, ...semJul } = SERIE
  assert.equal(hspDaClimatologia(resposta(semJul)), null)
  assert.equal(hspDaClimatologia(resposta({ ...SERIE, OCT: '6.5' })), null)
})

test('forma antiga (properties.monthly / ALLSKY_KT) e vazio → null', () => {
  assert.equal(hspDaClimatologia({ properties: { monthly: { ALLSKY_KT: { 202301: 0.6 } } } }), null)
  assert.equal(hspDaClimatologia(null), null)
  assert.equal(hspDaClimatologia({}), null)
})

test('coordenada inválida não consulta a rede', async () => {
  assert.equal(await obterIrradianciaLocal(null, -35), null)
  assert.equal(await obterIrradianciaLocal('abc', -35), null)
})
