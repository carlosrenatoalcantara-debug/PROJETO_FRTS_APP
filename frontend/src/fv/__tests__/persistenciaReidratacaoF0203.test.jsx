import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { referenciaDoCatalogo } from '../catalogo'
import { adaptarModulo, adaptarInversor } from '../../utils/catalogoEngenhariaAdapter'
import { adaptarEquipamentos } from '../../services/projetoFVApi'
import { dadosEletricosPainel, dadosEletricosInversor } from '@fortesolar/fv-shared/engenharia/catalogo-eletrico'

const { adaptarProjetoParaUnifilar } =
  await import('../../../../backend/src/dominio/unifilar/adaptarProjeto.js')
const { avaliarIntegridade } =
  await import('../../../../backend/src/dominio/unifilar/integridade.js')

/**
 * F-02 / F-03 — persistência, reidratação e unifilar.
 *
 * ── F-03: a identidade se perdia na escrita ─────────────────────────────────
 * Os dois caminhos de escrita do wizard legado gravavam
 * `equipamento_id: item._id`, e o objeto que a tela tem em mãos nunca teve essa
 * chave: `catalogoEngenhariaAdapter` devolve `id` e guarda o documento em
 * `_catalogo_original`. Todo projeto salvo pelo wizard ficava com
 * `equipamento_id: null`.
 *
 * Na leitura, a reidratação montava um objeto só com marca/modelo/potência e
 * sem `id`. `dadosEletricosPainel` começa com `if (!painel?.id) return null`,
 * então a tela reabria com "dados elétricos não mapeados" e a análise só
 * voltava se o usuário reselecionasse o equipamento à mão.
 *
 * ── F-02: o unifilar era chamado com o documento na forma errada ────────────
 * `gerarUnifilarSVG` espera o formato do CONTEXTO do wizard — `projeto.painel`,
 * `projeto.inversor` no topo. O documento persistido tem `equipamentos.paineis[]`
 * e `equipamentos.inversor`. Chamado direto com o documento, ele não achava nem
 * módulo nem inversor e caía nos defaults internos: 550 W, 5 kW, 6 módulos,
 * 3,3 kWp. Um projeto de Ronma 585 W + Solplanet 9,1 kW + 14 módulos era
 * desenhado como outro sistema, calado.
 *
 * O domínio já tinha o caminho certo — `adaptarProjetoParaUnifilar` mais o
 * portão de integridade da FV-DOM-056, que RECUSA desenhar em vez de inventar.
 * A tela passou a consumi-lo pela API.
 */

/** Documento real do catálogo, com os nomes que o SSOT usa de fato. */
const DOC_MODULO = {
  _id: '6a2b5be2a4b8172375c3cb8e', fabricante: 'Ronma Solar', modelo: 'RM-585W-182M/144TB',
  especificacoes: {
    potencia_wp: 585, voc: 53.26, vmp: 45.06, isc: 13.83, imp: 13,
    eficiencia: 22.6, coef_temp_voc: -0.25,
  },
}
const DOC_INVERSOR = {
  _id: '6a260cb78f15d1a73c8384a0', fabricante: 'Solplanet', modelo: 'ASW9100-S',
  especificacoes: {
    potencia_kw: 9.1, n_mppts: 3, fases: 1,
    tensao_max_entrada: 600, tensao_mppt_min: 80, tensao_mppt_max: 560,
    corrente_max_por_mppt: 20, corrente_isc_max: 28,
  },
}

/** O que o contexto do wizard guarda ao selecionar — o objeto adaptado. */
const selecionado = (doc, tipo) => (tipo === 'modulo' ? adaptarModulo(doc) : adaptarInversor(doc))

// ── Caso 1 e 2 — identidade persistida ──────────────────────────────────────

describe('F-03 · a referência ao catálogo chega ao documento', () => {
  it('1. módulo selecionado persiste `equipamento_id`', () => {
    const painel = selecionado(DOC_MODULO, 'modulo')
    expect(painel._id).toBeUndefined()          // a chave que o código antigo lia
    expect(referenciaDoCatalogo(painel)).toBe('6a2b5be2a4b8172375c3cb8e')

    const eq = adaptarEquipamentos({ painel, inversor: null, estrutura: null }, { numPaineis: 14 })
    expect(eq.paineis[0].equipamento_id).toBe('6a2b5be2a4b8172375c3cb8e')
    expect(eq.paineis[0].equipamento_id).not.toBeNull()
    expect(eq.paineis[0].potencia_w).toBe(585)
    expect(eq.paineis[0].quantidade).toBe(14)
  })

  it('2. inversor selecionado persiste `equipamento_id`', () => {
    const inversor = selecionado(DOC_INVERSOR, 'inversor')
    const eq = adaptarEquipamentos({ painel: null, inversor, estrutura: null }, {})
    expect(eq.inversor.equipamento_id).toBe('6a260cb78f15d1a73c8384a0')
    expect(eq.inversor.modelo).toBe('ASW9100-S')
    expect(eq.inversor.potencia_kw).toBe(9.1)
  })

  it('3. id do catálogo LOCAL de contingência não vira referência ao SSOT', () => {
    // `cs550`/`fr5` são ids da tabela histórica. Gravá-los como `equipamento_id`
    // quebraria o cast do schema e apontaria para um equipamento inexistente.
    expect(referenciaDoCatalogo({ id: 'cs550' })).toBeNull()
    expect(referenciaDoCatalogo({ id: 'fr5', _fonte: 'local' })).toBeNull()
    expect(referenciaDoCatalogo(null)).toBeNull()
    expect(referenciaDoCatalogo({})).toBeNull()
  })
})

// ── Caso 3 e 6 — reidratação e equivalência ─────────────────────────────────

describe('F-03 · o envelope volta pela referência', () => {
  it('4. reidratado pelo mesmo adapter é indistinguível do recém-selecionado', () => {
    const fresco = selecionado(DOC_MODULO, 'modulo')
    // É o que a página faz no reload: busca o doc pela referência e adapta.
    const reidratado = adaptarModulo(DOC_MODULO)
    expect(reidratado).toEqual(fresco)
  })

  it('5. o motor recebe o mesmo envelope antes e depois do reload', () => {
    const antes = dadosEletricosPainel({ ...selecionado(DOC_MODULO, 'modulo') })
    const depois = dadosEletricosPainel({ ...adaptarModulo(DOC_MODULO) })
    expect(depois).toEqual(antes)
    expect(depois.voc).toBe(53.26)
    expect(depois.vmpp).toBe(45.06)
    expect(depois.isc).toBe(13.83)
    expect(depois.potencia_w).toBe(585)
  })

  it('6. o inversor também — envelope completo após reidratar', () => {
    const a = adaptarInversor(DOC_INVERSOR)
    const env = dadosEletricosInversor({
      id: a.id, _fonte: a._fonte, potenciaKW: a.potenciaKW,
      tensaoMaxV: a._eletrico.tensao_max_entrada, mpptMinV: a._eletrico.mppt_min,
      mpptMaxV: a._eletrico.mppt_max, correnteMaxA: a._eletrico.corrente_max_mppt,
      correnteIscMaxA: a._eletrico.corrente_isc_max,
    })
    expect(env.tensao_max_entrada).toBe(600)
    expect(env.mppt_min).toBe(80)
    expect(env.mppt_max).toBe(560)
    expect(env.corrente_isc_max_mppt).toBe(28)
  })

  it('7. sem referência, a cópia mínima permanece e a lacuna aparece', () => {
    // Projeto antigo: nunca teve `equipamento_id`. Nada é inventado.
    const semRef = dadosEletricosPainel({ marca: 'Ronma', modelo: 'RM-585W', potencia_w: 585 })
    expect(semRef).toBeNull()
  })
})

// ── Caso 4, 5 e 7 — unifilar ────────────────────────────────────────────────

/** Projeto persistido, na forma real do documento. */
const projetoSalvo = ({ modulos = 14, comEquipamentos = true } = {}) => ({
  _id: '6aa07a703e1f3eabd5747fc6',
  nome: 'Projeto QA',
  equipamentos: comEquipamentos ? {
    paineis: [{
      id: DOC_MODULO._id, marca: 'Ronma Solar', modelo: 'RM-585W-182M/144TB',
      potencia_w: 585, quantidade: modulos, equipamento_id: DOC_MODULO._id,
    }],
    inversor: {
      id: DOC_INVERSOR._id, marca: 'Solplanet', modelo: 'ASW9100-S',
      potencia_kw: 9.1, tipo: 'string', fases: 1, equipamento_id: DOC_INVERSOR._id,
    },
    estrutura: { tipo: 'Fibrocimento' },
  } : { paineis: [], inversor: {}, estrutura: {} },
  dimensionamento: { num_paineis: modulos, num_inversores: 1 },
  engenharia_eletrica: {
    arranjo: {
      quantidade_modulos_por_string: 7, quantidade_strings_paralelo: 2,
      total_modulos: modulos, num_mppts_usados: 1,
      mppts: [{ mppt: 1, strings_paralelo: 2, modulos_por_string: 7, total_modulos: modulos }],
    },
  },
  dadosConsumo: { tipoLigacao: 'monofasico' },
  uf: 'RN',
})

describe('F-02 · o unifilar recebe o projeto na forma que ele espera', () => {
  it('8. o adapter do domínio encontra módulo e inversor reais', () => {
    const { entrada } = adaptarProjetoParaUnifilar(projetoSalvo(), { moduloCatalogo: DOC_MODULO })
    expect(entrada.painel?.marca).toBe('Ronma Solar')
    expect(entrada.painel?.modelo).toBe('RM-585W-182M/144TB')
    expect(entrada.inversor?.marca).toBe('Solplanet')
    expect(entrada.inversor?.modelo).toBe('ASW9100-S')
    // Os defaults internos do motor — 550 W e 5 kW — não podem aparecer.
    expect(entrada.painel?.pmpp ?? entrada.painel?.potencia_w ?? 585).not.toBe(550)
    expect(entrada.inversor?.potenciaKW ?? entrada.inversor?.potencia_kw ?? 9.1).not.toBe(5)
  })

  it('9. chamar o motor com o documento CRU é o que produzia o desenho fictício', () => {
    // Registra o defeito para que ninguém volte a passar o documento direto:
    // sem `painel`/`inversor` no topo, o motor não tem o que ler.
    const cru = projetoSalvo()
    expect(cru.painel).toBeUndefined()
    expect(cru.inversor).toBeUndefined()
    // e o adapter é justamente quem traduz isso
    const { entrada } = adaptarProjetoParaUnifilar(cru, { moduloCatalogo: DOC_MODULO })
    expect(entrada.painel).toBeTruthy()
    expect(entrada.inversor).toBeTruthy()
  })

  it('10. sem equipamento, o domínio RECUSA — não desenha nada fictício', () => {
    const vazio = projetoSalvo({ comEquipamentos: false })
    const { entrada } = adaptarProjetoParaUnifilar(vazio, {})
    const impedimento = avaliarIntegridade(vazio, entrada, {})
    expect(impedimento).toBeTruthy()
    expect(impedimento.codigo).toBeTruthy()
  })

  it('11. composição heterogênea do F-01 sobrevive ao adapter — 21 módulos', () => {
    const p = projetoSalvo({ modulos: 21 })
    p.engenharia_eletrica.arranjo = {
      quantidade_modulos_por_string: 8, quantidade_strings_paralelo: 1,
      total_modulos: 21, num_mppts_usados: 3,
      mppts: [
        { mppt: 1, strings_paralelo: 1, modulos_por_string: 8, total_modulos: 8 },
        { mppt: 2, strings_paralelo: 1, modulos_por_string: 7, total_modulos: 7 },
        { mppt: 3, strings_paralelo: 1, modulos_por_string: 6, total_modulos: 6 },
      ],
    }
    const { entrada } = adaptarProjetoParaUnifilar(p, { moduloCatalogo: DOC_MODULO })
    const total = (entrada.arranjoMPPTs ?? []).reduce(
      (s, m) => s + (m.numStrings ?? m.strings_paralelo ?? 0) * (m.modulosPorString ?? m.modulos_por_string ?? 0), 0)
    expect(total).toBe(21)
    expect(total).not.toBe(24)
  })
})

// ── Guards arquiteturais ────────────────────────────────────────────────────

describe('F-02/F-03 · guards', () => {
  const fonte = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
  const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const E7       = semComentarios(fonte('../../components/fv/etapas/E7Equipamentos.jsx'))
  const API      = semComentarios(fonte('../../services/projetoFVApi.js'))
  const UNIFILAR = semComentarios(fonte('../../components/fv/UnifilarFV.jsx'))
  const PAGINA   = semComentarios(fonte('../../pages/ProjetosFVNovo.jsx'))
  const CATALOGO = semComentarios(fonte('../catalogo.js'))

  it('12. GUARD 1 · a referência nunca volta a ser lida de `_id` cru', () => {
    // `item._id` não existe no objeto da tela — era daí que vinha o `null`.
    for (const [nome, src] of [['E7', E7], ['projetoFVApi', API]]) {
      expect(src, `${nome}`).not.toMatch(/equipamento_id:\s*\w+\._id\s*\|\|/)
      expect(src, `${nome}`).toMatch(/equipamento_id:\s*referenciaDoCatalogo\(/)
    }
  })

  it('13. GUARD 4 · uma implementação só de referência canônica', () => {
    expect(CATALOGO).toMatch(/export function referenciaDoCatalogo/)
    for (const src of [E7, API, PAGINA]) {
      expect(src).not.toMatch(/function referenciaDoCatalogo/)
      expect(src).not.toMatch(/function refDoCatalogo/)
    }
  })

  it('14. GUARD 2 · a tela do unifilar não chama o motor de desenho', () => {
    // Importar o motor aqui é o que permitia chamá-lo com o documento cru.
    expect(UNIFILAR).not.toMatch(/gerarUnifilarSVG\s*\(/)
    expect(UNIFILAR).not.toMatch(/import\s*\{[^}]*\bgerarUnifilarSVG\b/)
    expect(UNIFILAR).toMatch(/unifilar\/gerar/)
  })

  it('15. GUARD 2 · a recusa do domínio é exibida, não engolida', () => {
    expect(UNIFILAR).toMatch(/impedimento/)
    expect(UNIFILAR).toMatch(/setImpedimento/)
  })

  it('16. GUARD 3 · o reload reidrata pelo identificador canônico', () => {
    expect(PAGINA).toMatch(/reidratarEquipamento\(/)
    expect(PAGINA).toMatch(/equipamento_id/)
    // e usa o MESMO adapter da seleção, não um paralelo
    expect(PAGINA).toMatch(/adaptarModulo\(/)
    expect(PAGINA).toMatch(/adaptarInversor\(/)
  })

  it('17. GUARD 5 · a reidratação não persiste uma segunda verdade elétrica', () => {
    // O envelope pertence ao catálogo. Copiá-lo para o projeto o congelaria.
    for (const campo of ['voc:', 'vmpp:', 'isc:', 'coef_temp_voc:']) {
      expect(API, `projetoFVApi grava ${campo}`).not.toMatch(
        new RegExp(`paineis:[\\s\\S]{0,400}${campo}`))
    }
  })
})
