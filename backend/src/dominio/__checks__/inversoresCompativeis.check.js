/**
 * inversoresCompativeis.check.js — Sprint D1.
 *
 * O que este check protege:
 *  1. o motor canônico é REALMENTE usado — não há segunda fórmula elétrica;
 *  2. a configuração preliminar da D0 basta para julgar STRING, sem MPPT;
 *  3. MICRO não é julgado pelo modelo de string — e o resultado diz isso;
 *  4. dado insuficiente é impedimento diagnosticável, nunca "compatível";
 *  5. "nenhum compatível" é distinto de "não foi possível avaliar";
 *  6. a resposta é determinística e não depende de inversor previamente escolhido;
 *  7. nada de fabricante, modelo ou potência hardcoded no serviço.
 *
 * Puro: sem banco, sem HTTP. Os candidatos são fixtures no formato do SSOT.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  avaliarCompatibilidade, lacunasDaConfiguracao, fasesDaInstalacao, faseServe,
  MOTIVOS_COMPATIBILIDADE, AVALIACAO,
} from '../../services/inversoresCompativeisService.js'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

// ── Fixtures no formato do catálogo (SSOT) ──────────────────────────────────
const MODULO = {
  _id: 'm1', tipo: 'modulo', fabricante: 'Znshine', modelo: 'ZXM7-650',
  especificacoes: {
    potencia_wp: 650, voc: 45.5, vmpp: 38.1, isc: 18.35, impp: 17.06,
    coef_temp_voc: -0.25,
  },
}
const MODULO_SEM_DADOS = {
  _id: 'm2', tipo: 'modulo', fabricante: 'X', modelo: 'Y',
  especificacoes: { potencia_wp: 550 },
}

const STRING_TRI = {
  _id: 'i1', fabricante: 'Sungrow', modelo: 'SG15RT',
  especificacoes: { potencia: 15, fases: 3, tensao_max_entrada: 1000,
    tensao_mppt_min: 200, tensao_mppt_max: 850, corrente_max_por_mppt: 25, n_mppts: 3 },
}
const STRING_MONO = {
  _id: 'i2', fabricante: 'Fronius', modelo: 'Primo 5.0-1',
  especificacoes: { potencia: 5, fases: 1, tensao_max_entrada: 1000,
    tensao_mppt_min: 80, tensao_mppt_max: 800, corrente_max_por_mppt: 18, n_mppts: 2 },
}
/** Janela estreita: uma string de 14 módulos estoura a Voc a frio. */
const STRING_APERTADO = {
  _id: 'i3', fabricante: 'ABB', modelo: 'UNO-DM-4.6',
  especificacoes: { potencia: 4.6, fases: 1, tensao_max_entrada: 600,
    tensao_mppt_min: 70, tensao_mppt_max: 480, corrente_max_por_mppt: 15, n_mppts: 1 },
}
const MICRO_MONO = {
  _id: 'i4', fabricante: 'Hoymiles', modelo: 'HMS-2000-4T',
  especificacoes: { potencia: 2, fases: 1, tensao_max_entrada: 60,
    tensao_mppt_min: 16, tensao_mppt_max: 60, corrente_max_por_mppt: 16,
    n_mppts: 4, entradas: 4 },
}
const MICRO_TRI = {
  _id: 'i5', fabricante: 'APsystems', modelo: 'QT2',
  especificacoes: { potencia: 2, fases: 3, tensao_max_entrada: 60,
    tensao_mppt_min: 16, tensao_mppt_max: 60, corrente_max_por_mppt: 16,
    n_mppts: 4, entradas: 4 },
}

const TODOS = [STRING_TRI, STRING_MONO, STRING_APERTADO, MICRO_MONO, MICRO_TRI]

const cfgString = (over = {}) => ({
  tipo: 'string', fases: 'Trifásico', modulos_por_string: 12, quantidade_strings: 2, ...over,
})
const cfgMicro = (over = {}) => ({ tipo: 'micro', fases: 'Monofásico', ...over })

const ids = (lista) => lista.map((x) => x.equipamento_id)

// ═══ 1 · Configuração e fases ═══════════════════════════════════════════════
secao('1 · configuração preliminar')

ok(lacunasDaConfiguracao(cfgString()).length === 0, 'string completa não tem lacuna')
ok(lacunasDaConfiguracao(cfgMicro()).length === 0, 'micro não exige strings (FV-DOM-031)')
ok(lacunasDaConfiguracao({ tipo: 'string', fases: 'Trifásico' }).join(',')
  === 'modulos_por_string,quantidade_strings', 'string sem agrupamento nomeia as duas lacunas')
ok(lacunasDaConfiguracao({}).includes('tipo'), 'sem tipo é lacuna')

ok(fasesDaInstalacao('Trifásico') === 3 && fasesDaInstalacao('Monofásico') === 1
  && fasesDaInstalacao('Bifásico') === 2, 'fases traduzidas do rótulo da fatura')
ok(fasesDaInstalacao('') === null && fasesDaInstalacao(null) === null, 'rótulo ausente é null')
ok(faseServe(3, 1).serve === false, 'trifásico não entra em instalação monofásica')
ok(faseServe(1, 3).serve === true, 'monofásico entra em trifásica')
ok(faseServe(null, 3).serve === true && faseServe(null, 3).declarada === false,
  'fase não declarada não reprova — vira ressalva')

// ═══ 2 · String ═════════════════════════════════════════════════════════════
secao('2 · topologia string')

const rTri = avaliarCompatibilidade({ configuracao: cfgString(), modulo: MODULO, candidatos: TODOS })
ok(rTri.ok === true, 'string trifásico avalia')
ok(rTri.criterio === AVALIACAO.ELETRICA_PRELIMINAR, 'critério declarado: elétrica preliminar')
ok(ids(rTri.compativeis).includes('i1'), 'SG15RT (tri, janela larga) é compatível')
ok(!ids(rTri.compativeis).includes('i4') && !ids(rTri.compativeis).includes('i5'),
  'nenhum microinversor entra na lista de string')
ok(rTri.compativeis.every((c) => c.avaliacao === AVALIACAO.ELETRICA_PRELIMINAR),
  'todo compatível de string foi julgado pelo motor')

const rMono = avaliarCompatibilidade({
  configuracao: cfgString({ fases: 'Monofásico' }), modulo: MODULO, candidatos: TODOS,
})
ok(rMono.ok === true, 'string monofásico avalia')
ok(!ids(rMono.compativeis).includes('i1'), 'trifásico é excluído em instalação monofásica')
ok(rMono.incompativeis.some((x) => x.equipamento_id === 'i1' && x.motivo === 'fase'),
  'e o motivo da exclusão é a fase, nomeado')

// Motor canônico realmente decidindo: string longa demais reprova no apertado.
const apertado = rTri.incompativeis.find((x) => x.equipamento_id === 'i3')
ok(!!apertado, 'inversor de janela estreita é reprovado')
ok(typeof apertado?.motivo === 'string' && apertado.motivo !== 'tecnologia' && apertado.motivo !== 'fase',
  `reprovação veio do motor elétrico (motivo: ${apertado?.motivo})`)

// A configuração MUDA o conjunto — prova de que a avaliação é real.
const curto = avaliarCompatibilidade({
  configuracao: cfgString({ modulos_por_string: 4, quantidade_strings: 1 }),
  modulo: MODULO, candidatos: TODOS,
})
ok(JSON.stringify(ids(rTri.compativeis)) !== JSON.stringify(ids(curto.compativeis))
  || rTri.incompativeis.length !== curto.incompativeis.length,
  'alterar a configuração preliminar altera o conjunto de candidatos')

// ═══ 3 · Micro ══════════════════════════════════════════════════════════════
secao('3 · topologia micro')

const rMicro = avaliarCompatibilidade({ configuracao: cfgMicro(), modulo: MODULO, candidatos: TODOS })
ok(rMicro.ok === true, 'micro monofásico avalia')
ok(rMicro.criterio === AVALIACAO.TECNOLOGIA_E_FASE, 'critério de micro é declaradamente menor')
ok(ids(rMicro.compativeis).includes('i4'), 'micro monofásico entra')
ok(!ids(rMicro.compativeis).includes('i5'), 'micro trifásico não entra em instalação monofásica')
ok(!ids(rMicro.compativeis).some((i) => ['i1', 'i2', 'i3'].includes(i)),
  'nenhum inversor de string entra na lista de micro')
ok(rMicro.compativeis.every((c) => c.avaliacao === AVALIACAO.TECNOLOGIA_E_FASE
  && /entradas/i.test(c.resumo)),
  'cada micro declara que o envelope elétrico fica para a etapa de entradas')

const rMicroTri = avaliarCompatibilidade({
  configuracao: cfgMicro({ fases: 'Trifásico' }), modulo: MODULO, candidatos: TODOS,
})
ok(ids(rMicroTri.compativeis).includes('i5') && ids(rMicroTri.compativeis).includes('i4'),
  'em instalação trifásica, micro 1F e 3F cabem')

// ═══ 4 · Fail-closed ════════════════════════════════════════════════════════
secao('4 · dados insuficientes e ausência de candidatos')

const semCfg = avaliarCompatibilidade({ configuracao: { tipo: 'string' }, modulo: MODULO, candidatos: TODOS })
ok(semCfg.ok === false && semCfg.codigo === MOTIVOS_COMPATIBILIDADE.CONFIG_INCOMPLETA,
  'configuração incompleta é impedimento, não lista vazia')
ok(semCfg.compativeis.length === 0, 'e nada é dado como compatível')

const semModulo = avaliarCompatibilidade({
  configuracao: cfgString(), modulo: MODULO_SEM_DADOS, candidatos: TODOS,
})
ok(semModulo.ok === false && semModulo.codigo === MOTIVOS_COMPATIBILIDADE.MODULO_SEM_DADOS,
  'módulo sem dados elétricos é impedimento diagnosticável')
ok(semModulo.lacunas.length > 0 && semModulo.lacunas.every((l) => l.startsWith('modulo.')),
  'e as lacunas do módulo são nomeadas')

const nenhum = avaliarCompatibilidade({ configuracao: cfgMicro(), modulo: MODULO, candidatos: [STRING_TRI] })
ok(nenhum.ok === true && nenhum.codigo === MOTIVOS_COMPATIBILIDADE.SEM_CANDIDATOS,
  '"nenhum compatível" é resultado VÁLIDO, distinto de erro de dados')
ok(nenhum.avaliados === 1 && nenhum.compativeis.length === 0,
  'e informa quantos foram avaliados, sem fallback')

const catalogoVazio = avaliarCompatibilidade({ configuracao: cfgString(), modulo: MODULO, candidatos: [] })
ok(catalogoVazio.ok === true && catalogoVazio.avaliados === 0,
  'catálogo vazio não quebra')

// ═══ 5 · Contrato de saída ══════════════════════════════════════════════════
secao('5 · contrato de saída')

const um = rTri.compativeis[0]
ok(typeof um.equipamento_id === 'string' && um.equipamento_id.length > 0,
  'equipamento_id devolvido como referência canônica')
ok('fabricante' in um && 'modelo' in um, 'fabricante e modelo presentes para montar Marca → Modelo')
ok(!('especificacoes' in um), 'ficha técnica NÃO é duplicada na resposta')
ok(um.compativel === true, 'compatibilidade indicada explicitamente')

const a = avaliarCompatibilidade({ configuracao: cfgString(), modulo: MODULO, candidatos: TODOS })
const b = avaliarCompatibilidade({ configuracao: cfgString(), modulo: MODULO, candidatos: [...TODOS].reverse() })
ok(JSON.stringify(ids(a.compativeis)) === JSON.stringify(ids(b.compativeis)),
  'resposta determinística — independe da ordem do catálogo')

// ═══ 6 · Sem inversor previamente selecionado ═══════════════════════════════
secao('6 · independência do inversor já escolhido')

ok(JSON.stringify(rTri) === JSON.stringify(avaliarCompatibilidade({
  configuracao: cfgString(), modulo: MODULO, candidatos: TODOS,
})), 'a avaliação só depende de configuração + módulo + catálogo')

// ═══ 7 · Nenhuma regra duplicada ════════════════════════════════════════════
secao('7 · o motor canônico é a única fonte da regra')

const fonte = readFileSync(path.join(RAIZ, 'src/services/inversoresCompativeisService.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

ok(fonte.includes("from './compatibilidadeEletricaService.js'"),
  'importa o motor canônico')
ok(fonte.includes('analisarCompatibilidade('), 'e o CHAMA')
for (const proibido of ['Math.pow', 'Math.exp', '1.25', 'coef_temp_voc *', 'temperatura_min',
  '/ 1000', 'voc *', '* 1.25', 'oversizing']) {
  ok(!fonte.includes(proibido), `sem aritmética elétrica própria: \`${proibido}\``)
}
for (const marca of ['Sungrow', 'Deye', 'Hoymiles', 'Fronius', 'Growatt', 'ABB', 'APsystems']) {
  ok(!fonte.includes(marca), `nenhum fabricante hardcoded: ${marca}`)
}

console.log(falhas === 0
  ? '\nOK — compatíveis vêm do motor canônico; micro declara o que não avalia; ausência é impedimento.'
  : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
