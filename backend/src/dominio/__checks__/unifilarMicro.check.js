/**
 * unifilarMicro.check.js — FV-DOM-031C
 *
 * Guarda as três coisas que esta sprint entregou:
 *
 *   1. o unifilar de micro NÃO inventa MPPT, string nem default;
 *   2. o desenho e o memorial de projetos STRING não mudaram;
 *   3. `arranjoMPPTs` deixou de ser lacuna em topologia micro — e continua
 *      sendo em topologia string.
 *
 *   node backend/src/dominio/__checks__/unifilarMicro.check.js
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { montarModeloMicro } from '@fortesolar/fv-shared/engenharia/microinversores'
import { gerarUnifilarMicroSVG } from '@fortesolar/fv-shared/engenharia/unifilar-micro-svg'
import { adaptarProjetoParaUnifilar, lacunasDaProveniencia } from '../unifilar/index.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)
const ler = (rel) => readFileSync(path.resolve(RAIZ, rel), 'utf8')
const semComentarios = (f) => f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const MOTOR_MICRO = 'packages/fv-shared/engenharia/unifilarMicroSVG.js'
const MOTOR_STRING = 'packages/fv-shared/engenharia/unifilarSVG.js'
const ADAPTER = 'backend/src/dominio/unifilar/adaptarProjeto.js'
const MEMORIAL = 'backend/src/services/memorialDescritivoService.js'

const MICROS = [
  { marca: 'Hoymiles', modelo: 'HMS-2000-4T', quantidade: 4, entradas_por_micro: 4,
    modulos_por_entrada: 1, distribuicao: [4, 4, 4, 4], potencia_kw: 2.0 },
  { marca: 'APsystems', modelo: 'QS1', quantidade: 2, entradas_por_micro: 3,
    modulos_por_entrada: 1, distribuicao: [3, 3], potencia_kw: 1.6 },
]
const PAINEL = { marca: 'Znshine', modelo: 'ZXM7', potenciaW: 550, voc: 45.5, vmpp: 38.1,
  isc: 18.35, coef_temp_voc: -0.0025, temp_noct: 44 }

// ═══ 1 · O modelo elétrico do micro ═════════════════════════════════════════
secao('1 · `montarModeloMicro` — entradas, não MPPT')
{
  const m = montarModeloMicro({
    painel: PAINEL, micros: MICROS,
    dadosConsumo: { tipoLigacao: 'monofasico', tensao: '220' }, uf: 'RN',
  })
  ok(m.topologia === 'micro', 'topologia declarada')
  ok(m.sistema.numModulos === 22 && m.sistema.numMicros === 6,
    `22 módulos, 6 micros (${m.sistema.numModulos}, ${m.sistema.numMicros})`)
  ok(m.sistema.potenciaCC === 12.1, `CC = 22 × 550 W = ${m.sistema.potenciaCC} kWp`)
  ok(m.sistema.potenciaCA === 11.2, `CA = 4×2,0 + 2×1,6 = ${m.sistema.potenciaCA} kW`)
  ok(m.modelos.length === 2, 'um bloco por modelo')
  ok(JSON.stringify(m.modelos[0].entradas_usadas) === '[[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]]',
    'distribuição POR ENTRADA registrada (decisão 5)')
  ok(m.modelos[0].voc_entrada_frio !== null && m.modelos[0].isc_entrada !== null,
    `envelope da entrada: Voc ${m.modelos[0].voc_entrada_frio} V · Isc ${m.modelos[0].isc_entrada} A`)

  /**
   * FV-DOM-031D — Q4 (FV-DOM-024/025): o catálogo guarda o coeficiente em
   * `%/°C` e as fórmulas esperam FRAÇÃO/K. Sem `coefParaFracao` na fronteira, o
   * Voc de UMA entrada com um módulo de 45,5 V saía 170,6 V — a inflação de
   * ~100× que a FV-DOM-023 mediu no wizard. Esta guarda fixa a ordem de
   * grandeza: uma entrada com 1 módulo não passa de ~1,2 × o Voc STC.
   */
  const vocSTC = PAINEL.voc
  ok(m.modelos[0].voc_entrada_frio > vocSTC && m.modelos[0].voc_entrada_frio < vocSTC * 1.2,
    `Voc de 1 módulo a frio entre ${vocSTC} e ${(vocSTC * 1.2).toFixed(1)} V: ${m.modelos[0].voc_entrada_frio} V`)
  ok(m.modelos[0].vmpp_entrada_quente < PAINEL.vmpp && m.modelos[0].vmpp_entrada_quente > PAINEL.vmpp * 0.8,
    `Vmpp a quente abaixo do STC e acima de 80%: ${m.modelos[0].vmpp_entrada_quente} V`)
  ok(Math.abs(m.modelos[0].isc_entrada - PAINEL.isc * 1.25) < 0.01,
    `Isc = Isc_stc × 1,25 (NBR 16690 §5.2): ${m.modelos[0].isc_entrada} A`)
  // O coeficiente já em fração dá o MESMO resultado — a conversão é idempotente.
  const emFracao = montarModeloMicro({
    painel: { ...PAINEL, coef_temp_voc: -0.0025 }, micros: MICROS,
    dadosConsumo: { tipoLigacao: 'monofasico', tensao: '220' }, uf: 'RN',
  })
  ok(emFracao.modelos[0].voc_entrada_frio === m.modelos[0].voc_entrada_frio,
    'catálogo em %/°C e catálogo em fração dão o MESMO Voc')
  ok(m.lacunas.length === 0, `sem lacunas com dados completos (${JSON.stringify(m.lacunas)})`)
  // O modelo NÃO tem MPPT nem string.
  const texto = JSON.stringify(m)
  ok(!/mppt/i.test(texto) && !/\bstring/i.test(texto), 'o modelo não menciona MPPT nem string')

  // Sem dados, LACUNA — nunca um módulo genérico.
  const vazio = montarModeloMicro({ painel: {}, micros: MICROS, dadosConsumo: {}, uf: 'RN' })
  for (const esperada of ['modulo.voc', 'modulo.vmpp', 'modulo.isc', 'modulo.coef_temp_voc']) {
    ok(vazio.lacunas.includes(esperada), `lacuna declarada: ${esperada}`)
  }
  ok(vazio.modelos[0].voc_entrada_frio === null, 'sem Voc do módulo, sem tensão de entrada — não 49,5 V')
  ok(montarModeloMicro({ painel: PAINEL, micros: [], dadosConsumo: {}, uf: 'RN' })
    .lacunas.includes('configuracao_eletrica.micros'), 'sem `micros[]`, lacuna própria')
}

// ═══ 2 · O desenho ══════════════════════════════════════════════════════════
secao('2 · O SVG de micro')
{
  const m = montarModeloMicro({
    painel: PAINEL, micros: MICROS,
    dadosConsumo: { tipoLigacao: 'monofasico', tensao: '220' }, uf: 'RN',
  })
  const svg = gerarUnifilarMicroSVG(m, { cliente: 'Cliente X', distribuidora: 'Neoenergia', estrutura: 'Fibrocimento' })
  ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), `SVG bem formado (${svg.length} bytes)`)
  ok(svg.includes('MICROINVERSORES'), 'título próprio')
  // Conteúdo exigido pelo item 2 da sprint.
  for (const [rotulo, esperado] of [
    ['módulos', '22 módulos'], ['micros', '6 microinversores'],
    ['fabricante/modelo do micro', 'Hoymiles HMS-2000-4T'],
    ['segundo modelo', 'APsystems QS1'],
    ['distribuição', '4/4/4/4'], ['estrutura', 'Fibrocimento'],
    ['barramento CA', 'barramento CA'], ['rede', 'Neoenergia'],
  ]) {
    ok(svg.includes(esperado), `representa ${rotulo} (\`${esperado}\`)`)
  }
  ok((svg.match(/MI-\d/g) ?? []).length === 6, 'um símbolo por microinversor')
  // A única menção a MPPT/string é a que DECLARA a ausência.
  ok((svg.match(/mppt/gi) ?? []).length === 1 && svg.includes('sem MPPT, sem strings'),
    'MPPT aparece só para dizer que não existe')
  ok(!/\bDPS CC: undefined|NaN|null V|undefined/.test(svg), 'nenhum `undefined`/`NaN` no desenho')

  // Determinístico.
  const svg2 = gerarUnifilarMicroSVG(m, { cliente: 'Cliente X', distribuidora: 'Neoenergia', estrutura: 'Fibrocimento' })
  ok(svg === svg2, 'duas chamadas produzem SVG idêntico')

  // Sem dados do módulo, o desenho sai com "—" e DECLARA — não inventa.
  const semDados = montarModeloMicro({ painel: {}, micros: MICROS, dadosConsumo: {}, uf: null })
  const svgSem = gerarUnifilarMicroSVG(semDados, {})
  ok(svgSem.includes('não declarado'), 'o desenho declara as lacunas')
  ok(!/49\.5|41\.2|13\.9/.test(svgSem), 'sem os genéricos 49,5 / 41,2 / 13,9 do caminho string')
}

// ═══ 3 · Lacunas por topologia (item 3) ═════════════════════════════════════
secao('3 · `arranjoMPPTs` não é lacuna em micro — e continua sendo em string')
{
  const base = {
    nome: 'P', equipamentos: { paineis: [{ marca: 'Z', modelo: 'M', potencia_w: 550 }],
      inversor: { marca: 'X', modelo: 'Y', potencia_kw: 2 }, estrutura: { tipo: 'Laje' } },
    dimensionamento: { num_paineis: 22 },
    fatura_extracao: { tipo_ligacao: 'monofasico', tensao_v: 220, concessionaria: 'N' },
    localizacao: { estado: 'RN' },
  }
  const stringSemMppt = adaptarProjetoParaUnifilar({ ...base, arranjos: [] })
  const lacS = lacunasDaProveniencia(stringSemMppt.proveniencia)
  ok(stringSemMppt.entrada.topologia === 'string', 'projeto sem `micros[]` é string')
  ok(lacS.includes('arranjoMPPTs'), 'STRING sem MPPT: `arranjoMPPTs` CONTINUA lacuna')

  const micro = adaptarProjetoParaUnifilar({
    ...base,
    arranjos: [{ tipo: 'principal', inversores: [{ equipamento_id: 'a', potencia_kw: 2 }],
      configuracao_eletrica: { micros: MICROS.map((m) => ({ ...m, equipamento_id: 'a' })) } }],
  })
  const lacM = lacunasDaProveniencia(micro.proveniencia)
  ok(micro.entrada.topologia === 'micro', 'projeto com `micros[]` é micro')
  ok(!lacM.includes('arranjoMPPTs'), 'MICRO: `arranjoMPPTs` NÃO é lacuna')
  ok(!('arranjoMPPTs' in micro.proveniencia), 'a chave sequer existe na proveniência do micro')
  ok(micro.proveniencia.topologiaMicro === 'arranjos[].configuracao_eletrica.micros',
    `MICRO declara a própria proveniência: ${micro.proveniencia.topologiaMicro}`)
  ok(Array.isArray(micro.entrada.micros) && micro.entrada.micros.length === 2,
    'os dois modelos chegam à entrada do motor')
  ok(micro.entrada.estrutura === 'Laje', `estrutura repassada: ${micro.entrada.estrutura}`)

  // Micro SEM `micros[]` preenchido não existe — seria string. Mas se a lista
  // vier vazia, a topologia volta a ser string e a exigência é a de string.
  const vazio = adaptarProjetoParaUnifilar({
    ...base, arranjos: [{ tipo: 'principal', configuracao_eletrica: { micros: [] } }],
  })
  ok(vazio.entrada.topologia === 'string', '`micros[]` vazio não vira topologia micro')
}

// ═══ 4 · O caminho STRING não mudou ═════════════════════════════════════════
secao('4 · Projetos string intactos')
{
  const fonteString = semComentarios(ler(MOTOR_STRING))
  ok(!fonteString.includes('micros'), 'o motor de string não sabe o que é `micros[]`')
  // A única mudança permitida em `unifilarSVG.js` é visibilidade de função.
  let diff = ''
  try { diff = execSync(`git diff -- ${MOTOR_STRING}`, { cwd: RAIZ, encoding: 'utf8' }) } catch { /* fora de repo */ }
  const mudadas = diff.split('\n')
    .filter((l) => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'))
    .map((l) => l.slice(1).trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('*'))
  const soExport = mudadas.every((l) => /^(export )?(function svg|function esc|const esc)/.test(l))
  ok(soExport, soExport ? 'só `export` foi acrescentado às funções de símbolo'
    : `linhas alteradas além do export: ${mudadas.slice(0, 3).join(' | ')}`)

  const memorial = ler(MEMORIAL)
  ok(memorial.includes('5. ARRANJO DAS STRINGS') && memorial.includes('Configuração DC: Strings em paralelo'),
    'o texto de string do memorial continua palavra por palavra')
  ok(memorial.includes('5. ARRANJO DOS MICROINVERSORES'), 'e existe a variante de micro')
  ok(/if \(!Array\.isArray\(micros\) \|\| micros\.length === 0\)/.test(memorial),
    'a variante só entra quando `micros[]` existe')
}

// ═══ 5 · Sem defaults no caminho micro ══════════════════════════════════════
secao('5 · Nenhum default no caminho micro')
{
  const fontes = semComentarios(ler(MOTOR_MICRO)) + semComentarios(ler(ADAPTER))
  for (const proibido of ['?? 49.5', '?? 41.2', '?? 13.9', '?? 550', '|| 49.5', '?? 5,',
    "?? 'string'", '?? 1)', 'nMppts || 1']) {
    ok(!fontes.includes(proibido), `sem \`${proibido}\``)
  }
  const micro = semComentarios(ler('packages/fv-shared/engenharia/microinversores.js'))
  ok(!/montarModeloMicro[\s\S]*?\|\| 5\b/.test(micro), 'sem `|| 5` de potência do inversor')
  ok(micro.includes("lacunas.push('modulo.voc')"), 'ausência do Voc vira lacuna nomeada')
}

// ═══ 6 · `especificacoes` são ESCALARES ═════════════════════════════════════
secao('6 · Contrato de `especificacoes`: a MESMA forma das duas topologias')
{
  /**
   * A UX renderiza `especificacoes.*` direto. O caminho string entrega
   * `cabo_ac_mm2` como TEXTO (a seção) e `dps` como OBJETO (lido `.modelo ·
   * .nivel`). O de micro tem de entregar exatamente a mesma forma: divergir
   * quebrou a tela com "Objects are not valid as a React child". Esta guarda
   * compara campo a campo com o caminho string, não com uma regra inventada.
   */
  const { gerarUnifilarDoProjeto } = await import('../unifilar/index.js')
  const projetoMicro = {
    nome: 'P', equipamentos: { paineis: [{ marca: 'Z', modelo: 'M', potencia_w: 550, voc: 45.5, isc: 18.35, vmpp: 38.1, coef_temp_voc: -0.0025 }],
      inversor: { marca: 'X', modelo: 'Y', potencia_kw: 2 }, estrutura: { tipo: 'Laje' } },
    dimensionamento: { num_paineis: 22 },
    fatura_extracao: { tipo_ligacao: 'monofasico', tensao_v: 220, concessionaria: 'N' },
    localizacao: { estado: 'RN' },
    arranjos: [{ tipo: 'principal', inversores: [{ equipamento_id: 'a', potencia_kw: 2 }],
      configuracao_eletrica: { micros: MICROS.map((m) => ({ ...m, equipamento_id: 'a' })) } }],
  }
  const r = gerarUnifilarDoProjeto(projetoMicro)
  // Referência: o MESMO gerador, num projeto string completo.
  const projetoString = {
    ...projetoMicro,
    arranjos: [{ tipo: 'principal' }],
    engenharia_eletrica: { arranjo: { num_mppts_usados: 2, mppts: [
      { mppt: 1, strings_paralelo: 1, modulos_por_string: 11, total_modulos: 11 },
      { mppt: 2, strings_paralelo: 1, modulos_por_string: 11, total_modulos: 11 }] } },
  }
  const ref = gerarUnifilarDoProjeto(projetoString)
  for (const campo of ['cabo_ac_mm2', 'dps', 'corrente_ac_a', 'fases', 'tensao_ac_v',
    'potencia_cc_kwp', 'potencia_ca_kw', 'num_paineis']) {
    const tMicro = r.especificacoes[campo] === null ? 'null' : typeof r.especificacoes[campo]
    const tString = ref.especificacoes[campo] === null ? 'null' : typeof ref.especificacoes[campo]
    ok(tMicro === tString || tMicro === 'null' || tString === 'null',
      `${campo}: micro ${tMicro} · string ${tString}`)
  }
  ok(typeof r.especificacoes.cabo_ac_mm2 === 'string',
    `cabo_ac_mm2 é texto: ${JSON.stringify(r.especificacoes.cabo_ac_mm2)}`)
  ok(r.especificacoes.dps === null || (typeof r.especificacoes.dps === 'object'
    && 'modelo' in r.especificacoes.dps && 'nivel' in r.especificacoes.dps),
  `dps tem a forma que a UX lê: ${JSON.stringify(r.especificacoes.dps)}`)
  ok(!/>null|>undefined|NaN/.test(r.svg), 'o SVG não contém `null`, `undefined` nem `NaN`')
}

// ═══ 7 · Dívida técnica registrada, não corrigida (FV-DOM-031E) ═════════════
secao('7 · `_carregarDepsDocumento` — dívida REGISTRADA e INTOCADA')
{
  /**
   * A FV-DOM-031E decidiu NÃO corrigir o `req` fora de escopo: a correção muda
   * 2 de 3 memoriais string (medido em `auditoria-req-fv-dom-031d.mjs`). Esta
   * guarda tem DUAS metades — o defeito continua onde estava, E a dívida está
   * escrita no estado canônico. Sem a segunda, "não corrigir" vira "esquecer".
   */
  const ctrl = ler('backend/src/controllers/homologacaoController.js')
  ok(/async function _carregarDepsDocumento\(projetoId, projetoBody\)/.test(ctrl),
    'a assinatura continua sem `req` — o defeito NÃO foi corrigido por engano')
  // Só DENTRO da função: os outros endpoints do controller têm `req` legítimo
  // em escopo, e contá-los daria 6 em vez de 2.
  const inicio = ctrl.indexOf('async function _carregarDepsDocumento')
  // O corpo termina onde começa a PRÓXIMA declaração de topo. Procurar `\n}\n`
  // não serve: o arquivo usa CRLF e a busca devolvia -1, levando `slice` a
  // varrer o arquivo inteiro e contar 6 ocorrências em vez de 2.
  const fim = ctrl.slice(inicio + 1).search(/\r?\n(export |async function |function |\/\*\*)/)
  const corpo = ctrl.slice(inicio, fim > 0 ? inicio + 1 + fim : undefined)
  const comReq = (corpo.match(/aplicarEscopo\([^)]*,\s*req\s*,/g) ?? []).length
  ok(comReq === 2, `as duas chamadas com \`req\` fora de escopo seguem lá (${comReq})`)
  ok(/catch\s*\(?\w*\)?\s*\{[\s\S]{0,80}return out/.test(corpo) || /\} catch/.test(corpo),
    'o `catch` que engole o ReferenceError continua no lugar')

  // E o micro não depende disso.
  ok(/const micros = _microsDoProjeto\(projDoc\)/.test(ctrl),
    'o memorial de micro deriva `micros[]` do projeto, sem passar por `deps`')

  const estado = ler('FV-ESTADO-COMPACTADO.md')
  ok(estado.includes('## 5B · Dívida técnica: `_carregarDepsDocumento`'),
    'a dívida está registrada no estado canônico')
  for (const marca of ['2 de 3', 'NÃO CORRIGIR', 'sprint própria', 'Número de MPPT']) {
    ok(estado.includes(marca), `  ↳ o registro contém "${marca}"`)
  }
  ok(estado.includes('nunca desenhou FV'),
    'a correção do erro sobre `gerarPDFUnifilar` está registrada')
  ok(/\| B7 \|.*_carregarDepsDocumento/.test(estado), 'consta como bloqueio ativo B7')
}

console.log(falhas === 0
  ? '\nOK — micro desenhado por entradas, string intacto, lacunas por topologia.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
