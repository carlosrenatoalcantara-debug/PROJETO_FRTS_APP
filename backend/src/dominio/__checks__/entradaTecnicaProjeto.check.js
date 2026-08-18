/**
 * entradaTecnicaProjeto.check.js — FV-UX-018
 *
 * A FV-OPS-001 encontrou UM ponto de fuga no fluxo canônico: consumo, tarifa,
 * ligação, tensão, concessionária e UF só podiam ser informados pelo wizard.
 * A sprint fechou a lacuna criando uma TELA — não uma rota, não um campo, não
 * um agregado.
 *
 * Este check prova exatamente isso: que a escrita continua acontecendo pela
 * operação que já existia, com a mesma lista fechada de etapas e a mesma
 * whitelist de campos, e que o unifilar volta a enxergar o que foi informado.
 *
 *   node backend/src/dominio/__checks__/entradaTecnicaProjeto.check.js
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { adaptarProjetoParaUnifilar, lacunasDaProveniencia } from '../unifilar/index.js'
import { obterLocalProjeto } from '../local/obterLocalProjeto.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

const ler = (rel) => readFileSync(path.resolve(AQUI, rel), 'utf8')
/** Fonte sem comentários — para que o próprio texto explicativo não dispare. */
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const CTRL = ler('../../controllers/projetosFVController.js')
const ROTAS = ler('../../routes/projetosFV.js')
const MODELO = ler('../../models/ProjetoFV.js')
const API_UX = ler('../../../../frontend/src/fv/api/agregadosFvApi.js')
const ETAPA_UX = ler('../../../../frontend/src/fv/paginas/etapas/EtapaProjeto.jsx')
const PROVIDER_UX = ler('../../../../frontend/src/fv/providers/ProjetoProvider.jsx')

/** Os seis campos da sprint, com o caminho persistido de cada um. */
const CAMPOS = [
  ['consumo', 'fatura_extracao.consumo_mensal_kwh'],
  ['tarifa', 'fatura_extracao.valor_kwh'],
  ['tensão', 'fatura_extracao.tensao_v'],
  ['ligação', 'fatura_extracao.tipo_ligacao'],
  ['concessionária', 'fatura_extracao.concessionaria'],
  ['UF', 'localizacao.estado'],
]

secao('1 · Nenhuma rota nova — a operação já existia')
ok(ROTAS.includes("router.put('/:id/etapa'"), 'PUT /:id/etapa continua sendo a operação de escrita')
for (const inventada of ['/dados-tecnicos', '/tecnico', '/consumo', '/entrada-tecnica']) {
  ok(!ROTAS.includes(inventada), `nenhuma rota \`${inventada}\` foi criada`)
}
ok(API_UX.includes('${base(projetoId)}/etapa'), 'a UX chama a rota existente')

secao('2 · Nenhum campo novo no schema')
for (const [nome, caminho] of CAMPOS) {
  const folha = caminho.split('.').pop()
  ok(MODELO.includes(`${folha}:`), `${nome} → \`${caminho}\` já existia no schema`)
}
for (const inventado of ['dados_tecnicos', 'entrada_tecnica', 'premissas_tecnicas']) {
  ok(!MODELO.includes(inventado), `nenhum campo \`${inventado}\` foi criado`)
}

secao('3 · A whitelist do servidor cobre os campos — e continua fechada')
const trechoFatura = CTRL.slice(CTRL.indexOf('CAMPOS_FATURA_PERMITIDOS'), CTRL.indexOf('CAMPOS_FATURA_PERMITIDOS') + 600)
for (const campo of ['concessionaria', 'tipo_ligacao', 'tensao_v', 'consumo_mensal_kwh', 'valor_kwh']) {
  ok(trechoFatura.includes(`'${campo}'`), `\`${campo}\` está na whitelist da etapa fatura`)
}
ok(!trechoFatura.includes("'dados_brutos'"), 'a whitelist NÃO abriu `dados_brutos`')
ok(CTRL.includes('ETAPAS_PERMITIDAS'), 'a lista de etapas continua fechada')
const trechoEtapas = CTRL.slice(CTRL.indexOf('ETAPAS_PERMITIDAS = ['), CTRL.indexOf('ETAPAS_PERMITIDAS = [') + 700)
ok(trechoEtapas.includes("'fatura'") && trechoEtapas.includes("'localizacao'"),
  'as duas etapas usadas pela tela pertencem à lista')

secao('4 · Tenant e congelamento seguem no servidor (M-4)')
const inicio = CTRL.indexOf('export const salvarEtapaProjetoFV')
const handler = CTRL.slice(inicio, CTRL.indexOf('\nexport const', inicio + 10))
ok(handler.includes('aplicarEscopo'), 'a escrita é escopada por organização')
ok(handler.includes('resolverCongelamento'), 'o guard de congelamento continua no handler')
ok(handler.includes('PROJETO_CONGELADO'), 'projeto congelado responde com código próprio')
ok(!semComentarios(ETAPA_UX).includes('empresa_id'), 'a tela não envia tenant — vem do token')

secao('5 · A tela não decide nada')
for (const proibido of ['Math.pow', 'Math.sqrt', 'calcularVPL', 'calcularTIR',
  'engenhariaNormativa', '@fortesolar/fv-shared', 'fetch(', 'apiFetch', 'axios']) {
  ok(!ETAPA_UX.includes(proibido), `a etapa não contém \`${proibido}\``)
}
ok(ETAPA_UX.includes('acoes.salvarEtapa'), 'a etapa grava só pela ação do provider')

secao('6 · Ausência ≠ zero')
const etapaSemCom = semComentarios(ETAPA_UX)
for (const def of ['?? 220', '|| 220', '?? 127', '|| 127', '?? 380', '|| 380', '?? 1500', '|| 1500']) {
  ok(!etapaSemCom.includes(def), `nenhum default técnico \`${def}\``)
}
ok(etapaSemCom.includes("if (s === '') return null"), 'campo vazio vira null explícito')
ok(!etapaSemCom.includes("return 0"), 'nenhum caminho devolve 0 por omissão')

secao('7 · Uma fonte só — a tela não guarda cópia do agregado')
ok(ETAPA_UX.includes('useProjeto'), 'lê o agregado do ProjetoProvider')
for (const paralelo of ['createContext', 'localStorage', 'sessionStorage', 'buscarProjeto']) {
  ok(!ETAPA_UX.includes(paralelo), `sem estado paralelo (\`${paralelo}\`)`)
}
ok(PROVIDER_UX.includes('await recarregar()'), 'após gravar, o servidor é relido — o eco do PUT não vira estado')

secao('8 · O efeito: o que o unifilar deixa de assumir')
/** Projeto recém-criado, como a FV-OPS-001 o encontrou. */
const ANTES = {
  _id: '000000000000000000000001',
  nome: 'Projeto E2E',
  clienteId: { nome: 'Cliente E2E' },
  localizacao: { cidade: 'Natal', estado: null, temperatura_min_historica_c: 18 },
  fatura_extracao: {},
  equipamentos: {
    paineis: [{ id: 'dah_550', marca: 'DAH', modelo: 'DHN-550', potencia_w: 550, quantidade: 26 }],
    inversor: { marca: 'Deye', modelo: 'SUN-8K-G03', potencia_kw: 8, tipo: 'string' },
  },
  dimensionamento: { potencia_kwp: 14.3, num_paineis: 26, num_strings: 3, num_inversores: 1 },
}

/** O mesmo projeto DEPOIS do que a tela grava — e só isso. */
const DEPOIS = {
  ...ANTES,
  localizacao: { ...ANTES.localizacao, estado: 'RN' },
  fatura_extracao: {
    concessionaria: 'NEOENERGIA COSERN', tipo_ligacao: 'Trifásico',
    tensao_v: 380, consumo_mensal_kwh: 1500, valor_kwh: 0.98,
  },
}

const lacunasAntes = lacunasDaProveniencia(adaptarProjetoParaUnifilar(ANTES).proveniencia)
const lacunasDepois = lacunasDaProveniencia(adaptarProjetoParaUnifilar(DEPOIS).proveniencia)
console.log(`   antes:  ${JSON.stringify(lacunasAntes)}`)
console.log(`   depois: ${JSON.stringify(lacunasDepois)}`)
for (const campo of ['tipo_ligacao', 'tensao', 'distribuidora', 'uf']) {
  ok(lacunasAntes.includes(campo), `\`${campo}\` era lacuna antes`)
  ok(!lacunasDepois.includes(campo), `\`${campo}\` deixou de ser lacuna`)
}

secao('9 · O que a sprint NÃO resolveu continua declarado')
ok(lacunasDepois.includes('arranjoMPPTs'),
  '`arranjoMPPTs` segue lacuna — topologia MPPT está fora do escopo desta sprint')
ok(DEPOIS.engenharia_eletrica === undefined, 'nenhuma topologia foi inventada pela tela')

secao('10 · Os valores informados chegam íntegros ao motor')
const { entrada } = adaptarProjetoParaUnifilar(DEPOIS)
ok(entrada.tipo_ligacao === 'Trifásico', `ligação preservada (${entrada.tipo_ligacao})`)
ok(entrada.tensao === '380', `tensão preservada (${entrada.tensao})`)
ok(entrada.distribuidora === 'NEOENERGIA COSERN', 'concessionária preservada')
ok(entrada.uf === 'RN', 'UF preservada')
ok(obterLocalProjeto(DEPOIS).estado === 'RN', 'a UF também aparece no local resolvido')

secao('11 · Gravar a UF não pode apagar a fundação climática')
// O handler faz `$set.localizacao = dados` — substituição integral. A tela
// envia sobre uma cópia do que o servidor devolveu; este check fixa o motivo.
const trechoLocalizacao = CTRL.slice(CTRL.indexOf("case 'localizacao'"), CTRL.indexOf("case 'dimensionamento'"))
ok(trechoLocalizacao.includes('$set.localizacao = dados'), 'o handler continua substituindo o subdocumento')
ok(etapaSemCom.includes('...(projeto?.localizacao ?? {})'), 'a tela envia sobre a cópia do servidor')

console.log(falhas === 0
  ? '\nOK — entrada técnica na nova UX pela operação existente; nenhuma fonte, rota ou campo novo.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
