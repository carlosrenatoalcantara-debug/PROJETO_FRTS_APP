import { ELECTRICAL_LIMITS } from '../constants/limits.js';

export function calculateBessSizing(bessData, engenharia) {
  const {
    banco_baterias_kwh,
    profundidade_descarga,
    autonomia_horas,
    potencia_saida_kw,
    tensao_banco,
    eficiencia_sistema
  } = bessData;

  const { temperatura_minima_projeto, temperatura_maxima_projeto } = engenharia;

  const alertas = [];
  const validacoes = {
    tensao: true,
    profundidade_descarga: true,
    autonomia: true,
    corrente: true
  };

  // Calculate useful capacity (considering depth of discharge)
  const capacidade_util_kwh = banco_baterias_kwh * profundidade_descarga;

  // Validate capacity matches autonomy requirement
  const capacidade_requerida_kwh = potencia_saida_kw * autonomia_horas;
  let autonomia_estimada_h = autonomia_horas;

  if (capacidade_util_kwh < capacidade_requerida_kwh * 0.95) {
    validacoes.autonomia = false;
    alertas.push({
      nivel: 'CRITICO',
      code: 'ERR_BESS_INSUFFICIENT_CAPACITY',
      mensagem: `Useful capacity (${capacidade_util_kwh.toFixed(2)} kWh) insufficient for ${autonomia_horas}h @ ${potencia_saida_kw} kW`
    });
  }

  // Validate voltage
  let tensao_ok = true;
  if (tensao_banco < ELECTRICAL_LIMITS.BESS_MIN_DC_VOLTAGE || tensao_banco > ELECTRICAL_LIMITS.BESS_MAX_DC_VOLTAGE) {
    validacoes.tensao = false;
    tensao_ok = false;
    alertas.push({
      nivel: 'CRITICO',
      code: 'ERR_BESS_VOLTAGE_OUT_OF_RANGE',
      mensagem: `Bank voltage ${tensao_banco}V outside safe range [${ELECTRICAL_LIMITS.BESS_MIN_DC_VOLTAGE}, ${ELECTRICAL_LIMITS.BESS_MAX_DC_VOLTAGE}]V`
    });
  }

  // Calculate nominal current
  const corrente_nominal_a = potencia_saida_kw * 1000 / tensao_banco;

  // Validate current
  let corrente_ok = true;
  if (corrente_nominal_a > ELECTRICAL_LIMITS.CURRENT_MAX_SAFE_DC) {
    validacoes.corrente = false;
    corrente_ok = false;
    alertas.push({
      nivel: 'CRITICO',
      code: 'ERR_BESS_OVERCURRENT',
      mensagem: `Discharge current ${corrente_nominal_a.toFixed(2)}A exceeds safe limit ${ELECTRICAL_LIMITS.CURRENT_MAX_SAFE_DC}A`
    });
  }

  // Temperature derating hooks (future enhancement point)
  let eficiencia_derated = eficiencia_sistema;
  if (temperatura_maxima_projeto > ELECTRICAL_LIMITS.TEMPERATURE_DERATING_THRESHOLD) {
    const derating_factor = 1.0 - (temperatura_maxima_projeto - ELECTRICAL_LIMITS.TEMPERATURE_DERATING_THRESHOLD) * 0.01;
    eficiencia_derated = eficiencia_sistema * derating_factor;

    if (derating_factor < 0.95) {
      alertas.push({
        nivel: 'ADVERTENCIA',
        code: 'WARN_BESS_TEMPERATURE_DERATING',
        mensagem: `High temperature (${temperatura_maxima_projeto}°C) reduces efficiency to ${eficiencia_derated.toFixed(3)}`
      });
    }
  }

  // Calculate global efficiency
  const eficiencia_global = eficiencia_derated;

  // Calculate depth of discharge realization
  const profundidade_descarga_real = capacidade_util_kwh / banco_baterias_kwh;

  // Determine approval
  const aprovado = validacoes.tensao && validacoes.corrente && validacoes.autonomia;

  // Score calculation (similar to FV model)
  let score_eletrico = 1.0;
  if (!validacoes.tensao) score_eletrico *= 0.1;
  if (!validacoes.corrente) score_eletrico *= 0.2;
  if (!validacoes.autonomia) score_eletrico *= 0.3;
  score_eletrico = Math.max(0, Math.min(1, score_eletrico));

  return Object.freeze({
    capacidade_util_kwh,
    capacidade_nominal_kwh: banco_baterias_kwh,
    corrente_nominal_a,
    autonomia_estimada_h,
    profundidade_descarga_real,
    eficiencia_global,
    aprovado,
    score_eletrico,
    alertas: Object.freeze(alertas),
    validacoes: Object.freeze(validacoes),
    status: aprovado ? 'OTIMIZADO' : 'REJEITADO'
  });
}
