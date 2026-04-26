// Importador de dados SolarMarket
// Busca todos os equipamentos da API SolarMarket e salva no catálogo local

const API_KEY = process.env.SOLARMARKET_API_KEY
const API_URL = process.env.SOLARMARKET_API_URL || 'https://api.solarmarket.com.br'

export async function importarCatalogoDeSolarMarket() {
  const resultado = {
    fabricantes: { novo: 0, atualizado: 0, erro: 0 },
    modulos: { novo: 0, atualizado: 0, erro: 0 },
    inversores: { novo: 0, atualizado: 0, erro: 0 },
    estruturas: { novo: 0, atualizado: 0, erro: 0 },
    erros: [],
    iniciado: new Date(),
  }

  try {
    console.log('[SolarMarket] Iniciando importação...')

    // 1. Importar Módulos (Painéis)
    console.log('[SolarMarket] Buscando módulos...')
    const modulos = await buscarModulosSolarMarket()
    for (const modulo of modulos) {
      try {
        const res = await salvarModuloLocal(modulo)
        if (res.novo) resultado.modulos.novo++
        else resultado.modulos.atualizado++
      } catch (err) {
        resultado.modulos.erro++
        resultado.erros.push(`Módulo ${modulo.modelo}: ${err.message}`)
      }
    }

    // 2. Importar Inversores
    console.log('[SolarMarket] Buscando inversores...')
    const inversores = await buscarInversoresSolarMarket()
    for (const inversor of inversores) {
      try {
        const res = await salvarInversorLocal(inversor)
        if (res.novo) resultado.inversores.novo++
        else resultado.inversores.atualizado++
      } catch (err) {
        resultado.inversores.erro++
        resultado.erros.push(`Inversor ${inversor.modelo}: ${err.message}`)
      }
    }

    // 3. Importar Estruturas
    console.log('[SolarMarket] Buscando estruturas...')
    const estruturas = await buscarEstruturassSolarMarket()
    for (const estrutura of estruturas) {
      try {
        const res = await salvarEstruturaLocal(estrutura)
        if (res.novo) resultado.estruturas.novo++
        else resultado.estruturas.atualizado++
      } catch (err) {
        resultado.estruturas.erro++
        resultado.erros.push(`Estrutura ${estrutura.tipo}: ${err.message}`)
      }
    }

    resultado.finalizado = new Date()
    resultado.sucesso = true

    console.log('[SolarMarket] Importação concluída!')
    console.log(`  Módulos: ${resultado.modulos.novo} novos, ${resultado.modulos.atualizado} atualizados`)
    console.log(`  Inversores: ${resultado.inversores.novo} novos, ${resultado.inversores.atualizado} atualizados`)
    console.log(`  Estruturas: ${resultado.estruturas.novo} novos, ${resultado.estruturas.atualizado} atualizados`)

    return resultado
  } catch (err) {
    resultado.sucesso = false
    resultado.erro = err.message
    resultado.finalizado = new Date()
    console.error('[SolarMarket] Erro na importação:', err)
    return resultado
  }
}

// ─────────────────────────────────────────────────────────────────────────

async function buscarModulosSolarMarket() {
  const url = `${API_URL}/modulos?api_key=${API_KEY}&limit=1000`
  console.log(`[SolarMarket] GET ${url}`)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const dados = await res.json()
  return (dados.data || dados.modulos || []).map(transformarModuloDeSolarMarket)
}

async function buscarInversoresSolarMarket() {
  const url = `${API_URL}/inversores?api_key=${API_KEY}&limit=1000`
  console.log(`[SolarMarket] GET ${url}`)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const dados = await res.json()
  return (dados.data || dados.inversores || []).map(transformarInversorDeSolarMarket)
}

async function buscarEstruturassSolarMarket() {
  const url = `${API_URL}/estruturas?api_key=${API_KEY}&limit=1000`
  console.log(`[SolarMarket] GET ${url}`)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const dados = await res.json()
  return (dados.data || dados.estruturas || []).map(transformarEstruturaDeSolarMarket)
}

// ─────────────────────────────────────────────────────────────────────────

function transformarModuloDeSolarMarket(sm) {
  return {
    marca: sm.marca || sm.fabricante || 'Desconhecido',
    modelo: sm.modelo || sm.nome,
    pmpp: parseInt(sm.potencia || sm.pmpp || 0),
    voc: parseFloat(sm.voc || 0),
    vmpp: parseFloat(sm.vmpp || 0),
    isc: parseFloat(sm.isc || 0),
    impp: parseFloat(sm.impp || 0),
    tempCoefVoc: parseFloat(sm.tempCoefVoc || -0.28),
    tempCoefPmpp: parseFloat(sm.tempCoefPmpp || -0.35),
    tempCoefIsc: parseFloat(sm.tempCoefIsc || 0.048),
    area: parseFloat(sm.area || 0),
    eficiencia: parseFloat(sm.eficiencia || 0),
    garantiaProduto: parseInt(sm.garantiaProduto || 12),
    garantiaPerformance: parseInt(sm.garantiaPerformance || 25),
    percentualPerformance: parseFloat(sm.percentualPerformance || 80),
    precoUnitario: parseFloat(sm.preco || 0),
    solarmarketId: sm.id,
    importadoEm: new Date(),
  }
}

function transformarInversorDeSolarMarket(sm) {
  return {
    marca: sm.marca || sm.fabricante || 'Desconhecido',
    modelo: sm.modelo || sm.nome,
    tipoInversor: sm.tipo || 'string',
    faseAC: parseInt(sm.fases || 1),
    potenciaKW: parseFloat(sm.potencia || 0),
    nMppts: parseInt(sm.mppts || 2),
    nStringsTotal: parseInt(sm.strings || 4),
    vocMax: parseInt(sm.vocMax || 1000),
    mpptMin: parseInt(sm.mpptMin || 80),
    mpptMax: parseInt(sm.mpptMax || 950),
    imaxMppt: parseFloat(sm.imaxMppt || 15),
    garantia: parseInt(sm.garantia || 10),
    precoUnitario: parseFloat(sm.preco || 0),
    solarmarketId: sm.id,
    importadoEm: new Date(),
  }
}

function transformarEstruturaDeSolarMarket(sm) {
  return {
    tipo: sm.tipo || sm.nome || 'Genérica',
    descricao: sm.descricao || '',
    compatibilidade: sm.compatibilidade || 'Universal',
    garantia: parseInt(sm.garantia || 10),
    precoUnitario: parseFloat(sm.preco || 0),
    solarmarketId: sm.id,
    importadoEm: new Date(),
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Funções stub para salvar localmente
// Em produção, substituir com chamadas ao banco de dados real

async function salvarModuloLocal(modulo) {
  // Mock: simular salvar no banco
  // Em produção: INSERT/UPDATE no BD
  return { novo: Math.random() > 0.5, atualizado: Math.random() <= 0.5 }
}

async function salvarInversorLocal(inversor) {
  return { novo: Math.random() > 0.5, atualizado: Math.random() <= 0.5 }
}

async function salvarEstruturaLocal(estrutura) {
  return { novo: Math.random() > 0.5, atualizado: Math.random() <= 0.5 }
}
