import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const { analisarCompatibilidade, STATUS_CRITERIO } =
  await import('../../../../backend/src/services/compatibilidadeEletricaService.js')

/**
 * F-01 — contagem de módulos do arranjo.
 *
 * ── O defeito ───────────────────────────────────────────────────────────────
 * O contrato do motor descreve UM MPPT: `quantidade_modulos_por_string` e
 * `quantidade_strings_paralelo` são desse MPPT, e `num_mppt_usados` replicava o
 * conjunto. Sob esse contrato, `7 × 2 × 3 = 42` estava certo para as entradas
 * recebidas — o errado eram as entradas.
 *
 * O wizard mandava o pior caso que JÁ agregava o arranjo inteiro (2 strings de
 * 7 módulos = os 14 módulos existentes) junto com o número de MPPTs do
 * INVERSOR (3), e não dos ocupados (1). O motor multiplicava os dois e via
 * 42 módulos, 24,57 kWp, relação CC/CA 2,70× → `OVERSIZING_CRITICO`. A mesma
 * tela mostrava 14 módulos, 8,19 kWp e 0,90×, e o documento persistido guardava
 * os dois números.
 *
 * Ficou invisível até a F3 porque, antes dela, o adapter entregava
 * `potencia_w: 0` para todo módulo do catálogo: a potência CC dava zero e o
 * critério nunca disparava. A F3 devolveu a potência real e o defeito apareceu.
 *
 * ── A correção ──────────────────────────────────────────────────────────────
 * Duas quantidades passaram a ser explícitas e separadas:
 *   POR MPPT   módulos/string, strings/MPPT  → tensão de string, corrente de entrada
 *   DO ARRANJO total_modulos, total_strings  → relação CC/CA, corrente total
 *
 * Ausentes, o motor mantém o fallback homogêneo (contrato histórico). Presentes,
 * são a verdade e nada é inferido — que é o único jeito de um layout
 * heterogêneo fechar.
 */

const MODULO = { voc: 53.26, vmpp: 45.06, isc: 13.83, impp: 13, potencia_w: 585, coef_temp_voc: -0.25 }
const CLIMA  = { temperatura_min_historica_c: 18, temperatura_max_historica_c: 38 }
/** Solplanet ASW9100-S — valores reais do catálogo, 3 MPPTs. */
const INVERSOR = {
  tensao_max_entrada: 600, mppt_min: 80, mppt_max: 560,
  corrente_max_mppt: 20, corrente_isc_max_mppt: 28, potencia_ca_kw: 9.1,
}

const analisar = (arranjo, inv = INVERSOR) => analisarCompatibilidade({
  dados_eletricos_modulo: MODULO,
  dados_eletricos_inversor: inv,
  arranjo_proposto: arranjo,
  dados_climaticos_regiao: CLIMA,
})

/** Somatório da topologia real, como a tela faz — a única fonte do total. */
const daTopologia = (mppts) => ({
  quantidade_modulos_por_string: Math.max(...mppts.map((m) => m.modulosPorString)),
  quantidade_strings_paralelo: Math.max(...mppts.map((m) => m.numStrings)),
  num_mppt_usados: mppts.filter((m) => m.numStrings > 0 && m.modulosPorString > 0).length || 1,
  total_modulos_arranjo: mppts.reduce((s, m) => s + m.numStrings * m.modulosPorString, 0),
  total_strings_arranjo: mppts.reduce((s, m) => s + m.numStrings, 0),
})

const codigos = (r) => [...r.erros, ...r.warnings].map((d) => d.codigo)

// ── Casos 1 a 7 ─────────────────────────────────────────────────────────────

describe('F-01 · o total de módulos é o do arranjo, não um produto', () => {
  it('1. 14 módulos (7+7, 2 strings) num inversor de 3 MPPTs → 14, não 42', () => {
    // O cenário exato que o QA reproduziu.
    const r = analisar(daTopologia([{ numStrings: 2, modulosPorString: 7 }]))
    expect(r.calculos.total_modulos).toBe(14)
    expect(r.calculos.total_modulos).not.toBe(42)
    expect(r.calculos.potencia_cc_total).toBeCloseTo(8.19, 2)
    expect(r.calculos.potencia_cc_total).not.toBeCloseTo(24.57, 2)
    expect(r.calculos.fator_oversizing).toBeCloseTo(0.9, 2)
    expect(codigos(r)).not.toContain('OVERSIZING_CRITICO')
  })

  it('2. 6 módulos → 6, sem multiplicar pelo número de MPPTs', () => {
    const r = analisar(daTopologia([{ numStrings: 1, modulosPorString: 6 }]))
    expect(r.calculos.total_modulos).toBe(6)
    expect(r.calculos.potencia_cc_total).toBeCloseTo(3.51, 2)
  })

  it('3. 10 módulos → 10', () => {
    const r = analisar(daTopologia([{ numStrings: 1, modulosPorString: 10 }]))
    expect(r.calculos.total_modulos).toBe(10)
    expect(r.calculos.potencia_cc_total).toBeCloseTo(5.85, 2)
  })

  it('4. MPPT com zero módulos não conta — 7 + 7 + 0 = 14', () => {
    const arranjo = daTopologia([
      { numStrings: 1, modulosPorString: 7 },
      { numStrings: 1, modulosPorString: 7 },
      { numStrings: 0, modulosPorString: 0 },
    ])
    expect(arranjo.num_mppt_usados).toBe(2)      // o vazio não é "usado"
    const r = analisar(arranjo)
    expect(r.calculos.total_modulos).toBe(14)
    expect(codigos(r)).not.toContain('OVERSIZING_CRITICO')
  })

  it('5. heterogêneo real — 8 + 7 + 6 = 21, nunca 8×3 nem 7×3', () => {
    const arranjo = daTopologia([
      { numStrings: 1, modulosPorString: 8 },
      { numStrings: 1, modulosPorString: 7 },
      { numStrings: 1, modulosPorString: 6 },
    ])
    const r = analisar(arranjo)
    expect(r.calculos.total_modulos).toBe(21)
    expect(r.calculos.total_modulos).not.toBe(24)   // 8 × 3
    expect(r.calculos.total_modulos).not.toBe(21 * 3)
    // A tensão continua sendo julgada pelo PIOR MPPT — 8 módulos em série.
    expect(r.calculos.voc_string_max).toBeCloseTo(8 * (r.calculos.voc_corrigido_frio), 1)
  })

  it('6. strings paralelas contam — 3 strings de 7 em 1 MPPT = 21 módulos', () => {
    const arranjo = daTopologia([{ numStrings: 3, modulosPorString: 7 }])
    const r = analisar(arranjo)
    expect(arranjo.total_strings_arranjo).toBe(3)
    expect(r.calculos.total_modulos).toBe(21)
    expect(r.calculos.total_strings).toBe(3)
    // e a corrente por MPPT continua sendo a das 3 strings daquele MPPT
    expect(r.calculos.isc_operacao).toBeCloseTo(13.83 * 3, 2)
  })

  it('7. oversizing do cenário do QA: 8,19 / 9,10 ≈ 0,90×, nunca 2,70×', () => {
    const r = analisar(daTopologia([{ numStrings: 2, modulosPorString: 7 }]))
    expect(r.calculos.fator_oversizing).toBeGreaterThan(0.88)
    expect(r.calculos.fator_oversizing).toBeLessThan(0.92)
    expect(r.erros.map((e) => e.codigo)).not.toContain('OVERSIZING_CRITICO')
    // Sem `oversizing_max` no catálogo, a F3 continua valendo: nao_avaliado.
    expect(r.nao_avaliados.map((n) => n.criterio)).toContain('oversizing_fabricante')
    // O status global é `atencao` por CORRENTE_IMPP_ELEVADA (Impp 26 A contra
    // os 20 A da entrada, F1) — atenção, não reprovação. O que não pode voltar
    // é a reprovação por oversizing.
    expect(r.status).toBe(STATUS_CRITERIO.ATENCAO)
    expect(r.compativel).toBe(true)
  })
})

// ── Contrato: fallback, ausência e entrada inválida ─────────────────────────

describe('F-01 · o contrato do motor', () => {
  it('8. sem os totais, o fallback homogêneo do contrato histórico continua', () => {
    // Um chamador antigo que descreve 1 MPPT com 2 strings de 7 e diz que há 3
    // MPPTs iguais está afirmando 42 módulos — e é isso que deve receber.
    const r = analisar({
      quantidade_modulos_por_string: 7, quantidade_strings_paralelo: 2, num_mppt_usados: 3,
    })
    expect(r.calculos.total_modulos).toBe(42)
    expect(r.calculos.total_strings).toBe(6)
  })

  it('9. `num_mppt_usados` ausente vale 1 — um MPPT só', () => {
    const r = analisar({ quantidade_modulos_por_string: 7, quantidade_strings_paralelo: 2 })
    expect(r.calculos.total_modulos).toBe(14)
  })

  it('10. os totais vencem o produto quando ambos são informados', () => {
    const r = analisar({
      quantidade_modulos_por_string: 7, quantidade_strings_paralelo: 2, num_mppt_usados: 3,
      total_modulos_arranjo: 14, total_strings_arranjo: 2,
    })
    expect(r.calculos.total_modulos).toBe(14)
    expect(r.calculos.total_strings).toBe(2)
  })

  it('11. contagem inválida é entrada inválida, não silêncio', () => {
    for (const lixo of [0, -3, 'abc']) {
      const r = analisar({
        quantidade_modulos_por_string: 7, quantidade_strings_paralelo: 2,
        total_modulos_arranjo: lixo,
      })
      expect(r.compativel, `total=${lixo}`).toBe(false)
      expect(r.erros.map((e) => e.codigo)).toContain('INPUT_INVALIDO')
    }
  })

  it('12. determinismo — mesma entrada, mesmo resultado', () => {
    const a = daTopologia([{ numStrings: 2, modulosPorString: 7 }])
    const r1 = analisar(a)
    const r2 = analisar(a)
    expect(r1.calculos).toEqual(r2.calculos)
    expect(r1.status).toBe(r2.status)
  })
})

// ── Guard de semântica ──────────────────────────────────────────────────────

describe('F-01 · guard contra o retorno da multiplicação', () => {
  const fonte = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
  const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const MOTOR  = semComentarios(fonte('../../../../backend/src/services/compatibilidadeEletricaService.js'))
  const WIZARD = semComentarios(fonte('../../components/fv/ConfiguradorArranjoFV.jsx'))

  it('13. o total do arranjo é derivado UMA vez no motor', () => {
    // Uma segunda derivação é o que permitia dois números para o mesmo arranjo.
    const derivacoes = MOTOR.match(/const\s+total_modulos\s*=/g) ?? []
    expect(derivacoes.length).toBe(1)
    const strings = MOTOR.match(/const\s+total_strings\s*=/g) ?? []
    expect(strings.length).toBe(1)
  })

  it('14. `num_mppt_usados` não volta a multiplicar um total já agregado', () => {
    // Só é aceitável dentro do fallback declarado, junto de `strings_paralelo`.
    const multiplicacoes = MOTOR.match(/[^\n]*num_mppt_usados[^\n]*/g) ?? []
    const comProduto = multiplicacoes.filter((l) => l.includes('*'))
    expect(comProduto.length).toBe(1)
    expect(comProduto[0]).toMatch(/strings_paralelo \* num_mppt_usados/)
    // e a potência CC não pode ser montada a partir dele
    expect(MOTOR).not.toMatch(/potencia_cc_total[^\n]*num_mppt_usados/)
  })

  it('15. o wizard envia MPPTs OCUPADOS, não o total do inversor', () => {
    expect(WIZARD).toMatch(/num_mppt_usados:\s*mpptsOcupados/)
    expect(WIZARD).not.toMatch(/num_mppt_usados:\s*nMppts/)
    expect(WIZARD).not.toMatch(/num_mppts_usados:\s*nMppts/)
  })

  it('16. o wizard envia o total real do arranjo ao motor', () => {
    expect(WIZARD).toMatch(/total_modulos_arranjo:\s*totalModulosArranjo/)
    expect(WIZARD).toMatch(/total_strings_arranjo:\s*totalStringsArranjo/)
  })

  it('17. o total do arranjo é somado UMA vez na tela', () => {
    // `totalModulosArranjo` é a fonte única. O que não pode existir é uma
    // segunda AGREGAÇÃO do mesmo conceito — um `reduce` sobre `mppts` somando
    // módulos. Produtos por MPPT (exibição, payload por MPPT) são outra coisa e
    // continuam permitidos.
    const agregacoes = WIZARD.split('\n').filter(
      (l) => /\.reduce\(/.test(l) && /numStrings\s*\*\s*m\.modulosPorString/.test(l))
    expect(agregacoes.length).toBe(1)
    // e o que se envia, o que se exibe e o que se persiste vêm dela
    expect(WIZARD).toMatch(/total_modulos:\s*totalModulosArranjo/)
    expect(WIZARD).toMatch(/totalModulos:\s*totalModulosArranjo/)
  })
})
