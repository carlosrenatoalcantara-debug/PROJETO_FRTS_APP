/**
 * arranjosService.js — P1-UX-CORE-EVOLUTION-01 (FASE 3)
 *
 * Suporte a MÚLTIPLOS arranjos de componentes por projeto, de forma retrocompatível.
 *
 * Um "arranjo" é um bloco independente de geração: conjunto de painéis (1+ modelos)
 * + 1+ inversores. Projetos legados têm um arranjo único implícito em
 * `equipamentos.paineis[]` + `equipamentos.inversor`. Estas funções unificam as duas
 * representações para que o motor de dimensionamento e a UI tratem tudo como `arranjos[]`,
 * sem exigir migração destrutiva dos documentos existentes.
 */

let _seq = 0
function novoId(prefixo = 'arr') {
  _seq = (_seq + 1) % 1e6
  return `${prefixo}_${Date.now().toString(36)}_${_seq.toString(36)}`
}

/**
 * Valor POSITIVO declarado. `null` para ausente, não-numérico ou ≤ 0.
 *
 * F12: antes cada agregador fazia `Number(x) || 0`, que colapsa TRÊS estados
 * distintos num só — ausência, valor inválido e zero real viravam `0` e eram
 * somados. Aqui os três continuam distintos: quem chama decide o que fazer com
 * a ausência, em vez de recebê-la já convertida em número.
 */
function _decl(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

/**
 * Potência DC (kWp) somando potencia_w × quantidade de cada painel.
 *
 * ── F12 · Por que `null` e não a soma parcial ───────────────────────────────
 * Esta função fazia `Number(p.potencia_w) || 0`. Um painel sem `potencia_w`
 * entrava na soma valendo ZERO e o total saía numericamente plausível, porém
 * falso. No projeto real "Mercado Avelino" isso produzia, no MESMO objeto,
 * `n_modulos_total = 399` ao lado de `potencia_total_kwp = 77,43` — quando
 * 399 × 445 W = 177,6 kWp. Os dois números se contradiziam, e nada sinalizava
 * que um deles era parcial.
 *
 * A regra agora é a mesma do resto do Core desde a FV-DOM-029: a agregação é
 * COMPLETA ou EXPLICITAMENTE INCOMPLETA. Um único painel sem potência válida
 * torna o total não avaliável — somar os demais e apresentar o resultado como
 * total seria inventar a diferença.
 *
 * @returns {number|null} kWp, ou `null` se QUALQUER painel estiver incompleto.
 */
export function potenciaPaineisKwp(paineis = []) {
  const lista = paineis || []
  if (lista.length === 0) return null
  let wp = 0
  for (const p of lista) {
    const w = _decl(p?.potencia_w)
    const q = _decl(p?.quantidade)
    // Ausência de qualquer um dos dois fatores contamina o total inteiro.
    if (w === null || q === null) return null
    wp += w * q
  }
  return wp > 0 ? Number((wp / 1000).toFixed(3)) : null
}

/**
 * Potência AC (kW) somando potencia_kw × quantidade de cada inversor.
 *
 * F12: mesma disciplina da potência DC acima — mesma causa, mesma correção.
 * `quantidade` ausente continua valendo 1 (é o default do schema e significa
 * "um inversor", não "quantidade desconhecida"); `potencia_kw` ausente, não.
 *
 * @returns {number|null} kW, ou `null` se algum inversor não declarar potência.
 */
export function potenciaInversoresKw(inversores = []) {
  const lista = inversores || []
  if (lista.length === 0) return null
  let kw = 0
  for (const i of lista) {
    const k = _decl(i?.potencia_kw)
    if (k === null) return null
    kw += k * (_decl(i?.quantidade) ?? 1)
  }
  return kw > 0 ? Number(kw.toFixed(3)) : null
}

/** Nº total de módulos de uma lista de painéis (soma das quantidades). */
export function contarModulos(paineis = []) {
  return (paineis || []).reduce((acc, p) => acc + (Number(p?.quantidade) || 0), 0)
}

/** Nº total de inversores de uma lista (soma das quantidades, default 1). */
export function contarInversores(inversores = []) {
  return (inversores || []).reduce((acc, i) => acc + (Number(i?.quantidade) || 1), 0)
}

/** Capacidade total (kWh) das baterias de um arranjo. */
export function capacidadeBateriasKwh(baterias = []) {
  const kwh = (baterias || []).reduce((acc, b) => {
    const c = Number(b?.capacidade_kwh) || 0
    const q = Number(b?.quantidade) || 1
    return acc + c * q
  }, 0)
  return kwh > 0 ? Number(kwh.toFixed(3)) : null
}

/**
 * Detecta a topologia de um arranjo a partir dos inversores/baterias.
 * Prioridade: bess (tem bateria + sem painel) → micro → hibrido → off-grid → otimizador → string.
 * @returns {'string'|'micro'|'hibrido'|'off-grid'|'otimizador'|'bess'|null}
 */
export function detectarTopologia(arranjo = {}) {
  if (arranjo.topologia) return arranjo.topologia   // respeita definição explícita
  const baterias = arranjo.baterias || []
  const paineis = arranjo.paineis || []
  const inv = (arranjo.inversores || [])[0] || {}
  const blob = `${inv.tipo || ''} ${inv.modelo || ''} ${inv.fabricante || ''}`.toLowerCase()

  if (baterias.length > 0 && paineis.length === 0) return 'bess'
  if (/micro/.test(blob)) return 'micro'
  if (/h[íi]brid|hybrid/.test(blob) || baterias.length > 0) return 'hibrido'
  if (/off.?grid/.test(blob)) return 'off-grid'
  if (/otimiz|optimi/.test(blob)) return 'otimizador'
  if (inv.modelo || inv.marca) return 'string'
  return null
}

/**
 * Retorna os arranjos do projeto SEMPRE como array normalizado.
 * - Se `projeto.arranjos` existe e não está vazio → devolve-o (com potências recalculadas).
 * - Senão, deriva UM arranjo 'principal' a partir do `equipamentos` legado.
 * Nunca muta o documento; retorna objetos planos.
 *
 * @param {object} projeto  Documento ProjetoFV (lean ou hidratado)
 * @returns {Array<object>}
 */
export function normalizarArranjos(projeto) {
  if (!projeto) return []

  if (Array.isArray(projeto.arranjos) && projeto.arranjos.length > 0) {
    return projeto.arranjos.map((a, idx) => enriquecerArranjo(a, idx))
  }

  // Derivação do arranjo único legado (equipamentos.paineis + equipamentos.inversor)
  const eq = projeto.equipamentos || {}
  const paineis = eq.paineis || []
  const inversores = eq.inversor && (eq.inversor.marca || eq.inversor.modelo)
    ? [{ ...eq.inversor, quantidade: eq.inversor.quantidade || 1 }]
    : []

  // BESS legado de nível de projeto → arranjo derivado vê baterias se presentes
  const baterias = projeto.bess?.presente
    ? [{ marca: projeto.bess.marca, capacidade_kwh: projeto.bess.capacidade_kwh, quantidade: 1 }]
    : []

  if (paineis.length === 0 && inversores.length === 0 && baterias.length === 0) return []

  return [enriquecerArranjo({
    id: novoId(),
    rotulo: 'Arranjo principal',
    tipo: 'principal',
    origem: 'original',
    somente_leitura: false,
    paineis,
    inversores,
    baterias,
  }, 0)]
}

/** Normaliza+enriquece um único arranjo (potências, contagens, topologia). Não muta. */
function enriquecerArranjo(a, idx = 0) {
  const paineis = a.paineis || []
  const inversores = a.inversores || []
  const baterias = a.baterias || []
  const n_modulos = contarModulos(paineis)
  const n_inversores = contarInversores(inversores)
  const potencia_kwp = a.potencia_kwp ?? potenciaPaineisKwp(paineis)
  const enriquecido = {
    ...a,
    id: a.id || novoId(),
    rotulo: a.rotulo || `Arranjo ${String.fromCharCode(65 + idx)}`,
    tipo: a.tipo || 'principal',
    origem: a.origem || (a.tipo === 'ampliacao' ? 'ampliacao' : 'original'),
    somente_leitura: !!a.somente_leitura,
    paineis,
    inversores,
    baterias,
    potencia_kwp,
    potencia_inversor_kw: a.potencia_inversor_kw ?? potenciaInversoresKw(inversores),
    capacidade_bateria_kwh: capacidadeBateriasKwh(baterias),
    dimensionamento: {
      potencia_kwp,
      geracao_mensal_kwh: a.dimensionamento?.geracao_mensal_kwh ?? null,
      n_modulos,
      n_inversores,
    },
  }
  enriquecido.topologia = detectarTopologia(enriquecido)
  return enriquecido
}

/**
 * FASE 4 — Totais do projeto somando TODOS os arranjos.
 * @returns {{ n_arranjos, n_modulos_total, n_inversores_total, potencia_total_kwp,
 *             potencia_inversor_total_kw, capacidade_bateria_total_kwh, geracao_mensal_total_kwh }}
 */
export function calcularTotaisProjeto(projeto) {
  const arranjos = normalizarArranjos(projeto)
  const t = {
    n_arranjos: arranjos.length,
    n_modulos_total: 0,
    n_inversores_total: 0,
    potencia_total_kwp: 0,
    potencia_inversor_total_kw: 0,
    capacidade_bateria_total_kwh: 0,
    geracao_mensal_total_kwh: 0,
  }
  // F12: a CONTAGEM continua somando (F-01 intacta) — um arranjo sem módulos
  // contribui zero módulos, o que é verdade. A POTÊNCIA não: um arranjo cuja
  // potência é desconhecida não contribui zero kWp, contribui incógnita. Somar
  // `null` como 0 era o que transformava lacuna em total plausível.
  let potenciaIncompleta = false
  let potenciaInversorIncompleta = false
  for (const a of arranjos) {
    t.n_modulos_total            += a.dimensionamento?.n_modulos || 0
    t.n_inversores_total         += a.dimensionamento?.n_inversores || 0
    t.capacidade_bateria_total_kwh += Number(a.capacidade_bateria_kwh) || 0
    t.geracao_mensal_total_kwh   += Number(a.dimensionamento?.geracao_mensal_kwh) || 0

    // Um arranjo SEM painéis não torna o total incompleto — ele simplesmente não
    // tem potência CC a somar (é o caso do arranjo de ampliação ainda vazio).
    // O que contamina é ter painéis e não saber a potência deles.
    // `_decl` e não `Number()`: `Number(null)` é 0 e `Number.isFinite(0)` é
    // true — usar `Number` aqui reintroduziria o defeito que este sprint remove.
    const temPaineis = (a.paineis?.length ?? 0) > 0
    const pcc = _decl(a.potencia_kwp)
    if (pcc !== null) t.potencia_total_kwp += pcc
    else if (temPaineis) potenciaIncompleta = true

    const temInversores = (a.inversores?.length ?? 0) > 0
    const pca = _decl(a.potencia_inversor_kw)
    if (pca !== null) t.potencia_inversor_total_kw += pca
    else if (temInversores) potenciaInversorIncompleta = true
  }
  // arredonda os flutuantes
  t.potencia_total_kwp = potenciaIncompleta
    ? null : Number(t.potencia_total_kwp.toFixed(3))
  t.potencia_inversor_total_kw = potenciaInversorIncompleta
    ? null : Number(t.potencia_inversor_total_kw.toFixed(3))
  t.capacidade_bateria_total_kwh = Number(t.capacidade_bateria_total_kwh.toFixed(3))
  t.geracao_mensal_total_kwh = Number(t.geracao_mensal_total_kwh.toFixed(1))
  return t
}

/**
 * Soma a potência DC (kWp) de todos os arranjos.
 *
 * F12: delega a `calcularTotaisProjeto` em vez de repetir a soma. Eram DUAS
 * implementações da mesma agregação, e a daqui tinha o mesmo `|| 0` — corrigir
 * só uma deixaria a outra mentindo. Uma fonte, uma regra.
 *
 * @returns {number|null} `null` quando algum arranjo com painéis não declara potência.
 */
export function potenciaTotalKwp(projeto) {
  return calcularTotaisProjeto(projeto).potencia_total_kwp
}

/**
 * Constrói os arranjos para um projeto de AMPLIAÇÃO:
 * congela os arranjos do projeto original como 'existente'/somente-leitura e
 * adiciona um novo arranjo 'ampliacao' vazio (editável).
 *
 * @param {object} projetoOrigem
 * @returns {Array<object>}
 */
export function montarArranjosAmpliacao(projetoOrigem) {
  const existentes = normalizarArranjos(projetoOrigem).map((a, idx) => ({
    ...a,
    id: novoId('exist'),
    rotulo: a.rotulo && /exist/i.test(a.rotulo) ? a.rotulo : `Existente ${idx + 1}`,
    tipo: 'existente',
    somente_leitura: true,
  }))

  const ampliacao = {
    id: novoId('ampl'),
    rotulo: 'Ampliação',
    tipo: 'ampliacao',
    origem: 'ampliacao',
    somente_leitura: false,
    paineis: [],
    inversores: [],
    baterias: [],
    potencia_kwp: null,
    potencia_inversor_kw: null,
  }

  return [...existentes, ampliacao]
}

/**
 * Composição do projeto — FV-UX-038 (D1).
 *
 * ── A ambiguidade que isto encerra ──────────────────────────────────────────
 * A auditoria FV-UX-037 mediu duas formas para o mesmo conceito:
 *
 *   `equipamentos.inversor`      objeto ÚNICO, sem `quantidade` persistida
 *   `arranjos[].inversores[]`    lista, COM quantidade
 *
 * Consumidores que liam o primeiro descreviam a venda errado: a proposta e a
 * listagem mostravam "HMS-2000-4T" onde havia OITO unidades, e nenhum sinal de
 * que existia mais de um modelo.
 *
 * A decisão da sprint: `arranjos[].inversores[]` é a fonte canônica, e ninguém
 * cria uma segunda quantidade em `equipamentos.inversor`. Esta função é o
 * ADAPTADOR ÚNICO por onde os consumidores passam a ler — construída sobre
 * `normalizarArranjos`, que já resolve o projeto legado derivando o arranjo a
 * partir de `equipamentos`. Por isso a compatibilidade é preservada sem
 * segunda fonte: quem só tem a forma antiga continua sendo lido, pelo mesmo
 * caminho.
 *
 * NÃO deriva grandeza de engenharia: soma quantidade e potência declaradas,
 * nada mais. Potência de string, corrente e tensão continuam com o motor
 * elétrico.
 *
 * @param {object} projeto  Documento ProjetoFV (lean ou hidratado)
 * @returns {{
 *   modulos: Array<{marca,modelo,potencia_w,quantidade,equipamento_id}>,
 *   inversores: Array<{marca,modelo,potencia_kw,tipo,fases,quantidade,equipamento_id}>,
 *   total_modulos: number, total_inversores: number,
 *   topologia: string|null, multi_modelo_modulo: boolean, multi_modelo_inversor: boolean
 * }}
 */
export function composicaoDoProjeto(projeto) {
  const arranjos = normalizarArranjos(projeto)

  /** Agrupa por modelo somando quantidades — o mesmo modelo em dois arranjos é um item só. */
  const agrupar = (itens, chaveExtra) => {
    const mapa = new Map()
    for (const it of itens) {
      const chave = `${it?.marca ?? it?.fabricante ?? ''}|${it?.modelo ?? ''}`
      if (chave === '|') continue
      const atual = mapa.get(chave)
      const qtd = Number(it?.quantidade) || (chaveExtra === 'inversor' ? 1 : 0)
      if (atual) { atual.quantidade += qtd; continue }
      mapa.set(chave, {
        marca: it?.marca ?? it?.fabricante ?? null,
        modelo: it?.modelo ?? null,
        quantidade: qtd,
        equipamento_id: it?.equipamento_id ?? null,
        ...(chaveExtra === 'inversor'
          ? { potencia_kw: it?.potencia_kw ?? it?.potenciaKW ?? null,
            tipo: it?.tipo ?? null, fases: it?.fases ?? null }
          : { potencia_w: it?.potencia_w ?? it?.pmpp ?? null }),
      })
    }
    return [...mapa.values()]
  }

  const modulos = agrupar(arranjos.flatMap((a) => a.paineis ?? []), 'modulo')
  const inversores = agrupar(arranjos.flatMap((a) => a.inversores ?? []), 'inversor')

  // Topologia MICRO tem contagem própria em `configuracao_eletrica.micros[]`
  // (FV-DOM-031). Quando ela existe, é ela que manda sobre a quantidade.
  const micros = arranjos.flatMap((a) => a?.configuracao_eletrica?.micros ?? [])
  if (micros.length > 0) {
    for (const inv of inversores) {
      const m = micros.find((x) => x.modelo === inv.modelo)
      if (m && Number.isFinite(Number(m.quantidade))) inv.quantidade = Number(m.quantidade)
    }
  }

  const topologia = arranjos.find((a) => a.topologia)?.topologia ?? null
  return {
    modulos,
    inversores,
    total_modulos: modulos.reduce((a, m) => a + (Number(m.quantidade) || 0), 0),
    total_inversores: inversores.reduce((a, i) => a + (Number(i.quantidade) || 0), 0),
    topologia,
    multi_modelo_modulo: modulos.length > 1,
    multi_modelo_inversor: inversores.length > 1,
  }
}
