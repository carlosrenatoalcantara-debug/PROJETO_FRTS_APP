/**
 * microinversores.check.js — FV-DOM-031
 *
 * Guarda as cinco decisões desta sprint contra o retorno silencioso do que foi
 * removido: um segundo classificador, um segundo motor, um default fabricado,
 * ou o micro voltando a ser topologizado como string.
 *
 *   node backend/src/dominio/__checks__/microinversores.check.js
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import {
  classificarTopologiaInversor, derivarTopologia, TOPOLOGIA, lerInversor, paraDimensionamento,
} from '@fortesolar/fv-shared/inversores'
import {
  avaliarModeloMicro, avaliarComposicaoMicro, capacidadeDoMicro,
  distribuirEntreMicros, distribuirEntreEntradas, microsNecessarios,
  microsParaLimite, modulosQueCabem,
} from '@fortesolar/fv-shared/engenharia/microinversores'
import { validarMicroinversores } from '@fortesolar/fv-shared/fv/validacao-microinversores'
import { tecnologiaInversor } from '@fortesolar/fv-shared/engenharia/regras-plausibilidade'
import { DADOS_ELETRICOS_INVERSORES } from '@fortesolar/fv-shared/engenharia/catalogo-eletrico'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

const ler = (rel) => readFileSync(path.resolve(RAIZ, rel), 'utf8')
const semComentarios = (f) => f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const MOTOR = 'packages/fv-shared/engenharia/microinversores.js'
const DICIONARIO = 'packages/fv-shared/equipamentos/inversores/dicionarioInversor.js'
const VALIDADOR = 'packages/fv-shared/utils/fv/validacaoMicroinversores.js'
const DIMENSIONADOR = 'frontend/src/utils/dimensionarMicro.js'
const WIZARD_CLASSIF = 'frontend/src/utils/topologiaInversor.js'
const PLAUSIBILIDADE = 'packages/fv-shared/services/regrasPlausibilidade.js'
const UX_MICRO = 'frontend/src/fv/microinversores.js'
const TELA_MICRO = 'frontend/src/fv/paginas/etapas/EtapaMicroinversores.jsx'

// ═══ 1 · Decisão 4 — UMA classificação ══════════════════════════════════════
secao('1 · Um único classificador de topologia')
ok(semComentarios(ler(DICIONARIO)).includes('export function classificarTopologiaInversor'),
  'a implementação canônica vive no dicionário SSOT')
ok(semComentarios(ler(DICIONARIO)).includes('export const derivarTopologia = classificarTopologiaInversor'),
  '`derivarTopologia` é a MESMA função, não uma segunda regra')
for (const [arquivo, nome] of [[PLAUSIBILIDADE, 'tecnologiaInversor'], [WIZARD_CLASSIF, 'classificarTopologia']]) {
  const fonte = semComentarios(ler(arquivo))
  ok(fonte.includes('classificarTopologiaInversor'), `${nome} delega ao canônico`)
  // Nenhuma heurística própria sobreviveu: sem regex de fabricante/modelo.
  const regexes = (fonte.match(/\/[^/\n]*(hoymiles|apsystems|solaredge|hibrid|micro)[^/\n]*\/i/gi) ?? [])
  ok(regexes.length === 0, `${nome} não guarda padrões próprios (${regexes.length} encontrado(s))`)
}

secao('2 · Os três caminhos concordam sobre os 50 modelos do catálogo')
{
  const norm = (t) => String(t).toLowerCase().replace('microinversor', 'micro').replace('hybrid', 'hibrido')
  const vocabWizard = { MICRO: 'micro', OTIMIZADOR: 'otimizador', HYBRID: 'string', STRING: 'string' }
  let divergentes = 0
  let micros = 0
  for (const [id, e] of Object.entries(DADOS_ELETRICOS_INVERSORES)) {
    const esp = { tipo_topologia: e.topologia, tensao_max_entrada: e.tensao_max_entrada,
      potencia_kw: e.potencia_ca_kw }
    const canon = classificarTopologiaInversor(esp, { fabricante: '', modelo: id })
    const plaus = tecnologiaInversor({ topologia: e.topologia, voc_max_dc_v: e.tensao_max_entrada,
      potencia_kw_ca: e.potencia_ca_kw, modelo: id })
    const wiz = vocabWizard[canon]
    if (norm(canon) !== norm(plaus)) divergentes++
    if (wiz !== (norm(canon) === 'hibrido' ? 'string' : norm(canon))) divergentes++
    if (canon === TOPOLOGIA.MICRO) micros++
  }
  ok(divergentes === 0, `50 modelos, 0 divergência de código (${divergentes})`)
  ok(micros === 13, `13 micros reconhecidos pelo canônico (${micros})`)
}

secao('3 · Os casos que a auditoria pegou errados')
ok(classificarTopologiaInversor({}, { fabricante: 'Deye', modelo: 'SUN-M2000G4' }) === TOPOLOGIA.MICRO,
  'Deye SUN-M2000G4 é MICRO (era STRING)')
ok(classificarTopologiaInversor({}, { fabricante: 'SolarEdge', modelo: 'SE5000H HD-Wave' }) === TOPOLOGIA.OTIMIZADOR,
  'SolarEdge é OTIMIZADOR (era STRING)')
ok(classificarTopologiaInversor({}, { fabricante: 'Deye', modelo: 'SUN-5K-SG04LP1' }) === TOPOLOGIA.HYBRID,
  'híbrido antes de micro — "SUN-5K-SG" não vira micro')
ok(derivarTopologia({ tipo_topologia: 'MICRO' }) === TOPOLOGIA.MICRO, 'campo explícito continua mandando')

// ═══ 4 · Decisão 2 — SSOT ═══════════════════════════════════════════════════
secao('4 · `entradas` e `modulos_por_entrada` são canônicos')
{
  const esp = { entradas: 6, modulos_por_entrada: 1, potencia: 2.25, oversizing_max: 1.25,
    tensao_max_entrada: 60, topologia: 'micro' }
  const c = lerInversor(esp, { fabricante: 'Hoymiles', modelo: 'HMT-2250-6T' })
  ok(c.entradas === 6, `lerInversor.entradas = ${c.entradas} (era CAMPO INEXISTENTE)`)
  ok(c.modulos_por_entrada === 1, `lerInversor.modulos_por_entrada = ${c.modulos_por_entrada}`)
  const d = paraDimensionamento(esp, {})
  ok(d.entradas === 6 && d.oversizing_max === 1.25, 'paraDimensionamento carrega o envelope')
  ok(Array.isArray(d.lacunas_micro) && d.lacunas_micro.length === 0, 'sem lacuna quando declarado')

  const vazio = paraDimensionamento({ topologia: 'micro' }, {})
  ok(vazio.entradas === null && vazio.modulos_por_entrada === null, 'ausência é null, não 1')
  ok(vazio.lacunas_micro.join(',') === 'entradas,modulos_por_entrada,potencia_kw,oversizing_max',
    `lacuna nomeada: ${vazio.lacunas_micro.join(',')}`)
  // FV-DOM-029 intacta: `lacunas` do lado string não mudou de semântica.
  ok(Array.isArray(vazio.lacunas) && vazio.lacunas.includes('tensao_max_entrada'),
    '`lacunas` (FV-DOM-029) permanece o contrato do lado string')
  ok(paraDimensionamento({ tensao_max_entrada: 1000, tensao_mppt_min: 200, tensao_mppt_max: 850,
    corrente_isc_max: 25, n_mppts: 3 }, {}).lacunas_micro.length === 0,
  'fora da topologia micro, `lacunas_micro` é vazio')
}

// ═══ 5 · Decisão 3 — oversizing ═════════════════════════════════════════════
secao('5 · Limite do catálogo, micro mais carregado, sem default')
{
  const fonte = semComentarios(ler(MOTOR))
  for (const proibido of ['?? 1.25', '?? 1.5', '?? 1,25', '|| 1.25', '|| 1.5',
    'oversizingMax = 1', 'oversizing_max = 1']) {
    ok(!fonte.includes(proibido), `motor sem \`${proibido}\``)
  }
  ok(!semComentarios(ler(VALIDADOR)).includes('oversizingMax = 1.5'),
    'o `?? 1.5` do validador foi removido')
  ok(semComentarios(ler(VALIDADOR)).includes('oversizingMax = null'),
    'sem limite declarado, o parâmetro é null')
  for (const proibido of ['?? 1', '|| 1', '?? 0']) {
    ok(!semComentarios(ler(DIMENSIONADOR)).includes(proibido),
      `dimensionador sem \`${proibido}\``)
  }

  // FV-DOM-031B · item 1 — distribuição EQUILIBRADA
  ok(JSON.stringify(distribuirEntreMicros(6, 2, 4)) === '[3,3]',
    `6 módulos / 2 micros / 4 entradas → [3,3] (${distribuirEntreMicros(6, 2, 4)})`)
  ok(JSON.stringify(distribuirEntreMicros(7, 2, 4)) === '[4,3]',
    `sobra inevitável: 7 / 2 → [4,3] (${distribuirEntreMicros(7, 2, 4)})`)
  for (const [t, q, c] of [[24, 6, 4], [26, 7, 4], [7, 2, 4], [1, 3, 2], [100, 7, 20]]) {
    const d = distribuirEntreMicros(t, q, c)
    const soma = d.reduce((a, b) => a + b, 0)
    const espalho = Math.max(...d) - Math.min(...d)
    ok(soma === t && Math.max(...d) <= c && espalho <= 1,
      `${t}/${q}/cap${c} → soma ${soma}, máx ${Math.max(...d)} ≤ ${c}, espalhamento ${espalho}`)
  }
  // Equilibrar NÃO afrouxa: acima da capacidade total, o excedente é recusado.
  {
    const d = distribuirEntreMicros(24, 4, 4)
    ok(d.reduce((a, b) => a + b, 0) === 16 && Math.max(...d) === 4,
      'excedente RECUSADO, não empilhado — quem bloqueia é o avaliador')
  }
  // Um nível abaixo: módulos por ENTRADA (decisão 5).
  ok(JSON.stringify(distribuirEntreEntradas(3, 4, 1)) === '[1,1,1,0]',
    `3 módulos em 4 entradas → [1,1,1,0] (${distribuirEntreEntradas(3, 4, 1)})`)
  ok(JSON.stringify(distribuirEntreEntradas(6, 4, 2)) === '[2,2,1,1]',
    `6 módulos em 4 entradas de 2 → [2,2,1,1] (${distribuirEntreEntradas(6, 4, 2)})`)

  // MAIS CARREGADO, não média: 7 módulos em 2 micros de cap. 4 → [4,3].
  const r = avaliarModeloMicro({ modulos: 7, quantidade: 2,
    micro: { entradas: 4, modulos_por_entrada: 1, potencia_kw: 1.0, oversizing_max: 2.5 },
    potenciaModuloW: 650 })
  ok(JSON.stringify(r.resumo.distribuicao) === '[4,3]', `distribuição [4,3] (${r.resumo.distribuicao})`)
  ok(r.resumo.modulos_no_mais_carregado === 4, 'mede no micro de 4, não na média de 3,5')
  ok(r.resumo.oversizing_mais_carregado === 2.6, `2,60× e não 2,275× (${r.resumo.oversizing_mais_carregado})`)
  ok(r.valido === false, 'reprova — a média teria passado')

  // Sem limite: aviso, não veredito.
  const semLimite = avaliarModeloMicro({ modulos: 24, quantidade: 6,
    micro: { entradas: 4, modulos_por_entrada: 1, potencia_kw: 2.0 }, potenciaModuloW: 650 })
  ok(semLimite.bloqueios.length === 0 && semLimite.avisos.join(' ').includes('não declara `oversizing_max`'),
    'sem limite declarado: avisa, não aprova contra 1,5 inventado')
  ok(semLimite.lacunas.includes('oversizing_max'), 'e declara a lacuna')

  // Sem envelope: recusa, não assume 1 entrada.
  const semEnvelope = avaliarModeloMicro({ modulos: 24, quantidade: 6, micro: {}, potenciaModuloW: 650 })
  ok(semEnvelope.valido === false && semEnvelope.bloqueios.join(' ').includes('Nenhuma capacidade é assumida'),
    'sem `entradas`/`modulos_por_entrada`, recusa em vez de fingir')
  ok(capacidadeDoMicro({ entradas: 4 }) === null, 'capacidade parcial é null, não 4')
}

// ═══ 6 · Decisões 5, 6 e 7 ══════════════════════════════════════════════════
secao('6 · Topologia entradas→módulos; reprovar é resultado válido')
{
  const fonte = semComentarios(ler(MOTOR))
  for (const proibido of ['mppt', 'strings_paralelo', 'modulos_por_string']) {
    ok(!new RegExp(proibido, 'i').test(fonte), `motor sem \`${proibido}\``)
  }
  const r = avaliarModeloMicro({ modulos: 24, quantidade: 6,
    micro: { entradas: 4, modulos_por_entrada: 1, potencia_kw: 2.0, oversizing_max: 1.25 },
    potenciaModuloW: 650 })
  ok(!/mppt|string/i.test(JSON.stringify(r)), 'a saída não menciona MPPT nem string')

  // Decisão 6: o exemplo do enunciado REPROVA.
  ok(r.valido === false, '24 × 650 W em 6 micros de 2 kW: REPROVA (1,30× > 1,25×)')
  const msg = r.bloqueios.join(' ')
  ok(/1\.30×/.test(msg) && /1\.25×/.test(msg), 'a mensagem traz medido e limite')
  ok(/Cabem 3 módulo/.test(msg), 'e diz quantos módulos cabem (decisão 7)')
  ok(modulosQueCabem(2.0, 1.25, 650) === 3, 'modulosQueCabem(2 kW, 1,25×, 650 W) = 3')
  ok(microsNecessarios(24, 4) === 6, 'microsNecessarios(24, cap 4) = 6')

  // Decisão 7: nada força 24 módulos — e o que DE FATO destrava o caso.
  const microCheio = { entradas: 4, modulos_por_entrada: 1, potencia_kw: 2.0, oversizing_max: 1.25 }
  const menosModulos = avaliarModeloMicro({ modulos: 20, quantidade: 5, micro: microCheio, potenciaModuloW: 550 })
  ok(menosModulos.valido === true, '20 módulos de 550 W em 5 micros: APROVA (1,10×)')
  ok(menosModulos.resumo.distribuicao.reduce((a, b) => a + b, 0) === 20,
    `distribuição soma 20 (${menosModulos.resumo.distribuicao})`)

  const microMenor = avaliarModeloMicro({ modulos: 24, quantidade: 12,
    micro: { entradas: 2, modulos_por_entrada: 1, potencia_kw: 2.0, oversizing_max: 1.25 },
    potenciaModuloW: 650 })
  ok(microMenor.valido === true, '24 × 650 W em micro de 2 entradas: APROVA (0,65×)')

  // FV-DOM-031B: com distribuição EQUILIBRADA, acrescentar micros DESTRAVA a
  // configuração — era exatamente o que a distribuição "encher e sobrar"
  // impedia, e o que a decisão 7 pede.
  const seis = avaliarModeloMicro({ modulos: 24, quantidade: 6, micro: microCheio, potenciaModuloW: 650 })
  const oito = avaliarModeloMicro({ modulos: 24, quantidade: 8, micro: microCheio, potenciaModuloW: 650 })
  ok(seis.resumo.oversizing_mais_carregado === 1.3 && seis.valido === false,
    `6 micros: ${seis.resumo.oversizing_mais_carregado}× — REPROVA (decisão 6 preservada)`)
  ok(oito.resumo.oversizing_mais_carregado === 0.975 && oito.valido === true,
    `8 micros: ${oito.resumo.oversizing_mais_carregado}× — APROVA (decisão 7 funciona)`)
  ok(JSON.stringify(oito.resumo.distribuicao) === '[3,3,3,3,3,3,3,3]',
    `distribuição equilibrada: ${JSON.stringify(oito.resumo.distribuicao)}`)
  ok(seis.bloqueios.join(' ').includes('8 microinversor(es) acomodariam'),
    'a reprovação diz quantos micros bastariam')
}

// ═══ 7 · Decisão 1 — por modelo ═════════════════════════════════════════════
secao('7 · Configuração POR MODELO')
{
  const schema = ler('backend/src/models/ProjetoFV.js')
  ok(/micros:\s*\{[\s\S]{0,400}?entradas_por_micro/.test(schema),
    '`configuracao_eletrica.micros[]` existe no schema')
  ok(/micros:\s*\{[\s\S]*?distribuicao:\s*\{\s*type:\s*\[Number\]/.test(schema),
    'com `distribuicao[]` por modelo')
  ok(schema.includes('n_microinversores'), 'os campos legados permanecem (aditivo)')

  const r = avaliarComposicaoMicro({
    modelos: [
      { rotulo: 'A', modulos: 16, quantidade: 4,
        micro: { entradas: 4, modulos_por_entrada: 1, potencia_kw: 2.0, oversizing_max: 1.25 } },
      { rotulo: 'B', modulos: 6, quantidade: 2,
        micro: { entradas: 3, modulos_por_entrada: 1, potencia_kw: 1.6, oversizing_max: 1.25 } },
    ],
    totalModulos: 22, potenciaModuloW: 550,
  })
  ok(r.valido === true, '4 × Micro A + 2 × Micro B: válido')
  ok(r.por_modelo.length === 2, 'um veredito por modelo')
  ok(r.resumo.quantidade_micros === 6 && r.resumo.potencia_ca_kw === 11.2,
    `6 micros, 11,2 kW CA (${r.resumo.quantidade_micros}, ${r.resumo.potencia_ca_kw})`)

  const desencontrado = avaliarComposicaoMicro({
    modelos: [{ rotulo: 'A', modulos: 12, quantidade: 3,
      micro: { entradas: 4, modulos_por_entrada: 1, potencia_kw: 2.0, oversizing_max: 1.25 } }],
    totalModulos: 24, potenciaModuloW: 550,
  })
  ok(desencontrado.valido === false && desencontrado.bloqueios.join(' ').includes('Faltam 12'),
    'módulos que não fecham com a composição bloqueiam')
}

// ═══ 8 · Decisões 8, 9 e 10 ═════════════════════════════════════════════════
secao('8 · Composição, estrutura e opção única')
{
  const ux = semComentarios(ler(UX_MICRO))
  ok(ux.includes("salvarEtapa") === false, 'o modelo puro não faz I/O')
  ok(ux.includes('arranjoExistente'), 'preserva o arranjo existente ao gravar')
  const tela = semComentarios(ler(TELA_MICRO))
  ok(tela.includes("salvarEtapa('arranjos'"), 'grava só a etapa `arranjos` (decisão 8)')
  ok(!tela.includes("salvarEtapa('equipamentos'"), 'não toca `equipamentos` — lá vive a estrutura (decisão 9)')
  ok(!tela.includes('projeto_origem_id') && !ux.includes('projeto_origem_id'),
    'nenhuma segunda opção (decisão 10)')
  // Nenhuma fórmula elétrica do lado do cliente.
  for (const proibido of ['Math.pow', 'Math.sqrt', '* 1.25', '/ 1000 /', 'oversizing >']) {
    ok(!ux.includes(proibido) && !tela.includes(proibido), `UX sem \`${proibido}\``)
  }
}

// ═══ 9 · Um motor só ════════════════════════════════════════════════════════
secao('9 · Nenhum segundo motor sobreviveu')
{
  for (const [arquivo, nome] of [[VALIDADOR, 'validarMicroinversores'], [DIMENSIONADOR, 'dimensionarMicroinversor']]) {
    const fonte = semComentarios(ler(arquivo))
    ok(/from '.*engenharia\/microinversores'/.test(fonte) || fonte.includes('engenharia/microinversores'),
      `${nome} importa o motor canônico`)
    ok(!/ratio\s*>|potenciaCC_por_micro|modulosPorMicroMedio/.test(fonte),
      `${nome} não guarda fórmula de oversizing própria`)
  }
  // Os dois concordam no mesmo caso — era aqui que havia 4 conflitos.
  const val = validarMicroinversores({ numModulos: 24, numMicros: 6, entradasPorMicro: 4,
    potenciaModuloW: 650, potenciaMicroCA_W: 2000, oversizingMax: 1.25 })
  const mot = avaliarModeloMicro({ modulos: 24, quantidade: 6,
    micro: { entradas: 4, modulos_por_entrada: 1, potencia_kw: 2.0, oversizing_max: 1.25 },
    potenciaModuloW: 650 })
  ok(val.valido === mot.valido, `mesmo veredito (${val.valido} / ${mot.valido})`)
  ok(val.resumo.oversizing_mais_carregado === mot.resumo.oversizing_mais_carregado,
    'mesmo número medido')
  ok(JSON.stringify(distribuirEntreMicros(24, 6, 4)) === JSON.stringify(val.resumo.distribuicao),
    'mesma distribuição')
}

// ═══ 10 · Nada fora do escopo ═══════════════════════════════════════════════
secao('10 · Escopo')
{
  let git = null
  try { git = execSync('git status --porcelain', { cwd: RAIZ, encoding: 'utf8' }) } catch { /* fora de repo */ }
  if (git === null) ok(false, 'git indisponível')
  else {
    for (const intocado of [
      'backend/src/dominio/baseline/', 'backend/src/models/Baseline.js',
      'backend/src/models/Orcamento.js', 'packages/fv-shared/financeiro/',
      'packages/fv-shared/engenharia/engenhariaNormativa.js',
      'backend/src/services/compatibilidadeEletricaService.js',
      'frontend/src/fv/estrutura.js',
    ]) {
      ok(!new RegExp(`^.M.${intocado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm').test(git),
        `intacto: ${intocado}`)
    }
    ok(!/migrat|migracao/i.test(git), 'nenhuma migração criada')
  }
}

console.log(falhas === 0
  ? '\nOK — um classificador, um motor, limite do catálogo, micro por entradas e por modelo.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
