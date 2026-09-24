import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { avaliarUtilizavel } from '@fortesolar/fv-shared/utilizavel-projeto'
import { avaliarUtilizavel as doFrontend } from '../../utils/utilizavelProjeto'
import { classificarCorrenteCC, STATUS_CORRENTE } from '@fortesolar/fv-shared/engenharia/classificacao-corrente-cc'
import { classificarTensaoCC, STATUS_TENSAO } from '@fortesolar/fv-shared/engenharia/classificacao-tensao-cc'

const { analisarCompatibilidade, STATUS_CRITERIO } =
  await import('../../../../backend/src/services/compatibilidadeEletricaService.js')

/**
 * F-06 — elegibilidade de inversor sem envelope de tensão.
 *
 * ── O defeito ───────────────────────────────────────────────────────────────
 * A matriz mínima do inversor exigia `potencia_kw` e `numero_mppt` — nada do
 * envelope de tensão. Seis inversores STRING do catálogo real (Growatt
 * MID15/20/25KTL3-X e Kehua SP13000/15000/16000-B2) não declaram
 * `tensao_max_entrada` nem faixa MPPT e mesmo assim estavam gravados com
 * `utilizavel_em_projeto: true` e `bloqueio_engenharia: []`.
 *
 * Sem esses campos o motor não tem como verificar sobretensão nem janela de
 * MPPT. Deixá-los passar como "liberados para engenharia" é afirmar que a
 * pergunta foi respondida quando ela nem pôde ser feita.
 *
 * ── Os quatro estados ───────────────────────────────────────────────────────
 *   CATALOGADO   existe no SSOT              — não muda
 *   SELECIONÁVEL aparece para consulta       — não muda
 *   UTILIZÁVEL   tem dado para o motor avaliar
 *   COMPATÍVEL   foi avaliado e não violou nada
 *
 * A regra decide o terceiro. O quarto continua sendo do motor.
 *
 * ── O que NÃO entrou na matriz ──────────────────────────────────────────────
 * `corrente_isc_max` e `oversizing_max`: a F1 e a F2 decidiram que a ausência
 * deles vira `nao_avaliado` no critério, e a análise segue. Exigi-los aqui
 * trocaria um veredito honesto por um bloqueio e barraria metade do catálogo.
 */

const fonte = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** Solplanet ASW9100-S — envelope completo, como o catálogo o tem. */
const COMPLETO = {
  potencia_kw: 9.1, n_mppts: 3, fases: 1,
  tensao_max_entrada: 600, tensao_mppt_min: 80, tensao_mppt_max: 560,
  corrente_max_por_mppt: 20, corrente_isc_max: 28,
}
const CTX = { fabricante: 'Solplanet', modelo: 'ASW9100-S' }
/** Growatt MID15KTL3-X — string real, sem envelope de tensão. */
const SEM_ENVELOPE = { potencia_kw: 15, n_mppts: 2, corrente_max_por_mppt: 32 }
const CTX_MID = { fabricante: 'Growatt', modelo: 'MID15KTL3-X' }

const MODULO = { voc: 53.26, vmpp: 45.06, isc: 13.83, impp: 13, potencia_w: 585, coef_temp_voc: -0.25 }
const CLIMA = { temperatura_min_historica_c: 18, temperatura_max_historica_c: 38 }

// ── Casos 1 a 5 ─────────────────────────────────────────────────────────────

describe('F-06 · dado mínimo para a engenharia avaliar', () => {
  it('1. inversor completo é utilizável e avaliável', () => {
    const av = avaliarUtilizavel('inversor', COMPLETO, CTX)
    expect(av.utilizavel).toBe(true)
    expect(av.faltando).toEqual([])
    expect(av.topologia).toBe('STRING')
  })

  it('2. sem `tensao_max_entrada` não é utilizável — e o motivo é nomeado', () => {
    const av = avaliarUtilizavel('inversor', { ...COMPLETO, tensao_max_entrada: null }, CTX)
    expect(av.utilizavel).toBe(false)
    expect(av.faltando).toContain('tensao_max_entrada')
  })

  it('3. sem faixa MPPT não é utilizável', () => {
    const av = avaliarUtilizavel('inversor',
      { ...COMPLETO, tensao_mppt_min: null, tensao_mppt_max: null }, CTX)
    expect(av.utilizavel).toBe(false)
    expect(av.faltando).toEqual(expect.arrayContaining(['tensao_mppt_min', 'tensao_mppt_max']))
  })

  it('4. o caso real: Growatt MID15KTL3-X é bloqueado pelos três campos', () => {
    const av = avaliarUtilizavel('inversor', SEM_ENVELOPE, CTX_MID)
    expect(av.utilizavel).toBe(false)
    expect(av.faltando).toEqual(['tensao_max_entrada', 'tensao_mppt_min', 'tensao_mppt_max'])
  })

  it('5. ausência de limite de curto ou de oversizing NÃO bloqueia (F1/F2)', () => {
    const semIsc = avaliarUtilizavel('inversor', { ...COMPLETO, corrente_isc_max: null }, CTX)
    expect(semIsc.utilizavel).toBe(true)
    const semOvr = avaliarUtilizavel('inversor', { ...COMPLETO, oversizing_max: null }, CTX)
    expect(semOvr.utilizavel).toBe(true)
  })
})

// ── Micro tem matriz própria ────────────────────────────────────────────────

describe('F-06 · microinversor não herda a matriz de string', () => {
  it('6. micro sem faixa MPPT continua utilizável — motor próprio', () => {
    const micro = { potencia_kw: 2.25, n_mppts: 4, tipo_topologia: 'MICRO' }
    const av = avaliarUtilizavel('inversor', micro, { fabricante: 'Hoymiles', modelo: 'HMS-2250DW-4T' })
    expect(av.topologia).toBe('MICRO')
    expect(av.utilizavel).toBe(true)
  })

  it('7. micro sem potência continua bloqueado, como já era', () => {
    const av = avaliarUtilizavel('inversor', { n_mppts: 4, tipo_topologia: 'MICRO' },
      { fabricante: 'Hoymiles', modelo: 'HMS-1600DW-4T' })
    expect(av.utilizavel).toBe(false)
    expect(av.faltando).toContain('potencia_kw')
  })
})

// ── Ausência × incompatibilidade ────────────────────────────────────────────

describe('F-06 · ausência de dado não é compatibilidade', () => {
  const analisar = (inv) => analisarCompatibilidade({
    dados_eletricos_modulo: MODULO, dados_eletricos_inversor: inv,
    arranjo_proposto: { quantidade_modulos_por_string: 7, quantidade_strings_paralelo: 2, num_mppt_usados: 1 },
    dados_climaticos_regiao: CLIMA,
  })

  it('8. sem envelope, a tensão fica `nao_avaliado` — nunca `ok`', () => {
    const t = classificarTensaoCC({
      voc: MODULO.voc, vmpp: MODULO.vmpp, coefTempVoc: MODULO.coef_temp_voc, modulosPorString: 7,
      tensaoMaxEntrada: null, mpptMin: null, mpptMax: null, tMin: 18, tMax: 38,
    })
    expect(t.voc.status).toBe(STATUS_TENSAO.NAO_AVALIADO)
    expect(t.mppt_min.status).toBe(STATUS_TENSAO.NAO_AVALIADO)
    expect(t.mppt_max.status).toBe(STATUS_TENSAO.NAO_AVALIADO)
    expect(t.status).not.toBe(STATUS_TENSAO.OK)
    expect(t.status).not.toBe(STATUS_TENSAO.INCOMPATIVEL)
  })

  it('9. sem limite de curto, o critério fica `nao_avaliado` (F1 intacta)', () => {
    const c = classificarCorrenteCC({ isc: 13.83, impp: 13, strings: 2, limiteTrabalho: 20, limiteCurto: null })
    expect(c.curto_circuito.status).toBe(STATUS_CORRENTE.NAO_AVALIADO)
  })

  it('10. incompatibilidade comprovada continua `incompativel`', () => {
    // Envelope completo e violação real: 12 módulos em série passam de 600 V.
    const r = analisarCompatibilidade({
      dados_eletricos_modulo: MODULO,
      dados_eletricos_inversor: { tensao_max_entrada: 600, mppt_min: 80, mppt_max: 560,
        corrente_max_mppt: 20, corrente_isc_max_mppt: 28, potencia_ca_kw: 9.1 },
      arranjo_proposto: { quantidade_modulos_por_string: 12, quantidade_strings_paralelo: 1, num_mppt_usados: 1 },
      dados_climaticos_regiao: CLIMA,
    })
    expect(r.compativel).toBe(false)
    expect(r.erros.map((e) => e.codigo)).toContain('SOBRETENSAO_VOC')
  })

  it('10b. inversor sem envelope: lacuna declarada, NÃO `INPUT_INVALIDO`', () => {
    // Antes, a falta de `tensao_max_entrada`/faixa MPPT reprovava a entrada e
    // devolvia `compativel: false` — ausência de cadastro apresentada como
    // INCOMPATIBILIDADE, afirmação de engenharia que ninguém fez. A F3 já
    // tinha corrigido o equivalente no módulo (`coef_temp_voc`).
    const r = analisar({ corrente_max_mppt: 32, potencia_ca_kw: 15 })
    expect(r.erros.map((e) => e.codigo)).not.toContain('INPUT_INVALIDO')
    expect(r.nao_avaliados.map((n) => n.criterio)).toContain('tensao_cc')
    // e o que PODE ser avaliado continua sendo
    expect(r.calculos.potencia_cc_total).toBeCloseTo(8.19, 2)
  })

  it('11. e o arranjo válido continua compatível — nada endureceu demais', () => {
    const r = analisar({ tensao_max_entrada: 600, mppt_min: 80, mppt_max: 560,
      corrente_max_mppt: 20, corrente_isc_max_mppt: 28, potencia_ca_kw: 9.1 })
    expect(r.compativel).toBe(true)
    expect([STATUS_CRITERIO.OK, STATUS_CRITERIO.OK_PARCIAL, STATUS_CRITERIO.ATENCAO])
      .toContain(r.status)
  })
})

// ── Guards ──────────────────────────────────────────────────────────────────

describe('F-06 · guards', () => {
  const REGRA = semComentarios(fonte('../../../../packages/fv-shared/equipamentos/utilizavelProjeto.js'))
  const ROTA  = semComentarios(fonte('../../../../backend/src/routes/equipamentos.js'))

  it('12. GUARD 1 · a matriz de string exige o envelope que o motor consome', () => {
    for (const campo of ['tensao_max_entrada', 'tensao_mppt_min', 'tensao_mppt_max', 'corrente_max_por_mppt']) {
      expect(REGRA, campo).toMatch(new RegExp(`'${campo}'`))
    }
  })

  it('13. GUARD 5 · a regra não completa envelope nenhum', () => {
    // Nenhum `?? <número>`: ausência permanece ausência.
    expect(REGRA).not.toMatch(/\?\?\s*\d/)
    expect(REGRA).not.toMatch(/tensao_max_entrada[^\n]*\|\|\s*\d/)
  })

  it('14. GUARD 2/3 · `corrente_isc_max` e `oversizing_max` ficam fora da matriz', () => {
    // Se entrassem, um `nao_avaliado` legítimo viraria bloqueio.
    const matriz = REGRA.slice(REGRA.indexOf('INVERSOR_COMUM'), REGRA.indexOf('const REGRAS'))
    expect(matriz).not.toMatch(/corrente_isc_max/)
    expect(matriz).not.toMatch(/oversizing_max/)
  })

  it('15. GUARD 4/6 · a leitura só ENDURECE, nunca libera o que foi bloqueado', () => {
    expect(ROTA).toMatch(/avaliarUtilizavel/)
    expect(ROTA).toMatch(/if \(av\.utilizavel\) return eq/)
    expect(ROTA).toMatch(/utilizavel_em_projeto:\s*false/)
    // e o bloqueio traz o motivo junto
    expect(ROTA).toMatch(/bloqueio_engenharia/)
  })

  it('16. GUARD · existe UMA matriz, e os dois lados a consomem', () => {
    const BACK  = semComentarios(fonte('../../../../backend/src/services/utilizavelProjeto.js'))
    const FRONT = semComentarios(fonte('../../utils/utilizavelProjeto.js'))
    for (const [nome, src] of [['backend', BACK], ['frontend', FRONT]]) {
      expect(src, nome).toMatch(/from '@fortesolar\/fv-shared\/utilizavel-projeto'/)
      expect(src, nome).not.toMatch(/const REGRAS/)
    }
    // e as duas importações devolvem a MESMA função
    expect(doFrontend).toBe(avaliarUtilizavel)
  })

  it('17. GUARD · o veredito é idêntico dos dois lados, no caso real', () => {
    const a = avaliarUtilizavel('inversor', SEM_ENVELOPE, CTX_MID)
    const b = doFrontend('inversor', SEM_ENVELOPE, CTX_MID)
    expect(b).toEqual(a)
    expect(b.utilizavel).toBe(false)
  })
})
