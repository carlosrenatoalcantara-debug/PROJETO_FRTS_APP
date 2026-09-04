import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { render, screen } from '@testing-library/react'

import {
  planejarMicros, planejarComposicaoMicro, planoObsoleto, POLITICA_ARRANJOS,
} from '@fortesolar/fv-shared/engenharia/arranjos-micro'
import {
  avaliarCorrenteMicro, correnteDaEntrada, correnteDoMicro, correnteDoRamal, VEREDITO,
} from '@fortesolar/fv-shared/engenharia/corrente-micro'
import { lerInversor } from '@fortesolar/fv-shared/inversores/dicionario'
import { FATOR_ISC_NBR16690 } from '@fortesolar/fv-shared/engenharia/normativa'
import {
  configDaComposicao, correnteDoBloco, daConfigPersistida, obsolescenciaDaComposicao,
  paraArranjoComMicros, paraConfigPersistida, planoDaComposicao, procedenciaDaCapacidade,
} from '../microinversores'

/**
 * Sprint E2 — fechamento das quatro lacunas de microinversores.
 *
 * O que estes testes protegem:
 *  1. capacidade só existe quando os dados existem, e a PROCEDÊNCIA (catálogo ou
 *     operador) nunca se perde pelo caminho;
 *  2. corrente é motor separado, reusa `correnteProjeto` (NBR 16690) e devolve
 *     `nao_avaliado` sempre que o limite não é declarado — nunca "ok" por omissão;
 *  3. a política de arranjos × fases é nomeada, determinística, e a fase vazia é
 *     campo próprio em vez de um zero a interpretar;
 *  4. composição com dois modelos não é tratada como bloco homogêneo: capacidade
 *     e regra ficam por modelo, e só o balanceamento é global;
 *  5. nada é inventado — nem entradas, nem limite de ramal, nem regra herdada.
 */

const DEYE = { entradas: 4, modulos_por_entrada: 1, fabricante: 'Deye', rotulo: 'Deye', origem: 'ssot' }
const SEM_ENTRADAS = { modulos_por_entrada: 1, fabricante: 'Deye', rotulo: 'Deye' }
const SEM_MOD_ENTRADA = { entradas: 4, fabricante: 'Deye', rotulo: 'Deye' }
const HOY = { entradas: 2, modulos_por_entrada: 1, fabricante: 'Hoymiles', rotulo: 'Hoymiles' }

/** Fixtures no formato do catálogo REAL, medido na auditoria do §1. */
const EQ_DEYE_REAL = {
  _id: 'mi1', tipo: 'inversor', fabricante: 'Deye', modelo: 'SUN2000G-US-220',
  // Exatamente as chaves que produção tem: sem `entradas`, sem `modulos_por_entrada`.
  especificacoes: {
    potencia_kw: 2, tensao_max_entrada: 60, tensao_mppt_min: 16, tensao_mppt_max: 60,
    corrente_max_por_mppt: 13, n_mppts: 4, strings_por_mppt: 1, fases: 1,
  },
}
const EQ_HOY_REAL = {
  _id: 'mi2', tipo: 'inversor', fabricante: 'Hoymiles', modelo: 'HMS-2250DW-4T',
  especificacoes: {
    potencia_kw: 3, corrente_ac_saida: 10.82, n_mppts: 2, strings_por_mppt: 2,
    tensao_max_entrada: 65, corrente_max_por_mppt: 18, tipo_topologia: 'MICRO',
  },
}
const EQ_COM_TRONCO = {
  _id: 'mi3', tipo: 'inversor', fabricante: 'Marca Sem Regra', modelo: 'X-1',
  especificacoes: {
    potencia_kw: 2, entradas: 4, modulos_por_entrada: 1,
    corrente_max_por_mppt: 13, corrente_ac_saida: 9,
    max_por_cabo_tronco: 4,   // o nome que o extrator de datasheet já grava
  },
}

const fonte = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

vi.mock('../providers/ProjetoProvider', () => ({
  useProjeto: () => ({
    projetoId: 'p1', projeto: { _id: 'p1', arranjos: [] }, carregando: false, erro: null,
    recarregar: vi.fn(), acoes: { salvarEtapa: vi.fn() },
  }),
}))
const { default: EtapaMicroinversores } = await import('../paginas/etapas/EtapaMicroinversores')

// ── §11.1–11.6 — capacidade e procedência ───────────────────────────────────

describe('capacidade do micro', () => {
  it('1. micro com entradas conhecidas: capacidade calculada', () => {
    const p = planejarMicros({ modulos: 24, quantidade: 6, micro: DEYE, fases: 'Monofásico' })
    expect(p.capacidade_por_micro).toBe(4)
    expect(p.distribuicao).toEqual([4, 4, 4, 4, 4, 4])
  })

  it('2. micro SEM entradas: sem capacidade, sem distribuição, lacuna nomeada', () => {
    const p = planejarMicros({ modulos: 24, quantidade: 6, micro: SEM_ENTRADAS, fases: 'Monofásico' })
    expect(p.capacidade_por_micro).toBeNull()
    expect(p.distribuicao).toBeNull()
    expect(p.procedencia_capacidade).toBeNull()
    expect(p.lacunas.join(' ')).toMatch(/entradas \/ módulos por entrada/i)
  })

  it('3. micro com módulos por entrada conhecidos entra na capacidade', () => {
    expect(planejarMicros({ modulos: 12, quantidade: 3, micro: { ...DEYE, modulos_por_entrada: 2 }, fases: 'Monofásico' })
      .capacidade_por_micro).toBe(8)
  })

  it('4. micro SEM módulos por entrada: capacidade desconhecida', () => {
    const p = planejarMicros({ modulos: 24, quantidade: 6, micro: SEM_MOD_ENTRADA, fases: 'Monofásico' })
    expect(p.capacidade_por_micro).toBeNull()
    expect(p.distribuicao).toBeNull()
  })

  it('5. distribuição automática só roda com capacidade real', () => {
    expect(planejarMicros({ modulos: 23, quantidade: 6, micro: DEYE, fases: 'Monofásico' }).distribuicao)
      .toEqual([4, 4, 4, 4, 4, 3])
  })

  it('6. ausência de capacidade nunca vira número assumido', () => {
    for (const micro of [SEM_ENTRADAS, SEM_MOD_ENTRADA, {}, { fabricante: 'Deye' }]) {
      const p = planejarMicros({ modulos: 24, quantidade: 6, micro, fases: 'Trifásico' })
      expect(p.capacidade_por_micro).toBeNull()
      expect(p.distribuicao).toBeNull()
    }
  })

  it('a procedência distingue catálogo, manual e ajustado', () => {
    // O catálogo real NÃO declara entradas: o operador informa → manual.
    const doReal = configDaComposicao([{ equipamento_id: 'mi1', quantidade: 6 }], [EQ_DEYE_REAL], 24)[0]
    expect(procedenciaDaCapacidade(doReal)).toBeNull()   // nada informado ainda
    expect(procedenciaDaCapacidade({ ...doReal, entradas_por_micro: 4, modulos_por_entrada: 1 }))
      .toBe('manual')

    // Um modelo que declara tudo → ssot; alterado pelo operador → ajustado.
    const completo = configDaComposicao([{ equipamento_id: 'mi3', quantidade: 4 }], [EQ_COM_TRONCO], 16)[0]
    expect(procedenciaDaCapacidade(completo)).toBe('ssot')
    expect(procedenciaDaCapacidade({ ...completo, entradas_por_micro: 6 })).toBe('ajustado')
  })

  it('a procedência chega ao plano e nunca é `ssot` por omissão', () => {
    expect(planejarMicros({ modulos: 24, quantidade: 6, micro: DEYE, fases: 'Monofásico' })
      .procedencia_capacidade).toBe('ssot')
    expect(planejarMicros({ modulos: 24, quantidade: 6, micro: { ...DEYE, origem: undefined }, fases: 'Monofásico' })
      .procedencia_capacidade).toBe('desconhecida')
  })

  it('a tela declara quando a capacidade é manual e quando é desconhecida', () => {
    const { unmount } = render(
      <EtapaMicroinversores
        catalogoInversores={[EQ_DEYE_REAL]}
        arranjoPrincipal={{
          tipo: 'principal', topologia: 'micro',
          inversores: [{ equipamento_id: 'mi1', quantidade: 6 }],
          paineis: [{ equipamento_id: 'm1', quantidade: 24 }],
        }}
        totalModulos={24} potenciaModuloW={585} fases="Trifásico" iscModuloA={13.9}
      />,
    )
    expect(screen.getByLabelText('Procedência da capacidade 1').textContent)
      // Sprint E3 (§9) fixou a redação desta mensagem.
      .toMatch(/Capacidade não determinada — faltam entradas \/ módulos por entrada/i)
    unmount()
  })
})

// ── §11.7–11.8 — corrente ───────────────────────────────────────────────────

describe('corrente', () => {
  /**
   * ── Ajuste de compatibilidade de corrente ─────────────────────────────────
   * Estes três testes afirmavam que `Isc × 1,25` acima da corrente de TRABALHO
   * era `excedida`. A auditoria mostrou que são grandezas diferentes: a de
   * projeto dimensiona condutor, e quem reprova é o limite de CURTO-CIRCUITO.
   * Reescritos para o contrato novo — o fator 1,25 continua calculado e
   * conferido, só deixou de decidir compatibilidade.
   */
  it('7. dentro dos dois limites: operação e curto ambos `ok`', () => {
    const r = correnteDaEntrada({
      iscModulo: 9, imppModulo: 8.5, limiteEntrada: 13, limiteCurto: 16.9,
    })
    expect(r.veredito).toBe(VEREDITO.OK)
    expect(r.operacao.status).toBe(VEREDITO.OK)
    expect(r.curto_circuito.status).toBe(VEREDITO.OK)
    expect(r.projeto_normativa.corrente_a).toBe(+(9 * FATOR_ISC_NBR16690).toFixed(2))
    expect(r.projeto_normativa.decide_compatibilidade).toBe(false)
  })

  it('7b. Impp acima do limite de trabalho é ATENÇÃO, não impedimento', () => {
    const r = correnteDaEntrada({
      iscModulo: 13.83, imppModulo: 14, limiteEntrada: 13, limiteCurto: 16.9,
    })
    expect(r.veredito).toBe(VEREDITO.ATENCAO)
    expect(r.operacao.status).toBe(VEREDITO.ATENCAO)
    expect(r.curto_circuito.status).toBe(VEREDITO.OK)
    expect(r.operacao.motivo).toMatch(/não é impedimento elétrico/i)
    // A corrente de projeto passa de 13 A e continua não reprovando.
    expect(r.projeto_normativa.acima_do_trabalho).toBe(true)
  })

  it('7c. Isc acima do limite de curto é EXCEDIDA — o único impedimento', () => {
    const r = correnteDaEntrada({
      iscModulo: 18.35, imppModulo: 17, limiteEntrada: 13, limiteCurto: 16.9,
    })
    expect(r.veredito).toBe(VEREDITO.EXCEDIDA)
    expect(r.curto_circuito.status).toBe(VEREDITO.EXCEDIDA)
    expect(r.curto_circuito.motivo).toMatch(/excede a corrente máxima de curto-circuito/i)
  })

  it('8. corrente NÃO avaliada quando o dado falta — nunca "ok" por omissão', () => {
    // Sem limite de curto, o critério absoluto não é avaliado — e o limite de
    // trabalho NÃO entra no lugar dele.
    const semCurto = correnteDaEntrada({ iscModulo: 9, imppModulo: 8, limiteEntrada: 13 })
    expect(semCurto.curto_circuito.status).toBe(VEREDITO.NAO_AVALIADO)
    expect(semCurto.curto_circuito.motivo).toMatch(/não é usado no lugar dele/i)
    expect(semCurto.veredito).toBe(VEREDITO.NAO_AVALIADO)

    // Sem Impp, a corrente de operação não é avaliada — e Isc não a substitui.
    const semImpp = correnteDaEntrada({ iscModulo: 9, limiteEntrada: 13, limiteCurto: 16.9 })
    expect(semImpp.operacao.status).toBe(VEREDITO.NAO_AVALIADO)
    expect(semImpp.operacao.corrente_a).toBeNull()
    expect(semImpp.operacao.motivo).toMatch(/não substitui a de operação/i)

    expect(correnteDaEntrada({}).lacunas)
      .toEqual(['modulo.isc', 'inversor.corrente_isc_max', 'modulo.impp', 'inversor.corrente_max_por_mppt'])
    expect(correnteDoMicro({}).veredito).toBe(VEREDITO.NAO_AVALIADO)
  })

  it('o ramal informa o valor e recusa o veredito — não há limite no SSOT', () => {
    const r = correnteDoRamal({ correnteAcSaida: 10, micros: 3 })
    expect(r.corrente_a).toBe(30)
    expect(r.veredito).toBe(VEREDITO.NAO_AVALIADO)
    expect(r.limite_a).toBeNull()
    expect(r.motivo).toMatch(/não declara limite/i)
  })

  it('corrente é independente da distribuição: um pode faltar sem derrubar o outro', () => {
    const semCapacidade = planejarMicros({ modulos: 24, quantidade: 6, micro: SEM_ENTRADAS, fases: 'Trifásico' })
    expect(semCapacidade.distribuicao).toBeNull()
    const c = avaliarCorrenteMicro({
      micro: { corrente_max_por_mppt: 13, corrente_isc_max: 16.9, corrente_ac_saida: 10 },
      iscModulo: 9, imppModulo: 8.5,
    })
    expect(c.entrada.veredito).toBe(VEREDITO.OK)
  })

  it('o motor de corrente reusa a primitiva normativa, não reimplementa 1,25', () => {
    const src = fonte('../../../../packages/fv-shared/engenharia/correnteMicro.js')
    expect(src).toMatch(/from '\.\/engenhariaNormativa\.js'/)
    expect(src).toMatch(/correnteProjeto/)
    // Nenhum fator normativo escrito à mão deste lado.
    expect(src).not.toMatch(/[^_A-Za-z]1\.25[^0-9]/)
  })

  it('o adaptador entrega os limites do catálogo ao motor', () => {
    const cfg = configDaComposicao([{ equipamento_id: 'mi2', quantidade: 6 }], [EQ_HOY_REAL], 24)
    const plano = planoDaComposicao(cfg, 'Monofásico').por_modelo[0]
    const c = correnteDoBloco(cfg[0], 13.9, plano)
    expect(c.entrada.operacao.limite_a).toBe(18)
    expect(c.micro.corrente_a).toBe(10.82)
  })
})

// ── §11.9–11.12 — política de arranjos × fases ──────────────────────────────

describe('arranjos × fases', () => {
  it('9. 6 micros trifásicos: L3 fica vazia, e isso é campo próprio', () => {
    const p = planejarMicros({ modulos: 24, quantidade: 6, micro: DEYE, fases: 'Trifásico' })
    expect(p.fases.por_fase).toEqual({ L1: 3, L2: 3, L3: 0 })
    expect(p.fases.fases_sem_arranjo).toEqual(['L3'])
    expect(p.avisos.join(' ')).toMatch(/L3 sem nenhum microinversor/)
  })

  it('10. 7 micros trifásicos ocupam as três fases', () => {
    const p = planejarMicros({ modulos: 28, quantidade: 7, micro: DEYE, fases: 'Trifásico' })
    expect(p.fases.por_fase).toEqual({ L1: 3, L2: 3, L3: 1 })
    expect(p.fases.fases_sem_arranjo).toEqual([])
  })

  it('11. quantidade não divisível entre fases: resíduo declarado e estável', () => {
    const p = planejarMicros({ modulos: 32, quantidade: 8, micro: DEYE, fases: 'Trifásico' })
    expect(p.fases.desequilibrio).toBe(1)
    expect(p.fases.equilibrado).toBe(false)
    expect(JSON.stringify(planejarMicros({ modulos: 32, quantidade: 8, micro: DEYE, fases: 'Trifásico' })))
      .toBe(JSON.stringify(p))
  })

  it('12. a política é nomeada, documentada e a alternativa fica registrada', () => {
    expect(POLITICA_ARRANJOS.id).toBe('minimo_de_ramais')
    expect(POLITICA_ARRANJOS.descricao).toBeTruthy()
    expect(POLITICA_ARRANJOS.alternativa_nao_implementada.id).toBe('ocupar_todas_as_fases')
    expect(POLITICA_ARRANJOS.alternativa_nao_implementada.motivo).toMatch(/não existe no sistema/i)
    // A política aplicada é a mesma que o plano declara.
    const p = planejarMicros({ modulos: 24, quantidade: 6, micro: DEYE, fases: 'Trifásico' })
    expect(p.politica.id).toBe(POLITICA_ARRANJOS.id)
    expect(p.fases.politica).toBe(POLITICA_ARRANJOS.id)
  })

  it('o limite de desequilíbrio do domínio EV não vaza para FV', () => {
    /**
     * A guarda proíbe USAR o limite do EV, não CITÁ-LO: a política documenta
     * justamente que os 10 % do `EV_TRIFASICO_DESBALANÇO` não se aplicam aqui,
     * e apagar essa frase esconderia o raciocínio. O que não pode existir é
     * import do domínio EV ou comparação contra um limiar de desequilíbrio.
     */
    for (const rel of [
      '../../../../packages/fv-shared/engenharia/arranjosMicro.js',
      '../../../../packages/fv-shared/engenharia/correnteMicro.js',
    ]) {
      const src = fonte(rel)
      expect(src, rel).not.toMatch(/from ['"][^'"]*(electrical|evInvariants)/)
      expect(src, rel).not.toMatch(/max_imbalance_percent/)
      // Nenhuma comparação de desequilíbrio contra número.
      expect(src, rel).not.toMatch(/desequilibrio\s*[<>]=?\s*\d/)
    }
  })

  it('monofásico continua sem fase fabricada', () => {
    const p = planejarMicros({ modulos: 24, quantidade: 6, micro: DEYE, fases: 'Monofásico' })
    expect(p.fases.atribuicao).toBeNull()
    expect(p.fases.fases_sem_arranjo).toBeNull()
  })
})

// ── §11.13–11.16 — composição com dois modelos ──────────────────────────────

describe('composição mista', () => {
  const A = { modulos: 12, quantidade: 3, micro: { ...DEYE, rotulo: 'Deye' } }
  const B = { modulos: 12, quantidade: 3, micro: { ...DEYE, rotulo: 'Deye B' } }

  it('13. composição homogênea se declara homogênea', () => {
    const c = planejarComposicaoMicro({ modelos: [A, B], fases: 'Trifásico' })
    expect(c.homogenea).toBe(true)
    expect(c.quantidade_micros).toBe(6)
  })

  it('14. dois modelos: o balanceamento é GLOBAL, não por modelo', () => {
    const c = planejarComposicaoMicro({ modelos: [A, B], fases: 'Trifásico' })
    // Um arranjo de cada modelo — em fases DIFERENTES.
    expect(c.por_modelo[0].arranjos.map((a) => a.fase)).toEqual(['L1'])
    expect(c.por_modelo[1].arranjos.map((a) => a.fase)).toEqual(['L2'])
    expect(c.fases.por_fase).toEqual({ L1: 3, L2: 3, L3: 0 })
    // Nenhum modelo se declara equilibrado por conta própria.
    expect(c.por_modelo[0].fases.equilibrado).toBeNull()
  })

  it('15. modelos com capacidades diferentes: cada um pela sua', () => {
    const c = planejarComposicaoMicro({
      modelos: [
        { modulos: 12, quantidade: 3, micro: { ...DEYE, rotulo: 'Deye' } },
        { modulos: 8, quantidade: 4, micro: { ...HOY, rotulo: 'Hoymiles' } },
      ],
      fases: 'Trifásico',
    })
    expect(c.por_modelo.map((p) => p.capacidade_por_micro)).toEqual([4, 2])
    expect(c.por_modelo[0].distribuicao).toEqual([4, 4, 4])
    expect(c.por_modelo[1].distribuicao).toEqual([2, 2, 2, 2])
    expect(c.homogenea).toBe(false)
    expect(c.avisos.join(' ')).toMatch(/capacidades diferentes/i)
  })

  it('16. modelos com regras diferentes: nenhum herda a do outro', () => {
    const c = planejarComposicaoMicro({
      modelos: [
        { modulos: 12, quantidade: 3, micro: { ...DEYE, rotulo: 'Deye' } },
        { modulos: 8, quantidade: 4, micro: { ...HOY, rotulo: 'Hoymiles' } },
      ],
      fases: 'Trifásico',
    })
    expect(c.por_modelo[0].regra.max_por_cabo_tronco).toBe(3)
    expect(c.por_modelo[0].regra.fonte).toBe('fabricante')
    expect(c.por_modelo[1].regra.fonte).toBeNull()
    expect(c.por_modelo[1].arranjos).toBeNull()
    expect(c.avisos.join(' ')).toMatch(/regras de arranjo diferentes/i)
  })

  it('cada modelo continua identificável pelo próprio rótulo', () => {
    const c = planejarComposicaoMicro({
      modelos: [{ ...A, micro: { ...DEYE, rotulo: 'Deye SUN-A' } },
        { ...B, micro: { ...DEYE, rotulo: 'Deye SUN-B' } }],
      fases: 'Trifásico',
    })
    expect(c.por_modelo.map((p) => p.rotulo)).toEqual(['Deye SUN-A', 'Deye SUN-B'])
  })
})

// ── §11.17–11.18 — regra por fabricante (preservada) ────────────────────────

describe('regras por fabricante', () => {
  it('17. a regra Deye continua valendo e vindo da tabela', () => {
    const p = planejarMicros({ modulos: 24, quantidade: 6, micro: DEYE, fases: 'Monofásico' })
    expect(p.regra.max_por_cabo_tronco).toBe(3)
    expect(p.regra.fonte).toBe('fabricante')
  })

  it('18. fabricante sem regra continua sem arranjo', () => {
    const p = planejarMicros({ modulos: 8, quantidade: 4, micro: HOY, fases: 'Trifásico' })
    expect(p.regra.fonte).toBeNull()
    expect(p.arranjos).toBeNull()
  })

  it('`max_por_cabo_tronco` do catálogo alimenta a regra e VENCE o fabricante', () => {
    expect(lerInversor({ max_por_cabo_tronco: 4 }).max_por_cabo_tronco).toBe(4)
    const cfg = configDaComposicao([{ equipamento_id: 'mi3', quantidade: 6 }], [EQ_COM_TRONCO], 24)
    const plano = planoDaComposicao(cfg, 'Monofásico').por_modelo[0]
    expect(plano.regra.fonte).toBe('catalogo')
    expect(plano.arranjos.map((a) => a.micros.length)).toEqual([4, 2])
  })
})

// ── §11.19–11.22 — obsolescência, persistência, nada inventado ──────────────

describe('obsolescência e persistência', () => {
  const composicaoDeDois = [
    { equipamento_id: 'mi3', quantidade: 4 },
    { equipamento_id: 'mi3b', quantidade: 2 },
  ]
  const CAT = [EQ_COM_TRONCO, { ...EQ_COM_TRONCO, _id: 'mi3b', modelo: 'X-2' }]

  it('19. plano obsoleto continua sendo detectado, não corrigido', () => {
    const plano = planejarMicros({ modulos: 32, quantidade: 8, micro: DEYE, fases: 'Trifásico' })
    expect(planoObsoleto([{ micros: [1, 2, 3], fase: 'L1' }], plano).obsoleto).toBe(true)
    expect(planoObsoleto(plano.arranjos.map((a) => ({ micros: a.micros, fase: a.fase })), plano).obsoleto)
      .toBe(false)
  })

  it('19b. a obsolescência de dois modelos é medida contra o plano da composição', () => {
    const cfg = configDaComposicao(composicaoDeDois, CAT, 24)
    const persistida = paraConfigPersistida(cfg, 'Trifásico')
    const relida = daConfigPersistida(persistida, CAT)
    // Recém-salvo, nada divergiu — inclusive as fases, que dependem do outro modelo.
    expect(obsolescenciaDaComposicao(relida, 'Trifásico').every((r) => !r.obsoleto)).toBe(true)
  })

  it('20/21. persistência e reload preservam arranjos, fases e `equipamento_id`', () => {
    const cfg = configDaComposicao(composicaoDeDois, CAT, 24)
    const persistida = paraConfigPersistida(cfg, 'Trifásico')
    expect(persistida.map((m) => m.equipamento_id)).toEqual(['mi3', 'mi3b'])
    // Fases globais: o segundo modelo NÃO recomeça em L1.
    const fases = persistida.flatMap((m) => (m.arranjos ?? []).map((a) => a.fase))
    expect(new Set(fases).size).toBeGreaterThan(1)

    const relida = daConfigPersistida(persistida, CAT)
    const replanejado = planoDaComposicao(relida, 'Trifásico')
    expect(replanejado.por_modelo.flatMap((p) => p.arranjos.map((a) => a.fase))).toEqual(fases)
  })

  it('22. nada inventado: sem dado, sem número — em capacidade, corrente e regra', () => {
    const cfg = configDaComposicao([{ equipamento_id: 'mi1', quantidade: 6 }], [EQ_DEYE_REAL], 24)
    const plano = planoDaComposicao(cfg, 'Trifásico').por_modelo[0]
    // O catálogo real não declara entradas nem modulos_por_entrada.
    expect(plano.capacidade_por_micro).toBeNull()
    expect(plano.distribuicao).toBeNull()
    // Nem corrente_ac_saida.
    const c = correnteDoBloco(cfg[0], null, plano)
    expect(c.micro.veredito).toBe(VEREDITO.NAO_AVALIADO)
    expect(c.entrada.veredito).toBe(VEREDITO.NAO_AVALIADO)
    // Mas o que ELE declara é usado: corrente_max_por_mppt = 13.
    expect(c.entrada.operacao.limite_a).toBe(13)
    // Persistir não fabrica capacidade.
    const p = paraConfigPersistida(cfg, 'Trifásico')[0]
    expect(p.entradas_por_micro).toBeNull()
    expect(p.distribuicao).toBeUndefined()
  })

  it('`n_mppts` NÃO é convertido em `entradas` — a auditoria mediu a ambiguidade', () => {
    // Os dois Deye do catálogo têm n_mppts=4; um deles tem entradas_por_mppt="4",
    // que a normalização expande para [4,4,4,4] = 16 entradas num micro de 2 kW.
    // Derivar `entradas` daí produziria capacidade errada com cara de medida.
    const src = fonte('../../../../packages/fv-shared/engenharia/arranjosMicro.js')
    expect(src).not.toMatch(/n_mppts|entradas_por_mppt/)
    expect(fonte('../microinversores.js')).not.toMatch(/n_mppts|entradas_por_mppt/)
  })

  it('gravar micros continua preservando a topologia string do arranjo', () => {
    const arranjo = {
      tipo: 'principal', topologia: 'micro',
      configuracao_eletrica: { n_mppts: 2, quantidade_modulos_por_string: 12, mppts: [{ mppt: 1 }] },
    }
    const saida = paraArranjoComMicros(
      arranjo, configDaComposicao([{ equipamento_id: 'mi3', quantidade: 4 }], CAT, 16), 'Trifásico')
    expect(saida.configuracao_eletrica.n_mppts).toBe(2)
    expect(saida.configuracao_eletrica.mppts).toEqual([{ mppt: 1 }])
    expect(saida.configuracao_eletrica.arranjos).toBeUndefined()
  })
})
