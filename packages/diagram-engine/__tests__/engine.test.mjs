import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DiagramEngine, build, componente, conexao, TIPOS, PAPEL_CONEXAO,
  computeLayout, aplicarOverrides, podarOverridesOrfaos, toReactFlow, overridesDeReactFlow, renderSVG,
} from '../index.js'

// Monta um projeto EV genérico (mono): rede → disjuntor 2P 63A → DR → cabo → carregador; 1 DPS em derivação.
function projetoMono({ dpsPolos = 1, dpsCount = 1, disjA = 63 } = {}) {
  const components = [
    componente({ id: 'rede', tipo: TIPOS.REDE, label: 'QD', specs: { tensao_v: 220 }, ordem: 0 }),
    componente({ id: 'disj', tipo: TIPOS.DISJUNTOR, polos: 2, specs: { corrente_a: disjA, curva: 'C' }, ordem: 1 }),
    componente({ id: 'dr', tipo: TIPOS.DR, polos: 2, specs: { ma: 30 }, ordem: 2 }),
    componente({ id: 'cabo', tipo: TIPOS.CABO, specs: { bitola_mm2: 10, comprimento_m: 25 }, ordem: 3 }),
    componente({ id: 'carr', tipo: TIPOS.EQUIPAMENTO, subtipo: 'carregador_ev', label: 'EVOWATT', specs: { potencia_kw: 7.4, corrente_a: disjA, conector: '2' }, ordem: 4 }),
  ]
  for (let i = 0; i < dpsCount; i++) components.push(componente({ id: `dps${i}`, tipo: TIPOS.DPS, polos: dpsPolos, specs: { tensao_v: 275 } }))
  const connections = [
    conexao({ id: 'e1', from: 'rede', to: 'disj', condutores: [{ papel: 'fase' }, { papel: 'neutro' }, { papel: 'terra' }] }),
    conexao({ id: 'e2', from: 'disj', to: 'dr', condutores: [{ papel: 'fase' }] }),
    conexao({ id: 'e3', from: 'dr', to: 'cabo', condutores: [{ papel: 'fase' }, { papel: 'neutro' }, { papel: 'terra' }] }),
    conexao({ id: 'e4', from: 'cabo', to: 'carr', condutores: [{ papel: 'fase' }, { papel: 'neutro' }, { papel: 'terra' }] }),
  ]
  for (let i = 0; i < dpsCount; i++) connections.push(conexao({ id: `d${i}`, from: 'disj', to: `dps${i}`, papel: PAPEL_CONEXAO.DERIVACAO, condutores: [{ papel: 'terra' }] }))
  return { components, connections }
}

test('factories validam tipo/papel', () => {
  assert.throws(() => componente({ id: 'x', tipo: 'inexistente' }))
  assert.throws(() => conexao({ id: 'x', from: 'a', to: 'b', papel: 'zzz' }))
  assert.ok(componente({ id: 'x', tipo: TIPOS.DPS }))
})

test('build é determinístico (mesmo input → mesmo layout)', () => {
  const { components, connections } = projetoMono()
  const a = build({ components, connections })
  const b = build({ components, connections })
  assert.deepEqual(a.layout, b.layout)
  assert.equal(a.version, '2.0')
})

test('layout: cadeia série cresce em X; derivação vai para faixa inferior', () => {
  const { components, connections } = projetoMono()
  const layout = computeLayout(components, connections)
  assert.ok(layout.disj.x > layout.rede.x)
  assert.ok(layout.dr.x > layout.disj.x)
  assert.ok(layout.carr.x > layout.cabo.x)
  // DPS em derivação fica abaixo (y maior) que a cadeia principal
  assert.ok(layout.dps0.y > layout.disj.y)
})

test('regra dinâmica: 2 DPS monopolares desenham 2; 1 DPS bipolar desenha 1', () => {
  const dois = build(projetoMono({ dpsPolos: 1, dpsCount: 2 }))
  const svg2 = renderSVG(dois)
  assert.equal((svg2.match(/DPS 1P/g) || []).length, 2)

  const um = build(projetoMono({ dpsPolos: 2, dpsCount: 1 }))
  const svg1 = renderSVG(um)
  assert.equal((svg1.match(/DPS 2P/g) || []).length, 1)
  assert.equal((svg1.match(/DPS 1P/g) || []).length, 0)
})

test('valor dinâmico: disjuntor 63A aparece no SVG (não fixo em 40A)', () => {
  const svg = renderSVG(build(projetoMono({ disjA: 63 })))
  assert.match(svg, /63A/)
  assert.doesNotMatch(svg, /DISJUNTOR 2P[^]*?40A/)
})

test('cores normativas de condutor no SVG (neutro azul, terra verde)', () => {
  const svg = renderSVG(build(projetoMono()))
  assert.match(svg, /#1f6fd6/) // neutro azul
  assert.match(svg, /#2e9e3f/) // terra verde
  assert.match(svg, /#d61f1f/) // fase (monofásico) vermelho
})

test('overrides: posição manual (dentro do box) vence; órfãos são podados', () => {
  const { components, connections } = projetoMono()
  const base = computeLayout(components, connections)
  // BUG-014: posição manual dentro do DIAGRAM_BOX é preservada; fora do box é clampada.
  const ov = { disj: { position: { x: 500, y: 300 } }, fantasma: { position: { x: 1, y: 1 } } }
  const aplicado = aplicarOverrides(base, ov)
  assert.deepEqual(aplicado.disj, { x: 500, y: 300 })
  // override fora do box é clampado para dentro (não fica em coordenada inválida)
  const clamp = aplicarOverrides(base, { disj: { position: { x: 99999, y: -99999 } } })
  assert.ok(clamp.disj.x <= 1083 && clamp.disj.y >= 236)
  const { overrides, removidos } = podarOverridesOrfaos(ov, components)
  assert.ok(!('fantasma' in overrides))
  assert.deepEqual(removidos, ['fantasma'])
})

test('build poda overrides órfãos automaticamente', () => {
  const { components, connections } = projetoMono()
  const canonical = build({ components, connections, overrides: { naoexiste: { position: { x: 5, y: 5 } } } })
  assert.deepEqual(canonical.overrides, {})
})

test('toReactFlow: nodes/edges espelham o canônico e overridesDeReactFlow detecta movimento', () => {
  const canonical = build(projetoMono())
  const { nodes, edges, viewport } = toReactFlow(canonical)
  assert.equal(nodes.length, canonical.components.length)
  assert.equal(edges.length, canonical.connections.length)
  assert.ok(viewport && typeof viewport.zoom === 'number')
  // mover um nó → vira override
  const base = computeLayout(canonical.components, canonical.connections)
  const movido = nodes.map(n => n.id === 'carr' ? { ...n, position: { x: base.carr.x + 50, y: base.carr.y } } : n)
  const ov = overridesDeReactFlow(movido, base)
  assert.ok(ov.carr && ov.carr.position.x === base.carr.x + 50)
  assert.ok(!('rede' in ov))
})

test('BUG-018: overlap real degrada para o baseLayout (template) — não para o layout genérico', () => {
  const { components, connections } = projetoMono()
  // baseLayout = posições fixas tipo-template (cadeia espalhada, sem sobreposição).
  const baseLayout = {
    rede: { x: 48, y: 244 }, disj: { x: 229, y: 244 }, dr: { x: 411, y: 244 },
    cabo: { x: 560, y: 244 }, carr: { x: 760, y: 244 }, dps0: { x: 300, y: 352 },
  }
  // Override RUIM: joga o disjuntor EXATAMENTE em cima do DR → sobreposição real.
  const overrides = { disj: { position: { x: 411, y: 244 } } }
  const canonical = build({ components, connections, baseLayout, overrides })
  // Fallback deve ser o baseLayout (disj volta para 229), NÃO o computeLayout genérico.
  assert.deepEqual(canonical.layout.disj, { x: 229, y: 244 })
  assert.deepEqual(canonical.layout.dps0, { x: 300, y: 352 })
})

test('BUG-018: overlap usa largura REAL — override estreito válido é preservado', () => {
  const { components, connections } = projetoMono()
  const baseLayout = {
    rede: { x: 48, y: 244 }, disj: { x: 229, y: 244 }, dr: { x: 411, y: 244 },
    cabo: { x: 560, y: 244 }, carr: { x: 760, y: 244 }, dps0: { x: 300, y: 352 },
  }
  // DPS (largura real 42) colocado a 17px da borda do disjuntor (largura real 54): NÃO
  // se tocam. Com a largura nominal antiga (120) isto era falso-positivo → fallback.
  const overrides = { dps0: { position: { x: 300, y: 244 } } }
  const canonical = build({ components, connections, baseLayout, overrides })
  assert.deepEqual(canonical.layout.dps0, { x: 300, y: 244 }) // preservado, sem fallback
})

test('BUG-021: aterramento (símbolo baixo) desce mais que a caixa nominal ao ser arrastado', () => {
  const components = [componente({ id: 'barr_terra', tipo: TIPOS.BARRAMENTO, subtipo: 'aterramento', label: 'Aterramento', ordem: 0 })]
  const baseLayout = { barr_terra: { x: 623, y: 352 } }
  // Arrastado para baixo (y=430). Com a altura NOMINAL (90) travava em 364; com a altura
  // REAL do aterramento (~52) o clamp permite descer bem mais (~402) — some o "volta pra cima".
  const canon = build({ components, connections: [], baseLayout, overrides: { barr_terra: { position: { x: 623, y: 430 } } } })
  assert.ok(canon.layout.barr_terra.y > 364, `aterramento devia descer abaixo de 364, veio ${canon.layout.barr_terra.y}`)
})

test('FEATURE-006: enclosure (MOB BOX) desenha retângulo tracejado + label; ausente sem enclosures', () => {
  const { components, connections } = projetoMono({ dpsCount: 2 })
  const semQuadro = renderSVG(build({ components, connections }))
  assert.doesNotMatch(semQuadro, /MOB BOX/)

  const comQuadro = renderSVG(build({ components, connections, metadata: { enclosures: [{ label: 'MOB BOX', ids: ['disj', 'dr', 'dps0', 'dps1'] }] } }))
  assert.match(comQuadro, /MOB BOX/)
  assert.match(comQuadro, /stroke-dasharray/) // borda tracejada do quadro
})

test('API pública exporta o DiagramEngine completo', () => {
  for (const fn of ['build', 'computeLayout', 'aplicarOverrides', 'podarOverridesOrfaos', 'toReactFlow', 'overridesDeReactFlow', 'renderSVG']) {
    assert.equal(typeof DiagramEngine[fn], 'function', `falta ${fn}`)
  }
})
