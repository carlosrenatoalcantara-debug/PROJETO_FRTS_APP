import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  composicaoDoProjeto, necessidadeDoProjeto, stringsDoProjeto,
} from '../../components/fv/ResumoNecessidadeComposicao'

const { necessidadeDoProjeto: necessidadeCore, compradaDoProjeto } =
  await import('../../../../backend/src/dominio/potencia/index.js')

/**
 * F-05 — necessidade e composição são grandezas diferentes.
 *
 * ── O defeito ───────────────────────────────────────────────────────────────
 * O bloco "Dados do Sistema" do unifilar e o card de dimensionamento da tela de
 * detalhes descreviam o SISTEMA lendo `dimensionamento` — que é a NECESSIDADE.
 * Um projeto cuja etapa estimou 5,78 kWp / 10 módulos e cujo arranjo foi montado
 * com 14 módulos / 8,19 kWp aparecia como "10 módulos" ao lado do diagrama de 14.
 *
 * Havia um segundo erro sobre o primeiro: ambos liam `potenciaArredondada` e
 * `numPaineis`, nomes do CONTEXTO do wizard que não existem no documento
 * persistido (`potencia_kwp`, `num_paineis`). Contra o documento vinham
 * `undefined`, e o cartão vazio escondia o erro conceitual.
 *
 * ── A regra ─────────────────────────────────────────────────────────────────
 * As duas convivem e PODEM divergir com razão: comprar 8,19 kWp para uma
 * necessidade de 5,78 kWp é decisão de projeto. Nada é sobrescrito; o que muda é
 * cada consumidor passar a pedir a grandeza certa. As fontes são as que a
 * FV-DOM-052 já nomeou, e a composição vem de `totais`, derivado pelo Core —
 * somar módulos de novo seria a quarta verdade que a F-01 removeu.
 */

const fonte = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** Documento persistido: necessidade de 5,78 kWp, composição de 8,19 kWp. */
const PROJETO = {
  _id: '6aa2bdd6c679a3b185080c62',
  dimensionamento: { potencia_kwp: 5.78, num_paineis: 10, num_inversores: 1 },
  totais: {
    n_arranjos: 1, n_modulos_total: 14, n_inversores_total: 1,
    potencia_total_kwp: 8.19, potencia_inversor_total_kw: 9.1,
  },
  arranjos: [{
    tipo: 'principal',
    paineis: [{ marca: 'Ronma Solar', modelo: 'RM-585W-182M/144TB', potencia_w: 585, quantidade: 14 }],
    inversores: [{ marca: 'Solplanet', modelo: 'ASW9100-S', potencia_kw: 9.1, quantidade: 1 }],
  }],
  engenharia_eletrica: {
    arranjo: {
      quantidade_modulos_por_string: 7, quantidade_strings_paralelo: 2,
      total_modulos: 14, num_mppts_usados: 1,
      mppts: [{ mppt: 1, strings_paralelo: 2, modulos_por_string: 7, total_modulos: 14 }],
    },
  },
}

// ── Casos 1 a 5 ─────────────────────────────────────────────────────────────

describe('F-05 · as duas grandezas convivem', () => {
  it('1. necessidade menor que composição — cada uma no seu lugar', () => {
    expect(necessidadeDoProjeto(PROJETO)).toEqual({ potencia_kwp: 5.78, modulos: 10 })
    expect(composicaoDoProjeto(PROJETO)).toEqual({ modulos: 14, potencia_kwp: 8.19, inversores: 1 })
    // O que descreve o sistema é a composição — 14, nunca 10.
    expect(composicaoDoProjeto(PROJETO).modulos).toBe(14)
    expect(composicaoDoProjeto(PROJETO).modulos).not.toBe(10)
  })

  it('2. composição igual à necessidade continua correta', () => {
    const p = { ...PROJETO,
      dimensionamento: { potencia_kwp: 8.19, num_paineis: 14 },
    }
    expect(necessidadeDoProjeto(p).potencia_kwp).toBe(8.19)
    expect(composicaoDoProjeto(p).potencia_kwp).toBe(8.19)
  })

  it('3. necessidade sem arranjo → nenhuma composição é inventada', () => {
    const p = { dimensionamento: { potencia_kwp: 5.78, num_paineis: 10 } }
    expect(necessidadeDoProjeto(p)).toEqual({ potencia_kwp: 5.78, modulos: 10 })
    expect(composicaoDoProjeto(p)).toBeNull()
  })

  it('4. nem uma nem outra → nada a mostrar, sem zero fabricado', () => {
    expect(necessidadeDoProjeto({})).toBeNull()
    expect(composicaoDoProjeto({})).toBeNull()
    expect(composicaoDoProjeto({ totais: { n_modulos_total: 0, potencia_total_kwp: 0 } })).toBeNull()
  })

  it('5. o domínio canônico separa as mesmas duas grandezas', () => {
    // FV-DOM-052: necessidade vem de `dimensionamento`, comprada de `arranjos[]`.
    const nec = necessidadeCore(PROJETO)
    const comp = compradaDoProjeto(PROJETO)
    expect(nec.valor).toBe(5.78)
    expect(comp.valor).toBe(8.19)
    expect(nec.valor).not.toBe(comp.valor)
  })
})

// ── Casos 6 a 8 — topologia, F-01 e persistência ────────────────────────────

describe('F-05 · as fontes canônicas continuam intactas', () => {
  it('6. strings vêm da topologia canônica, somadas — nunca multiplicadas', () => {
    expect(stringsDoProjeto(PROJETO)).toBe(2)
    const heterogeneo = { ...PROJETO, engenharia_eletrica: { arranjo: { mppts: [
      { mppt: 1, strings_paralelo: 1, modulos_por_string: 8, total_modulos: 8 },
      { mppt: 2, strings_paralelo: 1, modulos_por_string: 7, total_modulos: 7 },
      { mppt: 3, strings_paralelo: 1, modulos_por_string: 6, total_modulos: 6 },
    ] } } }
    expect(stringsDoProjeto(heterogeneo)).toBe(3)
    expect(stringsDoProjeto(heterogeneo)).not.toBe(9)   // 3 × 3
  })

  it('7. sem topologia, strings é ausência declarada', () => {
    expect(stringsDoProjeto({ engenharia_eletrica: {} })).toBeNull()
    expect(stringsDoProjeto({})).toBeNull()
  })

  it('8. F-01 preservado — 14 módulos, 8,19 kWp na composição', () => {
    const c = composicaoDoProjeto(PROJETO)
    expect(c.modulos).toBe(14)
    expect(c.potencia_kwp).toBeCloseTo(8.19, 2)
    // e o oversizing derivado disso segue 0,90×
    expect(+(c.potencia_kwp / PROJETO.totais.potencia_inversor_total_kw).toFixed(2)).toBe(0.9)
  })

  it('9. nada é sobrescrito: o documento mantém as duas', () => {
    // A leitura não muta o projeto — necessidade e composição sobrevivem juntas.
    const antes = JSON.stringify(PROJETO)
    composicaoDoProjeto(PROJETO); necessidadeDoProjeto(PROJETO); stringsDoProjeto(PROJETO)
    expect(JSON.stringify(PROJETO)).toBe(antes)
    expect(PROJETO.dimensionamento.potencia_kwp).toBe(5.78)
    expect(PROJETO.totais.potencia_total_kwp).toBe(8.19)
  })
})

// ── Guards ──────────────────────────────────────────────────────────────────

describe('F-05 · guards', () => {
  const UNIFILAR = semComentarios(fonte('../../components/fv/UnifilarFV.jsx'))
  const DETALHES = semComentarios(fonte('../../pages/ProjetosFVDetalhes.jsx'))
  const RESUMO   = semComentarios(fonte('../../components/fv/ResumoNecessidadeComposicao.jsx'))

  it('10. GUARD 1/2 · o unifilar não descreve o sistema com `dimensionamento`', () => {
    expect(UNIFILAR).not.toMatch(/dimensionamento\.potenciaArredondada/)
    expect(UNIFILAR).not.toMatch(/dimensionamento\.numPaineis/)
    expect(UNIFILAR).not.toMatch(/dimensionamento\.numStrings/)
    expect(UNIFILAR).toMatch(/ResumoNecessidadeComposicao/)
  })

  it('11. GUARD 1 · a tela de detalhes idem', () => {
    expect(DETALHES).not.toMatch(/dimensionamento\.potenciaArredondada\}/)
    expect(DETALHES).not.toMatch(/dimensionamento\.numPaineis\}/)
    expect(DETALHES).toMatch(/ResumoNecessidadeComposicao/)
  })

  it('12. GUARD 4 · a composição é derivada pelo Core, não recontada aqui', () => {
    // Somar `quantidade` dos painéis por conta própria seria a quarta verdade.
    expect(RESUMO).toMatch(/projeto\?\.totais/)
    expect(RESUMO).not.toMatch(/paineis[\s\S]{0,80}reduce/)
    expect(RESUMO).not.toMatch(/modulos_por_string\s*\*/)
  })

  it('13. GUARD 3 · ninguém sobrescreve `dimensionamento` com o arranjo', () => {
    for (const [nome, src] of [['unifilar', UNIFILAR], ['detalhes', DETALHES], ['resumo', RESUMO]]) {
      expect(src, nome).not.toMatch(/dimensionamento\s*=\s*[^=]/)
      expect(src, nome).not.toMatch(/dimensionamento\.(potencia_kwp|num_paineis)\s*=/)
    }
  })

  it('14. GUARD 5/6 · nenhuma nova potência persistida foi inventada', () => {
    for (const inventada of ['potencia_real', 'potencia_final', 'potencia_projeto', 'potenciaComposicao']) {
      expect(RESUMO).not.toMatch(new RegExp(inventada))
    }
    // e os dois conceitos aparecem nomeados na tela, não trocados
    expect(RESUMO).toMatch(/Sistema configurado/)
    expect(RESUMO).toMatch(/Necessidade estimada/)
  })

  it('15. GUARD 6 · `potenciaArredondada` não vira fonte de consumidor do Core', () => {
    // É campo do CONTEXTO do wizard (alimentado por `potenciaRealKwp`) e nunca
    // existe no documento persistido. Ambíguo pelo nome, fora do Core.
    expect(RESUMO).not.toMatch(/potenciaArredondada/)
    expect(RESUMO).toMatch(/potencia_kwp/)
    expect(RESUMO).toMatch(/num_paineis/)
  })
})
