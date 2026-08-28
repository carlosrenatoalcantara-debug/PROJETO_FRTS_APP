/**
 * topologiaMpptUX.check.js — FV-UX-026
 *
 * A etapa de topologia é a única técnica que NÃO calcula: o projetista autora,
 * o validador canônico julga. Este check prova as duas metades disso.
 *
 *   node backend/src/dominio/__checks__/topologiaMpptUX.check.js
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { adaptarProjetoParaUnifilar, lacunasDaProveniencia } from '../unifilar/index.js'
import { analisarCompatibilidade } from '../../services/compatibilidadeEletricaService.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

const ler = (rel) => readFileSync(path.resolve(RAIZ, rel), 'utf8')
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const CTRL = ler('backend/src/controllers/projetosFVController.js')
const MODELO = ler('backend/src/models/ProjetoFV.js')
const ETAPA = ler('frontend/src/fv/paginas/etapas/EtapaMppt.jsx')
const TOPO = ler('frontend/src/fv/topologia.js')
const API_UX = ler('frontend/src/fv/api/agregadosFvApi.js')

secao('1 · Nenhuma rota, schema ou agregado novo')
const trechoEtapas = CTRL.slice(CTRL.indexOf('ETAPAS_PERMITIDAS = ['), CTRL.indexOf('ETAPAS_PERMITIDAS = [') + 700)
ok(trechoEtapas.includes("'engenharia_eletrica'"), 'a etapa já pertencia à lista fechada')
const sub = CTRL.slice(CTRL.indexOf("const SUBCAMPOS = ["), CTRL.indexOf("const SUBCAMPOS = [") + 120)
for (const s of ['arranjo', 'clima_utilizado', 'compatibilidade']) {
  ok(sub.includes(`'${s}'`), `subcampo \`${s}\` já na whitelist`)
}
const blocoSchema = MODELO.slice(MODELO.indexOf('const engenhariaEletricaV3Schema'), MODELO.indexOf('const snapshotUnifilarV3Schema'))
for (const campo of ['mppts', 'strings_paralelo', 'modulos_por_string', 'total_modulos',
  'entradas', 'num_mppts_usados']) {
  ok(blocoSchema.includes(campo), `\`${campo}\` já existia no schema`)
}
ok(API_UX.includes("'/api/engenharia/compatibilidade-eletrica'"), 'usa a rota canônica de validação')
ok(!API_UX.includes('/api/dimensionamento/strings'), '`/strings` NÃO é consumido')

secao('2 · Modelo A — nada é distribuído automaticamente')
const fontes = semComentarios(ETAPA) + semComentarios(TOPO)
for (const p of ['sugerirMPPTs', 'autoConfigurar', 'montarStrings', 'Math.ceil(numPaineis']) {
  ok(!fontes.includes(p), `sem distribuição automática (\`${p}\`)`)
}
ok(TOPO.includes('ENTRADA AUTORAL'), 'o modelo declara a autoria do projetista')
ok(TOPO.includes('export function topologiaVazia'), 'a topologia inicial nasce VAZIA')

secao('3 · Nenhuma fórmula elétrica no cliente')
// FV-UX-028 (A2): `@fortesolar/fv-shared` saiu da lista de proibidos — a etapa
// passou a CONSUMIR `calcularTemperaturas`. O que segue proibido é REESCREVER
// fórmula ou tabela; por isso `TEMPERATURAS_UF` entrou no lugar.
for (const p of ['Math.pow', 'fatorTermico', 'temperaturaCelula', 'correnteProjeto',
  'coefParaFracao', '1.25', 'oversizing =', 'TEMPERATURAS_UF']) {
  ok(!fontes.includes(p), `ausente no cliente: \`${p}\``)
}
ok(ETAPA.includes('validarCompatibilidadeEletrica'), 'a tela chama o validador canônico')
const importsPkg = ETAPA.split('\n').filter((l) => l.includes('@fortesolar/fv-shared'))
ok(importsPkg.length === 1 && importsPkg[0].includes('calcularTemperaturas'),
  'A2 — único import do pacote é `calcularTemperaturas` (tabela canônica)')

secao('4 · Ausência ≠ zero, e nenhum default técnico')
for (const d of ['?? 8', '|| 8', '?? 6', '|| 6', '?? 14', '|| 14', '?? 550', '?? 2,']) {
  ok(!fontes.includes(d), `sem default \`${d}\``)
}
ok(TOPO.includes("if (v === null || v === undefined || v === '') return null"),
  'campo vazio vira null explícito')

secao('5 · O shape gravado é o que o unifilar lê')
// Topologia autorada, com MPPTs DESIGUAIS — o caso que nenhum motor deriva.
const PROJETO = {
  _id: '000000000000000000000001',
  nome: 'Projeto', clienteId: { nome: 'Cliente' },
  localizacao: { cidade: 'Natal', estado: 'RN' },
  fatura_extracao: { tipo_ligacao: 'Trifásico', tensao_v: 380, concessionaria: 'COSERN' },
  equipamentos: {
    paineis: [{ id: 'm1', marca: 'DAH', modelo: 'DHN-550', potencia_w: 550, quantidade: 24, equipamento_id: 'm1' }],
    inversor: { id: 'i1', marca: 'Sungrow', modelo: 'SG20RT', potencia_kw: 20, tipo: 'string', fases: 3 },
  },
  dimensionamento: { potencia_kwp: 13.2, num_paineis: 24, num_strings: 3, num_inversores: 1 },
  engenharia_eletrica: {
    arranjo: {
      quantidade_modulos_por_string: 10, quantidade_strings_paralelo: 2,
      total_modulos: 24, num_mppts_usados: 2,
      mppts: [
        { mppt: 1, strings_paralelo: 2, modulos_por_string: 10, total_modulos: 20,
          entradas: [{ entrada: 1, strings: [{ modulos: 10 }, { modulos: 10 }] }] },
        { mppt: 2, strings_paralelo: 1, modulos_por_string: 4, total_modulos: 4,
          entradas: [{ entrada: 1, strings: [{ modulos: 4 }] }] },
      ],
    },
  },
}
const { entrada, proveniencia } = adaptarProjetoParaUnifilar(PROJETO)
ok(Array.isArray(entrada.arranjoMPPTs) && entrada.arranjoMPPTs.length === 2,
  `o unifilar recebe ${entrada.arranjoMPPTs?.length} MPPTs`)
ok(entrada.arranjoMPPTs[0].numStrings === 2 && entrada.arranjoMPPTs[0].modulosPorString === 10,
  'MPPT 1: 2 strings × 10 módulos')
ok(entrada.arranjoMPPTs[1].numStrings === 1 && entrada.arranjoMPPTs[1].modulosPorString === 4,
  'MPPT 2: 1 string × 4 módulos — desigual PRESERVADO')
ok(proveniencia.arranjoMPPTs === 'engenharia_eletrica.arranjo.mppts', 'proveniência declarada')

secao('6 · A topologia fecha a última lacuna')
const SEM = { ...PROJETO, engenharia_eletrica: null }
const antes = lacunasDaProveniencia(adaptarProjetoParaUnifilar(SEM).proveniencia)
const depois = lacunasDaProveniencia(proveniencia)
console.log(`   antes: ${JSON.stringify(antes)} → depois: ${JSON.stringify(depois)}`)
ok(antes.includes('arranjoMPPTs'), '`arranjoMPPTs` era lacuna')
ok(depois.length === 0, 'lacunas = []')

secao('7 · Validação por MPPT — grandezas por MPPT batem')
// Cada MPPT é submetido com `num_mppt_usados: 1`, como a tela faz.
const MOD = { voc: 49.9, vmpp: 41.8, isc: 14, impp: 13.2, potencia_w: 550,
  coef_temp_voc: -0.27, temp_noct: 44 }
const INV = { tensao_max_entrada: 1000, mppt_min: 200, mppt_max: 850,
  corrente_max_mppt: 25, potencia_ca_kw: 20 }
const CLIMA = { temperatura_min_historica_c: 14, temperatura_max_historica_c: 38 }
const porMppt = PROJETO.engenharia_eletrica.arranjo.mppts.map((m) => analisarCompatibilidade({
  dados_eletricos_modulo: MOD, dados_eletricos_inversor: INV,
  arranjo_proposto: {
    quantidade_modulos_por_string: m.modulos_por_string,
    quantidade_strings_paralelo: m.strings_paralelo,
    num_mppt_usados: 1,
  },
  dados_climaticos_regiao: CLIMA,
}))
console.log(`   MPPT 1: Voc ${porMppt[0].calculos.voc_string_max} V · Isc ${porMppt[0].calculos.isc_total} A`)
console.log(`   MPPT 2: Voc ${porMppt[1].calculos.voc_string_max} V · Isc ${porMppt[1].calculos.isc_total} A`)
ok(porMppt[0].calculos.isc_total === 35, `MPPT 1 — Isc 14 × 2 × 1,25 = ${porMppt[0].calculos.isc_total} A`)
ok(porMppt[1].calculos.isc_total === 17.5, `MPPT 2 — Isc 14 × 1 × 1,25 = ${porMppt[1].calculos.isc_total} A`)
ok(porMppt[0].calculos.isc_total !== porMppt[1].calculos.isc_total,
  'MPPTs desiguais produzem diagnósticos diferentes — é o ponto do Modelo A')
ok(porMppt[0].erros.some((e) => e.codigo === 'CORRENTE_ISC_EXCEDIDA'),
  'MPPT 1 excede 25 A e é reprovado')
ok(!porMppt[1].erros.some((e) => e.codigo === 'CORRENTE_ISC_EXCEDIDA'),
  'MPPT 2 passa — a reprovação é local, não global')

secao('8 · Oversizing global de topologia desigual fica PENDENTE, não inventado')
// O validador só descreve arranjo uniforme (`total = mps × strings × nMppts`).
// Para topologia desigual não existe tripla uniforme que reproduza o total real,
// e a tela declara a pendência em vez de calcular por conta própria.
ok(ETAPA.includes('não é avaliado pelo validador') || ETAPA.includes('permanece pendente'),
  'a tela declara a limitação do oversizing')
ok(!semComentarios(ETAPA).includes('potencia_cc'), 'a tela não calcula potência CC')
ok(!semComentarios(ETAPA).includes('/ potencia_ca'), 'a tela não calcula oversizing')

secao('9 · Erro bloqueante impede salvar')
const fonteEtapa = semComentarios(ETAPA)
ok(fonteEtapa.includes("d?.severidade === 'critico'"), 'severidade crítica vem do servidor')
ok(fonteEtapa.includes('disabled={salvando || !validado || temBloqueio}'),
  'o botão salvar é bloqueado por erro elétrico')
ok(fonteEtapa.includes('if (!validado || temBloqueio) return'), 'e a função também recusa')

secao('10 · Nenhum indicador financeiro, nenhuma cópia do agregado')
for (const p of ['payback', 'vpl_r', 'tir_aa', 'economia_anual']) {
  ok(!fonteEtapa.includes(p), `a etapa não toca \`${p}\``)
}
for (const p of ['createContext', 'localStorage', 'sessionStorage', 'buscarProjeto', 'fetch(']) {
  ok(!ETAPA.includes(p), `sem estado paralelo nem HTTP direto (\`${p}\`)`)
}


// ═══ FV-UX-028 — as cinco correções objetivas ═══════════════════════════════
const CATALOGO = ler('frontend/src/fv/catalogo.js')
const EQUIP = ler('frontend/src/fv/paginas/etapas/EtapaEquipamentos.jsx')
const catSemCom = semComentarios(CATALOGO)

secao('11 · A5b — `catalogo.js` consome o leitor SSOT')
ok(catSemCom.includes('lerInversor('), 'usa `lerInversor` do dicionário canônico')
ok(!catSemCom.includes('paraDimensionamento'),
  '`paraDimensionamento` NÃO é usado — a nova UX lê o SSOT direto (FV-UX-028)')
// Nenhuma lista de aliases de inversor sobrevivendo no arquivo.
for (const alias of ["'voc_max_dc'", "'faixa_mppt_min'", "'corrente_max_por_mppt'", "'fases_saida'"]) {
  ok(!catSemCom.includes(alias), `sem leitor paralelo (${alias})`)
}
for (const d of ['?? 2', '?? 600', '?? 100', '?? 550', '?? 13', '|| 2', '|| 600']) {
  ok(!catSemCom.includes(d), `sem default numérico \`${d}\``)
}

secao('12 · A3 — seletor enriquecido, sem classificação nova')
ok(CATALOGO.includes('export function rotuloDoInversor'), 'rótulo dedicado ao inversor')
ok(CATALOGO.includes('TECNOLOGIAS_INVERSOR'), 'lista FECHADA de tecnologias')
ok(catSemCom.includes('tecnologiaInversor('), 'classificação vem da regra do domínio')
ok(EQUIP.includes('optgroup'), 'a lista é agrupada por tecnologia')
ok(EQUIP.includes('rotuloDoInversor'), 'a tela usa o rótulo enriquecido')

secao('13 · A4 — aviso de fase, sem bloqueio')
ok(CATALOGO.includes('export function avisoDeFase'), 'função de aviso existe')
ok(catSemCom.includes('adequação da entrada elétrica'), 'texto do aviso conforme decidido')
ok(EQUIP.includes('avisoDeFase('), 'a tela consulta o aviso')
// Não pode filtrar nem desabilitar por fase.
ok(!/filter\([^)]*fases/.test(semComentarios(EQUIP)), 'não filtra opções por fase')
ok(!/disabled=\{[^}]*fase/i.test(EQUIP), 'não desabilita por fase')

secao('14 · A1 — separador inequívoco no rótulo do MPPT')
ok(ETAPA.includes("{' · '}"), 'separador presente entre o número e a contagem')

secao('15 · A2 — clima pela UF, sem tabela nova')
ok(ETAPA.includes('calcularTemperaturas('), 'consome a função canônica')
ok(!semComentarios(ETAPA).includes('TEMPERATURAS_UF'), 'não replica a tabela')
ok(ETAPA.includes("fonte: 'localizacao'") && ETAPA.includes("fonte: 'uf'"),
  'declara a origem das temperaturas')
// Precedência: persistido > UF > lacuna.
const trechoClima = ETAPA.slice(ETAPA.indexOf('const clima = useMemo'), ETAPA.indexOf('const persistida'))
ok(trechoClima.indexOf('tmin !== null && tmax !== null') < trechoClima.indexOf('calcularTemperaturas'),
  'persistido tem precedência sobre a UF')
ok(trechoClima.includes('temperatura_min_historica_c: tmin, temperatura_max_historica_c: tmax, uf, fonte: null }'),
  'sem UF e sem persistido, permanece a lacuna')

console.log(falhas === 0
  ? '\nOK — topologia autoral, validada pelo canônico; unifilar sem lacunas; nada calculado no cliente.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
