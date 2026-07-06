/**
 * adapters/ev.js — Adapter de DOMÍNIO EV → componentes elétricos genéricos.
 *
 * Vive no pacote NEUTRO (não no frontend) para ser a ÚNICA ponte EV→Engine usada
 * tanto pelo frontend (preview/React Flow) quanto pelo backend (PDF). Não há JSX
 * nem dependência de framework — apenas o DiagramEngine.
 *
 * Regras de fidelidade:
 *  - nº de polos do disjuntor/DR vem de numero_fases (mono=2, tri=4);
 *  - nº de DPS vem do BOM (2 monopolares OU 1 bipolar — exatamente o que existe);
 *  - condutores/cores do cabo seguem o padrão Forte Solar (mono 3 / tri 5);
 *  - corrente do disjuntor, bitola e potência são dinâmicas (cálculo/catálogo).
 */

import { build, renderSVG, toReactFlow, componente, conexao, TIPOS, PAPEL_CONEXAO } from '../index.js'

// BUG-011: condutores desenhados = os que REALMENTE existem no circuito do carregador.
//  mono (1): Fase + Neutro + Terra                 → 3
//  bi   (2): Fase L1 + Fase L2 + Neutro + Terra     → 4
//  tri  (3): L1 + L2 + L3 + Neutro + Terra          → 5
// NUNCA desenhar 5 num circuito monofásico.
function condutoresPorFases(nf) {
  if (nf >= 3) return [{ papel: 'fase_l1' }, { papel: 'fase_l2' }, { papel: 'fase_l3' }, { papel: 'neutro' }, { papel: 'terra' }]
  if (nf === 2) return [{ papel: 'fase_l1' }, { papel: 'fase_l2' }, { papel: 'neutro' }, { papel: 'terra' }]
  return [{ papel: 'fase' }, { papel: 'neutro' }, { papel: 'terra' }]
}

// BUG-011: o nº de fases do CIRCUITO vem do CARREGADOR — NUNCA de projeto.fases
// (que é a alimentação do imóvel). Prioridade: numero_fases explícito → tipo
// (AC_Mono/AC_Tri) → hint recebido → 1. Isto impede um projeto mono virar 5 condutores.
function fasesDoCarregador(carregador = {}, hint = 1) {
  const n = Number(carregador.numero_fases)
  if (Number.isFinite(n) && n >= 1) return Math.min(Math.trunc(n), 3)
  const t = String(carregador.tipo || '').toLowerCase()
  if (/tri|trif/.test(t)) return 3
  if (/\bbi|bif/.test(t)) return 2
  if (/mono|monof/.test(t)) return 1
  const h = Number(hint)
  return Number.isFinite(h) && h >= 1 ? Math.min(Math.trunc(h), 3) : 1
}

// ── BUG-016: TEMPLATES ELÉTRICOS FIXOS DO EV ─────────────────────────────────
// Três topologias determinísticas. A escolha depende SOMENTE de (alimentação do
// imóvel + tipo do carregador). Depois de escolhido, o roteamento NÃO é calculado —
// o template é apenas INSTANCIADO: percursos e posições FIXOS. Só variam specs
// (bitola, corrente, potência, polos, comprimento) e a quantidade de DPS.
export const TEMPLATES_EV = Object.freeze({ MONO_MONO: 'EV_MONO_MONO', TRI_MONO: 'EV_TRI_MONO', TRI_TRI: 'EV_TRI_TRI' })

/** Escolha determinística: (alimentação, carregador) → template. Sem heurística. */
export function escolherTemplateEV(fasesAlimentacao, fasesCarregador) {
  const alimTri = Number(fasesAlimentacao) >= 3
  const cargTri = Number(fasesCarregador) >= 3
  if (cargTri) return TEMPLATES_EV.TRI_TRI            // carregador trifásico exige alimentação trifásica
  return alimTri ? TEMPLATES_EV.TRI_MONO : TEMPLATES_EV.MONO_MONO
}

// Posições FIXAS (canto superior-esquerdo, coords A4/DIAGRAM_BOX). NUNCA calculadas.
// Ajuste homologado: sem Disjuntor Geral nem Barramento Neutro — Medidor, Disjuntor,
// IDR, DPS(s) e Carregador ficam todos na MESMA fileira (y=244). O Aterramento fica
// numa fileira abaixo (y=352), só embaixo dos DPS, e o Terra passa a correr em
// paralelo com Fase/Neutro somente a partir dali até o Carregador.
const POS_MONO = Object.freeze({
  medidor: { x: 48, y: 244 }, disj: { x: 229, y: 244 }, dr: { x: 411, y: 244 }, carr: { x: 955, y: 244 },
  barr_terra: { x: 623, y: 352 },
})
const POS_DPS_MONO = [{ x: 592, y: 244 }, { x: 774, y: 244 }]
const POS_TRI = Object.freeze({
  medidor: { x: 48, y: 244 }, disj: { x: 178, y: 244 }, dr: { x: 307, y: 244 }, carr: { x: 955, y: 244 },
  barr_terra: { x: 572, y: 352 },
})
const POS_DPS_TRI = [{ x: 437, y: 244 }, { x: 567, y: 244 }, { x: 696, y: 244 }, { x: 826, y: 244 }]

const bit = (papel, bitola) => ({ papel, bitola_mm2: bitola })

/**
 * Instancia (não calcula) o template elétrico fixo. Retorna components/connections
 * com PERCURSOS FIXOS + posicoes FIXAS. Regras BUG-016 garantidas por construção:
 *  - Terra nunca passa pelo disjuntor/IDR (percurso próprio Medidor→Barr.Terra→Wallbox).
 *  - DPS deriva da entrada superior do IDR e descarrega no Barramento Terra (nunca em série).
 *  - Neutro passa por Barramento Neutro (nunca direto ao carregador).
 */
function construirTemplateEV(template, { disjA, bitola, comprimento, tensao, dpsV, drMa, carregador, nDPS }) {
  const rotuloCarr = `${carregador.marca || ''} ${carregador.modelo || ''}`.trim() || 'Carregador EV'
  const especCarr = { potencia_kw: carregador.potencia_kw, corrente_a: disjA, conector: carregador.tipo_conector }
  const edgeCabo = { bitola_mm2: bitola, comprimento_m: comprimento, observacoes: '' }

  if (template === TEMPLATES_EV.TRI_TRI) {
    const cond4 = [bit('fase_l1', bitola), bit('fase_l2', bitola), bit('fase_l3', bitola), bit('neutro', bitola)]
    const components = [
      componente({ id: 'medidor', tipo: TIPOS.REDE, label: 'Medidor', specs: { tensao_v: tensao }, ordem: 0 }),
      componente({ id: 'disj', tipo: TIPOS.DISJUNTOR, polos: 4, specs: { corrente_a: disjA, curva: 'C' }, ordem: 1 }),
      componente({ id: 'dr', tipo: TIPOS.DR, polos: 4, specs: { ma: drMa, classe: 'A' }, ordem: 2 }),
      componente({ id: 'carr', tipo: TIPOS.EQUIPAMENTO, subtipo: 'carregador_ev', label: rotuloCarr, specs: especCarr, ordem: 3 }),
      // Ponto de terra desenhado como ATERRAMENTO (não como barra de barramento).
      componente({ id: 'barr_terra', tipo: TIPOS.BARRAMENTO, subtipo: 'aterramento', label: 'Aterramento', ordem: 4 }),
    ]
    const connections = [
      conexao({ id: 'c-med-disj', from: 'medidor', to: 'disj', condutores: cond4 }),
      conexao({ id: 'c-disj-dr', from: 'disj', to: 'dr', condutores: cond4 }),
      conexao({ id: 'c-dr-carr', from: 'dr', to: 'carr', condutores: cond4, specs: edgeCabo }),
      // Ajuste homologado: Terra NÃO parte do Medidor — só existe a partir do
      // símbolo de Aterramento (que recebe a descarga dos DPS), seguindo em
      // paralelo com os demais condutores até o Carregador.
      conexao({ id: 'c-terra-barr-carr', from: 'barr_terra', to: 'carr', condutores: [bit('terra', bitola)] }),
    ]
    const posicoes = { medidor: POS_TRI.medidor, disj: POS_TRI.disj, dr: POS_TRI.dr, carr: POS_TRI.carr, barr_terra: POS_TRI.barr_terra }
    const papeisDPS = ['fase_l1', 'fase_l2', 'fase_l3', 'neutro']
    const nd = Math.min(Math.max(nDPS, 1), 4)
    for (let i = 0; i < nd; i++) {
      components.push(componente({ id: `dps${i}`, tipo: TIPOS.DPS, polos: 1, specs: { tensao_v: dpsV, condutor: papeisDPS[i] } }))
      // ocultarLinha: o DPS já traz sua própria seta de origem (symbols.js); a linha reta
      // centro-a-centro coincidiria com o tronco (DPS está na mesma fileira do IDR/Carregador).
      connections.push(conexao({ id: `c-idr-dps${i}`, from: 'dr', to: `dps${i}`, papel: PAPEL_CONEXAO.DERIVACAO, condutores: [{ papel: papeisDPS[i] }], specs: { ocultarLinha: true } }))
      connections.push(conexao({ id: `c-dps${i}-terra`, from: `dps${i}`, to: 'barr_terra', papel: PAPEL_CONEXAO.DERIVACAO, condutores: [{ papel: 'terra' }] }))
      posicoes[`dps${i}`] = POS_DPS_TRI[i]
    }
    return { components, connections, posicoes }
  }

  // EV_MONO_MONO e EV_TRI_MONO — MESMO desenho (spec: "Todo o restante permanece igual").
  // Ajuste homologado: sem Disjuntor Geral, sem Barramento Neutro — Fase e Neutro
  // entram juntos direto no Disjuntor Bipolar (nascem paralelos desde o Medidor).
  const condFN = [bit('fase', bitola), bit('neutro', bitola)]
  const components = [
    componente({ id: 'medidor', tipo: TIPOS.REDE, label: 'Medidor', specs: { tensao_v: tensao }, ordem: 0 }),
    componente({ id: 'disj', tipo: TIPOS.DISJUNTOR, polos: 2, specs: { corrente_a: disjA, curva: 'C' }, ordem: 1 }),
    componente({ id: 'dr', tipo: TIPOS.DR, polos: 2, specs: { ma: drMa, classe: 'A' }, ordem: 2 }),
    componente({ id: 'carr', tipo: TIPOS.EQUIPAMENTO, subtipo: 'carregador_ev', label: rotuloCarr, specs: especCarr, ordem: 3 }),
    // Sem barra de barramento. Terra = aterramento normativo.
    componente({ id: 'barr_terra', tipo: TIPOS.BARRAMENTO, subtipo: 'aterramento', label: 'Aterramento', ordem: 4 }),
  ]
  const connections = [
    // FASE+NEUTRO juntos: Medidor → Disjuntor Bipolar → IDR → Wallbox
    conexao({ id: 'c-med-disj', from: 'medidor', to: 'disj', condutores: condFN }),
    conexao({ id: 'c-disj-dr', from: 'disj', to: 'dr', condutores: condFN }),
    conexao({ id: 'c-dr-carr', from: 'dr', to: 'carr', condutores: condFN, specs: edgeCabo }),
    // TERRA: só existe a partir do Aterramento (recebe a descarga dos DPS) → Wallbox
    conexao({ id: 'c-terra-barr-carr', from: 'barr_terra', to: 'carr', condutores: [bit('terra', bitola)] }),
  ]
  const posicoes = {
    medidor: POS_MONO.medidor, disj: POS_MONO.disj, dr: POS_MONO.dr, carr: POS_MONO.carr, barr_terra: POS_MONO.barr_terra,
  }
  const papeisDPS = ['fase', 'neutro']
  const nd = Math.min(Math.max(nDPS, 1), 2)
  for (let i = 0; i < nd; i++) {
    components.push(componente({ id: `dps${i}`, tipo: TIPOS.DPS, polos: 1, specs: { tensao_v: dpsV, condutor: papeisDPS[i] } }))
    // DPS deriva do IDR → DPS → Aterramento (nunca em série)
    connections.push(conexao({ id: `c-idr-dps${i}`, from: 'dr', to: `dps${i}`, papel: PAPEL_CONEXAO.DERIVACAO, condutores: [{ papel: papeisDPS[i] }] }))
    connections.push(conexao({ id: `c-dps${i}-terra`, from: `dps${i}`, to: 'barr_terra', papel: PAPEL_CONEXAO.DERIVACAO, condutores: [{ papel: 'terra' }] }))
    posicoes[`dps${i}`] = POS_DPS_MONO[i]
  }
  return { components, connections, posicoes }
}

/** {id:{x,y}} → overrides {id:{position:{x,y}}} (posições fixas do template). */
function posicoesParaOverrides(posicoes = {}) {
  const ov = {}
  for (const [id, p] of Object.entries(posicoes)) ov[id] = { position: { x: p.x, y: p.y } }
  return ov
}

function contarDPS(bom = []) {
  const linha = bom.find(b => /DPS/i.test(b.item || b.descricao || ''))
  const q = Number(linha?.quantidade)
  return Number.isFinite(q) && q > 0 ? q : 2 // NBR 5410 6.3.5.2: mínimo 2
}

function bitolaDoBOM(bom = [], fallback) {
  const cabo = bom.find(b => /^Cabo /i.test(b.item || b.descricao || ''))
  const m = (cabo?.especificacao || '').match(/(\d+(?:[.,]\d+)?)\s*mm/i)
  return m ? Number(m[1].replace(',', '.')) : fallback
}

/**
 * RT-05 CBM/RN NÃO é aplicada apenas por estar em Natal/RN. Exige Estado = RN E um
 * fator de risco (subsolo, instalação coletiva/condomínio, ambiente fechado).
 * @returns {{ normas: string[], normas_motivo: { norma, motivo }[] }}
 */
export function avaliarNormas({ endereco = '', estado = '', tipo_instalacao = '', ambiente = '', subsolo = false } = {}) {
  const normas_motivo = [
    { norma: 'NBR 5410',  motivo: 'Instalação elétrica de baixa tensão' },
    { norma: 'NBR 17019', motivo: 'Recarga de veículos elétricos (estação de recarga)' },
    { norma: 'IEC 61851', motivo: 'Sistema de carregamento condutivo de VE' },
    { norma: 'IEC 62196', motivo: 'Plugues/tomadas/conectores de recarga' },
  ]
  const estadoRN = /\bRN\b/i.test(estado) || /\bRN\b|Rio Grande do Norte/i.test(endereco)
  const texto = `${tipo_instalacao} ${ambiente}`.toLowerCase()
  const fatorColetivo = /condom|coletiv|edif|pr[eé]dio|garagem|estacionamento/i.test(texto)
  const fatorFechado = /fechado|subsolo|t[eé]rreo fechado/i.test(texto)
  const fatorRisco = subsolo === true || fatorColetivo || fatorFechado
  if (estadoRN && fatorRisco) {
    const fatores = [
      subsolo === true ? 'subsolo' : null,
      fatorColetivo ? 'instalação coletiva/condomínio' : null,
      fatorFechado ? 'ambiente fechado' : null,
    ].filter(Boolean)
    normas_motivo.push({ norma: 'RT-05 CBM/RN', motivo: `Estado RN + ${fatores.join(', ')}` })
  }
  return { normas: normas_motivo.map(n => n.norma), normas_motivo }
}

/** (calculos + bom + carregador + projeto) → { components, connections, metadata } */
export function adaptarProjetoEV({ calculos = {}, bom = [], numero_fases = 1, carregador = {}, projeto = {} }) {
  const nf = fasesDoCarregador(carregador, numero_fases)
  const ehTri = nf >= 3
  const disjA = calculos.disjuntor_a ?? carregador.corrente_entrada_a ?? 0
  const bitola = bitolaDoBOM(bom, calculos.bitola_cabo_mm2)
  const comprimento = calculos.comprimento_cabo_m ?? projeto.comprimento_cabo_m
  const tensao = carregador.tensao_entrada_v ?? (ehTri ? 380 : 220)

  // BUG-016: escolha DETERMINÍSTICA do template (alimentação do imóvel + carregador)
  // e INSTANCIAÇÃO do roteamento fixo. Nada de roteamento é calculado depois disto.
  const template = escolherTemplateEV(projeto.fases, nf)
  const { components, connections, posicoes } = construirTemplateEV(template, {
    disjA, bitola, comprimento, tensao,
    dpsV: calculos.dps_kv ?? 275, drMa: calculos.dr_ma ?? 30,
    carregador, nDPS: contarDPS(bom),
  })

  const { normas, normas_motivo } = avaliarNormas({
    endereco: projeto.endereco, estado: projeto.estado,
    tipo_instalacao: projeto.tipo_instalacao, ambiente: projeto.ambiente, subsolo: projeto.subsolo,
  })

  const metadata = {
    dominio: 'EV', modelo: 'EV_EXECUTIVO_V2', template,   // BUG-016: template fixo instanciado
    projeto: projeto.nome, cliente: projeto.cliente_nome, cpf: projeto.cpf,
    endereco: projeto.endereco, uc: projeto.uc, concessionaria: projeto.concessionaria,
    carga_instalada: projeto.carga_instalada, cidade: projeto.cidade,
    data: projeto.data || new Date().toLocaleDateString('pt-BR'),
    rt: { nome: projeto.tecnico_nome, registro: projeto.tecnico_crea || projeto.tecnico_cft },
    normas_motivo,
    equipamento: {
      modelo: carregador.modelo, fabricante: carregador.marca,
      potencia: carregador.potencia_kw ? `${carregador.potencia_kw} kW` : '',
      corrente: disjA ? `${disjA} A` : '', tensao: tensao ? `${tensao} V` : '',
      conector: carregador.tipo_conector ? `Tipo ${carregador.tipo_conector}` : '',
    },
    bom, normas,
  }

  return { components, connections, metadata, posicoes }
}

export function construirCanonicalEV(args, { viewport = null, overrides = {} } = {}) {
  const { components, connections, metadata, posicoes } = adaptarProjetoEV(args)
  // BUG-016: posições FIXAS do template são a base; overrides manuais (editor) vencem por id.
  const base = posicoesParaOverrides(posicoes)
  return build({ components, connections, metadata, viewport, overrides: { ...base, ...overrides } })
}

export function renderarSVGEV(args, opts) {
  return renderSVG(construirCanonicalEV(args), opts)
}

/**
 * Mapeia um documento ProjetoEV (frontend ou backend/Mongo) para os args do adapter.
 * Única fonte do mapeamento projeto→Engine, compartilhada por preview e PDF.
 */
export function argsDeProjetoEV(projeto = {}) {
  const calculos = projeto.calculos_nbr || {}
  const carregador = (projeto.carregadores && projeto.carregadores[0]) || {}
  const clienteObj = projeto.clienteId && typeof projeto.clienteId === 'object' ? projeto.clienteId : null
  const clienteNome = clienteObj?.nome
    || (typeof projeto.clienteId === 'string' ? projeto.clienteId : '')
    || projeto.cliente_nome || ''
  // Materiais: fonte primária é calculos_nbr.materiais (BOM da engenharia). Quando o
  // projeto foi salvo sem esse campo populado, cai para projeto.bom e, por último,
  // para projeto.orcamento.materiais (mesma lista usada na Proposta Comercial, só
  // que ali já vem com preço — aqui os preços são ignorados pelo desenho, que só
  // lê descrição/quantidade/unidade).
  const bom = (calculos.materiais?.length && calculos.materiais)
    || (projeto.bom?.length && projeto.bom)
    || projeto.orcamento?.materiais
    || []

  return {
    calculos: { ...calculos, comprimento_cabo_m: projeto.comprimento_cabo_m },
    bom,
    // BUG-011: fases do CIRCUITO vêm do carregador (o adapter também deriva de carregador.tipo).
    // NÃO usar projeto.fases (alimentação do imóvel) — fazia projeto mono virar 5 condutores.
    numero_fases: Number(carregador.numero_fases) || 1,
    carregador,
    projeto: {
      nome: projeto.nome,
      cliente_nome: clienteNome,
      // BUG-016: alimentação do imóvel (mono/tri) — decide EV_MONO_MONO vs EV_TRI_MONO.
      fases: projeto.fases,
      endereco: projeto.endereco_completo || projeto.endereco,
      // Nomes REAIS do modelo Cliente (backend/src/models/Cliente.js) — cpf/uc/
      // concessionaria usavam campos que não existem no schema (ficavam sempre em branco).
      cpf: clienteObj?.cpf_cnpj,
      uc: clienteObj?.numero_cliente,
      concessionaria: clienteObj?.distribuidora,
      carga_instalada: clienteObj?.carga_instalada_w,
      cidade: projeto.cidade,
      comprimento_cabo_m: projeto.comprimento_cabo_m,
      tecnico_nome: projeto.tecnico?.nome,
      tecnico_crea: projeto.tecnico?.crea,
      tecnico_cft: projeto.tecnico?.cft,
      estado: projeto.estado,
      tipo_instalacao: projeto.tipo_instalacao,
      ambiente: projeto.ambiente,
      subsolo: projeto.subsolo,
    },
  }
}

/**
 * Projeto persistido → JSON canônico, aplicando overrides/viewport salvos.
 * Usado pelo backend (PDF) para renderizar EXATAMENTE o mesmo diagrama do editor.
 */
export function construirCanonicalDeProjetoEV(projeto = {}) {
  const { components, connections, metadata, posicoes } = adaptarProjetoEV(argsDeProjetoEV(projeto))
  const persistido = projeto.diagrama_editado || {}
  // BUG-016: base = posições fixas do template; overrides salvos (edição manual) vencem por id.
  const base = posicoesParaOverrides(posicoes)
  return build({
    components,
    connections,
    metadata,
    viewport: persistido.viewport || null,
    overrides: { ...base, ...(persistido.overrides || {}) },
  })
}

export { toReactFlow }
