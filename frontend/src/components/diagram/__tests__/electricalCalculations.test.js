import { describe, it, expect } from 'vitest';
import {
  validarValorCampo,
  validarParametrosNBR5410,
  calcularBitola,
  calcularQuedaTensao,
  RANGES_VALIDOS
} from '../utils/electricalCalculations';

describe('Validações Bloqueantes NBR 5410 (Phase 4)', () => {

  describe('2.4.1 - REDE corrente válida', () => {
    it('REDE corrente = 1A é aceita (mínimo)', () => {
      const val = validarValorCampo('rede', 'corrente_projeto_a', 1);
      expect(val.valido).toBe(true);
    });

    it('REDE corrente = 32.5A é aceita (valor típico)', () => {
      const val = validarValorCampo('rede', 'corrente_projeto_a', 32.5);
      expect(val.valido).toBe(true);
    });

    it('REDE corrente = 200A é aceita (máximo)', () => {
      const val = validarValorCampo('rede', 'corrente_projeto_a', 200);
      expect(val.valido).toBe(true);
    });
  });

  describe('2.4.2 - REDE corrente inválida', () => {
    it('REDE corrente = 0 é rejeitada', () => {
      const val = validarValorCampo('rede', 'corrente_projeto_a', 0);
      expect(val.valido).toBe(false);
      expect(val.erro).toBeDefined();
    });

    it('REDE corrente < 1 é rejeitada', () => {
      const val = validarValorCampo('rede', 'corrente_projeto_a', 0.5);
      expect(val.valido).toBe(false);
    });

    it('REDE corrente > 200 é rejeitada', () => {
      const val = validarValorCampo('rede', 'corrente_projeto_a', 250);
      expect(val.valido).toBe(false);
      expect(val.erro).toBeDefined();
    });

    it('REDE corrente = -10 é rejeitada', () => {
      const val = validarValorCampo('rede', 'corrente_projeto_a', -10);
      expect(val.valido).toBe(false);
    });
  });

  describe('2.4.3 - DISJUNTOR corrente válida', () => {
    it('DISJUNTOR = 6A é aceita (mínimo)', () => {
      const val = validarValorCampo('disjuntor', 'corrente_a', 6);
      expect(val.valido).toBe(true);
    });

    it('DISJUNTOR = 32A é aceita (típico)', () => {
      const val = validarValorCampo('disjuntor', 'corrente_a', 32);
      expect(val.valido).toBe(true);
    });

    it('DISJUNTOR = 200A é aceita (máximo)', () => {
      const val = validarValorCampo('disjuntor', 'corrente_a', 200);
      expect(val.valido).toBe(true);
    });
  });

  describe('2.4.4 - DISJUNTOR corrente inválida', () => {
    it('DISJUNTOR < 6A é rejeitada', () => {
      const val = validarValorCampo('disjuntor', 'corrente_a', 5);
      expect(val.valido).toBe(false);
    });

    it('DISJUNTOR > 200A é rejeitada', () => {
      const val = validarValorCampo('disjuntor', 'corrente_a', 300);
      expect(val.valido).toBe(false);
    });
  });

  describe('2.4.5 - CABO bitola válida', () => {
    it('CABO = 1.5mm² é aceita (mínimo)', () => {
      const val = validarValorCampo('cabo', 'bitola_mm2', 1.5);
      expect(val.valido).toBe(true);
    });

    it('CABO = 6mm² é aceita (típico)', () => {
      const val = validarValorCampo('cabo', 'bitola_mm2', 6);
      expect(val.valido).toBe(true);
    });

    it('CABO = 240mm² é aceita (máximo)', () => {
      const val = validarValorCampo('cabo', 'bitola_mm2', 240);
      expect(val.valido).toBe(true);
    });
  });

  describe('2.4.6 - CABO bitola inválida', () => {
    it('CABO = 1mm² é rejeitada (< mínimo)', () => {
      const val = validarValorCampo('cabo', 'bitola_mm2', 1);
      expect(val.valido).toBe(false);
    });

    it('CABO = 300mm² é rejeitada (> máximo)', () => {
      const val = validarValorCampo('cabo', 'bitola_mm2', 300);
      expect(val.valido).toBe(false);
    });

    it('CABO = -5mm² é rejeitada', () => {
      const val = validarValorCampo('cabo', 'bitola_mm2', -5);
      expect(val.valido).toBe(false);
    });
  });

  describe('2.4.7 - CABO comprimento válido', () => {
    it('CABO comprimento = 0.1m é aceita (mínimo)', () => {
      const val = validarValorCampo('cabo', 'comprimento_m', 0.1);
      expect(val.valido).toBe(true);
    });

    it('CABO comprimento = 50m é aceita (típico)', () => {
      const val = validarValorCampo('cabo', 'comprimento_m', 50);
      expect(val.valido).toBe(true);
    });

    it('CABO comprimento = 1000m é aceita (máximo)', () => {
      const val = validarValorCampo('cabo', 'comprimento_m', 1000);
      expect(val.valido).toBe(true);
    });
  });

  describe('2.4.8 - CABO comprimento inválido', () => {
    it('CABO comprimento = 0 é rejeitada', () => {
      const val = validarValorCampo('cabo', 'comprimento_m', 0);
      expect(val.valido).toBe(false);
    });

    it('CABO comprimento = 2000m é rejeitada (> máximo)', () => {
      const val = validarValorCampo('cabo', 'comprimento_m', 2000);
      expect(val.valido).toBe(false);
    });
  });

  describe('2.4.9 - DR sensibilidade válida', () => {
    it('DR = 10mA é aceita (mínimo)', () => {
      const val = validarValorCampo('dr', 'sensibilidade_ma', 10);
      expect(val.valido).toBe(true);
    });

    it('DR = 30mA é aceita (padrão)', () => {
      const val = validarValorCampo('dr', 'sensibilidade_ma', 30);
      expect(val.valido).toBe(true);
    });

    it('DR = 300mA é aceita (máximo)', () => {
      const val = validarValorCampo('dr', 'sensibilidade_ma', 300);
      expect(val.valido).toBe(true);
    });
  });

  describe('2.4.10 - DR sensibilidade inválida', () => {
    it('DR < 10mA é rejeitada', () => {
      const val = validarValorCampo('dr', 'sensibilidade_ma', 5);
      expect(val.valido).toBe(false);
    });

    it('DR > 300mA é rejeitada', () => {
      const val = validarValorCampo('dr', 'sensibilidade_ma', 500);
      expect(val.valido).toBe(false);
    });
  });

  describe('2.4.11 - CARREGADOR potência válida', () => {
    it('CARREGADOR = 3.7kW é aceita (mínimo)', () => {
      const val = validarValorCampo('carregador', 'potencia_kw', 3.7);
      expect(val.valido).toBe(true);
    });

    it('CARREGADOR = 7kW é aceita (típico)', () => {
      const val = validarValorCampo('carregador', 'potencia_kw', 7);
      expect(val.valido).toBe(true);
    });

    it('CARREGADOR = 22kW é aceita (máximo)', () => {
      const val = validarValorCampo('carregador', 'potencia_kw', 22);
      expect(val.valido).toBe(true);
    });
  });

  describe('2.4.12 - CARREGADOR potência inválida', () => {
    it('CARREGADOR < 3.7kW é rejeitada', () => {
      const val = validarValorCampo('carregador', 'potencia_kw', 3);
      expect(val.valido).toBe(false);
    });

    it('CARREGADOR > 22kW é rejeitada', () => {
      const val = validarValorCampo('carregador', 'potencia_kw', 30);
      expect(val.valido).toBe(false);
    });
  });

  describe('2.4.13 - Mensagens de erro específicas', () => {
    it('Mensagem de erro inclui campo inválido', () => {
      const val = validarValorCampo('rede', 'corrente_projeto_a', 250);
      expect(val.erro).toContain('corrente');
    });

    it('Mensagem de erro inclui ranges válidos', () => {
      const val = validarValorCampo('rede', 'corrente_projeto_a', 300);
      expect(val.erro.toLowerCase()).toContain('deve');
    });

    it('Mensagem de erro é acionável', () => {
      const val = validarValorCampo('cabo', 'bitola_mm2', -5);
      expect(val.erro.length).toBeGreaterThan(20);
    });
  });

  describe('2.4.14 - Valores não-numéricos', () => {
    it('String "abc" é rejeitada', () => {
      const val = validarValorCampo('rede', 'corrente_projeto_a', 'abc');
      expect(val.valido).toBe(false);
    });

    it('null é rejeitado', () => {
      const val = validarValorCampo('rede', 'corrente_projeto_a', null);
      expect(val.valido).toBe(false);
    });

    it('undefined é rejeitado', () => {
      const val = validarValorCampo('rede', 'corrente_projeto_a', undefined);
      expect(val.valido).toBe(false);
    });
  });

  describe('2.4.15 - Validação completa do diagrama', () => {
    it('Diagrama válido passa em validação', () => {
      const nodes = [
        { id: '1', data: { tipo: 'rede', corrente_projeto_a: 32.5 } },
        { id: '2', data: { tipo: 'disjuntor', corrente_a: 32 } },
        { id: '3', data: { tipo: 'dps', tensao_kv: 275 } },
        { id: '4', data: { tipo: 'dr', sensibilidade_ma: 30 } },
        { id: '5', data: { tipo: 'cabo', bitola_mm2: 6, comprimento_m: 50 } },
        { id: '6', data: { tipo: 'carregador', potencia_kw: 7 } }
      ];

      const validacao = validarParametrosNBR5410(nodes);
      expect(validacao.valido).toBe(true);
    });

    it('Diagrama com REDE inválida falha', () => {
      const nodes = [
        { id: '1', data: { tipo: 'rede', corrente_projeto_a: 300 } },
        { id: '6', data: { tipo: 'carregador', potencia_kw: 7 } }
      ];

      const validacao = validarParametrosNBR5410(nodes);
      expect(validacao.valido).toBe(false);
    });

    it('Diagrama sem componentes obrigatórios falha', () => {
      const nodes = [
        { id: '5', data: { tipo: 'cabo', bitola_mm2: 6 } }
      ];

      const validacao = validarParametrosNBR5410(nodes);
      expect(validacao.valido).toBe(false);
    });
  });

});

describe('Cálculos Elétricos (Phase 4)', () => {

  describe('Cálculo de bitola de cabo', () => {
    it('Retorna valor numérico válido', () => {
      const bitola = calcularBitola(32.5, 50);
      expect(typeof bitola).toBe('number');
      expect(bitola).toBeGreaterThan(0);
    });

    it('Bitola aumenta com corrente', () => {
      const bitola_10A = calcularBitola(10, 50);
      const bitola_32A = calcularBitola(32, 50);
      expect(bitola_32A).toBeGreaterThan(bitola_10A);
    });

    it('Bitola aumenta com comprimento', () => {
      const bitola_10m = calcularBitola(32, 10);
      const bitola_50m = calcularBitola(32, 50);
      expect(bitola_50m).toBeGreaterThan(bitola_10m);
    });
  });

  describe('Cálculo de queda de tensão', () => {
    it('Retorna valor percentual válido', () => {
      const queda = calcularQuedaTensao(32.5, 50, 6, 380);
      expect(typeof queda).toBe('number');
      expect(queda).toBeGreaterThan(0);
    });

    it('Queda deve estar dentro de norma (< 3%)', () => {
      const queda = calcularQuedaTensao(32.5, 50, 6, 380);
      expect(queda).toBeLessThan(3);
    });

    it('Queda aumenta com comprimento', () => {
      const queda_10m = calcularQuedaTensao(32.5, 10, 6, 380);
      const queda_50m = calcularQuedaTensao(32.5, 50, 6, 380);
      expect(queda_50m).toBeGreaterThan(queda_10m);
    });

    it('Queda diminui com bitola maior', () => {
      const queda_6mm = calcularQuedaTensao(32.5, 50, 6, 380);
      const queda_10mm = calcularQuedaTensao(32.5, 50, 10, 380);
      expect(queda_10mm).toBeLessThan(queda_6mm);
    });
  });

});
