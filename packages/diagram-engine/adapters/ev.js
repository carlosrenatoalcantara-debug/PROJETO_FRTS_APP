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
  const polosLinha = ehTri ? 4 : 2
  const disjA = calculos.disjuntor_a ?? carregador.corrente_entrada_a ?? 0
  const bitola = bitolaDoBOM(bom, calculos.bitola_cabo_mm2)
  const comprimento = calculos.comprimento_cabo_m ?? projeto.comprimento_cabo_m
  const condutores = condutoresPorFases(nf)
  const condutoresBitola = condutores.map(c => ({ ...c, bitola_mm2: bitola }))
  const tensao = carregador.tensao_entrada_v ?? (ehTri ? 380 : 220)

  // BUG-011: o CABO não é componente — é a própria ligação (edge). Sem o box 'cabo'.
  const components = [
    componente({ id: 'rede', tipo: TIPOS.REDE, label: 'QD Existente', specs: { tensao_v: tensao }, ordem: 0 }),
    componente({ id: 'disj', tipo: TIPOS.DISJUNTOR, polos: polosLinha, specs: { corrente_a: disjA, curva: 'C' }, ordem: 1 }),
    componente({ id: 'dr', tipo: TIPOS.DR, polos: polosLinha, specs: { ma: calculos.dr_ma ?? 30, classe: 'A' }, ordem: 2 }),
    componente({ id: 'carr', tipo: TIPOS.EQUIPAMENTO, subtipo: 'carregador_ev', label: `${carregador.marca || ''} ${carregador.modelo || ''}`.trim() || 'Carregador EV', specs: { potencia_kw: carregador.potencia_kw, corrente_a: disjA, conector: carregador.tipo_conector }, ordem: 4 }),
    componente({ id: 'veic', tipo: TIPOS.CARGA, label: 'Veículo Elétrico', specs: { conector: carregador.tipo_conector }, ordem: 5 }),
  ]

  const nDPS = contarDPS(bom)
  const polosDPS = nDPS >= 2 ? 1 : 2
  for (let i = 0; i < nDPS; i++) {
    components.push(componente({ id: `dps${i}`, tipo: TIPOS.DPS, polos: polosDPS, specs: { tensao_v: calculos.dps_kv ?? 275 } }))
  }

  const connections = [
    conexao({ id: 'c-rede-disj', from: 'rede', to: 'disj', condutores: condutoresBitola }),
    conexao({ id: 'c-disj-dr', from: 'disj', to: 'dr', condutores: condutoresBitola }),
    // BUG-011: ligação única DR→Carregador = o cabo. Bitola/comprimento/observações
    // pertencem a ESTA edge (não a um componente CABO).
    conexao({ id: 'c-dr-carr', from: 'dr', to: 'carr', condutores: condutoresBitola, specs: { bitola_mm2: bitola, comprimento_m: comprimento, observacoes: '' } }),
    conexao({ id: 'c-carr-veic', from: 'carr', to: 'veic', condutores: [{ papel: 'fase' }] }),
  ]
  for (let i = 0; i < nDPS; i++) {
    connections.push(conexao({ id: `c-dps${i}`, from: 'disj', to: `dps${i}`, papel: PAPEL_CONEXAO.DERIVACAO, condutores: [{ papel: 'terra' }] }))
  }
  // Aterramento ligado aos pontos de proteção (DR e Carregador), além do(s) DPS.
  connections.push(conexao({ id: 'c-terra-dr', from: 'disj', to: 'dr', papel: PAPEL_CONEXAO.DERIVACAO, condutores: [{ papel: 'terra' }] }))
  connections.push(conexao({ id: 'c-terra-carr', from: 'disj', to: 'carr', papel: PAPEL_CONEXAO.DERIVACAO, condutores: [{ papel: 'terra' }] }))

  const { normas, normas_motivo } = avaliarNormas({
    endereco: projeto.endereco, estado: projeto.estado,
    tipo_instalacao: projeto.tipo_instalacao, ambiente: projeto.ambiente, subsolo: projeto.subsolo,
  })

  const metadata = {
    dominio: 'EV', modelo: 'EV_EXECUTIVO_V2',
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

  return { components, connections, metadata }
}

export function construirCanonicalEV(args, { viewport = null, overrides = {} } = {}) {
  const { components, connections, metadata } = adaptarProjetoEV(args)
  return build({ components, connections, metadata, viewport, overrides })
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
  return {
    calculos: { ...calculos, comprimento_cabo_m: projeto.comprimento_cabo_m },
    bom: calculos.materiais || projeto.bom || [],
    // BUG-011: fases do CIRCUITO vêm do carregador (o adapter também deriva de carregador.tipo).
    // NÃO usar projeto.fases (alimentação do imóvel) — fazia projeto mono virar 5 condutores.
    numero_fases: Number(carregador.numero_fases) || 1,
    carregador,
    projeto: {
      nome: projeto.nome,
      cliente_nome: clienteNome,
      endereco: projeto.endereco_completo || projeto.endereco,
      cpf: clienteObj?.cpf,
      uc: clienteObj?.unidade_consumidora,
      concessionaria: clienteObj?.concessionaria,
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
  const { components, connections, metadata } = adaptarProjetoEV(argsDeProjetoEV(projeto))
  const persistido = projeto.diagrama_editado || {}
  return build({
    components,
    connections,
    metadata,
    viewport: persistido.viewport || null,
    overrides: persistido.overrides || {},
  })
}

export { toReactFlow }
