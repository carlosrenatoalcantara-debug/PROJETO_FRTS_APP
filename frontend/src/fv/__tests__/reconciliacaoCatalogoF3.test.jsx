import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  dadosEletricosPainel, dadosEletricosInversor,
  DADOS_ELETRICOS_PAINEIS, DADOS_ELETRICOS_INVERSORES,
} from '@fortesolar/fv-shared/engenharia/catalogo-eletrico'
import { adaptarModulo, adaptarInversor } from '../../utils/catalogoEngenhariaAdapter'
import { classificarTensaoCC, STATUS_TENSAO } from '@fortesolar/fv-shared/engenharia/classificacao-tensao-cc'
import { classificarOversizing, STATUS_OVERSIZING } from '@fortesolar/fv-shared/engenharia/classificacao-oversizing'
import { classificarCorrenteCC, STATUS_CORRENTE } from '@fortesolar/fv-shared/engenharia/classificacao-corrente-cc'

/**
 * F3 — reconciliação do catálogo elétrico com o SSOT.
 *
 * ── O que a auditoria mediu ─────────────────────────────────────────────────
 * Havia duas fontes de especificação elétrica, e a estática vencia:
 * `dadosEletricos*` consultava a tabela histórica ANTES das specs do catálogo.
 * Na prática não colidia (id do Mongo é ObjectId), mas a precedência estava
 * invertida, e bastava um id coincidir para o legado calar o SSOT.
 *
 * Pior que a precedência eram os DEFAULTS. Quatro dados de fabricante eram
 * fabricados na fronteira, e todos decidem engenharia:
 *
 *   coef_temp_voc ?? -0.0028   decide o Voc no frio → decide SOBRETENSAO_VOC.
 *                              5 dos 54 módulos declaram o coeficiente.
 *   temp_noct ?? 43            decide a temperatura de célula → decide o piso
 *                              do MPPT. Nenhum dos 54 declara NOCT.
 *   entradas_por_mppt ?? 1     afirmava topologia não declarada.
 *   ?? 0 no adapter            pior de todos: `voc: 0` passa em qualquer teto,
 *                              e a aprovação sai de um número inventado.
 *
 * E `Number(null) === 0`: o helper `_n` do catálogo devolvia esse zero como
 * dado. `oversizing_max: null` virava `0`, o que reintroduzia por este caminho
 * o aviso que a F2 eliminou — agora contra o limite fabricado "zero".
 *
 * ── O que estes testes protegem ─────────────────────────────────────────────
 *  1. a tabela estática só atende o catálogo de contingência (LEGACY isolado);
 *  2. nenhum campo técnico ausente vira número;
 *  3. `oversizing_max` ausente continua produzindo `nao_avaliado`;
 *  4. unidades declaradas e convertidas num ponto só;
 *  5. o motor canônico recebe o mesmo contrato vindo de qualquer origem.
 */

const { analisarCompatibilidade, STATUS_CRITERIO } =
  await import('../../../../backend/src/services/compatibilidadeEletricaService.js')

const fonte = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const ADAPTER = fonte('../../utils/catalogoEngenhariaAdapter.js')
const CATALOGO = fonte('../../../../packages/fv-shared/engenharia/catalogoEletrico.js')

/**
 * Documento REAL do catálogo, com os nomes de campo que o SSOT usa de fato:
 * `potencia_wp` (não `potencia_w`), `vmp` (não `vmpp`), `imp` (não `impp`),
 * `coef_temp_voc` em %/°C. Copiado da amostra levantada na auditoria.
 */
const DOC_MODULO = {
  _id: 'ffffffffffffffffffffffff', fabricante: 'Ronma', modelo: 'RM-585W-182M/144TB',
  especificacoes: {
    potencia_wp: 585, voc: 53.26, vmp: 45.06, isc: 13.83, imp: 13,
    eficiencia: 22.6, coef_temp_voc: -0.25, coef_temp_isc: 0.045,
  },
}

/** Inversor real que DECLARA o limite de curto (19 dos 39 declaram). */
const DOC_INVERSOR = {
  _id: 'eeeeeeeeeeeeeeeeeeeeeeee', fabricante: 'Solplanet', modelo: 'ASW9100-S',
  especificacoes: {
    potencia_kw: 9.1, n_mppts: 3, fases: 1,
    tensao_max_entrada: 600, tensao_mppt_min: 80, tensao_mppt_max: 560,
    corrente_max_por_mppt: 20, corrente_isc_max: 28,
  },
}

/** Reproduz o que `SeletorInversores.handleSelect` propaga ao wizard. */
const comoOWizardRecebe = (eq) => {
  const a = adaptarInversor(eq)
  return {
    id: a.id, _fonte: a._fonte, potenciaKW: a.potenciaKW, nMppts: a.nMppts,
    tensaoMaxV:      a._eletrico.tensao_max_entrada,
    mpptMinV:        a._eletrico.mppt_min,
    mpptMaxV:        a._eletrico.mppt_max,
    correnteMaxA:    a._eletrico.corrente_max_mppt,
    correnteIscMaxA: a._eletrico.corrente_isc_max,
    oversizingMax:   a._eletrico.oversizing_max,
    entradasPorMppt: a._eletrico.entradas_por_mppt,
  }
}

// ── 1–2. Fonte única e ausência de fabricação ───────────────────────────────

describe('F3 · SSOT é a fonte, a tabela estática é contingência', () => {
  it('1. equipamento do catálogo não consulta a tabela histórica', () => {
    // `cs550` existe na tabela estática. Vindo do catálogo, ela não pode falar.
    const doSSOT = dadosEletricosPainel({
      id: 'cs550', _fonte: 'catalogo', voc: 49.5, vmpp: 41.2, isc: 13.9,
    })
    expect(doSSOT.coef_temp_voc).toBeNull()          // o SSOT não declarou
    expect(doSSOT.temp_noct).toBeNull()
    expect(DADOS_ELETRICOS_PAINEIS.cs550.coef_temp_voc).toBe(-0.0028)  // a tabela declarava
  })

  it('2. o catálogo de contingência continua atendido pela tabela histórica', () => {
    const local = dadosEletricosPainel({ id: 'cs550' })
    expect(local).toEqual(DADOS_ELETRICOS_PAINEIS.cs550)
    const inv = dadosEletricosInversor({ id: 'fr5' })
    expect(inv).toEqual(DADOS_ELETRICOS_INVERSORES.fr5)
  })

  it('3. nenhum campo técnico ausente é fabricado por fallback', () => {
    const semNada = dadosEletricosPainel({
      id: '507f1f77bcf86cd799439011', _fonte: 'catalogo', voc: 50, vmpp: 42, isc: 14,
    })
    for (const campo of ['impp', 'potencia_w', 'coef_temp_voc', 'temp_noct']) {
      expect(semNada[campo], `${campo} deveria ser null`).toBeNull()
    }
  })

  it('4. `null` não vira zero na fronteira — Number(null) === 0 era o bug', () => {
    const inv = dadosEletricosInversor({
      id: '507f1f77bcf86cd799439012', _fonte: 'catalogo',
      tensaoMaxV: 600, correnteMaxA: 20, mpptMinV: 80, mpptMaxV: 560,
      potenciaKW: 9.1, oversizingMax: null, entradasPorMppt: null, correnteIscMaxA: null,
    })
    expect(inv.oversizing_max).toBeNull()
    expect(inv.oversizing_max).not.toBe(0)
    expect(inv.entradas_por_mppt).toBeNull()
    expect(inv.corrente_isc_max_mppt).toBeNull()
  })
})

// ── 3. O contrato que chega ao motor ────────────────────────────────────────

describe('F3 · o adapter entrega o SSOT sem inventar e sem perder', () => {
  it('5. potência do módulo sai do SSOT — `potencia_wp` é o nome real', () => {
    const a = adaptarModulo(DOC_MODULO)
    expect(a.potenciaW).toBe(585)
    // Antes o alias faltava e TODO módulo do catálogo chegava com 0 kWp.
    expect(a.potenciaW).not.toBe(0)
    const env = dadosEletricosPainel({ ...a, pmpp: a.potenciaW })
    expect(env.potencia_w).toBe(585)
  })

  it('6. o limite de CURTO cadastrado chega ao wizard', () => {
    const w = comoOWizardRecebe(DOC_INVERSOR)
    expect(w.correnteIscMaxA).toBe(28)
    expect(w.correnteMaxA).toBe(20)
    // Duas grandezas, dois números — nunca uma no lugar da outra.
    expect(w.correnteIscMaxA).not.toBe(w.correnteMaxA)
    const env = dadosEletricosInversor(w)
    expect(env.corrente_isc_max_mppt).toBe(28)
    expect(env.corrente_max_mppt).toBe(20)
  })

  it('7. sem `corrente_isc_max` no cadastro, o critério de curto é `nao_avaliado`', () => {
    const semIsc = { ...DOC_INVERSOR, especificacoes: { ...DOC_INVERSOR.especificacoes } }
    delete semIsc.especificacoes.corrente_isc_max
    const w = comoOWizardRecebe(semIsc)
    expect(w.correnteIscMaxA).toBeNull()
    const c = classificarCorrenteCC({
      isc: 13.83, impp: 13, strings: 1,
      limiteTrabalho: w.correnteMaxA, limiteCurto: w.correnteIscMaxA,
    })
    expect(c.curto_circuito.status).toBe(STATUS_CORRENTE.NAO_AVALIADO)
  })

  it('8. `oversizing_max` ausente continua produzindo `nao_avaliado`', () => {
    const w = comoOWizardRecebe(DOC_INVERSOR)
    expect(w.oversizingMax).toBeNull()
    const o = classificarOversizing({
      potenciaCcKwp: 11.7, potenciaCaKw: w.potenciaKW, limiteFabricante: w.oversizingMax,
    })
    expect(o.status).toBe(STATUS_OVERSIZING.NAO_AVALIADO)
    expect(o.limite_fabricante).toBeNull()
  })

  it('9. unidade do coeficiente: %/°C na fronteira, fração só no classificador', () => {
    const a = adaptarModulo(DOC_MODULO)
    expect(a.coef_temp_voc).toBe(-0.25)     // como o SSOT grava: %/°C
    const t = classificarTensaoCC({
      voc: a.voc, vmpp: a.vmpp, coefTempVoc: a.coef_temp_voc, modulosPorString: 9,
      tensaoMaxEntrada: 600, mpptMin: 80, mpptMax: 560, tMin: 10, tMax: 35,
    })
    // −0,25 %/°C em 9 módulos a 10 °C: ~497 V. Se a unidade fosse tratada como
    // fração, o mesmo arranjo daria milhares de volts e reprovaria.
    expect(t.tensoes.voc_string_max).toBeGreaterThan(480)
    expect(t.tensoes.voc_string_max).toBeLessThan(510)
    expect(t.voc.status).toBe(STATUS_TENSAO.OK)
  })

  it('10. sem coeficiente, a tensão é `nao_avaliado` — não aprovada por default', () => {
    const semCoef = { ...DOC_MODULO, especificacoes: { ...DOC_MODULO.especificacoes } }
    delete semCoef.especificacoes.coef_temp_voc
    const a = adaptarModulo(semCoef)
    expect(a.coef_temp_voc).toBeNull()
    const t = classificarTensaoCC({
      voc: a.voc, vmpp: a.vmpp, coefTempVoc: a.coef_temp_voc, modulosPorString: 9,
      tensaoMaxEntrada: 600, mpptMin: 80, mpptMax: 560, tMin: 10, tMax: 35,
    })
    expect(t.status).toBe(STATUS_TENSAO.NAO_AVALIADO)
    expect(t.tensoes.voc_string_max).toBeNull()
  })

  it('11. equipamento sem correspondência no SSOT não é tratado como equivalente', () => {
    // Id que não existe em lugar nenhum e cadastro incompleto: `null`, não um
    // envelope montado com defaults.
    expect(dadosEletricosInversor({ id: 'nao-existe', _fonte: 'catalogo' })).toBeNull()
    expect(dadosEletricosPainel({ id: 'nao-existe', _fonte: 'catalogo' })).toBeNull()
  })

  it('12. o motor recebe o MESMO contrato vindo do SSOT e do legado', () => {
    const doSSOT = dadosEletricosInversor(comoOWizardRecebe(DOC_INVERSOR))
    const doLegado = dadosEletricosInversor({ id: 'fr5' })
    const chavesEletricas = [
      'tensao_max_entrada', 'mppt_min', 'mppt_max', 'corrente_max_mppt', 'potencia_ca_kw',
    ]
    for (const k of chavesEletricas) {
      expect(doSSOT, `SSOT sem ${k}`).toHaveProperty(k)
      expect(doLegado, `legado sem ${k}`).toHaveProperty(k)
    }
    // As duas origens produzem números, não um número e um zero de enfeite.
    expect(typeof doSSOT.tensao_max_entrada).toBe('number')
    expect(typeof doLegado.tensao_max_entrada).toBe('number')
  })
})

// ── 3b. Ausência × inválido, no motor ───────────────────────────────────────

describe('F3 · o motor distingue lacuna de entrada inválida', () => {
  const MOD = { voc: 50.67, vmpp: 41.95, isc: 14.13, impp: 13.35, potencia_w: 560 }
  const INV = {
    tensao_max_entrada: 600, mppt_min: 80, mppt_max: 560,
    corrente_max_mppt: 20, corrente_isc_max_mppt: 28, potencia_ca_kw: 9.1,
  }
  const CLIMA = { temperatura_min_historica_c: 10, temperatura_max_historica_c: 35 }
  const rodar = (modulo) => analisarCompatibilidade({
    dados_eletricos_modulo: modulo, dados_eletricos_inversor: INV,
    arranjo_proposto: {
      quantidade_modulos_por_string: 9, quantidade_strings_paralelo: 1, num_mppt_usados: 1,
    },
    dados_climaticos_regiao: CLIMA,
  })

  it('19. módulo sem `coef_temp_voc` → `nao_avaliado`, não bloqueio', () => {
    // 49 dos 54 módulos cadastrados estão neste caso. Antes da F3 o default
    // `?? -0.0028` os aprovava contra um coeficiente inventado; barrar todos
    // como entrada inválida seria trocar uma mentira por outra.
    const r = rodar({ ...MOD, coef_temp_voc: null })
    expect(r.erros.map((e) => e.codigo)).not.toContain('INPUT_INVALIDO')
    expect(r.compativel).toBe(true)
    expect(r.status).toBe(STATUS_CRITERIO.OK_PARCIAL)
    expect(r.nao_avaliados.map((n) => n.criterio)).toContain('tensao_cc')
  })

  it('20. e nenhuma tensão derivada vira zero', () => {
    const c = rodar({ ...MOD, coef_temp_voc: null }).calculos
    for (const k of ['voc_string_max', 'vmpp_string_frio', 'vmpp_string_quente',
      'margem_tensao_percentual', 'margem_mppt_max_percentual', 'margem_mppt_min_percentual']) {
      expect(c[k], `${k} deveria ser null`).toBeNull()
    }
  })

  it('21. valor PRESENTE e inválido continua sendo entrada inválida', () => {
    for (const lixo of ['abc', NaN, Infinity]) {
      const r = rodar({ ...MOD, coef_temp_voc: lixo })
      expect(r.compativel, `coef=${String(lixo)}`).toBe(false)
      expect(r.erros.map((e) => e.codigo)).toContain('INPUT_INVALIDO')
    }
  })

  it('22. com o coeficiente declarado, o veredito de tensão volta a existir', () => {
    const r = rodar({ ...MOD, coef_temp_voc: -0.25 })
    expect(r.nao_avaliados.map((n) => n.criterio)).not.toContain('tensao_cc')
    expect(r.calculos.voc_string_max).toBeGreaterThan(0)
  })
})

// ── 4. Guards de arquitetura ────────────────────────────────────────────────
//
// Invariantes de CONTEÚDO. Nada de `git status`, diff ou lista de commits: o
// que reprova é o código voltar a ter duas fontes ou a fabricar dado técnico.

describe('F3 · guards contra o retorno das duas fontes', () => {
  const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const ADAPTER_CODIGO = semComentarios(ADAPTER)
  const CATALOGO_CODIGO = semComentarios(CATALOGO)

  it('13. a tabela histórica é consultada por origem, nunca antes do SSOT', () => {
    // `_ehLegado` é a única porta de entrada das duas tabelas.
    const usos = CATALOGO_CODIGO.match(/DADOS_ELETRICOS_(PAINEIS|INVERSORES)\s*\[/g) ?? []
    expect(usos.length).toBe(2)                       // um por função, dentro do guard
    expect(CATALOGO_CODIGO).toMatch(/_ehLegado\(painel, DADOS_ELETRICOS_PAINEIS\)/)
    expect(CATALOGO_CODIGO).toMatch(/_ehLegado\(inversor, DADOS_ELETRICOS_INVERSORES\)/)
    expect(CATALOGO_CODIGO).toMatch(/_fonte !== 'catalogo'/)
  })

  it('14. nenhum default técnico fabricado no adapter', () => {
    // Grandezas de engenharia não podem cair em `?? <número>`.
    const proibidos = [
      /potenciaW:[^,\n]*\?\?\s*\d/, /\bvoc:[^,\n]*\?\?\s*\d/, /vmpp:[^,\n]*\?\?\s*\d/,
      /\bisc:[^,\n]*\?\?\s*\d/, /potenciaKW:[^,\n]*\?\?\s*\d/, /nMppts:[^,\n]*\?\?\s*\d/,
      /coef_temp_voc:[^,\n]*\?\?/, /temp_noct:[^,\n]*\?\?/,
      /oversizing_max:[^,\n]*\?\?/, /entradas_por_mppt:[^,\n]*\?\?\s*\d/,
      /corrente_max_mppt:[^,\n]*\?\?\s*\d/, /corrente_isc_max:[^,\n]*\?\?\s*\d/,
    ]
    for (const p of proibidos) expect(ADAPTER_CODIGO, `padrão ${p}`).not.toMatch(p)
  })

  it('15. nenhum default técnico fabricado na fronteira do catálogo', () => {
    // Proíbe `?? <número literal>`, que é default fabricado. `?? <outro campo>`
    // continua legítimo: é precedência entre dois nomes reais do cadastro.
    for (const p of [
      /coef_temp_voc:[^,\n]*\?\?\s*-?\d/, /temp_noct:[^,\n]*\?\?\s*-?\d/,
      /oversizing_max:[^,\n]*\?\?\s*-?\d/, /entradas_por_mppt:[^,\n]*\?\?\s*-?\d/,
    ]) expect(CATALOGO_CODIGO, `padrão ${p}`).not.toMatch(p)
    // `Number(null) === 0`: o helper precisa barrar null/undefined/'' antes.
    expect(CATALOGO_CODIGO).toMatch(/v === null \|\| v === undefined \|\| v === ''/)
  })

  it('16. o limite de curto não é lido de onde ele foi fabricado', () => {
    // `specs_canonicas.isc_max_por_mppt_a` repete a corrente de trabalho nos 20
    // inversores sem dado real. Nenhum consumidor pode passar a lê-lo.
    expect(ADAPTER_CODIGO).not.toMatch(/isc_max_por_mppt_a/)
    expect(CATALOGO_CODIGO).not.toMatch(/isc_max_por_mppt_a/)
    // e a corrente de trabalho não aceita o limite de curto como alias
    expect(ADAPTER_CODIGO).not.toMatch(/corrente_max_mppt:.*isc_max/)
  })

  it('17. não existe uma segunda tabela elétrica no frontend', () => {
    // Uma tabela nova com o mesmo papel seria a terceira fonte.
    const tabelas = ADAPTER_CODIGO.match(/const\s+DADOS_ELETRICOS/g) ?? []
    expect(tabelas.length).toBe(0)
    // O adapter é o caminho do SSOT: ele não conhece a tabela histórica.
    expect(ADAPTER_CODIGO).not.toMatch(/DADOS_ELETRICOS_/)
    expect(ADAPTER_CODIGO).not.toMatch(/catalogo-eletrico|catalogoEletrico/)
  })

  it('18. onde o legado ainda entra, o SSOT tem precedência', () => {
    // `SeletorInversores` é o único componente que ainda toca a tabela — ele
    // serve a vitrine em contingência. A ordem `_eletrico ?? TABELA` é o que
    // garante que o cadastro real ganha sempre; invertê-la recria o defeito.
    const seletor = semComentarios(fonte('../../components/fv/SeletorInversores.jsx'))
    const linhas = seletor.split('\n').filter((l) => l.includes('DADOS_ELETRICOS_INVERSORES['))
    expect(linhas.length).toBeGreaterThan(0)
    for (const l of linhas) expect(l).toMatch(/_eletrico\s*\?\?\s*DADOS_ELETRICOS_INVERSORES\[/)
  })
})
