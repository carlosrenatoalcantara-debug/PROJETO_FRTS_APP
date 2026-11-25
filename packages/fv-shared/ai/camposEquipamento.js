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

// Proveniência/confiança por campo (Importação Assistida).
// P1-INV-HARDEN-01: 5 níveis (substitui o binário encontrado/inferido).
export const PROVENIENCIA = {
  ENCONTRADO: 'encontrado',         // 🟢 100% — valor direto na coluna do modelo
  INFERIDO_ALTA: 'inferido_alta',   // 🟡 célula compartilhada/mesclada
  INFERIDO_MEDIA: 'inferido_media', // 🟡 derivado (ex.: potência do nome)
  INFERIDO_BAIXA: 'inferido_baixa', // 🟠 coluna distante / fallback de texto
  INFERIDO: 'inferido',             // (legado/genérico)
  FALTANTE: 'faltante',             // 🔴 não encontrado
}

// Rótulo legível + percentual aproximado por nível (para a UI).
export const CONFIANCA_LABEL = {
  encontrado:     { texto: 'Encontrado', pct: 100 },
  inferido_alta:  { texto: 'Inferido (alta)', pct: 85 },
  inferido_media: { texto: 'Inferido (média)', pct: 60 },
  inferido_baixa: { texto: 'Inferido (baixa)', pct: 35 },
  inferido:       { texto: 'Inferido', pct: 60 },
  faltante:       { texto: 'Não encontrado', pct: 0 },
}
const _ehInferido = (p) => typeof p === 'string' && p.startsWith('inferido')

// Cada campo: { key, label, obrigatorio?, tipo? ('number'|'text'), info? (legenda externa) }
const ESQUEMA = {
  inversor: [
    { key: 'potencia_kw', grupo: 'ca',           label: 'Potência nominal (kW)', obrigatorio: true,  tipo: 'number', info: 'Potência ativa nominal entregue à rede.' },
    { key: 'potencia_maxima_kw', grupo: 'ca',    label: 'Potência máxima (kW)',  tipo: 'number', info: 'Potência máxima entregue à rede (aparente/ativa).' },
    { key: 'n_mppts', grupo: 'cc',               label: 'Nº de MPPTs',           obrigatorio: true,  tipo: 'number', info: 'Quantidade de rastreadores de máxima potência independentes.' },
    { key: 'tipo_topologia', grupo: 'cc',        label: 'Topologia',             tipo: 'text', info: 'STRING (inversor de string), MICRO (microinversor) ou HYBRID (híbrido).' },
    { key: 'entradas_por_mppt', grupo: 'cc',     label: 'Entradas por MPPT',     tipo: 'text', info: 'Entradas físicas (conectores) por MPPT. STRING: strings possíveis; MICRO: módulos por MPPT. Ex.: 3/3, 2/1.' },
    // Lado CC do MICROINVERSOR (FV-DOM-031). Só aparecem quando o equipamento é
    // micro; sem eles o wizard bloqueia ("cadastro incompleto") — nunca presumidos.
    // `aliases`: o mesmo dado já gravado com outro nome (dicionarioInversor).
    { key: 'entradas', grupo: 'cc',              label: 'Nº de entradas (micro)', tipo: 'number', soMicro: true,
      aliases: ['entradas_cc', 'total_entradas_cc', 'n_entradas', 'numero_entradas', 'entradas_dc'],
      info: 'Entradas CC do microinversor (conectores de módulo). Ex.: 4.' },
    { key: 'modulos_por_entrada', grupo: 'cc',   label: 'Módulos por entrada (micro)', tipo: 'number', soMicro: true,
      aliases: ['modulos_por_entrada_max', 'paineis_por_entrada', 'modulos_por_canal'],
      info: 'Quantos módulos ligam em cada entrada. Ex.: 1.' },
    { key: 'strings_por_mppt', grupo: 'cc',      label: 'Strings por MPPT',      tipo: 'text', info: 'Compatibilidade — strings por MPPT, derivado de entradas_por_mppt. Ex.: 1/1, 2/1, 3/3/2/2.' },
    { key: 'tensao_max_entrada', grupo: 'cc',    label: 'Tensão máx. entrada (V)', tipo: 'number', info: 'Tensão CC máxima suportada na entrada (Voc no frio não pode excedê-la).' },
    { key: 'tensao_mppt_min', grupo: 'cc',       label: 'Tensão MPPT mín. (V)',  tipo: 'number', info: 'Limite inferior da faixa de rastreamento MPPT.' },
    { key: 'tensao_mppt_max', grupo: 'cc',       label: 'Tensão MPPT máx. (V)',  tipo: 'number', info: 'Limite superior da faixa de rastreamento MPPT.' },
    { key: 'tensao_ac', grupo: 'ca',             label: 'Tensão AC (V)',         tipo: 'text', info: 'Tensão nominal de saída CA / conexão à rede.' },
    { key: 'corrente_ac_saida', grupo: 'ca',     label: 'Corrente AC saída (A)', tipo: 'number', info: 'Corrente máxima de saída em corrente alternada.' },
    { key: 'corrente_max_por_mppt', grupo: 'cc', label: 'Corrente máx./MPPT (A)', tipo: 'text', info: 'Corrente máxima de entrada suportada por cada MPPT.' },
    { key: 'corrente_isc_max', grupo: 'cc',      label: 'Corrente ISC máx. (A)', tipo: 'number', info: 'Corrente de curto-circuito máxima admitida por MPPT.' },
    { key: 'eficiencia_maxima', grupo: 'ca',     label: 'Eficiência máx. (%)',   tipo: 'number', info: 'Maior eficiência de conversão CC→CA.' },
    { key: 'peso_kg', grupo: 'mec',               label: 'Peso (kg)',             tipo: 'number', info: 'Massa do equipamento.' },
    { key: 'dimensoes', grupo: 'mec',             label: 'Dimensões (mm)',        tipo: 'text', info: 'Largura × Altura × Profundidade.' },
    { key: 'grau_protecao_ip', grupo: 'mec',      label: 'Grau de proteção IP',   tipo: 'text', info: 'Classe de proteção contra poeira/água (ex.: IP65).' },
    { key: 'certificacoes', grupo: 'mec',         label: 'Certificações',         tipo: 'text', info: 'Normas atendidas (ex.: IEC 62109, NBR 16149).' },
    { key: 'garantia_anos', grupo: 'mec',         label: 'Garantia (anos)',       tipo: 'number', info: 'Garantia padrão do fabricante em anos.' },
    // Complementares: editáveis, mas fora do percentual de completude da importação.
    { key: 'fases', grupo: 'ca', complementar: true, label: 'Fases', tipo: 'number', inteiro: true, min: 1, max: 3, info: '1 = monofásico, 2 = bifásico, 3 = trifásico.' },
    { key: 'faixa_tensao_rede', grupo: 'ca', complementar: true, label: 'Faixa de tensão da rede (V)', tipo: 'text', info: 'Faixa em que o equipamento opera. Ex.: 190~250. Um modelo que atende várias tensões é UM cadastro.' },
    { key: 'frequencia_hz', grupo: 'ca', complementar: true, label: 'Frequência (Hz)', tipo: 'number', info: 'Frequência nominal da rede.' },
    { key: 'fator_potencia', grupo: 'ca', complementar: true, label: 'Fator de potência', tipo: 'text', info: 'Fator de potência e faixa de ajuste.' },
    { key: 'thdi', grupo: 'ca', complementar: true, label: 'THDi', tipo: 'text', info: 'Distorção harmônica total de corrente. Ex.: < 3%.' },
    { key: 'max_por_cabo_tronco', grupo: 'ca', complementar: true, soMicro: true, label: 'Máx. de micros por arranjo (ramal CA)', tipo: 'number', inteiro: true, min: 1, max: 50,
      aliases: ['max_micros_por_arranjo', 'max_micros_serie', 'max_micros_por_ramal', 'micros_por_ramal_max', 'max_unidades_por_ramal', 'maximo_micros_em_serie'],
      info: 'Quantos micros cabem em série no mesmo ramal (cabo tronco), conforme o fabricante. Depende da bitola e da tensão: informe o da bitola que você usa. Ex.: 3.' },
    { key: 'potencia_max_entrada_cc', grupo: 'cc', complementar: true, label: 'Potência máx. de entrada CC', tipo: 'number', min: 0, info: 'Potência fotovoltaica máxima admitida: kWp no inversor string, W no micro. É diferente da potência CA.' },
    { key: 'corrente_max_entrada', grupo: 'cc', complementar: true, label: 'Corrente máx. total de entrada (A)', tipo: 'number', min: 0, info: 'Limite TOTAL de corrente CC do equipamento — não é o limite por MPPT.' },
    { key: 'tensao_partida', grupo: 'cc', complementar: true, label: 'Tensão de partida (V)', tipo: 'number', min: 0, info: 'Tensão CC em que o equipamento começa a operar. No micro, a mínima. Ex.: 22.' },
    { key: 'tensao_partida_max', grupo: 'cc', complementar: true, soMicro: true, label: 'Tensão de partida máx. (V)', tipo: 'number', min: 0, info: 'Tensão CC máxima em que o micro começa a operar. Ex.: 60.' },
    { key: 'potencia_modulo_min_w', grupo: 'cc', complementar: true, soMicro: true, label: 'Potência do módulo mín. (W)', tipo: 'number', min: 0, info: 'Início da faixa de potência de módulo indicada pelo fabricante. Ex.: 450.' },
    { key: 'potencia_modulo_max_w', grupo: 'cc', complementar: true, soMicro: true, label: 'Potência do módulo máx. (W)', tipo: 'number', min: 0, info: 'Fim da faixa de potência de módulo indicada pelo fabricante. Ex.: 750.' },
    // Micro não tem: o datasheet limita por potência do módulo, tensão e corrente.
    { key: 'oversizing_max', grupo: 'cc', complementar: true, naoMicro: true, label: 'Limite CC/CA do fabricante', tipo: 'number', min: 0.5, max: 3,
      aliases: ['fator_sobrecarga_max', 'dc_ac_ratio_max', 'sobredimensionamento_max', 'overload_max'],
      info: 'Razão máxima entre potência CC e CA. Ex.: 1.3 (não em %).' },
    { key: 'temperatura_operacao', grupo: 'mec', complementar: true, label: 'Temperatura de operação (°C)', tipo: 'text', info: 'Faixa de temperatura ambiente. Ex.: -40~+65.' },
    { key: 'tipo_refrigeracao', grupo: 'mec', complementar: true, label: 'Refrigeração', tipo: 'text', info: 'Ex.: convecção natural, ventilação forçada.' },
  ],
  modulo: [
    { key: 'potencia_wp', grupo: 'ele',               label: 'Potência (Wp)',        obrigatorio: true, tipo: 'number' },
    { key: 'voc', grupo: 'ele',                       label: 'Voc (V)',              tipo: 'number' },
    { key: 'vmp', grupo: 'ele',                       label: 'Vmp (V)',              tipo: 'number' },
    { key: 'isc', grupo: 'ele',                       label: 'Isc (A)',              tipo: 'number' },
    { key: 'imp', grupo: 'ele',                       label: 'Imp (A)',              tipo: 'number' },
    { key: 'eficiencia', grupo: 'ele',                label: 'Eficiência (%)',       tipo: 'number' },
    { key: 'tipo_celula', grupo: 'mec',               label: 'Tipo de célula',       tipo: 'text' },
    { key: 'num_celulas', grupo: 'mec', aliases: ['celulas'],               label: 'Nº de células',        tipo: 'number' },
    { key: 'peso_kg', grupo: 'mec',                   label: 'Peso (kg)',            tipo: 'number' },
    { key: 'dimensoes', grupo: 'mec',                 label: 'Dimensões (mm)',       tipo: 'text' },
    { key: 'certificacoes', grupo: 'mec',             label: 'Certificações',        tipo: 'text' },
    { key: 'garantia_produto_anos', grupo: 'mec',     label: 'Garantia produto (anos)',     tipo: 'number' },
    { key: 'garantia_performance_anos', grupo: 'mec', label: 'Garantia performance (anos)', tipo: 'number' },
    { key: 'coef_temp_pmax', grupo: 'ele', complementar: true, label: 'Coef. temp. Pmax (%/°C)', tipo: 'number' },
    { key: 'coef_temp_voc', grupo: 'ele', complementar: true, label: 'Coef. temp. Voc (%/°C)', tipo: 'number' },
    { key: 'coef_temp_isc', grupo: 'ele', complementar: true, label: 'Coef. temp. Isc (%/°C)', tipo: 'number' },
    { key: 'noct', grupo: 'ele', complementar: true, label: 'NOCT (°C)', tipo: 'number' },
    { key: 'tensao_max_sistema', grupo: 'ele', complementar: true, label: 'Tensão máx. do sistema (V)', tipo: 'number' },
    { key: 'fusivel_serie_max', grupo: 'ele', complementar: true, label: 'Fusível série máx. (A)', tipo: 'number' },
    { key: 'grau_protecao_ip', grupo: 'mec', complementar: true, label: 'Grau de proteção IP', tipo: 'text' },
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

/**
 * Categorias de exibição (decisão do usuário): inversor e micro = CA, CC e
 * físico-mecânicas; módulo = elétricas e mecânicas. Garantias e certificações
 * ficam com as mecânicas. Só organiza a tela: nenhuma chave gravada muda.
 */
const GRUPOS = {
  inversor: [
    { id: 'ca', titulo: 'CA — saída para a rede' },
    { id: 'cc', titulo: 'CC — entrada dos módulos' },
    { id: 'mec', titulo: 'Físico-mecânicas, garantias e certificações' },
  ],
  modulo: [
    { id: 'ele', titulo: 'Elétricas' },
    { id: 'mec', titulo: 'Mecânicas, garantias e certificações' },
  ],
}

/** Campos já classificados → categorias. Campo sem grupo nunca some da tela. */
export function agruparCampos(tipo, campos) {
  const grupos = GRUPOS[tipo]
  if (!grupos) return [{ id: 'todos', titulo: null, campos }]
  const ids = new Set(grupos.map((g) => g.id))
  const lista = grupos.map((g) => ({ ...g, campos: campos.filter((c) => c.grupo === g.id) }))
  const soltos = campos.filter((c) => !ids.has(c.grupo))
  if (soltos.length) lista.push({ id: 'outros', titulo: 'Outros', campos: soltos })
  return lista.filter((g) => g.campos.length > 0)
}

/**
 * Grava um campo em `especificacoes` e remove os nomes antigos do mesmo dado —
 * senão apagar o valor fazia o nome antigo reaparecer.
 */
export function aplicarCampo(especificacoes, campo, valor) {
  const nova = { ...(especificacoes || {}) }
  for (const a of campo?.aliases || []) delete nova[a]
  if (valor === '' || valor === null || valor === undefined || (typeof valor === 'number' && !Number.isFinite(valor))) {
    delete nova[campo.key]
  } else {
    nova[campo.key] = valor
  }
  return nova
}

/** Valores fora da faixa física do campo. Ausente não é erro. */
export function errosDeCampos(campos) {
  const erros = []
  for (const c of campos || []) {
    if (!_presente(c.valor) || (c.min === undefined && c.max === undefined && !c.inteiro)) continue
    const n = Number(c.valor)
    if (!Number.isFinite(n)) erros.push(`${c.label}: informe um número.`)
    else if (c.inteiro && !Number.isInteger(n)) erros.push(`${c.label}: informe um número inteiro.`)
    else if (c.min !== undefined && n < c.min) erros.push(`${c.label}: mínimo ${c.min}.`)
    else if (c.max !== undefined && n > c.max) erros.push(`${c.label}: máximo ${c.max}.`)
  }
  return erros
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
/** Rótulo dinâmico das entradas conforme a topologia (P1-INV-TOPOLOGY-01). */
export function rotuloEntradas(tipoTopologia) {
  return String(tipoTopologia).toUpperCase() === 'MICRO' ? 'Módulos por MPPT' : 'Strings por MPPT'
}

export function classificarCampos(tipo, especificacoes = {}, statusMap = {}, ctx = {}) {
  const topo = especificacoes?.tipo_topologia
  const micro = ctx?.micro === true || String(topo).toUpperCase() === 'MICRO'
  return obterCamposEditaveis(tipo).filter(c => (micro ? !c.naoMicro || _presente(especificacoes?.[c.key]) : !c.soMicro)).map(campo => {
    let valor = especificacoes?.[campo.key] ?? null
    for (const a of campo.aliases || []) { if (valor == null || valor === '') valor = especificacoes?.[a] ?? null }
    // entradas_por_mppt: exibe array como "3/3"; rótulo muda por topologia.
    let label = campo.label
    if (campo.key === 'entradas_por_mppt') {
      if (Array.isArray(valor)) valor = valor.join('/')
      label = `${rotuloEntradas(topo)} (entradas/MPPT)`
    }
    const ok = _presente(valor)
    const status = ok
      ? STATUS.OK
      : (campo.obrigatorio ? STATUS.OBRIGATORIO : STATUS.AUSENTE)
    // Proveniência/confiança: usa o nível vindo do parser; default ENCONTRADO.
    const proveniencia = ok ? (statusMap?.[campo.key] || PROVENIENCIA.ENCONTRADO) : PROVENIENCIA.FALTANTE
    const confianca = CONFIANCA_LABEL[proveniencia] || CONFIANCA_LABEL.encontrado
    return { ...campo, label, valor, status, proveniencia, confianca, info: campo.info || null }
  })
}

/**
 * Resumo de qualidade por modelo a partir da classificação.
 * @returns {{ percentual, encontrados, inferidos, pendentes, faltantes:string[],
 *            obrigatoriosFaltando:string[], podeSalvar:boolean }}
 */
export function resumirQualidade(tipo, especificacoes = {}, statusMap = {}) {
  const campos = classificarCampos(tipo, especificacoes, statusMap).filter((c) => !c.complementar)
  const total = campos.length
  const preenchidos = campos.filter(c => c.status === STATUS.OK).length
  const encontrados = campos.filter(c => c.proveniencia === PROVENIENCIA.ENCONTRADO).length
  const inferidos = campos.filter(c => _ehInferido(c.proveniencia)).length
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
