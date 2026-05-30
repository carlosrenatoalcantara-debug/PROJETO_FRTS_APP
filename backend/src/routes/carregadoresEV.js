import { Router } from 'express'
import { CarregadorEV } from '../models/CarregadorEV.js'
import { Equipamento } from '../models/Equipamento.js'
import { FEATURE_FLAGS, auditarFallbackPayload } from '../config/featureFlags.js'
import {
  processarDatasheetEV,
} from '../controllers/carregadorEVControllerGemini.js'

const router = Router()

const TIPO_EV = 'carregador-ev'

function emitirAuditoriaFallback(req, { funcao, motivo }) {
  console.warn('AUDITORIA_FALLBACK', {
    ...auditarFallbackPayload({
      arquivo: 'backend/src/routes/carregadoresEV.js',
      funcao,
      origem: 'CarregadorEV',
      motivo,
    }),
    requestId: req?.id,
  })
}

function mapearEquipamentoParaEV(equipamento) {
  const espec = equipamento?.especificacoes || {}
  return {
    _id: equipamento._id,
    ativo: equipamento.ativo,
    tipo: espec.tipo_carregador || equipamento.tipo || 'AC',
    marca: equipamento.fabricante,
    modelo: equipamento.modelo,
    potencia_kw: espec.potencia_kw,
    tensao_entrada_v: espec.tensao_entrada_v,
    corrente_entrada_a: espec.corrente_entrada_a,
    numero_fases: espec.numero_fases,
    grau_protecao_ip: espec.grau_protecao_ip,
    temperatura_operacao: espec.temperatura_operacao,
    protocolo_carregamento: espec.protocolo_carregamento,
    tipo_carregamento: espec.tipo_carregamento,
    tipo_conector: espec.tipo_conector,
    comunicacao: espec.comunicacao,
    garantia_anos: equipamento.garantia_produto?.value,
    preco_sugerido: equipamento.preco_sugerido,
    createdAt: equipamento.createdAt,
    updatedAt: equipamento.updatedAt,
    _origem: 'Equipamento',
  }
}

async function listarAPartirEquipamento(req) {
  const { tipo, potencia, ativo } = req.query
  const filtro = {
    tipo: { $in: ['carregador-ev', 'carregador_ev'] },
    ativo: ativo !== 'false',
  }

  const equipamentos = await Equipamento.find(filtro).sort({ createdAt: -1 }).lean()

  let carregadores = equipamentos.map(mapearEquipamentoParaEV)

  if (tipo) {
    carregadores = carregadores.filter(c => String(c.tipo || '').toLowerCase() === String(tipo).toLowerCase())
  }

  if (potencia) {
    const p = Number(potencia)
    carregadores = carregadores.filter(c => Number(c.potencia_kw) === p)
  }

  return carregadores
}

async function buscarCarregadorEVComAuditoria(req, filtro, funcao, opcoes = {}) {
  emitirAuditoriaFallback(req, {
    funcao,
    motivo: opcoes.motivo || 'Leitura em CarregadorEV para compatibilidade temporaria da sprint P0-A',
  })
  let query = CarregadorEV.find(filtro)
  if (opcoes.sort) query = query.sort(opcoes.sort)
  if (opcoes.lean) query = query.lean()
  return query
}

function mapearCarregadorEVParaEquipamento(cg) {
  return {
    tipo: TIPO_EV,
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
    ativo: cg.ativo,
  }
}

// Obter todos (fonte primaria: Equipamento)
router.get('/', async (req, res) => {
  try {
    const carregadoresEquip = await listarAPartirEquipamento(req)
    if (carregadoresEquip.length > 0) return res.json(carregadoresEquip)

    if (!FEATURE_FLAGS.ENABLE_LEGACY_EV) return res.json([])

    const carregadoresLegado = await buscarCarregadorEVComAuditoria(
      req,
      { ativo: req.query.ativo !== 'false' },
      'GET /',
      {
        sort: { tipo: 1, potencia_kw: 1 },
        lean: true,
        motivo: 'Equipamento vazio para EV; fallback legado habilitado por flag',
      }
    )

    return res.json(carregadoresLegado || [])
  } catch (error) {
    return res.status(500).json({ erro: error.message })
  }
})

// Obter um (fonte primaria: Equipamento)
router.get('/:id', async (req, res) => {
  try {
    const equipamento = await Equipamento.findById(req.params.id).lean()
    if (equipamento && ['carregador-ev', 'carregador_ev'].includes(equipamento.tipo)) {
      return res.json(mapearEquipamentoParaEV(equipamento))
    }

    if (!FEATURE_FLAGS.ENABLE_LEGACY_EV) return res.status(404).json({ erro: 'Nao encontrado' })

    const carregador = await buscarCarregadorEVComAuditoria(
      req,
      { _id: req.params.id },
      'GET /:id',
      { motivo: 'ID nao encontrado em Equipamento; fallback legado habilitado por flag' }
    )

    if (!carregador) return res.status(404).json({ erro: 'Nao encontrado' })
    return res.json(carregador)
  } catch (error) {
    return res.status(500).json({ erro: error.message })
  }
})

// Criar (fonte primaria: Equipamento; sincroniza legado)
router.post('/', async (req, res) => {
  try {
    const dados = req.body || {}

    const novoEquipamento = new Equipamento({
      tipo: TIPO_EV,
      fabricante: dados.marca || dados.fabricante,
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
      },
      garantia_produto: dados.garantia_anos ? { value: dados.garantia_anos, unit: 'anos' } : undefined,
      datasheet_url: dados.datasheet_url,
      ativo: dados.ativo !== false,
    })

    await novoEquipamento.save()

    // sincronizacao temporaria com legado
    const legado = new CarregadorEV(dados)
    await legado.save()

    await Equipamento.findByIdAndUpdate(novoEquipamento._id, {
      $set: { 'especificacoes.carregadorEV_id': legado._id }
    })

    return res.status(201).json({ ...mapearEquipamentoParaEV(novoEquipamento.toObject()), _sync_legacy: true })
  } catch (error) {
    return res.status(400).json({ erro: error.message })
  }
})

// Atualizar (fonte primaria: Equipamento; sincroniza legado por referencia)
router.put('/:id', async (req, res) => {
  try {
    const dados = req.body || {}
    const equip = await Equipamento.findById(req.params.id)
    if (!equip) return res.status(404).json({ erro: 'Nao encontrado' })

    equip.fabricante = dados.marca || dados.fabricante || equip.fabricante
    equip.modelo = dados.modelo || equip.modelo
    equip.ativo = dados.ativo ?? equip.ativo
    equip.especificacoes = {
      ...equip.especificacoes,
      tipo_carregador: dados.tipo ?? equip.especificacoes?.tipo_carregador,
      potencia_kw: dados.potencia_kw ?? equip.especificacoes?.potencia_kw,
      tensao_entrada_v: dados.tensao_entrada_v ?? equip.especificacoes?.tensao_entrada_v,
      corrente_entrada_a: dados.corrente_entrada_a ?? equip.especificacoes?.corrente_entrada_a,
      numero_fases: dados.numero_fases ?? equip.especificacoes?.numero_fases,
      grau_protecao_ip: dados.grau_protecao_ip ?? equip.especificacoes?.grau_protecao_ip,
      temperatura_operacao: dados.temperatura_operacao ?? equip.especificacoes?.temperatura_operacao,
      protocolo_carregamento: dados.protocolo_carregamento ?? equip.especificacoes?.protocolo_carregamento,
      tipo_carregamento: dados.tipo_carregamento ?? equip.especificacoes?.tipo_carregamento,
      tipo_conector: dados.tipo_conector ?? equip.especificacoes?.tipo_conector,
      comunicacao: dados.comunicacao ?? equip.especificacoes?.comunicacao,
    }
    await equip.save()

    const legadoId = equip.especificacoes?.carregadorEV_id
    if (legadoId) {
      emitirAuditoriaFallback(req, {
        funcao: 'PUT /:id',
        motivo: 'Sincronizacao temporaria com CarregadorEV via carregadorEV_id',
      })
      await CarregadorEV.findByIdAndUpdate(legadoId, {
        marca: equip.fabricante,
        modelo: equip.modelo,
        tipo: equip.especificacoes?.tipo_carregador,
        potencia_kw: equip.especificacoes?.potencia_kw,
        tensao_entrada_v: equip.especificacoes?.tensao_entrada_v,
        corrente_entrada_a: equip.especificacoes?.corrente_entrada_a,
        numero_fases: equip.especificacoes?.numero_fases,
        grau_protecao_ip: equip.especificacoes?.grau_protecao_ip,
        temperatura_operacao: equip.especificacoes?.temperatura_operacao,
        protocolo_carregamento: equip.especificacoes?.protocolo_carregamento,
        tipo_carregamento: equip.especificacoes?.tipo_carregamento,
        tipo_conector: equip.especificacoes?.tipo_conector,
        comunicacao: equip.especificacoes?.comunicacao,
        ativo: equip.ativo,
      })
    }

    return res.json(mapearEquipamentoParaEV(equip.toObject()))
  } catch (error) {
    return res.status(400).json({ erro: error.message })
  }
})

// Deletar (desativa em Equipamento; mantém legado)
router.delete('/:id', async (req, res) => {
  try {
    const equip = await Equipamento.findByIdAndUpdate(req.params.id, { ativo: false }, { new: true })
    if (!equip) return res.status(404).json({ erro: 'Nao encontrado' })

    const legadoId = equip.especificacoes?.carregadorEV_id
    if (legadoId) {
      emitirAuditoriaFallback(req, {
        funcao: 'DELETE /:id',
        motivo: 'Sincronizacao temporaria de desativacao em CarregadorEV',
      })
      await CarregadorEV.findByIdAndUpdate(legadoId, { ativo: false })
    }

    return res.json({ sucesso: true })
  } catch (error) {
    return res.status(500).json({ erro: error.message })
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
    const erros = []

    for (const dados of carregadores) {
      try {
        const existeEquipamento = await Equipamento.findOne({
          tipo: { $in: ['carregador-ev', 'carregador_ev'] },
          fabricante: dados.marca,
          modelo: dados.modelo,
        })

        if (!existeEquipamento) {
          const legado = new CarregadorEV(dados)
          await legado.save()

          const novoEquipamento = new Equipamento({
            ...mapearCarregadorEVParaEquipamento(legado),
          })
          await novoEquipamento.save()
          adicionados++
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
    const carregadores = await buscarCarregadorEVComAuditoria(
      req,
      { ativo: true },
      'POST /admin/sincronizar-equipamentos',
      {
        motivo: 'Sincronizacao administrativa temporaria entre legado CarregadorEV e Equipamento',
      }
    )

    let sincronizados = 0
    const erros = []

    for (const cg of carregadores) {
      try {
        const existe = await Equipamento.findOne({
          tipo: { $in: ['carregador-ev', 'carregador_ev'] },
          fabricante: cg.marca,
          modelo: cg.modelo,
        })

        if (!existe) {
          const novoEquipamento = new Equipamento(mapearCarregadorEVParaEquipamento(cg))
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

// Seed - Carregar banco inicial (mantem legado)
router.post('/seed/inicializar', async (req, res) => {
  try {
    emitirAuditoriaFallback(req, {
      funcao: 'POST /seed/inicializar',
      motivo: 'Seed legado permanece nesta sprint por compatibilidade operacional',
    })

    const count = await CarregadorEV.countDocuments()
    if (count > 0) return res.json({ msg: 'Banco ja inicializado' })

    const carregadores = [
      { tipo: 'AC_Mono', potencia_kw: 3.6, marca: 'Wallbox', modelo: 'Pulsar Plus', numero_fases: 1, tensao_entrada_v: 220, corrente_entrada_a: 16, eficiencia_pct: 93, fator_potencia: 0.99, grau_protecao_ip: 'IP54', temperatura_operacao: '-30 a 50C', peso_kg: 6, dimensoes_mm: '650x204x99', protocolo_carregamento: 'IEC 61851', tipo_carregamento: 'Type 2', tempo_carga_rapida_min: 240, tipo_conector: 'Type 2', comunicacao: 'OCPP', disjuntor_recomendado_a: 20, dr_recomendado_ma: 30, bitola_cabo_minima_mm2: 2.5, garantia_anos: 5 },
      { tipo: 'AC_Tri', potencia_kw: 22, marca: 'ABB', modelo: 'Terra AC', numero_fases: 3, tensao_entrada_v: 380, corrente_entrada_a: 32, eficiencia_pct: 96, fator_potencia: 0.99, grau_protecao_ip: 'IP54', temperatura_operacao: '-30 a 50C', peso_kg: 10, dimensoes_mm: '800x200x130', protocolo_carregamento: 'IEC 61851', tipo_carregamento: 'Type 2', tempo_carga_rapida_min: 40, tipo_conector: 'Type 2', comunicacao: 'OCPP', disjuntor_recomendado_a: 32, dr_recomendado_ma: 30, bitola_cabo_minima_mm2: 10, garantia_anos: 5 },
      { tipo: 'DC', potencia_kw: 60, marca: 'ABB', modelo: 'Terra DC', numero_fases: 3, tensao_entrada_v: 380, tensao_saida_dc_v: 500, corrente_saida_dc_a: 120, eficiencia_pct: 93, fator_potencia: 0.98, grau_protecao_ip: 'IP54', temperatura_operacao: '-20 a 50C', peso_kg: 80, dimensoes_mm: '1200x800x300', protocolo_carregamento: 'GB/T 20234', tipo_carregamento: 'CCS', tempo_carga_rapida_min: 15, tipo_conector: 'CCS2', comunicacao: 'OCPP', disjuntor_recomendado_a: 100, dr_recomendado_ma: 300, bitola_cabo_minima_mm2: 35, garantia_anos: 5 },
    ]

    await CarregadorEV.insertMany(carregadores)
    res.json({ msg: 'Banco inicializado com sucesso', total: carregadores.length })
  } catch (error) {
    res.status(500).json({ erro: error.message })
  }
})

// Upload e extracao de datasheet EV
router.post('/upload-datasheet', async (req, res) => {
  try {
    const { pdfBase64 } = req.body

    if (!pdfBase64) {
      return res.status(400).json({
        sucesso: false,
        erro: 'PDF nao fornecido',
        avisos: ['Envie um arquivo PDF valido'],
      })
    }

    const pdfBuffer = Buffer.from(pdfBase64, 'base64')
    const resultado = await processarDatasheetEV(pdfBuffer)

    if (resultado.sucesso && resultado.carregador) {
      const novoCarregador = new CarregadorEV(resultado.carregador)
      emitirAuditoriaFallback(req, {
        funcao: 'POST /upload-datasheet',
        motivo: 'Persistencia temporaria do legado CarregadorEV para sincronizacao',
      })
      await novoCarregador.save()

      const novoEquipamento = new Equipamento({
        ...mapearCarregadorEVParaEquipamento(novoCarregador),
      })
      await novoEquipamento.save()

      return res.status(201).json({
        sucesso: true,
        carregador: mapearEquipamentoParaEV(novoEquipamento.toObject()),
        avisos: resultado.avisos || [],
        msg: 'Carregador extraido e adicionado com sucesso',
      })
    }

    return res.status(400).json({
      sucesso: false,
      carregador: resultado.carregador,
      avisos: [
        ...(resultado.avisos || []),
        'Use a opcao "Cadastro Manual" para preencher os dados corretamente',
      ],
      erro: resultado.erro,
      msg: 'Nao foi possivel extrair todos os dados do PDF',
    })
  } catch (error) {
    res.status(500).json({
      sucesso: false,
      erro: error.message,
      avisos: ['Erro ao processar arquivo - tente novamente ou use Cadastro Manual'],
    })
  }
})

export default router
