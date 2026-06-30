import React, { useState, useCallback } from 'react';
import { BaseEdge, useStore } from 'reactflow';
import { CORES_CONDUTOR } from '@diagram-engine';
import { COND_GAP } from '@diagram-engine/geometry';
import EdgeContextMenu from './EdgeContextMenu';
import './CustomEdge.css';

/**
 * CustomEdge — P3-PARITY: cabos IDÊNTICOS ao SVG executivo.
 *
 * Desenha retas CENTRO→CENTRO dos componentes (mesma origem do svgRenderer:
 * desenharConexoes usa centro do componente), um caminho por CONDUTOR, com o mesmo
 * COND_GAP e a mesma paleta CORES_CONDUTOR. Terra (derivação) = tracejado.
 *
 * Não usa as posições de handle do React Flow (que dariam traçado borda-a-borda):
 * lê o centro de cada nó do store, garantindo paridade exata com o Executivo.
 */
function centroDoNo(n) {
  if (!n) return null;
  const p = n.positionAbsolute || n.position || { x: 0, y: 0 };
  return { x: p.x + (n.width || 0) / 2, y: p.y + (n.height || 0) / 2 };
}

export default function CustomEdge({ id, source, target, data, selected }) {
  const [menu, setMenu] = useState(null);
  const sourceNode = useStore((s) => s.nodeInternals.get(source));
  const targetNode = useStore((s) => s.nodeInternals.get(target));

  const a = centroDoNo(sourceNode);
  const b = centroDoNo(targetNode);
  if (!a || !b) return null;

  const condutores = (data?.condutores && data.condutores.length) ? data.condutores : [{ papel: 'fase' }];
  const tracejado = !!data?.tracejado;
  const n = condutores.length;

  const onCtx = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY });
  }, []);

  return (
    <>
      {condutores.map((c, i) => {
        const off = (i - (n - 1) / 2) * COND_GAP;
        const path = `M ${a.x},${a.y + off} L ${b.x},${b.y + off}`;
        const corBase = CORES_CONDUTOR[c.papel] || '#555';
        const stroke = corBase.toLowerCase() === '#ffffff' ? '#94a3b8' : corBase;
        return (
          <BaseEdge
            key={i}
            path={path}
            interactionWidth={i === 0 ? 14 : 0}
            onContextMenu={i === 0 ? onCtx : undefined}
            style={{
              stroke,
              strokeWidth: selected ? 2.6 : 2,
              strokeDasharray: tracejado ? '6 4' : undefined,
            }}
          />
        );
      })}

      {menu && (
        <EdgeContextMenu
          edge={{ id, source, target, data }}
          position={menu}
          onTypeChange={() => setMenu(null)}
          onDelete={() => { if (data?.onDelete) data.onDelete(id); setMenu(null); }}
          onClose={() => setMenu(null)}
        />
      )}
      {menu && <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setMenu(null)} />}
    </>
  );
}
