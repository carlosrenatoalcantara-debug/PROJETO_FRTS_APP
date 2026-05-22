import { StructuredEngineError, ErrorSeverity, ErrorCategory } from '../../utils/errors.js';
import { deepFreezeSafe } from '../../utils/freeze.js';

export function validateBessProjectDTO(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new StructuredEngineError({
      code: 'BESS_DTO_ROOT_INVALID',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.DTO_VALIDATION,
      message: 'BESS project payload must be a non-null plain object',
      context: { received: typeof payload, isArray: Array.isArray(payload) }
    });
  }

  const { banco_baterias_kwh, profundidade_descarga, autonomia_horas, potencia_saida_kw, tensao_banco, eficiencia_sistema, temperatura_minima_projeto, temperatura_maxima_projeto } = payload;

  // 1. banco_baterias_kwh — nominal capacity
  if (!Number.isFinite(banco_baterias_kwh) || banco_baterias_kwh <= 0) {
    errors.push({
      field: 'banco_baterias_kwh',
      issue: 'must be finite positive number',
      received: banco_baterias_kwh
    });
  }

  // 2. profundidade_descarga — depth of discharge [0, 1]
  if (!Number.isFinite(profundidade_descarga) || profundidade_descarga <= 0 || profundidade_descarga > 1) {
    errors.push({
      field: 'profundidade_descarga',
      issue: 'must be finite number in (0, 1]',
      received: profundidade_descarga
    });
  }

  // 3. autonomia_horas — autonomy in hours
  if (!Number.isFinite(autonomia_horas) || autonomia_horas <= 0) {
    errors.push({
      field: 'autonomia_horas',
      issue: 'must be finite positive number',
      received: autonomia_horas
    });
  }

  // 4. potencia_saida_kw — discharge power
  if (!Number.isFinite(potencia_saida_kw) || potencia_saida_kw <= 0) {
    errors.push({
      field: 'potencia_saida_kw',
      issue: 'must be finite positive number',
      received: potencia_saida_kw
    });
  }

  // 5. tensao_banco — bank voltage
  if (!Number.isFinite(tensao_banco) || tensao_banco <= 0) {
    errors.push({
      field: 'tensao_banco',
      issue: 'must be finite positive number',
      received: tensao_banco
    });
  }

  // 6. eficiencia_sistema — system efficiency [0, 1]
  if (!Number.isFinite(eficiencia_sistema) || eficiencia_sistema <= 0 || eficiencia_sistema > 1) {
    errors.push({
      field: 'eficiencia_sistema',
      issue: 'must be finite number in (0, 1]',
      received: eficiencia_sistema
    });
  }

  // 7. temperatura_minima_projeto — min project temperature
  if (!Number.isFinite(temperatura_minima_projeto)) {
    errors.push({
      field: 'temperatura_minima_projeto',
      issue: 'must be finite number',
      received: temperatura_minima_projeto
    });
  }

  // 8. temperatura_maxima_projeto — max project temperature
  if (!Number.isFinite(temperatura_maxima_projeto)) {
    errors.push({
      field: 'temperatura_maxima_projeto',
      issue: 'must be finite number',
      received: temperatura_maxima_projeto
    });
  }

  // 9. Temperature order constraint
  if (Number.isFinite(temperatura_minima_projeto) && Number.isFinite(temperatura_maxima_projeto)) {
    if (temperatura_minima_projeto > temperatura_maxima_projeto) {
      errors.push({
        field: 'temperatura',
        issue: 'minima must be <= maxima',
        received: { min: temperatura_minima_projeto, max: temperatura_maxima_projeto }
      });
    }
  }

  if (errors.length > 0) {
    throw new StructuredEngineError({
      code: 'BESS_DTO_VALIDATION_FAILED',
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.DTO_VALIDATION,
      message: `BESS validation failed: ${errors.length} field(s) invalid`,
      context: { failures: errors }
    });
  }

  const cleanData = {
    banco_baterias_kwh: Number(banco_baterias_kwh),
    profundidade_descarga: Number(profundidade_descarga),
    autonomia_horas: Number(autonomia_horas),
    potencia_saida_kw: Number(potencia_saida_kw),
    tensao_banco: Number(tensao_banco),
    eficiencia_sistema: Number(eficiencia_sistema),
    temperatura_minima_projeto: Number(temperatura_minima_projeto),
    temperatura_maxima_projeto: Number(temperatura_maxima_projeto)
  };

  return deepFreezeSafe({
    valido: true,
    data: cleanData,
    ...cleanData
  });
}

export { validateBessProjectDTO as createBessProjectDTO };
