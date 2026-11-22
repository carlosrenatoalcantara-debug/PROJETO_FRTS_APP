/**
 * Regras puras da conta de energia anexada ao cliente. Sem I/O.
 */
export const TAMANHO_MAXIMO_CONTA = 10 * 1024 * 1024 // 10 MB

export const MIMETYPES_CONTA = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

/**
 * Valida o arquivo recebido (formato do multer: { originalname, mimetype, size, buffer }).
 * @returns {{ ok: true } | { ok: false, status: number, codigo: string, mensagem: string }}
 */
export function validarArquivoConta(arquivo) {
  if (!arquivo || !arquivo.buffer || !arquivo.size) {
    return { ok: false, status: 400, codigo: 'ARQUIVO_AUSENTE', mensagem: 'Envie o arquivo da conta (campo "conta").' }
  }
  if (!MIMETYPES_CONTA.includes(arquivo.mimetype)) {
    return { ok: false, status: 415, codigo: 'FORMATO_INVALIDO', mensagem: 'A conta precisa ser PDF ou imagem (JPG, PNG, WEBP).' }
  }
  if (arquivo.size > TAMANHO_MAXIMO_CONTA) {
    return { ok: false, status: 413, codigo: 'ARQUIVO_GRANDE', mensagem: 'A conta passa de 10 MB. Envie um arquivo menor.' }
  }
  return { ok: true }
}

/** Visão pública da conta: metadados, nunca o conteúdo. */
export function resumoConta(doc) {
  const d = typeof doc?.toObject === 'function' ? doc.toObject() : (doc || {})
  return {
    _id: d._id,
    clienteId: d.clienteId,
    nome: d.nome,
    mimetype: d.mimetype,
    tamanho: d.tamanho,
    createdAt: d.createdAt ?? null,
    // Conta nova = só dados (sem arquivo). Conta antiga = arquivo original.
    tem_dados: contaTemDados(d.dados),
    tem_arquivo: !!d.document_path,
    numero_cliente: d.numero_cliente ?? d.dados?.numero_cliente ?? null,
    distribuidora: d.distribuidora ?? d.dados?.distribuidora ?? null,
  }
}

// ─── Conta como DADOS, não como arquivo ─────────────────────────────────────
//
// Decisão do operador: a conta de energia NÃO é guardada (nem o PDF, nem a
// imagem). Guarda-se o que ela diz, em poucos KB, e dele saem dois arquivos:
// um JSON (máquina) e um Markdown (leitura). Uma única fonte — `dados` — e os
// dois são derivados dela, então nunca divergem e nada é duplicado.
//
// O que entra é uma LISTA FECHADA. CPF/CNPJ fica de fora de propósito: já está
// no cadastro do cliente e não precisa de uma segunda cópia em outro lugar.

const CAMPOS_TEXTO = [
  // [chave no arquivo, chave na extração, tamanho máximo]
  ['nome_titular', 'nome', 200],
  ['numero_cliente', 'numeroCliente', 60],
  ['codigo_instalacao', 'codigoInstalacao', 60],
  ['distribuidora', 'distribuidora', 120],
  ['classificacao', 'classificacao', 60],
  ['subgrupo', 'subgrupo', 60],
  ['grupo_tarifario', 'grupoTarifario', 20],
  ['tipo_ligacao', 'tipoLigacao', 60],
  ['fase', 'fase', 30],
  ['endereco', 'endereco', 300],
  ['cep', 'cep', 20],
  ['cidade', 'cidade', 100],
  ['uf', 'estado', 2],
]
const CAMPOS_NUMERO = [
  ['tensao_v', 'tensao'],
  ['consumo_kwh', 'consumoKwh'],
  ['media_12_meses_kwh', 'mediaAnual'],
  ['valor_kwh', 'valorKwh'],
  ['valor_fatura_reais', 'valorR'],
]

const textoLimpo = (v, max) => {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const s = String(v).trim().slice(0, max)
  return s === '' ? null : s
}
const numeroValido = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Extração (`POST /api/fatura/extrair`) → `dados` da conta.
 * Só a lista fechada acima; campo ausente é OMITIDO (nunca 0 nem ''), UF com
 * 2 letras, histórico com no máximo 12 meses. Devolve `{}` se não sobrar nada.
 */
export function sanitizarDadosConta(extracao) {
  if (!extracao || typeof extracao !== 'object') return {}
  const dados = {}
  for (const [chave, origem, max] of CAMPOS_TEXTO) {
    // UF é validada INTEIRA (cortar "Rio Grande" em 2 letras fabricaria uma sigla).
    let v = textoLimpo(extracao[origem], chave === 'uf' ? 100 : max)
    if (v !== null && chave === 'uf') v = /^[A-Za-z]{2}$/.test(v) ? v.toUpperCase() : null
    if (v !== null) dados[chave] = v
  }
  for (const [chave, origem] of CAMPOS_NUMERO) {
    const n = numeroValido(extracao[origem])
    if (n !== null) dados[chave] = n
  }
  if (Array.isArray(extracao.historico12Meses)) {
    const hist = extracao.historico12Meses.slice(0, 12)
      .map((m) => ({ mes: textoLimpo(m?.mes, 12), consumo_kwh: numeroValido(m?.consumo) }))
      .filter((m) => m.mes !== null && m.consumo_kwh !== null)
    if (hist.length > 0) dados.historico_12_meses = hist
  }
  return dados
}

export const contaTemDados = (dados) => !!dados && typeof dados === 'object' && Object.keys(dados).length > 0

/** Serialização estável: mesma conta ⇒ mesmos bytes ⇒ mesmo hash (idempotência). */
export function jsonDaConta(conta) {
  const d = typeof conta?.toObject === 'function' ? conta.toObject() : (conta || {})
  return JSON.stringify({
    versao: 1,
    origem: 'conta_de_energia_extraida',
    criada_em: d.createdAt ? new Date(d.createdAt).toISOString() : null,
    dados: d.dados ?? {},
  }, null, 2)
}

const fmt = (v, un = '') => (v === undefined || v === null ? '—' : `${v}${un ? ` ${un}` : ''}`)

/** Leitura humana dos mesmos dados. */
export function markdownDaConta(conta) {
  const d = typeof conta?.toObject === 'function' ? conta.toObject() : (conta || {})
  const x = d.dados ?? {}
  const em = d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 10) : '—'
  const linhas = [
    `# Conta de energia${x.numero_cliente ? ` — UC ${x.numero_cliente}` : ''}`,
    '',
    `Dados extraídos da conta em ${em}. O arquivo original não é guardado.`,
    '',
    '## Titular e local',
    `- Titular: ${fmt(x.nome_titular)}`,
    `- Endereço: ${fmt(x.endereco)}`,
    `- Cidade / UF / CEP: ${[x.cidade, x.uf, x.cep].filter(Boolean).join(' / ') || '—'}`,
    '',
    '## Ligação',
    `- Distribuidora: ${fmt(x.distribuidora)}`,
    `- Unidade consumidora: ${fmt(x.numero_cliente)}`,
    `- Código da instalação: ${fmt(x.codigo_instalacao)}`,
    `- Classificação / subgrupo / grupo: ${[x.classificacao, x.subgrupo, x.grupo_tarifario].filter(Boolean).join(' / ') || '—'}`,
    `- Tipo de ligação: ${fmt(x.tipo_ligacao)}`,
    `- Fase: ${fmt(x.fase)}`,
    `- Tensão: ${fmt(x.tensao_v, 'V')}`,
    '',
    '## Consumo e tarifa',
    `- Consumo do mês: ${fmt(x.consumo_kwh, 'kWh')}`,
    `- Média dos últimos 12 meses: ${fmt(x.media_12_meses_kwh, 'kWh')}`,
    `- Tarifa: ${fmt(x.valor_kwh, 'R$/kWh')}`,
    `- Valor da fatura: ${fmt(x.valor_fatura_reais, 'R$')}`,
  ]
  if (Array.isArray(x.historico_12_meses) && x.historico_12_meses.length > 0) {
    linhas.push('', '## Histórico de consumo', '', '| Mês | kWh |', '|---|---:|')
    for (const m of x.historico_12_meses) linhas.push(`| ${m.mes} | ${m.consumo_kwh} |`)
  }
  return `${linhas.join('\n')}\n`
}
