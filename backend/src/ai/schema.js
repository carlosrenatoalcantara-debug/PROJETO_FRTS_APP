/**
 * schema.js — AI-ARCH-01 (FASE 4)
 *
 * Schema interno CANÔNICO retornado por TODO adapter de IA. Nenhum provider pode
 * vazar estrutura própria para o restante do sistema: todos normalizam para isto.
 *
 *   { fabricante, modelo, tipo, especificacoes, _meta }
 *
 * `especificacoes` é livre (Mixed no Equipamento), mas as chaves técnicas seguem o
 * vocabulário já usado pelo catálogo (potencia_kw, n_mppts, ...).
 *
 * PURO: sem I/O, sem dependências. Importável por backend e testes.
 */

/** Campos de topo do schema interno. */
export const CAMPOS_TOPO = ['fabricante', 'modelo', 'tipo', 'especificacoes']

/**
 * Cria um objeto no schema interno a partir de um parcial, garantindo as chaves.
 * @param {Object} parcial
 * @returns {{fabricante:?string, modelo:?string, tipo:?string, especificacoes:Object, _meta:Object}}
 */
export function criarSchemaInterno(parcial = {}) {
  const esp = (parcial.especificacoes && typeof parcial.especificacoes === 'object' && !Array.isArray(parcial.especificacoes))
    ? parcial.especificacoes
    : {}
  return {
    fabricante: _strOuNull(parcial.fabricante),
    modelo: _strOuNull(parcial.modelo),
    tipo: _strOuNull(parcial.tipo),
    especificacoes: esp,
    _meta: parcial._meta && typeof parcial._meta === 'object' ? parcial._meta : {},
  }
}

/**
 * Valida que um objeto está no schema interno (forma, não conteúdo).
 * @returns {{valido:boolean, erros:string[]}}
 */
export function validarSchemaInterno(obj) {
  const erros = []
  if (!obj || typeof obj !== 'object') {
    return { valido: false, erros: ['objeto ausente'] }
  }
  if (!('fabricante' in obj)) erros.push('falta fabricante')
  if (!('modelo' in obj)) erros.push('falta modelo')
  if (!('tipo' in obj)) erros.push('falta tipo')
  if (!('especificacoes' in obj) || typeof obj.especificacoes !== 'object' || Array.isArray(obj.especificacoes)) {
    erros.push('especificacoes deve ser objeto')
  }
  return { valido: erros.length === 0, erros }
}

function _strOuNull(v) {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}
