/**
 * cadastroMicroE3.check.js — Sprint E3.
 *
 * O que este check protege:
 *  1. `max_por_cabo_tronco` é o ÚNICO nome canônico do limite de ramal — o nome
 *     cunhado pela Sprint E sobrevive apenas como alias de leitura;
 *  2. cadastro contraditório não alimenta cálculo: nenhum lado é eleito;
 *  3. a detecção é ESTRUTURAL — não conhece produto, não lê nome de modelo;
 *  4. o segundo repositório de spec (`specs_canonicas`) é reportado, nunca lido
 *     como fonte de cálculo;
 *  5. capacidade continua sem derivação por `n_mppts`, potência ou corrente;
 *  6. corrente de ramal segue sem veredito enquanto não houver limite;
 *  7. nenhuma fórmula paralela nova.
 *
 * Puro: sem banco, sem HTTP. Fixtures reproduzem os registros REAIS medidos.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  detectarConflitos, camposEmConflito, valorConfiavel, temConflito, TIPO_CONFLITO,
} from '@fortesolar/fv-shared/inversores/conflitos'
import { lerInversor, CAMPOS_INVERSOR } from '@fortesolar/fv-shared/inversores/dicionario'
import { planejarMicros } from '@fortesolar/fv-shared/engenharia/arranjos-micro'
import { correnteDoRamal, VEREDITO } from '@fortesolar/fv-shared/engenharia/corrente-micro'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

const HOYMILES = {
  fabricante: 'Hoymiles', modelo: 'HMS-2250DW-4T',
  origem: { tipo: 'manual', fonte: null },
  especificacoes: {
    potencia_kw: 3, potencia_maxima_kw: 2.25, corrente_ac_saida: 10.82,
    n_mppts: 2, tensao_max_entrada: 65, corrente_max_por_mppt: 18,
  },
  specs_canonicas: { potencia_kw_ca: 3, voc_max_dc_v: 65, isc_max_por_mppt_a: 18, n_mppts: 2 },
}
const DEYE_G3 = {
  fabricante: 'Deye', modelo: 'SUN2000G3-US-220',
  origem: { tipo: 'datasheet_pdfparse' },
  especificacoes: {
    potencia_kw: 2, potencia_maxima_kw: 2000, tensao_max_entrada: 60,
    corrente_max_por_mppt: 13, n_mppts: 4, fases: 1,
  },
  specs_canonicas: { potencia_kw_ca: 2, voc_max_dc_v: 60, isc_max_por_mppt_a: 13, n_mppts: 4, fases_saida: 1 },
}
const COERENTE = {
  fabricante: 'X', modelo: 'Y',
  especificacoes: {
    potencia_kw: 2, potencia_maxima_kw: 2.2, entradas: 4, modulos_por_entrada: 1,
    corrente_max_por_mppt: 13, corrente_ac_saida: 9, max_por_cabo_tronco: 4,
  },
}

// ── 1. Nome único ───────────────────────────────────────────────────────────
secao('1. `max_por_cabo_tronco` como fonte única')
{
  ok(!!CAMPOS_INVERSOR.max_por_cabo_tronco, 'é o campo canônico do dicionário')
  ok(CAMPOS_INVERSOR.max_micros_por_arranjo === undefined,
    'o nome cunhado pela Sprint E deixou de ser campo canônico')
  ok(CAMPOS_INVERSOR.max_por_cabo_tronco.aliases[0] === 'max_por_cabo_tronco',
    'o alias primário é o nome do cadastro')
  ok(lerInversor({ max_por_cabo_tronco: 4 }).max_por_cabo_tronco === 4, 'lido pelo nome do cadastro')
  ok(lerInversor({ max_micros_por_arranjo: 5 }).max_por_cabo_tronco === 5,
    'o nome antigo continua legível — nada gravado se perde')
  ok(lerInversor({}).max_por_cabo_tronco === null, 'ausente continua null')
  ok(CAMPOS_INVERSOR.max_por_cabo_tronco.peso === undefined,
    'sem peso — não altera a semântica de score existente')

  for (const rel of [
    '../packages/fv-shared/engenharia/arranjosMicro.js',
    '../packages/fv-shared/engenharia/regrasMicroFabricante.js',
  ]) {
    ok(!/max_micros_por_arranjo/.test(readFileSync(path.join(RAIZ, rel), 'utf8')),
      `${path.basename(rel)}: sem segundo nome para a grandeza`)
  }
}

// ── 2. Conflito de cadastro ─────────────────────────────────────────────────
secao('2. Cadastro conflitante não alimenta cálculo')
{
  const cH = detectarConflitos(HOYMILES).find((c) => c.campo === 'potencia_kw')
  ok(cH?.tipo === TIPO_CONFLITO.IMPOSSIVEL,
    'Hoymiles: máximo menor que o nominal é conflito IMPOSSÍVEL')
  ok(!/2250/.test(cH?.mensagem ?? ''),
    'e a mensagem não infere o valor pelo nome do modelo')

  const cD = detectarConflitos(DEYE_G3).find((c) => c.campo === 'potencia_kw')
  ok(cD?.tipo === TIPO_CONFLITO.UNIDADE, 'Deye G3: 2000 em campo kW é conflito de UNIDADE')

  ok(valorConfiavel(HOYMILES, 'potencia_kw') === null &&
    valorConfiavel(DEYE_G3, 'potencia_kw') === null,
  'nenhum dos lados é eleito: o valor some do cálculo')
  ok(valorConfiavel(HOYMILES, 'corrente_max_por_mppt') === 18,
    'campos não conflitantes do mesmo registro continuam legíveis')
  ok(JSON.stringify(camposEmConflito(HOYMILES)) === '["potencia_kw"]',
    'o conflito é circunscrito ao campo afetado')
  ok(temConflito(COERENTE) === false, 'cadastro coerente não é acusado')

  const antes = JSON.stringify(HOYMILES)
  detectarConflitos(HOYMILES); valorConfiavel(HOYMILES, 'potencia_kw')
  ok(JSON.stringify(HOYMILES) === antes, 'o detector não corrige nem muta o registro')
}

// ── 3. Detecção estrutural, sem conhecer produto ────────────────────────────
secao('3. A detecção não conhece produto')
{
  const src = readFileSync(path.join(RAIZ,
    '../packages/fv-shared/equipamentos/inversores/conflitosInversor.js'), 'utf8')
  const semComentarios = src.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, '$1')
  ok(!/Hoymiles|Deye|HMS-|SUN2000/.test(semComentarios),
    'nenhum fabricante ou modelo aparece na lógica')
  ok(!/modelo/.test(semComentarios.replace(/modelo\b(?=[^\n]*mensagem)/g, '')),
    'o nome do modelo não é consultado')

  // A mesma regra pega qualquer registro com a mesma forma.
  ok(detectarConflitos({ especificacoes: { potencia_kw: 5, potencia_maxima_kw: 4 } })
    .some((c) => c.tipo === TIPO_CONFLITO.IMPOSSIVEL), 'regra vale para qualquer modelo')
  ok(detectarConflitos({ especificacoes: { potencia_kw: 8, potencia_maxima_kw: 8800 } })
    .some((c) => c.tipo === TIPO_CONFLITO.UNIDADE), 'idem para a escala trocada')
  ok(detectarConflitos({ especificacoes: { potencia_kw: 2, potencia_maxima_kw: 2.2 } }).length === 0,
    'máximo ligeiramente acima do nominal é normal, não conflito')
}

// ── 4. Segundo repositório de spec ──────────────────────────────────────────
secao('4. `specs_canonicas` é reportado, não lido')
{
  const so = detectarConflitos(HOYMILES).filter((c) => c.tipo === TIPO_CONFLITO.SO_EM_SPECS_CANONICAS)
  ok(so.some((c) => c.campo === 'corrente_isc_max'),
    'dado que só existe lá é reportado como fora do alcance do cálculo')
  ok(lerInversor(HOYMILES.especificacoes).corrente_isc_max === null,
    'e continua invisível ao leitor canônico — reportar não é adotar')
  ok(!camposEmConflito(HOYMILES).includes('corrente_isc_max'),
    'ausência no leitor não é conflito de valor')

  const divergente = detectarConflitos({
    especificacoes: { potencia_kw: 2 }, specs_canonicas: { potencia_kw_ca: 3 },
  })
  ok(divergente.some((c) => c.tipo === TIPO_CONFLITO.DIVERGENTE),
    'os dois repositórios discordando é conflito nomeado')
}

// ── 5. Capacidade sem inferência ────────────────────────────────────────────
secao('5. Capacidade')
{
  const semEntradas = planejarMicros({
    modulos: 24, quantidade: 6, fases: 'Trifásico',
    micro: { fabricante: 'Deye', corrente_max_por_mppt: 13 },
  })
  ok(semEntradas.capacidade_por_micro === null && semEntradas.distribuicao === null,
    'sem entradas/módulos por entrada não há capacidade')

  const completo = planejarMicros({
    modulos: 24, quantidade: 6, fases: 'Monofásico',
    micro: { entradas: 4, modulos_por_entrada: 1, fabricante: 'X', origem: 'ssot', max_por_cabo_tronco: 4 },
  })
  ok(completo.capacidade_por_micro === 4 && completo.procedencia_capacidade === 'ssot',
    'cadastro completo permite o fluxo automático')
  ok(JSON.stringify(completo.arranjos.map((a) => a.micros.length)) === '[4,2]',
    'e o limite do cadastro forma os arranjos')

  for (const rel of ['arranjosMicro.js', 'correnteMicro.js', 'regrasMicroFabricante.js']) {
    ok(!/n_mppts|entradas_por_mppt/.test(
      readFileSync(path.join(RAIZ, `../packages/fv-shared/engenharia/${rel}`), 'utf8')),
    `${rel}: nenhuma derivação por n_mppts`)
  }
}

// ── 6. Corrente de ramal ────────────────────────────────────────────────────
secao('6. Corrente de ramal')
{
  const r = correnteDoRamal({ correnteAcSaida: 10.82, micros: 3 })
  ok(r.corrente_a === 32.46, 'o valor é calculado e informado')
  ok(r.veredito === VEREDITO.NAO_AVALIADO && r.limite_a === null,
    'sem limite cadastrado, nenhum "OK" é emitido')
  ok(!Object.keys(CAMPOS_INVERSOR).some((c) => /corrente.*(ramal|tronco)/i.test(c)),
    'nenhum campo de limite de ramal foi inventado')
}

// ── 7. Duplicação ───────────────────────────────────────────────────────────
secao('7. Sem fórmula paralela nova')
{
  const src = readFileSync(path.join(RAIZ, '../frontend/src/pages/Inversores.jsx'), 'utf8')
  ok(/from '@fortesolar\/fv-shared\/engenharia\/corrente-micro'/.test(src),
    'a página consome o motor para a corrente acumulada do ramal')
  ok(!/imax \* nMicros/.test(src), 'a multiplicação duplicada foi removida')
  ok(/iTotal \* 1\.1/.test(src),
    'o fator 1,1 do lado CA permanece: é critério diferente do canônico')
  ok(!/import[^\n]*selecionarCabo/.test(src) && !/selecionarCabo\(/.test(src),
    'o seletor canônico NÃO foi aplicado — as duas regras não são equivalentes')
  ok(/NÃO é\s*\n?\s*\*?\s*equivalente|não é equivalente/i.test(src),
    'e a divergência está documentada no próprio arquivo')

  const motor = readFileSync(path.join(RAIZ, '../packages/fv-shared/engenharia/correnteMicro.js'), 'utf8')
  ok(/from '\.\/engenhariaNormativa\.js'/.test(motor) && !/[^_A-Za-z]1\.25[^0-9]/.test(motor),
    'o motor de corrente continua reusando a primitiva normativa')
}

console.log(`\n${falhas === 0 ? '✓ TODOS OS CHECKS PASSARAM' : `✗ ${falhas} CHECK(S) FALHARAM`}`)
process.exit(falhas === 0 ? 0 : 1)
