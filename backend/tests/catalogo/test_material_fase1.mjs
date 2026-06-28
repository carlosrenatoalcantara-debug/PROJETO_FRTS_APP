/**
 * test_material_fase1.mjs — P0-CATALOGO-MESTRE-MATERIAIS (Fase 1 + 2A)
 *
 * Testes de LÓGICA PURA — NÃO requerem MongoDB:
 *   1. chaveCanonica: determinismo, ordem, commodity×engenharia, identidade do template
 *   2. Template engine: validação (obrigatório/identidade/enum/desconhecido), descrição
 *   3. Material schema (validateSync): required, enums, fabricante/modelo condicional
 *   4. CategoriaMaterial (Template): schema + definições reais (catalogoTemplates)
 *
 * Execução: node tests/catalogo/test_material_fase1.mjs  (ou: npm run test:catalogo)
 */

import assert from 'node:assert/strict'
import {
  derivarChaveCanonica, montarStringCanonica, normalizarTexto, CHAVE_CANONICA_ALGO,
} from '../../src/utils/catalogo/chaveCanonicaMaterial.js'
import {
  validarMaterialContraTemplate, gerarDescricao, atributosIdentidade,
} from '../../src/services/categoriaTemplateService.js'
import { Material } from '../../src/models/Material.js'
import { CategoriaMaterial } from '../../src/models/CategoriaMaterial.js'
import { TEMPLATES_CATEGORIA } from '../../src/seeds/catalogoTemplates.js'

let passos = 0
const ok = (msg) => { passos++; console.log(`  ✓ ${msg}`) }

// ─── 1. chaveCanonica ─────────────────────────────────────────────────────────
console.log('chaveCanonica')
{
  assert.equal(CHAVE_CANONICA_ALGO, 'v1')
  assert.equal(normalizarTexto('Cabo Flexível 10mm²'), 'cabo flexivel 10mm2')
  ok('normalizarTexto: acento/caixa/símbolos/NFKD (10mm²→10mm2)')

  const a = { classe: 'commodity', categoria: 'cabo', especificacoes: [
    { chave: 'bitola_mm2', valor: '10' }, { chave: 'tensao_isolamento_v', valor: '0,6/1kV' },
  ] }
  const b = { ...a, especificacoes: [...a.especificacoes].reverse() }
  assert.equal(derivarChaveCanonica(a), derivarChaveCanonica(b))
  ok('determinística e independente da ordem')

  // Identidade via template: atributo fora da lista de identidade NÃO altera a chave.
  const semCor = { classe: 'commodity', categoria: 'cabo', especificacoes: [{ chave: 'bitola_mm2', valor: '10' }] }
  const comCor = { ...semCor, especificacoes: [...semCor.especificacoes, { chave: 'cor', valor: 'preto' }] }
  const idAttrs = ['bitola_mm2']
  assert.equal(
    derivarChaveCanonica(semCor, { atributosIdentidade: idAttrs }),
    derivarChaveCanonica(comCor, { atributosIdentidade: idAttrs }),
  )
  ok('atributo não-identidade não muda a chave (template-aware)')

  // Sem lista de identidade (back-compat) considera todas as especificações.
  assert.notEqual(derivarChaveCanonica(semCor), derivarChaveCanonica(comCor))
  ok('back-compat: sem lista de identidade considera todas as especs')

  const eng1 = { classe: 'engenharia', categoria: 'disjuntor', fabricante: 'Schneider', modelo: 'C32', especificacoes: [] }
  const eng2 = { ...eng1, fabricante: 'Siemens' }
  assert.notEqual(derivarChaveCanonica(eng1), derivarChaveCanonica(eng2))
  assert.match(derivarChaveCanonica(eng1), /^[a-f0-9]{40}$/)
  ok('engenharia diferencia por fabricante/modelo; hash sha1 40 chars')
}

// ─── 2. Template engine ───────────────────────────────────────────────────────
console.log('Template engine')
{
  const tplCabo = TEMPLATES_CATEGORIA.find(t => t.chave === 'cabo')
  const tplDisj = TEMPLATES_CATEGORIA.find(t => t.chave === 'disjuntor')

  assert.deepEqual(
    atributosIdentidade(tplCabo).sort(),
    ['bitola_mm2', 'material_condutor', 'n_condutores', 'tensao_isolamento_v', 'tipo_cabo'].sort(),
  )
  ok('atributosIdentidade lista as chaves de identidade do template')

  const caboOk = { classe: 'commodity', categoria: 'cabo', especificacoes: [
    { chave: 'bitola_mm2', valor: '10' }, { chave: 'tensao_isolamento_v', valor: '0,6/1kV' },
    { chave: 'material_condutor', valor: 'cobre' }, { chave: 'tipo_cabo', valor: 'flexivel' },
    { chave: 'n_condutores', valor: '1' },
  ] }
  assert.equal(validarMaterialContraTemplate(caboOk, tplCabo).valido, true)
  ok('valida cabo completo')

  let r = validarMaterialContraTemplate({ classe: 'commodity', categoria: 'cabo', especificacoes: [
    { chave: 'bitola_mm2', valor: '10' },
  ] }, tplCabo)
  assert.equal(r.valido, false)
  assert.ok(r.erros.some(e => /tensao_isolamento_v/.test(e)))
  ok('rejeita obrigatório/identidade ausente')

  r = validarMaterialContraTemplate({ ...caboOk, especificacoes: [...caboOk.especificacoes, { chave: 'gambiarra', valor: 'x' }] }, tplCabo)
  assert.equal(r.valido, false)
  assert.ok(r.erros.some(e => /não pertence/.test(e)))
  ok('rejeita atributo desconhecido (vocabulário fechado)')

  r = validarMaterialContraTemplate({ ...caboOk, especificacoes: [
    { chave: 'bitola_mm2', valor: 'dez' }, { chave: 'tensao_isolamento_v', valor: '0,6/1kV' },
    { chave: 'material_condutor', valor: 'cobre' }, { chave: 'tipo_cabo', valor: 'flexivel' },
  ] }, tplCabo)
  assert.ok(r.erros.some(e => /numérico/.test(e)))
  ok('rejeita tipo numérico inválido')

  r = validarMaterialContraTemplate({ ...caboOk, especificacoes: [
    { chave: 'bitola_mm2', valor: '10' }, { chave: 'tensao_isolamento_v', valor: 'XPTO' },
    { chave: 'material_condutor', valor: 'cobre' }, { chave: 'tipo_cabo', valor: 'flexivel' },
  ] }, tplCabo)
  assert.ok(r.erros.some(e => /deve ser um de/.test(e)))
  ok('rejeita valor fora do enum')

  // Engenharia exige fabricante/modelo
  r = validarMaterialContraTemplate({ classe: 'engenharia', categoria: 'disjuntor', especificacoes: [
    { chave: 'corrente_nominal_a', valor: '32' }, { chave: 'curva', valor: 'C' }, { chave: 'polos', valor: '1' },
  ] }, tplDisj)
  assert.ok(r.erros.some(e => /fabricante/.test(e)))
  ok('engenharia sem fabricante/modelo é rejeitada')

  // Descrição automática
  const desc = gerarDescricao(tplDisj, {
    fabricante: 'Schneider', modelo: 'Acti9', especificacoes: [
      { chave: 'corrente_nominal_a', valor: '32' }, { chave: 'curva', valor: 'C' }, { chave: 'polos', valor: '1' },
    ],
  })
  assert.equal(desc, 'Disjuntor Schneider Acti9 32A Curva C 1P')
  ok('gerarDescricao preenche o padrão a partir de specs + fabricante/modelo')

  const descCabo = gerarDescricao(tplCabo, caboOk)
  assert.equal(descCabo, 'Cabo flexivel 10 mm² 0,6/1kV cobre')
  ok('gerarDescricao para commodity')
}

// ─── 3. Material schema (validateSync — sem banco) ────────────────────────────
console.log('Material schema')
{
  const comChave = (m) => { m.chaveCanonica = derivarChaveCanonica(m); return m }

  const valido = comChave(new Material({ descricao: 'Cabo X', categoria: 'Cabo', classe: 'commodity', unidade: 'm' }))
  assert.equal(valido.validateSync(), undefined)
  assert.equal(valido.categoria, 'cabo')
  assert.equal(valido.status, 'ativo')
  ok('commodity mínimo válido; categoria minúscula; status default ativo')

  const unidadeRuim = comChave(new Material({ descricao: 'X', categoria: 'cabo', classe: 'commodity', unidade: 'metro' }))
  assert.ok(unidadeRuim.validateSync()?.errors?.unidade)
  ok('rejeita unidade fora do enum canônico')

  const engSemFabr = comChave(new Material({ descricao: 'D', categoria: 'disjuntor', classe: 'engenharia', unidade: 'un' }))
  assert.ok(engSemFabr.validateSync()?.errors?.fabricante)
  ok('engenharia exige fabricante/modelo no schema')

  const statusRuim = comChave(new Material({ descricao: 'X', categoria: 'cabo', classe: 'commodity', unidade: 'm', status: 'rascunho' }))
  assert.ok(statusRuim.validateSync()?.errors?.status)
  ok('rejeita status "rascunho"')

  // Fallback do hook: deriva chave se não vier setada
  const semChave = new Material({ descricao: 'Cabo 6', categoria: 'cabo', classe: 'commodity', unidade: 'm' })
  await semChave.validate().catch(() => {})
  assert.match(semChave.chaveCanonica || '', /^[a-f0-9]{40}$/)
  ok('hook fallback deriva chaveCanonica quando ausente')
}

// ─── 4. CategoriaMaterial (Template) ──────────────────────────────────────────
console.log('CategoriaMaterial (Template)')
{
  const t = new CategoriaMaterial({ chave: 'Cabo', classe: 'commodity' })
  assert.equal(t.validateSync(), undefined)
  assert.equal(t.chave, 'cabo')
  ok('template mínimo válido; chave minúscula')

  assert.ok(new CategoriaMaterial({ chave: 'x' }).validateSync()?.errors?.classe)
  ok('exige classe')

  assert.ok(new CategoriaMaterial({ classe: 'commodity' }).validateSync()?.errors?.chave)
  ok('exige chave')

  // As 8 definições reais carregam no schema e têm identidade + descrição.
  const chaves = TEMPLATES_CATEGORIA.map(t => t.chave)
  assert.deepEqual(chaves, ['cabo', 'eletroduto', 'curva', 'luva', 'bucha', 'disjuntor', 'dps', 'dr'])
  for (const def of TEMPLATES_CATEGORIA) {
    const doc = new CategoriaMaterial(def)
    assert.equal(doc.validateSync(), undefined, `template ${def.chave} inválido`)
    assert.ok(def.descricaoTemplate, `template ${def.chave} sem descricaoTemplate`)
    assert.ok(atributosIdentidade(def).length > 0, `template ${def.chave} sem atributo de identidade`)
    // Invariante: todo atributo de identidade é obrigatório.
    for (const at of def.atributos.filter(x => x.identidade)) {
      assert.equal(at.obrigatorio, true, `${def.chave}.${at.chave}: identidade deve ser obrigatória`)
    }
  }
  ok('as 8 definições reais validam no schema (identidade + descrição)')
}

console.log(`\n✅ ${passos} grupos de asserções passaram (Fase 1 + 2A — lógica pura, sem MongoDB).`)
process.exit(0)
