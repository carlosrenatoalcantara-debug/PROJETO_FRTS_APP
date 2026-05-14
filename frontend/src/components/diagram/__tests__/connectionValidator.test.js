import { describe, it, expect } from 'vitest';
import {
  validarConexao,
  obterTipoConexaoEsperado,
  obterHandlesCompativeis,
  validarFluxoEletrico,
  validarComponentesUnicos,
  CONEXOES_PERMITIDAS,
} from '../utils/connectionValidator';

describe('Validação de Conexões (Phase 4)', () => {

  describe('2.2.1 - Conexões válidas', () => {
    it('REDE → DISJUNTOR é válido', () => {
      const validacao = validarConexao('rede', 'disjuntor');
      expect(validacao.valido).toBe(true);
    });

    it('DISJUNTOR → DPS é válido', () => {
      const validacao = validarConexao('disjuntor', 'dps');
      expect(validacao.valido).toBe(true);
    });

    it('DPS → DR é válido', () => {
      const validacao = validarConexao('dps', 'dr');
      expect(validacao.valido).toBe(true);
    });

    it('DR → CABO é válido', () => {
      const validacao = validarConexao('dr', 'cabo');
      expect(validacao.valido).toBe(true);
    });

    it('CABO → CARREGADOR é válido', () => {
      const validacao = validarConexao('cabo', 'carregador');
      expect(validacao.valido).toBe(true);
    });
  });

  describe('2.2.2 - Conexões inválidas', () => {
    it('REDE → DR é inválido', () => {
      const validacao = validarConexao('rede', 'dr');
      expect(validacao.valido).toBe(false);
    });

    it('REDE → CABO é inválido', () => {
      const validacao = validarConexao('rede', 'cabo');
      expect(validacao.valido).toBe(false);
    });

    it('CARREGADOR → qualquer coisa é inválido', () => {
      const validacao = validarConexao('carregador', 'disjuntor');
      expect(validacao.valido).toBe(false);
    });

    it('SPECS → qualquer coisa é inválido', () => {
      const validacao = validarConexao('specs', 'rede');
      expect(validacao.valido).toBe(false);
    });
  });

  describe('2.2.3 - Mensagens de erro claras', () => {
    it('Mensagem de erro para conexão inválida contém origem e destino', () => {
      const validacao = validarConexao('carregador', 'disjuntor');
      expect(validacao.erro).toBeDefined();
      expect(validacao.erro.toLowerCase()).toContain('inválida');
    });

    it('Mensagem de erro é específica', () => {
      const validacao = validarConexao('rede', 'carregador');
      expect(validacao.erro).toBeDefined();
      expect(validacao.erro.length).toBeGreaterThan(0);
    });
  });

  describe('2.3.1 - Tipo de conexão esperado', () => {
    it('REDE → DISJUNTOR é CA', () => {
      const tipo = obterTipoConexaoEsperado('rede', 'disjuntor');
      expect(tipo).toBe('CA');
    });

    it('CABO → CARREGADOR é CC', () => {
      const tipo = obterTipoConexaoEsperado('cabo', 'carregador');
      expect(tipo).toBe('CC');
    });

    it('DR → CABO é CA', () => {
      const tipo = obterTipoConexaoEsperado('dr', 'cabo');
      expect(tipo).toBe('CA');
    });
  });

  describe('2.3.2 - Handles compatíveis', () => {
    it('REDE tem handle para DISJUNTOR', () => {
      const compatibles = obterHandlesCompativeis('rede');
      expect(compatibles).toContain('disjuntor');
    });

    it('DISJUNTOR tem handle para DPS', () => {
      const compatibles = obterHandlesCompativeis('disjuntor');
      expect(compatibles).toContain('dps');
    });

    it('CARREGADOR não tem handles compatíveis', () => {
      const compatibles = obterHandlesCompativeis('carregador');
      expect(compatibles.length).toBe(0);
    });

    it('SPECS não tem handles compatíveis', () => {
      const compatibles = obterHandlesCompativeis('specs');
      expect(compatibles.length).toBe(0);
    });
  });

  describe('2.4.1 - Fluxo elétrico completo', () => {
    it('Fluxo válido: REDE → DISJUNTOR → DPS → DR → CABO → CARREGADOR', () => {
      const nodes = [
        { id: '1', data: { tipo: 'rede' } },
        { id: '2', data: { tipo: 'disjuntor' } },
        { id: '3', data: { tipo: 'dps' } },
        { id: '4', data: { tipo: 'dr' } },
        { id: '5', data: { tipo: 'cabo' } },
        { id: '6', data: { tipo: 'carregador' } }
      ];

      const edges = [
        { id: 'e1', source: '1', target: '2' },
        { id: 'e2', source: '2', target: '3' },
        { id: 'e3', source: '3', target: '4' },
        { id: 'e4', source: '4', target: '5' },
        { id: 'e5', source: '5', target: '6' }
      ];

      const validacao = validarFluxoEletrico(nodes, edges);
      expect(validacao.valido).toBe(true);
    });

    it('Fluxo inválido: sem REDE de origem', () => {
      const nodes = [
        { id: '1', data: { tipo: 'disjuntor' } },
        { id: '2', data: { tipo: 'carregador' } }
      ];

      const edges = [
        { id: 'e1', source: '1', target: '2' }
      ];

      const validacao = validarFluxoEletrico(nodes, edges);
      expect(validacao.valido).toBe(false);
    });

    it('Fluxo inválido: sem CARREGADOR de destino', () => {
      const nodes = [
        { id: '1', data: { tipo: 'rede' } },
        { id: '2', data: { tipo: 'disjuntor' } }
      ];

      const edges = [
        { id: 'e1', source: '1', target: '2' }
      ];

      const validacao = validarFluxoEletrico(nodes, edges);
      expect(validacao.valido).toBe(false);
    });
  });

  describe('2.5.1 - Unicidade de componentes', () => {
    it('Não permite 2 REDE', () => {
      const nodes = [
        { id: '1', data: { tipo: 'rede' } },
        { id: '2', data: { tipo: 'rede' } }
      ];

      const validacao = validarComponentesUnicos(nodes);
      expect(validacao.valido).toBe(false);
      expect(validacao.erro).toContain('rede');
    });

    it('Não permite 2 CARREGADOR', () => {
      const nodes = [
        { id: '1', data: { tipo: 'carregador' } },
        { id: '2', data: { tipo: 'carregador' } }
      ];

      const validacao = validarComponentesUnicos(nodes);
      expect(validacao.valido).toBe(false);
      expect(validacao.erro).toContain('carregador');
    });

    it('Permite múltiplos CABO', () => {
      const nodes = [
        { id: '1', data: { tipo: 'cabo' } },
        { id: '2', data: { tipo: 'cabo' } },
        { id: '3', data: { tipo: 'cabo' } }
      ];

      const validacao = validarComponentesUnicos(nodes);
      expect(validacao.valido).toBe(true);
    });
  });

});
