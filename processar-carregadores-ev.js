#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const API_URL = 'https://projetofrtsapp-production.up.railway.app'
const DATASHEETS_DIR = 'C:\\Users\\Forte Solar\\OneDrive\\Área de Trabalho\\Carregador EV'

async function extrairDatasheet(caminhoArquivo) {
  const nomeArquivo = path.basename(caminhoArquivo)
  try {
    const dados = fs.readFileSync(caminhoArquivo)
    const fd = new FormData()
    const blob = new Blob([dados], { type: 'application/pdf' })
    fd.append('pdf', blob, nomeArquivo)

    const res = await fetch(`${API_URL}/api/datasheet/extrair-datasheet`, {
      method: 'POST',
      body: fd,
    })

    const texto = await res.text()
    let json = JSON.parse(texto)
    return json.dados || json
  } catch (err) {
    console.error(`  ❌ Erro ao extrair ${nomeArquivo}:`, err.message)
    return null
  }
}

async function salvarEquipamento(dados) {
  try {
    const payload = {
      tipo: 'carregador_ev',
      fabricante: dados.fabricante || 'Desconhecido',
      modelo: dados.modelo || 'Carregador EV',
      preco_sugerido: 0,
      ...(dados.garantia_anos ? { garantia_produto: { value: dados.garantia_anos, unit: 'anos' } } : {}),
      especificacoes: {
        potencia_kw: dados.potencia_nominal_kw || dados.potenciaKW || null,
        potencia_maxima_kw: dados.potencia_maxima_kw || null,
        tensao_entrada_ac: dados.tensao_ac || dados.tensao_ac_nominal || null,
        fases_entrada: dados.fases || dados.faseAC || null,
        frequencia_hz: dados.frequencia_hz || null,
        corrente_entrada_max: dados.corrente_ac_saida || dados.correnteACSaida || null,
        fator_potencia: dados.fator_potencia || null,
        tensao_saida_dc: dados.tensao_nominal_cc || null,
        tensao_saida_min: dados.tensao_mppt_min || dados.tensaoMpptMin || null,
        tensao_saida_max: dados.tensao_mppt_max || dados.tensaoMpptMax || null,
        corrente_saida_max: dados.corrente_max_entrada || null,
        tipos_conector: dados.tipos_conector || null,
        tipo_carregador: dados.tipo_carregador || 'CA' || null,
        grau_protecao_ip: dados.grau_protecao_ip || null,
        protecao_sobretensao: dados.protecao_sobretensao_ac || null,
        protecao_sobrecorrente: dados.protecao_sobrecorrente || null,
        eficiencia: dados.eficiencia_maxima || dados.eficiencia || null,
        temperatura_operacao: dados.temperatura_operacao || null,
        peso_kg: dados.peso_kg || null,
        dimensoes: dados.dimensoes || null,
        garantia_anos: dados.garantia_anos || null,
      },
    }

    // Remover campos nulos
    Object.keys(payload.especificacoes).forEach(k => {
      if (payload.especificacoes[k] === null) delete payload.especificacoes[k]
    })

    const res = await fetch(`${API_URL}/api/equipamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    return await res.json()
  } catch (err) {
    throw err
  }
}

async function processarCarregadores() {
  console.log('🚀 PROCESSAMENTO AUTÔNOMO - CARREGADORES EV')
  console.log('===========================================')
  console.log('')

  const arquivos = fs.readdirSync(DATASHEETS_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(DATASHEETS_DIR, f))

  console.log(`📦 Encontrados ${arquivos.length} datasheets`)
  console.log('')

  let salvos = 0
  let erros = 0

  for (const arquivo of arquivos) {
    const nome = path.basename(arquivo)
    process.stdout.write(`📄 ${nome}: `)

    const dados = await extrairDatasheet(arquivo)
    if (!dados) {
      erros++
      console.log('❌ Falha na extração')
      continue
    }

    try {
      const resultado = await salvarEquipamento(dados)
      console.log(`✅ Salvo (${dados.fabricante || 'Desconhecido'} ${dados.modelo || 'Carregador'})`)
      salvos++
    } catch (err) {
      console.log(`❌ Erro ao salvar: ${err.message}`)
      erros++
    }
  }

  console.log('')
  console.log('📋 RESUMO')
  console.log('=========')
  console.log(`✅ Salvos: ${salvos}`)
  console.log(`❌ Erros: ${erros}`)
  console.log(`📊 Total: ${arquivos.length}`)
}

processarCarregadores().catch(console.error)
