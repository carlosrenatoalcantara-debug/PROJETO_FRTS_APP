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

// Cada campo: { key, label, obrigatorio?, tipo? ('number'|'text') }
const ESQUEMA = {
  inversor: [
    { key: 'potencia_kw',           label: 'Potência nominal (kW)', obrigatorio: true,  tipo: 'number' },
    { key: 'potencia_maxima_kw',    label: 'Potência máxima (kW)',  tipo: 'number' },
    { key: 'n_mppts',               label: 'Nº de MPPTs',           obrigatorio: true,  tipo: 'number' },
    { key: 'strings_por_mppt',      label: 'Strings por MPPT',      tipo: 'text' },
    { key: 'tensao_max_entrada',    label: 'Tensão máx. entrada (V)', tipo: 'number' },
    { key: 'tensao_mppt_min',       label: 'Tensão MPPT mín. (V)',  tipo: 'number' },
    { key: 'tensao_mppt_max',       label: 'Tensão MPPT máx. (V)',  tipo: 'number' },
    { key: 'tensao_ac',             label: 'Tensão AC (V)',         tipo: 'text' },
    { key: 'corrente_ac_saida',     label: 'Corrente AC saída (A)', tipo: 'number' },
    { key: 'corrente_max_por_mppt', label: 'Corrente máx./MPPT (A)', tipo: 'text' },
    { key: 'eficiencia_maxima',     label: 'Eficiência máx. (%)',   tipo: 'number' },
    { key: 'peso_kg',               label: 'Peso (kg)',             tipo: 'number' },
    { key: 'dimensoes',             label: 'Dimensões (mm)',        tipo: 'text' },
    { key: 'grau_protecao_ip',      label: 'Grau de proteção IP',   tipo: 'text' },
    { key: 'certificacoes',         label: 'Certificações',         tipo: 'text' },
    { key: 'garantia_anos',         label: 'Garantia (anos)',       tipo: 'number' },
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
 * @returns {Array<{key,label,valor,obrigatorio,status,tipo}>}
 */
export function classificarCampos(tipo, especificacoes = {}) {
  return obterCamposEditaveis(tipo).map(campo => {
    const valor = especificacoes?.[campo.key] ?? null
    const ok = _presente(valor)
    const status = ok
      ? STATUS.OK
      : (campo.obrigatorio ? STATUS.OBRIGATORIO : STATUS.AUSENTE)
    return { ...campo, valor, status }
  })
}

/**
 * Resumo de qualidade por modelo a partir da classificação.
 * @returns {{ percentual:number, faltantes:string[], obrigatoriosFaltando:string[], podeSalvar:boolean }}
 */
export function resumirQualidade(tipo, especificacoes = {}) {
  const campos = classificarCampos(tipo, especificacoes)
  const total = campos.length
  const preenchidos = campos.filter(c => c.status === STATUS.OK).length
  const faltantes = campos.filter(c => c.status !== STATUS.OK).map(c => c.label)
  const obrigatoriosFaltando = campos.filter(c => c.status === STATUS.OBRIGATORIO).map(c => c.label)
  return {
    percentual: total ? Math.round((preenchidos / total) * 100) : 0,
    faltantes,
    obrigatoriosFaltando,
    podeSalvar: obrigatoriosFaltando.length === 0, // bloqueia salvar se 🔴 pendente
  }
}
