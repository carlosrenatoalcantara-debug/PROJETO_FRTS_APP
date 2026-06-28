/**
 * categoriaTemplateService.js — P0-CATALOGO-MESTRE-MATERIAIS (Fase 2A)
 *
 * Motor do Template de Categoria. Funções PURAS (recebem o template como argumento)
 * → testáveis sem banco. O carregamento do template (I/O) fica no controller.
 *
 * Garante: cadastro completo (obrigatórios), vocabulário fechado (sem atributos
 * desconhecidos), identidade consistente (chaveCanonica sempre dos mesmos atributos)
 * e descrição padronizada.
 */

import { CategoriaMaterial } from '../models/CategoriaMaterial.js'

/** Lista de chaves de atributos que compõem a identidade (chaveCanonica). */
export function atributosIdentidade(template) {
  return (template?.atributos || []).filter(a => a.identidade).map(a => a.chave)
}

/** Mapa chave→valor das especificações do material. */
function mapaEspecs(material) {
  const m = {}
  for (const e of material?.especificacoes || []) {
    if (e?.chave != null) m[String(e.chave).trim()] = e.valor
  }
  return m
}

/**
 * Gera a descrição padronizada a partir do `descricaoTemplate`.
 * Tokens {chave} são resolvidos das especificações e de {fabricante}/{modelo}.
 * Tokens sem valor viram vazio; espaços excedentes são colapsados.
 */
export function gerarDescricao(template, material) {
  if (!template?.descricaoTemplate) return material?.descricao || ''
  const valores = { ...mapaEspecs(material), fabricante: material?.fabricante, modelo: material?.modelo }
  return template.descricaoTemplate
    .replace(/\{(\w+)\}/g, (_, k) => (valores[k] != null ? String(valores[k]) : ''))
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Valida um material contra o template da sua categoria.
 * @returns {{ valido:boolean, erros:string[] }}
 */
export function validarMaterialContraTemplate(material, template) {
  const erros = []
  if (!template) return { valido: false, erros: ['Categoria sem template cadastrado'] }

  // Classe coerente com a categoria.
  if (material.classe && material.classe !== template.classe) {
    erros.push(`classe "${material.classe}" diverge do template da categoria ("${template.classe}")`)
  }
  // Engenharia exige fabricante/modelo (campos próprios do Material).
  if (template.classe === 'engenharia') {
    if (!material.fabricante?.toString().trim()) erros.push('fabricante é obrigatório (categoria de engenharia)')
    if (!material.modelo?.toString().trim()) erros.push('modelo é obrigatório (categoria de engenharia)')
  }

  const defs = new Map((template.atributos || []).map(a => [a.chave, a]))
  const specs = mapaEspecs(material)

  // Nenhum atributo desconhecido (vocabulário fechado).
  for (const chave of Object.keys(specs)) {
    if (!defs.has(chave)) erros.push(`atributo "${chave}" não pertence à categoria "${template.chave}"`)
  }

  // Obrigatórios + identidade presentes; tipo/enum válidos.
  for (const a of template.atributos || []) {
    const bruto = specs[a.chave]
    const ausente = bruto == null || String(bruto).trim() === ''
    if ((a.obrigatorio || a.identidade) && ausente) {
      erros.push(`atributo "${a.chave}" é ${a.identidade ? 'de identidade' : 'obrigatório'} e está ausente`)
      continue
    }
    if (ausente) continue
    const valor = String(bruto).trim()
    if ((a.tipo === 'number' || a.tipo === 'int') && Number.isNaN(Number(valor))) {
      erros.push(`atributo "${a.chave}" deve ser numérico`)
    }
    if (a.tipo === 'int' && Number.isInteger(Number(valor)) === false) {
      erros.push(`atributo "${a.chave}" deve ser inteiro`)
    }
    if (a.tipo === 'enum' && a.enumValores?.length && !a.enumValores.includes(valor)) {
      erros.push(`atributo "${a.chave}" deve ser um de: ${a.enumValores.join(', ')}`)
    }
  }

  return { valido: erros.length === 0, erros }
}

/** Carrega o template da categoria (I/O). null se não existir. */
export function carregarTemplate(empresaId, categoria) {
  return CategoriaMaterial.findOne({ empresa_id: empresaId ?? null, chave: String(categoria || '').trim().toLowerCase() }).lean()
}
