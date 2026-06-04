/**
 * fichaTecnicaMap.js — Sprint 8.6
 * Helper PURO: transforma um Equipamento bruto (`especificacoes` Mixed +
 * `fonte_dados` mapa + `documentos_tecnicos`) em uma FICHA TÉCNICA COMPLETA
 * agrupada (Identificação / Entrada CC / Saída CA / Eficiência / Garantia /
 * Certificações), com `{ valor, fonte, confianca, ausente }` por campo.
 *
 * Filosofia: a UI consome apenas este mapa — sem regex spread pelos JSX.
 * Mesmo arquivo é importável do frontend (relative path) p/ ter contrato único.
 *
 * Causa raiz do bug "card vazio" (8.6): o card mostrava só 5 specs hardcoded.
 * Este mapa expõe TUDO que existe em `especificacoes`, incluindo certificações.
 */

// ── Definição dos grupos por tipo ──────────────────────────────────────────
// Cada entrada: [chave_especificacoes, rotulo, unidade?]
const GRUPOS_POR_TIPO = {
  modulo: {
    'Identificação': [
      ['__fabricante', 'Fabricante'],
      ['__modelo', 'Modelo'],
      ['__tipo', 'Tipo'],
      ['tecnologia', 'Tecnologia'],
      ['tipo_celula', 'N/P-Type'],
      ['bifacial', 'Bifacial'],
    ],
    'Elétrico STC': [
      ['potencia', 'Potência', 'Wp'],
      ['voc', 'Voc', 'V'],
      ['vmp', 'Vmp', 'V'],
      ['isc', 'Isc', 'A'],
      ['imp', 'Imp', 'A'],
    ],
    'Eficiência': [
      ['eficiencia', 'Eficiência', '%'],
    ],
    'Temperatura': [
      ['coef_temp_voc', 'Coef. Voc', '%/°C'],
      ['coef_temp_pmax', 'Coef. Pmax', '%/°C'],
      ['noct', 'NOCT', '°C'],
    ],
    'Físico': [
      ['comprimento', 'Comprimento', 'mm'],
      ['largura', 'Largura', 'mm'],
      ['espessura', 'Espessura', 'mm'],
      ['peso', 'Peso', 'kg'],
    ],
    'Garantia': [
      ['garantia_produto', 'Produto', 'anos'],
      ['garantia_performance', 'Desempenho', 'anos'],
      ['degradacao_anual', 'Degradação', '%/ano'],
    ],
    'Certificações': [], // preenchido dinamicamente abaixo
  },
  inversor: {
    // S8.6.3: cada slot aceita array de aliases. Lê o PRIMEIRO disponível.
    // Causa raiz das specs vazias: ModalNovoInversor salva com nomes do prompt
    // Claude (n_mppts, tensao_max_entrada, etc.); fichaTecnicaMap usava nomes
    // diferentes (mppts, voc_max, etc.) → todos os campos apareciam como ausentes.
    'Identificação': [
      ['__fabricante', 'Fabricante'],
      ['__modelo', 'Modelo'],
      ['__tipo', 'Tipo'],
      ['linha', 'Linha'],
      [['subtipo'], 'Subtipo'],   // microinversor | string
    ],
    'Entrada CC': [
      [['tipo_topologia'], 'Topologia'],
      [['tensao_max_entrada', 'voc_max', 'tensao_max_cc'], 'Tensão máx CC', 'V'],
      [['tensao_mppt_min', 'faixa_mppt_min'], 'MPPT mín', 'V'],
      [['tensao_mppt_max', 'faixa_mppt_max'], 'MPPT máx', 'V'],
      [['n_mppts', 'mppts', 'nMppts'], 'Nº MPPT'],
      [['entradas_por_mppt'], 'Entradas por MPPT'],
      [['strings_por_mppt'], 'Strings/MPPT'],
      [['corrente_max_por_mppt', 'corrente_max_mppt'], 'Corrente máx MPPT', 'A'],
      [['corrente_isc_max', 'corrente_curto_mppt'], 'Isc máxima', 'A'],
      [['potencia_max_entrada_cc', 'potencia_cc_max'], 'Pot. máx entrada CC', 'kW'],
      [['tensao_partida'], 'Tensão partida', 'V'],
      [['tensao_nominal_cc'], 'Tensão nominal CC', 'V'],
      [['corrente_max_entrada'], 'Corrente máx total', 'A'],
      [['faixa_operacao_cc'], 'Faixa operação CC'],
    ],
    'Saída CA': [
      [['potencia_kw', 'potencia_nominal_kw', 'potenciaKW', 'potencia'], 'Pot. nominal', 'kW'],
      [['potencia_maxima_kw', 'potencia_max'], 'Pot. máxima', 'kW'],
      [['potencia_aparente_kva'], 'Pot. aparente', 'kVA'],
      [['corrente_ac_saida', 'corrente_max'], 'Corrente CA', 'A'],
      [['tensao_ac', 'tensao_ac_nominal', 'tensao_saida'], 'Tensão nominal', 'V'],
      [['faixa_tensao_rede'], 'Faixa tensão rede'],
      [['frequencia_hz', 'frequencia'], 'Frequência', 'Hz'],
      [['faixa_frequencia_hz'], 'Faixa frequência'],
      [['fases', 'faseAC'], 'Fases'],
      [['tipo_conexao_rede'], 'Conexão rede'],
      [['fator_potencia'], 'Fator de potência'],
      [['thdi'], 'THDi', '%'],
    ],
    'Eficiência': [
      [['eficiencia_maxima', 'eficiencia'], 'Eficiência máxima', '%'],
      [['eficiencia_europeia'], 'Eficiência europeia', '%'],
      [['eficiencia_cec'], 'Eficiência CEC', '%'],
      [['eficiencia_mppt'], 'Eficiência MPPT', '%'],
    ],
    'Proteções e Mecânico': [
      [['protecao_antiilhamento'], 'Anti-ilhamento'],
      [['protecao_sobretensao_dc'], 'Sobretensão CC'],
      [['protecao_sobretensao_ac'], 'Sobretensão CA'],
      [['grau_protecao_ip'], 'Grau de proteção'],
      [['temperatura_operacao'], 'Temp. operação'],
      [['tipo_refrigeracao'], 'Refrigeração'],
      [['comunicacao'], 'Comunicação'],
      [['peso_kg'], 'Peso', 'kg'],
      [['dimensoes'], 'Dimensões'],
    ],
    'Garantia': [
      [['garantia_anos', 'garantia', 'garantia_produto'], 'Garantia', 'anos'],
      [['garantia_performance'], 'Garantia performance', 'anos'],
      [['garantia_observacoes'], 'Observações'],
    ],
    'Certificações': [],
  },
  bateria: {
    'Identificação': [['__fabricante', 'Fabricante'], ['__modelo', 'Modelo'], ['__tipo', 'Tipo']],
    'Energia': [
      ['capacidade_kwh', 'Capacidade', 'kWh'],
      ['tensao_nominal', 'Tensão nominal', 'V'],
      ['ciclos', 'Ciclos'],
      ['dod', 'DoD', '%'],
    ],
    'Garantia': [['garantia', 'Garantia', 'anos']],
    'Certificações': [],
  },
  carregador_ev: {
    'Identificação': [['__fabricante', 'Fabricante'], ['__modelo', 'Modelo'], ['__tipo', 'Tipo']],
    'Saída': [
      ['potencia', 'Potência', 'kW'],
      ['tensao', 'Tensão', 'V'],
      ['corrente', 'Corrente', 'A'],
      ['fases', 'Fases'],
      ['conector', 'Conector'],
    ],
    'Conectividade': [['ocpp', 'OCPP']],
    'Garantia': [['garantia', 'Garantia', 'anos']],
    'Certificações': [],
  },
  estrutura: {
    'Identificação': [['__fabricante', 'Fabricante'], ['__modelo', 'Modelo'], ['__tipo', 'Tipo']],
    'Especificações': [],
    'Certificações': [],
  },
}

const NORMAS_CONHECIDAS = [
  { tipo: 'inmetro',         rotulo: 'INMETRO' },
  { tipo: 'iec',             rotulo: 'IEC (geral)' },
  { tipo: 'iec_62116',       rotulo: 'IEC 62116' },
  { tipo: 'iec_61727',       rotulo: 'IEC 61727' },
  { tipo: 'iec_62109',       rotulo: 'IEC 62109' },
  { tipo: 'iec_61000',       rotulo: 'IEC 61000' },
  { tipo: 'abnt_nbr_16149',  rotulo: 'ABNT NBR 16149' },
  { tipo: 'abnt_nbr_16150',  rotulo: 'ABNT NBR 16150' },
  { tipo: 'datasheet',       rotulo: 'Datasheet' },
  { tipo: 'manual',          rotulo: 'Manual' },
  { tipo: 'garantia',        rotulo: 'Garantia' },
]

function _coletarCertificacoes(eq) {
  const out = []
  const docs = Array.isArray(eq?.documentos_tecnicos) ? eq.documentos_tecnicos : []
  const ja = new Set(docs.map((d) => String(d?.tipo || '').toLowerCase()))
  // INMETRO em campo dedicado
  const inm = eq?.certificacao?.inmetro?.numero
  if (inm) out.push({ tipo: 'inmetro', rotulo: 'INMETRO', valor: inm, status: 'valido', fonte: 'Manual' })
  // Normas IEC em mixed
  const iec = Array.isArray(eq?.certificacao?.normas_iec) ? eq.certificacao.normas_iec : []
  for (const n of iec) {
    out.push({ tipo: 'iec', rotulo: n?.norma || 'IEC', valor: n?.laboratorio || '✓', status: n?.validade ? 'valido' : 'pendente', fonte: 'Manual' })
  }
  // Documentos técnicos anexados (datasheet/inmetro/iec/...)
  for (const d of docs) {
    const tipo = String(d?.tipo || '').toLowerCase()
    if (tipo && !out.some((x) => x.tipo === tipo)) {
      const def = NORMAS_CONHECIDAS.find((n) => n.tipo === tipo) || { rotulo: tipo.toUpperCase() }
      out.push({ tipo, rotulo: def.rotulo, valor: d?.nome || '✓', status: 'valido', fonte: 'Datasheet' })
    }
  }
  // Normas esperadas que estão ausentes (sinaliza ❌)
  for (const n of NORMAS_CONHECIDAS) {
    if (['datasheet', 'manual', 'garantia'].includes(n.tipo)) continue
    if (ja.has(n.tipo)) continue
    if (out.some((x) => x.tipo === n.tipo)) continue
    out.push({ tipo: n.tipo, rotulo: n.rotulo, valor: null, status: 'ausente', fonte: null })
  }
  return out
}

function _valorTopo(eq, chave) {
  if (chave === '__fabricante') return eq?.fabricante ?? null
  if (chave === '__modelo')     return eq?.modelo ?? null
  if (chave === '__tipo')       return eq?.tipo ?? null
  return undefined
}

function _proveniencia(eq, chave) {
  const map = eq?.fonte_dados || {}
  const reg = map[chave] || {}
  return {
    fonte: reg.fonte || (reg.origem ? reg.origem : null),
    confianca: typeof reg.confianca === 'number' ? reg.confianca : null,
  }
}

/**
 * Monta a ficha técnica completa.
 * @param {object} eq  documento Equipamento (já com `especificacoes` populadas)
 * @returns {{ tipo, grupos: [{ titulo, campos: [{ chave, rotulo, valor, unidade, fonte, confianca, ausente }] }] }}
 */
/**
 * S8.6.3 — Lê o valor procurando em uma lista de aliases (chaves alternativas).
 * Devolve { valor, chaveUsada } da primeira que retornar um valor não-nulo.
 */
function _lerValor(eq, esp, chaves) {
  for (const k of chaves) {
    if (typeof k !== 'string') continue
    if (k.startsWith('__')) {
      const v = _valorTopo(eq, k)
      if (v != null && v !== '') return { valor: v, chaveUsada: k }
      continue
    }
    const v = esp[k]
    if (v != null && v !== '') return { valor: v, chaveUsada: k }
  }
  return { valor: null, chaveUsada: chaves[0] || null }
}

export function montarFichaTecnica(eq) {
  const tipo = eq?.tipo || 'modulo'
  const esp = eq?.especificacoes || {}
  const grupos = GRUPOS_POR_TIPO[tipo] || GRUPOS_POR_TIPO.modulo
  const saida = []

  for (const [titulo, lista] of Object.entries(grupos)) {
    if (titulo === 'Certificações') {
      saida.push({ titulo, campos: _coletarCertificacoes(eq) })
      continue
    }
    const campos = (lista || []).map(([chave, rotulo, unidade]) => {
      // S8.6.3: chave pode ser string ÚNICA (formato antigo) OU array de aliases.
      const chaves = Array.isArray(chave) ? chave : [chave]
      const { valor, chaveUsada } = _lerValor(eq, esp, chaves)
      const isTopo = String(chaveUsada || '').startsWith('__')
      const prov = isTopo ? { fonte: 'Manual', confianca: 1 } : _proveniencia(eq, chaveUsada)
      const ausente = valor == null || valor === '' || (Array.isArray(valor) && valor.length === 0)
      return {
        chave: chaveUsada,
        rotulo,
        valor: ausente ? null : valor,
        unidade: unidade || null,
        fonte: prov.fonte || (ausente ? null : (eq?.origem?.tipo === 'datasheet_gemini' ? 'Gemini' : 'PDF')),
        confianca: prov.confianca ?? (ausente ? 0 : 0.7),
        ausente,
      }
    })
    saida.push({ titulo, campos })
  }

  return { tipo, grupos: saida }
}

/** Resumo do diagnóstico (para Saúde do Catálogo): conta ausentes por grupo. */
export function diagnosticarFicha(eq) {
  const f = montarFichaTecnica(eq)
  let totalCampos = 0, ausentes = 0
  for (const g of f.grupos) {
    if (g.titulo === 'Certificações') continue
    for (const c of g.campos) {
      totalCampos++
      if (c.ausente) ausentes++
    }
  }
  const certs = (f.grupos.find((g) => g.titulo === 'Certificações')?.campos) || []
  const certificacoesValidas = certs.filter((c) => c.status === 'valido').length
  const esp = eq?.especificacoes || {}
  const temDocDatasheet = Array.isArray(eq?.documentos_tecnicos) && eq.documentos_tecnicos.some((d) => String(d?.tipo || '').toLowerCase() === 'datasheet')
  const semGarantia = !esp.garantia && !esp.garantia_produto && !eq?.garantia_produto?.value
  return {
    total_campos: totalCampos,
    campos_ausentes: ausentes,
    completude_pct: totalCampos > 0 ? Math.round(((totalCampos - ausentes) / totalCampos) * 100) : 0,
    certificacoes_validas: certificacoesValidas,
    certificacoes_ausentes: certs.filter((c) => c.status === 'ausente').length,
    sem_datasheet: !temDocDatasheet && !eq?.datasheet_original?.hash,
    sem_certificacao: certificacoesValidas === 0,
    sem_garantia: semGarantia,
  }
}

export const STATUS_APROVACAO = ['rascunho', 'pendente', 'aprovado', 'bloqueado']
