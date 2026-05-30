const parseBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback
  const v = String(value).trim().toLowerCase()
  return ['1', 'true', 'yes', 'on'].includes(v)
}

export const FEATURE_FLAGS = Object.freeze({
  ENABLE_LEGACY_INVERSORES: parseBool(process.env.ENABLE_LEGACY_INVERSORES, false),
  ENABLE_LEGACY_MODULOS: parseBool(process.env.ENABLE_LEGACY_MODULOS, false),
  ENABLE_LEGACY_EV: parseBool(process.env.ENABLE_LEGACY_EV, false),
})

export function podeUsarMemoryStorage() {
  return FEATURE_FLAGS.ENABLE_LEGACY_INVERSORES || FEATURE_FLAGS.ENABLE_LEGACY_MODULOS || FEATURE_FLAGS.ENABLE_LEGACY_EV
}

export function auditarFallbackPayload({ arquivo, funcao, origem, motivo }) {
  return {
    acao: 'AUDITORIA_FALLBACK',
    modulo: 'catalogo',
    arquivo,
    funcao,
    origem,
    motivo,
    flags: FEATURE_FLAGS,
    em: new Date().toISOString(),
  }
}
