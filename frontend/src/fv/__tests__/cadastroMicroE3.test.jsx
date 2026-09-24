import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { render, screen } from '@testing-library/react'

import {
  detectarConflitos, camposEmConflito, valorConfiavel, temConflito, TIPO_CONFLITO,
} from '@fortesolar/fv-shared/inversores/conflitos'
import { lerInversor, CAMPOS_INVERSOR } from '@fortesolar/fv-shared/inversores/dicionario'
import { planejarMicros } from '@fortesolar/fv-shared/engenharia/arranjos-micro'
import { correnteDoRamal, VEREDITO } from '@fortesolar/fv-shared/engenharia/corrente-micro'
import { envelopeDoMicro, potenciaDoInversor } from '../catalogo'
import { configDaComposicao, planoDaComposicao } from '../microinversores'

/**
 * Sprint E3 — fechamento do cadastro e das regras de microinversores.
 *
 * O que estes testes protegem:
 *  1. `max_por_cabo_tronco` é o nome ÚNICO do limite de ramal — o nome que a
 *     Sprint E cunhou sobrevive só como alias de leitura;
 *  2. cadastro contraditório não alimenta cálculo: `valorConfiavel` devolve
 *     `null` e o conflito é nomeado, em vez de um dos lados ser eleito;
 *  3. capacidade continua exigindo `entradas` + `modulos_por_entrada`, sem
 *     derivação por `n_mppts`, potência, corrente ou nome de modelo;
 *  4. a corrente de ramal continua sem veredito enquanto não houver limite;
 *  5. nenhuma fórmula paralela nova foi criada.
 *
 * Fixtures reproduzem os registros REAIS medidos na auditoria do §1 — inclusive
 * os dois conflitos de potência que o catálogo de produção carrega hoje.
 */

/** Hoymiles real: cadastro manual, sem fonte, com máximo MENOR que o nominal. */
const HOYMILES_REAL = {
  _id: 'mi2', tipo: 'inversor', fabricante: 'Hoymiles', modelo: 'HMS-2250DW-4T',
  origem: { tipo: 'manual', fonte: null },
  especificacoes: {
    potencia_kw: 3, potencia_maxima_kw: 2.25, corrente_ac_saida: 10.82,
    n_mppts: 2, strings_por_mppt: 2, tensao_max_entrada: 65,
    corrente_max_por_mppt: 18, tipo_topologia: 'MICRO',
  },
  specs_canonicas: {
    potencia_kw_ca: 3, voc_max_dc_v: 65, isc_max_por_mppt_a: 18, n_mppts: 2,
  },
}

/** Deye G3 real: datasheet, mas com 2000 (W) num campo declarado em kW. */
const DEYE_G3_REAL = {
  _id: 'mi1b', tipo: 'inversor', fabricante: 'Deye', modelo: 'SUN2000G3-US-220',
  origem: { tipo: 'datasheet_pdfparse', fonte: 'datasheet_oficial (Wave1)' },
  especificacoes: {
    potencia_kw: 2, potencia_maxima_kw: 2000, tensao_max_entrada: 60,
    tensao_mppt_min: 25, tensao_mppt_max: 55, corrente_max_por_mppt: 13,
    n_mppts: 4, strings_por_mppt: 1, fases: 1, tensao_ac: '220',
    corrente_ac_saida: 10, tipo_topologia: 'MICRO',
  },
  specs_canonicas: {
    potencia_kw_ca: 2, voc_max_dc_v: 60, mppt_min_v: 25, mppt_max_v: 55,
    isc_max_por_mppt_a: 13, n_mppts: 4, fases_saida: 1, tensao_saida_v: null,
  },
}

/** Deye G (sem US) real: coerente, mas sem entradas nem limite de ramal. */
const DEYE_REAL = {
  _id: 'mi1', tipo: 'inversor', fabricante: 'Deye', modelo: 'SUN2000G-US-220',
  origem: { tipo: 'datasheet_pdfparse' },
  especificacoes: {
    potencia_kw: 2, tensao_max_entrada: 60, tensao_mppt_min: 25,
    tensao_mppt_max: 55, corrente_max_por_mppt: 13, n_mppts: 4,
    strings_por_mppt: 1, fases: 1,
  },
  specs_canonicas: {
    potencia_kw_ca: 2, voc_max_dc_v: 60, mppt_min_v: 25, mppt_max_v: 55,
    isc_max_por_mppt_a: 13, n_mppts: 4, fases_saida: 1,
  },
}

/** Cadastro completo — o que um micro precisa declarar para o fluxo automático. */
const COMPLETO = {
  _id: 'mi9', tipo: 'inversor', fabricante: 'Marca Sem Regra', modelo: 'X-1',
  especificacoes: {
    potencia_kw: 2, potencia_maxima_kw: 2.2, entradas: 4, modulos_por_entrada: 1,
    corrente_max_por_mppt: 13, corrente_ac_saida: 9, max_por_cabo_tronco: 4,
    tipo_topologia: 'MICRO',
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

// ── §10 · `max_por_cabo_tronco` como fonte única ────────────────────────────

describe('`max_por_cabo_tronco` é o nome único do limite de ramal', () => {
  it('é o campo CANÔNICO do dicionário', () => {
    expect(CAMPOS_INVERSOR.max_por_cabo_tronco).toBeTruthy()
    expect(CAMPOS_INVERSOR.max_micros_por_arranjo).toBeUndefined()
    expect(CAMPOS_INVERSOR.max_por_cabo_tronco.aliases[0]).toBe('max_por_cabo_tronco')
  })

  it('o nome cunhado pela Sprint E sobrevive apenas como alias de leitura', () => {
    expect(lerInversor({ max_por_cabo_tronco: 4 }).max_por_cabo_tronco).toBe(4)
    expect(lerInversor({ max_micros_por_arranjo: 5 }).max_por_cabo_tronco).toBe(5)
    expect(lerInversor({}).max_por_cabo_tronco).toBeNull()
  })

  it('nenhum módulo de domínio guarda um segundo nome para a grandeza', () => {
    for (const rel of [
      '../../../../packages/fv-shared/engenharia/arranjosMicro.js',
      '../../../../packages/fv-shared/engenharia/regrasMicroFabricante.js',
      '../microinversores.js',
      '../catalogo.js',
    ]) {
      expect(fonte(rel), rel).not.toMatch(/max_micros_por_arranjo/)
    }
  })

  it('alimenta a regra de arranjo e vence a tabela do fabricante', () => {
    const env = envelopeDoMicro(COMPLETO)
    expect(env.max_por_cabo_tronco).toBe(4)
    const cfg = configDaComposicao([{ equipamento_id: 'mi9', quantidade: 6 }], [COMPLETO], 24)
    const p = planoDaComposicao(cfg, 'Monofásico').por_modelo[0]
    expect(p.regra.fonte).toBe('catalogo')
    expect(p.arranjos.map((a) => a.micros.length)).toEqual([4, 2])
  })

  it('fabricante sem regra continua sem arranjo', () => {
    const cfg = configDaComposicao([{ equipamento_id: 'mi2', quantidade: 4 }], [HOYMILES_REAL], 8)
    const comCapacidade = cfg.map((b) => ({ ...b, entradas_por_micro: 2, modulos_por_entrada: 1, modulos: 8 }))
    const p = planoDaComposicao(comCapacidade, 'Trifásico').por_modelo[0]
    expect(p.regra.fonte).toBeNull()
    expect(p.arranjos).toBeNull()
  })
})

// ── §10 · potência conflitante ──────────────────────────────────────────────

describe('cadastro conflitante', () => {
  it('Hoymiles real: máximo MENOR que o nominal é conflito impossível', () => {
    const c = detectarConflitos(HOYMILES_REAL).filter((x) => x.campo === 'potencia_kw')
    expect(c).toHaveLength(1)
    expect(c[0].tipo).toBe(TIPO_CONFLITO.IMPOSSIVEL)
    expect(c[0].valores.map((v) => v.valor)).toEqual([3, 2.25])
    expect(c[0].mensagem).toMatch(/não pode ser inferior à nominal/i)
    // Nada de inferir 2,25 pelo nome "HMS-2250".
    expect(c[0].mensagem).not.toMatch(/2250/)
  })

  it('Deye G3 real: 2000 num campo em kW é conflito de UNIDADE', () => {
    const c = detectarConflitos(DEYE_G3_REAL).find((x) => x.campo === 'potencia_kw')
    expect(c.tipo).toBe(TIPO_CONFLITO.UNIDADE)
    expect(c.mensagem).toMatch(/1000×/)
  })

  it('nenhum dos valores em conflito alimenta cálculo', () => {
    expect(valorConfiavel(HOYMILES_REAL, 'potencia_kw')).toBeNull()
    expect(valorConfiavel(DEYE_G3_REAL, 'potencia_kw')).toBeNull()
    expect(potenciaDoInversor(HOYMILES_REAL)).toBeNull()
    expect(potenciaDoInversor(DEYE_G3_REAL)).toBeNull()
    expect(envelopeDoMicro(HOYMILES_REAL).potencia_kw).toBeNull()
  })

  it('campos NÃO conflitantes do mesmo registro continuam legíveis', () => {
    expect(valorConfiavel(HOYMILES_REAL, 'corrente_max_por_mppt')).toBe(18)
    expect(valorConfiavel(DEYE_G3_REAL, 'tensao_max_entrada')).toBe(60)
    expect(camposEmConflito(HOYMILES_REAL)).toEqual(['potencia_kw'])
  })

  it('cadastro coerente não é acusado de conflito', () => {
    expect(temConflito(COMPLETO)).toBe(false)
    expect(temConflito(DEYE_REAL)).toBe(false)
    expect(potenciaDoInversor(COMPLETO)).toBe(2)
  })

  it('o conflito não é resolvido: nenhum valor é escolhido nem corrigido', () => {
    // O registro entra e sai idêntico — o detector não muta nada.
    const antes = JSON.stringify(HOYMILES_REAL)
    detectarConflitos(HOYMILES_REAL)
    valorConfiavel(HOYMILES_REAL, 'potencia_kw')
    expect(JSON.stringify(HOYMILES_REAL)).toBe(antes)
  })

  it('dado que existe só em `specs_canonicas` é reportado, não adotado', () => {
    const c = detectarConflitos(HOYMILES_REAL)
      .filter((x) => x.tipo === TIPO_CONFLITO.SO_EM_SPECS_CANONICAS)
    expect(c.map((x) => x.campo)).toContain('corrente_isc_max')
    // Reportar não é ler: o leitor canônico continua sem enxergar.
    expect(lerInversor(HOYMILES_REAL.especificacoes).corrente_isc_max).toBeNull()
    // E não conta como conflito de valor.
    expect(camposEmConflito(HOYMILES_REAL)).not.toContain('corrente_isc_max')
  })

  it('a tela diz "Cadastro inconsistente" e explica', () => {
    const { unmount } = render(
      <EtapaMicroinversores
        catalogoInversores={[HOYMILES_REAL]}
        arranjoPrincipal={{
          tipo: 'principal', topologia: 'micro',
          inversores: [{ equipamento_id: 'mi2', quantidade: 4 }],
          paineis: [{ equipamento_id: 'm1', quantidade: 8 }],
        }}
        totalModulos={8} potenciaModuloW={585} fases="Trifásico" iscModuloA={13.83}
      />,
    )
    const bloco = screen.getByLabelText('Cadastro inconsistente 1')
    expect(bloco.textContent).toMatch(/Cadastro inconsistente — revisão necessária/i)
    expect(bloco.textContent).toMatch(/nenhum dos valores é usado no cálculo/i)
    unmount()
  })
})

// ── §10 · capacidade sem inferência ─────────────────────────────────────────

describe('capacidade', () => {
  it('cadastro completo permite o fluxo automático', () => {
    const cfg = configDaComposicao([{ equipamento_id: 'mi9', quantidade: 6 }], [COMPLETO], 24)
    const p = planoDaComposicao(cfg, 'Monofásico').por_modelo[0]
    expect(p.capacidade_por_micro).toBe(4)
    expect(p.procedencia_capacidade).toBe('ssot')
    expect(p.distribuicao).toEqual([4, 4, 4, 4, 4, 4])
    expect(p.arranjos).toHaveLength(2)
  })

  it('cadastro incompleto não produz capacidade — nem por `n_mppts`', () => {
    // O Deye real tem n_mppts = 4 e strings_por_mppt = 1: a tentação óbvia.
    expect(DEYE_REAL.especificacoes.n_mppts).toBe(4)
    const env = envelopeDoMicro(DEYE_REAL)
    expect(env.entradas).toBeNull()
    expect(env.modulos_por_entrada).toBeNull()
    const cfg = configDaComposicao([{ equipamento_id: 'mi1', quantidade: 6 }], [DEYE_REAL], 24)
    const p = planoDaComposicao(cfg, 'Trifásico').por_modelo[0]
    expect(p.capacidade_por_micro).toBeNull()
    expect(p.distribuicao).toBeNull()
  })

  it('nem potência, corrente ou nome de modelo viram capacidade', () => {
    for (const eq of [DEYE_REAL, DEYE_G3_REAL, HOYMILES_REAL]) {
      expect(envelopeDoMicro(eq).entradas).toBeNull()
      expect(envelopeDoMicro(eq).modulos_por_entrada).toBeNull()
    }
    // "HMS-2250DW-4T" tem "4T" no nome; nada disso vira 4 entradas.
    expect(envelopeDoMicro(HOYMILES_REAL).entradas).toBeNull()
  })

  it('capacidade é derivação determinística quando os dois dados existem', () => {
    const p = planejarMicros({
      modulos: 24, quantidade: 6, fases: 'Monofásico',
      micro: { entradas: 4, modulos_por_entrada: 1, fabricante: 'X', origem: 'ssot' },
    })
    expect(p.capacidade_por_micro).toBe(4)
    expect(JSON.stringify(planejarMicros({
      modulos: 24, quantidade: 6, fases: 'Monofásico',
      micro: { entradas: 4, modulos_por_entrada: 1, fabricante: 'X', origem: 'ssot' },
    }))).toBe(JSON.stringify(p))
  })
})

// ── §10 · corrente de ramal sem limite ──────────────────────────────────────

describe('corrente de ramal', () => {
  it('sem limite no SSOT, continua `nao_avaliado` mesmo com valor calculado', () => {
    const r = correnteDoRamal({ correnteAcSaida: 10.82, micros: 3 })
    expect(r.corrente_a).toBeCloseTo(32.46, 2)
    expect(r.veredito).toBe(VEREDITO.NAO_AVALIADO)
    expect(r.limite_a).toBeNull()
  })

  it('nenhum campo de limite de ramal foi inventado no dicionário', () => {
    expect(Object.keys(CAMPOS_INVERSOR).some((c) => /corrente.*(ramal|tronco)/i.test(c)))
      .toBe(false)
  })
})

// ── §10 · nenhuma duplicação nova ───────────────────────────────────────────

describe('duplicação de regra', () => {
  it('a página de Inversores passou a consumir o motor para a corrente do ramal', () => {
    const src = fonte('../../pages/Inversores.jsx')
    expect(src).toMatch(/from '@fortesolar\/fv-shared\/engenharia\/corrente-micro'/)
    expect(src).toMatch(/correnteDoRamal\(\{ correnteAcSaida: imax, micros: nMicros \}\)/)
    // A multiplicação que existia em dois lugares agora existe em um.
    expect(src).not.toMatch(/imax \* nMicros/)
  })

  it('o dimensionamento CA da página NÃO foi trocado pelo canônico — não é a mesma regra', () => {
    const src = fonte('../../pages/Inversores.jsx')
    // Continua com o fator 1,1 e a tabela própria; a divergência está documentada.
    expect(src).toMatch(/iTotal \* 1\.1/)
    expect(src).toMatch(/não é equivalente|NÃO é\s*\n?\s*\*\s*equivalente/i)
    // A guarda é contra USAR o seletor canônico, não contra citá-lo: o
    // comentário nomeia `selecionarCabo` justamente para explicar por que ele
    // NÃO serve aqui, e apagar essa frase esconderia o raciocínio.
    expect(src).not.toMatch(/import[^\n]*selecionarCabo/)
    expect(src).not.toMatch(/selecionarCabo\(/)
  })

  it('o motor de corrente continua sem reimplementar o fator normativo', () => {
    const src = fonte('../../../../packages/fv-shared/engenharia/correnteMicro.js')
    expect(src).toMatch(/from '\.\/engenhariaNormativa\.js'/)
    expect(src).not.toMatch(/[^_A-Za-z]1\.25[^0-9]/)
  })

  it('o detector de conflitos não lê `specs_canonicas` como fonte de cálculo', () => {
    const src = fonte('../../../../packages/fv-shared/equipamentos/inversores/conflitosInversor.js')
    // Só compara; nunca devolve o valor do segundo repositório.
    expect(src).toMatch(/valorCampo/)
    expect(src).not.toMatch(/return .*specs_canonicas/)
  })
})
