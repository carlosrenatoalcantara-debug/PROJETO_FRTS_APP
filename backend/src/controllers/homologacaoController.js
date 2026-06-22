import mongoose from 'mongoose'
import {
  gerarMemorialDescritivo,
  gerarCartaConcessionaria,
  gerarDadosART,
  gerarChecklistDocumentos,
} from '../services/memorialDescritivoService.js'
import { ProjetoFV } from '../models/ProjetoFV.js'
import { Equipamento } from '../models/Equipamento.js'
import { UnidadeBeneficiaria } from '../models/UnidadeBeneficiaria.js'

// P1-NEW01-HOMOLOGACAO-PERSISTENCE-FIX-01: o Map() legado foi REMOVIDO.
// Todo o estado de homologação (checklist + status legado) agora persiste no Mongo
// (ProjetoFV.homologacao). Nenhum estado depende mais de memória de processo.

/**
 * P1-HOMOLOGACAO-SNAPSHOT-01: o projeto está congelado (engenharia travada)?
 * Quando CONGELADO/HOMOLOGADO, a homologação DEVE usar o snapshot_catalogo
 * (equipamentos do orçamento aprovado), não o catálogo vivo.
 */
function _estaCongelado(proj) {
  const fs = proj?.governanca?.freeze_status
  return fs === 'CONGELADO' || fs === 'HOMOLOGADO'
}

/**
 * P1-HOMOLOGACAO-SNAPSHOT-01: converte o snapshot_catalogo congelado no formato
 * `deps.equipamentos` que os resolvers do memorial já consomem como fonte de
 * prioridade ({ tipo, fabricante, modelo, especificacoes, garantia_produto }).
 */
function _depsDoSnapshot(snapCat) {
  if (!snapCat || typeof snapCat !== 'object') return []
  const eqs = []
  const mod = snapCat.modulo
  const inv = snapCat.inversor
  if (mod && mod.fabricante) {
    eqs.push({
      tipo: 'modulo', fabricante: mod.fabricante, modelo: mod.modelo,
      especificacoes: mod.especificacoes || {},
      garantia_produto: mod.garantia_produto ?? null,
      garantia_performance: mod.garantia_performance ?? null,
      _origem: 'snapshot',
    })
  }
  if (inv && inv.fabricante) {
    eqs.push({
      tipo: 'inversor', fabricante: inv.fabricante, modelo: inv.modelo,
      especificacoes: inv.especificacoes || {},
      garantia_produto: inv.garantia_produto ?? null,
      _origem: 'snapshot',
    })
  }
  return eqs
}

/**
 * P1-PARECER-ENGINEERING-WIRE-01 + P1-HOMOLOGACAO-SNAPSHOT-01:
 * carrega as dependências do documento. Se o projeto está CONGELADO, usa o
 * snapshot_catalogo (orçamento aprovado) e NÃO consulta o catálogo vivo.
 * Caso contrário, mantém o comportamento anterior (ATLAS VIVO por _id).
 * Retorna { equipamentos, beneficiarias, origem: 'snapshot'|'vivo', itens_adicionais }.
 */
async function _carregarDepsDocumento(projetoId, projetoBody) {
  const out = { equipamentos: [], beneficiarias: [], origem: 'vivo', itens_adicionais: [] }
  try {
    if (mongoose.connection?.readyState !== 1) return out
    let proj = projetoBody
    const idValido = projetoId && mongoose.Types.ObjectId.isValid(projetoId)
    if (idValido) { const p = await ProjetoFV.findById(projetoId).lean().catch(() => null); if (p) proj = p }

    // Beneficiárias independem da origem dos equipamentos.
    if (idValido) out.beneficiarias = await UnidadeBeneficiaria.find({ projetoId }).lean().catch(() => [])

    // P1-HOMOLOGACAO-SNAPSHOT-01: projeto congelado → snapshot congelado tem prioridade.
    const snapCat = proj?.governanca?.snapshot_catalogo
    if (_estaCongelado(proj) && snapCat) {
      out.equipamentos = _depsDoSnapshot(snapCat)
      out.itens_adicionais = Array.isArray(snapCat.itens_adicionais) ? snapCat.itens_adicionais : []
      out.origem = 'snapshot'
      return out   // NÃO consulta o catálogo vivo
    }

    // Catálogo vivo (projeto não congelado) — comportamento anterior preservado.
    // P1-PARECER-ATLAS-LINK-01: prioriza o VÍNCULO real com o Atlas (equipamento_id / id
    // legado) — o _id do subdoc do projeto NÃO é o _id do equipamento. ObjectId válido apenas.
    const refValida = (v) => (v && mongoose.Types.ObjectId.isValid(v)) ? v : null
    const ids = []
    for (const e of (proj?.equipamentos?.paineis || [])) { const id = refValida(e?.equipamento_id) || refValida(e?.id); if (id) ids.push(id) }
    const inv = proj?.equipamentos?.inversor || {}
    const invId = refValida(inv.equipamento_id) || refValida(inv.id)
    if (invId) ids.push(invId)
    if (ids.length) out.equipamentos = await Equipamento.find({ _id: { $in: ids } }).lean().catch(() => [])
  } catch { /* fallback: snapshot do projeto */ }
  return out
}

/**
 * P1-HOMOLOGACAO-SNAPSHOT-01: aplica os equipamentos congelados sobre o objeto
 * `projeto` (inversor/painel/quantidades) para os documentos que NÃO usam deps
 * (carta, ART). No-op quando o projeto não está congelado.
 */
function _aplicarSnapshotEquip(projeto) {
  if (!_estaCongelado(projeto)) return { projeto, origem: 'vivo' }
  const snap = projeto?.governanca?.snapshot_catalogo
  if (!snap) return { projeto, origem: 'vivo' }
  const mod = snap.modulo || {}; const inv = snap.inversor || {}
  const me = mod.especificacoes || {}; const ie = inv.especificacoes || {}
  const frozen = {
    ...projeto,
    painel: {
      ...(projeto.painel || {}),
      marca: mod.fabricante ?? projeto.painel?.marca,
      modelo: mod.modelo ?? projeto.painel?.modelo,
      pmpp: me.potencia ?? projeto.painel?.pmpp,
      potencia: me.potencia ?? projeto.painel?.potencia,
      voc: me.voc ?? projeto.painel?.voc,
      isc: me.isc ?? projeto.painel?.isc,
      garantia_produto: mod.garantia_produto ?? projeto.painel?.garantia_produto,
      garantia_performance: mod.garantia_performance ?? projeto.painel?.garantia_performance,
    },
    inversor: {
      ...(projeto.inversor || {}),
      marca: inv.fabricante ?? projeto.inversor?.marca,
      modelo: inv.modelo ?? projeto.inversor?.modelo,
      potencia_kw: ie.potencia ?? projeto.inversor?.potencia_kw,
      potenciaKW: ie.potencia ?? projeto.inversor?.potenciaKW,
      n_mppts: ie.mppts ?? projeto.inversor?.n_mppts,
      garantia: inv.garantia_produto ?? projeto.inversor?.garantia,
    },
    num_paineis: mod.quantidade ?? projeto.num_paineis,
    num_inversores: inv.quantidade ?? projeto.num_inversores,
    itens_adicionais_congelados: Array.isArray(snap.itens_adicionais) ? snap.itens_adicionais : [],
  }
  return { projeto: frozen, origem: 'snapshot' }
}

export async function gerarMemorial(req, res) {
  try {
    const { projetoId } = req.params
    const { projeto, cliente } = req.body

    if (!projeto || !cliente) {
      return res.status(400).json({ erro: 'Dados do projeto e cliente obrigatórios' })
    }

    const deps = await _carregarDepsDocumento(projetoId, projeto)
    // P1-HOMOLOGACAO-SNAPSHOT-01: projeto congelado usa equipamentos do snapshot.
    const { projeto: projDoc } = _aplicarSnapshotEquip(projeto)
    const memorial = gerarMemorialDescritivo(projDoc, cliente, deps)

    res.json({
      sucesso: true,
      tipo: 'memorial_descritivo',
      conteudo: memorial,
      origem: deps.origem,
      usou_snapshot: deps.origem === 'snapshot',
      data_geracao: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Erro ao gerar memorial:', err)
    res.status(500).json({ erro: err.message })
  }
}

export async function gerarCarta(req, res) {
  try {
    const { projetoId } = req.params
    const { projeto, cliente } = req.body

    if (!projeto || !cliente) {
      return res.status(400).json({ erro: 'Dados do projeto e cliente obrigatórios' })
    }

    // P1-HOMOLOGACAO-SNAPSHOT-01: projeto congelado usa equipamentos do snapshot.
    const { projeto: projDoc, origem } = _aplicarSnapshotEquip(projeto)
    const carta = gerarCartaConcessionaria(projDoc, cliente)

    res.json({
      sucesso: true,
      tipo: 'carta_concessionaria',
      conteudo: carta,
      origem,
      usou_snapshot: origem === 'snapshot',
      data_geracao: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Erro ao gerar carta:', err)
    res.status(500).json({ erro: err.message })
  }
}

export async function obterDadosART(req, res) {
  try {
    const { projetoId } = req.params
    const { projeto } = req.body

    if (!projeto) {
      return res.status(400).json({ erro: 'Dados do projeto obrigatórios' })
    }

    // P1-HOMOLOGACAO-SNAPSHOT-01: projeto congelado usa equipamentos do snapshot.
    const { projeto: projDoc, origem } = _aplicarSnapshotEquip(projeto)
    const dadosART = gerarDadosART(projDoc, {})

    res.json({
      sucesso: true,
      tipo: 'dados_art',
      dados: dadosART,
      origem,
      usou_snapshot: origem === 'snapshot',
      data_geracao: new Date().toISOString(),
      observacoes: {
        1: 'Acesse o site do CREA de sua região para registrar a ART',
        2: 'Potência ≤ 5kWp geralmente tem custo menor',
        3: 'ART deve ser registrada ANTES da instalação iniciar',
      },
    })
  } catch (err) {
    console.error('Erro ao obter dados ART:', err)
    res.status(500).json({ erro: err.message })
  }
}

export async function obterChecklist(req, res) {
  try {
    const { projetoId } = req.params
    const { estado, concessionaria } = req.query

    // Template determinístico (base / fallback quando nunca foi salvo)
    const template = gerarChecklistDocumentos(estado, concessionaria)

    // P1-NEW01-HOMOLOGACAO-PERSISTENCE-FIX-01: retorna o ESTADO REAL persistido no
    // Mongo (antes o GET gerava o template e ignorava o que foi salvo no Map).
    let origem = 'template'
    let checklist = template
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(projetoId)) {
      const proj = await ProjetoFV.findById(projetoId).select('homologacao.checklist').lean().catch(() => null)
      const salvo = proj?.homologacao?.checklist
      if (salvo && Array.isArray(salvo.documentos) && salvo.documentos.length > 0) {
        // Estado salvo é o que o usuário editou (gerado do mesmo template). Devolve-o,
        // preservando 'concluido'/observações e mantendo os metadados do template.
        checklist = { ...template, ...salvo, documentos: salvo.documentos, status: salvo.status ?? template.status }
        origem = 'persistido'
      }
    }

    res.json({ sucesso: true, tipo: 'checklist_documentos', checklist, origem })
  } catch (err) {
    console.error('Erro ao obter checklist:', err)
    res.status(500).json({ erro: err.message })
  }
}

export async function atualizarChecklist(req, res) {
  try {
    const { projetoId } = req.params
    const { documentos, observacoes, status } = req.body

    if (!documentos) {
      return res.status(400).json({ erro: 'Lista de documentos obrigatória' })
    }

    // P1-NEW01-HOMOLOGACAO-PERSISTENCE-FIX-01: grava DIRETO no Mongo (era write-only
    // num Map de processo). Sobrevive a reload / troca de navegador / restart Railway.
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ erro: 'MongoDB indisponível.', codigo: 'DB_OFFLINE' })
    }
    if (!mongoose.Types.ObjectId.isValid(projetoId)) {
      return res.status(400).json({ erro: 'ID de projeto inválido' })
    }
    const projeto = await ProjetoFV.findById(projetoId)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const atualizado_em = new Date()
    projeto.homologacao = projeto.homologacao || {}
    projeto.homologacao.checklist = {
      documentos,
      observacoes: observacoes ?? null,
      status: status || 'rascunho',
      atualizado_em,
    }
    projeto.markModified('homologacao')
    await projeto.save()

    const totalDocs = documentos.length
    const docsConcluidos = documentos.filter(d => d.concluido).length

    res.json({
      sucesso: true,
      documentos,
      status: status || 'rascunho',
      progresso: {
        concluidos: docsConcluidos,
        total: totalDocs,
        percentual: totalDocs ? ((docsConcluidos / totalDocs) * 100).toFixed(0) : '0',
      },
      data_atualizacao: atualizado_em.toISOString(),
      persistido: true,
    })
  } catch (err) {
    console.error('Erro ao atualizar checklist:', err)
    res.status(500).json({ erro: err.message })
  }
}

export async function atualizarStatusHomologacao(req, res) {
  try {
    const { projetoId } = req.params
    const { status, data_envio, data_aprovacao, art_numero, observacoes } = req.body

    if (!status) {
      return res.status(400).json({ erro: 'Status obrigatório' })
    }

    const statusValidos = ['rascunho', 'enviado', 'analise', 'aprovado', 'conectado']
    if (!statusValidos.includes(status)) {
      return res.status(400).json({ erro: `Status inválido. Opções: ${statusValidos.join(', ')}` })
    }

    // P1-NEW01-HOMOLOGACAO-PERSISTENCE-FIX-01: status legado agora no Mongo (era Map).
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ erro: 'MongoDB indisponível.', codigo: 'DB_OFFLINE' })
    if (!mongoose.Types.ObjectId.isValid(projetoId)) return res.status(400).json({ erro: 'ID de projeto inválido' })
    const projeto = await ProjetoFV.findById(projetoId)
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    projeto.homologacao = projeto.homologacao || {}
    projeto.homologacao.status = status
    if (data_envio)     projeto.homologacao.data_envio = data_envio
    if (data_aprovacao) projeto.homologacao.data_aprovacao = data_aprovacao
    if (art_numero)     projeto.homologacao.art_numero = art_numero
    if (observacoes)    projeto.observacoes = observacoes
    projeto.markModified('homologacao')
    await projeto.save()

    res.json({
      sucesso: true,
      homologacao: projeto.homologacao,
      mensagem: `Status atualizado para: ${status}`,
    })
  } catch (err) {
    console.error('Erro ao atualizar status:', err)
    res.status(500).json({ erro: err.message })
  }
}

export async function obterStatusHomologacao(req, res) {
  try {
    const { projetoId } = req.params

    // P1-NEW01-HOMOLOGACAO-PERSISTENCE-FIX-01: lê do Mongo (era Map).
    let homologacao = { projetoId, status: 'rascunho' }
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(projetoId)) {
      const proj = await ProjetoFV.findById(projetoId).select('homologacao').lean().catch(() => null)
      if (proj?.homologacao) homologacao = { projetoId, ...proj.homologacao }
    }

    res.json({ sucesso: true, homologacao })
  } catch (err) {
    console.error('Erro ao obter status:', err)
    res.status(500).json({ erro: err.message })
  }
}

export async function testarFreezimento(req, res) {
  try {
    const { cliente, unidade, consumo, projeto, concessionariaProfile } = req.body

    if (!cliente || !unidade || !consumo || !projeto) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Dados incompletos: cliente, unidade, consumo, projeto obrigatórios',
      })
    }

    // Import the DTO creation and test functions
    const { createHomologacaoDTO, testHomologacaoImmutability } = await import('../importadores/homologacaoDTO.js')

    // Create frozen DTO
    const frozenDTO = createHomologacaoDTO(cliente, unidade, consumo, projeto, concessionariaProfile)

    // Run immutability attack tests
    const attackResults = testHomologacaoImmutability(frozenDTO)

    res.json({
      sucesso: true,
      tipo: 'homologacao_freeze_test',
      homologacaoDTO: frozenDTO,
      freezeTests: attackResults,
      verdict: attackResults.testsFailed === 0 ? 'FREEZE_SUCCESSFUL' : 'FREEZE_COMPROMISED',
      data_teste: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Erro ao testar freezimento:', err)
    res.status(500).json({
      sucesso: false,
      erro: err.message,
      tipo: 'homologacao_freeze_error',
    })
  }
}
