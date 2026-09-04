/**
 * regrasEletricasCanonicas.check.js — FV-DOM-025
 *
 * Prova que as regras elétricas passaram a ter UMA implementação e que as
 * decisões Q1–Q5 valem em todos os consumidores.
 *
 * O que este check protege, em ordem de gravidade:
 *
 *  1. a conversão de unidade acontece em UM ponto (Q4). Duplicá-la divide o
 *     coeficiente duas vezes; omiti-la infla a Voc em ~100×. A FV-DOM-023 mediu
 *     o segundo caso vivo no wizard: 565 V viravam 2179 V;
 *  2. nenhum consumidor reescreve `1 + coef × (T − 25)` por conta própria;
 *  3. Isc leva o fator 1,25 (Q1) em todos os caminhos;
 *  4. Vmpp mínimo é comparado a QUENTE (Q3);
 *  5. `mppts[]` continua autoral e `sugerirMPPTs` continua sendo sugestão.
 *
 *   node backend/src/dominio/__checks__/regrasEletricasCanonicas.check.js
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { analisarCompatibilidade } from '../../services/compatibilidadeEletricaService.js'
import {
  coefParaFracao, fatorTermico, temperaturaCelula, correnteProjeto,
  calcularVocMaxString, calcularVmppMinString, calcularIscMax,
  FATOR_ISC_NBR16690, NOCT_PADRAO_C, TEMP_STC_C,
} from '@fortesolar/fv-shared/engenharia/normativa'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

const ler = (rel) => readFileSync(path.resolve(RAIZ, rel), 'utf8')
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const SERVICE = ler('backend/src/services/compatibilidadeEletricaService.js')
const WIZARD = ler('frontend/src/components/fv/ConfiguradorArranjoFV.jsx')
const CANONICO = ler('packages/fv-shared/engenharia/engenhariaNormativa.js')

secao('1 · Q4 — a conversão de unidade vive num ponto só')
const defs = (CANONICO.match(/export function coefParaFracao/g) ?? []).length
ok(defs === 1, `\`coefParaFracao\` definida ${defs}× no canônico`)
// A heurística `> 0.1` é a assinatura da conversão. Fora do canônico, nenhuma cópia.
for (const [nome, fonte] of [['backend', SERVICE], ['wizard', WIZARD]]) {
  const s = semComentarios(fonte)
  ok(!/Math\.abs\([^)]*\)\s*>\s*0\.1/.test(s), `${nome}: sem cópia da heurística de unidade`)
  ok(!s.includes('normalizarCoefTemp'), `${nome}: \`normalizarCoefTemp\` local removida`)
  ok(fonte.includes('coefParaFracao'), `${nome}: usa a primitiva canônica`)
}
ok(coefParaFracao(-0.27) === -0.0027, '%/°C → fração')
ok(coefParaFracao(-0.0027) === -0.0027, 'fração já normalizada permanece')
// A heurística é IDEMPOTENTE: aplicá-la duas vezes devolve o mesmo valor. É o
// que torna seguro exigir que ela viva num ponto só — se um caminho novo a
// aplicar por engano, o número não se degrada. O perigo real é a AUSÊNCIA da
// conversão, que foi o defeito medido no wizard.
for (const v of [-0.15, -0.27, -0.35, -0.5]) {
  ok(coefParaFracao(coefParaFracao(v)) === coefParaFracao(v),
    `idempotente em ${v} %/°C`)
}
// Ausência de conversão: o erro que a FV-DOM-023 mediu.
const semConversao = 49.9 * (1 + (-0.27) * (14 - 25))
const comConversao = 49.9 * fatorTermico(coefParaFracao(-0.27), 14)
ok(semConversao / comConversao > 3,
  `sem converter, a Voc infla ${(semConversao / comConversao).toFixed(1)}× (${semConversao.toFixed(0)} V vs ${comConversao.toFixed(1)} V)`)

secao('2 · Nenhuma fórmula térmica reescrita fora do canônico')
for (const [nome, fonte] of [['backend', SERVICE], ['wizard', WIZARD]]) {
  const s = semComentarios(fonte)
  ok(!/1\s*\+\s*coef\w*\s*\*\s*\(/.test(s), `${nome}: sem \`1 + coef × (T − 25)\` local`)
  ok(!/\(\s*noct\w*\s*-\s*20\s*\)/i.test(s), `${nome}: sem modelo NOCT local`)
  ok(!s.includes('1000 / 800') && !s.includes('1.25 * (noct'),
    `${nome}: sem constante de irradiância local`)
}
ok(semComentarios(WIZARD).includes('fatorTermico('), 'wizard compõe `fatorTermico`')
ok(semComentarios(SERVICE).includes('fatorTermico('), 'backend compõe `fatorTermico`')
ok(semComentarios(WIZARD).includes('temperaturaCelula('), 'wizard compõe `temperaturaCelula`')
ok(semComentarios(SERVICE).includes('temperaturaCelula('), 'backend compõe `temperaturaCelula`')

secao('3 · Q1 — Isc × 1,25 em todos os caminhos')
ok(FATOR_ISC_NBR16690 === 1.25, `fator canônico ${FATOR_ISC_NBR16690}`)
ok(correnteProjeto(14, 1) === 17.5, 'correnteProjeto(14, 1) = 17,5 A')
ok(correnteProjeto(14, 2) === 35, 'correnteProjeto(14, 2) = 35 A')
ok(calcularIscMax(13.9) === 17.38, 'calcularIscMax preservada (17,38 A)')
for (const [nome, fonte] of [['backend', SERVICE], ['wizard', WIZARD]]) {
  const s = semComentarios(fonte)
  ok(!/\*\s*1\.25/.test(s), `${nome}: fator 1,25 não aparece solto`)
  ok(s.includes('correnteProjeto('), `${nome}: usa \`correnteProjeto\``)
}

secao('4 · Q5 — NOCT padrão 44 °C')
ok(NOCT_PADRAO_C === 44, `canônico ${NOCT_PADRAO_C} °C`)
ok(!/temp_noct\s*=\s*45/.test(SERVICE), 'backend não usa mais 45')
ok(!/tempNoct\s*=\s*45/.test(WIZARD), 'wizard não usa mais 45')
ok(temperaturaCelula(38) === temperaturaCelula(38, 44), 'default do canônico é 44')

secao('5 · Q3 — Vmpp mínimo comparado a QUENTE')
const trechoVmpp = WIZARD.slice(WIZARD.indexOf('2. Vmpp abaixo do mínimo'),
  WIZARD.indexOf('4. Isc excedida'))
ok(trechoVmpp.includes('vmppQ < eletricoInv.mppt_min'), 'wizard compara o Vmpp quente')
ok(!/vmppStr\s*<\s*eletricoInv\.mppt_min/.test(WIZARD), 'comparação por STC removida')
ok(SERVICE.includes('vmpp_string_quente < mppt_min'), 'backend já comparava quente')

secao('6 · Q2 — coeficiente de Vmpp = coeficiente de Voc (provisório)')
ok(!semComentarios(WIZARD).includes('* 0.75'), 'o `× 0,75` sem norma foi removido do wizard')
ok(SERVICE.includes('coefParaFracao(_coefVmpp) : coefVoc'),
  'backend usa o coef de Voc quando o de Vmpp não existe')

secao('7 · Modelo A — `mppts[]` continua autoral')
ok(WIZARD.includes('SUGESTÃO VISUAL'), '`sugerirMPPTs` marcada como sugestão')
ok(WIZARD.includes('NÃO é engenharia'), 'declarado que não é resultado de engenharia')
ok(WIZARD.includes('const [mppts, setMppts]'), 'a topologia continua sendo estado editável')
ok(!SERVICE.includes('sugerirMPPTs') && !CANONICO.includes('sugerirMPPTs'),
  'nenhuma distribuição automática entrou no domínio')
// O canônico LÊ `arranjoMPPTs`; não o inventa. A única derivação que existe é o
// fallback de DESENHO em `montarModeloEletrico`, para o unifilar não quebrar
// quando a topologia falta — e o adapter declara essa ausência como lacuna
// (`arranjoMPPTs`), em vez de fingir que havia topologia.
ok(!/Math\.min\(14,\s*Math\.max\(6/.test(CANONICO),
  'a heurística de sugestão (14 / 6 / 1,5) não entrou no canônico')
const fallback = CANONICO.slice(CANONICO.indexOf('let mppts ='), CANONICO.indexOf('Cálculo elétrico por MPPT'))
ok(fallback.includes('Fallback para modelo legado'),
  'a única derivação do canônico é o fallback de desenho, declarado como tal')
const ADAPTER = ler('backend/src/dominio/unifilar/adaptarProjeto.js')
ok(ADAPTER.includes("arranjoMPPTs: arranjoMPPTs ? 'engenharia_eletrica.arranjo.mppts' : null"),
  'ausência de topologia continua virando lacuna, não número inventado')

secao('8 · O backend não persiste nem conhece banco')
for (const p of ['save(', 'updateOne', 'findOneAndUpdate', "from 'mongoose'", 'require(']) {
  ok(!SERVICE.includes(p), `service puro (\`${p}\` ausente)`)
}
ok(!CANONICO.includes("from 'mongoose'"), 'canônico puro')

secao('9 · Contrato HTTP preservado')
const antes = ['compativel', 'warnings', 'erros', 'limites', 'calculos', 'clima_utilizado']
const r = analisarCompatibilidade({
  dados_eletricos_modulo: { voc: 49.9, vmpp: 41.8, isc: 14, impp: 13.2, potencia_w: 550,
    coef_temp_voc: -0.27, temp_noct: 44 },
  dados_eletricos_inversor: { tensao_max_entrada: 600, mppt_min: 160, mppt_max: 550,
    corrente_max_mppt: 16, potencia_ca_kw: 8 },
  arranjo_proposto: { quantidade_modulos_por_string: 11, quantidade_strings_paralelo: 1, num_mppt_usados: 2 },
  dados_climaticos_regiao: { temperatura_min_historica_c: 14, temperatura_max_historica_c: 38 },
})
for (const campo of antes) ok(campo in r, `resposta preserva \`${campo}\``)
for (const campo of ['voc_string_max', 'vmpp_string_quente', 'isc_total', 'fator_oversizing',
  'margem_tensao_percentual']) {
  ok(campo in r.calculos, `calculos preserva \`${campo}\``)
}
ok(r.calculos.isc_fator_seguranca === 1.25, 'o fator viaja junto, para o número ser legível')

secao('10 · As duas unidades produzem o MESMO resultado (Q4 na prática)')
const comPct = analisarCompatibilidade({
  dados_eletricos_modulo: { voc: 49.9, vmpp: 41.8, isc: 14, impp: 13.2, potencia_w: 550, coef_temp_voc: -0.27 },
  dados_eletricos_inversor: { tensao_max_entrada: 600, mppt_min: 160, mppt_max: 550, corrente_max_mppt: 16, potencia_ca_kw: 8 },
  arranjo_proposto: { quantidade_modulos_por_string: 11, quantidade_strings_paralelo: 1 },
  dados_climaticos_regiao: { temperatura_min_historica_c: 14, temperatura_max_historica_c: 38 },
})
const comFracao = analisarCompatibilidade({
  dados_eletricos_modulo: { voc: 49.9, vmpp: 41.8, isc: 14, impp: 13.2, potencia_w: 550, coef_temp_voc: -0.0027 },
  dados_eletricos_inversor: { tensao_max_entrada: 600, mppt_min: 160, mppt_max: 550, corrente_max_mppt: 16, potencia_ca_kw: 8 },
  arranjo_proposto: { quantidade_modulos_por_string: 11, quantidade_strings_paralelo: 1 },
  dados_climaticos_regiao: { temperatura_min_historica_c: 14, temperatura_max_historica_c: 38 },
})
ok(comPct.calculos.voc_string_max === comFracao.calculos.voc_string_max,
  `%/°C e fração convergem (${comPct.calculos.voc_string_max} V)`)

secao('11 · Divergência DELIBERADA preservada — Q1 muda vereditos')
// Não é regressão: é a consequência normativa medida na FV-DOM-024.
const umaString = analisarCompatibilidade({
  dados_eletricos_modulo: { voc: 49.9, vmpp: 41.8, isc: 14, impp: 13.2, potencia_w: 550, coef_temp_voc: -0.27 },
  dados_eletricos_inversor: { tensao_max_entrada: 600, mppt_min: 160, mppt_max: 550, corrente_max_mppt: 16, potencia_ca_kw: 8 },
  arranjo_proposto: { quantidade_modulos_por_string: 11, quantidade_strings_paralelo: 1 },
  dados_climaticos_regiao: { temperatura_min_historica_c: 14, temperatura_max_historica_c: 38 },
})
ok(umaString.calculos.isc_total === 17.5, `Isc de projeto 17,5 A (era 14 A sem o fator)`)

/**
 * ── Ajuste de compatibilidade de corrente ─────────────────────────────────
 * Até aqui esta seção afirmava que 17,5 A de PROJETO contra um limite de
 * TRABALHO de 16 A reprovava o arranjo. A auditoria mostrou que as duas
 * grandezas não se comparam: o limite que reprova é `corrente_isc_max`, que
 * este fixture não declara. O fator 1,25 continua aplicado e continua citando
 * a norma — o que mudou é que ele deixou de ser critério de reprovação.
 */
ok(!umaString.erros.some((e) => e.codigo === 'CORRENTE_ISC_EXCEDIDA'),
  'sem limite de curto-circuito declarado, a corrente de projeto NÃO reprova')
ok(umaString.status === 'atencao', 'o arranjo fica em ATENÇÃO, não incompatível')
const diag = umaString.warnings.find((w) => w.codigo === 'CORRENTE_PROJETO_ACIMA_DO_TRABALHO')
ok(!!diag, 'e o excesso sobre a corrente de trabalho é dito como aviso')
ok(diag.valores.norma === 'NBR 16690 §5.2', 'o diagnóstico cita a norma que o originou')
ok(diag.valores.fator_seguranca === 1.25, 'e declara o fator aplicado')
ok(umaString.avaliacao_corrente.curto_circuito.status === 'nao_avaliado',
  'o critério de curto-circuito é declarado NÃO AVALIADO, não aprovado por omissão')

// Com o limite de curto declarado, a reprovação existe e é pelo par certo.
const comLimiteCurto = analisarCompatibilidade({
  dados_eletricos_modulo: { voc: 49.9, vmpp: 41.8, isc: 14, impp: 13.2, potencia_w: 550, coef_temp_voc: -0.27 },
  dados_eletricos_inversor: { tensao_max_entrada: 600, mppt_min: 160, mppt_max: 550,
    corrente_max_mppt: 16, corrente_isc_max_mppt: 12, potencia_ca_kw: 8 },
  arranjo_proposto: { quantidade_modulos_por_string: 11, quantidade_strings_paralelo: 1 },
  dados_climaticos_regiao: { temperatura_min_historica_c: 14, temperatura_max_historica_c: 38 },
})
ok(comLimiteCurto.erros.some((e) => e.codigo === 'CORRENTE_ISC_EXCEDIDA'),
  'Isc 14 A contra limite de curto de 12 A REPROVA — limite absoluto')
ok(comLimiteCurto.erros.find((e) => e.codigo === 'CORRENTE_ISC_EXCEDIDA')
  .valores.corrente_isc_max_mppt === 12, 'e a reprovação cita o limite de CURTO, não o de trabalho')

secao('12 · `/strings` NÃO foi consolidado — divergência conhecida')
// `compatibilidadeFV.montarStrings` usa fator térmico FIXO de 1,15 e não produz
// `mppts[]`. A FV-UX-021 provou que não é equivalente; consolidá-lo exigiria
// alterar fórmula sem equivalência. Fica fora, declarado.
const OUTRO = ler('backend/src/services/compatibilidadeFV.js')
ok(OUTRO.includes('FATOR_TEMPERATURA_VOC = 1.15'),
  'montarStrings mantém o fator fixo 1,15 — intocado por falta de equivalência')
ok(!OUTRO.includes('coefParaFracao'), 'e não foi migrado nesta sprint')

console.log(falhas === 0
  ? '\nOK — uma implementação das regras; Q1–Q5 aplicadas; topologia segue autoral.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
