import React, { useState } from 'react';
import { Trash2, Zap } from 'lucide-react';
import './EdgeContextMenu.css';

/**
 * Menu de contexto para editar propriedades de edge (conexão)
 * Permite: alterar tipo de conexão (CA, CC, Terra), deletar, etc
 */
export function EdgeContextMenu({
  edge,
  position,
  onTypeChange,
  onDelete,
  onClose
}) {
  const [mostraSubmenu, setMostraSubmenu] = useState(false);

  const tipos = [
    { id: 'CA', label: 'CA (Corrente Alternada)', cor: '#3b82f6' },
    { id: 'CC', label: 'CC (Corrente Contínua)', cor: '#ef4444' },
    { id: 'TERRA', label: 'Terra/Neutro', cor: '#059669' }
  ];

  const handleTypeSelect = (tipo) => {
    onTypeChange(edge.id, tipo.id);
    onClose();
  };

  const handleDelete = () => {
    onDelete(edge.id);
    onClose();
  };

  return (
    <div
      className="edge-context-menu"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Alterar tipo de conexão */}
      <div
        className="menu-item menu-submenu"
        onMouseEnter={() => setMostraSubmenu(true)}
        onMouseLeave={() => setMostraSubmenu(false)}
      >
        <Zap size={14} />
        <span>Tipo de Conexão</span>
        <span className="submenu-arrow">▶</span>

        {mostraSubmenu && (
          <div className="submenu">
            {tipos.map(tipo => (
              <div
                key={tipo.id}
                className={`submenu-item ${edge.data?.tipo === tipo.id ? 'active' : ''}`}
                onClick={() => handleTypeSelect(tipo)}
              >
                <div
                  className="tipo-indicator"
                  style={{ backgroundColor: tipo.cor }}
                />
                <span>{tipo.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deletar conexão */}
      <div className="menu-item menu-delete" onClick={handleDelete}>
        <Trash2 size={14} />
        <span>Deletar Conexão</span>
      </div>

      {/* Info da conexão */}
      <div className="menu-info">
        <div className="info-row">
          <span className="info-label">Origem:</span>
          <span className="info-value">{edge.source}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Destino:</span>
          <span className="info-value">{edge.target}</span>
        </div>
        {edge.data?.tipo && (
          <div className="info-row">
            <span className="info-label">Tipo:</span>
            <span className="info-value">{edge.data.tipo}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default EdgeContextMenu;
