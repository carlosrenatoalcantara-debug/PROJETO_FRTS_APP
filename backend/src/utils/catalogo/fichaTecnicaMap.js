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
    'Identificação': [
      ['__fabricante', 'Fabricante'],
      ['__modelo', 'Modelo'],
      ['__tipo', 'Tipo'],
      ['linha', 'Linha'],
    ],
    'Entrada CC': [
      ['voc_max', 'Voc máxima', 'V'],
      ['faixa_mppt_min', 'MPPT mín', 'V'],
      ['faixa_mppt_max', 'MPPT máx', 'V'],
      ['mppts', 'Nº MPPT'],
      ['strings_por_mppt', 'Strings/MPPT'],
      ['corrente_max_mppt', 'Corrente MPPT', 'A'],
      ['corrente_curto_mppt', 'Isc máxima', 'A'],
      ['potencia_cc_max', 'Pot. CC máx', 'kW'],
      ['tensao_partida', 'Tensão partida', 'V'],
    ],
    'Saída CA': [
      ['potencia', 'Pot. nominal', 'kW'],
      ['potencia_max', 'Pot. máxima', 'kW'],
      ['corrente_max', 'Corrente nominal', 'A'],
      ['tensao_saida', 'Tensão nominal', 'V'],
      ['frequencia', 'Frequência', 'Hz'],
      ['fases', 'Fases'],
    ],
    'Eficiência': [
      ['eficiencia', 'Eficiência máxima', '%'],
      ['eficiencia_europeia', 'Eficiência europeia', '%'],
    ],
    'Garantia': [
      ['garantia', 'Produto', 'anos'],
      ['garantia_performance', 'Eficiência', 'anos'],
      ['garantia_observacoes', 'Observações'],
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
      const valor = chave.startsWith('__') ? _valorTopo(eq, chave) : esp[chave]
      const prov = chave.startsWith('__') ? { fonte: 'Manual', confianca: 1 } : _proveniencia(eq, chave)
      const ausente = valor == null || valor === '' || (Array.isArray(valor) && valor.length === 0)
      return {
        chave,
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
