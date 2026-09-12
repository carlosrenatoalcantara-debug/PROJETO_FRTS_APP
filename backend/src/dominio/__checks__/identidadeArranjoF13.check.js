/**
 * identidadeArranjoF13.check.js — F13.
 *
 * Trava o contrato de identidade do arranjo e, sobretudo, impede a volta do que
 * o quebrou: MÚLTIPLOS geradores de id, um deles gravando um literal.
 *
 * Antes da F13 havia quatro:
 *   backend  `arranjosService.novoId`     · frontend `GerenciadorArranjos.novoId`
 *   frontend `ProjetoFVContext`           · frontend `E7Equipamentos` → `'arr_primario'`
 *
 * O quarto era o defeito: escrevia sempre a mesma string. No acervo, um projeto
 * ficou com dois `arr_primario`, ambos `tipo=principal` — e
 * `find(tipo === 'principal')` escolhe o primeiro sem dizer que havia dois,
 * inclusive em `homologacaoController`.
 *
 *   node backend/src/dominio/__checks__/identidadeArranjoF13.check.js
 */
import path from 'node:path'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  novoIdArranjo, idValido, idsDuplicados, garantirIdentidade, principaisDoProjeto,
} from '@fortesolar/fv-shared/projeto/identidade-arranjo'
import { normalizarArranjos } from '../../services/arranjosService.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const nota = (m) => console.log('  · ' + m)
const secao = (t) => console.log(`\n── ${t}`)
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const ler = (rel) => semComentarios(readFileSync(path.resolve(RAIZ, rel), 'utf8'))

const arr = (id, extra = {}) => ({ id, paineis: [], inversores: [], ...extra })

secao('1 · IDs únicos dentro do projeto')
const comDup = garantirIdentidade([arr('arr_primario'), arr('arr_primario'), arr('arr_B')])
ok(idsDuplicados(comDup).length === 0, 'duplicata é desempatada')
ok(comDup[0].id === 'arr_primario', 'e a PRIMEIRA ocorrência mantém o id — quem estava certo não muda')
ok(idsDuplicados([arr('x'), arr('x')]).length === 1,
  'sanidade — o detector realmente acusa duplicata')

secao('2 · Identidade não deriva do índice')
const a1 = garantirIdentidade([arr(null), arr(null)])
const a2 = garantirIdentidade([arr(null), arr(null)])
ok(a1[0].id !== a2[0].id, 'duas listas de mesmo tamanho não recebem os mesmos ids')
ok(!/^\d+$/.test(a1[0].id), 'o id não é um número de posição')

secao('3 · Reordenar não muda identidade')
const A = arr('arr_A', { rotulo: 'A' }); const B = arr('arr_B', { rotulo: 'B' })
const invertido = garantirIdentidade([B, A])
ok(invertido.find((x) => x.rotulo === 'A').id === 'arr_A'
  && invertido.find((x) => x.rotulo === 'B').id === 'arr_B',
  'cada arranjo mantém o próprio id depois da troca de posição')

secao('4 · Duplicar cria identidade nova')
const copia = { ...JSON.parse(JSON.stringify(A)), id: novoIdArranjo() }
ok(copia.id !== A.id && idValido(copia.id), 'a cópia nasce com id próprio')

secao('5 · Reload preserva identidade — a função é idempotente')
const salvo = garantirIdentidade([arr('arr_A'), arr('arr_B')])
const relido = garantirIdentidade(JSON.parse(JSON.stringify(salvo)))
ok(JSON.stringify(relido.map((x) => x.id)) === JSON.stringify(['arr_A', 'arr_B']),
  'passar duas vezes não reescreve nada')
// A LEITURA do projeto não pode inventar identidade: `normalizarArranjos`
// preenche id ausente para uso interno, mas não persiste — e não pode trocar
// um id existente.
const lidos = normalizarArranjos({ arranjos: [arr('arr_A'), arr('arr_B')] })
ok(lidos[0].id === 'arr_A' && lidos[1].id === 'arr_B',
  '`normalizarArranjos` preserva os ids que encontra')

secao('6 · Nenhum arranjo pode ter dois `principal`')
ok(principaisDoProjeto([arr('a', { tipo: 'principal' }), arr('b', { tipo: 'principal' })]).length === 2,
  '`principaisDoProjeto` CONTA — diferente de `find`, que esconde o segundo')
ok(principaisDoProjeto([arr('a', { tipo: 'principal' })]).length === 1, 'e reconhece o caso correto')

secao('7 · Um gerador só — o literal não volta')
// Proíbe o USO do literal como valor de `id`, não a menção em comentário.
const FONTES = [
  'frontend/src/components/fv/etapas/E7Equipamentos.jsx',
  'frontend/src/components/fv/GerenciadorArranjos.jsx',
  'frontend/src/contexts/ProjetoFVContext.jsx',
  'backend/src/services/arranjosService.js',
]
const LITERAL = /id\s*:\s*['"`]arr_/
const GERADOR_LOCAL = /(?:const|let|function)\s+novoId\s*(?:=\s*\([^)]*\)\s*=>|\()\s*[^=]*`/
for (const f of FONTES) {
  const src = ler(f)
  ok(!LITERAL.test(src), `${path.basename(f)} não grava id literal`)
  ok(!GERADOR_LOCAL.test(src), `${path.basename(f)} não define gerador próprio`)
}
ok(LITERAL.test("{ id: 'arr_primario', rotulo: 'Arranjo A' }"),
  'sanidade — o padrão reconhece o literal que pretende proibir')
// Todos apontam para o SSOT.
for (const f of FONTES) {
  ok(/identidade-arranjo/.test(ler(f)), `${path.basename(f)} importa o gerador canônico`)
}

secao('8 · A ESCRITA garante identidade; a leitura não a reescreve')
const ctrl = ler('backend/src/controllers/projetosFVController.js')
ok(/\$set\.arranjos\s*=\s*garantirIdentidade\(/.test(ctrl),
  'o caminho de gravação de `arranjos` passa por `garantirIdentidade`')

secao('9 · `equipamento_id` continua a referência SSOT (F-02/F-03)')
const comEquip = garantirIdentidade([{ id: null, paineis: [{ modelo: 'TSM', quantidade: 211, equipamento_id: 'abc' }], inversores: [] }])
ok(comEquip[0].paineis[0].equipamento_id === 'abc',
  'a normalização de identidade não toca na referência de equipamento')
ok(comEquip[0].paineis[0].quantidade === 211, 'nem na quantidade')

secao('10 · Multiarranjo continua DESABILITADO — este sprint é só identidade')
const integridade = ler('backend/src/dominio/unifilar/integridade.js')
ok(/MULTIPLOS_INVERSORES/.test(integridade) && /n_inversores_total/.test(integridade),
  '`MULTIPLOS_INVERSORES` segue existindo e armado')

secao('11 · Consumidores que ainda dependem de posição — registrados, não corrigidos')
const arquivos = []
const anda = (d) => { for (const n of readdirSync(d)) { const q = path.join(d, n)
  if (statSync(q).isDirectory()) { if (n === '__checks__' || n === '__tests__' || n === 'node_modules') continue; anda(q) }
  else if (/\.jsx?$/.test(n)) arquivos.push(q) } }
anda(path.resolve(RAIZ, 'backend/src'))
const POSICAO = /arranjos\s*\[\s*0\s*\]/
const posicionais = arquivos.filter((f) => POSICAO.test(semComentarios(readFileSync(f, 'utf8'))))
ok(posicionais.length <= 2,
  `${posicionais.length} consumidor(es) ainda usam \`arranjos[0]\` — teto de 2, nenhum novo`)
posicionais.forEach((f) => nota(path.relative(RAIZ, f)))
nota('ambos fazem `find(tipo === "principal") ?? arranjos[0]`; migrá-los é da fase multiarranjo')

console.log(falhas === 0
  ? '\nOK — identidade única, estável e independente de posição; um gerador só.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
