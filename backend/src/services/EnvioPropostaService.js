/**
 * EnvioPropostaService — FV-UX-035.
 *
 * O ato de disponibilizar a proposta ao cliente.
 *
 * ── Decisão de negócio desta sprint (registrada literalmente) ───────────────
 * "Reutilizar o mecanismo existente `governanca.comercial.compartilhamentos[]`,
 *  mantendo no mesmo fluxo o token, snapshot canônico, rota pública, página do
 *  cliente e tracking. O snapshot deve ser criado a partir da proposta no
 *  momento do envio e representar exatamente a versão enviada ao cliente. O
 *  envio não deve alterar nem congelar o legado de forma paralela, nem criar
 *  uma segunda fonte de verdade. Não reutilizar `criarCompartilhamento` do
 *  legado como fonte de verdade. O compartilhamento canônico deve ser o
 *  mecanismo oficial."
 *
 * Logo:
 *   • MESMO armazenamento — `compartilhamentos[]` — e portanto mesmo token,
 *     mesma rota pública, mesma página do cliente, mesmo tracking;
 *   • ENTRADA PRÓPRIA — este service não chama `criarCompartilhamento`, que
 *     exige o freeze da governança comercial legada (medido: 409
 *     SEM_SNAPSHOT_CONGELADO para toda opção /fv, cuja `governanca.comercial`
 *     nem existe). O fluxo canônico não aciona nem escreve aquele workflow;
 *   • FONTE CANÔNICA do snapshot — Orçamento aprovado + Baseline de cada opção;
 *   • ESCOPO DE GRUPO — um envio cobre a proposta inteira (`proposta_grupo_id`),
 *     com todas as opções, porque a proposta É o grupo (FV-DOM-032).
 *
 * O e-mail é ACESSÓRIO: o envio existe assim que o link existe. Sem credencial
 * SMTP o `mailService` devolve `{enviado:false}` sem lançar, e o envio continua
 * válido — o operador copia o link. Nunca se afirma que foi entregue quando não
 * foi.
 */
import mongoose from 'mongoose'
import { ProjetoFV } from '../models/ProjetoFV.js'
import { OrcamentoService } from './OrcamentoService.js'
import { composicaoDoProjeto } from './arranjosService.js'
import { BaselineService } from './BaselineService.js'
import { enviarEmail, smtpConfigurado } from './mailService.js'
import { calcularHash } from '../dominio/baseline/congelarOrcamento.js'
// Totais são DERIVADOS, nunca persistidos (INV-58). Esta é a única fórmula.
import { totaisDeItens } from '../dominio/orcamento/obterOrcamentoProjeto.js'
import {
  ORIGEM_ENVIO_CANONICO, MOTIVOS_PROPOSTA, ErroProposta, avaliarEnvio,
} from '../dominio/proposta/index.js'

/**
 * FV-INFRA-058: a origem vem da fonte única e é resolvida NA CHAMADA, não no
 * import. Antes, `APP_URL || 'http://localhost:5173'` era congelado no carregamento
 * do módulo — e sem a variável definida a proposta saía com um link para uma porta
 * de desenvolvimento (medido na FV-QA-056). Em staging/produção agora falha alto
 * em vez de emitir link inválido.
 */
import { urlPublica } from '../config/origens.js'
const VALIDADE_PADRAO_DIAS = 30

/**
 * Lê as opções do grupo com o que a proposta precisa mostrar.
 *
 * Este é o MESMO conjunto de campos que `listarOpcoesFV` já expõe na UX
 * interna; o que muda aqui é só o recorte — o cliente não vê custo, margem nem
 * markup, coerente com a promessa da rota pública.
 */
export async function lerOpcoesDoGrupo(grupoId, empresaId) {
  const filtroBase = { proposta_grupo_id: grupoId, excluido: { $ne: true } }
  if (empresaId) filtroBase.empresa_id = empresaId
  const opcoes = await ProjetoFV.find(filtroBase)
    .select('nome opcao_numero opcao_rotulo proposta_aceite '
      + 'dimensionamento.potencia_kwp dimensionamento.num_paineis '
      + 'equipamentos.inversor equipamentos.paineis equipamentos.estrutura '
      + 'arranjos.topologia arranjos.paineis arranjos.inversores '
      + 'arranjos.configuracao_eletrica.micros engenharia_eletrica.arranjo.mppts')
    .sort({ opcao_numero: 1 }).lean()

  return Promise.all(opcoes.map(async (o) => {
    const filtro = { projeto_ref: o._id, empresa_id: empresaId }
    const [orc, baseline] = await Promise.all([
      OrcamentoService.vigenteDoProjeto(filtro).catch(() => null),
      BaselineService.doProjeto(filtro).catch(() => null),
    ])
    const composicao = composicaoDoProjeto(o)
    // Topologia: `micros[]` preenchido é o fato (FV-DOM-031C).
    const arranjo = (o.arranjos ?? [])[0] ?? null
    const topologia = arranjo?.configuracao_eletrica?.micros?.length ? 'micro'
      : (arranjo?.topologia ?? (o.engenharia_eletrica?.arranjo?.mppts?.length ? 'string' : null))
    return {
      projeto_ref: String(o._id),
      opcao_numero: o.opcao_numero ?? null,
      opcao_rotulo: o.opcao_rotulo ?? null,
      nome: o.nome ?? null,
      potencia_kwp: o.dimensionamento?.potencia_kwp ?? null,
      num_paineis: o.dimensionamento?.num_paineis ?? null,
      topologia,
      // FV-UX-038 (D1): o cliente precisa ver QUANTOS e QUAIS. `inversor`
      // continua no snapshot — resumo legível e compatibilidade com os
      // snapshots já congelados, que só têm este campo.
      inversores: composicao.inversores.map((i) => ({
        marca: i.marca, modelo: i.modelo, quantidade: i.quantidade,
        potencia_kw: i.potencia_kw,
      })),
      modulos: composicao.modulos.map((m) => ({
        marca: m.marca, modelo: m.modelo, quantidade: m.quantidade, potencia_w: m.potencia_w,
      })),
      inversor: composicao.inversores.length === 1
        ? composicao.inversores[0].modelo
        : (composicao.inversores.length > 1
          ? `${composicao.inversores.length} modelos` : null),
      estrutura: o.equipamentos?.estrutura?.tipo ?? null,
      // Preço de VENDA — é o que o cliente vê. Custo/margem ficam de fora.
      // `orc.totais` NÃO existe: totais são derivados a cada leitura (INV-58).
      valor_total_r: orc ? totaisDeItens(orc.itens).total_venda_r : null,
      orcamento: orc ? { numero: orc.numero, versao: orc.versao, estado: orc.estado } : null,
      baseline_hash: baseline?.hash ?? null,
      aceita: o.proposta_aceite?.aceita === true,
    }
  }))
}

/**
 * Monta o snapshot que será congelado no envio — a proposta exatamente como o
 * cliente vai vê-la. Nada é recalculado depois: a página pública devolve isto.
 */
export async function montarSnapshotDaProposta({ grupoId, empresaId, cliente = null }) {
  const opcoes = await lerOpcoesDoGrupo(grupoId, empresaId)
  if (opcoes.length === 0) {
    throw new ErroProposta(MOTIVOS_PROPOSTA.SEM_GRUPO_DE_PROPOSTA,
      'A proposta não tem opções para enviar.')
  }
  // Sem orçamento aprovado não há preço a mostrar — enviar seria enviar vazio.
  const semPreco = opcoes.filter((o) => o.valor_total_r === null)
  if (semPreco.length > 0) {
    throw new ErroProposta(MOTIVOS_PROPOSTA.SEM_ORCAMENTO_APROVADO,
      `Sem orçamento vigente em: ${semPreco.map((o) => o.opcao_rotulo ?? o.nome).join(', ')}.`)
  }

  const conteudo = {
    tipo: 'proposta_fv',
    proposta_grupo_id: String(grupoId),
    cliente: cliente ? { nome: cliente.nome ?? null } : null,
    opcoes,
  }
  return { conteudo, hash: calcularHash(conteudo) }
}

/**
 * Envia (disponibiliza) a proposta ao cliente.
 *
 * Grava UMA entrada de compartilhamento marcada como canônica em CADA irmã do
 * grupo. A entrada é idêntica nas irmãs — mesmo `share_id`, mesmo token, mesmo
 * snapshot — porque o envio é do GRUPO, e o grupo não tem documento próprio
 * (FV-DOM-032: "o grupo não aponta para nenhuma das opções"). Escrever nas N
 * irmãs mantém a leitura possível a partir de qualquer uma, sem inventar um
 * agregado novo; a cópia não diverge porque nada a atualiza depois — só o
 * tracking, que a rota pública já grava num documento só.
 *
 * @returns {{ share_id, token, url, validade, snapshot_hash, email }}
 */
export async function enviarProposta({ projeto, empresaId, cliente = null,
  validade_dias = VALIDADE_PADRAO_DIAS, usuario = null, destinatario = null }) {
  if (!projeto?.proposta_grupo_id) {
    throw new ErroProposta(MOTIVOS_PROPOSTA.SEM_GRUPO_DE_PROPOSTA,
      'Projeto não participa de uma proposta com opções.')
  }
  const grupoId = projeto.proposta_grupo_id

  const { conteudo, hash } = await montarSnapshotDaProposta({ grupoId, empresaId, cliente })

  const agora = new Date()
  const dias = Number(validade_dias)
  const validade = new Date(agora.getTime()
    + (Number.isFinite(dias) && dias > 0 ? dias : VALIDADE_PADRAO_DIAS) * 86400000)
  const token = `${String(grupoId).slice(-6)}${agora.getTime().toString(36)}`
    + `${new mongoose.Types.ObjectId().toString().slice(-8)}`
  const share_id = `ENVIO-${agora.getTime().toString(36)}`

  const entrada = {
    share_id, token,
    origem: ORIGEM_ENVIO_CANONICO,
    proposta_grupo_id: grupoId,
    cenario_id: null,
    revisao: null,
    snapshot_hash: hash,
    criado_em: agora,
    criado_por: usuario,
    validade,
    somente_leitura: true,
    snapshot: conteudo,
    tracking: { visualizacoes: 0, primeiro_acesso: null, ultimo_acesso: null, acessos: [] },
  }

  // A mesma entrada em todas as irmãs — o envio é do grupo.
  const filtroGrupo = { proposta_grupo_id: grupoId, excluido: { $ne: true } }
  if (empresaId) filtroGrupo.empresa_id = empresaId

  // Projeto do fluxo /fv nasce com `governanca: null` — o wizard legado é quem
  // a preenchia. `$push` num caminho sob null falha ("Cannot create field
  // 'comercial' in element {governanca: null}"), então o berço vem antes.
  await ProjetoFV.updateMany(
    { ...filtroGrupo, $or: [{ governanca: null }, { governanca: { $exists: false } }] },
    { $set: { governanca: { comercial: { compartilhamentos: [] } } } },
  )
  await ProjetoFV.updateMany(
    { ...filtroGrupo, 'governanca.comercial': null },
    { $set: { 'governanca.comercial': { compartilhamentos: [] } } },
  )
  await ProjetoFV.updateMany(filtroGrupo, {
    $push: { 'governanca.comercial.compartilhamentos': entrada },
  })

  const url = urlPublica(`/proposta/${token}`)

  // E-mail é acessório: o envio já existe. Se o SMTP não estiver configurado,
  // `enviarEmail` devolve {enviado:false} sem lançar — e dizemos isso.
  let email = { enviado: false, motivo: 'destinatário não informado' }
  const para = destinatario ?? cliente?.email ?? null
  if (para) {
    try {
      email = await enviarEmail({
        to: para,
        subject: `Sua proposta — ${conteudo.opcoes.length > 1
          ? `${conteudo.opcoes.length} opções` : '1 opção'}`,
        text: `Sua proposta está disponível em: ${url}\n`
          + `Válida até ${validade.toLocaleDateString('pt-BR')}.`,
        html: `<p>Sua proposta está disponível para consulta:</p>`
          + `<p><a href="${url}">${url}</a></p>`
          + `<p>Válida até ${validade.toLocaleDateString('pt-BR')}.</p>`,
      })
    } catch (e) {
      email = { enviado: false, motivo: e.message }
    }
  }

  return {
    share_id, token, url, validade, snapshot_hash: hash,
    opcoes: conteudo.opcoes.length,
    email: { ...email, smtp_configurado: smtpConfigurado(), destinatario: para },
  }
}

/**
 * Estado de envio da proposta de um projeto. Leitura — o domínio decide, este
 * service só busca os compartilhamentos onde eles moram.
 */
export async function estadoDeEnvio({ projeto, agora = new Date(), empresaId = null }) {
  const compartilhamentos = await compartilhamentosDoGrupo({ projeto, empresaId })
  return avaliarEnvio({ grupoId: projeto?.proposta_grupo_id, compartilhamentos, agora })
}

/**
 * Compartilhamentos do GRUPO, consolidando o tracking — FV-UX-038 (D4).
 *
 * ── O defeito que isto corrige (meu, da FV-UX-035) ──────────────────────────
 * O envio grava a MESMA entrada em todas as irmãs, e eu registrei no comentário
 * do `enviarProposta` que a cópia não divergiria "porque nada a atualiza
 * depois — só o tracking". O tracking É uma atualização posterior: a rota
 * pública faz `findOne` pelo token, recebe UMA irmã qualquer e incrementa só
 * nela.
 *
 * Medido na FV-UX-037, com o cliente tendo aberto o link e aceitado pela
 * Opção 02:
 *
 *     Opção 01 → 1 visualização        Opção 02 → 0        Opção 03 → 0
 *
 * E a tela da opção ACEITA dizia "Ainda não foi aberto pelo cliente".
 *
 * ── A correção ──────────────────────────────────────────────────────────────
 * O envio é do GRUPO, então o estado dele se lê do grupo. Esta função junta as
 * irmãs e consolida o tracking por `share_id`: a contagem soma, as datas são a
 * primeira e a última entre todas. Continua havendo UMA fonte — o array
 * `compartilhamentos[]` —; o que muda é o RECORTE lido, de uma irmã para o
 * grupo. Nenhum dado novo é persistido.
 */
export async function compartilhamentosDoGrupo({ projeto, empresaId = null }) {
  const proprios = projeto?.governanca?.comercial?.compartilhamentos ?? []
  if (!projeto?.proposta_grupo_id) return proprios

  const filtro = { proposta_grupo_id: projeto.proposta_grupo_id, excluido: { $ne: true } }
  if (empresaId) filtro.empresa_id = empresaId
  const irmas = await ProjetoFV.find(filtro)
    .select('governanca.comercial.compartilhamentos').lean().catch(() => null)
  if (!Array.isArray(irmas) || irmas.length === 0) return proprios

  const porShare = new Map()
  for (const irma of irmas) {
    for (const s of irma?.governanca?.comercial?.compartilhamentos ?? []) {
      const chave = s.share_id ?? s.token
      if (!chave) continue
      const atual = porShare.get(chave)
      if (!atual) { porShare.set(chave, { ...s, tracking: { ...(s.tracking ?? {}) } }); continue }
      // Consolida o tracking: soma o que foi contado em cada cópia.
      const t = atual.tracking, u = s.tracking ?? {}
      t.visualizacoes = (t.visualizacoes ?? 0) + (u.visualizacoes ?? 0)
      const menor = (a, b) => (!a ? b : !b ? a : (new Date(a) < new Date(b) ? a : b))
      const maior = (a, b) => (!a ? b : !b ? a : (new Date(a) > new Date(b) ? a : b))
      t.primeiro_acesso = menor(t.primeiro_acesso, u.primeiro_acesso)
      t.ultimo_acesso = maior(t.ultimo_acesso, u.ultimo_acesso)
      t.acessos = [...(t.acessos ?? []), ...(u.acessos ?? [])]
    }
  }
  return [...porShare.values()]
}

export const EnvioPropostaService = {
  lerOpcoesDoGrupo, montarSnapshotDaProposta, enviarProposta, estadoDeEnvio,
  compartilhamentosDoGrupo,
}
