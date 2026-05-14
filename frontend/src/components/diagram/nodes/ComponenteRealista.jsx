import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Trash2, Edit2 } from 'lucide-react';
import '../ComponenteRealista.css';

/**
 * Componente Visual Realista para Diagrama Unifilar
 * Renderiza desenhos dos componentes elétricos de forma realista
 */
export default function ComponenteRealista({ data, selected, id }) {
  const [editando, setEditando] = useState(false);
  const [valores, setValores] = useState({
    corrente: data.corrente_a || data.tensao_kv || data.ma || data.bitola_mm2 || '',
    unidade: data.unidade || (data.corrente_a ? 'A' : data.tensao_kv ? 'V' : data.ma ? 'mA' : 'mm²'),
    descricao: data.descricao || ''
  });

  const obterSVGComponente = () => {
    const tamanho = 70;
    const tipo = data.tipo;

    switch (tipo) {
      case 'rede':
        return `
          <circle cx="0" cy="0" r="${tamanho / 2}" fill="#f97316" stroke="#ea580c" stroke-width="2"/>
          <text x="0" y="0" text-anchor="middle" dy="0.3em" fill="white" font-size="16" font-weight="bold">~</text>
        `;

      case 'cabo':
        return `
          <rect x="${-tamanho / 2}" y="${-tamanho / 2}" width="${tamanho}" height="${tamanho}" fill="#10b981" stroke="#059669" stroke-width="2" rx="4"/>
          <text x="0" y="-8" text-anchor="middle" fill="white" font-size="12" font-weight="bold">CABO</text>
          <text x="0" y="10" text-anchor="middle" fill="white" font-size="11" font-weight="bold">${valores.corrente}${valores.unidade}</text>
        `;

      case 'disjuntor':
        return `
          <rect x="${-tamanho / 2}" y="${-tamanho / 2}" width="${tamanho}" height="${tamanho}" fill="#e8f4f8" stroke="#3b82f6" stroke-width="2" rx="3"/>
          <!-- Alavancas -->
          <rect x="${-20}" y="${-18}" width="13" height="22" fill="#333" stroke="#000" stroke-width="1" rx="2"/>
          <rect x="${7}" y="${-18}" width="13" height="22" fill="#333" stroke="#000" stroke-width="1" rx="2"/>
          <text x="0" y="15" text-anchor="middle" fill="#1e40af" font-size="11" font-weight="bold">Disjuntor</text>
          <text x="0" y="28" text-anchor="middle" fill="#1e40af" font-size="10">${valores.corrente}${valores.unidade}</text>
        `;

      case 'dps':
        return `
          <rect x="${-tamanho / 2}" y="${-tamanho / 2}" width="${tamanho}" height="${tamanho}" fill="#fed7aa" stroke="#fb923c" stroke-width="3" rx="3"/>
          <rect x="${-16}" y="${-14}" width="32" height="28" fill="#fff7ed" stroke="#f97316" stroke-width="1" rx="2"/>
          <polygon points="0,-6 10,8 -10,8" fill="#ff6b35"/>
          <circle cx="14" cy="6" r="3" fill="#dc2626"/>
          <text x="0" y="25" text-anchor="middle" fill="#92400e" font-size="11" font-weight="bold">DPS ⚡</text>
          <text x="0" y="38" text-anchor="middle" fill="#92400e" font-size="10">${valores.corrente}${valores.unidade}</text>
        `;

      case 'dr':
        return `
          <rect x="${-tamanho / 2}" y="${-tamanho / 2}" width="${tamanho}" height="${tamanho}" fill="#f3e8ff" stroke="#a855f7" stroke-width="2" rx="3"/>
          <!-- Alavancas -->
          <rect x="${-20}" y="${-18}" width="13" height="22" fill="#333" stroke="#000" stroke-width="1" rx="2"/>
          <rect x="${7}" y="${-18}" width="13" height="22" fill="#333" stroke="#000" stroke-width="1" rx="2"/>
          <!-- Botão TEST -->
          <circle cx="0" cy="8" r="6" fill="#ef4444" stroke="#dc2626" stroke-width="1"/>
          <text x="0" y="10" text-anchor="middle" dy="0.2em" fill="white" font-size="8" font-weight="bold">T</text>
          <text x="0" y="25" text-anchor="middle" fill="#5b21b6" font-size="11" font-weight="bold">IDR</text>
          <text x="0" y="38" text-anchor="middle" fill="#5b21b6" font-size="10">${valores.corrente}${valores.unidade}</text>
        `;

      case 'carregador':
        return `
          <rect x="${-tamanho / 2}" y="${-tamanho / 2}" width="${tamanho}" height="${tamanho}" fill="#fbcfe8" stroke="#db2777" stroke-width="2" rx="4"/>
          <rect x="${-22}" y="${-18}" width="44" height="32" fill="#fce7f3" stroke="#db2777" stroke-width="1" rx="2"/>
          <circle cx="0" cy="-8" r="3" fill="#10b981" stroke="#059669" stroke-width="1"/>
          <rect x="${-8}" y="16" width="16" height="8" fill="#666" stroke="#333" stroke-width="1" rx="1"/>
          <text x="0" y="28" text-anchor="middle" fill="#831843" font-size="11" font-weight="bold">Carregador</text>
          <text x="0" y="41" text-anchor="middle" fill="#831843" font-size="10">${valores.corrente}${valores.unidade}</text>
        `;

      case 'customizado':
        return `
          <rect x="${-tamanho / 2}" y="${-tamanho / 2}" width="${tamanho}" height="${tamanho}" fill="#fef08a" stroke="#facc15" stroke-width="2" rx="4"/>
          <text x="0" y="-8" text-anchor="middle" fill="#713f12" font-size="11" font-weight="bold">${data.nome || 'Customizado'}</text>
          ${valores.descricao ? `<text x="0" y="8" text-anchor="middle" fill="#713f12" font-size="9">${valores.descricao}</text>` : ''}
          <text x="0" y="25" text-anchor="middle" fill="#713f12" font-size="10" font-weight="bold">${valores.corrente}${valores.unidade}</text>
        `;

      default:
        return '';
    }
  };

  const handleSalvarEdicao = () => {
    if (data.onUpdate) {
      data.onUpdate('valor', valores.corrente);
      if (valores.unidade) {
        data.onUpdate('unidade', valores.unidade);
      }
      if (valores.descricao) {
        data.onUpdate('descricao', valores.descricao);
      }
    }
    setEditando(false);
  };

  return (
    <div className={`componente-realista ${selected ? 'selected' : ''} ${editando ? 'editing' : ''}`}>
      {/* SVG do Componente */}
      <svg width="140" height="140" viewBox="-70 -70 140 140" className="componente-svg">
        {/* Handles de conexão */}
        {data.tipo !== 'specs' && (
          <>
            <Handle
              type="target"
              position={Position.Top}
              style={{
                background: '#10b981',
                width: 8,
                height: 8
              }}
            />
            <Handle
              type="source"
              position={Position.Bottom}
              style={{
                background: '#10b981',
                width: 8,
                height: 8
              }}
            />
          </>
        )}

        {/* Renderizar SVG do componente */}
        <g dangerouslySetInnerHTML={{ __html: obterSVGComponente() }} />
      </svg>

      {/* Toolbar de edição */}
      {!editando && (
        <div className="componente-toolbar">
          <button
            onClick={() => setEditando(true)}
            className="btn-edit"
            title="Editar componente"
          >
            <Edit2 size={16} />
          </button>
          {data.onDelete && (
            <button
              onClick={data.onDelete}
              className="btn-delete"
              title="Deletar componente"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}

      {/* Modal de edição */}
      {editando && (
        <div className="componente-edit-modal">
          <h4>{data.nome || data.tipo?.toUpperCase()}</h4>

          <div className="edit-field">
            <label>Valor:</label>
            <input
              type="text"
              value={valores.corrente}
              onChange={e => setValores({ ...valores, corrente: e.target.value })}
              placeholder="Ex: 32, 10, 30"
              autoFocus
            />
          </div>

          <div className="edit-field">
            <label>Unidade:</label>
            <select
              value={valores.unidade}
              onChange={e => setValores({ ...valores, unidade: e.target.value })}
            >
              <option value="A">A (Amperes)</option>
              <option value="V">V (Volts)</option>
              <option value="mA">mA (miliAmperes)</option>
              <option value="mm²">mm² (milímetros)</option>
              <option value="kW">kW (kilowatts)</option>
              <option value="">Sem unidade</option>
            </select>
          </div>

          <div className="edit-field">
            <label>Descrição:</label>
            <input
              type="text"
              value={valores.descricao}
              onChange={e => setValores({ ...valores, descricao: e.target.value })}
              placeholder="Ex: Bipolar, Tipo A, etc"
            />
          </div>

          <div className="edit-buttons">
            <button onClick={handleSalvarEdicao} className="btn-save">
              ✓ Salvar
            </button>
            <button onClick={() => setEditando(false)} className="btn-cancel">
              ✕ Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
