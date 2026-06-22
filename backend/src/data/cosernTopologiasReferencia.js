/**
 * cosernTopologiasReferencia.js — P1-COSERN-REFERENCE-TOPOLOGIES-01
 *
 * Biblioteca técnica de TOPOLOGIAS DE REFERÊNCIA para classes de entrada COSERN
 * (M2, M3, T5, T6, T7, T8) × 3 arquiteturas (string / micro / otimizador).
 *
 * ⚠️ HONESTIDADE: os LIMITES de classe abaixo são valores de REFERÊNCIA, baseados
 * em padrões comuns de entrada BT brasileiros. NÃO substituem a Norma Técnica
 * COSERN — confirmar disjuntor/cabo/caixa/aterramento com a NT vigente antes do
 * projeto executivo. As TOPOLOGIAS são SUGESTÕES iniciais editáveis (pré-config),
 * não dimensionamento final. Ancoradas em inversores reais do catálogo, respeitando
 * Voc < Vmáx, Isc por MPPT < corrente máx e oversizing 0,99–1,20×.
 *
 * Módulo de referência: mono PERC 550 Wp (Voc 49,5 V · Vmp 41,5 V · Isc 13,9 A).
 * Voc estimado por string = módulos × 49,5 × 1,05 (fator frio ~Tmin 10 °C).
 */

export const MODULO_REFERENCIA = {
  fabricante: 'Genérico (referência)',
  modelo: 'Mono PERC 550W',
  potencia_wp: 550, voc: 49.5, vmp: 41.5, isc: 13.9, imp: 13.3,
}

// Limites de classe COSERN — REFERÊNCIA (validar com a NT COSERN)
export const COSERN_CLASSES = {
  M2: { ligacao: 'monofasico', tensao_v: 220, potencia_limite_kw: 8,  demanda_kva: 9,   disjuntor_a: 40,  cabo_mm2: 10,  caixa: 'CM (padrão monofásico)',  aterramento: 'haste + condutor 10 mm² Cu' },
  M3: { ligacao: 'monofasico', tensao_v: 220, potencia_limite_kw: 10, demanda_kva: 11,  disjuntor_a: 50,  cabo_mm2: 16,  caixa: 'CM (padrão monofásico)',  aterramento: 'haste + condutor 16 mm² Cu' },
  T5: { ligacao: 'trifasico',  tensao_v: 380, potencia_limite_kw: 27, demanda_kva: 30,  disjuntor_a: 50,  cabo_mm2: 16,  caixa: 'CM-4 (trifásico)',         aterramento: 'malha/haste + 16 mm² Cu' },
  T6: { ligacao: 'trifasico',  tensao_v: 380, potencia_limite_kw: 40, demanda_kva: 45,  disjuntor_a: 100, cabo_mm2: 35,  caixa: 'CM-4 (trifásico)',         aterramento: 'malha + 25 mm² Cu' },
  T7: { ligacao: 'trifasico',  tensao_v: 380, potencia_limite_kw: 57, demanda_kva: 63,  disjuntor_a: 150, cabo_mm2: 70,  caixa: 'Cabine/CM dedicada',      aterramento: 'malha + 50 mm² Cu' },
  T8: { ligacao: 'trifasico',  tensao_v: 380, potencia_limite_kw: 75, demanda_kva: 84,  disjuntor_a: 200, cabo_mm2: 120, caixa: 'Cabine de medição',       aterramento: 'malha + 70 mm² Cu' },
}

// helper de Voc estimado (frio) e corrente por string
const vocFrio = (mods) => +(mods * MODULO_REFERENCIA.voc * 1.05).toFixed(0)

// ── Topologias de referência por classe × arquitetura ──────────────────────────
export const COSERN_TOPOLOGIAS = {
  M2: {
    string: {
      potencia_fv_kwp: 6.6, modulo_ref: MODULO_REFERENCIA.modelo, num_modulos: 12,
      inversor: { fabricante: 'Kehua', modelo: 'SPI6000-B2', potencia_kw: 6, n_mppts: 2, entradas_por_mppt: 1, tensao_max_entrada: 550, corrente_max_mppt: 13 },
      num_inversores: 1, potencia_ca_kw: 6, potencia_cc_kwp: 6.6, oversizing: 1.10,
      mppt: 2, entradas: 2, strings: 2, modulos_por_string: 6, voc_estimado_v: vocFrio(6), corrente_estimada_a: 13.9,
    },
    micro: { modelo: 'TSUN TSOL-MP2250', entradas_por_micro: 4, modulos_atendidos: 12, num_micros: 3, potencia_ca_kw: 6.75, oversizing: 0.98 },
    otimizador: { modelo: 'SolarEdge P401', quantidade: 12, inversor_compativel: 'SolarEdge SE6000H', potencia_ca_kw: 6, num_modulos: 12 },
  },
  M3: {
    string: {
      potencia_fv_kwp: 8.8, modulo_ref: MODULO_REFERENCIA.modelo, num_modulos: 16,
      inversor: { fabricante: 'Growatt', modelo: 'MIN 8000TL-X', potencia_kw: 8, n_mppts: 2, entradas_por_mppt: 1, tensao_max_entrada: 1000, corrente_max_mppt: 13.5 },
      num_inversores: 1, potencia_ca_kw: 8, potencia_cc_kwp: 8.8, oversizing: 1.10,
      mppt: 2, entradas: 2, strings: 2, modulos_por_string: 8, voc_estimado_v: vocFrio(8), corrente_estimada_a: 13.9,
    },
    micro: { modelo: 'TSUN TSOL-MP2250', entradas_por_micro: 4, modulos_atendidos: 16, num_micros: 4, potencia_ca_kw: 9.0, oversizing: 0.98 },
    otimizador: { modelo: 'SolarEdge P401', quantidade: 16, inversor_compativel: 'SolarEdge SE8000H', potencia_ca_kw: 8, num_modulos: 16 },
  },
  T5: {
    string: {
      potencia_fv_kwp: 27.5, modulo_ref: MODULO_REFERENCIA.modelo, num_modulos: 50,
      inversor: { fabricante: 'SolaX', modelo: 'X3-ULT-25K', potencia_kw: 25, n_mppts: 3, entradas_por_mppt: 2, tensao_max_entrada: 1000, corrente_max_mppt: 36 },
      num_inversores: 1, potencia_ca_kw: 25, potencia_cc_kwp: 27.5, oversizing: 1.10,
      mppt: 3, entradas: 6, strings: 5, modulos_por_string: 10, voc_estimado_v: vocFrio(10), corrente_estimada_a: 27.8,
    },
    micro: { modelo: 'TSUN TSOL-MP2250', entradas_por_micro: 4, modulos_atendidos: 50, num_micros: 13, potencia_ca_kw: 29.25, oversizing: 0.94 },
    otimizador: { modelo: 'SolarEdge P850', quantidade: 25, inversor_compativel: 'SolarEdge SE25K (trifásico)', potencia_ca_kw: 25, num_modulos: 50 },
  },
  T6: {
    string: {
      potencia_fv_kwp: 39.6, modulo_ref: MODULO_REFERENCIA.modelo, num_modulos: 72,
      inversor: { fabricante: 'Huawei', modelo: 'SUN2000-40KTL-M3', potencia_kw: 40, n_mppts: 4, entradas_por_mppt: 2, tensao_max_entrada: 1100, corrente_max_mppt: 20 },
      num_inversores: 1, potencia_ca_kw: 40, potencia_cc_kwp: 39.6, oversizing: 0.99,
      mppt: 4, entradas: 4, strings: 4, modulos_por_string: 18, voc_estimado_v: vocFrio(18), corrente_estimada_a: 13.9,
    },
    micro: { modelo: 'TSUN TSOL-MP2250', entradas_por_micro: 4, modulos_atendidos: 72, num_micros: 18, potencia_ca_kw: 40.5, oversizing: 0.98 },
    otimizador: { modelo: 'SolarEdge P850', quantidade: 36, inversor_compativel: 'SolarEdge SE33.3K (trifásico)', potencia_ca_kw: 33.3, num_modulos: 72 },
  },
  T7: {
    string: {
      potencia_fv_kwp: 59.4, modulo_ref: MODULO_REFERENCIA.modelo, num_modulos: 108,
      inversor: { fabricante: 'Huawei', modelo: 'SUN2000-50KTL-M0', potencia_kw: 50, n_mppts: 6, entradas_por_mppt: 2, tensao_max_entrada: 1100, corrente_max_mppt: 22 },
      num_inversores: 1, potencia_ca_kw: 50, potencia_cc_kwp: 59.4, oversizing: 1.19,
      mppt: 6, entradas: 6, strings: 6, modulos_por_string: 18, voc_estimado_v: vocFrio(18), corrente_estimada_a: 13.9,
    },
    micro: { modelo: 'TSUN TSOL-MP2250', entradas_por_micro: 4, modulos_atendidos: 108, num_micros: 27, potencia_ca_kw: 60.75, oversizing: 0.98 },
    otimizador: { modelo: 'SolarEdge P850', quantidade: 54, inversor_compativel: 'SolarEdge SE50K (trifásico)', potencia_ca_kw: 50, num_modulos: 108 },
  },
  T8: {
    string: {
      potencia_fv_kwp: 66.0, modulo_ref: MODULO_REFERENCIA.modelo, num_modulos: 120,
      inversor: { fabricante: 'Huawei', modelo: 'SUN2000-60KTL-M0', potencia_kw: 60, n_mppts: 6, entradas_por_mppt: 2, tensao_max_entrada: 1100, corrente_max_mppt: 22 },
      num_inversores: 1, potencia_ca_kw: 60, potencia_cc_kwp: 66.0, oversizing: 1.10,
      mppt: 6, entradas: 6, strings: 6, modulos_por_string: 20, voc_estimado_v: vocFrio(20), corrente_estimada_a: 13.9,
    },
    micro: { modelo: 'TSUN TSOL-MP2250', entradas_por_micro: 4, modulos_atendidos: 120, num_micros: 30, potencia_ca_kw: 67.5, oversizing: 0.98 },
    otimizador: { modelo: 'SolarEdge P850', quantidade: 60, inversor_compativel: 'SolarEdge SE66.6K (trifásico)', potencia_ca_kw: 66.6, num_modulos: 120 },
  },
}

export const COSERN_META = {
  concessionaria: 'COSERN',
  classes: Object.keys(COSERN_CLASSES),
  arquiteturas: ['string', 'micro', 'otimizador'],
  modulo_referencia: MODULO_REFERENCIA,
  aviso: 'Topologias de REFERÊNCIA (sugestão inicial editável). NÃO substituem o dimensionamento nem a Norma Técnica COSERN. Confirmar limites de entrada com a NT vigente.',
}

export default { COSERN_CLASSES, COSERN_TOPOLOGIAS, COSERN_META, MODULO_REFERENCIA }
