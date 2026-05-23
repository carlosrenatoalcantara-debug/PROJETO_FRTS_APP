/**
 * validator.js — S2.9 ETL SolarMarket
 *
 * Responsabilidade: validar dados do SolarMarket ANTES de entrar no pipeline
 * de normalização e persistência.
 *
 * Validações:
 *  - Rejeita itens com nome/modelo placeholder ("Produto 1", "Item", "Kit Solar")
 *  - Rejeita fabricante muito curto (< 2 chars) ou ausente
 *  - Rejeita modelo muito curto (< 2 chars) ou ausente
 *  - Sinaliza preços suspeitos (zero, negativo, absurdamente alto)
 *  - Sinaliza equipamentos sem tipo identificado
 *
 * Dois níveis de resultado:
 *  - 'rejeitar' : item não deve entrar no pipeline
 *  - 'alertar'  : item entra com avisos (pode precisar de revisão manual)
 *  - 'ok'       : item válido
 */

// ─── Listas de rejeição ────────────────────────────────────────────────────

// Nomes/modelos genéricos que não têm valor no catálogo
const PLACEHOLDERS = [
  /^(produto|item|kit|kit solar|equipamento|painel|inversor|estrutura|acess[oó]rio)\s*\d*$/i,
  /^(sem nome|untitled|test|teste|exemplo|sample|demo|default|n\.?a\.?|null|undefined)$/i,
  /^\d+$/,  // só números
  /^-+$/,   // só traços
  /^\.+$/,  // só pontos
]

// Fabricantes suspeitos (muito genéricos ou placeholders)
const FABRICANTES_SUSPEITOS = [
  /^(generic|generica|sem marca|sem fabricante|desconhecido|outros?|other|n\.?a\.?)$/i,
]

// ─── Limites de preço (R$) ────────────────────────────────────────────────

const PRECO_MIN_MODULO    =    100   // R$ — abaixo disso é suspeito para módulo
const PRECO_MAX_MODULO    = 10_000  // R$ — acima é suspeito para módulo
const PRECO_MIN_INVERSOR  =    500
const PRECO_MAX_INVERSOR  = 150_000
const PRECO_MAX_ESTRUTURA = 20_000

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Verifica se um texto é um placeholder inútil.
 *
 * @param {string|null} texto
 * @returns {boolean}
 */
function ehPlaceholder(texto) {
  if (!texto || texto.trim().length < 2) return true
  return PLACEHOLDERS.some(re => re.test(texto.trim()))
}

/**
 * Verifica se o fabricante é suspeito.
 *
 * @param {string|null} fabricante
 * @returns {boolean}
 */
function fabricanteSuspeito(fabricante) {
  if (!fabricante || fabricante.trim().length < 2) return true
  return FABRICANTES_SUSPEITOS.some(re => re.test(fabricante.trim()))
}

// ─── Validação de item bruto (pré-normalização) ───────────────────────────

/**
 * Valida um item bruto do extractor (antes de normalizar).
 * Chamada no início do pipeline para filtrar ruído.
 *
 * @param {object} itemBruto  Item do extractor
 * @returns {ValidationResult}
 *
 * @typedef {object} ValidationResult
 * @property {'ok'|'alertar'|'rejeitar'} nivel
 * @property {string[]} erros    Razões de rejeição (fatal)
 * @property {string[]} avisos   Avisos não-fatais
 */
export function validarItemBruto(itemBruto) {
  const erros  = []
  const avisos = []

  // ── Nome/identificação mínima ────────────────────────────────────────────
  const temNome   = !ehPlaceholder(itemBruto.nome)
  const temModelo = !ehPlaceholder(itemBruto.modelo)

  if (!temNome && !temModelo) {
    erros.push('sem nome e sem modelo identificável')
  } else if (ehPlaceholder(itemBruto.nome) && !temModelo) {
    erros.push(`nome placeholder: "${itemBruto.nome}"`)
  }

  // ── Fabricante ───────────────────────────────────────────────────────────
  if (fabricanteSuspeito(itemBruto.marca)) {
    if (!itemBruto.nome) {
      erros.push('fabricante ausente/suspeito e sem nome para inferir')
    } else {
      avisos.push(`fabricante ausente — será inferido do nome: "${itemBruto.nome}"`)
    }
  }

  // ── Preço ────────────────────────────────────────────────────────────────
  const preco = itemBruto.preco_unitario
  if (preco !== null && preco !== undefined) {
    if (preco < 0) {
      erros.push(`preço negativo: R$${preco}`)
    } else if (preco === 0) {
      avisos.push('preço zero — será ignorado no catálogo')
    } else if (preco > 500_000) {
      avisos.push(`preço muito alto: R$${preco} — verificar se é unitário ou total`)
    }
  }

  return {
    nivel: erros.length > 0 ? 'rejeitar' : avisos.length > 0 ? 'alertar' : 'ok',
    erros,
    avisos,
  }
}

/**
 * Valida o resultado normalizado (após normalizer.normalizar()).
 * Última barreira antes do matcher/deduplicator.
 *
 * @param {object} normalizado  Resultado de normalizer.normalizar()
 * @returns {ValidationResult}
 */
export function validarNormalizado(normalizado) {
  const { equipamento, meta } = normalizado
  const erros  = []
  const avisos = []

  // ── Campos obrigatórios ──────────────────────────────────────────────────
  if (!equipamento.fabricante || equipamento.fabricante.trim().length < 2) {
    erros.push('fabricante ausente ou muito curto após normalização')
  }
  if (!equipamento.modelo || equipamento.modelo.trim().length < 2) {
    erros.push('modelo ausente ou muito curto após normalização')
  }
  if (!equipamento.tipo) {
    avisos.push('tipo não identificado — será necessária revisão manual')
  }

  // ── Hash único ────────────────────────────────────────────────────────────
  if (!meta.hash_unico || meta.hash_unico.length < 8) {
    erros.push('hash_unico inválido — impossível deduplicar')
  }

  // ── Preço por tipo (se disponível) ────────────────────────────────────────
  const preco = equipamento.preco_sugerido
  if (preco !== null && preco !== undefined && preco > 0) {
    const tipo = equipamento.tipo

    if (tipo === 'modulo' && (preco < PRECO_MIN_MODULO || preco > PRECO_MAX_MODULO)) {
      avisos.push(
        `preço R$${preco} fora da faixa esperada para módulo (R$${PRECO_MIN_MODULO}–R$${PRECO_MAX_MODULO})`
      )
    }
    if (tipo === 'inversor' && (preco < PRECO_MIN_INVERSOR || preco > PRECO_MAX_INVERSOR)) {
      avisos.push(
        `preço R$${preco} fora da faixa esperada para inversor (R$${PRECO_MIN_INVERSOR}–R$${PRECO_MAX_INVERSOR})`
      )
    }
    if (tipo === 'estrutura' && preco > PRECO_MAX_ESTRUTURA) {
      avisos.push(`preço R$${preco} alto para estrutura — verificar se é total do kit`)
    }
  }

  // ── Potência coerente ─────────────────────────────────────────────────────
  const specs = equipamento.especificacoes || {}
  if (equipamento.tipo === 'modulo' && specs.potencia_w) {
    if (specs.potencia_w < 10 || specs.potencia_w > 1000) {
      avisos.push(`potência ${specs.potencia_w}W fora da faixa normal para módulo (10–1000W)`)
    }
  }
  if (equipamento.tipo === 'inversor' && specs.potencia_kw) {
    if (specs.potencia_kw < 0.25 || specs.potencia_kw > 1000) {
      avisos.push(`potência ${specs.potencia_kw}kW fora da faixa normal para inversor`)
    }
  }

  return {
    nivel: erros.length > 0 ? 'rejeitar' : avisos.length > 0 ? 'alertar' : 'ok',
    erros,
    avisos,
  }
}

/**
 * Filtra e classifica um lote de itens brutos.
 * Retorna os aprovados + os rejeitados com motivo.
 *
 * @param {Array} itensBrutos
 * @returns {{ aprovados: Array, rejeitados: Array }}
 */
export function filtrarLote(itensBrutos) {
  const aprovados  = []
  const rejeitados = []

  for (const item of itensBrutos) {
    const validacao = validarItemBruto(item)
    if (validacao.nivel === 'rejeitar') {
      rejeitados.push({
        item,
        motivo: validacao.erros.join(' | '),
        avisos: validacao.avisos,
      })
    } else {
      aprovados.push({
        item,
        avisos: validacao.avisos,
      })
    }
  }

  return { aprovados, rejeitados }
}
