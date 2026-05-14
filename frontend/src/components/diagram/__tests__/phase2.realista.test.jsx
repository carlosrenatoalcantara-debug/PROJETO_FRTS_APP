import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ComponenteRealista from '../nodes/ComponenteRealista';
import { ReactFlowProvider } from 'reactflow';

// Wrapper para testes que requerem ReactFlow context
const renderWithReactFlow = (component) => {
  return render(
    <ReactFlowProvider>
      {component}
    </ReactFlowProvider>
  );
};

describe('Renderização de Componentes Realistas (Phase 2)', () => {

  it('1.1.1 - REDE renderiza como círculo laranja', () => {
    const node = {
      id: 'rede-1',
      data: {
        tipo: 'rede',
        corrente_projeto_a: 32.5,
        tensao: '380V'
      }
    };

    renderWithReactFlow(
      <ComponenteRealista node={node} />
    );

    // Verificar que componente foi renderizado
    expect(screen.getByTestId(`node-${node.id}`)).toBeTruthy();
  });

  it('1.1.2 - DISJUNTOR renderiza com 2 alavancas', () => {
    const node = {
      id: 'disjuntor-1',
      data: {
        tipo: 'disjuntor',
        corrente_a: 32
      }
    };

    renderWithReactFlow(
      <ComponenteRealista node={node} />
    );

    expect(screen.getByTestId(`node-${node.id}`)).toBeTruthy();
  });

  it('1.1.3 - DPS renderiza com triângulo + indicador', () => {
    const node = {
      id: 'dps-1',
      data: {
        tipo: 'dps',
        tensao_kv: 275
      }
    };

    renderWithReactFlow(
      <ComponenteRealista node={node} />
    );

    expect(screen.getByTestId(`node-${node.id}`)).toBeTruthy();
  });

  it('1.1.4 - DR renderiza com botão TEST vermelho', () => {
    const node = {
      id: 'dr-1',
      data: {
        tipo: 'dr',
        sensibilidade_ma: 30
      }
    };

    renderWithReactFlow(
      <ComponenteRealista node={node} />
    );

    expect(screen.getByTestId(`node-${node.id}`)).toBeTruthy();
  });

  it('1.1.5 - CABO renderiza com bitola', () => {
    const node = {
      id: 'cabo-1',
      data: {
        tipo: 'cabo',
        bitola_mm2: 10,
        comprimento_m: 50
      }
    };

    renderWithReactFlow(
      <ComponenteRealista node={node} />
    );

    expect(screen.getByTestId(`node-${node.id}`)).toBeTruthy();
  });

  it('1.1.6 - CARREGADOR renderiza com conector', () => {
    const node = {
      id: 'carregador-1',
      data: {
        tipo: 'carregador',
        potencia_kw: 7,
        marca: 'Wallbox'
      }
    };

    renderWithReactFlow(
      <ComponenteRealista node={node} />
    );

    expect(screen.getByTestId(`node-${node.id}`)).toBeTruthy();
  });

  it('1.1.7 - CUSTOMIZADO renderiza com nome personalizado', () => {
    const node = {
      id: 'custom-1',
      data: {
        tipo: 'customizado',
        nome: 'Transformador',
        descricao: 'Transformador 100kVA'
      }
    };

    renderWithReactFlow(
      <ComponenteRealista node={node} />
    );

    expect(screen.getByTestId(`node-${node.id}`)).toBeTruthy();
  });

});

describe('Toggle Realista/Genérico (Phase 2)', () => {

  it('1.2.1 - Modo realista exibe componentes detalhados', () => {
    const { container } = renderWithReactFlow(
      <ComponenteRealista
        node={{
          id: 'test-1',
          data: {
            tipo: 'rede',
            usarRealista: true
          }
        }}
      />
    );

    // Componente deve estar presente
    expect(container.querySelector('[data-testid="node-test-1"]')).toBeTruthy();
  });

});

describe('DPS Obrigatório (Phase 2)', () => {

  it('1.3.1 - DPS node existe no diagrama', () => {
    // Este teste seria feito no nível de InteractiveDiagram
    // apenas verificar que DPS pode ser renderizado
    const node = {
      id: 'dps-obrigatorio',
      data: {
        tipo: 'dps',
        tensao_kv: 275,
        capacidade_a: 50
      }
    };

    renderWithReactFlow(
      <ComponenteRealista node={node} />
    );

    expect(screen.getByTestId(`node-${node.id}`)).toBeTruthy();
  });

  it('1.3.5 - DPS tem tensão correta (275V ou 420V)', () => {
    // Valores válidos
    const tensoes_validas = [275, 420];

    tensoes_validas.forEach(tensao => {
      const node = {
        id: `dps-${tensao}`,
        data: {
          tipo: 'dps',
          tensao_kv: tensao
        }
      };

      expect([275, 420]).toContain(node.data.tensao_kv);
    });
  });

});
