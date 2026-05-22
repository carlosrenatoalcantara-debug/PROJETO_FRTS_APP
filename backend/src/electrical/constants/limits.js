// backend/src/electrical/constants/limits.js

export const ELECTRICAL_LIMITS = Object.freeze({
  TEMPERATURE_STC:     25,
  SAFETY_FACTOR_ISC:   1.25,
  VOLTAGE_MAX_SAFE_DC: 1100,
  CURRENT_MAX_SAFE_DC: 50,
  ALLOWED_CONCESSIONARIAS: Object.freeze([
    'neoenergia_cosern',
    'enel_ceara',
    'neoenergia_pernambuco'
  ])
})
