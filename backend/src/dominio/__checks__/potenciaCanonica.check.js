/**
 * potenciaCanonica.check.js — FV-DOM-052
 *
 * Guarda a regra central da sprint: **sem topologia não há potência instalada**.
 * O que ele protege é sobretudo o que a derivação NÃO faz — não estima, não
 * persiste, não bloqueia e não reimplementa fórmula.
 *
 *   node backend/src/dominio/__checks__/potenciaCanonica.check.js
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  derivarPotencias, necessidadeDoProjeto, compradaDoProjeto, instaladaDoProjeto,
  topologiaSuficiente, compararPotencias, MOTIVOS_POTENCIA,
} from '../potencia/index.js'
import { montarModeloEletrico } from '@fortesolar/fv-shared/engenharia/normativa'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../../../..')
const ler = (rel) => { try { return readFileSync(path.resolve(RAIZ, rel), 'utf8') } catch { return '' } }
const codigo = (rel) => ler(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

let falhas = 0
const ok = (c, m) => { console.log((c ? '✓' : '✗ FALHOU') + ' ' + m); if (!c) falhas++ }
const secao = (t) => console.log(`\n══ ${t}`)

const DOMINIO = 'backend/src/dominio/potencia/index.js'

// ── Fixtures ────────────────────────────────────────────────────────────────
// O cenário medido na FV-AUD: necessidade 12,9 · composição 24 × 650 W = 15,6.
const PAINEL = { marca: 'Znshine', modelo: 'ZXM7-SPLD144', potencia_w: 650, quantidade: 24 }

const semTopologia = {
  dimensionamento: { potencia_kwp: 12.9, num_paineis: 20 },
  equipamentos: { paineis: [PAINEL], inversor: { marca: 'Deye', modelo: 'SUN-16K', potencia_kw: 16, tipo: 'string' } },
  arranjos: [{
    tipo: 'principal', paineis: [PAINEL],
    inversores: [{ marca: 'Deye', modelo: 'SUN-16K', potencia_kw: 16, quantidade: 1 }],
  }],
}
const comTopologia = {
  ...semTopologia,
  engenharia_eletrica: { arranjo: { mppts: [
    { strings_paralelo: 1, modulos_por_string: 12 },
    { strings_paralelo: 1, modulos_por_string: 12 },
  ] } },
}
const vazio = { dimensionamento: {}, equipamentos: {}, arranjos: [] }

console.log('═══ FV-DOM-052 — derivação canônica das potências ═══')

// ═══ 1 · Sem topologia, sem potência instalada ═════════════════════════════
secao('1 · A regra central: sem topologia, `instalada` é null')
{
  const r = derivarPotencias(semTopologia)
  ok(r.instalada.valor === null, 'sem mppts[] → instalada = null')
  ok(r.instalada.motivo === MOTIVOS_POTENCIA.SEM_TOPOLOGIA,
    `motivo declarado → ${r.instalada.motivo}`)
  ok(r.lacunas.includes('engenharia_eletrica.arranjo.mppts'), 'lacuna nomeia o campo que falta')

  // O contraste que justifica a sprint: o motor, chamado direto, FABRICA.
  const fabricado = montarModeloEletrico({
    painel: { potenciaW: 650 }, inversor: { potencia_kw: 16, tipo: 'string', n_mppts: 2 },
    arranjoMPPTs: null, dimensionamento: { numPaineis: 20 }, dadosConsumo: {}, uf: 'RN',
  })
  ok(fabricado.sistema.potenciaCC === 13,
    `o motor sozinho devolveria ${fabricado.sistema.potenciaCC} kWp — a necessidade arredondada`)
  ok(r.instalada.valor !== fabricado.sistema.potenciaCC,
    'e a derivação canônica NÃO propaga esse número')

  const nada = derivarPotencias(vazio)
  ok(nada.instalada.valor === null && nada.comprada.valor === null && nada.necessidade.valor === null,
    'projeto vazio: as três null, nenhuma vira 0')
  ok(nada.necessidade.motivo === MOTIVOS_POTENCIA.SEM_NECESSIDADE
    && nada.comprada.motivo === MOTIVOS_POTENCIA.SEM_COMPOSICAO,
    'cada ausência com o próprio motivo')
}

// ═══ 2 · Com topologia, delega ao motor ════════════════════════════════════
secao('2 · Com topologia suficiente, o número é o do motor')
{
  const r = derivarPotencias(comTopologia)
  ok(r.instalada.valor === 15.6, `instalada = ${r.instalada.valor} kWp`)
  ok(r.instalada.modulos === 24, `${r.instalada.modulos} módulos — contagem real, não estimada`)
  ok(r.instalada.fonte === 'engenharia_eletrica.arranjo.mppts[] × Pmpp', 'fonte declarada')

  // Byte a byte igual ao que o unifilar desenha — nenhuma soma nova.
  const doMotor = montarModeloEletrico({
    painel: { potenciaW: 650 }, inversor: { potencia_kw: 16, tipo: 'string', n_mppts: 2 },
    arranjoMPPTs: [{ numStrings: 1, modulosPorString: 12 }, { numStrings: 1, modulosPorString: 12 }],
    dimensionamento: { numPaineis: 20 }, dadosConsumo: {}, uf: null,
  })
  ok(r.instalada.valor === doMotor.sistema.potenciaCC,
    'idêntico ao motor — a derivação delega, não recalcula')

  // Pmpp ausente é lacuna, nunca 550 W.
  const semPmpp = { ...comTopologia, equipamentos: { ...comTopologia.equipamentos, paineis: [{ ...PAINEL, potencia_w: null }] } }
  const s = derivarPotencias(semPmpp)
  ok(s.instalada.valor === null && s.instalada.motivo === MOTIVOS_POTENCIA.SEM_POTENCIA_MODULO,
    'módulo sem potência → lacuna, e não os 550 W do motor')
}

// ═══ 3 · As três permanecem separadas ══════════════════════════════════════
secao('3 · Três grandezas, três fontes')
{
  const r = derivarPotencias(comTopologia)
  ok(r.necessidade.valor === 12.9 && r.necessidade.fonte === 'dimensionamento.potencia_kwp',
    `necessidade = ${r.necessidade.valor} kWp`)
  ok(r.comprada.valor === 15.6 && /arranjos\[\]/.test(r.comprada.fonte),
    `comprada = ${r.comprada.valor} kWp`)
  ok(r.instalada.valor === 15.6, `instalada = ${r.instalada.valor} kWp`)
  ok(r.necessidade.valor !== r.comprada.valor, 'necessidade e comprada NÃO são reconciliadas')

  // A necessidade é lida, nunca recalculada — não existe segunda fórmula.
  const fonte = codigo(DOMINIO)
  ok(!/consumo_mensal_kwh|irradiancia|perdas_pct|margem_pct|calcularPotenciaKwp/.test(fonte),
    'a necessidade não é recalculada aqui')
  ok(!/reduce\([^)]*potencia_w|quantidade\s*\*\s*potencia/.test(fonte),
    'os módulos não são somados aqui — vem de obterTopologiaProjeto')
  ok(/obterTopologiaProjeto/.test(fonte), 'usa a camada de acesso oficial da topologia')
}

// ═══ 4 · Divergência declara, não bloqueia ═════════════════════════════════
secao('4 · Divergência é derivada e informativa')
{
  const r = derivarPotencias(comTopologia)
  const d = r.divergencias.necessidade_vs_comprada
  ok(d.divergente === true && d.diferenca_kwp === 2.7,
    `necessidade → comprada: +${d.diferenca_kwp} kWp (${d.diferenca_pct}%)`)
  ok(r.divergencias.comprada_vs_instalada.divergente === false,
    'comprada = instalada quando a topologia confere')

  const semInst = derivarPotencias(semTopologia)
  ok(semInst.divergencias.comprada_vs_instalada.comparavel === false,
    'sem instalada, a comparação é INCOMPARÁVEL — não 0, não divergente')
  ok(semInst.divergencias.comprada_vs_instalada.divergente === false,
    'e não se declara divergência sobre um valor que não existe')

  const fonte = codigo(DOMINIO)
  ok(!/throw|ErroPotencia/.test(fonte), 'nada lança — a derivação informa')
  ok(!/TOLERANCIA|LIMITE_|tolerancia|aceitavel/i.test(fonte),
    'nenhuma faixa de tolerância inventada (decisão de negócio pendente)')
}

// ═══ 5 · Pura: sem I/O, sem persistência ═══════════════════════════════════
secao('5 · Pureza e não-persistência (INV-58)')
{
  const fonte = codigo(DOMINIO)
  for (const [rot, re] of [
    ['mongoose/model', /mongoose|findById|updateOne|\$set|\.save\(/],
    ['process.env', /process\.env/],
    ['req/res', /\breq\b|\bres\b\./],
    ['Date.now/new Date', /Date\.now\(|new Date\(/],
  ]) ok(!re.test(fonte), `sem ${rot}`)

  const antes = JSON.stringify(comTopologia)
  derivarPotencias(comTopologia)
  ok(JSON.stringify(comTopologia) === antes, 'não muta o projeto recebido')

  const a = derivarPotencias(comTopologia)
  const b = derivarPotencias(comTopologia)
  ok(JSON.stringify(a) === JSON.stringify(b), 'idempotente')
}

// ═══ 6 · Motor legado intocado ═════════════════════════════════════════════
secao('6 · `montarModeloEletrico` não foi alterado')
{
  const motor = ler('packages/fv-shared/engenharia/engenhariaNormativa.js')
  ok(/numPaineis\s*=\s*dimensionamento\?\.numPaineis\s*\?\?\s*6/.test(motor),
    'o fallback do motor CONTINUA lá — é compartilhado com o wizard legado')
  ok(/\|\|\s*550/.test(motor), 'e o Pmpp de 550 W também')
  ok(!/potencia\/index/.test(motor), 'o motor não conhece este domínio')

  // Nenhum leitor foi trocado nesta sprint.
  for (const rel of [
    'backend/src/services/EnvioPropostaService.js',
    'backend/src/services/propostaComercialService.js',
    'backend/src/utils/homologacao/homologacaoAssistida.js',
    'backend/src/routes/painel.js',
    'backend/src/dominio/financeiro/index.js',
    'backend/src/dominio/unifilar/index.js',
  ]) ok(!/dominio\/potencia|derivarPotencias/.test(ler(rel)),
    `${path.basename(rel)} ainda não consome a derivação (é a FV-DOM-053)`)
}

// ═══ 7 · Topologia micro ═══════════════════════════════════════════════════
secao('7 · Caminho micro usa micros[], não mppts[]')
{
  const micro = {
    dimensionamento: { potencia_kwp: 12.9, num_paineis: 20 },
    equipamentos: {
      paineis: [PAINEL],
      inversor: { marca: 'Hoymiles', modelo: 'HMS-2000-4T', potencia_kw: 2, tipo: 'microinversor' },
    },
    arranjos: [{
      tipo: 'principal', paineis: [PAINEL],
      inversores: [{ equipamento_id: 'i1', marca: 'Hoymiles', modelo: 'HMS-2000-4T', potencia_kw: 2, quantidade: 8 }],
      configuracao_eletrica: { micros: [{
        equipamento_id: 'i1', marca: 'Hoymiles', modelo: 'HMS-2000-4T',
        quantidade: 8, entradas_por_micro: 4, modulos_por_entrada: 1,
      }] },
    }],
  }
  const porta = topologiaSuficiente({ topologia: 'micro', micros: [{}], painel: { potenciaW: 650 } })
  ok(porta.topologia === 'micro' && porta.suficiente, 'micro com micros[] e Pmpp é suficiente')
  ok(topologiaSuficiente({ topologia: 'micro', micros: [], painel: { potenciaW: 650 } })
    .lacunas.includes('arranjos[].configuracao_eletrica.micros'),
    'micro sem micros[] declara a lacuna PRÓPRIA, não a de strings')

  const r = derivarPotencias(micro)
  ok(r.instalada.topologia === 'micro', 'projeto micro é reconhecido')
  ok(r.instalada.valor === null || r.instalada.valor > 0,
    `instalada micro = ${r.instalada.valor ?? 'null (lacuna: ' + (r.instalada.lacunas ?? []).join(', ') + ')'}`)
  ok(r.instalada.valor !== 13, 'em nenhum caso o número fabricado de 13 kWp aparece')
}

// ═══ 8 · Comparação isolada ════════════════════════════════════════════════
secao('8 · `compararPotencias` isolada')
{
  ok(compararPotencias({ valor: 10 }, { valor: 12 }, 'x').diferenca_kwp === 2, '10 → 12 = +2')
  ok(compararPotencias({ valor: 10 }, { valor: 12 }, 'x').diferenca_pct === 20, 'e +20%')
  ok(compararPotencias({ valor: 10 }, { valor: 10 }, 'x').divergente === false, 'iguais não divergem')
  ok(compararPotencias({ valor: null }, { valor: 12 }, 'x').comparavel === false, 'null é incomparável')
  ok(compararPotencias({ valor: 0 }, { valor: 5 }, 'x').diferenca_pct === null,
    'divisão por zero devolve null, não Infinity')
}

console.log(falhas === 0
  ? '\nOK — três potências separadas, nenhuma estimada e nenhum leitor tocado.'
  : `\n${falhas} FALHA(S).`)
process.exit(falhas === 0 ? 0 : 1)
