/**
 * camposEquipamento.js — P0-INV-CAT-03 (Importação Assistida)
 *
 * Esquema PURO de campos editáveis por tipo de equipamento + classificador de
 * status (🟢 encontrado / 🟡 ausente opcional / 🔴 obrigatório ausente).
 *
 * Reutiliza as MESMAS chaves de `especificacoes` já usadas no catálogo (sem
 * alterar schema Mongo — especificacoes é Mixed). Serve para inversor, módulo,
 * bateria e carregador_ev, e é independente do provider (Gemini/Claude/parser).
 *
 * Sem I/O, sem dependências. Importável por backend e frontend/testes.
 */

export const STATUS = { OK: 'verde', AUSENTE: 'amarelo', OBRIGATORIO: 'vermelho' }

// P1-INV-MATRIX-01: proveniência por campo (legenda 🟢/🟡/🔴 da Importação Assistida).
export const PROVENIENCIA = { ENCONTRADO: 'encontrado', INFERIDO: 'inferido', FALTANTE: 'faltante' }

// Cada campo: { key, label, obrigatorio?, tipo? ('number'|'text'), info? (legenda externa) }
const ESQUEMA = {
  inversor: [
    { key: 'potencia_kw',           label: 'Potência nominal (kW)', obrigatorio: true,  tipo: 'number', info: 'Potência ativa nominal entregue à rede.' },
    { key: 'potencia_maxima_kw',    label: 'Potência máxima (kW)',  tipo: 'number', info: 'Potência máxima entregue à rede (aparente/ativa).' },
    { key: 'n_mppts',               label: 'Nº de MPPTs',           obrigatorio: true,  tipo: 'number', info: 'Quantidade de rastreadores de máxima potência independentes.' },
    { key: 'strings_por_mppt',      label: 'Strings por MPPT',      tipo: 'text', info: 'Quantidade de strings conectadas a cada MPPT. Exemplos: 1/1, 2/1, 3/3/2/2.' },
    { key: 'tensao_max_entrada',    label: 'Tensão máx. entrada (V)', tipo: 'number', info: 'Tensão CC máxima suportada na entrada (Voc no frio não pode excedê-la).' },
    { key: 'tensao_mppt_min',       label: 'Tensão MPPT mín. (V)',  tipo: 'number', info: 'Limite inferior da faixa de rastreamento MPPT.' },
    { key: 'tensao_mppt_max',       label: 'Tensão MPPT máx. (V)',  tipo: 'number', info: 'Limite superior da faixa de rastreamento MPPT.' },
    { key: 'tensao_ac',             label: 'Tensão AC (V)',         tipo: 'text', info: 'Tensão nominal de saída CA / conexão à rede.' },
    { key: 'corrente_ac_saida',     label: 'Corrente AC saída (A)', tipo: 'number', info: 'Corrente máxima de saída em corrente alternada.' },
    { key: 'corrente_max_por_mppt', label: 'Corrente máx./MPPT (A)', tipo: 'text', info: 'Corrente máxima de entrada suportada por cada MPPT.' },
    { key: 'corrente_isc_max',      label: 'Corrente ISC máx. (A)', tipo: 'number', info: 'Corrente de curto-circuito máxima admitida por MPPT.' },
    { key: 'eficiencia_maxima',     label: 'Eficiência máx. (%)',   tipo: 'number', info: 'Maior eficiência de conversão CC→CA.' },
    { key: 'peso_kg',               label: 'Peso (kg)',             tipo: 'number', info: 'Massa do equipamento.' },
    { key: 'dimensoes',             label: 'Dimensões (mm)',        tipo: 'text', info: 'Largura × Altura × Profundidade.' },
    { key: 'grau_protecao_ip',      label: 'Grau de proteção IP',   tipo: 'text', info: 'Classe de proteção contra poeira/água (ex.: IP65).' },
    { key: 'certificacoes',         label: 'Certificações',         tipo: 'text', info: 'Normas atendidas (ex.: IEC 62109, NBR 16149).' },
    { key: 'garantia_anos',         label: 'Garantia (anos)',       tipo: 'number', info: 'Garantia padrão do fabricante em anos.' },
  ],
  modulo: [
    { key: 'potencia_wp',               label: 'Potência (Wp)',        obrigatorio: true, tipo: 'number' },
    { key: 'voc',                       label: 'Voc (V)',              tipo: 'number' },
    { key: 'vmp',                       label: 'Vmp (V)',              tipo: 'number' },
    { key: 'isc',                       label: 'Isc (A)',              tipo: 'number' },
    { key: 'imp',                       label: 'Imp (A)',              tipo: 'number' },
    { key: 'eficiencia',                label: 'Eficiência (%)',       tipo: 'number' },
    { key: 'tipo_celula',               label: 'Tipo de célula',       tipo: 'text' },
    { key: 'num_celulas',               label: 'Nº de células',        tipo: 'number' },
    { key: 'peso_kg',                   label: 'Peso (kg)',            tipo: 'number' },
    { key: 'dimensoes',                 label: 'Dimensões (mm)',       tipo: 'text' },
    { key: 'certificacoes',             label: 'Certificações',        tipo: 'text' },
    { key: 'garantia_produto_anos',     label: 'Garantia produto (anos)',     tipo: 'number' },
    { key: 'garantia_performance_anos', label: 'Garantia performance (anos)', tipo: 'number' },
  ],
  bateria: [
    { key: 'capacidade_kwh', label: 'Capacidade (kWh)', obrigatorio: true, tipo: 'number' },
    { key: 'tensao_v',       label: 'Tensão (V)',       tipo: 'number' },
    { key: 'tecnologia',     label: 'Tecnologia',       tipo: 'text' },
    { key: 'ciclos',         label: 'Ciclos de vida',   tipo: 'number' },
    { key: 'dod_pct',        label: 'DoD (%)',          tipo: 'number' },
    { key: 'peso_kg',        label: 'Peso (kg)',        tipo: 'number' },
    { key: 'dimensoes',      label: 'Dimensões (mm)',   tipo: 'text' },
    { key: 'certificacoes',  label: 'Certificações',    tipo: 'text' },
    { key: 'garantia_anos',  label: 'Garantia (anos)',  tipo: 'number' },
  ],
  carregador_ev: [
    { key: 'potencia_kw',   label: 'Potência (kW)',    obrigatorio: true, tipo: 'number' },
    { key: 'tipo',          label: 'Tipo',             tipo: 'text' },
    { key: 'tensao_v',      label: 'Tensão (V)',       tipo: 'text' },
    { key: 'corrente_a',    label: 'Corrente (A)',     tipo: 'number' },
    { key: 'conector',      label: 'Conector',         tipo: 'text' },
    { key: 'fases',         label: 'Fases',            tipo: 'text' },
    { key: 'grau_protecao_ip', label: 'Grau de proteção IP', tipo: 'text' },
    { key: 'peso_kg',       label: 'Peso (kg)',        tipo: 'number' },
    { key: 'dimensoes',     label: 'Dimensões (mm)',   tipo: 'text' },
    { key: 'certificacoes', label: 'Certificações',    tipo: 'text' },
    { key: 'garantia_anos', label: 'Garantia (anos)',  tipo: 'number' },
  ],
}

/** Lista de campos editáveis para um tipo (default: inversor). */
export function obterCamposEditaveis(tipo) {
  return ESQUEMA[tipo] || ESQUEMA.inversor
}

function _presente(v) {
  if (v == null) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (typeof v === 'number') return !Number.isNaN(v)
  if (Array.isArray(v)) return v.length > 0
  return true
}

/**
 * Classifica cada campo de um equipamento com status 🟢/🟡/🔴.
 * @param {string} tipo
 * @param {Object} especificacoes
 * @param {Object} [statusMap] proveniência por campo do parser ('encontrado'|'inferido')
 * @returns {Array<{key,label,valor,obrigatorio,status,proveniencia,info,tipo}>}
 */
export function classificarCampos(tipo, especificacoes = {}, statusMap = {}) {
  return obterCamposEditaveis(tipo).map(campo => {
    const valor = especificacoes?.[campo.key] ?? null
    const ok = _presente(valor)
    const status = ok
      ? STATUS.OK
      : (campo.obrigatorio ? STATUS.OBRIGATORIO : STATUS.AUSENTE)
    // Proveniência (P1-INV-MATRIX-01): 🟢 encontrado no PDF, 🟡 inferido, 🔴 faltante.
    let proveniencia
    if (!ok) proveniencia = PROVENIENCIA.FALTANTE
    else if (statusMap?.[campo.key] === PROVENIENCIA.INFERIDO) proveniencia = PROVENIENCIA.INFERIDO
    else proveniencia = PROVENIENCIA.ENCONTRADO
    return { ...campo, valor, status, proveniencia, info: campo.info || null }
  })
}

/**
 * Resumo de qualidade por modelo a partir da classificação.
 * @returns {{ percentual, encontrados, inferidos, pendentes, faltantes:string[],
 *            obrigatoriosFaltando:string[], podeSalvar:boolean }}
 */
export function resumirQualidade(tipo, especificacoes = {}, statusMap = {}) {
  const campos = classificarCampos(tipo, especificacoes, statusMap)
  const total = campos.length
  const preenchidos = campos.filter(c => c.status === STATUS.OK).length
  const encontrados = campos.filter(c => c.proveniencia === PROVENIENCIA.ENCONTRADO).length
  const inferidos = campos.filter(c => c.proveniencia === PROVENIENCIA.INFERIDO).length
  const pendentes = campos.filter(c => c.proveniencia === PROVENIENCIA.FALTANTE).length
  const faltantes = campos.filter(c => c.status !== STATUS.OK).map(c => c.label)
  const obrigatoriosFaltando = campos.filter(c => c.status === STATUS.OBRIGATORIO).map(c => c.label)
  return {
    percentual: total ? Math.round((preenchidos / total) * 100) : 0,
    encontrados,
    inferidos,
    pendentes,
    faltantes,
    obrigatoriosFaltando,
    podeSalvar: obrigatoriosFaltando.length === 0, // bloqueia salvar se 🔴 pendente
  }
}
