// backend/src/electrical/constants/limits.js

export const ELECTRICAL_LIMITS = Object.freeze({
  // PV String Limits
  TEMPERATURE_STC:     25,
  SAFETY_FACTOR_ISC:   1.25,
  VOLTAGE_MAX_SAFE_DC: 1100,
  CURRENT_MAX_SAFE_DC: 50,
  ALLOWED_CONCESSIONARIAS: Object.freeze([
    'neoenergia_cosern',
    'enel_ceara',
    'neoenergia_pernambuco'
  ]),

  // BESS Limits
  SOC_MIN:                    0.0,
  SOC_MAX:                    1.0,
  BESS_MAX_DC_VOLTAGE:        960,
  BESS_MIN_DC_VOLTAGE:        400,
  TEMPERATURE_DERATING_THRESHOLD: 45,
  MAX_PARALLEL_BANKS:         4
})
