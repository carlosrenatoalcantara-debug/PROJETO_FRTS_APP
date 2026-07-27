/**
 * lme.check.js — Legacy Migration Engine · ADR-022
 *
 * Verificação do contrato e do orquestrador com plano sintético — sem banco,
 * sem API, sem mongoose (o backend não tem runner de testes).
 *
 *   node backend/src/lme/__checks__/lme.check.js
 *
 * Sai com código ≠ 0 se qualquer garantia do motor falhar.
 */
import { executarMigracao } from '../execucao.js'
import { validarPlano, prepararContexto, ACOES, ErroPlanoInvalido } from '../contrato.js'

let falhas = 0
const ok = (cond, msg) => { console.log((cond ? '✓' : '✗ FALHOU') + ' ' + msg); if (!cond) falhas++ }
const lancou = async (fn, nome) => { try { await fn(); return null } catch (e) { return e?.name === nome ? e : null } }

// ─── Plano sintético ────────────────────────────────────────────────────────
// Registra o que o aplicador realmente tocou — é assim que se prova o dry-run.
const escritas = []

function planoFake({ alvo = 'Equipamento', itens } = {}) {
  return {
    id: 'LME-CHECK-01',
    alvo,
    fonte: { extrair: () => itens ?? [
      { ref: 'a', dados: { nome: 'ok'      } },
      { ref: 'b', dados: { nome: 'ruido'   } },  // barrado na validação bruta
      { ref: 'c', dados: { nome: 'existe'  } },  // ignorar
      { ref: 'd', dados: { nome: 'divirja' } },  // conflito
      { ref: 'e', dados: { nome: 'explode' } },  // erro de item
      { ref: 'f', dados: { nome: 'torto'   } },  // não normalizável
    ] },
    validador: {
      bruto: ({ dados }) => ({ ok: dados.nome !== 'ruido', motivo: 'ruído' }),
    },
    normalizador: {
      normalizar: ({ ref, dados }) => dados.nome === 'torto'
        ? { ok: false, motivo: 'não cabe no canônico' }
        : { ok: true, canonico: { ref, hash: `h-${ref}` } },
    },
    matcher: {
      encontrar: (c) => ['h-c', 'h-d'].includes(c.hash)
        ? { alvo: { _id: `id-${c.ref}` }, criterio: 'hash', confianca: 1 }
        : { alvo: null },
    },
    reconciliador: {
      decidir: (c) => {
        if (c.hash === 'h-c') return { acao: ACOES.IGNORAR,  motivo: 'idêntico' }
        if (c.hash === 'h-d') return { acao: ACOES.CONFLITO, motivo: 'divergente' }
        if (c.hash === 'h-e') return { acao: ACOES.CRIAR,    motivo: 'novo', explode: true }
        return { acao: ACOES.CRIAR, motivo: 'novo' }
      },
    },
    aplicador: {
      aplicar: (d, ctx) => {
        if (d.explode) throw new Error('falha simulada de persistência')
        if (!ctx.dryRun) escritas.push(d.canonico.ref)
        return { ok: true, destino_id: `novo-${d.canonico.ref}` }
      },
    },
  }
}

// ─── Contrato ───────────────────────────────────────────────────────────────
const erroPlano = await lancou(() => validarPlano({ id: 'x' }), 'ErroPlanoInvalido')
ok(erroPlano instanceof ErroPlanoInvalido, 'plano incompleto é rejeitado')
ok(erroPlano.falhas.length >= 6, 'rejeição lista TODAS as falhas de uma vez (alvo + 5 estágios)')
ok(validarPlano(planoFake()) === true, 'plano completo é aceito')

// Tenancy fail-closed: alvo com escopo de organização não roda sem empresa_id.
const semTenant = await lancou(() => prepararContexto({ id: 'x', alvo: 'Cliente' }, {}), 'ErroTenantAusente')
ok(!!semTenant, 'alvo ESCOPO_TENANT sem empresa_id é bloqueado (M-4 fail-closed)')
ok(prepararContexto({ id: 'x', alvo: 'Cliente' }, { empresa_id: 'e1' }).empresa_id === 'e1', 'alvo ESCOPO_TENANT roda com empresa_id')
ok(prepararContexto({ id: 'x', alvo: 'Equipamento' }, {}).dryRun === true, 'alvo GLOBAL dispensa tenant e nasce em dry-run')

// ─── Execução: dry-run é o padrão ───────────────────────────────────────────
const seco = await executarMigracao(planoFake())
ok(seco.dry_run === true, 'dryRun é o PADRÃO quando não informado')
ok(escritas.length === 0, 'dry-run não deixou o aplicador escrever')
ok(seco.totais.extraidos === 6, 'contou 6 itens extraídos')
ok(seco.totais[ACOES.CRIAR] === 1,     'criar = 1 (item a)')
ok(seco.totais[ACOES.IGNORAR] === 1,   'ignorar = 1 (item c)')
ok(seco.totais[ACOES.CONFLITO] === 1,  'conflito = 1 (item d)')
ok(seco.totais.descartados === 2,      'descartados = 2 (ruído bruto + não normalizável)')
ok(seco.totais.erros === 1,            'erros = 1 e a execução NÃO abortou (item e)')
ok(seco.ledger.entradas.length === 6,  'todo item extraído gerou entrada no ledger — nenhum some')

const porRef = Object.fromEntries(seco.ledger.entradas.map(e => [e.ref, e]))
ok(porRef.b.etapa === 'validacao_bruta',    'item barrado registra a etapa onde parou')
ok(porRef.f.etapa === 'normalizacao',       'item não canonizável para na normalização')
ok(porRef.d.destino_id === 'id-d',          'conflito aponta o registro de destino sem escrevê-lo')
ok(seco.ledger.conflitos().length === 1,    'ledger isola o que exige decisão humana')
ok(seco.ledger.descartes().length === 2,    'ledger isola o gap real do legado')
ok(porRef.a.hash === 'h-a',                 'ledger guarda o hash (chave de idempotência)')

// ─── Execução: escrita explícita e limite ───────────────────────────────────
const molhado = await executarMigracao(planoFake(), { dryRun: false })
ok(molhado.dry_run === false && escritas.length === 1, 'escrita só acontece com dryRun:false explícito')

escritas.length = 0
const limitado = await executarMigracao(planoFake(), { limite: 2 })
ok(limitado.totais.extraidos === 2, '`limite` interrompe a extração')

// Ação fora do vocabulário fechado vira erro registrado, não escrita silenciosa.
const torto = planoFake()
torto.reconciliador.decidir = () => ({ acao: 'apagar_tudo' })
const rTorto = await executarMigracao(torto)
// 4 itens chegam à reconciliação (b e f param antes); nenhum deles é aplicado.
ok(rTorto.totais.erros === 4 && escritas.length === 0, 'ação fora de ACOES vira erro registrado, nunca escrita')

// ─── Fronteira: o Core não conhece o LME (ADR-021, regra 3) ─────────────────
// Verificação mecânica — a regra vira erro de build, não parágrafo de README.
const { readdirSync, readFileSync } = await import('node:fs')
const { join, dirname }             = await import('node:path')
const { fileURLToPath }             = await import('node:url')

const raizDominio = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dominio')
const arquivos = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap(d =>
  d.isDirectory() ? arquivos(join(dir, d.name)) : (d.name.endsWith('.js') ? [join(dir, d.name)] : []))

const vazamentos = arquivos(raizDominio).filter(f => /from\s+['"][^'"]*\/lme\//.test(readFileSync(f, 'utf8')))
ok(vazamentos.length === 0, `Core não importa do LME (dependência unidirecional)${vazamentos.length ? ' — ' + vazamentos.join(', ') : ''}`)

console.log(falhas === 0 ? '\nOK — contrato do LME íntegro' : `\n${falhas} falha(s)`)
process.exit(falhas === 0 ? 0 : 1)
