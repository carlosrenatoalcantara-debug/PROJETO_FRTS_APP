import React, { useState, useCallback } from 'react';
import {
  EdgeLabelRenderer,
  BaseEdge,
  getSmoothStepPath,
  useReactFlow
} from 'reactflow';
import EdgeContextMenu from './EdgeContextMenu';
import './CustomEdge.css';

/**
 * Edge (conexão) customizado com suporte a:
 * - Diferentes tipos (CA, CC, Terra)
 * - Context menu para edição
 * - Cores e estilos diferentes por tipo
 * - Animação de fluxo
 */
export default function CustomEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  markerEnd,
  selected
}) {
  const [mostraContextMenu, setMostraContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const { getNode, setEdges } = useReactFlow();

  // Tipo de conexão (CA, CC, Terra)
  const tipo = data?.tipo || 'CA';
  const cores = {
    'CA': '#3b82f6',      // Azul
    'CC': '#ef4444',      // Vermelho
    'TERRA': '#059669'    // Verde
  };
  const cor = cores[tipo] || cores['CA'];

  // Gerar path da edge
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY
  });

  // Context menu
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenuPos({
      x: e.clientX,
      y: e.clientY
    });
    setMostraContextMenu(true);
  }, []);

  const handleTypeChange = useCallback((edgeId, novoTipo) => {
    // Recuperar handlers da data
    if (data?.onTypeChange) {
      data.onTypeChange(edgeId, novoTipo);
    }
    setMostraContextMenu(false);
  }, [data]);

  const handleDelete = useCallback((edgeId) => {
    // Recuperar handlers da data
    if (data?.onDelete) {
      data.onDelete(edgeId);
    }
    setMostraContextMenu(false);
  }, [data]);

  return (
    <>
      {/* Edge principal */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: cor,
          strokeWidth: selected ? 3 : 2,
          filter: selected ? `drop-shadow(0 0 4px ${cor}80)` : 'none',
          transition: 'all 0.2s ease'
        }}
        className={`custom-edge ${selected ? 'selected' : ''}`}
        onContextMenu={handleContextMenu}
      />

      {/* Label com tipo de conexão */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            zIndex: selected ? 100 : 10
          }}
          className="edge-label-container"
        >
          <div
            className="edge-label"
            style={{
              backgroundColor: cor,
              borderColor: cor
            }}
            onContextMenu={handleContextMenu}
            title={`Clique direito para editar\nTipo: ${tipo}`}
          >
            {tipo}
          </div>
        </div>
      </EdgeLabelRenderer>

      {/* Context Menu */}
      {mostraContextMenu && (
        <EdgeContextMenu
          edge={{
            id,
            source,
            target,
            data
          }}
          position={contextMenuPos}
          onTypeChange={handleTypeChange}
          onDelete={handleDelete}
          onClose={() => setMostraContextMenu(false)}
        />
      )}

      {/* Fechar menu ao clicar em outro lugar */}
      {mostraContextMenu && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
          onClick={() => setMostraContextMenu(false)}
        />
      )}
    </>
  );
}
