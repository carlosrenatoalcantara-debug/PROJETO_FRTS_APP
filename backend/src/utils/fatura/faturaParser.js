/**
 * faturaParser.js — Sprint 8.5
 * Parser PURO de texto de fatura para o modelo universal. Não chama IA, não
 * acessa banco. Faz extração heurística + validação básica e devolve estrutura
 * normalizada com `{valor, fonte, confianca}` por campo.
 */
import { ALIASES, _normalizar, indiceDoPrimeiroAlias, temAlias } from './faturaAliases.js'

const MESES_PT = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

/** Cria um campo no formato universal {valor, fonte, confianca}. */
export function campo(valor, fonte = 'PDF', confianca = 0.7) {
  return { valor: valor ?? null, fonte, confianca: valor == null ? 0 : confianca }
}

// Extrai o primeiro número (suporta vírgula como decimal BR) próximo à posição `idx`.
// Tenta primeiro a forma BR COM separador de milhar (1.234,56); se não, número simples (8500 ou 850,5).
function _numProximo(texto, idx, janela = 80) {
  if (idx < 0) return null
  const trecho = texto.slice(idx, idx + janela)
  // BR com milhar exige PELO MENOS um separador para evitar capturar "850" em "8500".
  const m = trecho.match(/(\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?|\d+(?:,\d+)?)/)
  if (!m) return null
  const num = parseFloat(m[1].replace(/\s|\./g, '').replace(',', '.'))
  return Number.isFinite(num) ? num : null
}

/** Tipo de ligação por palavra-chave (monofásico/bifásico/trifásico). */
export function detectarLigacao(texto) {
  const t = _normalizar(texto)
  if (t.includes('trifasico')) return { tipo: 'trifasico', confianca: 0.95 }
  if (t.includes('bifasico')) return { tipo: 'bifasico', confianca: 0.95 }
  if (t.includes('monofasico')) return { tipo: 'monofasico', confianca: 0.95 }
  return { tipo: null, confianca: 0 }
}

/**
 * Extrai histórico de consumo (mínimo: tentar 12 meses).
 * Procura padrões: "JAN/26 450" | "FEV 26 480" | "Jan/2026 450".
 * Devolve array de { mes, ano, kwh } e flags { meses_repetidos, mes_zerado, historico_incompleto }.
 */
export function extrairHistorico(texto) {
  const t = String(texto || '')
  const regex = /\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[\/\s.-]?(\d{2,4})[^\d]{0,12}(\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?)/gi
  const itens = []
  let m
  while ((m = regex.exec(t)) !== null) {
    const mes = m[1].toUpperCase()
    let ano = m[2]
    if (ano.length === 2) ano = '20' + ano
    const kwh = parseFloat(m[3].replace(/\s|\./g, '').replace(',', '.'))
    if (Number.isFinite(kwh)) itens.push({ mes, ano: Number(ano), kwh })
    if (itens.length >= 24) break // limite segurança
  }

  // Deduplica (mes+ano) mantendo a primeira ocorrência (concessionária pode imprimir 2x).
  const chave = (x) => `${x.mes}/${x.ano}`
  const vistos = new Set()
  const dedup = []
  for (const it of itens) {
    const k = chave(it)
    if (!vistos.has(k)) { vistos.add(k); dedup.push(it) }
  }

  const meses_repetidos = itens.length !== dedup.length
  const mes_zerado = dedup.some((x) => x.kwh === 0)
  const historico_incompleto = dedup.length < 12

  return { itens: dedup, meses_repetidos, mes_zerado, historico_incompleto }
}

/** Estatísticas do histórico (média/maior/menor). */
export function analisarHistorico(itens) {
  const arr = (itens || []).map((x) => x.kwh).filter((n) => Number.isFinite(n))
  if (!arr.length) return { consumo_medio_12m: null, maior_consumo: null, menor_consumo: null }
  const soma = arr.reduce((s, n) => s + n, 0)
  return {
    consumo_medio_12m: Number((soma / arr.length).toFixed(2)),
    maior_consumo: Math.max(...arr),
    menor_consumo: Math.min(...arr),
  }
}

/** Detecta presença de GD/SCEE e estima energia injetada (se mencionada). */
export function detectarGD(texto) {
  const possui = temAlias(texto, 'gd')
  if (!possui) return { possui_gd: false, energia_injetada: null, alerta: null, confianca: 0.95 }
  // Tenta primeiro "injetada" (mais específico p/ GD); fallback "compensada".
  const t = String(texto || '')
  const numRe = '(\\d{1,3}(?:[.\\s]\\d{3})+(?:,\\d+)?|\\d+(?:,\\d+)?)'
  let m = t.match(new RegExp(`injetada[^\\d]{0,40}${numRe}`, 'i'))
  if (!m) m = t.match(new RegExp(`compensada[^\\d]{0,40}${numRe}`, 'i'))
  const injetada = m ? parseFloat(m[1].replace(/\s|\./g, '').replace(',', '.')) : null
  return {
    possui_gd: true,
    energia_injetada: Number.isFinite(injetada) ? injetada : null,
    alerta: 'GD detectada — NÃO usar energia injetada como consumo no dimensionamento.',
    confianca: injetada != null ? 0.85 : 0.7,
  }
}

/** Grupo A (clientes grandes): demanda contratada/medida/ponta + ultrapassagem + reativo. */
export function extrairGrupoA(texto) {
  const t = _normalizar(texto)
  const get = (alias) => _numProximo(t, indiceDoPrimeiroAlias(t, alias))
  const dadosA = {
    demanda_contratada: get('demanda_contratada'),
    demanda_medida:     get('demanda_medida'),
    demanda_ponta:      get('demanda_ponta'),
    demanda_fora_ponta: get('demanda_fora_ponta'),
    consumo_ponta:      get('consumo_ponta'),
    consumo_fora_ponta: get('consumo_fora_ponta'),
    energia_reativa:    get('energia_reativa'),
    fator_potencia:     get('fator_potencia'),
    ultrapassagem:      get('ultrapassagem'),
  }
  // Detecta modalidade (verde / azul).
  let modalidade = null
  if (t.includes('thb azul') || /\bmodalidade(?:\s+tarifaria)?\s+azul/.test(t)) modalidade = 'azul'
  else if (t.includes('thb verde') || /\bmodalidade(?:\s+tarifaria)?\s+verde/.test(t)) modalidade = 'verde'

  const ehGrupoA = Object.values(dadosA).some((v) => v != null) || /\bgrupo\s+a\b/.test(t)
  return { eh_grupo_a: ehGrupoA, modalidade, ...dadosA }
}

/**
 * Parser principal: recebe `texto` cru e devolve a estrutura FaturaEnergia normalizada.
 * Cada campo carrega {valor, fonte, confianca}. Não chama IA. Não acessa banco.
 *
 * @param {string} texto
 * @param {object} [opts] { fonte: 'PDF'|'OCR'|'Manual', concessionaria?: string }
 */
export function parsearFatura(texto, opts = {}) {
  const fonte = opts.fonte || 'PDF'
  const t = String(texto || '')
  const tnorm = _normalizar(t)

  const lig = detectarLigacao(t)
  const hist = extrairHistorico(t)
  const ana = analisarHistorico(hist.itens)
  const gd = detectarGD(t)
  const grpA = extrairGrupoA(t)

  const ucIdx = indiceDoPrimeiroAlias(tnorm, 'numero_uc')
  const numUcMatch = ucIdx >= 0 ? t.slice(ucIdx).match(/\b(\d{6,15})\b/) : null
  const numUc = numUcMatch ? numUcMatch[1] : null

  // Consumo atual (kWh) — próximo do alias.
  const consumoIdx = indiceDoPrimeiroAlias(tnorm, 'consumo_kwh')
  const consumoKwh = _numProximo(tnorm, consumoIdx)

  // CPF/CNPJ por regex (com ou sem máscara).
  const cpfCnpjMatch = t.match(/(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})/)
  const cpfCnpj = cpfCnpjMatch ? cpfCnpjMatch[1] : null

  // CEP.
  const cepMatch = t.match(/\b(\d{5})-?(\d{3})\b/)
  const cep = cepMatch ? `${cepMatch[1]}-${cepMatch[2]}` : null

  return {
    cliente: {
      nome:        campo(null, fonte, 0),    // melhor preenchido por Gemini ou linha rotulada
      cpf_cnpj:    campo(cpfCnpj, fonte, cpfCnpj ? 0.85 : 0),
      endereco:    campo(null, fonte, 0),
      cidade:      campo(null, fonte, 0),
      uf:          campo(null, fonte, 0),
      cep:         campo(cep, fonte, cep ? 0.9 : 0),
    },
    unidade_consumidora: {
      concessionaria: campo(opts.concessionaria || null, fonte, opts.concessionaria ? 0.9 : 0),
      numero_uc:      campo(numUc, fonte, numUc ? 0.85 : 0),
      conta_contrato: campo(null, fonte, 0),
      instalacao:     campo(numUc, fonte, numUc ? 0.6 : 0),
      medidor:        campo(null, fonte, 0),
    },
    classificacao: {
      grupo:                campo(grpA.eh_grupo_a ? 'A' : 'B', fonte, 0.7),
      subgrupo:             campo(null, fonte, 0),
      classe:               campo(null, fonte, 0),
      modalidade_tarifaria: campo(grpA.modalidade, fonte, grpA.modalidade ? 0.85 : 0),
    },
    ligacao: {
      tipo:            campo(lig.tipo, fonte, lig.confianca),
      tensao_nominal:  campo(null, fonte, 0),
    },
    historico_consumo: hist.itens,
    analise: ana,

    grupo_a: grpA.eh_grupo_a ? {
      demanda_contratada: campo(grpA.demanda_contratada, fonte, grpA.demanda_contratada != null ? 0.8 : 0),
      demanda_medida:     campo(grpA.demanda_medida, fonte, grpA.demanda_medida != null ? 0.8 : 0),
      consumo_ponta:      campo(grpA.consumo_ponta, fonte, grpA.consumo_ponta != null ? 0.8 : 0),
      consumo_fora_ponta: campo(grpA.consumo_fora_ponta, fonte, grpA.consumo_fora_ponta != null ? 0.8 : 0),
      demanda_ponta:      campo(grpA.demanda_ponta, fonte, grpA.demanda_ponta != null ? 0.8 : 0),
      demanda_fora_ponta: campo(grpA.demanda_fora_ponta, fonte, grpA.demanda_fora_ponta != null ? 0.8 : 0),
      energia_reativa:    campo(grpA.energia_reativa, fonte, grpA.energia_reativa != null ? 0.7 : 0),
      fator_potencia:     campo(grpA.fator_potencia, fonte, grpA.fator_potencia != null ? 0.7 : 0),
      ultrapassagem:      campo(grpA.ultrapassagem, fonte, grpA.ultrapassagem != null ? 0.7 : 0),
      modalidade:         campo(grpA.modalidade, fonte, grpA.modalidade ? 0.85 : 0),
    } : null,

    geracao_existente: {
      possui_gd:        campo(gd.possui_gd, fonte, gd.confianca),
      energia_injetada: campo(gd.energia_injetada, fonte, gd.energia_injetada != null ? gd.confianca : 0),
      creditos:         campo(null, fonte, 0),
      compensacao:      campo(null, fonte, 0),
      alerta:           gd.alerta,
    },

    consumo_atual_kwh: campo(consumoKwh, fonte, consumoKwh != null ? 0.75 : 0),

    flags: {
      meses_repetidos: hist.meses_repetidos,
      mes_zerado: hist.mes_zerado,
      historico_incompleto: hist.historico_incompleto,
      possui_gd: gd.possui_gd,
      grupo_a: grpA.eh_grupo_a,
    },
  }
}
