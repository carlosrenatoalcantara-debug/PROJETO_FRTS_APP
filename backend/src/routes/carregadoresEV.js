import { Router } from 'express'
import { CarregadorEV } from '../models/CarregadorEV.js'
import {
  processarDatasheetEV,
  normalizarDadosEV,
  validarDadosEV,
} from '../controllers/carregadorEVController.js'

const router = Router()

// Obter todos
router.get('/', async (req, res) => {
  try {
    const { tipo, potencia, ativo } = req.query
    const filtro = { ativo: ativo !== 'false' }
    if (tipo) filtro.tipo = tipo
    if (potencia) filtro.potencia_kw = Number(potencia)

    const carregadores = await CarregadorEV.find(filtro).sort({ tipo: 1, potencia_kw: 1 })
    res.json(carregadores)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

// Obter um
router.get('/:id', async (req, res) => {
  try {
    const carregador = await CarregadorEV.findById(req.params.id)
    if (!carregador) return res.status(404).json({ erro: 'Não encontrado' })
    res.json(carregador)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

// Criar
router.post('/', async (req, res) => {
  try {
    const carregador = new CarregadorEV(req.body)
    await carregador.save()
    res.status(201).json(carregador)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})

// Atualizar
router.put('/:id', async (req, res) => {
  try {
    const carregador = await CarregadorEV.findByIdAndUpdate(req.params.id, req.body, { new: true })
    res.json(carregador)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})

// Deletar
router.delete('/:id', async (req, res) => {
  try {
    await CarregadorEV.findByIdAndDelete(req.params.id)
    res.json({ sucesso: true })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

// Seed - Carregar banco inicial
router.post('/seed/inicializar', async (req, res) => {
  try {
    const count = await CarregadorEV.countDocuments()
    if (count > 0) return res.json({ msg: 'Banco já inicializado' })

    const carregadores = [
      // AC Monofásico
      { tipo: 'AC_Mono', potencia_kw: 3.6, marca: 'Wallbox', modelo: 'Pulsar Plus', numero_fases: 1, tensao_entrada_v: 220, corrente_entrada_a: 16, eficiencia_pct: 93, fator_potencia: 0.99, grau_protecao_ip: 'IP54', temperatura_operacao: '-30 a 50°C', peso_kg: 6, dimensoes_mm: '650x204x99', protocolo_carregamento: 'IEC 61851', tipo_carregamento: 'Type 2', tempo_carga_rapida_min: 240, tipo_conector: 'Type 2', comunicacao: 'OCPP', disjuntor_recomendado_a: 20, dr_recomendado_ma: 30, bitola_cabo_minima_mm2: 2.5, garantia_anos: 5 },
      { tipo: 'AC_Mono', potencia_kw: 7.4, marca: 'Wallbox', modelo: 'Pulsar Plus', numero_fases: 1, tensao_entrada_v: 220, corrente_entrada_a: 32, eficiencia_pct: 94, fator_potencia: 0.99, grau_protecao_ip: 'IP54', temperatura_operacao: '-30 a 50°C', peso_kg: 6, dimensoes_mm: '650x204x99', protocolo_carregamento: 'IEC 61851', tipo_carregamento: 'Type 2', tempo_carga_rapida_min: 120, tipo_conector: 'Type 2', comunicacao: 'OCPP', disjuntor_recomendado_a: 40, dr_recomendado_ma: 30, bitola_cabo_minima_mm2: 6, garantia_anos: 5 },

      // AC Trifásico
      { tipo: 'AC_Tri', potencia_kw: 11, marca: 'Wallbox', modelo: 'Sigma', numero_fases: 3, tensao_entrada_v: 380, corrente_entrada_a: 16, eficiencia_pct: 95, fator_potencia: 0.99, grau_protecao_ip: 'IP54', temperatura_operacao: '-30 a 50°C', peso_kg: 8, dimensoes_mm: '680x210x110', protocolo_carregamento: 'IEC 61851', tipo_carregamento: 'Type 2', tempo_carga_rapida_min: 80, tipo_conector: 'Type 2', comunicacao: 'OCPP', disjuntor_recomendado_a: 20, dr_recomendado_ma: 30, bitola_cabo_minima_mm2: 4, garantia_anos: 5 },
      { tipo: 'AC_Tri', potencia_kw: 22, marca: 'ABB', modelo: 'Terra AC', numero_fases: 3, tensao_entrada_v: 380, corrente_entrada_a: 32, eficiencia_pct: 96, fator_potencia: 0.99, grau_protecao_ip: 'IP54', temperatura_operacao: '-30 a 50°C', peso_kg: 10, dimensoes_mm: '800x200x130', protocolo_carregamento: 'IEC 61851', tipo_carregamento: 'Type 2', tempo_carga_rapida_min: 40, tipo_conector: 'Type 2', comunicacao: 'OCPP', disjuntor_recomendado_a: 32, dr_recomendado_ma: 30, bitola_cabo_minima_mm2: 10, garantia_anos: 5 },
      { tipo: 'AC_Tri', potencia_kw: 30, marca: 'ABB', modelo: 'Terra AC', numero_fases: 3, tensao_entrada_v: 380, corrente_entrada_a: 43, eficiencia_pct: 96, fator_potencia: 0.99, grau_protecao_ip: 'IP54', temperatura_operacao: '-30 a 50°C', peso_kg: 12, dimensoes_mm: '800x200x130', protocolo_carregamento: 'IEC 61851', tipo_carregamento: 'Type 2', tempo_carga_rapida_min: 28, tipo_conector: 'Type 2', comunicacao: 'OCPP', disjuntor_recomendado_a: 50, dr_recomendado_ma: 30, bitola_cabo_minima_mm2: 16, garantia_anos: 5 },
      { tipo: 'AC_Tri', potencia_kw: 40, marca: 'Siemens', modelo: 'VersiCharge', numero_fases: 3, tensao_entrada_v: 380, corrente_entrada_a: 58, eficiencia_pct: 96, fator_potencia: 0.99, grau_protecao_ip: 'IP54', temperatura_operacao: '-30 a 50°C', peso_kg: 14, dimensoes_mm: '850x220x140', protocolo_carregamento: 'IEC 61851', tipo_carregamento: 'Type 2', tempo_carga_rapida_min: 22, tipo_conector: 'Type 2', comunicacao: 'OCPP', disjuntor_recomendado_a: 63, dr_recomendado_ma: 30, bitola_cabo_minima_mm2: 25, garantia_anos: 5 },

      // DC
      { tipo: 'DC', potencia_kw: 60, marca: 'ABB', modelo: 'Terra DC', numero_fases: 3, tensao_entrada_v: 380, tensao_saida_dc_v: 500, corrente_saida_dc_a: 120, eficiencia_pct: 93, fator_potencia: 0.98, grau_protecao_ip: 'IP54', temperatura_operacao: '-20 a 50°C', peso_kg: 80, dimensoes_mm: '1200x800x300', protocolo_carregamento: 'GB/T 20234', tipo_carregamento: 'CCS', tempo_carga_rapida_min: 15, tipo_conector: 'CCS2', comunicacao: 'OCPP', disjuntor_recomendado_a: 100, dr_recomendado_ma: 300, bitola_cabo_minima_mm2: 35, garantia_anos: 5 },
      { tipo: 'DC', potencia_kw: 80, marca: 'Phoenix Contact', modelo: 'eMobility Charger', numero_fases: 3, tensao_entrada_v: 380, tensao_saida_dc_v: 920, corrente_saida_dc_a: 87, eficiencia_pct: 94, fator_potencia: 0.98, grau_protecao_ip: 'IP54', temperatura_operacao: '-20 a 50°C', peso_kg: 100, dimensoes_mm: '1300x850x320', protocolo_carregamento: 'GB/T 20234', tipo_carregamento: 'CCS', tempo_carga_rapida_min: 14, tipo_conector: 'CCS2', comunicacao: 'OCPP', disjuntor_recomendado_a: 115, dr_recomendado_ma: 300, bitola_cabo_minima_mm2: 50, garantia_anos: 5 },
      { tipo: 'DC', potencia_kw: 90, marca: 'Siemens', modelo: 'Sicharge D', numero_fases: 3, tensao_entrada_v: 380, tensao_saida_dc_v: 920, corrente_saida_dc_a: 98, eficiencia_pct: 94, fator_potencia: 0.98, grau_protecao_ip: 'IP54', temperatura_operacao: '-20 a 50°C', peso_kg: 120, dimensoes_mm: '1400x900x350', protocolo_carregamento: 'GB/T 20234', tipo_carregamento: 'CCS', tempo_carga_rapida_min: 12, tipo_conector: 'CCS2', comunicacao: 'OCPP', disjuntor_recomendado_a: 128, dr_recomendado_ma: 300, bitola_cabo_minima_mm2: 50, garantia_anos: 5 },
      { tipo: 'DC', potencia_kw: 120, marca: 'Kempower', modelo: 'Charge Point', numero_fases: 3, tensao_entrada_v: 380, tensao_saida_dc_v: 920, corrente_saida_dc_a: 130, eficiencia_pct: 94, fator_potencia: 0.98, grau_protecao_ip: 'IP54', temperatura_operacao: '-20 a 50°C', peso_kg: 150, dimensoes_mm: '1500x1000x400', protocolo_carregamento: 'GB/T 20234', tipo_carregamento: 'CCS', tempo_carga_rapida_min: 9, tipo_conector: 'CCS2', comunicacao: 'OCPP', disjuntor_recomendado_a: 160, dr_recomendado_ma: 300, bitola_cabo_minima_mm2: 70, garantia_anos: 5 },
      { tipo: 'DC', potencia_kw: 150, marca: 'Delta', modelo: 'MC QuickCharger', numero_fases: 3, tensao_entrada_v: 380, tensao_saida_dc_v: 920, corrente_saida_dc_a: 163, eficiencia_pct: 95, fator_potencia: 0.98, grau_protecao_ip: 'IP54', temperatura_operacao: '-20 a 50°C', peso_kg: 180, dimensoes_mm: '1600x1100x450', protocolo_carregamento: 'GB/T 20234', tipo_carregamento: 'CCS', tempo_carga_rapida_min: 7, tipo_conector: 'CCS2', comunicacao: 'OCPP', disjuntor_recomendado_a: 200, dr_recomendado_ma: 300, bitola_cabo_minima_mm2: 95, garantia_anos: 5 },
      { tipo: 'DC', potencia_kw: 180, marca: 'CATL', modelo: 'Supercharger', numero_fases: 3, tensao_entrada_v: 380, tensao_saida_dc_v: 920, corrente_saida_dc_a: 195, eficiencia_pct: 95, fator_potencia: 0.98, grau_protecao_ip: 'IP54', temperatura_operacao: '-20 a 50°C', peso_kg: 220, dimensoes_mm: '1800x1200x500', protocolo_carregamento: 'GB/T 20234', tipo_carregamento: 'CCS', tempo_carga_rapida_min: 6, tipo_conector: 'CCS2', comunicacao: 'OCPP', disjuntor_recomendado_a: 250, dr_recomendado_ma: 300, bitola_cabo_minima_mm2: 120, garantia_anos: 5 },
    ]

    await CarregadorEV.insertMany(carregadores)
    res.json({ msg: 'Banco inicializado com sucesso', total: carregadores.length })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

// Upload e extração de datasheet EV com Claude Vision
router.post('/upload-datasheet', async (req, res) => {
  try {
    const { pdfBase64 } = req.body

    if (!pdfBase64) {
      return res.status(400).json({
        sucesso: false,
        erro: 'PDF não fornecido',
        avisos: ['Envie um arquivo PDF válido'],
      })
    }

    // Converter base64 para buffer
    const pdfBuffer = Buffer.from(pdfBase64, 'base64')

    // Processar datasheet (extrai + normaliza + valida)
    const resultado = await processarDatasheetEV(pdfBuffer)

    if (resultado.sucesso && resultado.carregador) {
      // Salvar no banco de dados
      const novoCarregador = new CarregadorEV(resultado.carregador)
      await novoCarregador.save()

      return res.status(201).json({
        sucesso: true,
        carregador: novoCarregador,
        avisos: resultado.avisos,
        msg: '✅ Carregador extraído e adicionado com sucesso',
      })
    } else {
      // Falha na extração, retornar dados parciais para edição manual
      return res.status(400).json({
        sucesso: false,
        carregador: resultado.carregador,
        avisos: [
          ...resultado.avisos,
          'Use a opção "Cadastro Manual" para preencher os dados corretamente',
        ],
        erro: resultado.erro,
        msg: '⚠️ Não foi possível extrair todos os dados do PDF',
      })
    }

  } catch (error) {
    console.error('[EV Upload] Erro:', error.message)
    res.status(500).json({
      sucesso: false,
      erro: error.message,
      avisos: ['Erro ao processar arquivo - tente novamente ou use Cadastro Manual'],
    })
  }
})

export default router
