import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { render, screen } from '@testing-library/react'

import {
  agruparMicrosEmArranjos, balancearFases, fasesDaInstalacao, planejarMicros, planoObsoleto,
} from '@fortesolar/fv-shared/engenharia/arranjos-micro'
import { regraDeArranjoMicro } from '@fortesolar/fv-shared/engenharia/regras-micro-fabricante'
import { CAMPOS_INVERSOR, lerInversor } from '@fortesolar/fv-shared/inversores/dicionario'
import {
  configDaComposicao, daConfigPersistida, obsolescenciaDoBloco, paraArranjoComMicros,
  paraConfigPersistida, planoDoBloco,
} from '../microinversores'
// A tela lê o projeto pelo provider; aqui só interessa o que ela DESENHA.
vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({
    projetoId: 'p1', projeto: { _id: 'p1', arranjos: [] }, carregando: false, erro: null,
    recarregar: vi.fn(), acoes: { salvarEtapa: vi.fn() },
  }),
}))

const { default: EtapaMicroinversores } = await import('../paginas/etapas/EtapaMicroinversores')

/**
 * Sprint E — arranjos de microinversores, distribuição e balanceamento de fases.
 *
 * O que estes testes protegem:
 *  1. a distribuição de módulos entre micros continua a da FV-DOM-031 (equilíbrio)
 *     e o agrupamento de micros em arranjos é ENCHIMENTO — duas aritméticas
 *     diferentes de propósito, e nenhuma delas reescrita no frontend;
 *  2. a regra de agrupamento vem do catálogo do modelo ou da tabela do
 *     fabricante — jamais de um default, jamais herdada entre fabricantes;
 *  3. sem regra declarada não há arranjo: a lacuna é dita, não preenchida;
 *  4. monofásico não ganha balanceamento fabricado; trifásico ganha, e o
 *     resíduo aparece em vez de sumir;
 *  5. mudar quantidade, modelo ou fases refaz o plano, e o que estava salvo é
 *     denunciado como obsoleto em vez de continuar valendo em silêncio;
 *  6. o caminho STRING não é tocado por nada disto.
 */

const DEYE = { entradas: 4, modulos_por_entrada: 1, fabricante: 'Deye' }
const HOYMILES = { entradas: 4, modulos_por_entrada: 1, fabricante: 'Hoymiles' }

const EQ_DEYE = {
  _id: 'mi1', tipo: 'inversor', fabricante: 'Deye', modelo: 'SUN-M2000G4',
  especificacoes: {
    potencia: 2, fases: 1, tensao_max_entrada: 60, entradas: 4,
    modulos_por_entrada: 1, oversizing_max: 1.25,
  },
}
const EQ_HOYMILES = {
  _id: 'mi2', tipo: 'inversor', fabricante: 'Hoymiles', modelo: 'HMS-2000-4T',
  especificacoes: {
    potencia: 2, fases: 1, tensao_max_entrada: 60, entradas: 4,
    modulos_por_entrada: 1, oversizing_max: 1.25,
  },
}

const fonte = (rel) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

// ── §15.1–15.4 — distribuição automática entre os micros ────────────────────

describe('distribuição de módulos entre microinversores', () => {
  it('1. 24 módulos, 6 micros, 4 entradas → 4 em cada um', () => {
    const p = planejarMicros({ modulos: 24, quantidade: 6, micro: DEYE, fases: 'Monofásico' })
    expect(p.distribuicao).toEqual([4, 4, 4, 4, 4, 4])
    expect(p.capacidade_por_micro).toBe(4)
  })

  it('2. 23 módulos em 6 micros → 4/4/4/4/4/3, com a sobra no último', () => {
    const p = planejarMicros({ modulos: 23, quantidade: 6, micro: DEYE, fases: 'Monofásico' })
    expect(p.distribuicao).toEqual([4, 4, 4, 4, 4, 3])
  })

  it('3. é determinística — a mesma entrada dá exatamente o mesmo plano', () => {
    const entrada = { modulos: 23, quantidade: 7, micro: DEYE, fases: 'Trifásico' }
    expect(JSON.stringify(planejarMicros(entrada))).toBe(JSON.stringify(planejarMicros(entrada)))
  })

  it('4. cada micro é identificável — distribuição e entradas por unidade', () => {
    const p = planejarMicros({ modulos: 24, quantidade: 6, micro: DEYE, fases: 'Monofásico' })
    expect(p.distribuicao).toHaveLength(6)
    expect(p.entradas_por_micro_usadas).toEqual(Array.from({ length: 6 }, () => [1, 1, 1, 1]))
    // Micro 1..N na tela, não uma caixa genérica.
    render(
      <EtapaMicroinversores
        catalogoInversores={[EQ_DEYE]}
        arranjoPrincipal={{
          tipo: 'principal', topologia: 'micro',
          inversores: [{ equipamento_id: 'mi1', quantidade: 6 }],
          paineis: [{ equipamento_id: 'm1', quantidade: 24 }],
        }}
        totalModulos={24} potenciaModuloW={650} fases="Monofásico"
      />,
    )
    for (let k = 1; k <= 6; k += 1) {
      expect(screen.getByLabelText(`Micro ${k}`)).toBeTruthy()
    }
    expect(screen.queryByLabelText('Micro 7')).toBeNull()
  })
})

// ── §15.5–15.8 — regra de fabricante e formação dos arranjos ────────────────

describe('agrupamento de micros em arranjos', () => {
  it('5. a regra Deye é de 3 micros por arranjo, e vem da tabela do fabricante', () => {
    const r = regraDeArranjoMicro(DEYE)
    expect(r.max_por_cabo_tronco).toBe(3)
    expect(r.fonte).toBe('fabricante')
    expect(r.procedencia).toBeTruthy()
  })

  it('6. 6 micros → 3 + 3', () => {
    expect(agruparMicrosEmArranjos(6, 3)).toEqual([3, 3])
    expect(planejarMicros({ modulos: 24, quantidade: 6, micro: DEYE, fases: 'Monofásico' })
      .arranjos.map((a) => a.micros)).toEqual([[1, 2, 3], [4, 5, 6]])
  })

  it('7. 7 micros → 3 + 3 + 1 (enchimento, não equilíbrio)', () => {
    expect(agruparMicrosEmArranjos(7, 3)).toEqual([3, 3, 1])
  })

  it('8. 8 micros → 3 + 3 + 2', () => {
    expect(agruparMicrosEmArranjos(8, 3)).toEqual([3, 3, 2])
  })

  it('9. outro fabricante NÃO herda a regra Deye', () => {
    expect(regraDeArranjoMicro(HOYMILES).max_por_cabo_tronco).toBeNull()
    expect(regraDeArranjoMicro(HOYMILES).fonte).toBeNull()
    const p = planejarMicros({ modulos: 24, quantidade: 6, micro: HOYMILES, fases: 'Trifásico' })
    expect(p.arranjos).toBeNull()
  })

  it('10. sem regra no SSOT: lacuna nomeada, nenhuma distribuição aparentemente válida', () => {
    const p = planejarMicros({ modulos: 24, quantidade: 6, micro: HOYMILES, fases: 'Trifásico' })
    expect(p.completo).toBe(false)
    expect(p.lacunas.join(' ')).toMatch(/limite de microinversores por arranjo/i)
    expect(p.fases.atribuicao).toBeNull()
  })

  it('o catálogo do MODELO vence a tabela do fabricante', () => {
    const r = regraDeArranjoMicro({ ...DEYE, max_por_cabo_tronco: 5 })
    expect(r.max_por_cabo_tronco).toBe(5)
    expect(r.fonte).toBe('catalogo')
  })

  it('o campo é canônico no dicionário do SSOT e é lido de `especificacoes`', () => {
    expect(CAMPOS_INVERSOR.max_por_cabo_tronco).toBeTruthy()
    expect(lerInversor({ max_micros_por_ramal: 3 }).max_por_cabo_tronco).toBe(3)
    expect(lerInversor({}).max_por_cabo_tronco).toBeNull()
  })
})

// ── §15.11–15.13 — fases ────────────────────────────────────────────────────

describe('balanceamento de fases', () => {
  it('11. monofásico não ganha balanceamento fabricado', () => {
    const p = planejarMicros({ modulos: 24, quantidade: 6, micro: DEYE, fases: 'Monofásico' })
    expect(p.fases.n).toBe(1)
    expect(p.fases.atribuicao).toBeNull()
    expect(p.arranjos.every((a) => a.fase === null)).toBe(true)
    expect(balancearFases([3, 3], 1)).toBeNull()
  })

  it('12. trifásico: 9 micros → 3 em L1, 3 em L2, 3 em L3', () => {
    const p = planejarMicros({ modulos: 36, quantidade: 9, micro: DEYE, fases: 'Trifásico' })
    expect(p.arranjos.map((a) => a.fase)).toEqual(['L1', 'L2', 'L3'])
    expect(p.fases.por_fase).toEqual({ L1: 3, L2: 3, L3: 3 })
    expect(p.fases.equilibrado).toBe(true)
  })

  it('13. quantidade não divisível: resíduo determinístico e declarado', () => {
    const p = planejarMicros({ modulos: 32, quantidade: 8, micro: DEYE, fases: 'Trifásico' })
    expect(p.fases.por_fase).toEqual({ L1: 3, L2: 3, L3: 2 })
    expect(p.fases.desequilibrio).toBe(1)
    expect(p.fases.equilibrado).toBe(false)
    expect(p.avisos.join(' ')).toMatch(/desequilibradas em 1/i)
    // Determinístico: nunca L3 primeiro por acaso.
    expect(planejarMicros({ modulos: 32, quantidade: 8, micro: DEYE, fases: 'Trifásico' })
      .fases.por_fase).toEqual(p.fases.por_fase)
  })

  it('lê a fase pelo rótulo da etapa Projeto, com ou sem acento', () => {
    expect(fasesDaInstalacao('Monofásico')).toBe(1)
    expect(fasesDaInstalacao('Monofasico')).toBe(1)
    expect(fasesDaInstalacao('Trifásico'.normalize('NFD'))).toBe(3)
    expect(fasesDaInstalacao('Bifásico')).toBe(2)
    expect(fasesDaInstalacao(null)).toBeNull()
    expect(fasesDaInstalacao('')).toBeNull()
  })

  it('fase ausente vira lacuna — nunca monofásico por default', () => {
    const p = planejarMicros({ modulos: 24, quantidade: 6, micro: DEYE, fases: null })
    expect(p.fases).toBeNull()
    expect(p.lacunas.join(' ')).toMatch(/fases da instalação/i)
  })
})

// ── §15.14–15.15 e §20 — recálculo e estado obsoleto ────────────────────────

describe('alterações de configuração', () => {
  it('14. mudar a quantidade de micros refaz distribuição e arranjos', () => {
    const antes = planejarMicros({ modulos: 24, quantidade: 6, micro: DEYE, fases: 'Trifásico' })
    const depois = planejarMicros({ modulos: 24, quantidade: 8, micro: DEYE, fases: 'Trifásico' })
    expect(antes.distribuicao).toEqual([4, 4, 4, 4, 4, 4])
    expect(depois.distribuicao).toEqual([3, 3, 3, 3, 3, 3, 3, 3])
    expect(antes.arranjos).toHaveLength(2)
    expect(depois.arranjos).toHaveLength(3)
  })

  it('15. mudar o modelo refaz o plano — e pode remover a regra', () => {
    const deye = planejarMicros({ modulos: 24, quantidade: 6, micro: DEYE, fases: 'Trifásico' })
    const outro = planejarMicros({ modulos: 24, quantidade: 6, micro: HOYMILES, fases: 'Trifásico' })
    expect(deye.arranjos).toHaveLength(2)
    expect(outro.arranjos).toBeNull()
    // Modelo com outra capacidade muda a distribuição de módulos.
    const maior = planejarMicros({
      modulos: 24, quantidade: 6, fases: 'Trifásico',
      micro: { entradas: 2, modulos_por_entrada: 1, fabricante: 'Deye' },
    })
    expect(maior.distribuicao).toEqual([2, 2, 2, 2, 2, 2])
  })

  it('§20 — o agrupamento salvo que não descreve mais a configuração é denunciado', () => {
    const plano = planejarMicros({ modulos: 32, quantidade: 8, micro: DEYE, fases: 'Trifásico' })
    const salvoAntigo = [{ micros: [1, 2, 3], fase: 'L1' }, { micros: [4, 5, 6], fase: 'L2' }]
    const r = planoObsoleto(salvoAntigo, plano)
    expect(r.obsoleto).toBe(true)
    expect(r.motivos.join(' ')).toMatch(/6 microinversor\(es\) e a configuração atual tem 8/)
    // Coerente consigo mesmo não acusa nada.
    expect(planoObsoleto(
      plano.arranjos.map((a) => ({ micros: a.micros, fase: a.fase })), plano,
    ).obsoleto).toBe(false)
    // Projeto legado sem agrupamento não é "obsoleto" — é apenas ausente.
    expect(planoObsoleto(undefined, plano).obsoleto).toBe(false)
    expect(planoObsoleto([], plano).obsoleto).toBe(false)
  })

  it('mudar as fases muda a atribuição, e o salvo passa a divergir', () => {
    const tri = planejarMicros({ modulos: 24, quantidade: 6, micro: DEYE, fases: 'Trifásico' })
    const mono = planejarMicros({ modulos: 24, quantidade: 6, micro: DEYE, fases: 'Monofásico' })
    const salvoTri = tri.arranjos.map((a) => ({ micros: a.micros, fase: a.fase }))
    expect(planoObsoleto(salvoTri, mono).motivos.join(' ')).toMatch(/atribuição de fases mudou/i)
  })
})

// ── §17 — persistência ──────────────────────────────────────────────────────

describe('persistência', () => {
  const composicao = [{ equipamento_id: 'mi1', quantidade: 6 }]

  it('configuração → salvar → reler devolve a mesma distribuição, arranjos e fases', () => {
    const config = configDaComposicao(composicao, [EQ_DEYE], 24)
    const persistida = paraConfigPersistida(config, 'Trifásico')

    expect(persistida[0].equipamento_id).toBe('mi1')
    expect(persistida[0].distribuicao).toEqual([4, 4, 4, 4, 4, 4])
    expect(persistida[0].arranjos).toEqual([
      { micros: [1, 2, 3], fase: 'L1' },
      { micros: [4, 5, 6], fase: 'L2' },
    ])

    const relida = daConfigPersistida(persistida, [EQ_DEYE])
    expect(relida[0].quantidade).toBe(6)
    expect(relida[0].modulos).toBe(24)
    expect(relida[0].arranjos).toEqual(persistida[0].arranjos)
    // O plano recalculado sobre o que voltou é idêntico ao que foi gravado.
    const plano = planoDoBloco(relida[0], 'Trifásico')
    expect(plano.distribuicao).toEqual([4, 4, 4, 4, 4, 4])
    expect(plano.arranjos.map((a) => ({ micros: a.micros, fase: a.fase })))
      .toEqual(persistida[0].arranjos)
    expect(obsolescenciaDoBloco(relida[0], 'Trifásico').obsoleto).toBe(false)
  })

  it('`equipamento_id` continua canônico e nenhuma ficha técnica é duplicada', () => {
    const persistida = paraConfigPersistida(
      configDaComposicao(composicao, [EQ_DEYE], 24), 'Trifásico')
    const gravado = Object.keys(persistida[0])
    expect(gravado).toContain('equipamento_id')
    // O limite do fabricante e o envelope elétrico são do CATÁLOGO — não vão ao projeto.
    expect(gravado).not.toContain('max_por_cabo_tronco')
    expect(gravado).not.toContain('_max_por_cabo_tronco')
    expect(gravado).not.toContain('oversizing_max')
    expect(gravado).not.toContain('potencia_kw')
  })

  it('sem regra declarada, `arranjos` não é gravado — ausência é diferente de vazio', () => {
    const persistida = paraConfigPersistida(
      configDaComposicao([{ equipamento_id: 'mi2', quantidade: 6 }], [EQ_HOYMILES], 24),
      'Trifásico')
    expect(persistida[0].arranjos).toBeUndefined()
  })

  it('reler um projeto legado sem `arranjos` não inventa agrupamento', () => {
    const relida = daConfigPersistida(
      [{ equipamento_id: 'mi1', marca: 'Deye', modelo: 'SUN-M2000G4', quantidade: 6,
        entradas_por_micro: 4, modulos_por_entrada: 1, distribuicao: [4, 4, 4, 4, 4, 4] }],
      [EQ_DEYE])
    expect(relida[0].arranjos).toBeNull()
    expect(obsolescenciaDoBloco(relida[0], 'Trifásico').obsoleto).toBe(false)
  })
})

// ── §16 — o caminho STRING permanece íntegro ────────────────────────────────

describe('caminho STRING não é tocado', () => {
  it('gravar micros preserva a topologia detalhada de string do mesmo arranjo', () => {
    const arranjo = {
      tipo: 'principal', topologia: 'micro',
      configuracao_eletrica: {
        n_mppts: 2, quantidade_modulos_por_string: 12, quantidade_strings_paralelo: 2,
        mppts: [{ mppt: 1, strings_paralelo: 1, modulos_por_string: 12 }],
      },
    }
    const saida = paraArranjoComMicros(
      arranjo, configDaComposicao([{ equipamento_id: 'mi1', quantidade: 6 }], [EQ_DEYE], 24),
      'Trifásico')
    const ce = saida.configuracao_eletrica
    expect(ce.n_mppts).toBe(2)
    expect(ce.mppts).toEqual(arranjo.configuracao_eletrica.mppts)
    expect(ce.quantidade_modulos_por_string).toBe(12)
    expect(ce.quantidade_strings_paralelo).toBe(2)
    // `arranjos` mora DENTRO de cada micro, nunca solto na configuração elétrica.
    expect(ce.arranjos).toBeUndefined()
    expect(ce.micros[0].arranjos).toHaveLength(2)
  })

  it('o motor de arranjos não importa nada do caminho string', () => {
    const src = fonte('../../../../packages/fv-shared/engenharia/arranjosMicro.js')
    expect(src).not.toMatch(/mppt/i)
    expect(src).not.toMatch(/from '\.\/engenhariaNormativa/)
  })
})

// ── Guardas de arquitetura ──────────────────────────────────────────────────

describe('guardas', () => {
  it('nenhum fabricante é hardcodado no componente React nem no adaptador', () => {
    for (const rel of [
      '../paginas/etapas/EtapaMicroinversores.jsx',
      '../microinversores.js',
      '../paginas/etapas/EtapaMppt.jsx',
    ]) {
      const src = fonte(rel).replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, '$1')
      expect(src, rel).not.toMatch(/\bDeye\b/i)
      expect(src, rel).not.toMatch(/\bHoymiles\b/i)
    }
  })

  it('a regra de agrupamento não é reescrita no frontend — só consumida', () => {
    const src = fonte('../microinversores.js')
    expect(src).toMatch(/from '@fortesolar\/fv-shared\/engenharia\/arranjos-micro'/)
    // Nenhum limite numérico de arranjo escrito à mão deste lado.
    expect(src).not.toMatch(/max_por_cabo_tronco\s*[:=]\s*\d/)
  })

  it('a tabela de fabricantes exige procedência declarada', () => {
    const src = fonte('../../../../packages/fv-shared/engenharia/regrasMicroFabricante.js')
    const entradas = src.match(/max_por_cabo_tronco: \d+/g) ?? []
    const procedencias = src.match(/procedencia:\s*\n?\s*'/g) ?? []
    expect(entradas.length).toBeGreaterThan(0)
    expect(procedencias.length).toBeGreaterThanOrEqual(entradas.length)
  })
})
