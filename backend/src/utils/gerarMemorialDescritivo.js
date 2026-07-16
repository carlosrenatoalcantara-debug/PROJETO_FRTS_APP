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
 *
 * BUG-023 — REGRA EDITORIAL (substitui a de "caber em 1 página" do BUG-022):
 *  - LEGIBILIDADE ANTES DE TUDO. Nunca reduzir fonte nem aproximar linhas para caber.
 *  - O Memorial pode ocupar até DUAS páginas. A página 1 fecha ao atingir ~75% da área
 *    útil (LIMITE_P1_PCT) e o conteúdo CONTINUA naturalmente na página 2.
 *  - Nenhum texto pode sobrepor, ser cortado, ou invadir a coluna vizinha: todo campo é
 *    MEDIDO antes de desenhar e a altura da linha cresce para acomodá-lo (medirCampo).
 *
 * BUG-021 FASE 2 — fronteira das fontes:
 *  - Seção 3 (Memorial de CÁLCULO) continua espelhando o MOTOR (calculos_nbr): é o
 *    registro auditável do dimensionamento normativo e não muda.
 *  - Seção 4 (ESPECIFICAÇÃO dos componentes) passa a ler a ESPECIFICAÇÃO EXECUTIVA
 *    (projeto.especificacao) — o que SERÁ instalado. É a mesma estrutura que alimenta
 *    o Unifilar e a Lista de Materiais, então os três não podem divergir.
 */
import { especificacaoDoProjeto } from '@fortesolar/diagram-engine/adapters/especificacao-ev'

// Capacidade de condução (Iz) por bitola — NBR 5410 Tab.36 (Cu 70°C, método B1),
// a MESMA tabela usada pelos dois motores de cálculo. Só para exibição.
const CAPACIDADE_CABO_A = {
  1.5: 15.5, 2.5: 21, 4: 28, 6: 36, 10: 50, 16: 68, 25: 89,
  35: 109, 50: 134, 70: 170, 95: 207, 120: 239, 150: 272, 185: 309, 240: 360,
}

const fmt = (n, casas = 2) => (Number.isFinite(Number(n)) ? Number(n).toFixed(casas).replace('.', ',') : '—')
const esc = (s) => String(s ?? '')
const n1 = (n) => (Number.isFinite(Number(n)) ? fmt(n, 2).replace(/,00$/, '').replace(/(,\d)0$/, '$1') : '—')

// ── BUG-023: parâmetros editoriais ───────────────────────────────────────────
// Corpos de texto confortáveis para leitura em papel. Estes valores NÃO são reduzidos
// para fazer conteúdo caber — quando não cabe, o fluxo passa para a página seguinte.
const F = Object.freeze({ corpo: 9, rotulo: 8.5, valor: 8.5, subitem: 9.2, tabela: 8.6 })
// A página 1 é fechada a ~75% da área útil (resposta do lote: "a quebra poderia ser com 75%").
const LIMITE_P1_PCT = 0.75
// Faixa reservada no rodapé da ÚLTIMA página para os blocos de assinatura.
const RESERVA_ASSINATURA = 58
const GAP_COL = 14          // canal entre colunas — impede que uma encoste na outra
const LINHA_MIN = 12        // altura mínima de uma linha de campo

/**
 * BUG-023 — REGRA DE QUEBRA (medição). O rótulo fica SEMPRE na primeira linha; o valor
 * começa ao lado dele e, ao quebrar, as linhas seguintes alinham-se ao INÍCIO DO VALOR
 * (recuo pendente) — nunca voltam ao início da coluna nem invadem a coluna vizinha.
 *
 * Quando o rótulo consome mais da metade da coluna, sobra pouco para o valor e a quebra
 * ficaria picotada: nesse caso o valor desce inteiro para a linha de baixo, ocupando a
 * coluna toda (a segunda forma prevista na especificação do lote).
 */
function medirCampo(doc, larguraCol, rotulo, valor) {
  doc.font('Helvetica-Bold').fontSize(F.rotulo)
  const wRotulo = doc.widthOfString(`${esc(rotulo)}: `)
  const empilhado = wRotulo > larguraCol * 0.5
  const wValor = Math.max(empilhado ? larguraCol : larguraCol - wRotulo, 24)
  doc.font('Helvetica').fontSize(F.valor)
  const hValor = doc.heightOfString(esc(valor), { width: wValor, lineGap: 0.5 })
  const altura = empilhado ? LINHA_MIN + hValor : Math.max(hValor, LINHA_MIN)
  return { wRotulo, wValor, empilhado, altura }
}

/** Desenha um campo com a regra de quebra e devolve a altura REAL que ele ocupou. */
function desenharCampo(doc, x, y, larguraCol, rotulo, valor) {
  const m = medirCampo(doc, larguraCol, rotulo, valor)
  doc.font('Helvetica-Bold').fontSize(F.rotulo).fillColor('#475569')
    .text(`${esc(rotulo)}:`, x, y, { width: m.wRotulo, lineBreak: false })
  // O x do valor É o recuo pendente: o PDFKit alinha as linhas seguintes neste mesmo x.
  doc.font('Helvetica').fontSize(F.valor).fillColor('#0f172a')
    .text(esc(valor), m.empilhado ? x : x + m.wRotulo, m.empilhado ? y + LINHA_MIN : y,
      { width: m.wValor, lineGap: 0.5 })
  return m.altura
}

/**
 * Grade de campos. `pesos` = fração da largura por coluna (ex.: [0.5, 0.5] = 2 colunas).
 * A altura de cada LINHA é a do campo mais alto dela — é isso que empurra os campos de
 * baixo em vez de deixá-los sobrepor.
 */
function gridCampos(doc, x, y, largura, campos, pesos) {
  const nCols = pesos.length
  const larguraUtil = largura - GAP_COL * (nCols - 1)
  const larguras = pesos.map(p => larguraUtil * p)
  const xs = larguras.map((_, i) => x + larguras.slice(0, i).reduce((s, w) => s + w, 0) + GAP_COL * i)
  for (let i = 0; i < campos.length; i += nCols) {
    let hMax = 0
    campos.slice(i, i + nCols).forEach(([rotulo, valor], j) => {
      hMax = Math.max(hMax, desenharCampo(doc, xs[j], y, larguras[j], rotulo, valor))
    })
    y += hMax + 4
  }
  return y
}

/** Altura que uma grade vai ocupar — para decidir a quebra de página ANTES de desenhar. */
function medirGrid(doc, largura, campos, pesos) {
  const nCols = pesos.length
  const larguraUtil = largura - GAP_COL * (nCols - 1)
  const larguras = pesos.map(p => larguraUtil * p)
  let h = 0
  for (let i = 0; i < campos.length; i += nCols) {
    let hMax = 0
    campos.slice(i, i + nCols).forEach(([rotulo, valor], j) => {
      hMax = Math.max(hMax, medirCampo(doc, larguras[j], rotulo, valor).altura)
    })
    h += hMax + 4
  }
  return h
}

// BUG-021.6: par (potência kW, corrente A) CONFIGURADO a partir da limitação salva
// (espelha limitesEfetivosCarregador do wizard). Deriva o valor que não foi digitado.
function limitesConfigurados(lim, tensaoV, numeroFases) {
  const V = Number(tensaoV) || 220
  const raiz3 = Number(numeroFases) === 3 ? Math.sqrt(3) : 1
  const fp = 0.95
  if (lim?.modo === 'potencia' && Number(lim.potencia_max_kw) > 0) {
    const p = Number(lim.potencia_max_kw)
    return { potencia_kw: p, corrente_a: (p * 1000) / (V * raiz3 * fp) }
  }
  if (lim?.modo === 'corrente' && Number(lim.corrente_max_a) > 0) {
    const i = Number(lim.corrente_max_a)
    return { potencia_kw: (i * V * raiz3 * fp) / 1000, corrente_a: i }
  }
  return { potencia_kw: null, corrente_a: null }
}

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
  // BUG-022: a logo passa a ficar DENTRO da faixa (à esquerda), em vez de acima dela —
  // a identidade visual é a mesma e a altura do cabeçalho não aumenta; ao contrário,
  // deixa de gastar os ~42pt que a logo consumia sozinha numa faixa própria.
  const logoBuf = base64ParaBuffer(logoBase64)
  const larguraLogo = logoBuf ? 118 : 0

  const xTexto = margem + 12 + larguraLogo
  const larguraTexto = largura - 24 - larguraLogo
  const titulo = 'MEMORIAL DESCRITIVO — CIRCUITO PARA CARREGADOR VEICULAR (WALLBOX)'
  // Altura do título calculada de verdade (heightOfString) — em páginas mais estreitas
  // (retrato) o título quebra em 2 linhas; sem isso o subtítulo ficava sobreposto.
  doc.font('Helvetica-Bold').fontSize(11.5)
  const alturaTitulo = doc.heightOfString(titulo, { width: larguraTexto, lineGap: 0.5 })
  const alturaFaixa = Math.max(alturaTitulo + 20, logoBuf ? 40 : 0)
  doc.rect(margem, y0, largura, alturaFaixa).fill('#0f766e')

  if (logoBuf) {
    try {
      // fundo branco atrás da logo: preserva as cores da marca sobre a faixa teal
      doc.rect(margem + 6, y0 + 5, larguraLogo, alturaFaixa - 10).fill('#ffffff')
      doc.image(logoBuf, margem + 10, y0 + 8, { fit: [larguraLogo - 8, alturaFaixa - 16], align: 'left' })
    } catch { /* logo corrompida/ilegível — segue sem ela */ }
  }

  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11.5)
    .text(titulo, xTexto, y0 + 5, { width: larguraTexto, lineGap: 0.5 })
  const carregador = (projeto.carregadores && projeto.carregadores[0]) || {}
  const potenciaTxt = carregador.potencia_kw ? `${carregador.potencia_kw}kW` : '—'
  const tensaoTxt = carregador.tensao_entrada_v ? `${carregador.tensao_entrada_v}V` : '—'
  const faseTxt = Number(carregador.numero_fases) >= 3 ? 'Trifásico' : 'Monofásico'
  doc.font('Helvetica').fontSize(8)
    .text(`Potência nominal: ${potenciaTxt}  |  Tensão: ${tensaoTxt} — ${faseTxt}  |  Projeto: ${esc(projeto.nome)}`,
      xTexto, y0 + 6 + alturaTitulo, { width: larguraTexto })
  return y0 + alturaFaixa + 6
}

// BUG-023: títulos com mais respiro acima (separam visualmente as seções) e abaixo.
function tituloSecao(doc, x, y, largura, texto) {
  doc.rect(x, y, 3, 11).fill('#0f766e')
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text(esc(texto), x + 7, y - 1, { width: largura - 7 })
  return y + 15
}
// Altura reservada ao pedir espaço para um título: o próprio título + a primeira linha do
// texto que vem abaixo. Impede o defeito citado no RCA — título sozinho no pé da página.
const ALTURA_TITULO_COM_ORFAO = 46

// Escreve texto e devolve o Y seguinte, calculando a altura real do bloco com
// heightOfString (doc.y não é confiável quando x/y são passados explicitamente).
// BUG-023 (item 3): espaçamento entre parágrafos aumentado — leitura mais folgada.
function escreverBloco(doc, x, y, largura, texto, { negrito = false, tamanho = F.corpo, cor = '#1e293b', lineGap = 1.2, espacoDepois = 6 } = {}) {
  doc.font(negrito ? 'Helvetica-Bold' : 'Helvetica').fontSize(tamanho).fillColor(cor)
  doc.text(esc(texto), x, y, { width: largura, lineGap })
  const altura = doc.heightOfString(esc(texto), { width: largura, lineGap })
  return y + altura + espacoDepois
}

/** Altura de um parágrafo — para decidir a quebra de página antes de desenhar. */
function alturaBloco(doc, largura, texto, { negrito = false, tamanho = F.corpo, lineGap = 1.2, espacoDepois = 6 } = {}) {
  doc.font(negrito ? 'Helvetica-Bold' : 'Helvetica').fontSize(tamanho)
  return doc.heightOfString(esc(texto), { width: largura, lineGap }) + espacoDepois
}

// Tabela (linha = dispositivo | especificação/função).
// BUG-023 (item 5): mesmo conteúdo, com altura de linha e respiro maiores. A altura de
// cada linha continua MEDIDA — descrições longas crescem a linha em vez de vazar.
function tabelaComponentes(doc, x, y, largura, linhas) {
  const colNome = 138
  const colDesc = largura - colNome
  for (const [nome, desc] of linhas) {
    doc.font('Helvetica').fontSize(F.tabela)
    const alturaDesc = doc.heightOfString(esc(desc), { width: colDesc - 8, lineGap: 0.8 })
    doc.font('Helvetica-Bold').fontSize(F.tabela)
    const alturaNome = doc.heightOfString(esc(nome), { width: colNome - 10 })
    const alturaLinha = Math.max(alturaDesc, alturaNome, 12) + 8
    doc.rect(x, y, largura, alturaLinha).fill('#f8fafc')
    doc.font('Helvetica-Bold').fontSize(F.tabela).fillColor('#0f766e').text(esc(nome), x + 5, y + 4, { width: colNome - 10 })
    doc.font('Helvetica').fontSize(F.tabela).fillColor('#1e293b').text(esc(desc), x + colNome, y + 4, { width: colDesc - 8, lineGap: 0.8 })
    y += alturaLinha + 3
  }
  return y
}

/** Altura da tabela de componentes — para a quebra de página. */
function alturaTabelaComponentes(doc, largura, linhas) {
  const colNome = 138
  const colDesc = largura - colNome
  let h = 0
  for (const [nome, desc] of linhas) {
    doc.font('Helvetica').fontSize(F.tabela)
    const aDesc = doc.heightOfString(esc(desc), { width: colDesc - 8, lineGap: 0.8 })
    doc.font('Helvetica-Bold').fontSize(F.tabela)
    const aNome = doc.heightOfString(esc(nome), { width: colNome - 10 })
    h += Math.max(aDesc, aNome, 12) + 8 + 3
  }
  return h
}

/** Faixa slim no topo da página 2 — um documento técnico não pode ter página órfã. */
function cabecalhoContinuacao(doc, margem, y, largura, projeto) {
  doc.rect(margem, y, largura, 18).fill('#0f766e')
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8)
    .text('MEMORIAL DESCRITIVO — continuação', margem + 8, y + 5, { width: largura * 0.5, lineBreak: false })
  doc.font('Helvetica').fontSize(7.6)
    .text(esc(projeto.nome), margem + largura * 0.5, y + 5.5, { width: largura * 0.5 - 8, align: 'right', lineBreak: false })
  return y + 18 + 10
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

// FEATURE-006 (item 1): cabeçalho técnico de identificação do documento.
//
// BUG-023 — reorganizado em 4 blocos, todos regidos pela regra de quebra (medirCampo):
//   BLOCO 1 (linha única, largura total): Projeto · Data · Responsável Técnico
//   BLOCO 2 (2 colunas): Cliente · CPF/CNPJ · E-mail · Telefone
//   BLOCO 3 (2 colunas): Endereço Completo (largura total) · CEP · Cidade/UF
//   BLOCO 4 (2 colunas): Concessionária · UC · Classe/Grupo · Tipo de Ligação ·
//                        Carga Instalada · Disjuntor Geral
//
// Duas decisões de diagramação, dentro do que o lote pede ("distribuição do conteúdo"):
//  - o Endereço Completo ocupa a LARGURA TOTAL do bloco 3. Ele é o campo mais longo e,
//    espremido em meia coluna, quebraria em 3-4 linhas; os campos curtos (CEP, Cidade/UF)
//    seguem em 2 colunas. O bloco continua sendo de 2 colunas, sem buraco.
//  - o campo "Bairro" não é impresso: ele não existe no cadastro do cliente (vem embutido
//    no endereço completo). Entra quando o lote do endereço estruturado + CEP for feito.
function blocoIdentificacao(doc, x, y, largura, projeto, cliente, tecnico) {
  const rtNome = esc(tecnico?.nome) || '—'
  const rtReg = tecnico?.crea ? `CREA ${esc(tecnico.crea)}` : (tecnico?.cft ? `CFT ${esc(tecnico.cft)}` : '')
  const data = esc(projeto.data) || new Date().toLocaleDateString('pt-BR')
  const ou = (v) => (v === 0 ? '0' : (esc(v) || '—'))
  const cidadeUF = [esc(cliente?.cidade), esc(cliente?.estado)].filter(Boolean).join(' / ') || '—'
  const classeGrupo = [esc(cliente?.classificacao), esc(cliente?.subgrupo)].filter(Boolean).join(' / ') || '—'

  const bloco1 = [
    ['Projeto', ou(projeto.nome)],
    ['Data', data],
    ['Responsável Técnico', `${rtNome}${rtReg ? ` — ${rtReg}` : ''}`],
  ]
  const bloco2 = [
    ['Cliente', ou(cliente?.nome)],
    ['CPF/CNPJ', ou(cliente?.cpf_cnpj)],
    ['E-mail', ou(cliente?.email)],
    ['Telefone', ou(cliente?.telefone)],
  ]
  const enderecoCompleto = [['Endereço Completo', ou(cliente?.endereco_completo || projeto.endereco_completo)]]
  const bloco3 = [
    ['CEP', ou(cliente?.cep)],
    ['Cidade / UF', cidadeUF],
  ]
  const bloco4 = [
    ['Concessionária', ou(cliente?.distribuidora)],
    ['Unidade Consumidora', ou(cliente?.numero_cliente)],
    ['Classe / Grupo', classeGrupo],
    ['Tipo de Ligação', ou(cliente?.tipo_ligacao)],
    ['Carga Instalada (Concessionária)', cliente?.carga_instalada_kw != null ? `${n1(cliente.carga_instalada_kw)} kW` : '—'],
    ['Disjuntor Geral', cliente?.disjuntor_geral_a != null ? `${n1(cliente.disjuntor_geral_a)} A` : '—'],
  ]

  const P1 = [0.46, 0.16, 0.38]   // Projeto é o campo longo — recebe a maior fatia
  const P2 = [0.5, 0.5]
  const PCHEIO = [1]
  const padX = 9
  const larguraInterna = largura - padX * 2

  // A altura da caixa é MEDIDA antes de desenhar a borda — nunca estimada. Era isso que
  // fazia endereço/nome longos vazarem a borda por baixo.
  const alturaConteudo = medirGrid(doc, larguraInterna, bloco1, P1) + 6
    + medirGrid(doc, larguraInterna, bloco2, P2) + 6
    + medirGrid(doc, larguraInterna, enderecoCompleto, PCHEIO)
    + medirGrid(doc, larguraInterna, bloco3, P2) + 6
    + medirGrid(doc, larguraInterna, bloco4, P2)
  const alturaCaixa = 20 + alturaConteudo + 6

  doc.rect(x, y, largura, alturaCaixa).fillAndStroke('#ffffff', '#cbd5e1')
  doc.rect(x, y, largura, 15).fill('#0f766e')
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text('IDENTIFICAÇÃO DO DOCUMENTO', x + padX, y + 4)

  const xi = x + padX
  const separador = (yy) => {
    doc.moveTo(xi, yy).lineTo(xi + larguraInterna, yy).lineWidth(0.5).stroke('#e2e8f0')
    return yy + 6
  }
  let yy = y + 20
  yy = gridCampos(doc, xi, yy, larguraInterna, bloco1, P1)
  yy = separador(yy)
  yy = gridCampos(doc, xi, yy, larguraInterna, bloco2, P2)
  yy = separador(yy)
  yy = gridCampos(doc, xi, yy, larguraInterna, enderecoCompleto, PCHEIO)
  yy = gridCampos(doc, xi, yy, larguraInterna, bloco3, P2)
  yy = separador(yy)
  gridCampos(doc, xi, yy, larguraInterna, bloco4, P2)
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
  // BUG-021.2: a ESPECIFICAÇÃO EXECUTIVA (o que será instalado). O Motor (calc) diz o
  // MÍNIMO exigido; a especificação diz o ADOTADO. As duas coisas aparecem no documento
  // com esses nomes — nunca uma se passando pela outra.
  const esp = especificacaoDoProjeto(projeto)

  const margem = 26
  const largura = doc.page.width - margem * 2

  // ── BUG-023 (item 8): FLUXO PAGINADO ────────────────────────────────────
  // A página 1 fecha a ~75% da área útil; o que não couber continua na página 2, com a
  // folha inteira. Nada é comprimido para caber — `ga(h)` reserva o espaço ANTES de
  // desenhar, e é o que garante "nunca sobrepor".
  const alturaUtil = doc.page.height - margem * 2
  const fluxo = {
    y: margem,
    limite: margem + alturaUtil * LIMITE_P1_PCT,
    limiteFinal: doc.page.height - margem - RESERVA_ASSINATURA,
  }
  const ga = (altura) => {
    if (fluxo.y + altura <= fluxo.limite) return
    doc.addPage({ size: 'A4', layout: 'portrait', margin: 0 })
    fluxo.limite = fluxo.limiteFinal
    fluxo.y = cabecalhoContinuacao(doc, margem, margem, largura, projeto)
  }
  const secao = (titulo) => { ga(ALTURA_TITULO_COM_ORFAO); fluxo.y = tituloSecao(doc, margem, fluxo.y, largura, titulo) }
  const par = (texto, opts) => {
    ga(alturaBloco(doc, largura, texto, opts))
    fluxo.y = escreverBloco(doc, margem, fluxo.y, largura, texto, opts)
  }
  const subitem = (texto) => {
    // BUG-023 (item 4): subitens da memória de cálculo com mais respiro ACIMA, para
    // separá-los visualmente do parágrafo anterior sem alterar nenhuma fórmula.
    ga(ALTURA_TITULO_COM_ORFAO)
    fluxo.y += 3
    fluxo.y = escreverBloco(doc, margem, fluxo.y, largura, texto,
      { negrito: true, tamanho: F.subitem, cor: '#0f172a', espacoDepois: 2 })
  }

  fluxo.y = cabecalho(doc, largura, margem, projeto, logoBase64)

  // ── Identificação do documento (FEATURE-006 item 1 / BUG-023 blocos 1-4) ──
  fluxo.y = blocoIdentificacao(doc, margem, fluxo.y, largura, projeto, cliente, tecnico)

  // ── 1. Objetivo ──────────────────────────────────────────────────────────
  const ehTri = Number(carregador.numero_fases) >= 3
  const distancia = projeto.comprimento_cabo_m ?? '—'
  const lim = projeto.limitacao_operacao
  // BUG-022 (item 9): texto mais direto, mesmo significado — sem a enumeração redundante
  // ("critérios técnicos, dimensionamentos, componentes e infraestrutura de suporte"),
  // que já é o que o próprio documento apresenta nas seções seguintes.
  secao('1. Objetivo')
  par(`Especificar o circuito alimentador do carregador de veículo elétrico (Wallbox) ${esc(carregador.marca || '')} ${esc(carregador.modelo || '')}, `
    + `de ${carregador.potencia_kw ?? '—'} kW / ${carregador.tensao_entrada_v ?? '—'} V (${ehTri ? 'trifásico' : 'monofásico'}), com percurso de `
    + `${distancia} m entre a origem (padrão de entrada/quadro geral) e o quadro de proteção dedicado ao carregador, conforme ABNT NBR 5410 e ABNT NBR 17019.`)

  // ── 2. Características gerais — BUG-023 (item 2): 3 COLUNAS x 2 LINHAS ────
  // Eram 5 colunas numa faixa de altura fixa: apertadas, o valor quebrava e vazava
  // ("Fase-Neutro"). Com 3 colunas cada campo tem quase o dobro de largura e usa a regra
  // de quebra — a linha cresce se precisar, nada invade o campo vizinho.
  //
  // CORRENTE (e POTÊNCIA): quando há limitação de operação, estes são os valores
  // CONFIGURADOS, não os nominais — é para eles que o circuito foi dimensionado, e é a
  // configuração que o memorial exige antes da entrada em operação. Mostrar 22 kW ao lado
  // de 16,71 A seria um par fisicamente incoerente. Os nominais de fábrica aparecem no
  // cabeçalho e, por extenso, na seção "Limitação de Operação" logo abaixo.
  const cfgCaract = lim?.habilitado
    ? limitesConfigurados(lim, carregador.tensao_entrada_v ?? 220, carregador.numero_fases ?? 1)
    : null
  const potenciaCaract = Number.isFinite(Number(cfgCaract?.potencia_kw)) ? cfgCaract.potencia_kw : carregador.potencia_kw
  const correnteCaract = Number.isFinite(Number(cfgCaract?.corrente_a)) ? cfgCaract.corrente_a : carregador.corrente_entrada_a

  secao('2. Características Gerais e Infraestrutura')
  const itensCaract = [
    ['Potência', `${n1(potenciaCaract)} kW`],
    ['Tensão', `${carregador.tensao_entrada_v ?? '—'} V (${ehTri ? 'Trifásico' : 'Fase-Neutro'})`],
    ['Corrente', `${n1(correnteCaract)} A`],
    ['Comprimento', `${distancia} m`],
    ['Condutor', 'Cobre / PVC 70°C'],
    ['Conector', carregador.tipo_conector ? `Tipo ${carregador.tipo_conector}` : '—'],
  ]
  const P3 = [1 / 3, 1 / 3, 1 / 3]
  const hCaract = medirGrid(doc, largura - 10, itensCaract, P3)
  ga(hCaract + 8)
  doc.rect(margem, fluxo.y, largura, hCaract + 6).fill('#f8fafc')
  fluxo.y = gridCampos(doc, margem + 5, fluxo.y + 4, largura - 10, itensCaract, P3)
  fluxo.y += 6

  // ── Limitação de Operação do Carregador (BUG-021.6) ───────────────────────
  // Só imprime quando houver limitação habilitada. TEXTO FIXO + variáveis.
  if (lim?.habilitado) {
    const cfg = limitesConfigurados(lim, carregador.tensao_entrada_v ?? 220, carregador.numero_fases ?? 1)
    // BUG-022: os três parágrafos viraram dois — o primeiro (nominais) foi absorvido pelo
    // segundo, que já precisava contrastar nominal x configurado. O aviso obrigatório
    // continua destacado e literal: é ele que condiciona a entrada em operação.
    secao('Limitação de Operação do Carregador')
    par(`Nominal de fábrica: ${n1(carregador.potencia_kw)} kW / ${n1(carregador.corrente_entrada_a)} A. Este circuito foi dimensionado para `
      + `OPERAÇÃO LIMITADA: potência configurada de ${n1(cfg.potencia_kw)} kW e corrente configurada de ${n1(cfg.corrente_a)} A — `
      + `valores efetivamente adotados no dimensionamento do disjuntor, IDR, DPS e condutores deste memorial.`)
    par(`A parametrização do carregador deverá respeitar OBRIGATORIAMENTE esta configuração (máximo de `
      + `${n1(cfg.potencia_kw)} kW / ${n1(cfg.corrente_a)} A) antes da sua entrada em operação. O circuito NÃO está `
      + `dimensionado para a potência nominal integral do equipamento.`, { negrito: true })
  }

  // ── Verificação da Disponibilidade Elétrica (FEATURE-006 item 2) ──────────
  // TEXTO FIXO (nunca gerar por IA). Apenas as variáveis são substituídas. Dados não
  // informados no sistema saem como espaço em branco (BRANCO) para preenchimento manual.
  const nA = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? BRANCO : fmt(v, 2).replace(/,00$/, '').replace(/(,\d)0$/, '$1'))
  const cargaTxt = cliente?.carga_instalada_kw != null ? `${nA(cliente.carga_instalada_kw)} kW` : BRANCO
  const concessTxt = esc(cliente?.distribuidora) || BRANCO
  const iAferida = projeto.corrente_aferida_a
  // BUGFIX disponibilidade x limitação: a corrente que o carregador REALMENTE puxa na
  // fase é a da operação CONFIGURADA quando há limitação — não a nominal. Antes somava-se
  // sempre a nominal (ex.: 6 A aferidos + 32 A nominais = 38 A), o que além de superestimar
  // a demanda gerava uma contradição no próprio parágrafo ("38 A ... inferior a 32 A"). Com
  // o carregador limitado a 11 kW (16,71 A), o previsto é 6 + 16,71 = 22,71 A — coerente com
  // o disjuntor limitado e com o resto do memorial, que já adota o valor configurado.
  const cfgLim = lim?.habilitado ? limitesConfigurados(lim, carregador.tensao_entrada_v ?? 220, carregador.numero_fases ?? 1) : null
  const usarLim = Number.isFinite(Number(cfgLim?.corrente_a))
  const iCarregador = usarLim ? cfgLim.corrente_a : carregador.corrente_entrada_a
  const rotuloCorrente = usarLim ? 'corrente configurada do carregador (operação limitada)' : 'corrente nominal do carregador'
  const iFinal = (Number.isFinite(Number(iAferida)) && Number.isFinite(Number(iCarregador))) ? Number(iAferida) + Number(iCarregador) : null
  // BUG-023 (item 3): texto inalterado — só distribuição e espaçamento entre parágrafos.
  secao('Verificação da Disponibilidade Elétrica')
  par(`A unidade consumidora possui Carga Instalada de ${cargaTxt}, conforme cadastro da concessionária ${concessTxt}.`)
  par(`Durante a vistoria técnica foi realizada a aferição da corrente na fase destinada à alimentação do carregador de veículo `
    + `elétrico, obtendo-se o valor de ${nA(iAferida)} A.`)
  par(`Considerando a ${rotuloCorrente} (${nA(iCarregador)} A), a corrente prevista na fase após a utilização do `
    + `carregador será de ${nA(iFinal)} A, permanecendo inferior à capacidade do circuito de entrada protegido por disjuntor de `
    + `${nA(cliente?.disjuntor_geral_a)} A.`)
  par(`Conclui-se que existe disponibilidade elétrica na fase destinada à alimentação do carregador de veículo elétrico, não `
    + `sendo necessária, nas condições aferidas, solicitação de aumento da carga instalada junto à concessionária.`)

  // ── 3. Memória de cálculo ───────────────────────────────────────────────
  // BUG-023 (item 4): fórmulas, cálculos e critérios INTOCADOS — só espaçamento.
  secao('3. Memória de Cálculo')

  subitem('3.1. Corrente de Projeto (Ib)')
  if (lim?.habilitado) {
    // BUG-021.5/6: com limitação, o Ib do dimensionamento é o da OPERAÇÃO CONFIGURADA
    // (calc.corrente_projeto_a já vem calculado com o valor limitado) — nunca o nominal,
    // senão a 3.1 divergiria da 3.2/3.3 e do disjuntor especificado.
    const cfg = limitesConfigurados(lim, carregador.tensao_entrada_v ?? 220, carregador.numero_fases ?? 1)
    par(`Corrente de projeto adotada = corrente da OPERAÇÃO LIMITADA configurada (${n1(cfg.potencia_kw)} kW), `
      + `inferior à nominal do fabricante (${n1(carregador.corrente_entrada_a)} A): Ib = ${fmt(calc.corrente_projeto_a, 2)} A. `
      + `Todo o dimensionamento a seguir usa este valor.`)
  } else if (carregador.corrente_entrada_a) {
    par(`Corrente nominal informada pelo fabricante (catálogo/datasheet do equipamento) — prioridade normativa sobre o `
      + `cálculo teórico: Ib = ${fmt(carregador.corrente_entrada_a, 2)} A.`)
  } else {
    const v = carregador.tensao_entrada_v || 220
    const formula = ehTri ? 'Ib = P / (V x 1,732 x fp)' : 'Ib = P / (V x fp)'
    par(`${formula}, com fp = 0,95 (fator de potência). `
      + `Ib = ${(carregador.potencia_kw || 0) * 1000} / (${v}${ehTri ? ' x 1,732' : ''} x 0,95) = ${fmt(calc.corrente_projeto_a, 2)} A.`)
  }

  // BUG-021.2: o Motor dimensiona o MÍNIMO; a Seção 4 traz o ADOTADO. Antes, este
  // parágrafo dizia "a proteção adotada é o disjuntor de {Motor} A" — e passava a
  // contradizer a Seção 4 assim que o operador especificava outro disjuntor. Agora o
  // texto distingue os dois papéis e confere o adotado contra o mínimo.
  const iz = CAPACIDADE_CABO_A[calc.bitola_cabo_mm2] ?? null
  const disjAdotado = esp.componentes.disjuntor.corrente_a
  const bitolaAdotada = (esp.condutores.find(c => c.id !== 'PE') || {}).bitola_mm2
  const izAdotado = CAPACIDADE_CABO_A[bitolaAdotada] ?? null
  const abaixoDoMinimo =
    (Number(disjAdotado) < Number(calc.disjuntor_a)) || (Number(bitolaAdotada) < Number(calc.bitola_cabo_mm2))

  subitem('3.2. Capacidade de Condução de Corrente e Proteção')
  par(`De acordo com a NBR 5410 (Tabela 36, método de referência B1), o dimensionamento exige, no mínimo, condutor de `
    + `${fmt(calc.bitola_cabo_mm2, 1)} mm² (Iz = ${iz != null ? fmt(iz, 1) : '—'} A) e disjuntor de ${calc.disjuntor_a ?? '—'} A, `
    + `atendendo ao critério Ib <= In <= Iz (${fmt(calc.corrente_projeto_a, 2)} A <= ${calc.disjuntor_a ?? '—'} A <= ${iz != null ? fmt(iz, 1) : '—'} A). `
    + `A especificação executiva adotada (Seção 4) é de ${fmt(bitolaAdotada, 1)} mm² `
    + `(Iz = ${izAdotado != null ? fmt(izAdotado, 1) : '—'} A) e disjuntor de ${disjAdotado ?? '—'} A, curva ${esp.componentes.disjuntor.curva || 'C'}.`)
  if (abaixoDoMinimo) {
    par(`ATENÇÃO: a especificação adotada está ABAIXO do mínimo dimensionado — revisar antes da execução.`,
      { negrito: true, cor: '#b91c1c' })
  }

  subitem('3.3. Verificação da Queda de Tensão (dV)')
  par(`Considerando a resistividade do cobre rho = 0,0179 Ohm.mm²/m: dV (%) = [(rho x L x Ib) / S] / V x 100. `
    + `dV (%) = [(0,0179 x ${distancia} x ${fmt(calc.corrente_projeto_a, 2)}) / ${fmt(calc.bitola_cabo_mm2, 1)}] / ${carregador.tensao_entrada_v || 220} x 100 = ${fmt(calc.queda_tensao_pct, 2)}%. `
    + `Conclusão: a queda de tensão calculada fica ${Number(calc.queda_tensao_pct) <= 3 ? 'dentro' : 'ACIMA'} do limite de 3% exigido pela NBR 5410 `
    + `para circuitos terminais, ${Number(calc.queda_tensao_pct) <= 3 ? 'validando' : 'exigindo revisão de'} a bitola adotada para os ${distancia} metros do percurso.`)

  // ── 4. Especificação dos componentes (tabela compacta) ──────────────────
  // BUG-021.2/3/4: TUDO nesta seção vem da ESPECIFICAÇÃO EXECUTIVA — os mesmos valores
  // que o Unifilar desenha e a Lista de Materiais compra. Nunca mais do Motor.
  const eDisj = esp.componentes.disjuntor
  const eIdr = esp.componentes.idr
  const eDps = esp.componentes.dps
  const nDps = Number(esp.fases) >= 3 ? 4 : 2
  const vivos = esp.condutores.filter(c => c.id !== 'PE').map(c => c.id).join(', ')
  const pe = esp.condutores.find(c => c.id === 'PE')
  const CORES_COND = { L1: 'preto', L2: 'vermelho', L3: 'cinza', N: 'azul', PE: 'verde/amarelo' }

  // BUG-023 (item 5): mesmo conteúdo; só espaçamento, altura de linha e alinhamento.
  const linhasComponentes = [
    ['Disjuntor Termomagnético', `${eDisj.corrente_a ?? '—'} A, Curva ${eDisj.curva || 'C'}, ${eDisj.polos ?? (ehTri ? 4 : 2)}P — proteção contra sobrecarga e curto-circuito.`],
    ['IDR (Interruptor Diferencial Residual)', `${eIdr.corrente_a ?? '—'} A, ${eIdr.sensibilidade_ma ?? 30} mA, Tipo ${eIdr.tipo || 'A'}, ${eIdr.polos ?? (ehTri ? 4 : 2)}P — obrigatório pela NBR 17019, detecta fuga com componente contínua pulsante do carregador.`],
    // BUG-021.1: quantidade de DPS = 1 por condutor vivo (mono 2: L1+N; tri 4: L1+L2+L3+N).
    ['DPS (Proteção contra Surtos)', `${nDps} unidades, Classe ${eDps.classe || 'II'}, ${eDps.tensao_v ?? '—'} V, Imax ${eDps.imax_ka ?? 45} kA, ${eDps.polos ?? 1}P — um por condutor vivo (${vivos}); protege a eletrônica do carregador contra surtos atmosféricos e de manobra.`],
    // BUG-021.3: condutores com identidade permanente — cada um com sua bitola/comprimento.
    ['Condutores', esp.condutores.map(c =>
      `${c.id} (${CORES_COND[c.id]}): ${fmt(c.bitola_mm2, 1)} mm², ${fmt(c.comprimento_m, 1)} m`,
    ).join(' · ') + ' — cobre, isolação PVC 70°C.'],
    ['Condutor de Proteção (PE)', `${fmt(pe?.bitola_mm2, 1)} mm² — aterramento do carregador e das massas metálicas (NBR 5410 6.4).`],
    ['Quadro de Proteção EV', 'Quadro dedicado ao circuito do carregador, abrigando disjuntor, IDR e DPS em trilho DIN.'],
  ]
  // A tabela não é fatiada entre páginas: se não couber inteira no que resta, vai inteira
  // para a página seguinte. Uma tabela partida ao meio é justamente o defeito editorial
  // que este lote existe para eliminar.
  ga(ALTURA_TITULO_COM_ORFAO + alturaTabelaComponentes(doc, largura, linhasComponentes))
  fluxo.y = tituloSecao(doc, margem, fluxo.y, largura, '4. Especificação dos Componentes e Proteções')
  fluxo.y = tabelaComponentes(doc, margem, fluxo.y, largura, linhasComponentes)
  fluxo.y += 6

  // ── 5. Diretrizes de execução ────────────────────────────────────────────
  secao('5. Diretrizes para Execução')
  par('Eletroduto instalado de forma alinhada, com curvas de raio longo nas mudanças de direção. Fixação com espaçamento máximo de 1 metro '
    + 'entre abraçadeiras. Extremidades com buchas/arruelas de acabamento para não danificar a isolação dos condutores. Identificação de '
    + 'cores dos condutores conforme NBR 5410.')

  // ── Conclusão Técnica (FEATURE-006 item 3) — TEXTO FIXO ───────────────────
  secao('Conclusão Técnica')
  par(`Com base nos dados da unidade consumidora, nas informações fornecidas pelo fabricante do equipamento, na vistoria `
    + `técnica realizada e nos dimensionamentos apresentados neste memorial, conclui-se que o circuito destinado à alimentação `
    + `do carregador de veículo elétrico atende aos requisitos das ABNT NBR 5410 e ABNT NBR 17019, estando tecnicamente apto `
    + `para execução conforme as especificações deste documento.`)

  // ── Assinaturas ──────────────────────────────────────────────────────────
  // Ancoradas no rodapé da ÚLTIMA página (BUG-022). RESERVA_ASSINATURA já garante que o
  // conteúdo nunca avance sobre esta faixa, então elas jamais sobrepõem texto.
  const y = fluxo.y
  const larguraAssin = (largura - 20) / 2
  const xDir = margem + larguraAssin + 20
  const linhaY = Math.max(y + 14, doc.page.height - margem - 24)
  doc.moveTo(margem, linhaY).lineTo(margem + larguraAssin, linhaY).stroke('#94a3b8')
  doc.moveTo(xDir, linhaY).lineTo(xDir + larguraAssin, linhaY).stroke('#94a3b8')
  doc.font('Helvetica').fontSize(7.6).fillColor('#334155')
    .text(`Responsável Técnico: ${esc(tecnico.nome) || '—'}${tecnico.crea ? ` — CREA ${esc(tecnico.crea)}` : ''}${tecnico.cft ? ` — CFT ${esc(tecnico.cft)}` : ''}`,
      margem, linhaY + 3, { width: larguraAssin })
  doc.text(`Cliente: ${esc(cliente.nome) || '—'}${cliente.cpf_cnpj ? ` — CPF/CNPJ ${esc(cliente.cpf_cnpj)}` : ''}`, xDir, linhaY + 3, { width: larguraAssin })
}
