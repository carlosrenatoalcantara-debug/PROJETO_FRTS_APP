/**
 * test_material_fase1.mjs — P0-CATALOGO-MESTRE-MATERIAIS (Fase 1 + 2B)
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

  const a = { classe: 'commodity', categoria: 'cabos', especificacoes: [
    { chave: 'bitola_mm2', valor: '10' }, { chave: 'tensao_isolamento_v', valor: '0,6/1kV' },
  ] }
  const b = { ...a, especificacoes: [...a.especificacoes].reverse() }
  assert.equal(derivarChaveCanonica(a), derivarChaveCanonica(b))
  ok('determinística e independente da ordem')

  // Identidade via template: atributo fora da lista de identidade NÃO altera a chave.
  const semCor = { classe: 'commodity', categoria: 'cabos', especificacoes: [{ chave: 'bitola_mm2', valor: '10' }] }
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

  const eng1 = { classe: 'engenharia', categoria: 'protecao_eletrica', fabricante: 'Schneider', modelo: 'C32', especificacoes: [] }
  const eng2 = { ...eng1, fabricante: 'Siemens' }
  assert.notEqual(derivarChaveCanonica(eng1), derivarChaveCanonica(eng2))
  assert.match(derivarChaveCanonica(eng1), /^[a-f0-9]{40}$/)
  ok('engenharia diferencia por fabricante/modelo; hash sha1 40 chars')
}

// ─── 2. Template engine ───────────────────────────────────────────────────────
console.log('Template engine')
{
  const tplCabos = TEMPLATES_CATEGORIA.find(t => t.chave === 'cabos')
  const tplProt  = TEMPLATES_CATEGORIA.find(t => t.chave === 'protecao_eletrica')

  assert.deepEqual(
    atributosIdentidade(tplCabos).sort(),
    ['bitola_mm2', 'material_condutor', 'n_condutores', 'tensao_isolamento_v'].sort(),
  )
  ok('atributosIdentidade lista as chaves de identidade do template cabos')

  const caboOk = { classe: 'commodity', categoria: 'cabos', especificacoes: [
    { chave: 'bitola_mm2', valor: '10' }, { chave: 'tensao_isolamento_v', valor: '0,6/1kV' },
    { chave: 'material_condutor', valor: 'cobre' }, { chave: 'n_condutores', valor: '1' },
  ] }
  assert.equal(validarMaterialContraTemplate(caboOk, tplCabos).valido, true)
  ok('valida cabo completo')

  let r = validarMaterialContraTemplate({ classe: 'commodity', categoria: 'cabos', especificacoes: [
    { chave: 'bitola_mm2', valor: '10' },
  ] }, tplCabos)
  assert.equal(r.valido, false)
  assert.ok(r.erros.some(e => /tensao_isolamento_v/.test(e)))
  ok('rejeita identidade ausente (tensao_isolamento_v)')

  r = validarMaterialContraTemplate({ ...caboOk, especificacoes: [...caboOk.especificacoes, { chave: 'gambiarra', valor: 'x' }] }, tplCabos)
  assert.equal(r.valido, false)
  assert.ok(r.erros.some(e => /não pertence/.test(e)))
  ok('rejeita atributo desconhecido (vocabulário fechado)')

  r = validarMaterialContraTemplate({ ...caboOk, especificacoes: [
    { chave: 'bitola_mm2', valor: 'dez' }, { chave: 'tensao_isolamento_v', valor: '0,6/1kV' },
    { chave: 'material_condutor', valor: 'cobre' }, { chave: 'n_condutores', valor: '1' },
  ] }, tplCabos)
  assert.ok(r.erros.some(e => /numérico/.test(e)))
  ok('rejeita tipo numérico inválido')

  r = validarMaterialContraTemplate({ ...caboOk, especificacoes: [
    { chave: 'bitola_mm2', valor: '10' }, { chave: 'tensao_isolamento_v', valor: 'XPTO' },
    { chave: 'material_condutor', valor: 'cobre' }, { chave: 'n_condutores', valor: '1' },
  ] }, tplCabos)
  assert.ok(r.erros.some(e => /deve ser um de/.test(e)))
  ok('rejeita valor fora do enum')

  // protecao_eletrica: commodity com atributo tipo (identidade)
  const protOk = { classe: 'commodity', categoria: 'protecao_eletrica', especificacoes: [
    { chave: 'tipo', valor: 'Disjuntor termomagnético' },
  ] }
  assert.equal(validarMaterialContraTemplate(protOk, tplProt).valido, true)
  ok('valida protecao_eletrica completo')

  r = validarMaterialContraTemplate({ classe: 'commodity', categoria: 'protecao_eletrica', especificacoes: [] }, tplProt)
  assert.equal(r.valido, false)
  assert.ok(r.erros.some(e => /tipo/.test(e)))
  ok('rejeita protecao_eletrica sem atributo tipo')

  // Descrição automática cabos
  const descCabo = gerarDescricao(tplCabos, caboOk)
  assert.equal(descCabo, 'Cabo 10mm² 1C 0,6/1kV cobre')
  ok('gerarDescricao para cabos')

  // Descrição automática protecao_eletrica
  const descProt = gerarDescricao(tplProt, protOk)
  assert.equal(descProt, 'Disjuntor termomagnético')
  ok('gerarDescricao para protecao_eletrica ({tipo})')
}

// ─── 3. Material schema (validateSync — sem banco) ────────────────────────────
console.log('Material schema')
{
  const comChave = (m) => { m.chaveCanonica = derivarChaveCanonica(m); return m }

  const valido = comChave(new Material({ descricao: 'Cabo X', categoria: 'Cabos', classe: 'commodity', unidade: 'm' }))
  assert.equal(valido.validateSync(), undefined)
  assert.equal(valido.categoria, 'cabos')
  assert.equal(valido.status, 'ativo')
  ok('commodity mínimo válido; categoria minúscula; status default ativo')

  const unidadeRuim = comChave(new Material({ descricao: 'X', categoria: 'cabos', classe: 'commodity', unidade: 'metro' }))
  assert.ok(unidadeRuim.validateSync()?.errors?.unidade)
  ok('rejeita unidade fora do enum canônico')

  const engSemFabr = comChave(new Material({ descricao: 'D', categoria: 'protecao_eletrica', classe: 'engenharia', unidade: 'un' }))
  assert.ok(engSemFabr.validateSync()?.errors?.fabricante)
  ok('engenharia exige fabricante/modelo no schema')

  const statusRuim = comChave(new Material({ descricao: 'X', categoria: 'cabos', classe: 'commodity', unidade: 'm', status: 'rascunho' }))
  assert.ok(statusRuim.validateSync()?.errors?.status)
  ok('rejeita status "rascunho"')

  // Fallback do hook: deriva chave se não vier setada
  const semChave = new Material({ descricao: 'Cabo 6', categoria: 'cabos', classe: 'commodity', unidade: 'm' })
  await semChave.validate().catch(() => {})
  assert.match(semChave.chaveCanonica || '', /^[a-f0-9]{40}$/)
  ok('hook fallback deriva chaveCanonica quando ausente')
}

// ─── 4. CategoriaMaterial (Template) ──────────────────────────────────────────
console.log('CategoriaMaterial (Template)')
{
  const t = new CategoriaMaterial({ chave: 'Cabos', classe: 'commodity' })
  assert.equal(t.validateSync(), undefined)
  assert.equal(t.chave, 'cabos')
  ok('template mínimo válido; chave minúscula')

  assert.ok(new CategoriaMaterial({ chave: 'x' }).validateSync()?.errors?.classe)
  ok('exige classe')

  assert.ok(new CategoriaMaterial({ classe: 'commodity' }).validateSync()?.errors?.chave)
  ok('exige chave')

  // As 5 definições reais carregam no schema e têm identidade + descrição.
  const chaves = TEMPLATES_CATEGORIA.map(t => t.chave)
  assert.deepEqual(chaves, ['cabos', 'protecao_eletrica', 'quadros_barramentos', 'conexoes_infraestrutura', 'fixacao'])
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
  ok('as 5 definições reais validam no schema (identidade + descrição)')
}

console.log(`\n✅ ${passos} grupos de asserções passaram (Fase 1 + 2B — lógica pura, sem MongoDB).`)
process.exit(0)
