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

// BUG-022: alturas/fontes reduzidas — o conteúdo cresceu (limitação de operação,
// condutores por identidade) e a diagramação não acompanhou. Nada de conteúdo mudou aqui.
function tituloSecao(doc, x, y, largura, texto) {
  doc.rect(x, y, 3, 11).fill('#0f766e')
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text(esc(texto), x + 7, y - 1, { width: largura - 7 })
  return y + 13
}

// Escreve texto e devolve o Y seguinte, calculando a altura real do bloco com
// heightOfString (doc.y não é confiável quando x/y são passados explicitamente).
function escreverBloco(doc, x, y, largura, texto, { negrito = false, tamanho = 8.4, cor = '#1e293b', lineGap = 0.6, espacoDepois = 3 } = {}) {
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
  const colNome = 132
  const colDesc = largura - colNome
  for (const [nome, desc] of linhas) {
    doc.font('Helvetica').fontSize(8)
    const alturaDesc = doc.heightOfString(esc(desc), { width: colDesc - 4, lineGap: 0.5 })
    const alturaLinha = Math.max(alturaDesc, 10) + 4
    doc.rect(x, y, largura, alturaLinha).fill('#f8fafc')
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f766e').text(esc(nome), x + 4, y + 2, { width: colNome - 8 })
    doc.font('Helvetica').fontSize(8).fillColor('#1e293b').text(esc(desc), x + colNome, y + 2, { width: colDesc - 4, lineGap: 0.5 })
    y += alturaLinha + 1.5
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

  // BUG-022: grid em 3 COLUNAS (era 2) — os 6 campos passam de 3 linhas para 2, sem
  // perder nenhum dado. A altura da caixa é MEDIDA (heightOfString), não estimada: um
  // endereço longo quebra em duas linhas e antes vazava a borda por baixo, sobrepondo
  // a linha do Responsável Técnico.
  const padY = 19, linhaH = 11.5, nCols = 3, colW = largura / nCols
  const nLinhasGrid = Math.ceil(pares.length / nCols)
  doc.font('Helvetica').fontSize(7.4)
  const hEndereco = Math.max(doc.heightOfString(`Endereço: ${endereco}`, { width: largura - 16 }), linhaH)
  const hRT = Math.max(doc.heightOfString(`Responsável Técnico: ${rt}`, { width: largura - 16 }), linhaH)
  const alturaCaixa = padY + nLinhasGrid * linhaH + hEndereco + hRT + 5
  doc.rect(x, y, largura, alturaCaixa).fillAndStroke('#ffffff', '#cbd5e1')
  doc.rect(x, y, largura, 14).fill('#0f766e')
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text('IDENTIFICAÇÃO DO DOCUMENTO', x + 8, y + 3.5)
  let yy = y + padY
  pares.forEach(([k, v], i) => {
    const cx = x + 8 + (i % nCols) * colW
    if (i % nCols === 0 && i > 0) yy += linhaH
    doc.font('Helvetica-Bold').fontSize(7.4).fillColor('#334155').text(`${k}:`, cx, yy, { width: colW - 12, continued: true })
    doc.font('Helvetica').fillColor('#1e293b').text(` ${v}`)
  })
  yy += linhaH
  doc.font('Helvetica-Bold').fontSize(7.4).fillColor('#334155').text('Endereço:', x + 8, yy, { width: largura - 16, continued: true })
  doc.font('Helvetica').fillColor('#1e293b').text(` ${endereco}`)
  yy += hEndereco
  doc.font('Helvetica-Bold').fontSize(7.4).fillColor('#334155').text('Responsável Técnico:', x + 8, yy, { width: largura - 16, continued: true })
  doc.font('Helvetica').fillColor('#1e293b').text(` ${rt}`)
  return y + alturaCaixa + 6
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

  let y = cabecalho(doc, largura, margem, projeto, logoBase64)

  // ── Identificação do documento (FEATURE-006 item 1) ───────────────────────
  y = blocoIdentificacao(doc, margem, y, largura, projeto, cliente, tecnico)

  // ── 1. Objetivo ──────────────────────────────────────────────────────────
  const ehTri = Number(carregador.numero_fases) >= 3
  const distancia = projeto.comprimento_cabo_m ?? '—'
  // BUG-022 (item 9): texto mais direto, mesmo significado — sem a enumeração redundante
  // ("critérios técnicos, dimensionamentos, componentes e infraestrutura de suporte"),
  // que já é o que o próprio documento apresenta nas seções seguintes.
  y = tituloSecao(doc, margem, y, largura, '1. Objetivo')
  y = escreverBloco(doc, margem, y, largura,
    `Especificar o circuito alimentador do carregador de veículo elétrico (Wallbox) ${esc(carregador.marca || '')} ${esc(carregador.modelo || '')}, `
    + `de ${carregador.potencia_kw ?? '—'} kW / ${carregador.tensao_entrada_v ?? '—'} V (${ehTri ? 'trifásico' : 'monofásico'}), com percurso de `
    + `${distancia} m entre a origem (padrão de entrada/quadro geral) e o quadro de proteção dedicado ao carregador, conforme ABNT NBR 5410 e ABNT NBR 17019.`)

  // ── 2. Características gerais — BUG-022 (item 3): TABELA compacta de UMA linha ────
  // Antes cada item empilhava rótulo sobre valor (2 linhas) e ainda sobrava respiro.
  // Agora é uma faixa única "rótulo valor", com todos os campos lado a lado.
  y = tituloSecao(doc, margem, y, largura, '2. Características Gerais e Infraestrutura')
  const itensCaract = [
    ['Potência', `${carregador.potencia_kw ?? '—'} kW`],
    ['Tensão', `${carregador.tensao_entrada_v ?? '—'} V (${ehTri ? 'Trifásico' : 'Fase-Neutro'})`],
    ['Comprimento', `${distancia} m`],
    ['Condutor', 'Cu / PVC 70°C'],
    ['Conector', carregador.tipo_conector ? `Tipo ${carregador.tipo_conector}` : '—'],
  ]
  const colCaract = largura / itensCaract.length
  const hCaract = 15
  doc.rect(margem, y, largura, hCaract).fill('#f8fafc')
  itensCaract.forEach(([chave, valor], i) => {
    const x = margem + i * colCaract + 5
    // lineBreak:false é ESSENCIAL: numa faixa de altura fixa, uma quebra de linha faria o
    // texto vazar para fora do fundo e colidir com o título da seção seguinte. Rótulo e
    // valor são posicionados por medição (widthOfString), nunca por fluxo.
    doc.font('Helvetica-Bold').fontSize(7.6).fillColor('#0f766e')
    const wChave = doc.widthOfString(`${esc(chave)} `)
    doc.text(esc(chave), x, y + 4.5, { width: colCaract - 8, lineBreak: false })
    doc.font('Helvetica').fontSize(8).fillColor('#0f172a')
      .text(esc(valor), x + wChave, y + 4, { width: colCaract - 8 - wChave, lineBreak: false })
  })
  y += hCaract + 4

  // ── Limitação de Operação do Carregador (BUG-021.6) ───────────────────────
  // Só imprime quando houver limitação habilitada. TEXTO FIXO + variáveis.
  const lim = projeto.limitacao_operacao
  if (lim?.habilitado) {
    const cfg = limitesConfigurados(lim, carregador.tensao_entrada_v ?? 220, carregador.numero_fases ?? 1)
    // BUG-022: os três parágrafos viraram dois — o primeiro (nominais) foi absorvido pelo
    // segundo, que já precisava contrastar nominal x configurado. O aviso obrigatório
    // continua destacado e literal: é ele que condiciona a entrada em operação.
    y = tituloSecao(doc, margem, y, largura, 'Limitação de Operação do Carregador')
    y = escreverBloco(doc, margem, y, largura,
      `Nominal de fábrica: ${n1(carregador.potencia_kw)} kW / ${n1(carregador.corrente_entrada_a)} A. Este circuito foi dimensionado para `
      + `OPERAÇÃO LIMITADA: potência configurada de ${n1(cfg.potencia_kw)} kW e corrente configurada de ${n1(cfg.corrente_a)} A — `
      + `valores efetivamente adotados no dimensionamento do disjuntor, IDR, DPS e condutores deste memorial.`)
    y = escreverBloco(doc, margem, y, largura,
      `A parametrização do carregador deverá respeitar OBRIGATORIAMENTE esta configuração (máximo de `
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
  if (lim?.habilitado) {
    // BUG-021.5/6: com limitação, o Ib do dimensionamento é o da OPERAÇÃO CONFIGURADA
    // (calc.corrente_projeto_a já vem calculado com o valor limitado) — nunca o nominal,
    // senão a 3.1 divergiria da 3.2/3.3 e do disjuntor especificado.
    const cfg = limitesConfigurados(lim, carregador.tensao_entrada_v ?? 220, carregador.numero_fases ?? 1)
    y = escreverBloco(doc, margem, y, largura,
      `Corrente de projeto adotada = corrente da OPERAÇÃO LIMITADA configurada (${n1(cfg.potencia_kw)} kW), `
      + `inferior à nominal do fabricante (${n1(carregador.corrente_entrada_a)} A): Ib = ${fmt(calc.corrente_projeto_a, 2)} A. `
      + `Todo o dimensionamento a seguir usa este valor.`)
  } else if (carregador.corrente_entrada_a) {
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

  y = escreverBloco(doc, margem, y, largura, '3.2. Capacidade de Condução de Corrente e Proteção', { negrito: true, tamanho: 8.8, cor: '#0f172a', espacoDepois: 1 })
  y = escreverBloco(doc, margem, y, largura,
    `De acordo com a NBR 5410 (Tabela 36, método de referência B1), o dimensionamento exige, no mínimo, condutor de `
    + `${fmt(calc.bitola_cabo_mm2, 1)} mm² (Iz = ${iz != null ? fmt(iz, 1) : '—'} A) e disjuntor de ${calc.disjuntor_a ?? '—'} A, `
    + `atendendo ao critério Ib <= In <= Iz (${fmt(calc.corrente_projeto_a, 2)} A <= ${calc.disjuntor_a ?? '—'} A <= ${iz != null ? fmt(iz, 1) : '—'} A). `
    + `A especificação executiva adotada (Seção 4) é de ${fmt(bitolaAdotada, 1)} mm² `
    + `(Iz = ${izAdotado != null ? fmt(izAdotado, 1) : '—'} A) e disjuntor de ${disjAdotado ?? '—'} A, curva ${esp.componentes.disjuntor.curva || 'C'}.`)
  if (abaixoDoMinimo) {
    y = escreverBloco(doc, margem, y, largura,
      `ATENÇÃO: a especificação adotada está ABAIXO do mínimo dimensionado — revisar antes da execução.`,
      { negrito: true, cor: '#b91c1c' })
  }

  y = escreverBloco(doc, margem, y, largura, '3.3. Verificação da Queda de Tensão (dV)', { negrito: true, tamanho: 8.8, cor: '#0f172a', espacoDepois: 1 })
  y = escreverBloco(doc, margem, y, largura,
    `Considerando a resistividade do cobre rho = 0,0179 Ohm.mm²/m: dV (%) = [(rho x L x Ib) / S] / V x 100. `
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

  y = tituloSecao(doc, margem, y, largura, '4. Especificação dos Componentes e Proteções')
  y = tabelaComponentes(doc, margem, y, largura, [
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
  // BUG-022: ANCORADAS NO RODAPÉ da página (não mais logo abaixo do último parágrafo).
  // Assim o espaço que sobra vira respiro entre a Conclusão e as assinaturas, em vez de
  // empurrar as assinaturas para uma segunda página quando o conteúdo cresce.
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
