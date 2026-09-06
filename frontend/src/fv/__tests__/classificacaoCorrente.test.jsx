import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { correnteDaEntrada, VEREDITO } from '@fortesolar/fv-shared/engenharia/corrente-micro'
import { FATOR_ISC_NBR16690 } from '@fortesolar/fv-shared/engenharia/normativa'
import { eletricoDoInversor, eletricoDoModulo, lacunasEletricas } from '../catalogo'

/**
 * Ajuste de compatibilidade de corrente — correção do falso bloqueio.
 *
 * O defeito: o motor comparava `Isc × 1,25` (corrente de PROJETO, NBR 16690
 * §5.2) contra `corrente_max_mppt` (corrente de TRABALHO) e REPROVAVA. São
 * grandezas diferentes, e o limite que de fato reprova é um terceiro campo,
 * `corrente_isc_max`, declarado à parte pelo fabricante.
 *
 * O que estes testes protegem:
 *  1. corrente de OPERAÇÃO acima do limite de trabalho é ATENÇÃO;
 *  2. corrente de CURTO acima do limite de curto é INCOMPATÍVEL;
 *  3. sem limite de curto, o critério é NÃO AVALIADO — o de trabalho não entra
 *     no lugar dele;
 *  4. sem Impp, Isc NÃO o substitui;
 *  5. o fator 1,25 continua calculado e continua NÃO decidindo compatibilidade;
 *  6. nenhuma regra elétrica foi reproduzida no frontend.
 *
 * A guarda de regressão do §11 está em `nunca reprova só por Isc × 1,25`.
 */

/** Ronma 585 W — valores REAIS lidos do catálogo de produção. */
const RONMA_585 = {
  voc: 53.26, vmpp: 45.06, isc: 13.83, impp: 13, potencia_w: 585, coef_temp_voc: -0.25,
}
/** Deye SUN2000G-US-220 — trabalho 13 A, sem `corrente_isc_max` declarada. */
const DEYE_REAL = {
  tensao_max_entrada: 60, mppt_min: 25, mppt_max: 55,
  corrente_max_mppt: 13, potencia_ca_kw: 2,
}
const CLIMA = { temperatura_min_historica_c: 10, temperatura_max_historica_c: 35 }
const ARRANJO = {
  quantidade_modulos_por_string: 1, quantidade_strings_paralelo: 1, num_mppt_usados: 1,
}

const fonte = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

// O motor canônico vive no backend; importado direto, sem cópia no frontend.
const { analisarCompatibilidade, STATUS_CRITERIO } =
  await import('../../../../backend/src/services/compatibilidadeEletricaService.js')

const analisar = (inv, mod = RONMA_585) => analisarCompatibilidade({
  dados_eletricos_modulo: mod,
  dados_eletricos_inversor: inv,
  arranjo_proposto: ARRANJO,
  dados_climaticos_regiao: CLIMA,
})

// ── §11.1–11.3 — as três classificações ─────────────────────────────────────

describe('classificação de corrente', () => {
  it('1. Impp dentro do limite de trabalho → OK', () => {
    const r = analisar({ ...DEYE_REAL, corrente_max_mppt: 20, corrente_isc_max_mppt: 25 })
    expect(r.compativel).toBe(true)
    // F2: o status GLOBAL é `ok_parcial`, não `ok` — a fixture é um inversor
    // real, e nenhum inversor real declara `oversizing_max`. O critério de
    // oversizing do fabricante fica `nao_avaliado`, e o global reflete isso.
    // Antes o motor assumia 1,30× e devolvia `ok` contra número inventado.
    expect(r.status).toBe(STATUS_CRITERIO.OK_PARCIAL)
    expect(r.nao_avaliados.map((n) => n.criterio)).toContain('oversizing_fabricante')
    expect(r.avaliacao_corrente.operacao.status).toBe(STATUS_CRITERIO.OK)
    expect(r.avaliacao_corrente.curto_circuito.status).toBe(STATUS_CRITERIO.OK)
    expect(r.warnings.map((w) => w.codigo)).not.toContain('CORRENTE_IMPP_ELEVADA')
  })

  it('2. Impp acima do trabalho e Isc dentro do curto → ATENÇÃO, e continua compatível', () => {
    const r = analisar({ ...DEYE_REAL, corrente_max_mppt: 12, corrente_isc_max_mppt: 16.9 })
    expect(r.compativel).toBe(true)
    expect(r.status).toBe(STATUS_CRITERIO.ATENCAO)
    expect(r.avaliacao_corrente.operacao.status).toBe(STATUS_CRITERIO.ATENCAO)
    expect(r.avaliacao_corrente.curto_circuito.status).toBe(STATUS_CRITERIO.OK)
    expect(r.erros).toHaveLength(0)
    const aviso = r.warnings.find((w) => w.codigo === 'CORRENTE_IMPP_ELEVADA')
    expect(aviso.mensagem).toMatch(/não é impedimento elétrico/i)
    expect(aviso.valores.impp_total).toBe(13)
    expect(aviso.valores.corrente_max_mppt).toBe(12)
  })

  it('3. Isc acima do limite de curto → INCOMPATÍVEL', () => {
    const r = analisar({ ...DEYE_REAL, corrente_isc_max_mppt: 13 })
    expect(r.compativel).toBe(false)
    expect(r.status).toBe(STATUS_CRITERIO.INCOMPATIVEL)
    expect(r.avaliacao_corrente.curto_circuito.status).toBe(STATUS_CRITERIO.INCOMPATIVEL)
    const erro = r.erros.find((e) => e.codigo === 'CORRENTE_ISC_EXCEDIDA')
    expect(erro.mensagem).toMatch(/CURTO-CIRCUITO EXCEDIDA/)
    expect(erro.valores.isc_operacao).toBe(13.83)
    expect(erro.valores.corrente_isc_max_mppt).toBe(13)
    // A reprovação NÃO cita o limite de trabalho.
    expect(erro.valores.corrente_max_mppt).toBeUndefined()
  })

  it('4. sem limite de curto → NÃO AVALIADO, e não bloqueia', () => {
    const r = analisar(DEYE_REAL)
    expect(r.compativel).toBe(true)
    expect(r.avaliacao_corrente.curto_circuito.status).toBe(STATUS_CRITERIO.NAO_AVALIADO)
    expect(r.avaliacao_corrente.curto_circuito.limite_a).toBeNull()
    expect(r.nao_avaliados.map((n) => n.criterio)).toContain('corrente_curto_circuito')
    expect(r.nao_avaliados[0].motivo).toMatch(/NÃO é usada no lugar/i)
  })

  it('5. sem Impp: Isc não o substitui — o motor recusa a entrada', () => {
    const r = analisar({ ...DEYE_REAL, corrente_isc_max_mppt: 16.9 },
      { ...RONMA_585, impp: undefined })
    expect(r.compativel).toBe(false)
    expect(r.erros[0].codigo).toBe('INPUT_INVALIDO')
    // O que NÃO acontece: usar Isc como se fosse Impp.
    expect(r.calculos?.impp_total).toBeUndefined()
    // E no motor de micro, a ausência vira `nao_avaliado` nomeado.
    const m = correnteDaEntrada({ iscModulo: 13.83, limiteEntrada: 13, limiteCurto: 16.9 })
    expect(m.operacao.status).toBe(VEREDITO.NAO_AVALIADO)
    expect(m.operacao.corrente_a).toBeNull()
  })
})

// ── §11.6–11.8 — os casos reais ─────────────────────────────────────────────

describe('casos reais do catálogo', () => {
  it('6/7. Ronma 585 W + Deye real: ATENÇÃO, não INCOMPATÍVEL', () => {
    const r = analisar(DEYE_REAL)
    // Antes: Isc × 1,25 = 17,29 A > 13 A → CORRENTE_ISC_EXCEDIDA (crítico).
    expect(r.calculos.isc_total).toBe(17.288)
    expect(r.erros.map((e) => e.codigo)).not.toContain('CORRENTE_ISC_EXCEDIDA')
    expect(r.compativel).toBe(true)
    expect(r.status).toBe(STATUS_CRITERIO.ATENCAO)
    // Impp 13 A contra limite 13 A: não excede (igual não é maior).
    expect(r.avaliacao_corrente.operacao.status).toBe(STATUS_CRITERIO.OK)
    // A corrente de projeto continua reportada e continua sem decidir.
    expect(r.avaliacao_corrente.projeto_normativa.acima_do_trabalho).toBe(true)
    expect(r.avaliacao_corrente.projeto_normativa.decide_compatibilidade).toBe(false)
    expect(r.warnings.map((w) => w.codigo)).toContain('CORRENTE_PROJETO_ACIMA_DO_TRABALHO')
  })

  it('6b. Ronma 620 W (Impp 14,99 A) no mesmo Deye: ATENÇÃO de operação', () => {
    const RONMA_620 = { voc: 49.6, vmpp: 41.4, isc: 15.91, impp: 14.99, potencia_w: 620, coef_temp_voc: -0.25 }
    const r = analisar(DEYE_REAL, RONMA_620)
    expect(r.avaliacao_corrente.operacao.status).toBe(STATUS_CRITERIO.ATENCAO)
    expect(r.compativel).toBe(true)
  })

  it('8. micro com limite de curto superior ao de trabalho aceita o mesmo módulo', () => {
    // Kehua SP13000-B2, valores reais do catálogo: trabalho 13 A, curto 16,9 A.
    const r = analisar({ ...DEYE_REAL, corrente_max_mppt: 13, corrente_isc_max_mppt: 16.9 })
    expect(r.compativel).toBe(true)
    expect(r.avaliacao_corrente.curto_circuito.status).toBe(STATUS_CRITERIO.OK)
    expect(r.avaliacao_corrente.curto_circuito.margem_a).toBeCloseTo(3.07, 2)
  })

  it('9. ausência de dados não vira OK por omissão', () => {
    // Sem a corrente de trabalho, a validação de entrada recusa antes de
    // qualquer veredito — o que NÃO acontece é sair `ok`.
    const r = analisar({ ...DEYE_REAL, corrente_max_mppt: null })
    expect(r.compativel).toBe(false)
    expect(r.erros[0].codigo).toBe('INPUT_INVALIDO')
    expect(r.status).not.toBe(STATUS_CRITERIO.OK)
  })
})

// ── §11.10–11.12 — arquitetura, determinismo e guarda de regressão ──────────

describe('arquitetura e regressão', () => {
  it('10. nenhuma regra de corrente foi reproduzida no frontend', () => {
    for (const rel of [
      '../paginas/etapas/EtapaMppt.jsx',
      '../paginas/etapas/EtapaMicroinversores.jsx',
      '../catalogo.js',
      '../microinversores.js',
    ]) {
      const src = fonte(rel).replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, '$1')
      // Nenhuma comparação de corrente contra limite deste lado.
      expect(src, rel).not.toMatch(/isc\s*[*]\s*1\.25/i)
      expect(src, rel).not.toMatch(/corrente[^\n]*>\s*(limite|corrente_max)/i)
      expect(src, rel).not.toMatch(/1\.25/)
    }
  })

  it('11. determinístico: mesma entrada, mesmo veredito', () => {
    const a = analisar({ ...DEYE_REAL, corrente_isc_max_mppt: 13 })
    const b = analisar({ ...DEYE_REAL, corrente_isc_max_mppt: 13 })
    expect(JSON.stringify(a.avaliacao_corrente)).toBe(JSON.stringify(b.avaliacao_corrente))
    expect(a.status).toBe(b.status)
  })

  it('GUARDA — nunca reprovar só porque Isc × 1,25 passa da corrente de trabalho', () => {
    /**
     * Varredura: para qualquer módulo cuja corrente de projeto ultrapasse o
     * limite de TRABALHO mas cujo Isc esteja dentro do limite de CURTO, o
     * resultado tem de ser compatível. É a regressão que esta correção existe
     * para impedir.
     */
    for (const isc of [13.83, 13.62, 15.91, 12.1]) {
      const projeto = isc * FATOR_ISC_NBR16690
      const trabalho = isc - 0.5          // projeto sempre acima do trabalho
      const curto = isc + 3               // e Isc sempre dentro do curto
      expect(projeto).toBeGreaterThan(trabalho)
      const r = analisar({
        ...DEYE_REAL, corrente_max_mppt: trabalho, corrente_isc_max_mppt: curto,
      }, { ...RONMA_585, isc, impp: isc - 0.8 })
      expect(r.erros.map((e) => e.codigo), `isc=${isc}`).not.toContain('CORRENTE_ISC_EXCEDIDA')
      expect(r.compativel, `isc=${isc}`).toBe(true)
    }
  })

  it('o catálogo entrega os DOIS limites em parâmetros separados', () => {
    const eq = {
      _id: 'i1', tipo: 'inversor', fabricante: 'Kehua', modelo: 'SP13000-B2',
      especificacoes: {
        potencia_kw: 13, tensao_max_entrada: 1000, tensao_mppt_min: 200,
        tensao_mppt_max: 850, corrente_max_por_mppt: 13, corrente_isc_max: 16.9,
      },
    }
    const e = eletricoDoInversor(eq)
    expect(e.corrente_max_mppt).toBe(13)
    expect(e.corrente_isc_max_mppt).toBe(16.9)
    // O antigo `??` entre os dois campos não existe mais.
    expect(fonte('../catalogo.js')).not.toMatch(/corrente_isc_max\)\s*\?\?\s*num\(c\.corrente_max_por_mppt/)
  })

  it('a ausência do limite de curto NÃO vira lacuna que bloqueia a análise', () => {
    const semCurto = eletricoDoInversor({
      especificacoes: {
        potencia_kw: 2, tensao_max_entrada: 60, tensao_mppt_min: 25,
        tensao_mppt_max: 55, corrente_max_por_mppt: 13,
      },
    })
    expect(semCurto.corrente_isc_max_mppt).toBeNull()
    const mod = eletricoDoModulo({
      especificacoes: { potencia_wp: 585, voc: 53.26, vmp: 45.06, isc: 13.83, imp: 13, coef_temp_voc: -0.25 },
    })
    expect(lacunasEletricas(mod, semCurto)).not.toContain('inversor.corrente_isc_max_mppt')
  })
})
