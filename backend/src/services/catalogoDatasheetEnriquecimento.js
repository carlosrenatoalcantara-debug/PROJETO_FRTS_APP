import fs from 'fs'
import path from 'path'
import { aplicarRegras } from './regrasPlausibilidade.js'
import { processarEquipamento } from './catalogoQualidade.js'

const TIPOS_POR_PASTA = [
  { regex: /modulo|m[oó]dulo/i, tipo: 'modulo' },
  { regex: /inversor/i, tipo: 'inversor' },
  { regex: /carregador\s*ev|ev/i, tipo: 'carregador_ev' },
  { regex: /bateria/i, tipo: 'bateria' },
]

const CAMPOS_POR_TIPO = {
  modulo: [
    'potencia_w', 'voc_v', 'vmpp_v', 'isc_a', 'impp_a', 'eficiencia_pct',
    'coef_temp_voc_pct_c', 'coef_temp_isc_pct_c', 'coef_temp_pmax_pct_c',
    'noct_c', 'dimensoes_mm', 'peso_kg', 'numero_celulas', 'tipo_celula',
    'bifacial', 'ganho_bifacial_pct', 'certificacoes',
  ],
  inversor: [
    'potencia_kw_ca', 'potencia_kw_cc_max', 'fases_saida', 'tensao_saida_v',
    'frequencia_hz', 'voc_max_dc_v', 'tensao_inicializacao_dc_v',
    'mppt_min_v', 'mppt_max_v', 'isc_max_por_mppt_a', 'corrente_max_entrada_dc_a',
    'corrente_ac_saida_a', 'n_mppts', 'strings_max_por_mppt',
    'eficiencia_max_pct', 'eficiencia_european_pct', 'protecoes_integradas',
    'tipo_inversor', 'topologia', 'dimensoes_mm', 'peso_kg', 'grau_protecao_ip',
    'temperatura_operacao_c', 'certificacoes',
  ],
  carregador_ev: [
    'potencia_kw', 'tipo', 'tensao_entrada_v', 'corrente_entrada_a',
    'corrente_saida_a', 'fases', 'tipo_conector', 'tipo_carregamento',
    'eficiencia_pct', 'dimensoes_mm', 'peso_kg', 'grau_protecao_ip',
    'temperatura_operacao_c', 'certificacoes',
  ],
  bateria: [
    'quimica', 'capacidade_kwh', 'capacidade_nominal_v',
    'corrente_maxima_carga_a', 'corrente_maxima_descarga_a',
    'profundidade_descarga_pct', 'ciclos_vida_uteis',
    'dimensoes_mm', 'peso_kg', 'temperatura_operacao_c',
  ],
}

const UNKNOWN_RE = /^\s*(desconhecid[ao]|n\/?a|sem\s*nome|null|undefined|nao\s*informad[ao]|não\s*informad[ao]|--)\s*$/i

export function isUnknown(value) {
  if (value === null || value === undefined) return true
  const text = String(value).trim()
  return text.length < 2 || UNKNOWN_RE.test(text)
}

export function normalizarTexto(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function compactarModelo(value) {
  return normalizarTexto(value).replace(/\s+/g, '')
}

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const match = String(value).replace(',', '.').match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const n = Number(match[0])
  return Number.isFinite(n) ? n : null
}

function asInteger(value) {
  const n = asNumber(value)
  return n === null ? null : Math.round(n)
}

function firstNumber(value) {
  return asNumber(value)
}

function parseDimensoes(value) {
  if (!value) return null
  if (typeof value === 'object') {
    const largura = asNumber(value.largura ?? value.width ?? value.l)
    const altura = asNumber(value.altura ?? value.height ?? value.a ?? value.comprimento)
    const espessura = asNumber(value.espessura ?? value.depth ?? value.p ?? value.e)
    if (largura || altura || espessura) return { largura, altura, espessura }
    return null
  }
  const nums = String(value).replace(',', '.').match(/\d+(?:\.\d+)?/g)?.map(Number) || []
  if (nums.length < 2) return null
  return {
    largura: nums[0] || null,
    altura: nums[1] || null,
    espessura: nums[2] || null,
  }
}

function splitRange(value) {
  if (value === null || value === undefined) return { min: null, max: null }
  const nums = String(value).replace(',', '.').match(/-?\d+(?:\.\d+)?/g)?.map(Number) || []
  if (nums.length === 0) return { min: null, max: null }
  if (nums.length === 1) return { min: nums[0], max: nums[0] }
  return { min: Math.min(...nums), max: Math.max(...nums) }
}

function pick(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') return value
  }
  return null
}

function potenciaModuloFrom(entry) {
  return asNumber(pick(entry.potencia_w, entry.potenciaW, entry.potencia_wp, entry.potencia, entry.pmax))
}

function potenciaInversorKwFrom(entry) {
  const value = pick(entry.potencia_kw_ca, entry.potencia_nominal_kw, entry.potenciaKW, entry.potencia_kw, entry.potencia)
  const n = asNumber(value)
  if (n === null) return null
  return n > 200 ? n / 1000 : n
}

function potenciaCarregadorKwFrom(entry) {
  const n = asNumber(pick(entry.potencia_kw, entry.potencia, entry.potencia_nominal_kw))
  if (n === null) return null
  return n > 200 ? n / 1000 : n
}

function normalizarModulo(payload, arquivo) {
  const variantes = Array.isArray(payload.variantes) && payload.variantes.length ? payload.variantes : [payload]
  return variantes.map((variante) => {
    const fabricante = pick(payload.fabricante, variante.fabricante)
    const modelo = pick(variante.modelo_variante, variante.modelo, payload.modelo, arquivo.modeloHint)
    const specs = {
      _versao: '1.0',
      potencia_w: potenciaModuloFrom(variante),
      voc_v: asNumber(pick(variante.voc_v, variante.voc, variante.vocV)),
      vmpp_v: asNumber(pick(variante.vmpp_v, variante.vmpp, variante.vmp, variante.vmp_v)),
      isc_a: asNumber(pick(variante.isc_a, variante.isc, variante.iscA)),
      impp_a: asNumber(pick(variante.impp_a, variante.impp, variante.imp, variante.imp_a)),
      eficiencia_pct: asNumber(pick(variante.eficiencia_pct, variante.eficiencia, variante.eficienciaPct)),
      coef_temp_voc_pct_c: asNumber(pick(payload.coef_temp_voc_pct_c, payload.coef_temp_voc)),
      coef_temp_isc_pct_c: asNumber(pick(payload.coef_temp_isc_pct_c, payload.coef_temp_isc)),
      coef_temp_pmax_pct_c: asNumber(pick(payload.coef_temp_pmax_pct_c, payload.coef_temp_pmax)),
      dimensoes_mm: parseDimensoes(pick(payload.dimensoes_mm, payload.dimensoes)),
      peso_kg: asNumber(payload.peso_kg),
      numero_celulas: asInteger(pick(payload.numero_celulas, payload.num_celulas)),
      tipo_celula: pick(payload.tipo_celula, payload.tecnologia_celula),
      bifacial: /bifacial/i.test(String(pick(payload.tipo_celula, payload.notas, '') || '')) || null,
      certificacoes: Array.isArray(payload.certificacoes) ? payload.certificacoes : null,
    }
    return montarEntrada('modulo', fabricante, modelo, specs, payload, arquivo)
  })
}

function normalizarInversor(payload, arquivo) {
  const variantes = Array.isArray(payload.variantes) && payload.variantes.length ? payload.variantes : [payload]
  return variantes.map((variante) => {
    const mpptRange = splitRange(pick(variante.faixa_operacao_cc, variante.faixa_mppt, variante.tensao_mppt))
    const fabricante = pick(payload.fabricante, variante.fabricante)
    const modelo = pick(variante.modelo_variante, variante.modelo, payload.modelo, arquivo.modeloHint)
    const specs = {
      _versao: '1.0',
      potencia_kw_ca: potenciaInversorKwFrom(variante),
      potencia_kw_cc_max: (() => {
        const n = asNumber(pick(variante.potencia_kw_cc_max, variante.potencia_max_entrada_cc, variante.potencia_dc_max))
        return n !== null && n > 200 ? n / 1000 : n
      })(),
      fases_saida: asInteger(pick(variante.fases_saida, variante.fases_ac, variante.fases)),
      tensao_saida_v: firstNumber(pick(variante.tensao_saida_v, variante.tensao_ac_nominal_v, variante.tensao_ac_nominal, variante.tensao_ac)),
      frequencia_hz: asNumber(variante.frequencia_hz),
      voc_max_dc_v: asNumber(pick(variante.voc_max_dc_v, variante.tensao_max_entrada_dc_v, variante.tensao_max_entrada, variante.vpv_max)),
      tensao_inicializacao_dc_v: asNumber(pick(variante.tensao_inicializacao_dc_v, variante.tensao_partida, variante.start_voltage_v)),
      mppt_min_v: asNumber(pick(variante.mppt_min_v, variante.tensao_mppt_min_v, variante.tensao_mppt_min, mpptRange.min)),
      mppt_max_v: asNumber(pick(variante.mppt_max_v, variante.tensao_mppt_max_v, variante.tensao_mppt_max, mpptRange.max)),
      isc_max_por_mppt_a: asNumber(pick(variante.isc_max_por_mppt_a, variante.corrente_isc_max_a, variante.corrente_isc_max)),
      corrente_max_entrada_dc_a: asNumber(pick(variante.corrente_max_entrada_dc_a, variante.corrente_max_entrada, variante.corrente_max_entrada_dc_a)),
      corrente_ac_saida_a: asNumber(pick(variante.corrente_ac_saida_a, variante.corrente_ac_saida)),
      n_mppts: asInteger(pick(variante.n_mppts, variante.numero_mppt)),
      strings_max_por_mppt: asInteger(pick(variante.strings_max_por_mppt, variante.strings_por_mppt)),
      eficiencia_max_pct: asNumber(pick(variante.eficiencia_max_pct, variante.eficiencia_maxima_pct, variante.eficiencia_maxima, variante.eficiencia)),
      eficiencia_european_pct: asNumber(pick(variante.eficiencia_european_pct, variante.eficiencia_europeia_pct, variante.eficiencia_europeia)),
      protecoes_integradas: {
        anti_ilhamento: Boolean(variante.protecao_antiilhamento),
        dps_dc_integrado: /tipo|type|sim|yes|true/i.test(String(variante.protecao_sobretensao_dc || '')),
        dps_ca_integrado: /tipo|type|sim|yes|true/i.test(String(variante.protecao_sobretensao_ac || '')),
      },
      tipo_inversor: pick(payload.subtipo, variante.tipo_inversor, payload.tipo_inversor),
      topologia: pick(variante.topologia, payload.topologia),
      dimensoes_mm: parseDimensoes(pick(variante.dimensoes_mm, variante.dimensoes)),
      peso_kg: asNumber(variante.peso_kg),
      grau_protecao_ip: pick(variante.grau_protecao_ip, payload.grau_protecao_ip),
      temperatura_operacao_c: pick(variante.temperatura_operacao_c, variante.temperatura_operacao),
      certificacoes: Array.isArray(variante.certificacoes) ? variante.certificacoes : null,
    }
    return montarEntrada('inversor', fabricante, modelo, specs, payload, arquivo)
  })
}

function normalizarCarregador(payload, arquivo) {
  const specs = {
    _versao: '1.0',
    potencia_kw: potenciaCarregadorKwFrom(payload),
    tipo: pick(payload.tipo_carregamento, payload.tipo),
    tensao_entrada_v: firstNumber(payload.tensao_entrada_v),
    corrente_entrada_a: asNumber(pick(payload.corrente_entrada_a, payload.corrente_entrada_maxima_a)),
    corrente_saida_a: asNumber(pick(payload.corrente_saida_a, payload.corrente_saida_maxima_a)),
    fases: asInteger(pick(payload.fases, payload.numero_fases_entrada)),
    tipo_conector: payload.tipo_conector || null,
    tipo_carregamento: payload.tipo_carregamento || null,
    eficiencia_pct: asNumber(payload.eficiencia_pct),
    dimensoes_mm: parseDimensoes(payload.dimensoes_mm),
    peso_kg: asNumber(payload.peso_kg),
    grau_protecao_ip: payload.grau_protecao_ip || null,
    temperatura_operacao_c: payload.temperatura_operacao_c || null,
    certificacoes: Array.isArray(payload.certificacoes) ? payload.certificacoes : null,
  }
  return [montarEntrada('carregador_ev', payload.fabricante, pick(payload.modelo, arquivo.modeloHint), specs, payload, arquivo)]
}

function normalizarBateria(payload, arquivo) {
  const specs = {
    _versao: '1.0',
    quimica: payload.quimica || null,
    capacidade_kwh: asNumber(payload.capacidade_kwh),
    capacidade_nominal_v: asNumber(payload.capacidade_nominal_v),
    corrente_maxima_carga_a: asNumber(payload.corrente_maxima_carga_a),
    corrente_maxima_descarga_a: asNumber(payload.corrente_maxima_descarga_a),
    profundidade_descarga_pct: asNumber(payload.profundidade_descarga_pct),
    ciclos_vida_uteis: asInteger(payload.ciclos_vida_uteis),
    temperatura_operacao_c: payload.temperatura_operacao_c || null,
    dimensoes_mm: parseDimensoes(payload.dimensoes_mm),
    peso_kg: asNumber(payload.peso_kg),
  }
  return [montarEntrada('bateria', payload.fabricante, pick(payload.modelo, arquivo.modeloHint), specs, payload, arquivo)]
}

function montarEntrada(tipo, fabricante, modelo, specs, payload, arquivo) {
  const cleanedSpecs = Object.fromEntries(
    Object.entries(specs).filter(([, value]) => {
      if (value === null || value === undefined || value === '') return false
      if (typeof value === 'object' && !Array.isArray(value)) {
        return Object.values(value).some(v => v !== null && v !== undefined && v !== '')
      }
      if (Array.isArray(value)) return value.length > 0
      return true
    })
  )
  return {
    tipo,
    fabricante: fabricante || null,
    modelo: modelo || null,
    fabricante_normalizado: normalizarTexto(fabricante),
    modelo_normalizado: normalizarTexto(modelo),
    modelo_compacto: compactarModelo(modelo),
    specs_canonicas: cleanedSpecs,
    fonte: {
      arquivo: arquivo.fullPath,
      nome_arquivo: arquivo.fileName,
      tipo_pasta: arquivo.tipo,
    },
    bruto: payload,
  }
}

export function normalizarExtracaoGemini(resultado, arquivo) {
  const payload = resultado?.dados || resultado || {}
  const tipo = arquivo?.tipo || payload.tipo || payload.tipo_documento
  if (tipo === 'modulo' || tipo === 'modulo_solar') return normalizarModulo(payload, arquivo)
  if (tipo === 'inversor' || tipo === 'inversor_solar') return normalizarInversor(payload, arquivo)
  if (tipo === 'carregador_ev') return normalizarCarregador(payload, arquivo)
  if (tipo === 'bateria') return normalizarBateria(payload, arquivo)
  return []
}

export function listarDatasheets(rootDir) {
  const arquivos = []
  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, item.name)
      const stat = fs.statSync(fullPath)
      if (item.isDirectory() || stat.isDirectory()) {
        walk(fullPath)
        continue
      }
      if (!stat.isFile()) continue
      if (!/\.pdf$/i.test(item.name)) continue
      const relative = path.relative(rootDir, fullPath)
      const pasta = relative.split(path.sep)[0] || ''
      const tipo = TIPOS_POR_PASTA.find(entry => entry.regex.test(pasta))?.tipo
      if (!tipo) continue
      arquivos.push({
        fullPath,
        relative,
        fileName: item.name,
        pasta,
        tipo,
        modeloHint: path.basename(item.name, path.extname(item.name)),
      })
    }
  }
  walk(rootDir)
  return arquivos.sort((a, b) => a.relative.localeCompare(b.relative))
}

function potenciaPrincipal(equipamento) {
  const specs = equipamento.specs_canonicas || equipamento.especificacoes || {}
  if (equipamento.tipo === 'modulo') {
    return asNumber(pick(specs.potencia_w, specs.potencia, specs.potenciaW, specs.potencia_wp))
  }
  if (equipamento.tipo === 'inversor') {
    return asNumber(pick(specs.potencia_kw_ca, specs.potencia_kw, specs.potenciaKW, specs.potencia))
  }
  if (equipamento.tipo === 'carregador_ev') {
    return asNumber(pick(specs.potencia_kw, specs.potencia))
  }
  return null
}

function scorePotencia(a, b) {
  if (a === null || b === null || a === 0 || b === 0) return 0
  const diff = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b))
  if (diff <= 0.01) return 20
  if (diff <= 0.03) return 14
  if (diff <= 0.07) return 8
  return 0
}

function scoreModelo(modeloA, modeloB) {
  const a = compactarModelo(modeloA)
  const b = compactarModelo(modeloB)
  if (!a || !b) return 0
  if (a === b) return 45
  if (a.includes(b) || b.includes(a)) return 36
  const tokensA = new Set(normalizarTexto(modeloA).split(' ').filter(t => t.length >= 2))
  const tokensB = new Set(normalizarTexto(modeloB).split(' ').filter(t => t.length >= 2))
  const inter = [...tokensA].filter(t => tokensB.has(t)).length
  const union = new Set([...tokensA, ...tokensB]).size || 1
  return Math.round((inter / union) * 24)
}

function scoreFabricante(fabA, fabB) {
  const a = normalizarTexto(fabA)
  const b = normalizarTexto(fabB)
  if (!a || !b) return 0
  if (a === b) return 30
  if (a.includes(b) || b.includes(a)) return 24
  return 0
}

export function encontrarMatch(entrada, equipamentos, options = {}) {
  const threshold = options.threshold ?? 55
  const desconhecidoThreshold = options.desconhecidoThreshold ?? 70
  const candidatos = equipamentos.filter(e => e.tipo === entrada.tipo)
  let melhor = null

  for (const equipamento of candidatos) {
    const atualDesconhecido = isUnknown(equipamento.fabricante) || isUnknown(equipamento.modelo)
    const score =
      scoreFabricante(entrada.fabricante, equipamento.fabricante) +
      scoreModelo(entrada.modelo, equipamento.modelo) +
      scoreModelo(entrada.modelo, equipamento.identificacao?.modelo_normalizado) +
      scorePotencia(potenciaPrincipal({ tipo: entrada.tipo, specs_canonicas: entrada.specs_canonicas }), potenciaPrincipal(equipamento))

    const aliases = equipamento.identificacao?.aliases || []
    const aliasScore = aliases.reduce((acc, alias) => Math.max(acc, scoreModelo(entrada.modelo, alias)), 0)
    const total = Math.min(100, score + aliasScore)

    if (!melhor || total > melhor.score) {
      melhor = { equipamento, score: total, atualDesconhecido }
    }
  }

  if (!melhor) return null
  const minimo = melhor.atualDesconhecido ? desconhecidoThreshold : threshold
  if (melhor.score < minimo) return null
  return melhor
}

function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function mergeSpecsIncremental(existentes = {}, extraidas = {}, camposPermitidos = []) {
  const merged = deepClone(existentes || {}) || {}
  const conflitos = []
  const preenchidos = []

  for (const campo of camposPermitidos) {
    const novo = extraidas?.[campo]
    if (novo === null || novo === undefined || novo === '') continue
    const atual = merged?.[campo]

    if (atual === null || atual === undefined || atual === '') {
      merged[campo] = novo
      preenchidos.push(campo)
      continue
    }

    const atualJson = JSON.stringify(atual)
    const novoJson = JSON.stringify(novo)
    if (atualJson !== novoJson) {
      conflitos.push({ campo, atual, extraido: novo })
    }
  }

  if (!merged._versao) merged._versao = '1.0'
  return { merged, preenchidos, conflitos }
}

function equipamentoShadow(equipamento, entrada, specsMerged, identidade) {
  const especificacoes = { ...(specsMerged || {}) }
  return {
    ...equipamento,
    fabricante: identidade.fabricante,
    modelo: identidade.modelo,
    origem: { tipo: 'datasheet_gemini', fonte: entrada.fonte?.arquivo, em: new Date() },
    especificacoes,
    specs_canonicas: specsMerged,
  }
}

function montarIdentificacao(equipamento, entrada, identidade) {
  const aliases = new Set([
    ...(Array.isArray(equipamento.identificacao?.aliases) ? equipamento.identificacao.aliases : []),
    equipamento.modelo,
    entrada.modelo,
    entrada.fonte?.nome_arquivo,
  ].filter(Boolean))

  return {
    ...(equipamento.identificacao || {}),
    fabricante_normalizado: normalizarTexto(identidade.fabricante),
    modelo_normalizado: normalizarTexto(identidade.modelo),
    aliases: [...aliases].slice(0, 30),
  }
}

export function montarAtualizacaoIncremental(equipamento, entrada, options = {}) {
  const camposPermitidos = CAMPOS_POR_TIPO[entrada.tipo] || []
  const before = {
    fabricante: equipamento.fabricante,
    modelo: equipamento.modelo,
    specs_canonicas: deepClone(equipamento.specs_canonicas || null),
    qualidade: deepClone(equipamento.qualidade || null),
    identificacao: deepClone(equipamento.identificacao || null),
    origem: deepClone(equipamento.origem || null),
  }

  const merge = mergeSpecsIncremental(equipamento.specs_canonicas || {}, entrada.specs_canonicas || {}, camposPermitidos)
  const identidade = {
    fabricante: isUnknown(equipamento.fabricante) && !isUnknown(entrada.fabricante)
      ? entrada.fabricante
      : equipamento.fabricante,
    modelo: isUnknown(equipamento.modelo) && !isUnknown(entrada.modelo)
      ? entrada.modelo
      : equipamento.modelo,
  }

  const planoValidacao = {
    tipo: entrada.tipo,
    fabricante: identidade.fabricante,
    modelo: identidade.modelo,
    _tem_especificacoes_originais: true,
    ...merge.merged,
  }
  const alertasExtraidos = aplicarRegras(planoValidacao)
  const temCritico = alertasExtraidos.some(alerta => alerta.severidade === 'critico')
  if (temCritico && !options.aplicarMesmoComCritico) {
    return {
      aplicar: false,
      motivo: 'validacao_critica',
      conflitos: merge.conflitos,
      preenchidos: merge.preenchidos,
      alertas: alertasExtraidos,
      before,
    }
  }

  const shadow = equipamentoShadow(equipamento, entrada, merge.merged, identidade)
  const resultadoQualidade = processarEquipamento(shadow, {
    tipoEvento: 'reprocessamento_gemini',
    por: 's2.6.2_datasheets',
    observacao: `Enriquecimento incremental via ${entrada.fonte?.nome_arquivo || 'datasheet'}`,
  })
  const identificacao = montarIdentificacao(equipamento, entrada, identidade)
  const qualidade = resultadoQualidade.qualidade
  const statusOperacional = resultadoQualidade.status_operacional

  const camposAlterados = [
    ...merge.preenchidos.map(campo => `specs_canonicas.${campo}`),
  ]
  if (identidade.fabricante !== equipamento.fabricante) camposAlterados.push('fabricante')
  if (identidade.modelo !== equipamento.modelo) camposAlterados.push('modelo')
  if (camposAlterados.length === 0) return {
    aplicar: false,
    motivo: 'sem_campos_novos',
    conflitos: merge.conflitos,
    preenchidos: merge.preenchidos,
    alertas: alertasExtraidos,
    before,
  }

  const after = {
    fabricante: identidade.fabricante,
    modelo: identidade.modelo,
    specs_canonicas: merge.merged,
    qualidade,
    identificacao,
    origem: {
      tipo: 'datasheet_gemini',
      fonte: entrada.fonte?.arquivo || null,
      arquivo_original_url: entrada.fonte?.arquivo || null,
      em: new Date(),
    },
  }

  const set = {
    specs_canonicas: merge.merged,
    identificacao,
    qualidade,
    status_operacional: statusOperacional,
    origem: after.origem,
    _schema_versao: '2.0',
  }

  if (identidade.fabricante !== equipamento.fabricante) set.fabricante = identidade.fabricante
  if (identidade.modelo !== equipamento.modelo) set.modelo = identidade.modelo

  return {
    aplicar: true,
    set,
    push: {
      'validacao.historico': {
        $each: [{
          em: new Date(),
          tipo: 'reprocessamento_gemini',
          por: 's2.6.2_datasheets',
          antes: before,
          depois: after,
          campos_alterados: camposAlterados,
          observacao: `Enriquecimento incremental via datasheet: ${entrada.fonte?.nome_arquivo || ''}`,
        }],
        $slice: -50,
      },
    },
    conflitos: merge.conflitos,
    preenchidos: merge.preenchidos,
    alertas: alertasExtraidos,
    before,
    after,
  }
}

export const _internals = {
  asNumber,
  parseDimensoes,
  splitRange,
  potenciaPrincipal,
  mergeSpecsIncremental,
  CAMPOS_POR_TIPO,
}
