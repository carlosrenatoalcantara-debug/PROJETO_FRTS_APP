import { Router } from 'express'
import mongoose from 'mongoose'
import { CarregadorEV } from '../models/CarregadorEV.js'
import { Equipamento } from '../models/Equipamento.js'
import { AuditLog } from '../models/AuditLog.js'
import {
  processarDatasheetEV,
  normalizarDadosEV,
  validarDadosEV,
  extrairDatasheetEV,
} from '../controllers/carregadorEVControllerGemini.js' // ✨ Usando Google Gemini (GRATUITO)
// EV-ALIGN-01: aplica pipeline 8.6.1/8.6.2/8.6.3 ao EV
import { extrairFabricanteModelo, ehDefaultLixo } from '../utils/catalogo/fabricanteModeloFallback.js'

const router = Router()

// EV-ALIGN-01: auditoria reutilizando AuditLog (mesmo padrão FV/catálogo/etc.)
async function _auditarEV(req, acao, alvo, detalhe = null) {
  try {
    if (mongoose.connection.readyState !== 1) return
    await AuditLog.create({
      timestamp: new Date(),
      usuario: req.auth?.id || req.auth?.email || 'anonymous',
      perfil: req.auth?.perfil || null,
      empresa: req.auth?.empresa_id || null,
      modulo: 'ev', acao, metodo: 'EVENT',
      path: `carregador:${alvo}${detalhe ? ' ' + String(detalhe).slice(0, 200) : ''}`,
      status: 200,
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null,
    })
  } catch { /* silencioso */ }
}

// Obter todos
router.get('/', async (req, res) => {
  try {
    const { tipo, potencia, ativo } = req.query
    // EV-BUGFIX-02: filtro de `ativo` agora explícito (antes era implicitamente true).
    // ?ativo não definido → retorna apenas ativos (default; comportamento original).
    // ?ativo=false → retorna apenas inativos (lixeira).
    // ?ativo=all → retorna TODOS (auditoria).
    const filtro = {}
    if (ativo === 'all') {
      // sem filtro de ativo
    } else if (ativo === 'false') {
      filtro.ativo = false
    } else {
      filtro.ativo = true
    }
    if (tipo) filtro.tipo = tipo
    if (potencia) filtro.potencia_kw = Number(potencia)

    const carregadores = await CarregadorEV.find(filtro).sort({ tipo: 1, potencia_kw: 1 })
    res.json(carregadores)
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

// EV-BUGFIX-02: Diagnóstico Mongo ↔ API. Útil para auditar discrepância
// entre quantidade no banco vs quantidade exibida na UI.
router.get('/diagnostico', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ sucesso: false, erro: 'DB_OFFLINE' })
    }
    const [total, ativos, inativos] = await Promise.all([
      CarregadorEV.countDocuments({}),
      CarregadorEV.countDocuments({ ativo: true }),
      CarregadorEV.countDocuments({ ativo: false }),
    ])
    const porTipo = await CarregadorEV.aggregate([
      { $group: { _id: '$tipo', count: { $sum: 1 } } },
    ])
    const sample = await CarregadorEV.find({}).sort({ createdAt: -1 }).limit(5).lean()
      .then(docs => docs.map(d => ({ _id: d._id, marca: d.marca, modelo: d.modelo, tipo: d.tipo, ativo: d.ativo })))
    // Cruza com Equipamento (existe rota de fallback que migra para Equipamento)
    let equipamentosEV = null
    try {
      const { Equipamento: Eq } = await import('../models/Equipamento.js')
      equipamentosEV = await Eq.countDocuments({ tipo: 'carregador_ev' })
    } catch { /* opcional */ }
    res.json({
      sucesso: true,
      gerado_em: new Date(),
      contagens: {
        carregador_ev_total: total,
        carregador_ev_ativos: ativos,
        carregador_ev_inativos: inativos,
        equipamentos_tipo_carregador_ev: equipamentosEV,
      },
      por_tipo: porTipo,
      ultimos: sample,
      filtro_padrao_aplicado: 'ativo=true (use ?ativo=all para ver tudo)',
    })
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message })
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

// Adicionar novos carregadores em massa
router.post('/admin/adicionar-lote', async (req, res) => {
  try {
    const { carregadores } = req.body

    if (!Array.isArray(carregadores) || carregadores.length === 0) {
      return res.status(400).json({ erro: 'Array de carregadores vazio' })
    }

    let adicionados = 0
    let erros = []

    for (const dados of carregadores) {
      try {
        // Verificar se já existe
        const existe = await CarregadorEV.findOne({
          marca: dados.marca,
          modelo: dados.modelo,
        })

        if (!existe) {
          const novo = new CarregadorEV(dados)
          await novo.save()
          adicionados++

          // Também sincronizar com Equipamentos
          try {
            const novoEquipamento = new Equipamento({
              tipo: 'carregador_ev',
              origem: { tipo: 'import_legado', fonte: 'catalogo_ev', em: new Date() },   // P1-CATALOG-PROVENANCE-01
              fabricante: dados.marca,
              modelo: dados.modelo,
              especificacoes: {
                tipo_carregador: dados.tipo,
                potencia_kw: dados.potencia_kw,
                tensao_entrada_v: dados.tensao_entrada_v,
                corrente_entrada_a: dados.corrente_entrada_a,
                numero_fases: dados.numero_fases,
                grau_protecao_ip: dados.grau_protecao_ip,
                temperatura_operacao: dados.temperatura_operacao,
                protocolo_carregamento: dados.protocolo_carregamento,
                tipo_carregamento: dados.tipo_carregamento,
                tipo_conector: dados.tipo_conector,
                comunicacao: dados.comunicacao,
                carregadorEV_id: novo._id,
              },
              garantia_produto: dados.garantia_anos
                ? { value: dados.garantia_anos, unit: 'anos' }
                : undefined,
              datasheet_url: dados.datasheet_url,
              ativo: true,
            })
            await novoEquipamento.save()
          } catch (e) {
            console.warn('[Lote] Aviso: Equipamento não sincronizado:', e.message)
          }
        }
      } catch (err) {
        erros.push(`${dados.marca} ${dados.modelo}: ${err.message}`)
      }
    }

    res.json({
      sucesso: true,
      adicionados,
      total_tentados: carregadores.length,
      erros,
      msg: `Adicionados ${adicionados}/${carregadores.length} carregadores`,
    })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

// Sincronizar todos os CarregadoresEV com tabela Equipamentos
router.post('/admin/sincronizar-equipamentos', async (req, res) => {
  try {
    const carregadores = await CarregadorEV.find({ ativo: true })

    let sincronizados = 0
    let erros = []

    for (const cg of carregadores) {
      try {
        // Verificar se já existe
        const existe = await Equipamento.findOne({
          tipo: 'carregador_ev',
          fabricante: cg.marca,
          modelo: cg.modelo,
        })

        if (!existe) {
          const novoEquipamento = new Equipamento({
            tipo: 'carregador_ev',
            origem: { tipo: 'import_legado', fonte: 'catalogo_ev', em: new Date() },   // P1-CATALOG-PROVENANCE-01
            fabricante: cg.marca,
            modelo: cg.modelo,
            especificacoes: {
              tipo_carregador: cg.tipo,
              potencia_kw: cg.potencia_kw,
              tensao_entrada_v: cg.tensao_entrada_v,
              corrente_entrada_a: cg.corrente_entrada_a,
              numero_fases: cg.numero_fases,
              grau_protecao_ip: cg.grau_protecao_ip,
              temperatura_operacao: cg.temperatura_operacao,
              protocolo_carregamento: cg.protocolo_carregamento,
              tipo_carregamento: cg.tipo_carregamento,
              tipo_conector: cg.tipo_conector,
              comunicacao: cg.comunicacao,
              carregadorEV_id: cg._id,
            },
            garantia_produto: cg.garantia_anos
              ? { value: cg.garantia_anos, unit: 'anos' }
              : undefined,
            datasheet_url: cg.datasheet_url,
            ativo: true,
          })
          await novoEquipamento.save()
          sincronizados++
        }
      } catch (err) {
        erros.push(`${cg.marca} ${cg.modelo}: ${err.message}`)
      }
    }

    res.json({
      sucesso: true,
      sincronizados,
      total: carregadores.length,
      erros,
      msg: `Sincronizados ${sincronizados}/${carregadores.length} carregadores`,
    })
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
  // EV-ALIGN-01: diagnóstico estágio-a-estágio (mesmo padrão da fatura 8.6.2)
  const _diag = {
    ocr_chars: 0, gemini_ok: false, fallback_executado: false,
    fallback_encontrou: false, fabricante_origem: 'nenhuma',
    modelo_origem: 'nenhuma', etapa_decisiva: null,
  }
  let textoOCR = ''

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

    // EV-ALIGN-01 (S8.6.2): extrai OCR UMA vez no início p/ fallback regex client+server
    try {
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: pdfBuffer })
      const tr = await parser.getText()
      await parser.destroy()
      textoOCR = (tr?.text || '').toString()
      _diag.ocr_chars = textoOCR.length
    } catch (e) {
      _diag.etapa_decisiva = 'OCR_FALHOU'
      console.warn('[EV Upload] OCR pdf-parse falhou:', e.message)
    }

    // Processar datasheet (extrai + normaliza + valida)
    const resultado = await processarDatasheetEV(pdfBuffer)
    _diag.gemini_ok = !!(resultado?.sucesso && resultado?.carregador)
    if (resultado?.carregador?.marca) _diag.fabricante_origem = 'gemini'
    if (resultado?.carregador?.modelo) _diag.modelo_origem = 'gemini'

    // EV-ALIGN-01 (S8.6.1): fallback regex SERVER-SIDE quando Gemini falha ou devolve lixo
    const car = resultado?.carregador || {}
    const fabLixo = ehDefaultLixo(car.marca, 'fabricante')
    const modLixo = ehDefaultLixo(car.modelo, 'modelo')
    if ((fabLixo || modLixo) && textoOCR.length >= 20) {
      _diag.fallback_executado = true
      const fb = extrairFabricanteModelo(textoOCR)
      if (fb.fabricante || fb.modelo) _diag.fallback_encontrou = true
      if (fabLixo && fb.fabricante) {
        console.log(`🔁 [EV] Fallback regex recuperou fabricante: ${fb.fabricante}`)
        car.marca = fb.fabricante
        _diag.fabricante_origem = 'regex_fallback'
        if (resultado?.avisos) resultado.avisos.push(`Fabricante recuperado por regex: ${fb.fabricante}`)
      }
      if (modLixo && fb.modelo) {
        console.log(`🔁 [EV] Fallback regex recuperou modelo: ${fb.modelo}`)
        car.modelo = fb.modelo
        _diag.modelo_origem = 'regex_fallback'
        if (resultado?.avisos) resultado.avisos.push(`Modelo recuperado por regex: ${fb.modelo}`)
      }
    }

    // EV-ALIGN-01 (S8.6.1): rejeição final de defaults lixo (IMPORTACAO_FALHOU)
    if (ehDefaultLixo(car.marca, 'fabricante') && ehDefaultLixo(car.modelo, 'modelo')) {
      _diag.etapa_decisiva = 'IMPORTACAO_FALHOU'
      return res.status(422).json({
        sucesso: false,
        codigo: 'IMPORTACAO_FALHOU',
        erro: 'Não foi possível identificar fabricante nem modelo do carregador.',
        carregador: car,
        avisos: ['Preencha manualmente ou reprocessar com PDF mais legível.'],
        // EV-ALIGN-01 (S8.6.2): expõe texto OCR + diagnóstico para o frontend
        texto_extraido: textoOCR.slice(0, 8000),
        _diagnostico: _diag,
      })
    }
    _diag.etapa_decisiva = 'OK'

    if (resultado.sucesso && resultado.carregador) {
      try {
        // EV-ALIGN-01: aplica valores recuperados pelo regex (se houve fallback)
        resultado.carregador.marca = car.marca
        resultado.carregador.modelo = car.modelo
        // Salvar no banco de dados (CarregadorEV)
        const novoCarregador = new CarregadorEV(resultado.carregador)
        await novoCarregador.save()
        _auditarEV(req, 'CARREGADOR_EV_IMPORTADO', novoCarregador._id, `${car.marca} ${car.modelo} | origem=${_diag.fabricante_origem}/${_diag.modelo_origem}`)

        // Também salvar na tabela Equipamentos para visibilidade na interface
        try {
          const novoEquipamento = new Equipamento({
            tipo: 'carregador_ev',
            origem: { tipo: 'import_legado', fonte: 'catalogo_ev', em: new Date() },   // P1-CATALOG-PROVENANCE-01
            fabricante: resultado.carregador.marca,
            modelo: resultado.carregador.modelo,
            especificacoes: {
              tipo_carregador: resultado.carregador.tipo,
              potencia_kw: resultado.carregador.potencia_kw,
              tensao_entrada_v: resultado.carregador.tensao_entrada_v,
              corrente_entrada_a: resultado.carregador.corrente_entrada_a,
              numero_fases: resultado.carregador.numero_fases,
              grau_protecao_ip: resultado.carregador.grau_protecao_ip,
              temperatura_operacao: resultado.carregador.temperatura_operacao,
              protocolo_carregamento: resultado.carregador.protocolo_carregamento,
              tipo_carregamento: resultado.carregador.tipo_carregamento,
              tipo_conector: resultado.carregador.tipo_conector,
              comunicacao: resultado.carregador.comunicacao,
              carregadorEV_id: novoCarregador._id,
            },
            garantia_produto: resultado.carregador.garantia_anos
              ? { value: resultado.carregador.garantia_anos, unit: 'anos' }
              : undefined,
            datasheet_url: resultado.carregador.datasheet_url,
            ativo: true,
          })
          await novoEquipamento.save()
          console.log('[EV Upload] Equipamento salvo na tabela Equipamentos:', novoEquipamento._id)
        } catch (equipError) {
          console.warn('[EV Upload] Aviso: Equipamento não foi sincronizado:', equipError.message)
          resultado.avisos.push('Equipamento não foi sincronizado para a tabela genérica')
        }

        return res.status(201).json({
          sucesso: true,
          carregador: novoCarregador,
          avisos: resultado.avisos,
          msg: '✅ Carregador extraído e adicionado com sucesso',
          // EV-ALIGN-01: texto OCR + diagnóstico (S8.6.2)
          texto_extraido: textoOCR.slice(0, 8000),
          _diagnostico: _diag,
        })
      } catch (saveError) {
        // Erro ao salvar no banco
        console.error('[EV Upload] Erro ao salvar:', saveError.message)
        console.error('[EV Upload] Dados tentados:', JSON.stringify(resultado.carregador, null, 2))

        return res.status(500).json({
          sucesso: false,
          carregador: resultado.carregador,
          avisos: [...resultado.avisos, `Erro ao salvar no banco: ${saveError.message}`],
          erro: saveError.message,
          msg: '❌ Dados extraídos mas não foi possível salvar no banco de dados',
        })
      }
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
    console.error('[EV Upload] Erro geral:', error.message)
    console.error('[EV Upload] Stack:', error.stack)
    res.status(500).json({
      sucesso: false,
      erro: error.message,
      avisos: ['Erro ao processar arquivo - tente novamente ou use Cadastro Manual'],
    })
  }
})

export default router
