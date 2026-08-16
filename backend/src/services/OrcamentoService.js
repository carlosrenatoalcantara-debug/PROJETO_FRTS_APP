/**
 * OrcamentoService.js — FV-DOM-001
 *
 * Write path do Aggregate Root Orcamento e ponto ÚNICO onde a aprovação
 * acontece — aprovar é congelar e originar o Baseline (M-2).
 *
 * Regras de domínio aplicadas aqui:
 *  • N orçamentos por projeto; nenhum substitui outro (INV-ORC-1/2)
 *  • conteúdo travado a partir de EMITIDO (só o estado evolui)
 *  • apenas UM orçamento APROVADO por projeto (INV-ORC-3)
 *  • aprovar gera Baseline autocontido e imutável
 *  • transições seguem a máquina de estados canônica (fonte única, F3.1)
 */

import mongoose from 'mongoose'
import { Orcamento } from '../models/Orcamento.js'
import { Cotacao } from '../models/Cotacao.js'
import { ProjetoFV } from '../models/ProjetoFV.js'
import { OrcamentoRepository } from '../repositories/OrcamentoRepository.js'
import { BaselineRepository } from '../repositories/BaselineRepository.js'
import { montarConteudoBaseline } from '../dominio/baseline/congelarOrcamento.js'
import {
  conteudoTravado, validarTransicaoOrcamento, ehEstadoOrcamentoValido,
} from '@fortesolar/fv-shared/estados/orcamento'

export class ErroValidacaoOrcamento extends Error {
  constructor(erros) {
    super('Orçamento inválido: ' + erros.join(' | '))
    this.name = 'ErroValidacaoOrcamento'
    this.erros = erros
    this.status = 400
    this.codigo = 'ORCAMENTO_INVALIDO'
  }
}

export class ErroDominioOrcamento extends Error {
  constructor(codigo, mensagem, status = 409) {
    super(mensagem)
    this.name = 'ErroDominioOrcamento'
    this.codigo = codigo
    this.status = status
  }
}

/** Campos que descrevem o CONTEÚDO comercial — travados a partir de EMITIDO. */
const CAMPOS_CONTEUDO = ['itens', 'condicoes', 'cotacao_ref', 'numero', 'versao']

export const OrcamentoService = {
  async validar(dados) {
    const erros = []

    const doc = dados instanceof Orcamento ? dados : new Orcamento(dados)
    const structural = doc.validateSync()
    if (structural) {
      for (const path of Object.keys(structural.errors)) {
        erros.push(`estrutura: ${path} — ${structural.errors[path].message}`)
      }
    }

    const plano = doc.toObject()

    // M-4: Projeto da MESMA organização.
    if (plano.projeto_ref) {
      const projeto = await ProjetoFV.findOne({
        _id: plano.projeto_ref, empresa_id: plano.empresa_id ?? null,
      }).select('_id').lean()
      if (!projeto) erros.push(`referência: Projeto ${plano.projeto_ref} não encontrado nesta organização`)
    }

    // M-1 + M-4: a Cotação de origem existe, é da mesma organização e — regra
    // central — pertence AO MESMO projeto. Sem isso, um orçamento poderia
    // derivar da simulação de outro cliente.
    if (plano.cotacao_ref) {
      const cot = await Cotacao.findOne({
        _id: plano.cotacao_ref, empresa_id: plano.empresa_id ?? null,
      }).select('_id projeto_ref').lean()
      if (!cot) {
        erros.push(`referência: Cotação ${plano.cotacao_ref} não encontrada nesta organização`)
      } else if (plano.projeto_ref && String(cot.projeto_ref) !== String(plano.projeto_ref)) {
        erros.push(`referência: Cotação ${plano.cotacao_ref} pertence a outro projeto (${cot.projeto_ref})`)
      }
    }

    return erros
  },

  /** Cria um orçamento em RASCUNHO. Não substitui nenhum orçamento anterior. */
  async criar(dados) {
    const plano = { ...dados, estado: 'RASCUNHO', baseline_ref: null }
    const erros = await this.validar(plano)
    if (erros.length) throw new ErroValidacaoOrcamento(erros)
    return OrcamentoRepository.create(plano)
  },

  async buscar(id) {
    return OrcamentoRepository.findById(id)
  },

  async listarPorProjeto(filtro) {
    return OrcamentoRepository.listarPorProjeto(filtro)
  },

  /**
   * Atualiza o CONTEÚDO. Só é permitido em RASCUNHO — a partir de EMITIDO o
   * orçamento é um documento entregue ao cliente e não pode mudar por baixo.
   * Mudanças posteriores se fazem emitindo um NOVO orçamento (INV-ORC-2).
   */
  async atualizarConteudo(id, patch) {
    const atual = await OrcamentoRepository.findByIdLean(id)
    if (!atual) return null

    const tocaConteudo = Object.keys(patch).some((k) => CAMPOS_CONTEUDO.includes(k))
    if (tocaConteudo && conteudoTravado(atual.estado)) {
      throw new ErroDominioOrcamento(
        'ORCAMENTO_TRAVADO',
        `Orçamento ${atual.estado}: conteúdo imutável. Crie um NOVO orçamento — o histórico não é sobrescrito.`,
      )
    }
    // `estado` nunca passa por aqui: transição tem caminho próprio.
    const seguro = { ...patch }
    delete seguro.estado
    delete seguro.baseline_ref

    const erros = await this.validar({ ...atual, ...seguro })
    if (erros.length) throw new ErroValidacaoOrcamento(erros)
    return OrcamentoRepository.update(id, seguro)
  },

  /**
   * Executa uma transição de estado. Para APROVADO, delega a `aprovar` — que é
   * o único caminho que congela e gera Baseline.
   */
  async transicionar(id, novoEstado, { por = null, motivo = null } = {}) {
    if (!ehEstadoOrcamentoValido(novoEstado)) {
      throw new ErroDominioOrcamento('ESTADO_INVALIDO', `Estado "${novoEstado}" não pertence ao vocabulário do Orçamento.`, 422)
    }
    if (novoEstado === 'APROVADO') return this.aprovar(id, { por })

    const doc = await OrcamentoRepository.findById(id)
    if (!doc) return null

    const r = validarTransicaoOrcamento(doc.estado, novoEstado)
    if (!r.ok) throw new ErroDominioOrcamento('TRANSICAO_INVALIDA', r.motivo, 422)

    const agora = new Date()
    const anterior = doc.estado
    doc.estado = novoEstado
    if (novoEstado === 'EMITIDO') {
      doc.emitido_em = agora
      doc.emitido_por = por
    }
    if (novoEstado === 'REJEITADO' || novoEstado === 'CANCELADO') {
      doc.encerrado_em = agora
      doc.encerrado_por = por
      doc.motivo_encerramento = motivo
    }
    doc.historico.push({ em: agora, de: anterior, para: novoEstado, por, motivo })
    await doc.save()
    return doc
  },

  /**
   * APROVAÇÃO — congela o orçamento e gera o Baseline.
   *
   * Ordem deliberada: aprova PRIMEIRO, gera a Baseline DEPOIS.
   *
   * Não há transação distribuída aqui (o deploy roda em standalone). Se a
   * segunda etapa falhar, o estado resultante é "aprovado sem baseline" — e o
   * Gate permanece FECHADO, que é o modo seguro. A ordem inversa produziria uma
   * Baseline órfã capaz de ABRIR o gate para um orçamento não aprovado.
   */
  async aprovar(id, { por = null } = {}) {
    const doc = await OrcamentoRepository.findById(id)
    if (!doc) return null

    const r = validarTransicaoOrcamento(doc.estado, 'APROVADO')
    if (!r.ok) throw new ErroDominioOrcamento('TRANSICAO_INVALIDA', r.motivo, 422)

    // INV-ORC-3 — verificação explícita para devolver erro de DOMÍNIO. O índice
    // parcial único no model é a garantia de última instância (corrida).
    const jaAprovado = await OrcamentoRepository.acharAprovado({ projeto_ref: doc.projeto_ref })
    if (jaAprovado && String(jaAprovado._id) !== String(doc._id)) {
      throw new ErroDominioOrcamento(
        'ORCAMENTO_APROVADO_EXISTENTE',
        `Projeto já possui orçamento aprovado (${jaAprovado._id}). Apenas um orçamento pode ser aprovado.`,
      )
    }

    const cotacao = await Cotacao.findById(doc.cotacao_ref).lean()
    if (!cotacao) {
      throw new ErroDominioOrcamento('COTACAO_AUSENTE', `Cotação de origem ${doc.cotacao_ref} não encontrada — impossível congelar a Baseline.`, 422)
    }

    const agora = new Date()
    const anterior = doc.estado

    // Snapshot construído ANTES de tocar o documento: se o congelamento falhar,
    // nada foi alterado.
    const { conteudo, hash } = montarConteudoBaseline({
      orcamento: doc.toObject(), cotacao, em: agora,
    })

    doc.estado = 'APROVADO'
    doc.aprovado_em = agora
    doc.aprovado_por = por
    doc.historico.push({ em: agora, de: anterior, para: 'APROVADO', por, motivo: 'Aprovação comercial' })
    try {
      await doc.save()
    } catch (err) {
      // Corrida perdida contra o índice parcial único.
      if (err?.code === 11000) {
        throw new ErroDominioOrcamento('ORCAMENTO_APROVADO_EXISTENTE', 'Projeto já possui orçamento aprovado.')
      }
      throw err
    }

    let baseline
    try {
      baseline = await BaselineRepository.create({
        empresa_id:    doc.empresa_id ?? null,
        projeto_ref:   doc.projeto_ref,
        orcamento_ref: doc._id,
        cotacao_ref:   doc.cotacao_ref,
        conteudo,
        hash,
        congelado_em:  agora,
        congelado_por: por,
      })
    } catch (err) {
      // Compensação: devolve o orçamento ao estado anterior para não deixar um
      // aprovado permanentemente sem baseline. Se a compensação também falhar,
      // o gate continua fechado — nunca abre indevidamente.
      try {
        doc.estado = anterior
        doc.aprovado_em = null
        doc.aprovado_por = null
        doc.historico.push({ em: new Date(), de: 'APROVADO', para: anterior, por, motivo: 'Rollback: falha ao congelar Baseline' })
        await doc.save()
      } catch { /* estado seguro por omissão: aprovado sem baseline mantém o gate fechado */ }
      throw err
    }

    doc.baseline_ref = baseline._id
    await doc.save()

    return { orcamento: doc, baseline }
  },

  /** O orçamento aprovado do projeto, se existir. */
  async acharAprovado(filtro) {
    return OrcamentoRepository.acharAprovado(filtro)
  },

  /**
   * Orçamento VIGENTE do projeto — o que a leitura deve exibir.
   *
   * Precedência: o aprovado manda (é o que virou contrato); na ausência dele, o
   * mais recente em elaboração. Rejeitados e cancelados nunca são vigentes.
   */
  async vigenteDoProjeto(filtro) {
    const aprovado = await OrcamentoRepository.acharAprovado(filtro)
    if (aprovado) return aprovado
    const lista = await OrcamentoRepository.listarPorProjeto({
      ...filtro, estado: { $in: ['RASCUNHO', 'EMITIDO'] },
    })
    return lista[0] || null
  },

  /**
   * CONVERGÊNCIA (FV-DOM-002) — grava a etapa `orcamento` do wizard nos
   * agregados novos, em vez do subdocumento legado.
   *
   * O wizard envia a forma legada e não cria Cotação. Como `Orcamento` exige uma
   * origem (M-1), o Core sintetiza a Cotação a partir do estado técnico do
   * projeto na primeira vez e a reutiliza depois.
   *
   * Idempotente por etapa: reenviar a etapa ATUALIZA o orçamento em elaboração
   * em vez de criar um novo a cada salvamento — salvar não é emitir. Se o
   * vigente já estiver travado (EMITIDO+), um NOVO orçamento é criado, porque o
   * anterior não pode ser sobrescrito (INV-ORC-2).
   *
   * @returns {{ orcamento: object, cotacao: object, acao: 'criado'|'atualizado' }}
   */
  async gravarEtapaOrcamento({ projeto, dados, empresa_id = null, por = null }) {
    const { converterEtapaOrcamento, cotacaoDoProjeto } = await import('../dominio/orcamento/converterEtapaOrcamento.js')
    const filtro = { projeto_ref: projeto._id, empresa_id }

    const vigente = await this.vigenteDoProjeto(filtro)
    const { itens, condicoes } = converterEtapaOrcamento(dados)

    // Reaproveita a Cotação do vigente; senão sintetiza uma.
    let cotacao_ref = vigente?.cotacao_ref ?? null
    let cotacao = null
    if (!cotacao_ref) {
      const { CotacaoService } = await import('./CotacaoService.js')
      cotacao = await CotacaoService.criar({
        ...cotacaoDoProjeto(projeto), empresa_id, projeto_ref: projeto._id, criado_por: por,
      })
      cotacao_ref = cotacao._id
    }

    if (vigente && !conteudoTravado(vigente.estado)) {
      const doc = await this.atualizarConteudo(vigente._id, { itens, condicoes })
      return { orcamento: doc, cotacao, acao: 'atualizado' }
    }

    const doc = await this.criar({
      empresa_id, projeto_ref: projeto._id, cotacao_ref, itens, condicoes, criado_por: por,
    })
    return { orcamento: doc, cotacao, acao: 'criado' }
  },
}

export default OrcamentoService
