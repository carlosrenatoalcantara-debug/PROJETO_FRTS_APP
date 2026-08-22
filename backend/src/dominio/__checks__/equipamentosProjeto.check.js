/**
 * equipamentosProjeto.check.js — FV-UX-019
 *
 * Segundo bloqueio P0 da FV-OPS-001: selecionar módulo e inversor sem sair para
 * o wizard. Como no primeiro, nada foi criado no domínio — este check existe
 * para provar isso, e para provar o que a seleção passa a fechar no unifilar.
 *
 *   node backend/src/dominio/__checks__/equipamentosProjeto.check.js
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { adaptarProjetoParaUnifilar, lacunasDaProveniencia } from '../unifilar/index.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

const ler = (rel) => readFileSync(path.resolve(AQUI, rel), 'utf8')
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const CTRL = ler('../../controllers/projetosFVController.js')
const ROTAS_EQUIP = ler('../../routes/equipamentos.js')
const ROTAS_FV = ler('../../routes/projetosFV.js')
const MODELO = ler('../../models/ProjetoFV.js')
const API_UX = ler('../../../../frontend/src/fv/api/agregadosFvApi.js')
const ETAPA_UX = ler('../../../../frontend/src/fv/paginas/etapas/EtapaEquipamentos.jsx')
const CATALOGO_UX = ler('../../../../frontend/src/fv/catalogo.js')

secao('1 · Nenhuma rota nova')
ok(ROTAS_FV.includes("router.put('/:id/etapa'"), 'a escrita continua em PUT /:id/etapa')
ok(ROTAS_EQUIP.includes("router.get('/engenharia'"), 'o catálogo continua em GET /api/equipamentos/engenharia')
ok(API_UX.includes('/api/equipamentos/engenharia?tipo='), 'a UX consome a rota oficial do catálogo')
for (const inventada of ['/api/catalogo', '/equipamentos/fv', '/modulos', '/inversores']) {
  ok(!API_UX.includes(inventada), `nenhuma rota \`${inventada}\` foi criada`)
}

secao('2 · Nenhum campo novo — o subdocumento já existia')
const bloco = MODELO.slice(MODELO.indexOf('  equipamentos: {'), MODELO.indexOf('  arranjos: ['))
for (const campo of ['paineis', 'inversor', 'equipamento_id', 'potencia_w', 'potencia_kw', 'quantidade', 'fases']) {
  ok(bloco.includes(campo), `\`equipamentos.${campo}\` já existia no schema`)
}
ok(bloco.includes("ref: 'Equipamento'"), '`equipamento_id` já referenciava o catálogo')

secao('3 · A etapa `equipamentos` pertence à lista fechada')
const trechoEtapas = CTRL.slice(CTRL.indexOf('ETAPAS_PERMITIDAS = ['), CTRL.indexOf('ETAPAS_PERMITIDAS = [') + 700)
ok(trechoEtapas.includes("'equipamentos'"), 'a etapa está na lista')
const handler = CTRL.slice(CTRL.indexOf('export const salvarEtapaProjetoFV'),
  CTRL.indexOf('\nexport const', CTRL.indexOf('export const salvarEtapaProjetoFV') + 10))
ok(handler.includes('aplicarEscopo'), 'a escrita é escopada por organização (M-4)')
ok(handler.includes('resolverCongelamento'), 'o guard de congelamento continua ativo')
// A etapa cai no `default` do switch: substituição integral, sem whitelist.
ok(handler.includes('$set[etapa] = dados'), 'a etapa substitui o subdocumento inteiro')

secao('4 · O catálogo é a fonte — não há segundo catálogo')
const fontesUX = semComentarios(ETAPA_UX) + semComentarios(CATALOGO_UX)
for (const marca of ['Canadian', 'Fronius', 'Sungrow', 'Growatt', 'Trina', 'Risen', 'Deye',
  'INVERSORES_DATA', 'PAINEIS_DATA', 'DADOS_ELETRICOS', 'catalogoPaineis']) {
  ok(!fontesUX.includes(marca), `nenhuma lista embutida (\`${marca}\`)`)
}
ok(ETAPA_UX.includes('listarCatalogo'), 'a tela lê o catálogo do servidor')
ok(CATALOGO_UX.includes('equipamento_id'), 'a gravação carrega a referência ao catálogo')

secao('5 · Zero defaults técnicos')
for (const p of ['?? 0', '|| 0', '?? 12', '?? 25', '?? 550', '|| 550', '?? 1.30', '?? 5,']) {
  ok(!fontesUX.includes(p), `sem default \`${p}\``)
}
ok(CATALOGO_UX.includes('return null'), 'especificação ausente devolve null')

secao('6 · Nenhuma engenharia nem finança no cliente')
for (const p of ['Math.pow', 'Math.sqrt', 'Math.ceil', 'engenhariaNormativa', 'unifilar-svg',
  'calcularVPL', 'calcularTIR', 'oversizing', 'num_strings', 'modulos_por_string']) {
  ok(!fontesUX.includes(p), `ausente: \`${p}\``)
}
// A única regra compartilhada é a classificação de tecnologia — reúso da fonte
// única, não uma segunda opinião escrita no cliente.
// A FV-UX-019 exigia exatamente 1 import. A FV-UX-028 (A5b) somou `lerInversor`,
// o leitor SSOT do inversor — que SUBSTITUIU a lista de aliases que este arquivo
// mantinha. Não é regra a mais: é uma regra local a menos. A exigência passou a
// ser que TODO import venha do pacote compartilhado.
const imports = CATALOGO_UX.split('\n').filter((l) => l.startsWith('import '))
ok(imports.length > 0 && imports.every((l) => l.includes('@fortesolar/fv-shared')),
  `todos os ${imports.length} imports vêm de @fortesolar/fv-shared`)
ok(CATALOGO_UX.includes('tecnologiaInversor'), 'classificação pela regra do domínio')
ok(CATALOGO_UX.includes('lerInversor'), 'leitura pelo dicionário SSOT')
ok(!semComentarios(CATALOGO_UX).includes('paraDimensionamento'),
  '`paraDimensionamento` fora — é ele que carrega os defaults')

secao('7 · Nenhuma cópia paralela do estado do projeto')
for (const p of ['createContext', 'localStorage', 'sessionStorage', 'buscarProjeto']) {
  ok(!ETAPA_UX.includes(p), `sem estado paralelo (\`${p}\`)`)
}

secao('8 · O efeito no unifilar')
/** Projeto com dados técnicos (FV-UX-018) mas SEM equipamentos. */
const ANTES = {
  _id: '000000000000000000000001',
  nome: 'Projeto E2E',
  clienteId: { nome: 'Cliente E2E' },
  localizacao: { cidade: 'Natal', estado: 'RN' },
  fatura_extracao: { tipo_ligacao: 'Trifásico', tensao_v: 380, concessionaria: 'NEOENERGIA COSERN' },
  equipamentos: { paineis: [], inversor: {} },
}

/** O mesmo projeto após a seleção — e SÓ ela. */
const DEPOIS = {
  ...ANTES,
  equipamentos: {
    paineis: [{ id: 'm1', marca: 'DAH', modelo: 'DHN-550', potencia_w: 550, quantidade: 26, equipamento_id: 'm1' }],
    inversor: { id: 'i1', marca: 'Deye', modelo: 'SUN-8K-G03', potencia_kw: 8, tipo: 'string', fases: 3, equipamento_id: 'i1' },
  },
}

const lacunasAntes = lacunasDaProveniencia(adaptarProjetoParaUnifilar(ANTES).proveniencia)
const lacunasDepois = lacunasDaProveniencia(adaptarProjetoParaUnifilar(DEPOIS).proveniencia)
console.log(`   antes:  ${JSON.stringify(lacunasAntes)}`)
console.log(`   depois: ${JSON.stringify(lacunasDepois)}`)
for (const campo of ['painel', 'inversor']) {
  ok(lacunasAntes.includes(campo), `\`${campo}\` era lacuna`)
  ok(!lacunasDepois.includes(campo), `\`${campo}\` deixou de ser lacuna`)
}

secao('9 · O que a sprint NÃO resolveu continua declarado')
ok(lacunasDepois.includes('arranjoMPPTs'), '`arranjoMPPTs` segue lacuna — MPPT fora do escopo')
ok(lacunasDepois.includes('dimensionamento'),
  '`dimensionamento` segue lacuna — a quantidade de módulos não é dimensionamento')
ok(DEPOIS.dimensionamento === undefined, 'nenhum dimensionamento foi inventado')
ok(DEPOIS.engenharia_eletrica === undefined, 'nenhuma topologia foi inventada')

secao('10 · Os valores selecionados chegam íntegros ao motor')
const { entrada } = adaptarProjetoParaUnifilar(DEPOIS)
ok(entrada.painel.potenciaW === 550, `potência do módulo (${entrada.painel.potenciaW} W)`)
ok(entrada.painel.marca === 'DAH', 'marca do módulo')
ok(entrada.inversor.potenciaKW === 8, `potência do inversor (${entrada.inversor.potenciaKW} kW)`)
ok(entrada.inversor.tipo === 'string', 'tecnologia do inversor')
ok(entrada.inversor.nMppts === null, 'nMppts continua nulo — vem da topologia, não da seleção')

secao('11 · Potência ausente no catálogo permanece ausente')
const SEM_SPEC = {
  ...ANTES,
  equipamentos: {
    paineis: [{ id: 'm3', marca: 'Genérico', modelo: 'SEM-SPEC', potencia_w: null, quantidade: 26, equipamento_id: 'm3' }],
    inversor: {},
  },
}
const semSpec = adaptarProjetoParaUnifilar(SEM_SPEC).entrada
ok(semSpec.painel.potenciaW === null, 'potência nula não virou 0 nem 550 no adapter')

console.log(falhas === 0
  ? '\nOK — seleção por referência ao catálogo, pela operação existente; sem catálogo, rota ou campo novo.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
