import React, { useCallback, useState, useEffect } from 'react';
import ReactFlow, {
  addEdge,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  MiniMap
} from 'reactflow';
import 'reactflow/dist/style.css';
import ComponentNode from './nodes/ComponentNode';
import ComponenteRealista from './nodes/ComponenteRealista';
import { converterCalculosParaNodesEdges, validarDiagrama, resetarPosicoes } from './utils/reactFlowHelpers';
import { recalcularDiagrama, validarParametrosNBR5410, gerarListaMateriais, validarValorCampo, validarFluxoEletricoCompleto } from './utils/electricalCalculations';
import { validarConexao, obterTipoConexaoEsperado, obterHandlesCompativeis } from './utils/connectionValidator';
import { useHistorioDiagrama } from '../../hooks/useHistorioDiagrama';
import './InteractiveDiagram.css';

const nodeTypes = {
  // Componentes realistas (visual melhorado)
  gridNodeRealista: ComponenteRealista,
  breakerNodeRealista: ComponenteRealista,
  dpsNodeRealista: ComponenteRealista,
  drNodeRealista: ComponenteRealista,
  cableNodeRealista: ComponenteRealista,
  chargerNodeRealista: ComponenteRealista,
  customNodeRealista: ComponenteRealista,

  // Componentes genéricos (fallback)
  gridNode: ComponentNode,
  breakerNode: ComponentNode,
  dpsNode: ComponentNode,
  drNode: ComponentNode,
  cableNode: ComponentNode,
  chargerNode: ComponentNode,
  customNode: ComponentNode,
  specsNode: ComponentNode
};

/**
 * Diagrama Interativo e Editável
 * Permite drag-drop, edição inline, recálculos automáticos
 * @param {Object} props
 * @param {Object} props.calculos - Resultados de calcularParametrosNBR5410
 * @param {Object} props.projeto - Dados do projeto
 * @param {Function} props.onDiagramChange - Callback quando diagrama é modificado
 * @param {Boolean} props.readOnly - Modo somente leitura
 */
export default function InteractiveDiagram({
  calculos,
  projeto,
  onDiagramChange,
  readOnly = false
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [validacao, setValidacao] = useState({ valido: true, erros: [] });
  const [mostraModalCustomizado, setMostraModalCustomizado] = useState(false);
  const [novoCustomizado, setNovoCustomizado] = useState({
    nome: '',
    descricao: '',
    valor1: '',
    valor2: ''
  });
  const [usarRealista, setUsarRealista] = useState(true); // Usar componentes com desenhos realistas

  // Hook para Undo/Redo
  const historioDiagrama = useHistorioDiagrama(projeto?.projeto_id || 'diagrama-sem-id');

  // Inicializar diagrama com dados de entrada
  useEffect(() => {
    if (calculos && projeto) {
      const { nodes: novoNodes, edges: novoEdges } = converterCalculosParaNodesEdges(
        calculos,
        projeto
      );

      // Adicionar callbacks aos nós
      const nodesComCallbacks = novoNodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          onUpdate: (campo, valor) => {
            // Será atualizado via handleUpdateNodeValue
          },
          onDelete: () => {
            // Será atualizado via handleDeleteNode
          }
        }
      }));

      setNodes(nodesComCallbacks);
      setEdges(novoEdges);

      const val = validarDiagrama(nodesComCallbacks);
      const valFluxo = validarFluxoEletricoCompleto(nodesComCallbacks);
      setValidacao({
        ...val,
        valido: val.valido && valFluxo.valido,
        erros: [...val.erros, ...valFluxo.erros]
      });

      if (onDiagramChange) {
        onDiagramChange({ nodes: nodesComCallbacks, edges: novoEdges });
      }
    }
  }, []); // Apenas na montagem

  // Quando nó é selecionado
  const handleNodeClick = useCallback((event, node) => {
    setSelectedNode(node.id);
  }, []);

  // Atualizar callbacks nos nós sempre que as funções mudam
  useEffect(() => {
    if (nodes.length > 0) {
      const nodesAtualizados = nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          onUpdate: (campo, valor) => handleUpdateNodeValue(node.id, campo, valor),
          onDelete: () => handleDeleteNode(node.id)
        }
      }));
      setNodes(nodesAtualizados);
    }
  }, []); // Apenas para inicializar os callbacks

  // Keyboard shortcuts para Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Z (ou Cmd+Z no Mac) para Desfazer
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (historioDiagrama.podeDesfazer && historioDiagrama.snapshotAtual) {
          const prevSnapshot = historioDiagrama.historia[historioDiagrama.posicaoAtual - 1];
          if (prevSnapshot) {
            setNodes(prevSnapshot.nodes);
            setEdges(prevSnapshot.edges);
          }
        }
        historioDiagrama.desfazer();
      }

      // Ctrl+Shift+Z (ou Cmd+Shift+Z no Mac) para Refazer
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (historioDiagrama.podeRefazer) {
          const nextSnapshot = historioDiagrama.historia[historioDiagrama.posicaoAtual + 1];
          if (nextSnapshot) {
            setNodes(nextSnapshot.nodes);
            setEdges(nextSnapshot.edges);
          }
        }
        historioDiagrama.refazer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historioDiagrama, setNodes, setEdges]);

  // Quando nó é movido
  const handleNodesChange_ = useCallback(
    changes => {
      onNodesChange(changes);

      // Se algum nó foi movido, notificar parent e adicionar ao histórico
      const moveEvent = changes.find(ch => ch.type === 'position');
      if (moveEvent && onDiagramChange) {
        historioDiagrama.adicionar(nodes, edges, 'Moveu nó(s)');
        onDiagramChange({ nodes, edges });
      }
    },
    [onNodesChange, nodes, edges, onDiagramChange, historioDiagrama]
  );

  // Quando valor de um nó é atualizado
  const handleUpdateNodeValue = useCallback(
    (nodeId, campo, valor) => {
      // Encontrar o nó e validar o novo valor
      const nodeParaAtualizar = nodes.find(n => n.id === nodeId);
      if (!nodeParaAtualizar) return;

      // Validar o valor ANTES de permitir atualização (validação bloqueante)
      const validacao = validarValorCampo(nodeParaAtualizar.data.tipo, campo, valor);
      if (!validacao.valido) {
        alert(validacao.erro);
        return; // Rejeita atualização
      }

      const nodesAtualizados = nodes.map(n => {
        if (n.id === nodeId) {
          const dataNova = { ...n.data, [campo]: valor };

          // Atualizar label também
          if (campo === 'corrente_projeto_a') {
            dataNova.label = `REDE\n${valor.toFixed(1)}A`;
          } else if (campo === 'corrente_a') {
            dataNova.label = `DISJUNTOR\n${valor}A`;
          } else if (campo === 'bitola_mm2') {
            dataNova.label = `CABO\n${valor}mm²`;
          } else if (campo === 'potencia_kw') {
            dataNova.label = `CARREGADOR\n${valor}kW`;
          }

          return { ...n, data: dataNova };
        }
        return n;
      });

      // Recalcular parâmetros elétricos se necessário
      const nodesComRecalculo = recalcularDiagrama(nodesAtualizados, nodeId);

      setNodes(nodesComRecalculo);

      // Adicionar ao histórico
      historioDiagrama.adicionar(
        nodesComRecalculo,
        edges,
        `Editou ${campo} do nó`
      );

      if (onDiagramChange) {
        onDiagramChange({ nodes: nodesComRecalculo, edges });
      }
    },
    [nodes, edges, setNodes, onDiagramChange, historioDiagrama]
  );

  // Deletar nó
  const handleDeleteNode = useCallback(
    (nodeId) => {
      const nodesAtualizados = nodes.filter(n => n.id !== nodeId);
      const edgesAtualizados = edges.filter(
        e => e.source !== nodeId && e.target !== nodeId
      );

      setNodes(nodesAtualizados);
      setEdges(edgesAtualizados);
      setSelectedNode(null);

      const val = validarDiagrama(nodesAtualizados);
      const valFluxo = validarFluxoEletricoCompleto(nodesAtualizados);
      setValidacao({
        ...val,
        valido: val.valido && valFluxo.valido,
        erros: [...val.erros, ...valFluxo.erros]
      });

      // Adicionar ao histórico
      historioDiagrama.adicionar(
        nodesAtualizados,
        edgesAtualizados,
        'Deletou nó'
      );

      if (onDiagramChange) {
        onDiagramChange({ nodes: nodesAtualizados, edges: edgesAtualizados });
      }
    },
    [nodes, edges, setNodes, setEdges, onDiagramChange, historioDiagrama]
  );

  // Quando nova conexão é feita
  const onConnect = useCallback(
    connection => {
      if (!readOnly) {
        // Validar conexão antes de adicionar
        const sourceNode = nodes.find(n => n.id === connection.source);
        const targetNode = nodes.find(n => n.id === connection.target);

        if (!sourceNode || !targetNode) return;

        const validacao = validarConexao(sourceNode.data.tipo, targetNode.data.tipo);
        if (!validacao.valido) {
          alert(`❌ ${validacao.erro}`);
          return;
        }

        // Determinar tipo de conexão esperado
        const tipoConexao = obterTipoConexaoEsperado(
          sourceNode.data.tipo,
          targetNode.data.tipo
        );

        // Criar edge com tipo de conexão
        const novaEdge = {
          ...connection,
          type: 'smoothstep',
          data: { tipo: tipoConexao }
        };

        const novasEdges = addEdge(novaEdge, edges);
        setEdges(novasEdges);

        // ✨ BUG FIX: Disparar onDiagramChange (era ignorado antes)
        // Adicionar ao histórico
        historioDiagrama.adicionar(
          nodes,
          novasEdges,
          `Conectou ${sourceNode.data.tipo} → ${targetNode.data.tipo}`
        );

        if (onDiagramChange) {
          onDiagramChange({ nodes, edges: novasEdges });
        }
      }
    },
    [readOnly, setEdges, nodes, edges, historioDiagrama, onDiagramChange]
  );

  // Resetar posições para layout padrão
  const handleResetarLayout = useCallback(() => {
    const nodesResetados = resetarPosicoes(nodes);
    setNodes(nodesResetados);
    historioDiagrama.adicionar(nodesResetados, edges, 'Reset layout');
    if (onDiagramChange) {
      onDiagramChange({ nodes: nodesResetados, edges });
    }
  }, [nodes, edges, setNodes, onDiagramChange, historioDiagrama]);

  // Alinhar nós à grade 16x16
  const handleAlinharGrade = useCallback(() => {
    const nodesAlinhados = nodes.map(node => ({
      ...node,
      position: {
        x: Math.round(node.position.x / 16) * 16,
        y: Math.round(node.position.y / 16) * 16
      }
    }));

    setNodes(nodesAlinhados);
    historioDiagrama.adicionar(nodesAlinhados, edges, 'Alinhados à grade');
    if (onDiagramChange) {
      onDiagramChange({ nodes: nodesAlinhados, edges });
    }
  }, [nodes, edges, setNodes, onDiagramChange, historioDiagrama]);

  // Adicionar componente customizado
  const handleSalvarCustomizado = useCallback(() => {
    if (!novoCustomizado.nome.trim()) {
      alert('⚠️ Nome do componente é obrigatório');
      return;
    }

    const camposCustos = {
      nome: novoCustomizado.nome,
      descricao: novoCustomizado.descricao,
      valores: {
        valor1: novoCustomizado.valor1,
        valor2: novoCustomizado.valor2
      }
    };

    handleAdicionarNode('customizado', camposCustos);

    // Limpar formulário e fechar modal
    setNovoCustomizado({ nome: '', descricao: '', valor1: '', valor2: '' });
    setMostraModalCustomizado(false);
  }, [novoCustomizado, handleAdicionarNode]);

  // Adicionar novo nó
  const handleAdicionarNode = useCallback(
    (tipo, camposCustos = {}) => {
      // Gerar ID único
      const id = `${tipo}-${Date.now()}`;
      const yOffset = Math.random() * 200;

      const novoNode = {
        id,
        type: usarRealista
          ? (tipo === 'customizado' ? 'customNodeRealista' : tipo + 'NodeRealista')
          : (tipo === 'customizado' ? 'customNode' : tipo + 'Node'),
        position: { x: 100 + Math.random() * 100, y: 50 + yOffset },
        data: {
          tipo: tipo,
          nome: camposCustos.nome || tipo.toUpperCase(),
          label: camposCustos.nome || tipo.toUpperCase(),
          editable: true,
          onUpdate: (campo, valor) => handleUpdateNodeValue(id, campo, valor),
          onDelete: () => handleDeleteNode(id),
          ...camposCustos // Mesclar campos customizados
        }
      };

      // Definir valores padrão conforme tipo
      if (tipo === 'rede') {
        novoNode.data.fases = 'Trifásico';
        novoNode.data.tensao = '380V';
        novoNode.data.corrente_projeto_a = 32.5;
      } else if (tipo === 'disjuntor') {
        novoNode.data.corrente_a = 32;
      } else if (tipo === 'dps') {
        novoNode.data.tensao_kv = 275;
        novoNode.data.capacidade_a = 50;
      } else if (tipo === 'dr') {
        novoNode.data.ma = 30;
      } else if (tipo === 'cabo') {
        novoNode.data.bitola_mm2 = 6;
        novoNode.data.comprimento_m = 10;
      } else if (tipo === 'carregador') {
        novoNode.data.potencia_kw = 7;
        novoNode.data.tipo_carregador = 'AC Trifásico';
      } else if (tipo === 'customizado') {
        novoNode.data.customizado = true;
        novoNode.data.valores = camposCustos.valores || {};
      }

      const nodesAtualizados = [...nodes, novoNode];
      setNodes(nodesAtualizados);

      // Adicionar ao histórico
      historioDiagrama.adicionar(
        nodesAtualizados,
        edges,
        `Adicionou ${tipo.toUpperCase()}`
      );

      if (onDiagramChange) {
        onDiagramChange({ nodes: nodesAtualizados, edges });
      }
    },
    [nodes, edges, setNodes, onDiagramChange, handleUpdateNodeValue, handleDeleteNode, historioDiagrama]
  );

  // Exportar diagrama como JSON
  const handleExportarJSON = useCallback(() => {
    const dados = JSON.stringify({ nodes, edges }, null, 2);
    const blob = new Blob([dados], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diagrama-${projeto?.projeto_nome || 'sem-nome'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [nodes, edges, projeto]);

  // Obter dados do nó selecionado
  const selectedNodeData = selectedNode ? nodes.find(n => n.id === selectedNode)?.data : null;

  // Gerar avisos de validação para o nó selecionado
  const obterAvisosNode = () => {
    if (!selectedNodeData) return [];

    const avisos = [];
    const cableNode = nodes.find(n => n.data.tipo === 'cabo');
    const gridNode = nodes.find(n => n.data.tipo === 'rede');

    if (selectedNodeData.tipo === 'cabo' && cableNode) {
      const { bitola_mm2, comprimento_m } = selectedNodeData;
      const queda = (2 * 0.0179 * comprimento_m * (gridNode?.data.corrente_projeto_a || 32.5)) / bitola_mm2;
      const quedaPct = (queda / (gridNode?.data.tensao === '220V' ? 220 : 380)) * 100;

      if (quedaPct > 3) {
        avisos.push(`⚠ Queda de tensão alta: ${quedaPct.toFixed(2)}% (máximo: 3%)`);
      }
    }

    return avisos;
  };

  return (
    <div className="interactive-diagram-container">
      {/* Toolbar */}
      <div className="diagram-toolbar">
        <div className="toolbar-group">
          <h3>Editor de Diagrama</h3>
          <span className="toolbar-subtitle">
            {validacao.valido ? '✓ Válido' : '⚠ Erros de validação'}
          </span>
        </div>

        {!readOnly && (
          <div className="toolbar-library">
            <span className="library-label">Adicionar:</span>
            <button
              onClick={() => handleAdicionarNode('rede')}
              className="btn-add btn-rede"
              title="Adicionar REDE"
            >
              REDE
            </button>
            <button
              onClick={() => handleAdicionarNode('disjuntor')}
              className="btn-add btn-disjuntor"
              title="Adicionar DISJUNTOR"
            >
              DISJ.
            </button>
            <button
              onClick={() => handleAdicionarNode('dps')}
              className="btn-add btn-dps"
              title="Adicionar DPS (Proteção contra Surtos) - OBRIGATÓRIO"
            >
              DPS ⚡
            </button>
            <button
              onClick={() => handleAdicionarNode('dr')}
              className="btn-add btn-dr"
              title="Adicionar DR"
            >
              DR
            </button>
            <button
              onClick={() => handleAdicionarNode('cabo')}
              className="btn-add btn-cabo"
              title="Adicionar CABO"
            >
              CABO
            </button>
            <button
              onClick={() => handleAdicionarNode('carregador')}
              className="btn-add btn-carregador"
              title="Adicionar CARREGADOR"
            >
              CARR.
            </button>
            <button
              onClick={() => setMostraModalCustomizado(true)}
              className="btn-add btn-custom"
              title="Adicionar componente customizado/editável"
            >
              ➕ Customizado
            </button>
          </div>
        )}

        <div className="toolbar-actions">
          {!readOnly && (
            <>
              <button
                onClick={() => setUsarRealista(!usarRealista)}
                className="btn btn-secondary"
                title={usarRealista ? 'Mostrar vista genérica' : 'Mostrar vista realista'}
              >
                {usarRealista ? '🎨 Realista' : '📐 Genérico'}
              </button>
              <button
                onClick={historioDiagrama.desfazer}
                disabled={!historioDiagrama.podeDesfazer}
                className="btn btn-secondary"
                title="Desfazer (Ctrl+Z)"
              >
                ↶ Desfazer
              </button>
              <button
                onClick={historioDiagrama.refazer}
                disabled={!historioDiagrama.podeRefazer}
                className="btn btn-secondary"
                title="Refazer (Ctrl+Shift+Z)"
              >
                ↷ Refazer
              </button>
              <button
                onClick={handleAlinharGrade}
                className="btn btn-secondary"
                title="Alinhar todos ao grid (16×16px)"
              >
                ⊞ Alinhar à Grade
              </button>
              <button
                onClick={handleResetarLayout}
                className="btn btn-secondary"
                title="Resetar layout para posição padrão"
              >
                📐 Reset Layout
              </button>
              <button
                onClick={handleExportarJSON}
                className="btn btn-secondary"
                title="Exportar diagrama como JSON"
              >
                💾 Exportar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="diagram-content">
        {/* Canvas React Flow */}
        <div className="diagram-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange_}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            snapToGrid={true}
            snapGrid={[16, 16]}
            fitView
            attributionPosition="bottom-left"
          >
            <Background color="#aaa" gap={16} />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {/* Painel de Propriedades */}
        {selectedNodeData && (
          <div className="properties-panel">
            <h4>Propriedades do Componente</h4>

            {/* Avisos de Validação */}
            {obterAvisosNode().length > 0 && (
              <div className="node-warnings">
                {obterAvisosNode().map((aviso, idx) => (
                  <div key={idx} className="warning-item">
                    {aviso}
                  </div>
                ))}
              </div>
            )}

            <div className="properties-content">
              <div className="prop-item">
                <span className="prop-label">Tipo:</span>
                <span className="prop-value">{selectedNodeData.tipo?.toUpperCase()}</span>
              </div>

              {selectedNodeData.tipo === 'rede' && (
                <>
                  <div className="prop-item">
                    <span className="prop-label">Fases:</span>
                    <span className="prop-value">{selectedNodeData.fases}</span>
                  </div>
                  <div className="prop-item">
                    <span className="prop-label">Tensão:</span>
                    <span className="prop-value">{selectedNodeData.tensao}</span>
                  </div>
                  <div className="prop-item">
                    <span className="prop-label">Corrente Projeto:</span>
                    <span className="prop-value">
                      {selectedNodeData.corrente_projeto_a?.toFixed(1)}A
                    </span>
                  </div>
                </>
              )}

              {selectedNodeData.tipo === 'disjuntor' && (
                <>
                  <div className="prop-item">
                    <span className="prop-label">Corrente:</span>
                    <span className="prop-value">{selectedNodeData.corrente_a}A</span>
                  </div>
                  <div className="prop-item">
                    <span className="prop-label">Máxima Segurança:</span>
                    <span className="prop-value">
                      {selectedNodeData.corrente_maxima_a?.toFixed(1)}A
                    </span>
                  </div>
                </>
              )}

              {selectedNodeData.tipo === 'dr' && (
                <div className="prop-item">
                  <span className="prop-label">Sensibilidade:</span>
                  <span className="prop-value">{selectedNodeData.ma}mA</span>
                </div>
              )}

              {selectedNodeData.tipo === 'cabo' && (
                <>
                  <div className="prop-item">
                    <span className="prop-label">Bitola:</span>
                    <span className="prop-value">{selectedNodeData.bitola_mm2}mm²</span>
                  </div>
                  <div className="prop-item">
                    <span className="prop-label">Comprimento:</span>
                    <span className="prop-value">{selectedNodeData.comprimento_m}m</span>
                  </div>
                </>
              )}

              {selectedNodeData.tipo === 'carregador' && (
                <>
                  <div className="prop-item">
                    <span className="prop-label">Potência:</span>
                    <span className="prop-value">{selectedNodeData.potencia_kw}kW</span>
                  </div>
                  <div className="prop-item">
                    <span className="prop-label">Tipo:</span>
                    <span className="prop-value">{selectedNodeData.tipo_carregador}</span>
                  </div>
                  <div className="prop-item">
                    <span className="prop-label">Marca/Modelo:</span>
                    <span className="prop-value">
                      {selectedNodeData.marca} {selectedNodeData.modelo}
                    </span>
                  </div>
                </>
              )}
            </div>

            {selectedNodeData.tipo === 'specs' && (
              <div className="specs-panel">
                <h5>Especificações do Projeto</h5>
                <div className="specs-grid">
                  <div className="spec-item">
                    <span className="spec-label">Queda Tensão:</span>
                    <span className="spec-value">
                      {selectedNodeData.queda_tensao_pct?.toFixed(2)}%
                    </span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Tempo Seccionamento:</span>
                    <span className="spec-value">
                      {selectedNodeData.tempo_seccionamento_s}s
                    </span>
                  </div>
                </div>

                {selectedNodeData.projeto_nome && (
                  <div className="spec-info">
                    <p><strong>Projeto:</strong> {selectedNodeData.projeto_nome}</p>
                    <p><strong>Cliente:</strong> {selectedNodeData.cliente_nome}</p>
                    <p><strong>Técnico:</strong> {selectedNodeData.tecnico_nome}</p>
                    <p><strong>CREA/CFT:</strong> {selectedNodeData.tecnico_crea}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mensagens de Validação */}
      {validacao.erros.length > 0 && (
        <div className="diagram-errors">
          <h4>⚠ Erros de Validação:</h4>
          <ul>
            {validacao.erros.map((erro, idx) => (
              <li key={idx}>{erro}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal para Adicionar Componente Customizado */}
      {mostraModalCustomizado && (
        <div className="modal-overlay" onClick={() => setMostraModalCustomizado(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>➕ Adicionar Componente Customizado</h3>
              <button
                className="modal-close"
                onClick={() => setMostraModalCustomizado(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Nome do Componente *</label>
                <input
                  type="text"
                  placeholder="Ex: Transformador, Protetor de surto adicional, etc"
                  value={novoCustomizado.nome}
                  onChange={e =>
                    setNovoCustomizado({ ...novoCustomizado, nome: e.target.value })
                  }
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Descrição</label>
                <input
                  type="text"
                  placeholder="Ex: 10 kVA, 30mA, etc"
                  value={novoCustomizado.descricao}
                  onChange={e =>
                    setNovoCustomizado({
                      ...novoCustomizado,
                      descricao: e.target.value
                    })
                  }
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Valor 1 (Especificação)</label>
                <input
                  type="text"
                  placeholder="Ex: 50A, 200V, etc"
                  value={novoCustomizado.valor1}
                  onChange={e =>
                    setNovoCustomizado({ ...novoCustomizado, valor1: e.target.value })
                  }
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Valor 2 (Especificação)</label>
                <input
                  type="text"
                  placeholder="Ex: Classe II, 5A, etc"
                  value={novoCustomizado.valor2}
                  onChange={e =>
                    setNovoCustomizado({ ...novoCustomizado, valor2: e.target.value })
                  }
                  className="form-input"
                />
              </div>

              <div className="modal-help">
                <p>
                  💡 <strong>Dica:</strong> Componentes customizados podem ser
                  editados e movidos livremente no diagrama para se adaptar às
                  suas necessidades específicas.
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={handleSalvarCustomizado}
              >
                ➕ Adicionar Componente
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setMostraModalCustomizado(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
