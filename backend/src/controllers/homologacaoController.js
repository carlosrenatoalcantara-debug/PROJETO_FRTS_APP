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
import { projetoEstaCongelado } from '@fortesolar/fv-shared/estados/congelamento'
/**
 * FV-UX-034 — `aplicarEscopo` era usado em SEIS lugares deste arquivo e não era
 * importado em nenhum. Quatro endpoints respondiam HTTP 500
 * (`ReferenceError: aplicarEscopo is not defined`): ler e gravar checklist, ler
 * e gravar status de homologação.
 *
 * ── Por que isto NÃO reabre a dívida B7 ──────────────────────────────────────
 * Os outros dois usos estão dentro de `_carregarDepsDocumento`, que referencia
 * um `req` que também não é parâmetro dela. Importar `aplicarEscopo` não define
 * `req`: aquela função continua lançando `ReferenceError`, continua caindo no
 * próprio `catch` e continua devolvendo o objeto vazio. A dívida registrada na
 * FV-DOM-031E segue exatamente como estava, e nenhum memorial muda — provado
 * em `validacao-fv-ux-034.mjs`.
 */
import { aplicarEscopo } from '../dominio/tenancy/index.js'
import { BaselineService } from '../services/BaselineService.js'
import { ErroGate } from '../dominio/gate/index.js'
import { arranjosCanonicos } from '../dominio/topologia/arranjosCanonicos.js'

// P1-NEW01-HOMOLOGACAO-PERSISTENCE-FIX-01: o Map() legado foi REMOVIDO.
// Todo o estado de homologação (checklist + status legado) agora persiste no Mongo
// (ProjetoFV.homologacao). Nenhum estado depende mais de memória de processo.

/**
 * P1-HOMOLOGACAO-SNAPSHOT-01: o projeto está congelado (engenharia travada)?
 * Quando CONGELADO/HOMOLOGADO, a homologação DEVE usar o snapshot_catalogo
 * (equipamentos do orçamento aprovado), não o catálogo vivo.
 */
// FV-DOM-002A: decisão vem do contrato único, nunca de um booleano local.
const _estaCongelado = projetoEstaCongelado

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
/**
 * FV-DOM-031C — topologia de micro do arranjo principal, para o memorial.
 * `null` quando o projeto não é micro; o memorial então segue o texto de string,
 * intacto. Sem heurística: `micros[]` preenchido é o fato.
 */
function _microsDoProjeto(proj) {
  // F14-4: era `arranjos.find(principal) ?? arranjos[0]` — escolhia UM arranjo e
  // descrevia os micros dele como se fossem os do sistema. Agora atravessa
  // todos, pelo adapter, sem seleção por posição.
  const lista = arranjosCanonicos(proj).arranjos.flatMap((a) => a.topologia.micros)
  return lista.length > 0 ? lista : null
}

/**
 * O documento de homologação consegue representar ESTE projeto? — F14-4.
 *
 * ── O que a auditoria realmente encontrou ───────────────────────────────────
 * A F14 registrou que este controller "descarta até 354 de 565 módulos". A
 * medição estava certa sobre a FORMA da seleção e errada sobre o alvo: os
 * documentos não leem contagem de módulos de `arranjos[]`. O memorial recebe um
 * modelo PLANO pelo corpo da requisição — `projeto.inversor`, `projeto.painel`,
 * `projeto.potencia_kwp` — que nunca teve arranjos. `arranjos[]` entrava aqui
 * só por `_microsDoProjeto`.
 *
 * O risco documental é real, mas é outro: o modelo plano descreve UM inversor e
 * UM módulo. Num projeto cujos arranjos têm inversores diferentes — Mercado
 * Avelino é Huawei 60K **e** Solplanet 50K — o documento enviado à
 * distribuidora descreve metade da usina, e nada avisa.
 *
 * ── A decisão ───────────────────────────────────────────────────────────────
 * O template é singular. Fingir suporte seria inventar um documento; emitir
 * assim mesmo seria declarar usina parcial. Então: recusa a emissão, com motivo
 * nomeado, só nos casos em que o modelo plano de fato não representa o projeto.
 *
 * Não bloqueia por ser multiarranjo. Bloqueia por ser IRREPRESENTÁVEL:
 *   · mais de um MODELO de inversor entre os arranjos — o documento cita um;
 *   · mais de um arranjo com topologia de micro — a seção mostra uma lista.
 *
 * Dois arranjos do mesmo inversor somam quantidade e continuam representáveis.
 *
 * @returns {{suportado: boolean, motivo?: string, detalhe?: object}}
 */
function _avaliarSuporteDocumental(proj) {
  const canonico = arranjosCanonicos(proj)
  if (!canonico.multiarranjo) return { suportado: true }

  const modelos = [...new Set(canonico.arranjos
    .flatMap((a) => a.inversor.itens.map((i) => i.modelo))
    .filter(Boolean))]
  if (modelos.length > 1) {
    return {
      suportado: false,
      motivo: 'MULTIARRANJO_INVERSORES_DIFERENTES',
      detalhe: {
        arranjos: canonico.arranjos.length,
        modelos_de_inversor: modelos,
        explicacao: 'O documento descreve um inversor. Este projeto tem arranjos com '
          + 'inversores diferentes — emiti-lo declararia uma usina menor que a projetada.',
      },
    }
  }

  const comMicros = canonico.arranjos.filter((a) => a.topologia.micros.length > 0)
  if (comMicros.length > 1) {
    return {
      suportado: false,
      motivo: 'MULTIARRANJO_MICROS_EM_VARIOS_ARRANJOS',
      detalhe: {
        arranjos_com_micros: comMicros.map((a) => a.id),
        explicacao: 'A seção de arranjo do memorial mostra uma topologia de micro. '
          + 'Este projeto tem micros em mais de um arranjo.',
      },
    }
  }
  return { suportado: true }
}

/** Recusa a emissão quando o documento não representa o projeto. */
function _recusarSeNaoRepresentavel(projDoc, res) {
  const suporte = _avaliarSuporteDocumental(projDoc)
  if (suporte.suportado) return false
  res.status(422).json({
    erro: 'O documento de homologação não representa este projeto sem perda de informação.',
    codigo: suporte.motivo,
    detalhe: suporte.detalhe,
  })
  return true
}

async function _carregarDepsDocumento(projetoId, projetoBody) {
  const out = { equipamentos: [], beneficiarias: [], origem: 'vivo', itens_adicionais: [], micros: null }
  try {
    if (mongoose.connection?.readyState !== 1) return out
    let proj = projetoBody
    const idValido = projetoId && mongoose.Types.ObjectId.isValid(projetoId)
    if (idValido) { const p = await ProjetoFV.findOne(aplicarEscopo({ _id: projetoId }, req, { contexto: 'homolog.projeto' })).lean().catch(() => null); if (p) proj = p }

    // Beneficiárias independem da origem dos equipamentos.
    if (idValido) out.beneficiarias = await UnidadeBeneficiaria.find(aplicarEscopo({ projetoId }, req, { contexto: 'homolog.beneficiarias' })).lean().catch(() => [])

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

/**
 * FV-UX-034 — o Gate deixa de ser CONSULTIVO na homologação.
 *
 * A auditoria mediu o buraco: a opção NÃO escolhida de uma proposta tinha
 * `gate.homologacao.liberado = false` e mesmo assim gerava memorial com HTTP
 * 200. Nenhum caminho deste controller chamava `exigirGate` — o Gate era lido
 * pela tela e ignorado pela API.
 *
 * A regra já estava decidida na FV-DOM-032:
 *   • regra 5 — só a opção aceita ultrapassa o Gate de execução/homologação;
 *   • regra 9 — as não escolhidas ficam bloqueadas para AVANÇO OPERACIONAL,
 *     mas continuam CONSULTÁVEIS para histórico/comercial.
 *
 * A linha entre as duas: gerar documento de homologação e mexer em
 * status/checklist é avanço operacional — é o produto da fase. LER status e
 * checklist é consulta, e continua aberto. Nenhuma regra nova foi inventada
 * aqui; a decidida passou a valer também na API.
 *
 * O mesmo guard cobre projeto sem opções: aí `estadoDaOpcao` devolve `null` e
 * a decisão é a de sempre — Baseline íntegra libera, ausência bloqueia.
*
 * FV-UX-040: EXPORTADO. A FV-UX-034 cobriu memorial, carta, ART, status e
 * checklist — e deixou de fora `/protocolo` e `/assistida/status`, que moram no
 * arquivo de rotas e também são AVANÇO. A auditoria desta sprint mediu a
 * consequência: a opção NÃO escolhida gravava número de protocolo e chegava a
 * `homologado` na homologação assistida. A regra já existia (FV-DOM-032, regra
 * 5); faltava aplicá-la ali. Exportar o guard evita reescrevê-lo — uma decisão,
 * um lugar.
 */
export async function _exigirGateHomologacao(req, res) {
  const { projetoId } = req.params
  if (!mongoose.Types.ObjectId.isValid(projetoId)) return true
  try {
    await BaselineService.exigirGate('homologacao', {
      projeto_ref: projetoId,
      empresa_id: req?.auth?.empresa_id ?? req?.auth?.empresaId ?? undefined,
    })
    return true
  } catch (err) {
    if (err instanceof ErroGate) {
      res.status(err.status || 409).json({ erro: err.message, codigo: err.codigo })
      return false
    }
    throw err
  }
}

export async function gerarMemorial(req, res) {
  try {
    if (!(await _exigirGateHomologacao(req, res))) return
    const { projetoId } = req.params
    const { projeto, cliente } = req.body

    if (!projeto || !cliente) {
      return res.status(400).json({ erro: 'Dados do projeto e cliente obrigatórios' })
    }

    const deps = await _carregarDepsDocumento(projetoId, projeto)
    // P1-HOMOLOGACAO-SNAPSHOT-01: projeto congelado usa equipamentos do snapshot.
    const { projeto: projDoc } = _aplicarSnapshotEquip(projeto)
    // FV-DOM-031C: a topologia de micro sai do PRÓPRIO projeto recebido, e não
    // de `_carregarDepsDocumento`. Aquele helper referencia um `req` que não é
    // parâmetro dele — a exceção cai no `catch` e ele devolve o objeto vazio.
    // Defeito PRÉ-EXISTENTE, relatado e não corrigido aqui: corrigi-lo
    // reativaria o enriquecimento pelo Atlas vivo e mudaria o memorial de
    // projetos string, que esta sprint tem de deixar intacto.
    if (_recusarSeNaoRepresentavel(projDoc, res)) return
    const micros = _microsDoProjeto(projDoc)
    const memorial = gerarMemorialDescritivo(projDoc, cliente, { ...deps, micros })

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
    if (!(await _exigirGateHomologacao(req, res))) return
    const { projetoId } = req.params
    const { projeto, cliente } = req.body

    if (!projeto || !cliente) {
      return res.status(400).json({ erro: 'Dados do projeto e cliente obrigatórios' })
    }

    // P1-HOMOLOGACAO-SNAPSHOT-01: projeto congelado usa equipamentos do snapshot.
    const { projeto: projDoc, origem } = _aplicarSnapshotEquip(projeto)
    if (_recusarSeNaoRepresentavel(projDoc, res)) return
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
    if (!(await _exigirGateHomologacao(req, res))) return
    const { projetoId } = req.params
    const { projeto } = req.body

    if (!projeto) {
      return res.status(400).json({ erro: 'Dados do projeto obrigatórios' })
    }

    // P1-HOMOLOGACAO-SNAPSHOT-01: projeto congelado usa equipamentos do snapshot.
    const { projeto: projDoc, origem } = _aplicarSnapshotEquip(projeto)
    if (_recusarSeNaoRepresentavel(projDoc, res)) return
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

    /**
     * FV-UX-038 (D3): a concessionária e a UF vêm do PROJETO quando a query não
     * as informa.
     *
     * Medido na FV-UX-037: o projeto declarava Neoenergia/RN na fatura e na
     * localização, e o checklist respondia `"Não informada"` / `"N/A"` — porque
     * este endpoint só olhava `req.query`, e a UX nova não passava nada. O dado
     * já existia; ninguém o lia.
     *
     * A query continua tendo precedência: quem informa explicitamente manda,
     * e o comportamento de quem já chamava com parâmetros não muda.
     */
    let { estado, concessionaria } = req.query
    if ((!estado || !concessionaria)
      && mongoose.connection.readyState === 1
      && mongoose.Types.ObjectId.isValid(projetoId)) {
      const p = await ProjetoFV.findOne(
        aplicarEscopo({ _id: projetoId }, req, { contexto: 'homolog.checklist.local' }))
        .select('localizacao.estado fatura_extracao.concessionaria fatura.concessionaria uf')
        .lean().catch(() => null)
      estado = estado
        || p?.localizacao?.estado
        || p?.uf
        || undefined
      concessionaria = concessionaria
        || p?.fatura_extracao?.concessionaria
        || p?.fatura?.concessionaria
        || undefined
    }

    // Template determinístico (base / fallback quando nunca foi salvo)
    const template = gerarChecklistDocumentos(estado, concessionaria)

    // P1-NEW01-HOMOLOGACAO-PERSISTENCE-FIX-01: retorna o ESTADO REAL persistido no
    // Mongo (antes o GET gerava o template e ignorava o que foi salvo no Map).
    let origem = 'template'
    let checklist = template
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(projetoId)) {
      const proj = await ProjetoFV.findOne(aplicarEscopo({ _id: projetoId }, req, { contexto: 'homolog.checklist' })).select('homologacao.checklist').lean().catch(() => null)
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
    if (!(await _exigirGateHomologacao(req, res))) return
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
    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: projetoId }, req, { contexto: 'homolog.projeto' }))
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
    if (!(await _exigirGateHomologacao(req, res))) return
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
    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: projetoId }, req, { contexto: 'homolog.projeto' }))
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
      const proj = await ProjetoFV.findOne(aplicarEscopo({ _id: projetoId }, req, { contexto: 'homolog.status' })).select('homologacao').lean().catch(() => null)
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
