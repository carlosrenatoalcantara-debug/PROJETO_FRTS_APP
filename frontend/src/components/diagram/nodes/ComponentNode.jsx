import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { Trash2 } from 'lucide-react';
import { obterHandlesCompativeis } from '../utils/connectionValidator';
import './ComponentNode.css';

/**
 * Nó genérico de componente no diagrama
 * Renderiza um componente elétrico com handles para conexão
 * Suporta edição inline de valores
 */
export default function ComponentNode({ data, selected, isConnecting, id }) {
  const [editando, setEditando] = useState(false);
  const [campoEditando, setCampoEditando] = useState(null); // Qual campo está sendo editado
  const [valoresTemp, setValoresTemp] = useState({});

  // Inicializar valores temporários quando entra em modo edição
  useEffect(() => {
    if (editando) {
      const valores = {};
      if (data.tipo === 'rede') {
        valores.corrente_projeto_a = data.corrente_projeto_a || '';
      } else if (data.tipo === 'disjuntor') {
        valores.corrente_a = data.corrente_a || '';
      } else if (data.tipo === 'dr') {
        valores.ma = data.ma || '';
      } else if (data.tipo === 'cabo') {
        valores.bitola_mm2 = data.bitola_mm2 || '';
        valores.comprimento_m = data.comprimento_m || '';
      } else if (data.tipo === 'carregador') {
        valores.potencia_kw = data.potencia_kw || '';
      }
      setValoresTemp(valores);
    }
  }, [editando, data]);

  const handleDoubleClick = () => {
    if (data.editable !== false && data.tipo !== 'specs') {
      setEditando(true);
    }
  };

  const handleEditarCampo = (campo) => {
    setCampoEditando(campo);
  };

  const handleSalvarCampo = (campo) => {
    if (data.onUpdate) {
      data.onUpdate(campo, valoresTemp[campo]);
    }
    setCampoEditando(null);
  };

  const handleCancelar = () => {
    setEditando(false);
    setCampoEditando(null);
  };

  const handleDeletar = () => {
    if (window.confirm(`Tem certeza que deseja deletar ${data.nome}?`)) {
      if (data.onDelete) {
        data.onDelete();
      }
    }
  };

  const obterEstilo = () => {
    const estilos = {
      rede: {
        background: '#f97316',
        borderColor: '#ea580c'
      },
      disjuntor: {
        background: '#3b82f6',
        borderColor: '#1d4ed8'
      },
      dr: {
        background: '#8b5cf6',
        borderColor: '#7c3aed'
      },
      cabo: {
        background: '#10b981',
        borderColor: '#059669'
      },
      carregador: {
        background: '#ec4899',
        borderColor: '#db2777'
      },
      specs: {
        background: '#f3f4f6',
        borderColor: '#d1d5db',
        color: '#1f2937'
      }
    };

    return estilos[data.tipo] || estilos.rede;
  };

  const estilo = obterEstilo();
  const naoEhEspecificacoes = data.tipo !== 'specs';

  // Determinar cores dos handles baseado em compatibilidade
  const obterCoresHandle = () => {
    if (!isConnecting) {
      // Sem conexão em andamento, usar cor padrão
      return { background: '#666', opacity: 1 };
    }

    // Há uma conexão em andamento - verificar compatibilidade
    // isConnecting é true quando há drag de um handle
    // connectionNodeId é undefined neste contexto, então usamos um approach diferente
    // Realçar todos os handles quando não há conexão em andamento
    return { background: '#10b981', opacity: 1 };
  };

  const coloresHandle = obterCoresHandle();

  const renderEditableField = (label, campo, valor, tipo = 'number') => {
    if (campoEditando === campo) {
      return (
        <div key={campo} className="node-field-edit">
          <input
            type={tipo}
            value={valoresTemp[campo] || ''}
            onChange={e => setValoresTemp({ ...valoresTemp, [campo]: e.target.value })}
            autoFocus
            className="node-field-input"
            step={tipo === 'number' ? '0.1' : undefined}
            min={tipo === 'number' ? '0' : undefined}
          />
          <div className="field-buttons">
            <button
              onClick={() => handleSalvarCampo(campo)}
              className="btn-save-field"
              title="Salvar"
            >
              ✓
            </button>
            <button
              onClick={() => setCampoEditando(null)}
              className="btn-cancel-field"
              title="Cancelar"
            >
              ✕
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={campo} className="node-field" onDoubleClick={() => handleEditarCampo(campo)}>
        <span className="field-label">{label}:</span>
        <span className="field-value">{valor}</span>
      </div>
    );
  };

  return (
    <div
      className={`component-node ${selected ? 'selected' : ''} ${
        editando ? 'editing' : ''
      }`}
      style={{
        background: estilo.background,
        borderColor: estilo.borderColor,
        color: estilo.color || '#fff'
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Handles de entrada/saída para conexões */}
      {naoEhEspecificacoes && (
        <>
          <Handle
            type="target"
            position={Position.Top}
            isConnectable={true}
            style={{
              background: coloresHandle.background,
              opacity: coloresHandle.opacity,
              transition: 'all 0.2s ease'
            }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            isConnectable={true}
            style={{
              background: coloresHandle.background,
              opacity: coloresHandle.opacity,
              transition: 'all 0.2s ease'
            }}
          />
        </>
      )}

      {editando && data.tipo !== 'specs' ? (
        <div className="node-edit">
          <div className="node-edit-header">
            <h4>{data.nome}</h4>
            <button
              onClick={handleDeletar}
              className="btn-delete"
              title="Deletar componente"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div className="node-fields">
            {data.tipo === 'rede' && (
              <>
                {renderEditableField('Corrente (A)', 'corrente_projeto_a', valoresTemp.corrente_projeto_a || data.corrente_projeto_a)}
              </>
            )}

            {data.tipo === 'disjuntor' && (
              <>
                {renderEditableField('Corrente (A)', 'corrente_a', valoresTemp.corrente_a || data.corrente_a)}
              </>
            )}

            {data.tipo === 'dr' && (
              <>
                {renderEditableField('Sensibilidade (mA)', 'ma', valoresTemp.ma || data.ma)}
              </>
            )}

            {data.tipo === 'cabo' && (
              <>
                {renderEditableField('Bitola (mm²)', 'bitola_mm2', valoresTemp.bitola_mm2 || data.bitola_mm2)}
                {renderEditableField('Comprimento (m)', 'comprimento_m', valoresTemp.comprimento_m || data.comprimento_m)}
              </>
            )}

            {data.tipo === 'carregador' && (
              <>
                {renderEditableField('Potência (kW)', 'potencia_kw', valoresTemp.potencia_kw || data.potencia_kw)}
              </>
            )}
          </div>

          <div className="node-edit-footer">
            <button onClick={handleCancelar} className="btn-cancel-edit">
              Fechar Edição
            </button>
          </div>
        </div>
      ) : (
        <div className="node-content">
          <div className="node-label">{data.label || data.nome}</div>
          {data.detalhes && (
            <div className="node-details">{data.detalhes}</div>
          )}
        </div>
      )}
    </div>
  );
}
