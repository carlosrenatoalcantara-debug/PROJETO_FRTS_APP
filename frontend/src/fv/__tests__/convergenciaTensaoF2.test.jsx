import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  classificarTensaoCC, STATUS_TENSAO, MARGEM_ATENCAO_TENSAO,
} from '@fortesolar/fv-shared/engenharia/classificacao-tensao-cc'
import {
  classificarOversizing, STATUS_OVERSIZING, LIMITE_CRITICO_CC_CA,
} from '@fortesolar/fv-shared/engenharia/classificacao-oversizing'
import { dadosEletricosInversor } from '@fortesolar/fv-shared/engenharia/catalogo-eletrico'

/**
 * F2 — eliminação do segundo motor elétrico do wizard.
 *
 * A F1 fez isto para corrente. Sobravam tensão e oversizing, e a auditoria da
 * F2 mediu o estrago:
 *
 *  • o wizard comparava o Vmpp QUENTE contra o MPPT MÁXIMO. O Vmpp quente é o
 *    MENOR dos dois valores da string — o critério nunca disparava, e a tela
 *    aprovava strings que o motor reprovava como `MPPT_STRING_LONGA`;
 *  • os cartões por MPPT comparavam o Vmpp em STC contra o MPPT mínimo — uma
 *    terceira leitura da mesma regra, dentro do mesmo arquivo;
 *  • `oversizing_max_fabricante ?? 1.30` fabricava o limite do fabricante:
 *    ZERO inversores do catálogo o declaram, então 100 % dos avisos
 *    `OVERSIZING_ELEVADO` saíram contra um número que ninguém publicou.
 *
 * O que estes testes protegem:
 *  1. existe UMA classificação de tensão e UMA de oversizing, e wizard e motor
 *     consomem as duas;
 *  2. o veredito do motor e o do classificador coincidem nos casos-limite;
 *  3. o wizard não voltou a comparar tensão nem oversizing por conta própria;
 *  4. sem `oversizing_max` no cadastro o critério é `nao_avaliado` — nenhum
 *     limite é assumido, e o teto de segurança de 1,50× continua reprovando;
 *  5. `validacoes_locais` não volta a ser persistido.
 */

const fonte = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const WIZARD_PATH = '../../components/fv/ConfiguradorArranjoFV.jsx'
const WIZARD = fonte(WIZARD_PATH)

const { analisarCompatibilidade, CONSTANTES } =
  await import('../../../../backend/src/services/compatibilidadeEletricaService.js')

/** Módulo real do catálogo estático — mesmos valores da fixture da F1. */
const MODULO = { voc: 53.26, vmpp: 45.06, isc: 13.83, impp: 13, potencia_w: 585, coef_temp_voc: -0.25 }
const CLIMA  = { temperatura_min_historica_c: 10, temperatura_max_historica_c: 35 }

/** Envelope de inversor com folga de corrente — aqui quem está em teste é tensão. */
const BASE = {
  tensao_max_entrada: 600, mppt_min: 80, mppt_max: 560,
  corrente_max_mppt: 20, corrente_isc_max_mppt: 28, potencia_ca_kw: 9.1,
}

const peloMotor = (inv, mps, mod = MODULO, strings = 1) => analisarCompatibilidade({
  dados_eletricos_modulo: mod,
  dados_eletricos_inversor: inv,
  arranjo_proposto: {
    quantidade_modulos_por_string: mps, quantidade_strings_paralelo: strings, num_mppt_usados: 1,
  },
  dados_climaticos_regiao: CLIMA,
})

const peloClassificador = (inv, mps, mod = MODULO) => classificarTensaoCC({
  voc: mod.voc, vmpp: mod.vmpp, coefTempVoc: mod.coef_temp_voc,
  modulosPorString: mps,
  tensaoMaxEntrada: inv.tensao_max_entrada, mpptMin: inv.mppt_min, mpptMax: inv.mppt_max,
  tMin: CLIMA.temperatura_min_historica_c, tMax: CLIMA.temperatura_max_historica_c,
})

const codigos = (r) => [...r.erros, ...r.warnings].map((d) => d.codigo)

// ── 1. Tensão: uma implementação, dois consumidores ─────────────────────────

describe('F2 · tensão — motor e classificador dão o mesmo veredito', () => {
  it('1. Voc frio acima da tensão máxima → incompatível nos dois', () => {
    const mps = 12                                    // 12 × ~55 V frio > 600 V
    const c = peloClassificador(BASE, mps)
    const m = peloMotor(BASE, mps)
    expect(c.voc.status).toBe(STATUS_TENSAO.INCOMPATIVEL)
    expect(codigos(m)).toContain('SOBRETENSAO_VOC')
    expect(m.compativel).toBe(false)
  })

  it('2. Voc frio dentro da margem de 5% → atenção nos dois, sem reprovar', () => {
    // Ajusta o TETO para cair dentro da faixa de atenção da string de 10 módulos.
    const voc10 = peloClassificador(BASE, 10).tensoes.voc_string_max
    const inv   = { ...BASE, tensao_max_entrada: Math.ceil(voc10 * 1.02) }
    const c = peloClassificador(inv, 10)
    const m = peloMotor(inv, 10)
    expect(c.voc.status).toBe(STATUS_TENSAO.ATENCAO)
    expect(codigos(m)).toContain('VOC_PROXIMO_LIMITE')
    expect(m.erros.map((e) => e.codigo)).not.toContain('SOBRETENSAO_VOC')
  })

  it('3. o teto de MPPT é medido no FRIO — era o critério que nunca disparava', () => {
    const mps = 11
    const c = peloClassificador({ ...BASE, mppt_max: 480 }, mps)
    // O frio é o pior caso: se o critério fosse medido no quente, passaria.
    expect(c.tensoes.vmpp_string_frio).toBeGreaterThan(c.tensoes.vmpp_string_quente)
    expect(c.tensoes.vmpp_string_frio).toBeGreaterThan(480)
    expect(c.tensoes.vmpp_string_quente).toBeLessThan(480)
    expect(c.mppt_max.status).toBe(STATUS_TENSAO.INCOMPATIVEL)
    expect(codigos(peloMotor({ ...BASE, mppt_max: 480 }, mps))).toContain('MPPT_STRING_LONGA')
  })

  it('4. o piso de MPPT é medido no QUENTE → string curta reprova nos dois', () => {
    const mps = 1                                     // ~42 V no calor, contra piso de 80 V
    const c = peloClassificador(BASE, mps)
    expect(c.tensoes.vmpp_string_quente).toBeLessThan(BASE.mppt_min)
    const m = peloMotor(BASE, mps)
    expect(c.mppt_min.status).toBe(STATUS_TENSAO.INCOMPATIVEL)
    expect(codigos(m)).toContain('MPPT_STRING_CURTA')
  })

  it('5. sem coeficiente térmico o critério é `nao_avaliado`, não zero', () => {
    const c = classificarTensaoCC({
      voc: MODULO.voc, vmpp: MODULO.vmpp, coefTempVoc: null, modulosPorString: 9,
      tensaoMaxEntrada: 600, mpptMin: 80, mpptMax: 560, tMin: 10, tMax: 35,
    })
    expect(c.status).toBe(STATUS_TENSAO.NAO_AVALIADO)
    expect(c.tensoes.voc_string_max).toBeNull()
    expect(c.voc.status).toBe(STATUS_TENSAO.NAO_AVALIADO)
  })

  it('6. a margem de atenção é a MESMA constante nos dois lados', () => {
    expect(MARGEM_ATENCAO_TENSAO).toBe(0.05)
    expect(CONSTANTES.VOC_MARGEM_ATENCAO_PCT).toBe(MARGEM_ATENCAO_TENSAO)
    expect(CONSTANTES.MPPT_MARGEM_ATENCAO_PCT).toBe(MARGEM_ATENCAO_TENSAO)
  })
})

// ── 2. Oversizing: o limite do fabricante não é inventado ───────────────────

describe('F2 · oversizing — limite de segurança e limite de fabricante', () => {
  it('7. acima de 1,50× reprova mesmo sem cadastro nenhum', () => {
    const o = classificarOversizing({ potenciaCcKwp: 15, potenciaCaKw: 9.1 })
    expect(o.status).toBe(STATUS_OVERSIZING.INCOMPATIVEL)
    expect(o.limite_critico).toBe(LIMITE_CRITICO_CC_CA)
    // O motor concorda: 20 × 585 W = 11,7 kWp sobre 7 kW = 1,67×.
    const m = peloMotor({ ...BASE, potencia_ca_kw: 7 }, 20)
    expect(m.erros.map((e) => e.codigo)).toContain('OVERSIZING_CRITICO')
  })

  it('8. abaixo de 1,50× e SEM `oversizing_max` → nao_avaliado, sem aviso inventado', () => {
    const o = classificarOversizing({ potenciaCcKwp: 9.36, potenciaCaKw: 7 })  // 1,337×
    expect(o.status).toBe(STATUS_OVERSIZING.NAO_AVALIADO)
    expect(o.limite_fabricante).toBeNull()
    const m = peloMotor({ ...BASE, potencia_ca_kw: 7 }, 16)
    expect(m.warnings.map((w) => w.codigo)).not.toContain('OVERSIZING_ELEVADO')
    expect(m.nao_avaliados.map((n) => n.criterio)).toContain('oversizing_fabricante')
  })

  it('9. com `oversizing_max` declarado, o aviso volta — contra o número do catálogo', () => {
    const o = classificarOversizing({ potenciaCcKwp: 9.36, potenciaCaKw: 7, limiteFabricante: 1.25 })
    expect(o.status).toBe(STATUS_OVERSIZING.ATENCAO)
    expect(o.limite_fabricante).toBe(1.25)
    const m = peloMotor({ ...BASE, potencia_ca_kw: 7, oversizing_max_fabricante: 1.25 }, 16)
    const aviso = m.warnings.find((w) => w.codigo === 'OVERSIZING_ELEVADO')
    expect(aviso).toBeTruthy()
    expect(aviso.valores.limite_recomendado).toBe(1.25)
  })

  it('10. o catálogo não fabrica mais `oversizing_max` no fallback do Mongo', () => {
    const semLimite = dadosEletricosInversor({
      id: 'inversor-sem-oversizing-cadastrado',
      tensaoMaxV: 600, correnteMaxA: 20, mpptMinV: 80, mpptMaxV: 560, potenciaKW: 9.1,
    })
    expect(semLimite).toBeTruthy()
    expect(semLimite.oversizing_max ?? null).toBeNull()

    const comLimite = dadosEletricosInversor({
      id: 'inversor-com-oversizing-cadastrado',
      tensaoMaxV: 600, correnteMaxA: 20, mpptMinV: 80, mpptMaxV: 560, potenciaKW: 9.1,
      oversizingMax: 1.25,
    })
    expect(comLimite.oversizing_max).toBe(1.25)
  })
})

// ── 3. Guards: o wizard não tem regra elétrica própria ──────────────────────
//
// Invariantes de CONTEÚDO — não dependem de `git status`, de diff nem de lista
// de commits. O que reprova é o wizard voltar a comparar tensão ou oversizing.

describe('F2 · o wizard consome o domínio, não reimplementa', () => {
  const semComentarios = WIZARD
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')

  it('11. importa os dois classificadores canônicos', () => {
    expect(WIZARD).toMatch(/from '@fortesolar\/fv-shared\/engenharia\/classificacao-tensao-cc'/)
    expect(WIZARD).toMatch(/from '@fortesolar\/fv-shared\/engenharia\/classificacao-oversizing'/)
    expect(semComentarios).toMatch(/classificarTensaoCC\(/)
    expect(semComentarios).toMatch(/classificarOversizing\(/)
  })

  it('12. não importa mais as primitivas térmicas — quem as aplica é o classificador', () => {
    for (const primitiva of ['fatorTermico', 'temperaturaCelula', 'coefParaFracao']) {
      expect(semComentarios).not.toMatch(new RegExp(`${primitiva}\\s*\\(`))
    }
  })

  it('13. nenhuma comparação própria de tensão contra o envelope do inversor', () => {
    for (const comparacao of [
      /[><]=?\s*eletricoInv\.tensao_max_entrada/,
      /[><]=?\s*eletricoInv\.mppt_min/,
      /[><]=?\s*eletricoInv\.mppt_max/,
    ]) {
      expect(semComentarios).not.toMatch(comparacao)
    }
  })

  it('14. nenhum limite de oversizing escrito na tela', () => {
    // O `?? 1.30` era a fabricação; `> 1.5` era o teto duplicado do sistema.
    expect(semComentarios).not.toMatch(/oversizing_max\s*\?\?/)
    expect(semComentarios).not.toMatch(/oversizing\s*[><]=?\s*1\.5/)
    expect(semComentarios).toMatch(/LIMITE_CRITICO_CC_CA/)
  })

  it('15. `validacoes_locais` não é mais persistido', () => {
    expect(semComentarios).not.toMatch(/validacoes_locais/)
    // e o veredito do motor continua sendo gravado, no lugar dele
    expect(semComentarios).toMatch(/diagnosticos:/)
  })
})
