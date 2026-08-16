/**
 * CotacaoService.js — FV-DOM-001
 *
 * Write path do Aggregate Root Cotacao. Orquestra validação + persistência.
 *
 * Regras de domínio aplicadas aqui:
 *  • toda Cotação pertence a um Projeto FV da MESMA organização (M-4)
 *  • equipamentos da composição existem no Catálogo (integridade referencial)
 *  • QUANTIDADE LIVRE de cotações por projeto — nenhum limite, nenhuma exclusão
 *    mútua entre tecnologias
 *  • uma Cotação NUNCA vira venda, engenharia ou homologação: o agregado não tem
 *    caminho de saída para nada disso (ver cabeçalho do model)
 */

import { Cotacao, TECNOLOGIAS_COTACAO } from '../models/Cotacao.js'
import { ProjetoFV } from '../models/ProjetoFV.js'
import { Equipamento } from '../models/Equipamento.js'
import { CotacaoRepository } from '../repositories/CotacaoRepository.js'

export class ErroValidacaoCotacao extends Error {
  constructor(erros) {
    super('Cotação inválida: ' + erros.join(' | '))
    this.name = 'ErroValidacaoCotacao'
    this.erros = erros
    this.status = 400
    this.codigo = 'COTACAO_INVALIDA'
  }
}

export const CotacaoService = {
  /**
   * Valida o agregado inteiro. Devolve lista de erros (vazia = válido).
   * Não persiste. Faz leitura no Projeto e no Catálogo para checar referências.
   */
  async validar(dados) {
    const erros = []

    // 1) Estrutural (schema — não persiste).
    const doc = dados instanceof Cotacao ? dados : new Cotacao(dados)
    const structural = doc.validateSync()
    if (structural) {
      for (const path of Object.keys(structural.errors)) {
        erros.push(`estrutura: ${path} — ${structural.errors[path].message}`)
      }
    }

    const plano = doc.toObject()

    // 2) Tecnologia — aviso de vocabulário, não bloqueio: a lista é aberta a
    //    extensão (BESS híbrido, novas topologias) e travar aqui engessaria.
    if (plano.tecnologia && !TECNOLOGIAS_COTACAO.includes(plano.tecnologia)) {
      // Não é erro: registra-se como desconhecida, mas a cotação é válida.
    }

    // 3) M-4: o Projeto deve pertencer à MESMA organização da Cotação.
    if (plano.projeto_ref) {
      const projeto = await ProjetoFV.findOne({
        _id: plano.projeto_ref,
        empresa_id: plano.empresa_id ?? null,
      }).select('_id').lean()
      if (!projeto) erros.push(`referência: Projeto ${plano.projeto_ref} não encontrado nesta organização`)
    }

    // 4) Composição — equipamentos existem no Catálogo (GLOBAL, ADR-021 A-8).
    for (let i = 0; i < (plano.composicao || []).length; i++) {
      const item = plano.composicao[i]
      const eq = await Equipamento.findById(item.equipamento_ref).select('_id tipo').lean()
      if (!eq) erros.push(`composicao[${i}]: equipamento ${item.equipamento_ref} não existe no Catálogo`)
    }

    return erros
  },

  /** Cria a Cotação após validar. Lança ErroValidacaoCotacao se inválida. */
  async criar(dados) {
    const erros = await this.validar(dados)
    if (erros.length) throw new ErroValidacaoCotacao(erros)
    return CotacaoRepository.create(dados)
  },

  async buscar(id) {
    return CotacaoRepository.findById(id)
  },

  /** Lista as cotações de um projeto. `filtro` já vem com o escopo aplicado. */
  async listarPorProjeto(filtro) {
    return CotacaoRepository.listarPorProjeto(filtro)
  },

  /** Atualiza validando o ESTADO RESULTANTE (merge do patch sobre o atual). */
  async atualizar(id, patch) {
    const atual = await CotacaoRepository.findByIdLean(id)
    if (!atual) return null
    const erros = await this.validar({ ...atual, ...patch })
    if (erros.length) throw new ErroValidacaoCotacao(erros)
    return CotacaoRepository.update(id, patch)
  },

  async excluir(id) {
    return CotacaoRepository.delete(id)
  },
}

export default CotacaoService
