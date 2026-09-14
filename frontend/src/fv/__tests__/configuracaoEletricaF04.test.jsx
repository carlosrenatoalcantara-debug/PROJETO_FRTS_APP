import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const { adaptarProjetoParaUnifilar } =
  await import('../../../../backend/src/dominio/unifilar/adaptarProjeto.js')
const { topologiaSuficiente } =
  await import('../../../../backend/src/dominio/potencia/index.js')

/**
 * F-04 — a configuração elétrica do arranjo tem uma fonte por conceito.
 *
 * ── O que a auditoria mediu ─────────────────────────────────────────────────
 * `engenharia_eletrica` e `arranjos[].configuracao_eletrica` pareciam duas
 * moradas para a mesma coisa. Não são — a maior parte do que guardam é
 * disjunta, e o Core já lê cada conceito de um lugar só:
 *
 *   topologia STRING detalhada  → `engenharia_eletrica.arranjo`
 *   clima e veredito do motor   → `engenharia_eletrica`
 *   topologia MICRO por modelo  → `arranjos[].configuracao_eletrica.micros[]`
 *   configuração PRELIMINAR     → `arranjos[].configuracao_eletrica.quantidade_*`
 *
 * A sobreposição real é estreita: os campos de topologia STRING que a
 * P0-ARRANJO-ELECTRICAL-ISOLATION-01 abriu dentro de `configuracao_eletrica`
 * (`mppts[]`, `num_mppts_usados`, `total_modulos`, `n_mppts`, `strings_por_mppt`).
 * Eles são escritos e relidos SÓ pela tela `GerenciadorArranjos`, num circuito
 * fechado, e estavam vazios nos 589 projetos do acervo.
 *
 * ── A decisão ───────────────────────────────────────────────────────────────
 * Fonte do Core agora: `engenharia_eletrica.arranjo`.
 * `arranjos[].configuracao_eletrica.mppts`: LEGACY isolado — a UX que já o usa
 * continua funcionando, e nenhum consumidor do Core pode lê-lo.
 * Destino arquitetural: topologia pertence ao arranjo, e a migração dos
 * consumidores é sprint própria, com testes de equivalência, antes de a escrita
 * LEGACY parar. Nenhuma terceira estrutura foi criada.
 */

const fonte = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const DOC_MODULO = {
  _id: '6a2b5be2a4b8172375c3cb8e', fabricante: 'Ronma Solar', modelo: 'RM-585W-182M/144TB',
  especificacoes: { potencia_wp: 585, voc: 53.26, vmp: 45.06, isc: 13.83, imp: 13, coef_temp_voc: -0.25 },
}

/** Projeto na forma real, com a topologia string onde o Core a lê. */
const projeto = ({ mppts, cfgArranjo = null } = {}) => ({
  _id: '6aa1915bc628402b6502b749',
  equipamentos: {
    paineis: [{ marca: 'Ronma Solar', modelo: 'RM-585W-182M/144TB', potencia_w: 585,
      quantidade: mppts.reduce((s, m) => s + m.strings_paralelo * m.modulos_por_string, 0),
      equipamento_id: DOC_MODULO._id }],
    inversor: { marca: 'Solplanet', modelo: 'ASW9100-S', potencia_kw: 9.1, tipo: 'string', fases: 1 },
    estrutura: { tipo: 'Fibrocimento' },
  },
  arranjos: [{ tipo: 'principal', paineis: [], inversores: [],
    ...(cfgArranjo ? { configuracao_eletrica: cfgArranjo } : {}) }],
  engenharia_eletrica: {
    arranjo: {
      quantidade_modulos_por_string: Math.max(...mppts.map((m) => m.modulos_por_string)),
      quantidade_strings_paralelo: Math.max(...mppts.map((m) => m.strings_paralelo)),
      total_modulos: mppts.reduce((s, m) => s + m.strings_paralelo * m.modulos_por_string, 0),
      num_mppts_usados: mppts.filter((m) => m.total_modulos > 0).length,
      mppts,
    },
  },
  dimensionamento: { num_paineis: mppts.reduce((s, m) => s + m.total_modulos, 0) },
})

const mppt = (i, strings, mods) => ({
  mppt: i, strings_paralelo: strings, modulos_por_string: mods, total_modulos: strings * mods,
})

const totalDoAdapter = (p) => {
  const { entrada } = adaptarProjetoParaUnifilar(p, { moduloCatalogo: DOC_MODULO })
  return (entrada.arranjoMPPTs ?? []).reduce(
    (s, m) => s + (m.numStrings ?? 0) * (m.modulosPorString ?? 0), 0)
}

// ── Casos 1 a 4 — a fonte canônica sustenta o arranjo ───────────────────────

describe('F-04 · a topologia string vem de uma fonte só', () => {
  it('1. projeto novo: o Core lê `engenharia_eletrica.arranjo`', () => {
    const p = projeto({ mppts: [mppt(1, 2, 7)] })
    const { entrada, proveniencia } = adaptarProjetoParaUnifilar(p, { moduloCatalogo: DOC_MODULO })
    expect(entrada.arranjoMPPTs).toHaveLength(1)
    expect(totalDoAdapter(p)).toBe(14)
    // A proveniência nomeia a fonte — e é a do projeto, não a do arranjo.
    expect(JSON.stringify(proveniencia)).toMatch(/engenharia_eletrica\.arranjo\.mppts/)
    expect(JSON.stringify(proveniencia)).not.toMatch(/configuracao_eletrica\.mppts/)
  })

  it('2. o portão de suficiência aponta a mesma fonte', () => {
    const { entrada } = adaptarProjetoParaUnifilar(projeto({ mppts: [mppt(1, 2, 7)] }),
      { moduloCatalogo: DOC_MODULO })
    const porta = topologiaSuficiente(entrada)
    expect(porta.suficiente).toBe(true)
    expect(porta.topologia).toBe('string')

    const semTopologia = adaptarProjetoParaUnifilar(
      { ...projeto({ mppts: [mppt(1, 2, 7)] }), engenharia_eletrica: {} },
      { moduloCatalogo: DOC_MODULO })
    const vazia = topologiaSuficiente(semTopologia.entrada)
    expect(vazia.lacunas).toContain('engenharia_eletrica.arranjo.mppts')
    expect(vazia.lacunas.join(' ')).not.toMatch(/configuracao_eletrica\.mppts/)
  })

  it('3. múltiplos MPPTs com um vazio — ocupados = 2, total = 14 (F-01)', () => {
    const p = projeto({ mppts: [mppt(1, 1, 7), mppt(2, 1, 7), mppt(3, 0, 0)] })
    expect(p.engenharia_eletrica.arranjo.num_mppts_usados).toBe(2)
    expect(p.engenharia_eletrica.arranjo.total_modulos).toBe(14)
    expect(totalDoAdapter(p)).toBe(14)
    expect(totalDoAdapter(p)).not.toBe(21)   // 7 × 3
  })

  it('4. heterogêneo 8+7+6 = 21, sem multiplicação artificial', () => {
    const p = projeto({ mppts: [mppt(1, 1, 8), mppt(2, 1, 7), mppt(3, 1, 6)] })
    expect(totalDoAdapter(p)).toBe(21)
    expect(totalDoAdapter(p)).not.toBe(24)
  })
})

// ── Casos 5 a 7 — legado, conflito e ausência ───────────────────────────────

describe('F-04 · LEGACY, conflito e ausência', () => {
  it('5. estrutura LEGACY divergente NÃO altera o veredito do Core', () => {
    // O conflito não é resolvido por ordem de leitura: a estrutura LEGACY
    // simplesmente não é consultada. Divergir dela é inócuo, por desenho.
    const cfgMentirosa = {
      mppts: [mppt(1, 9, 9)], num_mppts_usados: 9, total_modulos: 81,
      quantidade_modulos_por_string: 9, quantidade_strings_paralelo: 9,
    }
    const comLegado = projeto({ mppts: [mppt(1, 2, 7)], cfgArranjo: cfgMentirosa })
    const semLegado = projeto({ mppts: [mppt(1, 2, 7)] })
    expect(totalDoAdapter(comLegado)).toBe(14)
    expect(totalDoAdapter(comLegado)).toBe(totalDoAdapter(semLegado))
    expect(totalDoAdapter(comLegado)).not.toBe(81)
  })

  it('6. legado só com `configuracao_eletrica` → lacuna declarada, sem corrupção', () => {
    const p = projeto({ mppts: [mppt(1, 2, 7)], cfgArranjo: { mppts: [mppt(1, 2, 7)] } })
    p.engenharia_eletrica = {}
    const { entrada } = adaptarProjetoParaUnifilar(p, { moduloCatalogo: DOC_MODULO })
    const porta = topologiaSuficiente(entrada)
    expect(porta.suficiente).toBe(false)
    expect(porta.lacunas).toContain('engenharia_eletrica.arranjo.mppts')
  })

  it('7. sem configuração nenhuma → ausência explícita, nada fabricado', () => {
    const p = projeto({ mppts: [mppt(1, 2, 7)] })
    p.engenharia_eletrica = {}
    p.arranjos = [{ tipo: 'principal', paineis: [], inversores: [] }]
    const { entrada } = adaptarProjetoParaUnifilar(p, { moduloCatalogo: DOC_MODULO })
    expect(entrada.arranjoMPPTs).toBeNull()
    const porta = topologiaSuficiente(entrada)
    expect(porta.suficiente).toBe(false)
  })

  it('8. `micros[]` continua CANÔNICO — não é legacy', () => {
    // O bloco micro mora no mesmo subdocumento e tem status oposto: é a fonte
    // que o domínio inteiro consome. Não pode ser varrido junto.
    const p = projeto({ mppts: [mppt(1, 2, 7)] })
    p.arranjos = [{ tipo: 'principal', topologia: 'micro',
      inversores: [{ marca: 'Hoymiles', modelo: 'HMS-2000-4T', quantidade: 4, equipamento_id: null }],
      configuracao_eletrica: { micros: [{ marca: 'Hoymiles', modelo: 'HMS-2000-4T',
        quantidade: 4, entradas_por_micro: 4, modulos_por_entrada: 1, distribuicao: [4, 4, 4, 2] }] } }]
    const { entrada, proveniencia } = adaptarProjetoParaUnifilar(p, { moduloCatalogo: DOC_MODULO })
    expect(entrada.topologia).toBe('micro')
    expect(entrada.micros).toBeTruthy()
    expect(JSON.stringify(proveniencia)).toMatch(/configuracao_eletrica\.micros/)
  })
})

// ── Guards ──────────────────────────────────────────────────────────────────

describe('F-04 · guards', () => {
  /** Todo o código de produção do Core: domínio, serviços e controllers. */
  const arquivosCore = () => {
    // `process.cwd()` é a raiz do frontend quando o vitest roda.
    const raiz = path.resolve(process.cwd(), '../backend/src')
    const out = []
    const anda = (dir) => {
      for (const nome of readdirSync(dir)) {
        const p = path.join(dir, nome)
        if (statSync(p).isDirectory()) {
          if (nome === '__checks__' || nome === '__tests__' || nome === 'node_modules') continue
          anda(p)
        } else if (nome.endsWith('.js')) out.push(p)
      }
    }
    anda(raiz)
    return out
  }

  it('9. GUARD 2/3 · nenhum consumidor do Core LÊ a topologia string LEGACY', () => {
    // `micros` é canônico e continua permitido; o que não pode é o Core ACESSAR
    // a topologia string de dentro de `configuracao_eletrica`. O padrão exige o
    // acesso de propriedade imediato — `configuracao_eletrica?.mppts` — para não
    // confundir com a string de `.select()`, onde os nomes aparecem lado a lado.
    const proibido = /configuracao_eletrica\s*\??\.\s*(mppts|num_mppts_usados|n_mppts|strings_por_mppt|quantidade_modulos_por_string|quantidade_strings_paralelo|total_modulos)\b/
    // Sanidade: o guard varre código de verdade, e o padrão pega o que deve.
    expect(arquivosCore().length).toBeGreaterThan(50)
    expect(proibido.test('const x = a?.configuracao_eletrica?.mppts')).toBe(true)
    expect(proibido.test("select('arranjos.configuracao_eletrica.micros e.arranjo.mppts')")).toBe(false)
    expect(proibido.test('const m = a?.configuracao_eletrica?.micros')).toBe(false)
    // F14-IMP: `arranjosCanonicos.js` é o adapter de migração — a função dele é
    // ler os DOIS modelos e devolver um só, com a procedência declarada. Não é
    // consumidor do Core: é a camada que os consumidores vão usar NO LUGAR de
    // ler a estrutura crua. A exceção aperta a regra em vez de afrouxá-la —
    // "exatamente um módulo lê, e é aquele cujo trabalho é esse".
    const AUTORIZADOS = new Set(['arranjosCanonicos.js'])
    const infratores = []
    for (const arq of arquivosCore()) {
      if (arq.includes(`${path.sep}models${path.sep}`)) continue   // schema declara, não lê
      if (AUTORIZADOS.has(path.basename(arq))) continue
      const src = semComentarios(readFileSync(arq, 'utf8'))
      if (proibido.test(src)) infratores.push(path.basename(arq))
    }
    expect(infratores, `leitores indevidos: ${infratores.join(', ')}`).toEqual([])
    // A exceção só vale enquanto o autorizado existir e de fato ler — senão é
    // letra morta escondendo uma regra que deixou de ser verificada.
    const adapter = arquivosCore().find((f) => path.basename(f) === 'arranjosCanonicos.js')
    expect(adapter, 'o adapter autorizado precisa existir').toBeTruthy()
    expect(proibido.test(semComentarios(readFileSync(adapter, 'utf8')))).toBe(true)
  })

  it('10. GUARD 1 · o Core lê topologia string de UMA fonte', () => {
    const POTENCIA = semComentarios(fonte('../../../../backend/src/dominio/potencia/index.js'))
    const ADAPTER  = semComentarios(fonte('../../../../backend/src/dominio/unifilar/adaptarProjeto.js'))
    for (const src of [POTENCIA, ADAPTER]) {
      expect(src).toMatch(/engenharia_eletrica\?\.arranjo|engenharia_eletrica\.arranjo/)
    }
    // e o adapter é o ponto único de tradução — o Core não relê o documento cru
    expect(POTENCIA).toMatch(/adaptarProjetoParaUnifilar/)
  })

  it('11. GUARD 3 · a estrutura LEGACY está declarada como tal no schema', () => {
    const SCHEMA = fonte('../../../../backend/src/models/ProjetoFV.js')
    const bloco = SCHEMA.slice(SCHEMA.indexOf('configuracao_eletrica:'),
      SCHEMA.indexOf('configuracao_eletrica:') + 6000)
    expect(bloco).toMatch(/LEGACY/)
    expect(bloco).toMatch(/NÃO É FONTE DE VERDADE DE ENGENHARIA/)
  })

  it('12. GUARD 7 · não existe uma terceira estrutura persistida', () => {
    const SCHEMA = fonte('../../../../backend/src/models/ProjetoFV.js')
    for (const inventada of [
      'configuracao_eletrica_canonica', 'configuracao_eletrica_final',
      'configuracao_eletrica_resolvida', 'engenharia_eletrica_v2',
    ]) expect(SCHEMA).not.toMatch(new RegExp(inventada))
  })

  it('13. GUARD 6 · F-01 preservado no único escritor da estrutura LEGACY', () => {
    const GER = semComentarios(fonte('../../components/fv/GerenciadorArranjos.jsx'))
    // `num_mppts_usados` são os OCUPADOS — nunca o número de MPPTs do editor.
    expect(GER).not.toMatch(/num_mppts_usados:\s*mppts\.length/)
    expect(GER).toMatch(/num_mppts_usados:\s*ocupados/)
    expect(GER).toMatch(/filter\(m\s*=>\s*m\.total_modulos\s*>\s*0\)/)
  })

  it('14. GUARD 1 · o escritor LEGACY continua sendo só a tela de arranjos', () => {
    const escritores = []
    for (const arq of arquivosCore()) {
      if (arq.includes(`${path.sep}models${path.sep}`)) continue   // schema declara, não escreve
      const src = semComentarios(readFileSync(arq, 'utf8'))
      if (/configuracao_eletrica\s*:\s*\{[^}]*mppts/.test(src)) escritores.push(path.basename(arq))
    }
    expect(escritores).toEqual([])
  })
})
