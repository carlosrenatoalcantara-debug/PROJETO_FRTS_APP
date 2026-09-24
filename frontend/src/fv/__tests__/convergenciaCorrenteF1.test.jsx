import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  classificarCorrenteCC, STATUS_CORRENTE,
} from '@fortesolar/fv-shared/engenharia/classificacao-corrente-cc'
import { dadosEletricosInversor } from '@fortesolar/fv-shared/engenharia/catalogo-eletrico'

/**
 * F1 — convergência do veredito de corrente.
 *
 * O defeito: o wizard legado reproduzia `correnteProjeto(...) > corrente_max_mppt`
 * em três lugares e reprovava. Depois que o motor foi corrigido, os dois passaram
 * a discordar sobre o mesmo módulo e o mesmo inversor.
 *
 * O que estes testes protegem:
 *  1. existe UMA classificação, e wizard, motor e otimizador a consomem;
 *  2. os quatro casos (A–D) dão o mesmo resultado no classificador e no motor;
 *  3. o wizard não voltou a comparar corrente por conta própria;
 *  4. o limite de curto entra pelo fallback do catálogo quando o cadastro o tem,
 *     e NUNCA é fabricado quando não tem.
 */

const fonte = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const WIZARD = '../../components/fv/ConfiguradorArranjoFV.jsx'

// Motor canônico — importado direto, sem cópia.
const { analisarCompatibilidade, STATUS_CRITERIO } =
  await import('../../../../backend/src/services/compatibilidadeEletricaService.js')

/** Módulo real do catálogo estático (Ronma 585 W tem os mesmos valores). */
const MODULO = { voc: 53.26, vmpp: 45.06, isc: 13.83, impp: 13, potencia_w: 585, coef_temp_voc: -0.25 }
const CLIMA = { temperatura_min_historica_c: 10, temperatura_max_historica_c: 35 }

/** Roda o motor com um agrupamento de 1 string — o mesmo que o classificador vê. */
const pelaMotor = (inv, strings = 1, mod = MODULO) => analisarCompatibilidade({
  dados_eletricos_modulo: mod,
  dados_eletricos_inversor: inv,
  arranjo_proposto: {
    quantidade_modulos_por_string: 9, quantidade_strings_paralelo: strings, num_mppt_usados: 1,
  },
  dados_climaticos_regiao: CLIMA,
})

const peloClassificador = (inv, strings = 1, mod = MODULO) => classificarCorrenteCC({
  isc: mod.isc, impp: mod.impp, strings,
  limiteTrabalho: inv.corrente_max_mppt, limiteCurto: inv.corrente_isc_max_mppt,
})

/** Solplanet ASW9100-S — valores REAIS: trabalho 20 A, curto 28 A. */
const BASE = { tensao_max_entrada: 600, mppt_min: 80, mppt_max: 560, potencia_ca_kw: 9.1 }

// ── Casos A–D, exigidos pela F1 ─────────────────────────────────────────────

describe('classificação de corrente — casos A a D', () => {
  it('A · ambos os limites presentes e folgados → ok', () => {
    const inv = { ...BASE, corrente_max_mppt: 20, corrente_isc_max_mppt: 28 }
    const c = peloClassificador(inv)
    expect(c.status).toBe(STATUS_CORRENTE.OK)
    expect(c.operacao.status).toBe(STATUS_CORRENTE.OK)
    expect(c.curto_circuito.status).toBe(STATUS_CORRENTE.OK)
    expect(c.projeto_normativa.acima_do_trabalho).toBe(false)
  })

  it('B · corrente de projeto acima do trabalho, Isc dentro do curto → atencao', () => {
    // Isc 13,83 × 1,25 = 17,29 A > 16 A de trabalho · Isc 13,83 A < 28 A de curto.
    const inv = { ...BASE, corrente_max_mppt: 16, corrente_isc_max_mppt: 28 }
    const c = peloClassificador(inv)
    expect(c.projeto_normativa.acima_do_trabalho).toBe(true)
    expect(c.curto_circuito.status).toBe(STATUS_CORRENTE.OK)
    expect(c.status).toBe(STATUS_CORRENTE.ATENCAO)
    // Nunca incompatível por este motivo.
    expect(c.status).not.toBe(STATUS_CORRENTE.INCOMPATIVEL)
  })

  it('C · Isc acima do limite de curto → incompativel, com CORRENTE_ISC_EXCEDIDA', () => {
    const inv = { ...BASE, corrente_max_mppt: 20, corrente_isc_max_mppt: 13 }
    const c = peloClassificador(inv)
    expect(c.status).toBe(STATUS_CORRENTE.INCOMPATIVEL)
    expect(c.curto_circuito.status).toBe(STATUS_CORRENTE.INCOMPATIVEL)

    const r = pelaMotor(inv)
    expect(r.compativel).toBe(false)
    expect(r.erros.map((e) => e.codigo)).toContain('CORRENTE_ISC_EXCEDIDA')
  })

  it('D · sem limite de curto → nao_avaliado, sem aprovação silenciosa', () => {
    const inv = { ...BASE, corrente_max_mppt: 20 }
    const c = peloClassificador(inv)
    expect(c.curto_circuito.status).toBe(STATUS_CORRENTE.NAO_AVALIADO)
    expect(c.curto_circuito.limite_a).toBeNull()
    expect(c.status).not.toBe(STATUS_CORRENTE.OK)
    expect(c.curto_circuito.motivo).toMatch(/NÃO é usada no lugar/i)
  })

  it('sem Impp, a operação não é avaliada — Isc não o substitui', () => {
    const c = classificarCorrenteCC({
      isc: 13.83, strings: 1, limiteTrabalho: 20, limiteCurto: 28,
    })
    expect(c.operacao.status).toBe(STATUS_CORRENTE.NAO_AVALIADO)
    expect(c.operacao.impp_total).toBeNull()
    expect(c.operacao.motivo).toMatch(/não substitui a de operação/i)
  })
})

// ── Convergência: motor e classificador dão o mesmo veredito ────────────────

describe('convergência entre motor e classificador', () => {
  const cenarios = [
    ['A · folgado',            { ...BASE, corrente_max_mppt: 20, corrente_isc_max_mppt: 28 }, 1],
    ['B · projeto acima',      { ...BASE, corrente_max_mppt: 16, corrente_isc_max_mppt: 28 }, 1],
    ['B2 · Impp acima',        { ...BASE, corrente_max_mppt: 20, corrente_isc_max_mppt: 28 }, 2],
    ['C · curto excedido',     { ...BASE, corrente_max_mppt: 20, corrente_isc_max_mppt: 13 }, 1],
    ['D · sem limite de curto',{ ...BASE, corrente_max_mppt: 20 },                            1],
  ]

  for (const [nome, inv, strings] of cenarios) {
    it(`${nome}: os dois lados concordam`, () => {
      const c = peloClassificador(inv, strings)
      const r = pelaMotor(inv, strings)

      // O motor expõe a mesma avaliação, campo a campo.
      expect(r.avaliacao_corrente.operacao.status).toBe(c.operacao.status)
      expect(r.avaliacao_corrente.curto_circuito.status).toBe(c.curto_circuito.status)
      expect(r.avaliacao_corrente.projeto_normativa.acima_do_trabalho)
        .toBe(c.projeto_normativa.acima_do_trabalho)

      // E o erro só existe quando o critério absoluto reprova.
      const reprovouPorCorrente = r.erros.some((e) => e.codigo === 'CORRENTE_ISC_EXCEDIDA')
      expect(reprovouPorCorrente).toBe(c.curto_circuito.status === STATUS_CORRENTE.INCOMPATIVEL)
    })
  }

  it('o vocabulário do motor e o do classificador são o mesmo', () => {
    for (const chave of ['OK', 'ATENCAO', 'INCOMPATIVEL', 'NAO_AVALIADO']) {
      expect(STATUS_CRITERIO[chave]).toBe(STATUS_CORRENTE[chave])
    }
  })
})

// ── Envelope do wizard: evidência, nunca invenção ───────────────────────────

describe('envelope do inversor no wizard', () => {
  it('o limite de curto entra pelo cadastro quando existe', () => {
    const env = dadosEletricosInversor({
      id: 'x-nao-esta-na-tabela-estatica',
      _eletrico: {
        tensao_max_entrada: 1000, corrente_max_mppt: 13, mppt_min: 200, mppt_max: 850,
        corrente_isc_max: 16.9, potencia_ca_kw: 13,
      },
    })
    expect(env.corrente_max_mppt).toBe(13)
    expect(env.corrente_isc_max_mppt).toBe(16.9)
  })

  it('e fica AUSENTE quando o cadastro não o declara — sem default', () => {
    const env = dadosEletricosInversor({
      id: 'y-nao-esta-na-tabela-estatica',
      _eletrico: {
        tensao_max_entrada: 600, corrente_max_mppt: 13, mppt_min: 25, mppt_max: 55,
        potencia_ca_kw: 2,
      },
    })
    expect(env.corrente_isc_max_mppt).toBeNull()
    // E o classificador, com esse envelope, não aprova por omissão.
    expect(classificarCorrenteCC({
      isc: 13.83, impp: 13, strings: 1,
      limiteTrabalho: env.corrente_max_mppt, limiteCurto: env.corrente_isc_max_mppt,
    }).curto_circuito.status).toBe(STATUS_CORRENTE.NAO_AVALIADO)
  })

  it('a tabela estática NÃO ganhou limites de curto inventados', () => {
    const src = fonte('../../../../packages/fv-shared/engenharia/catalogoEletrico.js')
    const tabela = src.slice(src.indexOf('DADOS_ELETRICOS_INVERSORES = '),
      src.indexOf('export function dadosEletricosPainel'))
    expect(tabela).not.toMatch(/corrente_isc_max/)
  })
})

// ── Guarda anti-regressão do wizard ─────────────────────────────────────────

describe('guarda — o wizard não volta a decidir corrente sozinho', () => {
  const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, '$1')

  it('nenhuma comparação direta de corrente contra limite', () => {
    const s = semComentarios(fonte(WIZARD))
    expect(s).not.toMatch(/correnteProjeto\([^)]*\)\s*[<>]/)
    expect(s).not.toMatch(/isc[^\n]*[<>]=?\s*eletricoInv\.corrente/i)
    expect(s).not.toMatch(/impp[^\n]*[<>]=?\s*eletricoInv\.corrente/i)
  })

  it('nem o fator 1,25 solto, nem cálculo próprio de Isc/Impp para veredito', () => {
    const s = semComentarios(fonte(WIZARD))
    expect(s).not.toMatch(/\*\s*1\.25/)
    expect(s).not.toMatch(/FATOR_ISC_NBR16690/)
    expect(s).not.toMatch(/correnteProjeto/)
  })

  it('e consome o classificador canônico', () => {
    const s = semComentarios(fonte(WIZARD))
    expect(s).toMatch(/from '@fortesolar\/fv-shared\/engenharia\/classificacao-corrente-cc'/)
    expect((s.match(/classificarCorrenteCC\(/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })

  it('o motor também delega — uma implementação, não duas', () => {
    const s = semComentarios(fonte('../../../../backend/src/services/compatibilidadeEletricaService.js'))
    expect(s).toMatch(/classificarCorrenteCC\(/)
    expect(s).not.toMatch(/correnteProjeto\([^)]*\)\s*[<>]/)
  })
})

// ── Otimizador: mesmo contrato, sem regra própria ───────────────────────────

describe('otimizador', () => {
  it('não tem regra de corrente própria — descarta pelo veredito do motor', () => {
    const s = fonte('../../../../backend/src/services/optimizerArranjoFVService.js')
      .replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, '$1')
    expect(s).not.toMatch(/corrente_max_mppt/)
    expect(s).not.toMatch(/correnteProjeto/)
    expect(s).toMatch(/analisarCompatibilidade\(/)
    expect(s).toMatch(/resultado\.erros\.length/)
  })

  it('com limite de curto, o motor volta a descartar a combinação', () => {
    // É o corte que o otimizador havia perdido: sem `corrente_isc_max_mppt`
    // nenhuma combinação era descartada por corrente.
    const semLimite = pelaMotor({ ...BASE, corrente_max_mppt: 20 }, 3)
    const comLimite = pelaMotor({ ...BASE, corrente_max_mppt: 20, corrente_isc_max_mppt: 28 }, 3)
    expect(semLimite.erros.some((e) => e.codigo === 'CORRENTE_ISC_EXCEDIDA')).toBe(false)
    expect(comLimite.erros.some((e) => e.codigo === 'CORRENTE_ISC_EXCEDIDA')).toBe(true)
  })
})
