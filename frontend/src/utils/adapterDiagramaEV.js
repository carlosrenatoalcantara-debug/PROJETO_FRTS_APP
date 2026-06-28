/**
 * adapterDiagramaEV.js — Adapter de DOMÍNIO (EV → componentes elétricos genéricos).
 *
 * Esta é a ÚNICA peça que conhece EV. Converte (calculos NBR + BOM + carregador +
 * projeto) na entrada genérica do DiagramEngine: { components, connections, metadata }.
 * O Engine (packages/diagram-engine) não conhece EV.
 *
 * Regras de fidelidade (Critério 1 da F2):
 *  - nº de polos do disjuntor/DR vem de numero_fases (mono=2, tri=4);
 *  - nº de DPS vem do BOM (2 monopolares OU 1 bipolar — exatamente o que existe);
 *  - condutores/cores do cabo seguem o padrão Forte Solar (mono 3 / tri 5);
 *  - corrente do disjuntor, bitola e potência são dinâmicas (cálculo/catálogo).
 */

import { build, renderSVG, toReactFlow, componente, conexao, TIPOS, PAPEL_CONEXAO } from '@diagram-engine'

const CONDUTORES_MONO = [
  { papel: 'fase' }, { papel: 'neutro' }, { papel: 'terra' },
]
const CONDUTORES_TRI = [
  { papel: 'fase_l1' }, { papel: 'fase_l2' }, { papel: 'fase_l3' }, { papel: 'neutro' }, { papel: 'terra' },
]

// Conta DPS reais a partir do BOM (item "DPS ...").
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
 * Avalia as normas aplicáveis e REGISTRA o motivo de cada aplicação (Requisito 5).
 *
 * RT-05 CBM/RN NÃO é aplicada apenas por estar em Natal/RN. Exige Estado = RN E um
 * fator de risco do Corpo de Bombeiros: subsolo, instalação coletiva/condomínio ou
 * ambiente fechado/garagem. Sem esses fatores, RT-05 não entra.
 *
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

/**
 * @param {object} args
 * @param {object} args.calculos    saída de calcularParametrosNBR5410
 * @param {Array}  args.bom         lista de materiais (item/especificacao/quantidade/unidade)
 * @param {number} args.numero_fases
 * @param {object} args.carregador  { marca, modelo, potencia_kw, tensao_entrada_v, corrente_entrada_a, tipo_conector }
 * @param {object} args.projeto     { nome, cliente_nome, endereco, cpf, uc, concessionaria, carga_instalada, tecnico_* , cidade, data }
 * @returns {{components, connections, metadata}}
 */
export function adaptarProjetoEV({ calculos = {}, bom = [], numero_fases = 1, carregador = {}, projeto = {} }) {
  const ehTri = Number(numero_fases) >= 3
  const polosLinha = ehTri ? 4 : 2
  const disjA = calculos.disjuntor_a ?? carregador.corrente_entrada_a ?? 0
  const bitola = bitolaDoBOM(bom, calculos.bitola_cabo_mm2)
  const condutores = ehTri ? CONDUTORES_TRI : CONDUTORES_MONO
  const condutoresBitola = condutores.map(c => ({ ...c, bitola_mm2: bitola }))
  const tensao = carregador.tensao_entrada_v ?? (ehTri ? 380 : 220)

  // ── Componentes (cadeia série principal) ────────────────────────────────
  const components = [
    componente({ id: 'rede', tipo: TIPOS.REDE, label: 'QD Existente', specs: { tensao_v: tensao }, ordem: 0 }),
    componente({ id: 'disj', tipo: TIPOS.DISJUNTOR, polos: polosLinha, specs: { corrente_a: disjA, curva: 'C' }, ordem: 1 }),
    componente({ id: 'dr', tipo: TIPOS.DR, polos: polosLinha, specs: { ma: calculos.dr_ma ?? 30, classe: 'A' }, ordem: 2 }),
    componente({ id: 'cabo', tipo: TIPOS.CABO, specs: { bitola_mm2: bitola, comprimento_m: calculos.comprimento_cabo_m ?? projeto.comprimento_cabo_m }, ordem: 3 }),
    componente({ id: 'carr', tipo: TIPOS.EQUIPAMENTO, subtipo: 'carregador_ev', label: `${carregador.marca || ''} ${carregador.modelo || ''}`.trim() || 'Carregador EV', specs: { potencia_kw: carregador.potencia_kw, corrente_a: disjA, conector: carregador.tipo_conector }, ordem: 4 }),
    componente({ id: 'veic', tipo: TIPOS.CARGA, label: 'Veículo Elétrico', specs: { conector: carregador.tipo_conector }, ordem: 5 }),
  ]

  // ── DPS reais (derivação a partir do disjuntor) ─────────────────────────
  const nDPS = contarDPS(bom)
  const polosDPS = nDPS >= 2 ? 1 : 2 // 2 unidades monopolares OU 1 bipolar
  for (let i = 0; i < nDPS; i++) {
    components.push(componente({ id: `dps${i}`, tipo: TIPOS.DPS, polos: polosDPS, specs: { tensao_v: calculos.dps_kv ?? 275 } }))
  }

  // ── Conexões (fluxo elétrico) ───────────────────────────────────────────
  const connections = [
    conexao({ id: 'c-rede-disj', from: 'rede', to: 'disj', condutores: condutoresBitola }),
    conexao({ id: 'c-disj-dr', from: 'disj', to: 'dr', condutores: condutoresBitola }),
    conexao({ id: 'c-dr-cabo', from: 'dr', to: 'cabo', condutores: condutoresBitola }),
    conexao({ id: 'c-cabo-carr', from: 'cabo', to: 'carr', condutores: condutoresBitola }),
    conexao({ id: 'c-carr-veic', from: 'carr', to: 'veic', condutores: [{ papel: 'fase' }] }),
  ]
  for (let i = 0; i < nDPS; i++) {
    connections.push(conexao({ id: `c-dps${i}`, from: 'disj', to: `dps${i}`, papel: PAPEL_CONEXAO.DERIVACAO, condutores: [{ papel: 'terra' }] }))
  }

  // ── Normas aplicáveis + MOTIVO (Requisito 5 / F3) ───────────────────────
  const { normas, normas_motivo } = avaliarNormas({
    endereco: projeto.endereco,
    estado: projeto.estado,
    tipo_instalacao: projeto.tipo_instalacao,
    ambiente: projeto.ambiente,
    subsolo: projeto.subsolo,
  })

  const metadata = {
    dominio: 'EV',
    modelo: 'EV_EXECUTIVO_V2',
    projeto: projeto.nome,
    cliente: projeto.cliente_nome,
    cpf: projeto.cpf,
    endereco: projeto.endereco,
    uc: projeto.uc,
    concessionaria: projeto.concessionaria,
    carga_instalada: projeto.carga_instalada,
    cidade: projeto.cidade,
    data: projeto.data || new Date().toLocaleDateString('pt-BR'),
    rt: { nome: projeto.tecnico_nome, registro: projeto.tecnico_crea || projeto.tecnico_cft },
    normas_motivo,
    equipamento: {
      modelo: carregador.modelo, fabricante: carregador.marca,
      potencia: carregador.potencia_kw ? `${carregador.potencia_kw} kW` : '',
      corrente: disjA ? `${disjA} A` : '', tensao: tensao ? `${tensao} V` : '',
      conector: carregador.tipo_conector ? `Tipo ${carregador.tipo_conector}` : '',
    },
    bom,
    normas,
  }

  return { components, connections, metadata }
}

/** Conveniência: projeto EV → JSON canônico do Engine (fonte única). */
export function construirCanonicalEV(args, { viewport = null, overrides = {} } = {}) {
  const { components, connections, metadata } = adaptarProjetoEV(args)
  return build({ components, connections, metadata, viewport, overrides })
}

/** Conveniência: projeto EV → SVG executivo (mesmo Engine do editor e do PDF). */
export function renderarSVGEV(args, opts) {
  return renderSVG(construirCanonicalEV(args), opts)
}

export { toReactFlow }
