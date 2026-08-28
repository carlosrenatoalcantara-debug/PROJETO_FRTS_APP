/**
 * integridadeUnifilar.check.js — FV-DOM-056
 *
 * Prova que o unifilar não representa mais uma topologia que o domínio elétrico
 * declarou inválida — e que continua representando fielmente a que é válida.
 *
 * Os cenários são os medidos no navegador pela FV-QA-055, com os MESMOS números.
 *
 *   node backend/src/dominio/__checks__/integridadeUnifilar.check.js
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gerarUnifilarDoProjeto } from '../unifilar/index.js'
import { avaliarIntegridade, modulosDaTopologia, MOTIVOS_UNIFILAR } from '../unifilar/integridade.js'
import { adaptarProjetoParaUnifilar } from '../unifilar/adaptarProjeto.js'
import { montarModeloEletrico } from '@fortesolar/fv-shared/engenharia/normativa'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
const ler = (rel) => { try { return readFileSync(path.resolve(RAIZ, rel), 'utf8') } catch { return '' } }

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n══ ${t}`)

// ── Fixtures: os projetos exatos da FV-QA-055 ───────────────────────────────
const MODULO = { id: 'zn650', marca: 'Znshine', modelo: 'ZXM7-UHLD144-650/M', potencia_w: 650 }
const mod = (q) => ({ ...MODULO, quantidade: q })

const base = (paineis, inversores, ligacao, tensao) => ({
  nome: 'cenário', equipamentos: { paineis: [paineis], inversor: { ...inversores[0] } },
  arranjos: [{ tipo: 'principal', paineis: [paineis], inversores }],
  fatura_extracao: { tipo_ligacao: ligacao, tensao_v: tensao },
  localizacao: { estado: 'RN' }, local_resolvido: { estado: 'RN' },
})

const mppts = (lista) => ({ arranjo: { mppts: lista.map((m, i) => ({
  mppt: i + 1, strings_paralelo: m[0], modulos_por_string: m[1],
  total_modulos: m[0] * m[1], entradas: [{ entrada: 1, strings: [{ modulos: m[1] }] }],
})) } })

const SG5 = { marca: 'Sungrow', modelo: 'SG5.0RS', potencia_kw: 5, tipo: 'string', quantidade: 1 }
const GW10 = { marca: 'GoodWe', modelo: 'GW10K-ET', potencia_kw: 10, tipo: 'string', quantidade: 1 }
const SG15 = { marca: 'Sungrow', modelo: 'SG15RT', potencia_kw: 15, tipo: 'string', quantidade: 1 }
const SG25 = { marca: 'Sungrow', modelo: 'SG25RT', potencia_kw: 25, tipo: 'string', quantidade: 2 }

// T01 · mono string 6 kWp — 10 × 650 W, 2 MPPT × 5
const T01 = { ...base(mod(10), [SG5], 'Monofásico', 220), dimensionamento: { potencia_kwp: 6.02, num_paineis: 10 },
  engenharia_eletrica: mppts([[1, 5], [1, 5]]) }
// T03 · mono string 10 kWp — SEM topologia (o estado em que o unifilar mentia)
const T03_sem = { ...base(mod(16), [GW10], 'Monofásico', 220), dimensionamento: { potencia_kwp: 9.97, num_paineis: 16 } }
// T03 · com a topologia válida
const T03_com = { ...T03_sem, engenharia_eletrica: mppts([[1, 8], [1, 8]]) }
// T05 · tri string 14 kWp — 22 × 650 W, 3 MPPT 8/7/7
const T05 = { ...base(mod(22), [SG15], 'Trifásico', 380), dimensionamento: { potencia_kwp: 14.02, num_paineis: 22 },
  engenharia_eletrica: mppts([[1, 8], [1, 7], [1, 7]]) }
// T07/T09 · tri string 50 kWp — 77 × 650 W, 2 × 25 kW, topologia RECUSADA
const T07 = { ...base(mod(77), [SG25], 'Trifásico', 380), dimensionamento: { potencia_kwp: 49.87, num_paineis: 77 } }

console.log('═══ FV-DOM-056 — integridade topologia → unifilar ═══')

// ═══ 1 · Topologia válida → unifilar correspondente ════════════════════════
secao('1 · Topologia válida continua desenhando (T01 · T05)')
{
  const r1 = gerarUnifilarDoProjeto(T01)
  ok(r1.impedimento == null, 'T01 sem impedimento')
  ok(typeof r1.svg === 'string' && r1.svg.length > 0, 'T01 desenha')
  ok(r1.especificacoes.potencia_cc_kwp === 6.5, `T01 CC = ${r1.especificacoes.potencia_cc_kwp} kWp`)
  ok(r1.especificacoes.num_strings === 2 && r1.especificacoes.num_mppts === 2,
    `T01 ${r1.especificacoes.num_strings} strings / ${r1.especificacoes.num_mppts} MPPTs`)

  const r5 = gerarUnifilarDoProjeto(T05)
  ok(r5.impedimento == null && r5.svg, 'T05 desenha')
  ok(r5.especificacoes.potencia_cc_kwp === 14.3, `T05 CC = ${r5.especificacoes.potencia_cc_kwp} kWp`)
  ok(r5.especificacoes.num_paineis === 22, `T05 ${r5.especificacoes.num_paineis} módulos — a contagem real`)
}

// ═══ 2 · T03 antes e depois ════════════════════════════════════════════════
secao('2 · T03 — a potência coincidir não mascara mais a topologia')
{
  const antes = gerarUnifilarDoProjeto(T03_sem)
  ok(antes.svg === null, 'sem topologia: nenhum desenho')
  ok(antes.impedimento?.codigo === MOTIVOS_UNIFILAR.TOPOLOGIA_AUSENTE,
    `impedimento declarado: ${antes.impedimento?.codigo}`)
  ok(/engenharia_eletrica\.arranjo\.mppts/.test(antes.impedimento?.detalhe?.campo ?? ''),
    'e nomeia o campo que falta')
  ok(antes.especificacoes === null, 'nenhuma especificação é publicada')

  // O contraste: o motor, chamado direto, ainda produziria o desenho impossível.
  const { entrada } = adaptarProjetoParaUnifilar(T03_sem)
  const cru = montarModeloEletrico({
    painel: entrada.painel, inversor: entrada.inversor, arranjoMPPTs: entrada.arranjoMPPTs,
    dimensionamento: entrada.dimensionamento,
    dadosConsumo: { tipoLigacao: entrada.tipo_ligacao, tensao: entrada.tensao }, uf: entrada.uf,
  })
  ok(cru.resumo.numStrings === 1 && cru.resumo.vocMaxGlobal > 800,
    `o motor sozinho ainda daria 1 string e Voc ${cru.resumo.vocMaxGlobal} V — e o domínio não o deixa chegar lá`)

  const depois = gerarUnifilarDoProjeto(T03_com)
  ok(depois.impedimento == null && depois.svg, 'com topologia válida: desenha')
  ok(depois.especificacoes.potencia_cc_kwp === 10.4, `CC = ${depois.especificacoes.potencia_cc_kwp} kWp`)
  ok(depois.especificacoes.num_strings === 2, `${depois.especificacoes.num_strings} strings`)
  ok(depois.especificacoes.voc_max_v < 600,
    `Voc ${depois.especificacoes.voc_max_v} V — dentro do limite do GoodWe (600 V)`)
  ok(depois.especificacoes.voc_max_v !== cru.resumo.vocMaxGlobal,
    'a topologia mudou o desenho, e a potência igual não esconde mais isso')
}

// ═══ 3 · T07 / T09 — bloqueio obrigatório ══════════════════════════════════
secao('3 · T07/T09 — nenhuma representação impossível')
{
  const r = gerarUnifilarDoProjeto(T07)
  ok(r.svg === null, 'nenhum SVG é produzido')
  ok(r.impedimento != null, `impedimento: ${r.impedimento?.codigo}`)
  ok(/mppts/.test(JSON.stringify(r.impedimento)), 'o motivo aponta a topologia ausente')
  ok(r.especificacoes === null, 'nenhuma string de 77 módulos é publicada')
  ok(!JSON.stringify(r).includes('3933'), 'o Voc de 3933 V não aparece em lugar nenhum')
  ok(!/"potencia_ca_kw":\s*25/.test(JSON.stringify(r)), 'nenhuma potência CA de 25 kW é apresentada')

  // Mesmo COM topologia válida num inversor, 2 inversores não viram 1.
  const T09 = { ...T07, engenharia_eletrica: mppts([[1, 12], [1, 12], [1, 12]]) }
  const r9 = gerarUnifilarDoProjeto(T09)
  ok(r9.svg === null, 'dois inversores: continua sem desenho')
  ok(r9.impedimento?.codigo === MOTIVOS_UNIFILAR.MULTIPLOS_INVERSORES,
    `impedimento: ${r9.impedimento?.codigo}`)
  ok(r9.impedimento?.detalhe?.inversores_na_composicao === 2,
    'declara os 2 inversores da composição contra 1 no desenho')
}

// ═══ 4 · Topologia reprovada pelo validador ════════════════════════════════
secao('4 · Reprovado pela análise elétrica nunca vira desenho')
{
  const reprovado = {
    ...T01,
    engenharia_eletrica: {
      ...T01.engenharia_eletrica,
      compatibilidade: {
        compativel: false,
        diagnosticos: [{ codigo: 'CORRENTE_EXCEDIDA', severidade: 'erro', mppt: 1,
          mensagem: 'Isc de projeto (45.875 A) excede a corrente máxima de entrada MPPT (25 A).' }],
      },
    },
  }
  const r = gerarUnifilarDoProjeto(reprovado)
  ok(r.svg === null, 'topologia reprovada: nenhum desenho')
  ok(r.impedimento?.codigo === MOTIVOS_UNIFILAR.TOPOLOGIA_INVALIDA, `impedimento: ${r.impedimento?.codigo}`)
  ok(/45\.875 A/.test(JSON.stringify(r.impedimento)), 'o motivo técnico do validador é repassado')

  // `compativel: true` não impede nada.
  const aprovado = { ...T01, engenharia_eletrica: { ...T01.engenharia_eletrica,
    compatibilidade: { compativel: true, diagnosticos: [] } } }
  ok(gerarUnifilarDoProjeto(aprovado).svg != null, 'topologia aprovada desenha normalmente')
}

// ═══ 5 · Topologia que não corresponde à composição ════════════════════════
secao('5 · Topologia ≠ composição é declarada, não desenhada')
{
  // Comprou 10 módulos, ligou 8.
  const divergente = { ...T01, engenharia_eletrica: mppts([[1, 4], [1, 4]]) }
  const r = gerarUnifilarDoProjeto(divergente)
  ok(r.svg === null && r.impedimento?.codigo === MOTIVOS_UNIFILAR.TOPOLOGIA_DIVERGENTE,
    `impedimento: ${r.impedimento?.codigo}`)
  ok(r.impedimento?.detalhe?.modulos_na_topologia === 8
    && r.impedimento?.detalhe?.modulos_na_composicao === 10,
    'declara 8 ligados contra 10 comprados')
  ok(modulosDaTopologia([{ numStrings: 2, modulosPorString: 6 }]) === 12,
    'a contagem soma strings × módulos por string')
}

// ═══ 6 · Micro preserva a decisão da FV-DOM-031 ════════════════════════════
secao('6 · Microinversor: ausência bloqueia, divergência apenas declara')
{
  const HMS = { equipamento_id: 'i1', marca: 'Hoymiles', modelo: 'HMS-2000-4T', potencia_kw: 2, tipo: 'microinversor', quantidade: 3 }
  const micro = (comMicros) => ({
    nome: 'micro', equipamentos: { paineis: [mod(10)], inversor: { ...HMS } },
    arranjos: [{ tipo: 'principal', paineis: [mod(10)], inversores: [HMS],
      configuracao_eletrica: comMicros ? { micros: [{ equipamento_id: 'i1', marca: 'Hoymiles',
        modelo: 'HMS-2000-4T', quantidade: 3, entradas_por_micro: 4, modulos_por_entrada: 1 }] } : {} }],
    fatura_extracao: { tipo_ligacao: 'Monofásico', tensao_v: 220 },
    localizacao: { estado: 'RN' }, local_resolvido: { estado: 'RN' },
    dimensionamento: { potencia_kwp: 6.02, num_paineis: 10 },
  })

  const sem = gerarUnifilarDoProjeto(micro(false))
  ok(sem.svg === null && sem.impedimento?.codigo === MOTIVOS_UNIFILAR.TOPOLOGIA_AUSENTE,
    'micro sem `micros[]`: impedimento declarado')
  ok(/microinversor/i.test(sem.impedimento?.motivo ?? ''), 'com a linguagem do caminho micro')

  const com = gerarUnifilarDoProjeto(micro(true))
  ok(com.impedimento == null && com.svg, 'micro com distribuição: desenha')
  ok(com.especificacoes?.topologia === 'micro', 'e continua sendo o desenho de micro')
}

// ═══ 7 · Nada foi alterado fora do domínio ═════════════════════════════════
secao('7 · Motor e wizard legado intocados')
{
  const motor = ler('packages/fv-shared/engenharia/engenhariaNormativa.js')
  ok(/numPaineis\s*=\s*dimensionamento\?\.numPaineis\s*\?\?\s*6/.test(motor),
    'o ramo de compatibilidade do motor CONTINUA lá — é do wizard legado')
  ok(!/integridade|avaliarIntegridade/.test(motor), 'o motor não conhece o portão')

  const svgEngine = ler('packages/fv-shared/engenharia/unifilarSVG.js')
  ok(!/avaliarIntegridade/.test(svgEngine), '`gerarUnifilarSVG` compartilhado não foi tocado')

  const legadoUX = ler('frontend/src/utils/gerarUnifilarSVG.js')
  ok(/export \{ gerarUnifilarSVG \}/.test(legadoUX), 'o wizard legado segue com o re-export de sempre')

  const guarda = ler('backend/src/dominio/unifilar/integridade.js')
  ok(!/mongoose|updateOne|\$set|process\.env/.test(guarda), 'o portão é puro: sem I/O e sem persistência')
  ok(/obterTopologiaProjeto/.test(guarda), 'e lê a composição pela camada de acesso oficial')
  for (const proib of ['Baseline', 'avaliarGate', 'conexao', 'parecer']) {
    ok(!new RegExp(proib, 'i').test(guarda.replace(/\/\*[\s\S]*?\*\//g, '')),
      `não toca ${proib}`)
  }
}

// ═══ 8 · A função de avaliação isolada ═════════════════════════════════════
secao('8 · `avaliarIntegridade` isolada')
{
  const { entrada } = adaptarProjetoParaUnifilar(T01)
  ok(avaliarIntegridade(T01, entrada) === null, 'projeto íntegro devolve null')
  ok(avaliarIntegridade(T01, { ...entrada, arranjoMPPTs: null })?.codigo
    === MOTIVOS_UNIFILAR.TOPOLOGIA_AUSENTE, 'sem arranjoMPPTs → TOPOLOGIA_AUSENTE')
  ok(avaliarIntegridade(T01, { ...entrada, arranjoMPPTs: [] })?.codigo
    === MOTIVOS_UNIFILAR.TOPOLOGIA_AUSENTE, 'lista vazia também')
  ok(modulosDaTopologia(null) === 0 && modulosDaTopologia([]) === 0,
    'contagem de topologia ausente é 0, sem exceção')
  ok(modulosDaTopologia([{ numStrings: 'x', modulosPorString: 5 }]) === 0,
    'valores não numéricos não viram NaN')
}

console.log(falhas === 0
  ? '\nOK — o desenho representa a topologia válida, e recusa o resto com motivo.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
