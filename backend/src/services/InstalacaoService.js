/**
 * InstalacaoService.js — S4A-FV-INSTALACAO-WRITE-PATH-01
 *
 * Write path OFICIAL do Aggregate Root Instalacao. Orquestra VALIDAÇÃO +
 * persistência (via InstalacaoRepository). Operações mínimas: criar, buscar,
 * atualizar, excluir.
 *
 * ISOLADO: não converte Arranjo, não sincroniza, não cria nada automaticamente,
 * não toca ProjetoFV/Engenharia/Unifilar/OCR. Apenas materializa a topologia
 * já aprovada (S2) com integridade.
 *
 * VALIDAÇÃO (integridade do agregado):
 *  - estrutural: schema do Model (validateSync) — composição ≥1, superficie_id,
 *    inversor_ref, tipos, etc.
 *  - referencial: inversor/módulo/otimizador existem no Catálogo e são do tipo
 *    correto; Local existe (se local_ref); Superfície existe no Local (idem).
 *  - INV-03: nº de MPPTs de cada Gerador = n_mppts do Catálogo do inversor.
 */

import { Instalacao } from '../models/Instalacao.js'
import { Equipamento } from '../models/Equipamento.js'
import { Local } from '../models/Local.js'
import { InstalacaoRepository } from '../repositories/InstalacaoRepository.js'
import { contarMpptsInversor } from '../dominio/topologia/index.js'

export class ErroValidacaoInstalacao extends Error {
  constructor(erros) {
    super('Instalação inválida: ' + erros.join(' | '))
    this.name = 'ErroValidacaoInstalacao'
    this.erros = erros
    this.status = 400
  }
}

/** Uma Superfície pertence a um Local? (checa nos subdocs do Local carregado). */
function superficieNoLocal(local, superficie_id) {
  if (!local || !Array.isArray(local.superficies)) return false
  const alvo = String(superficie_id)
  return local.superficies.some((s) => String(s._id) === alvo)
}

export const InstalacaoService = {
  /**
   * Valida o agregado inteiro. Retorna lista de erros (vazia = válido).
   * Não persiste nada. Faz I/O de leitura no Catálogo/Local para checar refs.
   */
  async validar(dados) {
    const erros = []

    // 1) Estrutural (schema do Model — não persiste).
    const doc = dados instanceof Instalacao ? dados : new Instalacao(dados)
    const structural = doc.validateSync()
    if (structural) {
      for (const path of Object.keys(structural.errors)) {
        erros.push(`estrutura: ${path} — ${structural.errors[path].message}`)
      }
    }

    const plano = doc.toObject()
    const geradores = plano.geradores || []
    if (geradores.length === 0) {
      erros.push('agregado: Instalação deve ter ao menos 1 Gerador')
    }

    // 2) Referência ao Local (se informada).
    let localDoc = null
    if (plano.local_ref) {
      localDoc = await Local.findById(plano.local_ref)
      if (!localDoc) erros.push(`referência: Local ${plano.local_ref} não encontrado`)
    }

    // 3) Por Gerador → referências + integridade de MPPT + Strings.
    for (let gi = 0; gi < geradores.length; gi++) {
      const g = geradores[gi]
      const tag = `gerador[${gi}]`

      // Inversor do Catálogo.
      let inv = null
      if (!g.inversor_ref) {
        erros.push(`${tag}: inversor_ref ausente`)
      } else {
        inv = await Equipamento.findById(g.inversor_ref)
        if (!inv) erros.push(`${tag}: inversor ${g.inversor_ref} não existe no Catálogo`)
        else if (inv.tipo !== 'inversor') erros.push(`${tag}: equipamento ${g.inversor_ref} não é inversor (tipo=${inv.tipo})`)
      }

      // INV-03 — nº de MPPTs = n_mppts do Catálogo.
      const mppts = g.mppts || []
      if (inv) {
        const n = contarMpptsInversor(inv)
        if (n == null) erros.push(`${tag}: inversor sem n_mppts no Catálogo — não é possível validar MPPTs`)
        else if (mppts.length !== n) erros.push(`${tag}: ${mppts.length} MPPT(s) declarados ≠ ${n} do Catálogo`)
      }

      // Strings → composição + superfície + otimizador.
      for (let mi = 0; mi < mppts.length; mi++) {
        const strings = mppts[mi].strings || []
        for (let si = 0; si < strings.length; si++) {
          const s = strings[si]
          const stag = `${tag}.mppt[${mi}].string[${si}]`

          for (let ci = 0; ci < (s.composicao || []).length; ci++) {
            const item = s.composicao[ci]
            const mod = await Equipamento.findById(item.modulo_ref)
            if (!mod) erros.push(`${stag}: módulo ${item.modulo_ref} não existe no Catálogo`)
            else if (mod.tipo !== 'modulo') erros.push(`${stag}: equipamento ${item.modulo_ref} não é módulo (tipo=${mod.tipo})`)
          }

          if (s.otimizador_ref) {
            const otim = await Equipamento.findById(s.otimizador_ref)
            if (!otim) erros.push(`${stag}: otimizador ${s.otimizador_ref} não existe no Catálogo`)
          }

          // Superfície — só é resolvível quando há Local carregado.
          if (localDoc && s.superficie_id && !superficieNoLocal(localDoc, s.superficie_id)) {
            erros.push(`${stag}: superfície ${s.superficie_id} não pertence ao Local ${plano.local_ref}`)
          }
        }
      }
    }

    return erros
  },

  /** Cria a Instalação após validar. Lança ErroValidacaoInstalacao se inválida. */
  async criar(dados) {
    const erros = await this.validar(dados)
    if (erros.length) throw new ErroValidacaoInstalacao(erros)
    return InstalacaoRepository.create(dados)
  },

  /** Recupera o agregado (documento) por id. */
  async buscar(id) {
    return InstalacaoRepository.findById(id)
  },

  /**
   * Atualiza o agregado. Valida o ESTADO RESULTANTE (merge do patch sobre o
   * documento atual) antes de persistir.
   */
  async atualizar(id, patch) {
    const atual = await InstalacaoRepository.findByIdLean(id)
    if (!atual) return null
    const resultante = { ...atual, ...patch }
    const erros = await this.validar(resultante)
    if (erros.length) throw new ErroValidacaoInstalacao(erros)
    return InstalacaoRepository.update(id, patch)
  },

  /** Exclui o agregado. Retorna o documento removido ou null. */
  async excluir(id) {
    return InstalacaoRepository.delete(id)
  },
}

export default InstalacaoService
