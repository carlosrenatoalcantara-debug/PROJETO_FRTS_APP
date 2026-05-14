import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistorioDiagrama } from '../../../hooks/useHistorioDiagrama';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};

  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('Undo/Redo System Hook (Phase 4)', () => {

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('2.1.1 - Inicialização', () => {
    it('Hook inicializa com história vazia', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-1'));

      expect(result.current.historia).toEqual([]);
      expect(result.current.posicaoAtual).toBe(-1);
      expect(result.current.podeDesfazer).toBe(false);
      expect(result.current.podeRefazer).toBe(false);
    });
  });

  describe('2.1.2 - Adicionar snapshot', () => {
    it('Adicionar snapshot incrementa posição', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-2'));

      const nodes = [{ id: '1', data: { tipo: 'rede' } }];
      const edges = [];

      act(() => {
        result.current.adicionar(nodes, edges, 'Teste 1');
      });

      expect(result.current.posicaoAtual).toBe(0);
      expect(result.current.historia.length).toBe(1);
    });

    it('Adicionar múltiplos snapshots incrementa corretamente', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-3'));

      const nodes = [];
      const edges = [];

      act(() => {
        result.current.adicionar(nodes, edges, 'Teste 1');
        result.current.adicionar(nodes, edges, 'Teste 2');
        result.current.adicionar(nodes, edges, 'Teste 3');
      });

      expect(result.current.posicaoAtual).toBe(2);
      expect(result.current.historia.length).toBe(3);
    });
  });

  describe('2.1.3 - Desfazer (Undo)', () => {
    it('Desfazer volta uma posição', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-4'));

      const nodes = [];
      const edges = [];

      act(() => {
        result.current.adicionar(nodes, edges, 'Teste 1');
        result.current.adicionar(nodes, edges, 'Teste 2');
      });

      expect(result.current.posicaoAtual).toBe(1);

      act(() => {
        result.current.desfazer();
      });

      expect(result.current.posicaoAtual).toBe(0);
    });

    it('Desfazer quando já está no início não faz nada', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-5'));

      act(() => {
        result.current.desfazer();
      });

      expect(result.current.posicaoAtual).toBe(-1);
    });

    it('podeDesfazer retorna false no início', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-6'));

      expect(result.current.podeDesfazer).toBe(false);
    });

    it('podeDesfazer retorna true após adicionar snapshot', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-7'));

      act(() => {
        result.current.adicionar([], [], 'Teste');
      });

      expect(result.current.podeDesfazer).toBe(true);
    });
  });

  describe('2.1.4 - Refazer (Redo)', () => {
    it('Refazer avança uma posição', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-8'));

      act(() => {
        result.current.adicionar([], [], 'Teste 1');
        result.current.adicionar([], [], 'Teste 2');
        result.current.desfazer();
      });

      expect(result.current.posicaoAtual).toBe(0);

      act(() => {
        result.current.refazer();
      });

      expect(result.current.posicaoAtual).toBe(1);
    });

    it('podeRefazer retorna false quando não há histórico futuro', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-9'));

      act(() => {
        result.current.adicionar([], [], 'Teste');
      });

      expect(result.current.podeRefazer).toBe(false);
    });

    it('podeRefazer retorna true após desfazer', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-10'));

      act(() => {
        result.current.adicionar([], [], 'Teste 1');
        result.current.desfazer();
      });

      expect(result.current.podeRefazer).toBe(true);
    });
  });

  describe('2.1.5 - Teclado Ctrl+Z', () => {
    it('Hook retorna função para disparar desfazer', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-11'));

      expect(typeof result.current.desfazer).toBe('function');
    });
  });

  describe('2.1.6 - Teclado Ctrl+Shift+Z', () => {
    it('Hook retorna função para disparar refazer', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-12'));

      expect(typeof result.current.refazer).toBe('function');
    });
  });

  describe('2.1.7 - Persistência em localStorage', () => {
    it('História persiste em localStorage', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-13'));

      act(() => {
        result.current.adicionar([], [], 'Teste persist');
      });

      const stored = localStorage.getItem('diagrama_historico_test-projeto-13');
      expect(stored).toBeTruthy();
      expect(stored).toContain('Teste persist');
    });
  });

  describe('2.1.8 - Carregamento do localStorage', () => {
    it('História carrega do localStorage ao montar', () => {
      // Pré-popular localStorage
      const historiaArmazenada = [
        {
          timestamp: Date.now(),
          nodes: [{ id: '1', data: { tipo: 'rede' } }],
          edges: [],
          description: 'Carregado'
        }
      ];
      localStorage.setItem('diagrama_historico_test-projeto-14', JSON.stringify(historiaArmazenada));

      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-14'));

      expect(result.current.historia.length).toBe(1);
      expect(result.current.historia[0].description).toBe('Carregado');
    });
  });

  describe('2.1.9 - Limite de 20 snapshots', () => {
    it('Máximo de 20 snapshots é mantido', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-15'));

      act(() => {
        for (let i = 0; i < 25; i++) {
          result.current.adicionar([], [], `Teste ${i}`);
        }
      });

      expect(result.current.historia.length).toBe(20);
    });

    it('Snapshots antigos são removidos quando limite é atingido', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-16'));

      act(() => {
        // Adicionar 25 snapshots
        for (let i = 0; i < 25; i++) {
          result.current.adicionar([], [], `Snapshot ${i}`);
        }
      });

      // Os primeiros 5 devem ter sido removidos (FIFO)
      expect(result.current.historia[0].description).toContain('Snapshot 5');
      expect(result.current.historia[19].description).toContain('Snapshot 24');
    });
  });

  describe('2.1.10 - Snapshots descritivos', () => {
    it('Snapshots contêm descrição', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-17'));

      act(() => {
        result.current.adicionar([], [], 'Moveu painel');
      });

      const snapshot = result.current.historia[result.current.posicaoAtual];
      expect(snapshot.description).toBe('Moveu painel');
    });

    it('Snapshots contêm timestamp', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-18'));

      const beforeTime = Date.now();

      act(() => {
        result.current.adicionar([], [], 'Teste');
      });

      const afterTime = Date.now();
      const snapshot = result.current.historia[result.current.posicaoAtual];

      expect(snapshot.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(snapshot.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('Snapshots contêm nodes e edges', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-19'));

      const nodes = [{ id: '1', data: { tipo: 'rede' } }];
      const edges = [{ id: 'e1', source: '1', target: '2' }];

      act(() => {
        result.current.adicionar(nodes, edges, 'Teste');
      });

      const snapshot = result.current.historia[result.current.posicaoAtual];
      expect(snapshot.nodes).toEqual(nodes);
      expect(snapshot.edges).toEqual(edges);
    });
  });

  describe('2.1.11 - Obter snapshot atual', () => {
    it('Retorna snapshot na posição atual', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-20'));

      const nodes1 = [{ id: '1', data: { tipo: 'rede' } }];
      const edges1 = [];

      const nodes2 = [{ id: '1', data: { tipo: 'rede' } }, { id: '2', data: { tipo: 'disjuntor' } }];
      const edges2 = [{ id: 'e1', source: '1', target: '2' }];

      act(() => {
        result.current.adicionar(nodes1, edges1, 'Passo 1');
        result.current.adicionar(nodes2, edges2, 'Passo 2');
      });

      const snapshotAtual = result.current.obterSnapshotAtual();
      expect(snapshotAtual.nodes).toEqual(nodes2);
      expect(snapshotAtual.edges).toEqual(edges2);
    });

    it('Retorna null quando história está vazia', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-21'));

      const snapshot = result.current.obterSnapshotAtual();
      expect(snapshot).toBeNull();
    });
  });

  describe('2.1.12 - Limpar histórico', () => {
    it('Limpar remove toda a história', () => {
      const { result } = renderHook(() => useHistorioDiagrama('test-projeto-22'));

      act(() => {
        result.current.adicionar([], [], 'Teste 1');
        result.current.adicionar([], [], 'Teste 2');
        result.current.limpar();
      });

      expect(result.current.historia).toEqual([]);
      expect(result.current.posicaoAtual).toBe(-1);
    });
  });

  describe('2.1.13 - Múltiplos projetos', () => {
    it('Cada projeto tem sua própria história', () => {
      const { result: result1 } = renderHook(() => useHistorioDiagrama('projeto-A'));
      const { result: result2 } = renderHook(() => useHistorioDiagrama('projeto-B'));

      act(() => {
        result1.current.adicionar([], [], 'Projeto A');
        result2.current.adicionar([], [], 'Projeto B');
      });

      expect(result1.current.historia[0].description).toBe('Projeto A');
      expect(result2.current.historia[0].description).toBe('Projeto B');
    });
  });

});
