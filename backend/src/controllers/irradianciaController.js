import { obterIrradianciaLocal, calcularGeracaoComIrradiancia } from '../utils/nasaPowerAPI.js'

// 2026-11-24: era `131.44 / 365` = 0,36 (o comentário dizia 5,06). Valor genérico
// de Brasil, marcado `fonte: 'padrão'` — NÃO é do local; a UX nova não o adota.
const HSP_PADRAO = 5.06
const HSP_PADRAO_ANUAL = +(HSP_PADRAO * 365).toFixed(2)

export async function obterIrradiancia(req, res) {
  try {
    const { latitude, longitude, potenciaKWp } = req.query

    if (!latitude || !longitude) {
      return res.status(400).json({
        erro: 'Latitude e longitude obrigatórias',
      })
    }

    const lat = parseFloat(latitude)
    const lon = parseFloat(longitude)

    // Validar coordenadas
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({
        erro: 'Coordenadas inválidas',
      })
    }

    // Consultar NASA POWER
    const dados = await obterIrradianciaLocal(lat, lon)

    if (!dados) {
      // Fallback: usar HSP padrão
      return res.json({
        sucesso: true,
        hsp_dia: HSP_PADRAO,
        hsp_anual: HSP_PADRAO_ANUAL,
        latitude: lat,
        longitude: lon,
        fonte: 'padrão',
        mensagem: 'NASA POWER indisponível, usando valor padrão',
      })
    }

    // Se houver potência, calcular geração
    let geracaoEstimada = null
    if (potenciaKWp) {
      const kwp = parseFloat(potenciaKWp)
      if (!isNaN(kwp) && kwp > 0) {
        geracaoEstimada = calcularGeracaoComIrradiancia(kwp, dados.hsp_dia)
      }
    }

    res.json({
      sucesso: true,
      ...dados,
      fonte: 'nasa-power',
      geracao: geracaoEstimada,
    })
  } catch (err) {
    console.error('Erro ao obter irradiância:', err)
    res.status(500).json({ erro: err.message })
  }
}

export async function atualizarIrradianciaProjetoFV(req, res) {
  try {
    const { projetoId } = req.params
    const { latitude, longitude, potenciaKWp, hsp_customizado } = req.body

    if (!projetoId) {
      return res.status(400).json({ erro: 'ID do projeto obrigatório' })
    }

    // Se usuário forneceu HSP customizado, usar esse
    if (hsp_customizado && !isNaN(parseFloat(hsp_customizado))) {
      return res.json({
        sucesso: true,
        hsp_dia: parseFloat(hsp_customizado),
        hsp_anual: parseFloat((parseFloat(hsp_customizado) * 365).toFixed(2)),
        fonte: 'customizado',
        projetoId,
      })
    }

    if (!latitude || !longitude) {
      return res.status(400).json({ erro: 'Coordenadas obrigatórias' })
    }

    const lat = parseFloat(latitude)
    const lon = parseFloat(longitude)

    const dados = await obterIrradianciaLocal(lat, lon)

    if (!dados) {
      // Fallback
      return res.json({
        sucesso: true,
        hsp_dia: HSP_PADRAO,
        hsp_anual: HSP_PADRAO_ANUAL,
        latitude: lat,
        longitude: lon,
        fonte: 'padrão',
        projetoId,
      })
    }

    res.json({
      sucesso: true,
      ...dados,
      fonte: 'nasa-power',
      projetoId,
    })
  } catch (err) {
    console.error('Erro ao atualizar irradiância:', err)
    res.status(500).json({ erro: err.message })
  }
}
