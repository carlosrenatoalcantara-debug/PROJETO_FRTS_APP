/**
 * ComponenteExecutivo.jsx — P3-EV-EDITOR-PARITY-EXECUTIVO-01
 *
 * Nó do React Flow que desenha EXATAMENTE o mesmo símbolo do SVG executivo,
 * usando `desenharComponente` do módulo de símbolos do Engine (fonte única).
 * Não existe mais um conjunto "simplificado" de símbolos para o editor.
 *
 * Também exporta o nó de FUNDO `A4Chrome`: o SVG vetorial do documento (cabeçalho,
 * blocos, BOM, notas, moldura, QR) gerado pelo Engine sem o diagrama — o React Flow
 * apenas sobrepõe os componentes editáveis sobre ele, no mesmo sistema de coords.
 */
import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { desenharComponente } from '@diagram-engine/symbols'
import { COMPONENTE } from '@diagram-engine/geometry'

const handleLR = { background: '#10b981', width: 9, height: 9 }
const handleTB = { background: '#2e9e3f', width: 9, height: 9 }

function ComponenteExecutivoBase({ data, selected }) {
  // Usa o componente canônico original (mesma entrada do SVG executivo).
  const c = data?.componente || {
    tipo: data?.tipo, subtipo: data?.subtipo, label: data?.label,
    polos: data?.polos, specs: data?.specs || data,
  }
  const svg = desenharComponente(c, { x: 0, y: 0 })

  return (
    <div style={{ width: COMPONENTE.W, height: COMPONENTE.H, position: 'relative' }}>
      <Handle id="in" type="target" position={Position.Left} style={handleLR} />
      <Handle id="out" type="source" position={Position.Right} style={handleLR} />
      <Handle id="gnd" type="source" position={Position.Bottom} style={handleTB} />
      <Handle id="gtop" type="target" position={Position.Top} style={handleTB} />
      <svg
        width={COMPONENTE.W} height={COMPONENTE.H}
        viewBox={`0 0 ${COMPONENTE.W} ${COMPONENTE.H}`}
        style={{ overflow: 'visible', borderRadius: 8, outline: selected ? '2px solid #2563eb' : 'none' }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}

export const ComponenteExecutivo = memo(ComponenteExecutivoBase)

// Nó de fundo: documento executivo (chrome) como SVG vetorial inline. Não editável.
function A4ChromeBase({ data }) {
  return (
    <div
      style={{ pointerEvents: 'none', userSelect: 'none' }}
      dangerouslySetInnerHTML={{ __html: data?.svg || '' }}
    />
  )
}
export const A4Chrome = memo(A4ChromeBase)

export default ComponenteExecutivo
