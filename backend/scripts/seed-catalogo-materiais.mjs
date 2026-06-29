/**
 * seed-catalogo-materiais.mjs — P1-CATALOGO-MATERIAIS-ETAPA-2 (Sprint 2B)
 *
 * Popula o Catálogo Mestre com os materiais reais usados pela Forte Solar em
 * instalações de carregadores EV. Idempotente — upsert por chaveCanonica.
 * NÃO sobrescreve precoReferencia nem historicoCompras se o registro já existir.
 *
 *   cd backend && railway run npm run catalogo:seed-materiais          # aplica
 *   cd backend && railway run npm run catalogo:seed-materiais -- --dry # preview
 *
 * ATENÇÃO: requer que os 5 templates estejam no banco (rodar seed-templates antes).
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { createHash } from 'node:crypto'
import { conectarBD } from '../src/config/database.js'
import { Material } from '../src/models/Material.js'

const DRY = process.argv.includes('--dry')

// ─── Helpers ───────────────────────────────────────────────────────────────────

function norm(s) {
  return String(s).normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

function chave(categoria, especificacoes) {
  const sorted = [...especificacoes].sort((a, b) => a.chave.localeCompare(b.chave))
  const str = `categoria:${norm(categoria)}|` + sorted.map(e => `${norm(e.chave)}:${norm(e.valor)}`).join('|')
  return createHash('sha1').update(str).digest('hex')
}

function m(descricao, categoria, unidade, especificacoes) {
  return { descricao, categoria, unidade, especificacoes, chaveCanonica: chave(categoria, especificacoes) }
}

// ─── Materiais iniciais (BOM EV — Forte Solar) ─────────────────────────────────

const MATERIAIS = [
  // ── Cabos (bitola_mm2, n_condutores, tensao, material_condutor) ─────────────
  m('Cabo 2,5mm² 1C 0,6/1kV cobre',  'cabos', 'm', [
    { chave: 'bitola_mm2', valor: '2.5' }, { chave: 'n_condutores', valor: '1' },
    { chave: 'tensao_isolamento_v', valor: '0,6/1kV' }, { chave: 'material_condutor', valor: 'cobre' },
  ]),
  m('Cabo 4mm² 1C 0,6/1kV cobre',    'cabos', 'm', [
    { chave: 'bitola_mm2', valor: '4' }, { chave: 'n_condutores', valor: '1' },
    { chave: 'tensao_isolamento_v', valor: '0,6/1kV' }, { chave: 'material_condutor', valor: 'cobre' },
  ]),
  m('Cabo 6mm² 1C 0,6/1kV cobre',    'cabos', 'm', [
    { chave: 'bitola_mm2', valor: '6' }, { chave: 'n_condutores', valor: '1' },
    { chave: 'tensao_isolamento_v', valor: '0,6/1kV' }, { chave: 'material_condutor', valor: 'cobre' },
  ]),
  m('Cabo 10mm² 1C 0,6/1kV cobre',   'cabos', 'm', [
    { chave: 'bitola_mm2', valor: '10' }, { chave: 'n_condutores', valor: '1' },
    { chave: 'tensao_isolamento_v', valor: '0,6/1kV' }, { chave: 'material_condutor', valor: 'cobre' },
  ]),
  m('Cabo 16mm² 1C 0,6/1kV cobre',   'cabos', 'm', [
    { chave: 'bitola_mm2', valor: '16' }, { chave: 'n_condutores', valor: '1' },
    { chave: 'tensao_isolamento_v', valor: '0,6/1kV' }, { chave: 'material_condutor', valor: 'cobre' },
  ]),
  m('Cabo 25mm² 1C 0,6/1kV cobre',   'cabos', 'm', [
    { chave: 'bitola_mm2', valor: '25' }, { chave: 'n_condutores', valor: '1' },
    { chave: 'tensao_isolamento_v', valor: '0,6/1kV' }, { chave: 'material_condutor', valor: 'cobre' },
  ]),

  // ── Proteção Elétrica ───────────────────────────────────────────────────────
  m('Trilho DIN',                    'protecao_eletrica', 'un', [{ chave: 'tipo', valor: 'Trilho DIN' }]),
  m('Barramento de cobre',           'protecao_eletrica', 'un', [{ chave: 'tipo', valor: 'Barramento de cobre' }]),
  m('Disjuntor termomagnético',      'protecao_eletrica', 'un', [{ chave: 'tipo', valor: 'Disjuntor termomagnético' }]),
  m('Dispositivo DR',                'protecao_eletrica', 'un', [{ chave: 'tipo', valor: 'Dispositivo DR' }]),
  m('DPS (Proteção contra Surtos)',  'protecao_eletrica', 'un', [{ chave: 'tipo', valor: 'DPS (Proteção contra Surtos)' }]),

  // ── Quadros e Barramentos ───────────────────────────────────────────────────
  m('Quadro de proteção EV',         'quadros_barramentos', 'un', [{ chave: 'tipo', valor: 'Quadro de proteção EV' }]),
  m('Mob Box',                       'quadros_barramentos', 'un', [{ chave: 'tipo', valor: 'Mob Box' }]),

  // ── Conexões e Infraestrutura ───────────────────────────────────────────────
  m('Eletroduto rígido PVC 25mm',    'conexoes_infraestrutura', 'barra', [{ chave: 'tipo', valor: 'Eletroduto rígido PVC 25mm' }]),
  m('Eletroduto rígido PVC 32mm',    'conexoes_infraestrutura', 'barra', [{ chave: 'tipo', valor: 'Eletroduto rígido PVC 32mm' }]),
  m('Curva PVC 25mm 90°',            'conexoes_infraestrutura', 'un',    [{ chave: 'tipo', valor: 'Curva PVC 25mm 90°' }]),
  m('Curva PVC 32mm 90°',            'conexoes_infraestrutura', 'un',    [{ chave: 'tipo', valor: 'Curva PVC 32mm 90°' }]),
  m('Luva PVC 25mm',                 'conexoes_infraestrutura', 'un',    [{ chave: 'tipo', valor: 'Luva PVC 25mm' }]),
  m('Luva PVC 32mm',                 'conexoes_infraestrutura', 'un',    [{ chave: 'tipo', valor: 'Luva PVC 32mm' }]),
  m('Prensa-cabo',                   'conexoes_infraestrutura', 'un',    [{ chave: 'tipo', valor: 'Prensa-cabo' }]),
  m('Box reto (caixa de passagem)',  'conexoes_infraestrutura', 'un',    [{ chave: 'tipo', valor: 'Box reto (caixa de passagem)' }]),
  m('Terminal tubular 6mm²',         'conexoes_infraestrutura', 'un',    [{ chave: 'tipo', valor: 'Terminal tubular 6mm²' }]),
  m('Terminal tubular 10mm²',        'conexoes_infraestrutura', 'un',    [{ chave: 'tipo', valor: 'Terminal tubular 10mm²' }]),
  m('Terminal tubular 16mm²',        'conexoes_infraestrutura', 'un',    [{ chave: 'tipo', valor: 'Terminal tubular 16mm²' }]),
  m('Terminal tubular 25mm²',        'conexoes_infraestrutura', 'un',    [{ chave: 'tipo', valor: 'Terminal tubular 25mm²' }]),
  m('Conector perfurante',           'conexoes_infraestrutura', 'un',    [{ chave: 'tipo', valor: 'Conector perfurante' }]),
  m('Haste de aterramento 2,4m',     'conexoes_infraestrutura', 'un',    [{ chave: 'tipo', valor: 'Haste de aterramento 2,4m' }]),

  // ── Fixação ─────────────────────────────────────────────────────────────────
  m('Abraçadeira 1/2"',              'fixacao', 'un',   [{ chave: 'tipo', valor: 'Abraçadeira 1/2"' }]),
  m('Abraçadeira 3/4"',              'fixacao', 'un',   [{ chave: 'tipo', valor: 'Abraçadeira 3/4"' }]),
  m('Bucha+parafuso 1/2"',           'fixacao', 'jogo', [{ chave: 'tipo', valor: 'Bucha+parafuso 1/2"' }]),
  m('Bucha+parafuso 3/4"',           'fixacao', 'jogo', [{ chave: 'tipo', valor: 'Bucha+parafuso 3/4"' }]),
  m('Fita isolante',                 'fixacao', 'rolo', [{ chave: 'tipo', valor: 'Fita isolante' }]),
]

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY) {
    const por_cat = {}
    for (const mat of MATERIAIS) {
      por_cat[mat.categoria] = (por_cat[mat.categoria] || 0) + 1
      console.log(`  [${mat.categoria}] ${mat.descricao} (${mat.unidade})`)
    }
    console.log(`\n${MATERIAIS.length} materiais (dry-run, nada gravado).`)
    console.log('Por categoria:', Object.entries(por_cat).map(([k, v]) => `${k}: ${v}`).join(' | '))
    process.exit(0)
  }

  const ok = await conectarBD(3, 2000)
  if (!ok) { console.error('❌ MongoDB indisponível.'); process.exit(1) }

  let criados = 0, existentes = 0
  for (const mat of MATERIAIS) {
    const filtro = { empresa_id: null, chaveCanonica: mat.chaveCanonica }
    const existe = await Material.exists(filtro)
    if (existe) {
      existentes++
      process.stdout.write(`  ⟳ ${mat.descricao}\n`)
      continue
    }
    await Material.create({
      ...mat,
      empresa_id: null,
      classe: 'commodity',
      status: 'ativo',
    })
    criados++
    process.stdout.write(`  + ${mat.descricao}\n`)
  }

  console.log(`\n✅ Materiais: ${criados} criados, ${existentes} já existiam (total ${MATERIAIS.length}).`)
  await mongoose.disconnect()
  process.exit(0)
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
