/**
 * unifilarMicroSVG.js — unifilar de MICROINVERSORES — FV-DOM-031C.
 *
 * ── Por que um desenho próprio ───────────────────────────────────────────────
 * `unifilarSVG.js` desenha `MPPT → strings → módulos`: colunas por MPPT, caixa
 * de junção quando há mais de uma string, e um inversor central. Num sistema com
 * microinversores nada disso existe. A auditoria da FV-DOM-031B mediu o que
 * acontecia: `arranjoMPPTs` vinha nulo, o modelo elétrico caía no fallback e
 * inventava MPPTs e strings que o projeto não tem.
 *
 * Este motor desenha o que a decisão 5 definiu:
 *
 *   módulos → entradas CC → microinversor → barramento CA → proteção → rede
 *
 * ── O que é REUSADO ──────────────────────────────────────────────────────────
 * Os símbolos de módulo, disjuntor CA, quadro, medidor, rede, aterramento e
 * cabo vêm de `unifilarSVG.js` — mesmas funções, mesma paleta, mesmo traço. O
 * lado CA de um sistema micro é igual ao de um sistema string, e desenhá-lo de
 * novo criaria duas verdades sobre o mesmo trecho.
 *
 * ── Sem defaults ─────────────────────────────────────────────────────────────
 * O que o modelo não trouxer aparece como "—" e é declarado em `lacunas`.
 * Nenhum número é inventado para completar o desenho.
 *
 * Puro: sem DOM, sem I/O.
 */
import {
  esc, svgPainel, svgDjAC, svgQuadroAC, svgMedidor, svgRede, svgAterramento, svgLinhaCabo,
} from './unifilarSVG.js'

const COR = {
  fundo: '#ffffff', borda: '#0f172a', texto: '#0f172a', cinza: '#64748b',
  cc: '#dc2626', ca: '#2563eb', micro: '#d97706', painel: '#1e293b',
  destaque: '#f8fafc',
}

/**
 * Linha de cabo. `svgLinhaCabo` SEMPRE rotula a bitola; sem bitola declarada ele
 * escreveria "nullmm²". Aqui, sem bitola, sai a linha limpa — ausência não vira
 * texto inventado nem lixo na tela.
 */
function linha(x1, y1, x2, y2, cor, bitola = null) {
  if (bitola !== null && bitola !== undefined && bitola !== '') {
    return svgLinhaCabo(x1, y1, x2, y2, bitola, cor)
  }
  return `
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${cor}" stroke-width="2.5"/>`
}

const n = (v, sufixo = '', casas = 1) =>
  v === null || v === undefined || !Number.isFinite(Number(v))
    ? '—' : `${Number(v).toFixed(casas).replace(/\.0+$/, '')}${sufixo}`

/** Caixa de um microinversor, com as entradas que ele efetivamente usa. */
function svgMicro(x, y, indice, modulosNoMicro, entradasUsadas, rotulo) {
  const larg = 92
  const alt = 40
  const usadas = Array.isArray(entradasUsadas) ? entradasUsadas : []
  const pontos = usadas.map((mods, i) => {
    const yy = y + 8 + i * ((alt - 16) / Math.max(usadas.length - 1, 1) || 0)
    const cheia = mods > 0
    return `<circle cx="${x - 4}" cy="${yy}" r="2.6" fill="${cheia ? COR.cc : '#ffffff'}" stroke="${COR.cc}" stroke-width="0.9"/>` +
      `<text x="${x - 10}" y="${yy + 2.6}" font-size="5.5" text-anchor="end" fill="${COR.cinza}">${mods}</text>`
  }).join('')
  return `
  <g>
    ${pontos}
    <rect x="${x}" y="${y}" width="${larg}" height="${alt}" rx="3"
          fill="${COR.destaque}" stroke="${COR.micro}" stroke-width="1.3"/>
    <text x="${x + larg / 2}" y="${y + 15}" font-size="8" font-weight="600"
          text-anchor="middle" fill="${COR.texto}">MI-${indice}</text>
    <text x="${x + larg / 2}" y="${y + 26}" font-size="6.5" text-anchor="middle" fill="${COR.cinza}">${esc(rotulo)}</text>
    <text x="${x + larg / 2}" y="${y + 35}" font-size="6.5" text-anchor="middle" fill="${COR.cinza}">${modulosNoMicro} mód · ${usadas.length} entr.</text>
  </g>`
}

/**
 * Gera o unifilar de um sistema com microinversores.
 *
 * @param {Object} modelo   saída de `montarModeloMicro`
 * @param {Object} [ctx]    { cliente, distribuidora, estrutura }
 * @returns {string} SVG
 */
export function gerarUnifilarMicroSVG(modelo, ctx = {}) {
  if (!modelo || modelo.topologia !== 'micro') {
    throw new Error('gerarUnifilarMicroSVG: modelo de microinversores ausente')
  }

  const { sistema, modelos, modulo, temperatura } = modelo
  // Um retângulo por micro, na ordem dos modelos — a lista é o que `micros[]`
  // persistiu, não uma reordenação nossa.
  const unidades = []
  for (const m of modelos) {
    (m.distribuicao ?? []).forEach((mods, i) => {
      unidades.push({
        rotulo: [m.marca, m.modelo].filter(Boolean).join(' ') || '—',
        modulos: mods,
        entradas: (m.entradas_usadas ?? [])[i] ?? [],
      })
    })
  }

  const PASSO = 96
  const X_MOD = 60
  const X_MICRO = 250
  const X_BARRA = 420
  const X_DJ = 500
  const X_QUADRO = 590
  const X_MEDIDOR = 700
  const X_REDE = 810
  const Y0 = 120
  const altura = Math.max(Y0 + unidades.length * PASSO + 190, 470)
  const larguraTotal = 980

  const yDe = (i) => Y0 + i * PASSO
  const yBarraTopo = yDe(0) + 20
  const yBarraBase = yDe(Math.max(unidades.length - 1, 0)) + 20
  const yCA = (yBarraTopo + yBarraBase) / 2

  const blocos = unidades.map((u, i) => {
    const y = yDe(i)
    // Módulos daquele micro: um símbolo, com a contagem — desenhar 24 retângulos
    // não acrescenta informação e destrói a legibilidade.
    // `id` do símbolo = índice do micro (sai como "FV1", "FV2"…), e a potência
    // do módulo quando declarada. Nenhum dos dois é inventado.
    const mods = `
    ${svgPainel(X_MOD, y, i + 1, modulo.marca ?? '—', modulo.potenciaW === null ? '—' : modulo.potenciaW)}
    <text x="${X_MOD + 23}" y="${y + 80}" font-size="7.5" text-anchor="middle" fill="${COR.cinza}">× ${u.modulos}</text>`
    const linhaCC = linha(X_MOD + 46, y + 20, X_MICRO - 16, y + 20, COR.cc)
    const micro = svgMicro(X_MICRO, y, i + 1, u.modulos, u.entradas, u.rotulo)
    const linhaCA = linha(X_MICRO + 92, y + 20, X_BARRA, y + 20, COR.ca)
    return mods + linhaCC + micro + linhaCA
  }).join('')

  // Escalares: `selecionarCabo`/`selecionarDPS` devolvem objetos, e os símbolos
  // do motor de string esperam texto.
  const dps = modelo.protecoes?.dps_cc?.modelo ?? null
  const caboCA = modelo.cabos?.ca?.secao ?? null
  const disjCA = modelo.cabos?.ca?.disj ?? null
  const m0 = modelos[0] ?? {}

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${larguraTotal} ${altura}" width="${larguraTotal}" height="${altura}" font-family="Inter, Arial, sans-serif">
  <rect width="${larguraTotal}" height="${altura}" fill="${COR.fundo}"/>

  <text x="40" y="42" font-size="15" font-weight="700" fill="${COR.texto}">DIAGRAMA UNIFILAR — MICROINVERSORES</text>
  <text x="40" y="60" font-size="9" fill="${COR.cinza}">${esc(ctx.cliente ?? '—')}</text>
  <text x="40" y="74" font-size="8.5" fill="${COR.cinza}">Topologia: microinversor → entradas CC → módulos (sem MPPT, sem strings)</text>
  <text x="620" y="60" font-size="9" fill="${COR.texto}">${n(sistema.potenciaCC, ' kWp', 2)} CC · ${n(sistema.potenciaCA, ' kW', 2)} CA</text>
  <text x="620" y="74" font-size="8.5" fill="${COR.cinza}">${sistema.numModulos} módulos · ${sistema.numMicros} microinversores</text>
  <text x="620" y="88" font-size="8.5" fill="${COR.cinza}">${sistema.fasesLabel} · ${n(sistema.tensaoAC, ' V', 0)}</text>

  ${blocos}

  <line x1="${X_BARRA}" y1="${yBarraTopo}" x2="${X_BARRA}" y2="${yBarraBase}" stroke="${COR.ca}" stroke-width="2.4"/>
  <text x="${X_BARRA + 6}" y="${yBarraTopo - 8}" font-size="7.5" fill="${COR.ca}">barramento CA${caboCA ? ` · ${esc(caboCA)}` : ''}</text>

  ${linha(X_BARRA, yCA, X_DJ, yCA, COR.ca, caboCA)}
  ${svgDjAC(X_DJ, yCA - 18, disjCA ?? (sistema.iac === null ? null : Math.ceil(sistema.iac)), sistema.fasesAC)}
  ${linha(X_DJ + 40, yCA, X_QUADRO, yCA, COR.ca, caboCA)}
  ${svgQuadroAC(X_QUADRO, yCA - 22, caboCA, sistema.fasesLabel)}
  ${linha(X_QUADRO + 70, yCA, X_MEDIDOR, yCA, COR.ca, caboCA)}
  ${svgMedidor(X_MEDIDOR, yCA - 22, sistema.fasesLabel)}
  ${linha(X_MEDIDOR + 70, yCA, X_REDE, yCA, COR.ca, caboCA)}
  ${svgRede(X_REDE, yCA - 22, ctx.distribuidora ?? '—', sistema.fasesLabel)}
  ${svgAterramento(X_QUADRO + 35, yCA + 40)}

  <text x="40" y="${altura - 120}" font-size="9" font-weight="700" fill="${COR.texto}">MEMORIAL TÉCNICO</text>
  <text x="40" y="${altura - 104}" font-size="7.5" fill="${COR.cinza}">Módulo: ${esc(modulo.marca ?? '—')} ${esc(modulo.modelo ?? '')} · ${n(modulo.potenciaW, ' Wp', 0)} · Voc ${n(modulo.voc, ' V')} · Isc ${n(modulo.isc, ' A')}</text>
  <text x="40" y="${altura - 90}" font-size="7.5" fill="${COR.cinza}">Temperaturas de projeto: ${n(temperatura.tmin, ' °C', 0)} / ${n(temperatura.tmax, ' °C', 0)}</text>
  <text x="40" y="${altura - 76}" font-size="7.5" fill="${COR.cinza}">Por entrada CC: ${n(m0.modulos_por_entrada, ' módulo(s)', 0)} · Voc a frio ${n(m0.voc_entrada_frio, ' V')} · Vmpp a quente ${n(m0.vmpp_entrada_quente, ' V')} · Isc de projeto ${n(m0.isc_entrada, ' A')}</text>
  <text x="40" y="${altura - 62}" font-size="7.5" fill="${COR.cinza}">Corrente CA total: ${n(sistema.iac, ' A')}${dps ? ` · DPS CC: ${esc(dps)}` : ''}</text>
  <text x="40" y="${altura - 48}" font-size="7.5" fill="${COR.cinza}">Estrutura: ${esc(ctx.estrutura ?? '—')}</text>
  ${modelos.map((m, i) => `
  <text x="40" y="${altura - 34 + i * 12}" font-size="7.5" fill="${COR.cinza}">Micro ${i + 1}: ${esc([m.marca, m.modelo].filter(Boolean).join(' ') || '—')} · ${n(m.quantidade, ' un.', 0)} × ${n(m.entradas_por_micro, ' entradas', 0)} · distribuição ${(m.distribuicao ?? []).join('/') || '—'}</text>`).join('')}
  ${(modelo.lacunas ?? []).length > 0 ? `
  <text x="620" y="${altura - 104}" font-size="7.5" fill="#b45309">${(modelo.lacunas ?? []).length} dado(s) não declarado(s):</text>
  <text x="620" y="${altura - 92}" font-size="7" fill="#b45309">${esc((modelo.lacunas ?? []).join(', '))}</text>` : ''}
</svg>`
}

export default gerarUnifilarMicroSVG
