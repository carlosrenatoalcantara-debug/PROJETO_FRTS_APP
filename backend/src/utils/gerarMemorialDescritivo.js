/**
 * gerarMemorialDescritivo.js — Página de memorial descritivo (laudo técnico) que
 * antecede o unifilar no PDF Executivo. Formato A4 paisagem, pronta para impressão.
 *
 * IMPORTANTE: este módulo só EXIBE os valores já calculados pelo Motor de
 * Dimensionamento (projeto.calculos_nbr) — não recalcula nada. As fórmulas
 * mostradas são as MESMAS que o motor realmente usa (calculosNBR5410EV.js /
 * calculosCarregadorEV.js), só formatadas para leitura humana com os números
 * substituídos, para manter o documento auditável e coerente com o resultado.
 *
 * Nota de fonte: as fontes Base14 do PDFKit (Helvetica) só cobrem WinAnsi/Latin-1
 * — símbolos gregos (Δ, ρ) e operadores matemáticos (≤, ×) fora dessa faixa
 * corrompem o texto. Por isso as fórmulas usam apenas ASCII (ex.: "<=", "x",
 * "rho", "dV").
 *
 * Layout: coluna única (largura total), como os modelos de referência — mais
 * seguro para não estourar a altura da página A4 paisagem (595pt) com texto
 * cheio de fórmulas. Seção 4 (componentes) é uma tabela compacta.
 */

// Capacidade de condução (Iz) por bitola — NBR 5410 Tab.36 (Cu 70°C, método B1),
// a MESMA tabela usada pelos dois motores de cálculo. Só para exibição.
const CAPACIDADE_CABO_A = {
  1.5: 15.5, 2.5: 21, 4: 28, 6: 36, 10: 50, 16: 68, 25: 89,
  35: 109, 50: 134, 70: 170, 95: 207, 120: 239, 150: 272, 185: 309, 240: 360,
}

const fmt = (n, casas = 2) => (Number.isFinite(Number(n)) ? Number(n).toFixed(casas).replace('.', ',') : '—')
const esc = (s) => String(s ?? '')

// "data:image/png;base64,...." → Buffer (formato aceito por doc.image()). Retorna
// null se não for uma data URI válida — nunca derruba a geração do PDF por causa disso.
function base64ParaBuffer(dataUri) {
  const m = /^data:image\/\w+;base64,(.+)$/.exec(String(dataUri || ''))
  if (!m) return null
  try { return Buffer.from(m[1], 'base64') } catch { return null }
}

function cabecalho(doc, largura, margem, projeto, logoBase64) {
  let y0 = margem

  // Logomarca da empresa (Configurações) — acima da faixa colorida, alinhada à
  // esquerda, altura fixa preservando a proporção original da imagem.
  const logoBuf = base64ParaBuffer(logoBase64)
  if (logoBuf) {
    try {
      doc.image(logoBuf, margem, y0, { fit: [150, 34], align: 'left' })
      y0 += 34 + 8
    } catch { /* logo corrompida/ilegível — segue sem ela */ }
  }

  const larguraTexto = largura - 24
  const titulo = 'MEMORIAL DESCRITIVO — CIRCUITO PARA CARREGADOR VEICULAR (WALLBOX)'
  // Altura do título calculada de verdade (heightOfString) — em páginas mais estreitas
  // (retrato) o título quebra em 2 linhas; sem isso o subtítulo ficava sobreposto.
  doc.font('Helvetica-Bold').fontSize(13)
  const alturaTitulo = doc.heightOfString(titulo, { width: larguraTexto, lineGap: 1 })
  const alturaFaixa = alturaTitulo + 28
  doc.rect(margem, y0, largura, alturaFaixa).fill('#0f766e')
  doc.fillColor('#ffffff').text(titulo, margem + 12, y0 + 7, { width: larguraTexto, lineGap: 1 })
  const carregador = (projeto.carregadores && projeto.carregadores[0]) || {}
  const potenciaTxt = carregador.potencia_kw ? `${carregador.potencia_kw}kW` : '—'
  const tensaoTxt = carregador.tensao_entrada_v ? `${carregador.tensao_entrada_v}V` : '—'
  const faseTxt = Number(carregador.numero_fases) >= 3 ? 'Trifásico' : 'Monofásico'
  doc.font('Helvetica').fontSize(9)
    .text(`Potência nominal: ${potenciaTxt}  |  Tensão: ${tensaoTxt} — ${faseTxt}  |  Projeto: ${esc(projeto.nome)}`,
      margem + 12, y0 + 9 + alturaTitulo, { width: larguraTexto })
  return y0 + alturaFaixa + 8
}

function tituloSecao(doc, x, y, largura, texto) {
  doc.rect(x, y, 3, 12).fill('#0f766e')
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text(esc(texto), x + 7, y - 1, { width: largura - 7 })
  return y + 15
}

// Escreve texto e devolve o Y seguinte, calculando a altura real do bloco com
// heightOfString (doc.y não é confiável quando x/y são passados explicitamente).
function escreverBloco(doc, x, y, largura, texto, { negrito = false, tamanho = 8.5, cor = '#1e293b', lineGap = 1, espacoDepois = 4 } = {}) {
  doc.font(negrito ? 'Helvetica-Bold' : 'Helvetica').fontSize(tamanho).fillColor(cor)
  doc.text(esc(texto), x, y, { width: largura, lineGap })
  const altura = doc.heightOfString(esc(texto), { width: largura, lineGap })
  return y + altura + espacoDepois
}

function linhaChaveValor(doc, x, y, largura, chave, valor) {
  const texto = `${chave} ${valor}`
  doc.font('Helvetica-Bold').fontSize(8.3).fillColor('#334155').text(esc(chave), x, y, { width: largura, continued: true })
  doc.font('Helvetica').fillColor('#1e293b').text(` ${esc(valor)}`)
  const altura = doc.heightOfString(esc(texto), { width: largura })
  return y + altura + 2
}

// Tabela compacta (linha = dispositivo | especificação/função) — economiza altura
// vertical em relação a blocos de texto separados por item.
function tabelaComponentes(doc, x, y, largura, linhas) {
  const colNome = 150
  const colDesc = largura - colNome
  for (const [nome, desc] of linhas) {
    const alturaDesc = doc.heightOfString(esc(desc), { width: colDesc, lineGap: 0.5 })
    const alturaLinha = Math.max(alturaDesc, 11) + 5
    doc.rect(x, y, largura, alturaLinha).fill('#f8fafc')
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f766e').text(esc(nome), x + 4, y + 2, { width: colNome - 8 })
    doc.font('Helvetica').fontSize(8).fillColor('#1e293b').text(esc(desc), x + colNome, y + 2, { width: colDesc - 4, lineGap: 0.5 })
    y += alturaLinha + 2
  }
  return y
}

// FEATURE-006: valor para preenchimento manual. Quando o dado ainda não foi informado
// no sistema, o memorial imprime um espaço em branco (linha de sublinhados) para ser
// preenchido à mão na impressão — o operador digita depois no sistema, se necessário.
const BRANCO = '__________'
function ouBranco(valor, { sufixo = '', casas = null } = {}) {
  if (valor == null || valor === '' || (typeof valor === 'number' && !Number.isFinite(valor))) return BRANCO
  const base = casas != null ? fmt(valor, casas) : esc(valor)
  return `${base}${sufixo}`
}

// FEATURE-006 (item 1): cabeçalho técnico de identificação do documento — caixa com os
// dados do projeto/cliente/UC/RT, no mesmo padrão visual do restante (faixa teal + campos).
function blocoIdentificacao(doc, x, y, largura, projeto, cliente, tecnico) {
  const rtNome = esc(tecnico?.nome) || '—'
  const rtReg = tecnico?.crea ? `CREA ${esc(tecnico.crea)}` : (tecnico?.cft ? `CFT ${esc(tecnico.cft)}` : '')
  const data = esc(projeto.data) || new Date().toLocaleDateString('pt-BR')
  const pares = [
    ['Projeto', esc(projeto.nome) || '—'],
    ['Data', data],
    ['Cliente', esc(cliente?.nome) || '—'],
    ['CPF/CNPJ', esc(cliente?.cpf_cnpj) || '—'],
    ['Concessionária', esc(cliente?.distribuidora) || '—'],
    ['Unidade Consumidora (UC)', esc(cliente?.numero_cliente) || '—'],
  ]
  const endereco = esc(cliente?.endereco_completo || projeto.endereco_completo) || '—'
  const rt = `${rtNome}${rtReg ? ` — ${rtReg}` : ''}`

  const padY = 22, linhaH = 13, colW = largura / 2
  const nLinhasGrid = Math.ceil(pares.length / 2)
  const alturaCaixa = padY + nLinhasGrid * linhaH + linhaH * 2 + 6 // grid + endereço + RT
  doc.rect(x, y, largura, alturaCaixa).fillAndStroke('#ffffff', '#cbd5e1')
  doc.rect(x, y, largura, 16).fill('#0f766e')
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9).text('IDENTIFICAÇÃO DO DOCUMENTO', x + 8, y + 4)
  let yy = y + padY
  pares.forEach(([k, v], i) => {
    const cx = x + 8 + (i % 2) * colW
    if (i % 2 === 0 && i > 0) yy += linhaH
    doc.font('Helvetica-Bold').fontSize(7.6).fillColor('#334155').text(`${k}:`, cx, yy, { width: colW - 14, continued: true })
    doc.font('Helvetica').fillColor('#1e293b').text(` ${v}`)
  })
  yy += linhaH
  doc.font('Helvetica-Bold').fontSize(7.6).fillColor('#334155').text('Endereço:', x + 8, yy, { width: largura - 16, continued: true })
  doc.font('Helvetica').fillColor('#1e293b').text(` ${endereco}`)
  yy += linhaH
  doc.font('Helvetica-Bold').fontSize(7.6).fillColor('#334155').text('Responsável Técnico:', x + 8, yy, { width: largura - 16, continued: true })
  doc.font('Helvetica').fillColor('#1e293b').text(` ${rt}`)
  return y + alturaCaixa + 8
}

/**
 * Desenha o memorial descritivo na página ATUAL do doc (assume página em branco,
 * cursor no topo). Quem chama decide se faz doc.addPage() antes/depois.
 */
export function desenharMemorialDescritivo(doc, projetoOriginal, clienteOriginal, logoBase64) {
  const projeto = projetoOriginal || {}
  const cliente = (typeof projeto.clienteId === 'object' && projeto.clienteId) || clienteOriginal || {}
  const carregador = (projeto.carregadores && projeto.carregadores[0]) || {}
  const calc = projeto.calculos_nbr || {}
  const tecnico = projeto.tecnico || {}

  const margem = 26
  const largura = doc.page.width - margem * 2

  let y = cabecalho(doc, largura, margem, projeto, logoBase64)

  // ── Identificação do documento (FEATURE-006 item 1) ───────────────────────
  y = blocoIdentificacao(doc, margem, y, largura, projeto, cliente, tecnico)

  // ── 1. Objetivo ──────────────────────────────────────────────────────────
  const ehTri = Number(carregador.numero_fases) >= 3
  const distancia = projeto.comprimento_cabo_m ?? '—'
  y = tituloSecao(doc, margem, y, largura, '1. Objetivo')
  y = escreverBloco(doc, margem, y, largura,
    `Este documento especifica os critérios técnicos, dimensionamentos, componentes e infraestrutura de suporte para a `
    + `instalação do circuito alimentador de um carregador de veículo elétrico (Wallbox) ${esc(carregador.marca || '')} ${esc(carregador.modelo || '')}, `
    + `potência nominal de ${carregador.potencia_kw ?? '—'} kW, tensão ${carregador.tensao_entrada_v ?? '—'} V (${ehTri ? 'trifásico' : 'monofásico'}), com percurso de `
    + `${distancia} m entre a origem (padrão de entrada/quadro geral) e o quadro de proteção dedicado ao carregador, conforme a ABNT NBR 5410 e a ABNT NBR 17019.`)

  // ── 2. Características gerais (linha única, itens lado a lado) ──────────
  y = tituloSecao(doc, margem, y, largura, '2. Características Gerais e Infraestrutura')
  const itensCaract = [
    ['Potência:', `${carregador.potencia_kw ?? '—'} kW`],
    ['Tensão:', `${carregador.tensao_entrada_v ?? '—'} V (${ehTri ? 'Trifásico' : 'Fase-Neutro'})`],
    ['Comprimento (L):', `${distancia} m`],
    ['Condutor:', 'Cobre / PVC (70°C)'],
    ['Conector:', carregador.tipo_conector ? `Tipo ${carregador.tipo_conector}` : '—'],
  ]
  const colCaract = largura / itensCaract.length
  const yAntes2 = y
  let alturaMax2 = 0
  itensCaract.forEach(([chave, valor], i) => {
    const x = margem + i * colCaract
    doc.font('Helvetica-Bold').fontSize(7.6).fillColor('#334155').text(esc(chave), x, yAntes2, { width: colCaract - 6 })
    const y2 = doc.y + 1
    doc.font('Helvetica').fontSize(8.3).fillColor('#0f172a').text(esc(valor), x, y2, { width: colCaract - 6 })
    alturaMax2 = Math.max(alturaMax2, doc.y - yAntes2)
  })
  y = yAntes2 + alturaMax2 + 6

  // ── Verificação da Disponibilidade Elétrica (FEATURE-006 item 2) ──────────
  // TEXTO FIXO (nunca gerar por IA). Apenas as variáveis são substituídas. Dados não
  // informados no sistema saem como espaço em branco (BRANCO) para preenchimento manual.
  const nA = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? BRANCO : fmt(v, 2).replace(/,00$/, '').replace(/(,\d)0$/, '$1'))
  const cargaTxt = cliente?.carga_instalada_kw != null ? `${nA(cliente.carga_instalada_kw)} kW` : BRANCO
  const concessTxt = esc(cliente?.distribuidora) || BRANCO
  const iAferida = projeto.corrente_aferida_a
  const iCarregador = carregador.corrente_entrada_a
  const iFinal = (Number.isFinite(Number(iAferida)) && Number.isFinite(Number(iCarregador))) ? Number(iAferida) + Number(iCarregador) : null
  y = tituloSecao(doc, margem, y, largura, 'Verificação da Disponibilidade Elétrica')
  y = escreverBloco(doc, margem, y, largura,
    `A unidade consumidora possui Carga Instalada de ${cargaTxt}, conforme cadastro da concessionária ${concessTxt}.`)
  y = escreverBloco(doc, margem, y, largura,
    `Durante a vistoria técnica foi realizada a aferição da corrente na fase destinada à alimentação do carregador de veículo `
    + `elétrico, obtendo-se o valor de ${nA(iAferida)} A.`)
  y = escreverBloco(doc, margem, y, largura,
    `Considerando a corrente nominal do carregador (${nA(iCarregador)} A), a corrente prevista na fase após a utilização do `
    + `carregador será de ${nA(iFinal)} A, permanecendo inferior à capacidade do circuito de entrada protegido por disjuntor de `
    + `${nA(cliente?.disjuntor_geral_a)} A.`)
  y = escreverBloco(doc, margem, y, largura,
    `Conclui-se que existe disponibilidade elétrica na fase destinada à alimentação do carregador de veículo elétrico, não `
    + `sendo necessária, nas condições aferidas, solicitação de aumento da carga instalada junto à concessionária.`)

  // ── 3. Memória de cálculo ───────────────────────────────────────────────
  y = tituloSecao(doc, margem, y, largura, '3. Memória de Cálculo')

  y = escreverBloco(doc, margem, y, largura, '3.1. Corrente de Projeto (Ib)', { negrito: true, tamanho: 8.8, cor: '#0f172a', espacoDepois: 1 })
  if (carregador.corrente_entrada_a) {
    y = escreverBloco(doc, margem, y, largura,
      `Corrente nominal informada pelo fabricante (catálogo/datasheet do equipamento) — prioridade normativa sobre o `
      + `cálculo teórico: Ib = ${fmt(carregador.corrente_entrada_a, 2)} A.`)
  } else {
    const v = carregador.tensao_entrada_v || 220
    const formula = ehTri ? 'Ib = P / (V x 1,732 x fp)' : 'Ib = P / (V x fp)'
    y = escreverBloco(doc, margem, y, largura,
      `${formula}, com fp = 0,95 (fator de potência). `
      + `Ib = ${(carregador.potencia_kw || 0) * 1000} / (${v}${ehTri ? ' x 1,732' : ''} x 0,95) = ${fmt(calc.corrente_projeto_a, 2)} A.`)
  }

  const iz = CAPACIDADE_CABO_A[calc.bitola_cabo_mm2] ?? null
  y = escreverBloco(doc, margem, y, largura, '3.2. Capacidade de Condução de Corrente e Proteção', { negrito: true, tamanho: 8.8, cor: '#0f172a', espacoDepois: 1 })
  y = escreverBloco(doc, margem, y, largura,
    `De acordo com a NBR 5410 (Tabela 36, método de referência B1), o cabo de ${fmt(calc.bitola_cabo_mm2, 1)} mm² de PVC suporta até `
    + `${iz != null ? fmt(iz, 1) : '—'} A. A proteção adotada é o disjuntor termomagnético de ${calc.disjuntor_a ?? '—'} A, curva C, satisfazendo o critério `
    + `Ib <= In <= Iz (${fmt(calc.corrente_projeto_a, 2)} A <= ${calc.disjuntor_a ?? '—'} A <= ${iz != null ? fmt(iz, 1) : '—'} A).`)

  y = escreverBloco(doc, margem, y, largura, '3.3. Verificação da Queda de Tensão (dV)', { negrito: true, tamanho: 8.8, cor: '#0f172a', espacoDepois: 1 })
  y = escreverBloco(doc, margem, y, largura,
    `Considerando a resistividade do cobre rho = 0,0179 Ohm.mm²/m: dV (%) = [(rho x L x Ib) / S] / V x 100. `
    + `dV (%) = [(0,0179 x ${distancia} x ${fmt(calc.corrente_projeto_a, 2)}) / ${fmt(calc.bitola_cabo_mm2, 1)}] / ${carregador.tensao_entrada_v || 220} x 100 = ${fmt(calc.queda_tensao_pct, 2)}%. `
    + `Conclusão: a queda de tensão calculada fica ${Number(calc.queda_tensao_pct) <= 3 ? 'dentro' : 'ACIMA'} do limite de 3% exigido pela NBR 5410 `
    + `para circuitos terminais, ${Number(calc.queda_tensao_pct) <= 3 ? 'validando' : 'exigindo revisão de'} a bitola adotada para os ${distancia} metros do percurso.`)

  // ── 4. Especificação dos componentes (tabela compacta) ──────────────────
  y = tituloSecao(doc, margem, y, largura, '4. Especificação dos Componentes e Proteções')
  y = tabelaComponentes(doc, margem, y, largura, [
    ['Disjuntor Termomagnético', `${calc.disjuntor_a ?? '—'} A, Curva C, ${ehTri ? 'Tetrapolar (4P)' : 'Bipolar (2P)'} — proteção contra sobrecarga e curto-circuito.`],
    ['IDR (Interruptor Diferencial Residual)', `${calc.disjuntor_a ?? '—'} A, ${calc.dr_ma ?? 30} mA, Tipo A — obrigatório pela NBR 17019, detecta fuga com componente contínua pulsante do carregador.`],
    // BUG-021.1: quantidade de DPS = 1 por condutor vivo (mono 2: L1+N; tri 4: L1+L2+L3+N).
    ['DPS (Proteção contra Surtos)', `${ehTri ? 4 : 2} unidades, Classe II, ${calc.dps_kv ?? '—'} V — um por condutor vivo (${ehTri ? 'L1, L2, L3 e N' : 'L1 e N'}); protege a eletrônica do carregador contra surtos atmosféricos e de manobra.`],
    ['Condutores', `${fmt(calc.bitola_cabo_mm2, 1)} mm², cobre, isolação PVC 70°C — Fase (preto/vermelho), Neutro (azul), Terra (verde/amarelo).`],
  ])
  y += 4

  // ── 5. Diretrizes de execução ────────────────────────────────────────────
  y = tituloSecao(doc, margem, y, largura, '5. Diretrizes para Execução')
  y = escreverBloco(doc, margem, y, largura,
    'Eletroduto instalado de forma alinhada, com curvas de raio longo nas mudanças de direção. Fixação com espaçamento máximo de 1 metro '
    + 'entre abraçadeiras. Extremidades com buchas/arruelas de acabamento para não danificar a isolação dos condutores. Identificação de '
    + 'cores dos condutores conforme NBR 5410.')

  // ── Conclusão Técnica (FEATURE-006 item 3) — TEXTO FIXO ───────────────────
  y = tituloSecao(doc, margem, y, largura, 'Conclusão Técnica')
  y = escreverBloco(doc, margem, y, largura,
    `Com base nos dados da unidade consumidora, nas informações fornecidas pelo fabricante do equipamento, na vistoria `
    + `técnica realizada e nos dimensionamentos apresentados neste memorial, conclui-se que o circuito destinado à alimentação `
    + `do carregador de veículo elétrico atende aos requisitos das ABNT NBR 5410 e ABNT NBR 17019, estando tecnicamente apto `
    + `para execução conforme as especificações deste documento.`)

  // ── Assinaturas ──────────────────────────────────────────────────────────
  const xDir = margem + largura / 2 + 10
  const linhaY = Math.min(y + 10, doc.page.height - 30)
  doc.moveTo(margem, linhaY).lineTo(margem + 220, linhaY).stroke('#94a3b8')
  doc.moveTo(xDir, linhaY).lineTo(xDir + 220, linhaY).stroke('#94a3b8')
  doc.font('Helvetica').fontSize(8).fillColor('#334155')
    .text(`Responsável Técnico: ${esc(tecnico.nome) || '—'}${tecnico.crea ? ` — CREA ${esc(tecnico.crea)}` : ''}${tecnico.cft ? ` — CFT ${esc(tecnico.cft)}` : ''}`,
      margem, linhaY + 3, { width: 300 })
  doc.text(`Cliente: ${esc(cliente.nome) || '—'}${cliente.cpf_cnpj ? ` — CPF/CNPJ ${esc(cliente.cpf_cnpj)}` : ''}`, xDir, linhaY + 3, { width: 300 })
}
