const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

// ── campos adicionais (tipo_consumo, horario_pico, consumo_noturno, confiabilidade) ──
function adicionarCamposClassificacao(media, fonte) {
  let tipo_consumo
  if (media < 500) tipo_consumo = 'residencial'
  else if (media <= 3000) tipo_consumo = 'comercial'
  else tipo_consumo = 'industrial'

  const proporcoeNoturno = {
    residencial: 0.35,
    comercial: 0.15,
    industrial: 0.50,
  }

  const confiabilidade = fonte === 'conta' ? 'alta' : 'media'

  return {
    tipo_consumo,
    horario_pico: '18h-22h',
    consumo_noturno: Math.round(media * proporcoeNoturno[tipo_consumo]),
    confiabilidade,
  }
}

// ── tipo: 'conta' ─────────────────────────────────────────────────────────────
function analisarConta(body) {
  const { consumo_mensal } = body

  if (!Array.isArray(consumo_mensal) || consumo_mensal.length === 0)
    throw new Error('Forneça consumo_mensal como array de valores mensais (kWh).')

  const vals = consumo_mensal.map(Number).filter(v => !isNaN(v) && v >= 0)
  if (!vals.length) throw new Error('Nenhum valor de consumo válido encontrado.')

  // Preenche até 12 meses se incompleto
  while (vals.length < 12) vals.push(vals[vals.length - 1] ?? 0)

  const perfil   = vals.slice(0, 12)
  const media    = +(perfil.reduce((a, b) => a + b, 0) / perfil.length).toFixed(0)
  const maximo   = Math.max(...perfil)

  return {
    fonte:           'conta',
    potencia_media:  media,
    potencia_maxima: maximo,
    perfil:          MESES.map((m, i) => ({ mes: m, consumo: perfil[i] })),
    ...adicionarCamposClassificacao(media, 'conta'),
  }
}

// ── tipo: 'csv' ───────────────────────────────────────────────────────────────
function analisarCSV(body) {
  const { conteudo_csv } = body
  if (!conteudo_csv) throw new Error('Forneça conteudo_csv com o texto do arquivo.')

  const linhas = conteudo_csv
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  const consumos = []
  for (const linha of linhas) {
    const partes = linha.split(/[,;|\t]/).map(p => p.trim())
    if (partes.length >= 2) {
      const val = parseFloat(partes[partes.length - 1].replace(',', '.'))
      if (!isNaN(val) && val >= 0) consumos.push(val)
    }
  }

  if (!consumos.length) throw new Error('Nenhum valor de consumo extraído do CSV.')

  while (consumos.length < 12) consumos.push(consumos[consumos.length - 1] ?? 0)

  const perfil = consumos.slice(0, 12)
  const media  = +(perfil.reduce((a, b) => a + b, 0) / perfil.length).toFixed(0)
  const maximo = Math.max(...perfil)

  return {
    fonte:           'csv',
    potencia_media:  media,
    potencia_maxima: maximo,
    perfil:          MESES.map((m, i) => ({ mes: m, consumo: perfil[i] })),
    ...adicionarCamposClassificacao(media, 'csv'),
  }
}

// ── controlador principal ─────────────────────────────────────────────────────
export function analisarCarga(req, res) {
  try {
    const { tipo } = req.body
    if (!tipo) return res.status(400).json({ erro: 'Campo "tipo" obrigatório: conta | csv' })

    let resultado
    switch (tipo) {
      case 'conta': resultado = analisarConta(req.body); break
      case 'csv':   resultado = analisarCSV(req.body);   break
      default:
        return res.status(400).json({ erro: `Tipo "${tipo}" inválido. Use: conta | csv` })
    }

    res.json(resultado)
  } catch (e) {
    res.status(422).json({ erro: e.message })
  }
}
