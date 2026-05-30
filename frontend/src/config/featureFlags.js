const parseBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback
  const v = String(value).trim().toLowerCase()
  return ['1', 'true', 'yes', 'on'].includes(v)
}

export const FEATURE_FLAGS = Object.freeze({
  ENABLE_LEGACY_INVERSORES: parseBool(import.meta.env.VITE_ENABLE_LEGACY_INVERSORES, false),
  ENABLE_LEGACY_MODULOS: parseBool(import.meta.env.VITE_ENABLE_LEGACY_MODULOS, false),
  ENABLE_LEGACY_EV: parseBool(import.meta.env.VITE_ENABLE_LEGACY_EV, false),
})
