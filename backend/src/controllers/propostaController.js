/**
 * propostaController — PDF da proposta comercial.
 *
 * ── FV-DOM-015 (execução de D4) ─────────────────────────────────────────────
 * O motor financeiro V1 é a autoridade. Este controller lê o projeto e o
 * orçamento canônico DO BANCO, executa o contrato e entrega o resultado ao
 * gerador do PDF.
 *
 * Antes, `projeto` e `financeiro` vinham do `req.body`: quem chamasse a rota
 * fornecia os próprios números — payback, TIR e VPL inclusive. O corpo agora é
 * ignorado para efeito de cálculo.
 *
 * Histórico: `gerar` e `visualizar` produzem documento NOVO a cada chamada;
 * `download` devolve arquivo previamente salvo, sem recalcular nada. Não há
 * heurística envolvida — são caminhos distintos.
 */
import {
  gerarPropostaComercial as gerarPDF,
  obterPropostaComoBuffer,
} from '../services/propostaComercialService.js'
import { readFileSync } from 'fs'
import { join } from 'path'
import mongoose from 'mongoose'
import { ProjetoFV } from '../models/ProjetoFV.js'
import { aplicarEscopo, tenantDoReq } from '../dominio/tenancy/index.js'
import { OrcamentoService } from '../services/OrcamentoService.js'
import { calcularFinanceiroDoProjeto } from '../dominio/financeiro/index.js'

/**
 * Carrega projeto (com escopo de organização) e executa o contrato financeiro.
 * Devolve `{ erro }` quando o projeto não existe ou não pertence ao tenant.
 */
async function montarContrato(req) {
  const id = req.params.projetoId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { erro: { status: 400, corpo: { erro: 'ID de projeto inválido' } } }
  }

  const projeto = await ProjetoFV
    .findOne(aplicarEscopo({ _id: id }, req, { contexto: 'proposta' }))
    .populate('clienteId', 'nome email telefone')
    .lean()
  if (!projeto) {
    return { erro: { status: 404, corpo: { erro: 'Projeto não encontrado' } } }
  }

  const orcamento = await OrcamentoService.vigenteDoProjeto({
    projeto_ref: projeto._id,
    empresa_id: tenantDoReq(req),
  })

  const contrato = calcularFinanceiroDoProjeto(projeto, { orcamento })
  return { projeto, cliente: projeto.clienteId ?? null, contrato }
}

export async function gerarPropostaComercial(req, res) {
  try {
    const { erro, projeto, cliente, contrato } = await montarContrato(req)
    if (erro) return res.status(erro.status).json(erro.corpo)

    const doc = await gerarPDF(projeto, cliente, contrato)
    const buffer = await obterPropostaComoBuffer(doc)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="proposta_${req.params.projetoId}.pdf"`)
    // Rastreabilidade: o documento declara com que motor e premissas foi feito.
    res.setHeader('X-Contrato-Versao', contrato.contrato_versao)
    res.setHeader('X-Premissas-Versao', contrato.premissas_versao)
    res.send(buffer)
  } catch (err) {
    console.error('Erro ao gerar proposta:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

export async function baixarProposta(req, res) {
  try {
    const { projetoId } = req.params

    // Documento HISTÓRICO: entregue exatamente como foi salvo. Nada é
    // recalculado aqui — é o que D4-C garante.
    const caminho = join(process.cwd(), 'uploads', 'propostas', `proposta_${projetoId}.pdf`)

    try {
      const arquivo = readFileSync(caminho)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="proposta_${projetoId}.pdf"`)
      res.send(arquivo)
    } catch {
      return res.status(404).json({ erro: 'Proposta não encontrada. Gere uma nova.' })
    }
  } catch (err) {
    console.error('Erro ao baixar proposta:', err)
    res.status(500).json({ erro: err.message })
  }
}

export async function visualizarProposta(req, res) {
  try {
    const { erro, projeto, cliente, contrato } = await montarContrato(req)
    if (erro) return res.status(erro.status).json(erro.corpo)

    const doc = await gerarPDF(projeto, cliente, contrato)
    const buffer = await obterPropostaComoBuffer(doc)

    res.json({
      pdf_base64: buffer.toString('base64'),
      contrato_versao: contrato.contrato_versao,
      premissas_versao: contrato.premissas_versao,
      // Lacunas expostas: quem visualiza sabe o que o documento não pôde afirmar.
      lacunas: contrato.lacunas,
    })
  } catch (err) {
    console.error('Erro ao visualizar proposta:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}
