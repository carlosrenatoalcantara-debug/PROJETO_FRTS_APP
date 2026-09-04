/**
 * arranjosMicro.check.js — Sprint E.
 *
 * O que este check protege:
 *  1. o agrupamento de micros em arranjos NÃO tem default — sem regra declarada
 *     não há arranjo, e a lacuna é nomeada;
 *  2. a regra de um fabricante não vaza para outro, nem por substring de grafia;
 *  3. o catálogo do MODELO vence a tabela do fabricante (dado mais específico);
 *  4. o campo `max_por_cabo_tronco` é canônico no dicionário do SSOT;
 *  5. monofásico não ganha balanceamento fabricado; trifásico ganha, e o resíduo
 *     é declarado em vez de escondido;
 *  6. o motor de arranjos não conhece MPPT nem string — o caminho string segue
 *     intocado;
 *  7. o schema aceita o agrupamento como campo ADITIVO, sem tocar em `mppts[]`.
 *
 * Puro: sem banco, sem HTTP.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  agruparMicrosEmArranjos, balancearFases, fasesDaInstalacao, planejarMicros, planoObsoleto,
} from '@fortesolar/fv-shared/engenharia/arranjos-micro'
import {
  regraDeArranjoMicro, REGRAS_MICRO_POR_FABRICANTE,
} from '@fortesolar/fv-shared/engenharia/regras-micro-fabricante'
import { CAMPOS_INVERSOR, lerInversor } from '@fortesolar/fv-shared/inversores/dicionario'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n── ${t}`)

const DEYE = { entradas: 4, modulos_por_entrada: 1, fabricante: 'Deye' }
const OUTRO = { entradas: 4, modulos_por_entrada: 1, fabricante: 'Hoymiles' }

// ── 1. Sem regra declarada não há arranjo ───────────────────────────────────
secao('1. Ausência de regra é lacuna, não default')
{
  const p = planejarMicros({ modulos: 24, quantidade: 6, micro: OUTRO, fases: 'Trifásico' })
  ok(p.arranjos === null, 'sem regra, `arranjos` é null — nenhum agrupamento é proposto')
  ok(p.completo === false, 'o plano se declara incompleto')
  ok(/limite de microinversores por arranjo/i.test(p.lacunas.join(' ')),
    'a lacuna é nomeada, não silenciosa')
  ok(agruparMicrosEmArranjos(6, null) === null, 'agrupar sem limite devolve null')
  ok(agruparMicrosEmArranjos(6, 0) === null, 'limite zero é ausência, não "sem limite"')
}

// ── 2. A regra não vaza entre fabricantes ───────────────────────────────────
secao('2. Isolamento entre fabricantes')
{
  ok(regraDeArranjoMicro(DEYE).max_por_cabo_tronco === 3, 'Deye: 3 micros por arranjo')
  ok(regraDeArranjoMicro(DEYE).fonte === 'fabricante', 'a fonte é declarada como tabela de fabricante')
  ok(!!regraDeArranjoMicro(DEYE).procedencia, 'a regra carrega procedência')
  ok(regraDeArranjoMicro(OUTRO).fonte === null, 'outro fabricante não herda a regra')
  ok(regraDeArranjoMicro({ fabricante: 'Deyeco' }).fonte === null,
    'casamento é por token exato — grafia parecida não herda')
  ok(regraDeArranjoMicro({ fabricante: 'DEYE SOLAR' }).fonte === 'fabricante',
    'token do fabricante casa mesmo com sufixo comercial')
  ok(regraDeArranjoMicro({}).fonte === null, 'sem fabricante, sem regra')
  const semProcedencia = Object.entries(REGRAS_MICRO_POR_FABRICANTE)
    .filter(([, r]) => !r.procedencia)
  ok(semProcedencia.length === 0, 'nenhuma regra da tabela existe sem procedência declarada')
}

// ── 3. Precedência do catálogo ──────────────────────────────────────────────
secao('3. O dado do modelo vence o do fabricante')
{
  const r = regraDeArranjoMicro({ ...DEYE, max_por_cabo_tronco: 5 })
  ok(r.max_por_cabo_tronco === 5 && r.fonte === 'catalogo',
    'declarado no catálogo do modelo, é ele que vale')
  const p = planejarMicros({
    modulos: 24, quantidade: 6, fases: 'Monofásico',
    micro: { ...DEYE, max_por_cabo_tronco: 5 },
  })
  ok(JSON.stringify(p.arranjos.map((a) => a.micros.length)) === '[5,1]',
    'e o agrupamento segue o limite do catálogo, não o do fabricante')
}

// ── 4. Campo canônico no SSOT ───────────────────────────────────────────────
secao('4. Vocabulário do SSOT')
{
  ok(!!CAMPOS_INVERSOR.max_por_cabo_tronco, '`max_por_cabo_tronco` está no dicionário')
  ok(CAMPOS_INVERSOR.max_por_cabo_tronco.peso === undefined,
    'sem peso — reconhecido em leitura, não altera o score existente')
  ok(lerInversor({ max_micros_por_ramal: 3 }).max_por_cabo_tronco === 3,
    'os aliases históricos resolvem para o nome canônico')
  ok(lerInversor({}).max_por_cabo_tronco === null, 'ausente é null, nunca um número')
}

// ── 5. Fases ────────────────────────────────────────────────────────────────
secao('5. Balanceamento de fases')
{
  ok(fasesDaInstalacao('Monofásico') === 1 && fasesDaInstalacao('Monofasico') === 1,
    'o rótulo é lido com e sem acento')
  ok(fasesDaInstalacao('Trifásico'.normalize('NFD')) === 3, 'NFD não produz lacuna falsa')
  ok(fasesDaInstalacao(null) === null, 'ausência de rótulo não vira monofásico')

  const mono = planejarMicros({ modulos: 24, quantidade: 6, micro: DEYE, fases: 'Monofásico' })
  ok(mono.fases.atribuicao === null && mono.arranjos.every((a) => a.fase === null),
    'monofásico: nenhuma fase é fabricada')
  ok(balancearFases([3, 3], 1) === null, 'não há balanceamento entre uma fase só')

  const tri = planejarMicros({ modulos: 36, quantidade: 9, micro: DEYE, fases: 'Trifásico' })
  ok(JSON.stringify(tri.fases.por_fase) === '{"L1":3,"L2":3,"L3":3}', '9 micros → 3/3/3')
  ok(tri.fases.equilibrado === true, 'e o plano se declara equilibrado')

  const resto = planejarMicros({ modulos: 32, quantidade: 8, micro: DEYE, fases: 'Trifásico' })
  ok(JSON.stringify(resto.fases.por_fase) === '{"L1":3,"L2":3,"L3":2}',
    '8 micros → 3/3/2, determinístico')
  ok(resto.fases.desequilibrio === 1 && /desequilibradas/i.test(resto.avisos.join(' ')),
    'o resíduo aparece — o desequilíbrio não é ocultado')
  ok(JSON.stringify(planejarMicros({ modulos: 32, quantidade: 8, micro: DEYE, fases: 'Trifásico' }))
    === JSON.stringify(resto), 'duas chamadas iguais produzem o mesmo plano')
}

// ── 6. O caminho string não é tocado ────────────────────────────────────────
secao('6. Isolamento em relação ao caminho STRING')
{
  const src = readFileSync(path.join(RAIZ, '../packages/fv-shared/engenharia/arranjosMicro.js'), 'utf8')
  ok(!/mppt/i.test(src), 'o motor de arranjos não menciona MPPT')
  ok(!/string_/i.test(src) && !/strings_por/i.test(src), 'nem strings')
  ok(!/engenhariaNormativa/.test(src),
    'não reimplementa física — o nível elétrico continua no motor da FV-DOM-031')
  ok(/from '\.\/microinversores\.js'/.test(src),
    'a distribuição de módulos é DELEGADA ao motor canônico, não copiada')
}

// ── 7. Schema aditivo ───────────────────────────────────────────────────────
secao('7. Persistência')
{
  const src = readFileSync(path.join(RAIZ, 'src/models/ProjetoFV.js'), 'utf8')
  // `num_mppts_usados` também existe em `engenharia_eletrica`, antes daqui — o
  // recorte parte do `micros: {` e procura o fim DEPOIS dele, não no arquivo todo.
  const inicio = src.indexOf('micros: {')
  const bloco = src.slice(inicio, src.indexOf('num_mppts_usados', inicio))
  ok(inicio > 0 && bloco.length > 0, 'o bloco `micros[]` do schema foi localizado')
  ok(/arranjos: \{/.test(bloco), '`arranjos` vive DENTRO de `micros[]`, não solto')
  ok(/enum: \['L1', 'L2', 'L3', null\]/.test(bloco), 'a fase é identidade fechada L1/L2/L3')
  ok(/default: undefined/.test(bloco), 'ausência é campo ausente, não array vazio')
  ok(!/max_por_cabo_tronco/.test(bloco),
    'o limite do fabricante NÃO é copiado para o projeto — fica no catálogo')

  const plano = planejarMicros({ modulos: 32, quantidade: 8, micro: DEYE, fases: 'Trifásico' })
  const gravado = plano.arranjos.map((a) => ({ micros: a.micros, fase: a.fase }))
  ok(planoObsoleto(gravado, plano).obsoleto === false, 'o que foi gravado se relê coerente')
  ok(planoObsoleto([{ micros: [1, 2, 3], fase: 'L1' }], plano).obsoleto === true,
    'agrupamento que não cobre a quantidade atual é denunciado')
  ok(planoObsoleto(undefined, plano).obsoleto === false,
    'projeto legado sem agrupamento não é "obsoleto" — é ausente')
}

console.log(`\n${falhas === 0 ? '✓ TODOS OS CHECKS PASSARAM' : `✗ ${falhas} CHECK(S) FALHARAM`}`)
process.exit(falhas === 0 ? 0 : 1)
