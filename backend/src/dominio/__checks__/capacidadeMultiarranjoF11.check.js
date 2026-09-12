/**
 * capacidadeMultiarranjoF11.check.js — F11-AUDIT.
 *
 * AUDITORIA, não habilitação. Este arquivo não muda comportamento nenhum: ele
 * EXECUTA a camada oficial do domínio sobre um projeto multiarranjo sintético e
 * registra, em asserções, o que hoje funciona e o que não funciona. Serve para
 * que o sprint de migração comece com a capacidade medida, e para que qualquer
 * regressão no que JÁ funciona apareça antes.
 *
 * Fixture (Fase 15 do prompt):
 *   Arranjo A — inversor A (Huawei 60 kW), 14 módulos de 550 W
 *   Arranjo B — inversor B (Solplanet 50 kW), 10 módulos de 550 W
 *   Total     — 24 módulos, 2 inversores, 13,2 kWp
 *
 * ── O que a auditoria encontrou nos 5 projetos REAIS ────────────────────────
 * O primeiro bloqueio estrutural NÃO é `MULTIPLOS_INVERSORES`. O unifilar para
 * antes dele, em `TOPOLOGIA_AUSENTE`: `engenharia_eletrica` está ausente em 5 de
 * 5, e é lá que mora a topologia string do Core — um objeto SINGULAR por
 * projeto (`engenharia_eletrica.arranjo`), que por construção não representa
 * dois arranjos.
 *
 * E há um defeito de dado anterior a tudo isso: `potenciaPaineisKwp` trata
 * `potencia_w` ausente como ZERO, e `calcularTotaisProjeto` soma `null` como 0.
 * O resultado é uma soma PARCIAL silenciosa — em "Mercado Avelino",
 * `n_modulos_total = 399` convive com `potencia_total_kwp = 77,43` no mesmo
 * objeto, quando 399 × 445 W = 177,6 kWp. Os dois números se contradizem.
 *
 *   node backend/src/dominio/__checks__/capacidadeMultiarranjoF11.check.js
 */
import path from 'node:path'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { normalizarArranjos, calcularTotaisProjeto, potenciaPaineisKwp } from '../../services/arranjosService.js'
import { obterTopologiaProjeto } from '../topologia/obterTopologiaProjeto.js'
import { avaliarIntegridade, MOTIVOS_UNIFILAR } from '../unifilar/integridade.js'
import { adaptarProjetoParaUnifilar } from '../unifilar/adaptarProjeto.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const nota = (m) => console.log('  · ' + m)
const secao = (t) => console.log(`\n── ${t}`)

const painel = (q, w) => ({ marca: 'Talesun', modelo: 'TP6L72M(H)-445W', potencia_w: w, quantidade: q })
const PROJETO = {
  nome: 'Fixture multiarranjo F11',
  arranjos: [
    { id: 'arr_A', rotulo: 'Arranjo A', tipo: 'principal',
      paineis: [painel(14, 550)],
      inversores: [{ fabricante: 'Huawei', modelo: 'SUN2000-60KTL-M0', potencia_kw: 60, quantidade: 1 }] },
    { id: 'arr_B', rotulo: 'Arranjo B', tipo: 'secundario',
      paineis: [painel(10, 550)],
      inversores: [{ fabricante: 'Solplanet', modelo: 'ASW50K-LT-G2', potencia_kw: 50, quantidade: 1 }] },
  ],
}

secao('1 · PERSISTÊNCIA / CONTAGEM — o que JÁ funciona por arranjo')
const arr = normalizarArranjos(PROJETO)
ok(arr.length === 2, 'os dois arranjos sobrevivem à normalização')
ok(arr[0].dimensionamento.n_modulos === 14 && arr[1].dimensionamento.n_modulos === 10,
  'cada arranjo conta os PRÓPRIOS módulos (14 e 10), sem misturar')
ok(arr[0].dimensionamento.n_inversores === 1 && arr[1].dimensionamento.n_inversores === 1,
  'e os próprios inversores')
const totais = calcularTotaisProjeto(PROJETO)
ok(totais.n_modulos_total === 24, `o total do projeto é a SOMA dos arranjos (24), não o maior nem o primeiro`)
ok(totais.n_inversores_total === 2, 'idem para inversores (2)')
ok(totais.potencia_inversor_total_kw === 110, 'e para potência CA (60 + 50 = 110 kW)')
ok(obterTopologiaProjeto(PROJETO).geradores.length === 2,
  'a camada de acesso oficial enxerga os dois arranjos')

secao('2 · IDENTIDADE — existe, mas não é garantida única')
ok(arr[0].id === 'arr_A' && arr[1].id === 'arr_B', 'cada arranjo carrega o próprio `id`')
// No acervo real, "Sistema FV novo kWp" tem DOIS arranjos com `id=arr_primario`.
// Nada no schema nem na normalização impede isso.
const dupes = normalizarArranjos({ arranjos: [
  { id: 'arr_primario', paineis: [painel(1, 550)], inversores: [] },
  { id: 'arr_primario', paineis: [painel(2, 550)], inversores: [] },
] })
ok(dupes[0].id === dupes[1].id,
  'ACHADO: ids duplicados passam sem erro — identidade não é única (visto no acervo real)')

secao('3 · POTÊNCIA — a soma parcial silenciosa foi CORRIGIDA pela F12')
// Quando a F11 mediu, `potenciaPaineisKwp` fazia `Number(p.potencia_w) || 0` e
// devolvia 77,43 kWp para 399 módulos — o total honesto seria 177,6. Este era o
// primeiro bloqueio estrutural que a auditoria apontou, e a F12 o fechou.
// As asserções abaixo travam a correção no lugar do achado.
ok(potenciaPaineisKwp([painel(24, 550)]) === 13.2, 'com `potencia_w` presente, a soma está certa')
ok(potenciaPaineisKwp([painel(225, null), painel(174, 445)]) === null,
  'painel sem `potencia_w` torna o total NÃO AVALIÁVEL (antes da F12: 77,43)')
const parcial = calcularTotaisProjeto({ arranjos: [
  { id: 'a', paineis: [painel(225, null)], inversores: [] },
  { id: 'b', paineis: [painel(174, 445)], inversores: [] },
] })
ok(parcial.n_modulos_total === 399 && parcial.potencia_total_kwp === null,
  'os 399 módulos continuam contados; a potência não é mais afirmada pela metade')

secao('4 · TOPOLOGIA — singular por projeto, por construção')
const modelo = readFileSync(path.resolve(RAIZ, 'backend/src/models/ProjetoFV.js'), 'utf8')
const v3 = modelo.slice(modelo.indexOf('const engenhariaEletricaV3Schema'))
const bloco = v3.slice(0, v3.indexOf('num_mppts_usados'))
ok(/arranjo:\s*\{/.test(bloco) && !/arranjos:\s*\[/.test(bloco),
  '`engenharia_eletrica.arranjo` é OBJETO único — não há lista de arranjos no Core')
nota('logo, a topologia string do Core não consegue representar dois arranjos')

secao('5 · UNIFILAR — `MULTIPLOS_INVERSORES` é INALCANÇÁVEL por este caminho')
const semTopologia = avaliarIntegridade(PROJETO, { arranjoMPPTs: null })
ok(semTopologia?.codigo === MOTIVOS_UNIFILAR.TOPOLOGIA_AUSENTE,
  `sem topologia, o impedimento é \`${semTopologia?.codigo}\` — não \`MULTIPLOS_INVERSORES\``)
nota('é o resultado dos 5 projetos reais: `engenharia_eletrica` ausente em 5/5')

// O adapter monta o view-model a partir de `equipamentos.inversor` — o
// subdocumento SINGULAR na raiz do projeto. Um projeto que guarda equipamento
// só em `arranjos[]` (que é o caso dos 5 reais) chega ao adapter sem inversor:
const entrada = adaptarProjetoParaUnifilar(PROJETO)
ok(entrada.inversor === undefined || entrada.inversor === null,
  'ACHADO: projeto com equipamento só em `arranjos[]` adapta com `inversor` vazio')
nota('os 5 projetos reais têm `equipamentos.inversores` vazio — o equipamento vive nos arranjos')

// Consequência: a cadeia para em TOPOLOGIA_AUSENTE ou EQUIPAMENTO_AUSENTE muito
// antes de contar inversores. O gate de multiarranjo é o TERCEIRO na fila, e
// não foi possível alcançá-lo a partir de um projeto baseado em `arranjos[]`.
const semEquipamento = avaliarIntegridade(
  { arranjos: PROJETO.arranjos, engenharia_eletrica: { arranjo: { mppts: [{ mppt: 1, total_modulos: 24 }] } } },
  { arranjoMPPTs: [{ mppt: 1, total_modulos: 24 }] })
ok(semEquipamento?.codigo === MOTIVOS_UNIFILAR.EQUIPAMENTO_AUSENTE,
  `com topologia mas sem equipamento na RAIZ: \`${semEquipamento?.codigo}\``)
nota('ordem real dos bloqueios: TOPOLOGIA_AUSENTE → EQUIPAMENTO_AUSENTE → MULTIPLOS_INVERSORES')
nota('o gate de multiarranjo protege um caminho que os projetos reais nem alcançam')

secao('6 · O gate continua ARMADO — esta auditoria não o desligou')
const integridade = readFileSync(path.resolve(RAIZ, 'backend/src/dominio/unifilar/integridade.js'), 'utf8')
ok(/MULTIPLOS_INVERSORES/.test(integridade) && /n_inversores_total/.test(integridade),
  '`MULTIPLOS_INVERSORES` segue no código e segue disparando')

secao('7 · ESCALA DA MIGRAÇÃO — quantos consumidores assumem UM inversor')
const arquivos = []
const anda = (d) => { for (const n of readdirSync(d)) { const p = path.join(d, n)
  if (statSync(p).isDirectory()) { if (n === '__checks__' || n === '__tests__' || n === 'node_modules') continue; anda(p) }
  else if (n.endsWith('.js')) arquivos.push(p) } }
anda(path.resolve(RAIZ, 'backend/src'))
const semCom = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const singulares = arquivos.filter((f) => /equipamentos\s*\??\s*\.\s*inversor\b(?!es)/.test(semCom(readFileSync(f, 'utf8'))))
ok(singulares.length > 0, `${singulares.length} arquivo(s) leem \`equipamentos.inversor\` (SINGULAR)`)
singulares.forEach((f) => nota(path.relative(RAIZ, f)))
nota('cada um é um ponto de migração: o projeto tem UM inversor no nível raiz')

console.log(falhas === 0
  ? '\nOK — capacidade medida. Contagem por arranjo funciona; potência, topologia e unifilar não.'
  : `\n${falhas} FALHA(S) — a capacidade medida mudou desde a F11-AUDIT.`)
process.exit(falhas === 0 ? 0 : 1)
