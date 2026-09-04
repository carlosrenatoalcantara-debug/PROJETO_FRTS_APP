/**
 * agregadosFvApi.js — cliente da API canônica dos agregados FV — FV-API-001.
 *
 * Todos os endpoints abaixo respondem DIRETO pelos agregados do Core, sem
 * adapters e sem o subdocumento legado. Não há mais endpoint pendente: a lacuna
 * que a FV-UX-010 precisou declarar foi fechada nesta sprint.
 */

import { apiFetch } from '../../services/http'

async function obterJson(url, contexto) {
  return enviar(url, { method: 'GET', cache: 'no-store' }, contexto)
}

/**
 * Requisição à API canônica.
 *
 * Erros de DOMÍNIO vêm com `codigo` e mensagem do servidor — a UI os repassa ao
 * usuário sem reinterpretar. Nenhuma regra é recalculada no cliente.
 */
async function enviar(url, init, contexto) {
  const r = await apiFetch(url, {
    ...init,
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  const corpo = await r.json().catch(() => null)
  if (!r.ok) {
    // Duas convenções coexistem: os endpoints canônicos respondem `erro`; os
    // anteriores (beneficiárias, S8.7) respondem `mensagem`. Perder o segundo
    // caso trocaria "Soma ultrapassaria 100%" por um "400" mudo.
    const erro = new Error(corpo?.erro || corpo?.mensagem || `${contexto}: ${r.status}`)
    erro.status = r.status
    erro.codigo = corpo?.codigo ?? null
    erro.erros = corpo?.erros ?? null
    throw erro
  }
  return corpo
}

const json = (dados) => JSON.stringify(dados)

const base = (projetoId) => `/api/projetos-fv/${projetoId}`

/** Projeto FV. `orcamento_vigente` continua na resposta, mas não é lido aqui. */
export function buscarProjeto(projetoId) {
  return obterJson(base(projetoId), 'buscarProjeto')
}

export function listarProjetos() {
  return obterJson('/api/projetos-fv', 'listarProjetos')
}

/**
 * Grava UMA etapa do agregado `ProjetoFV` — FV-UX-018.
 *
 * `PUT /api/projetos-fv/:id/etapa` já existia e é a operação de escrita do
 * agregado: lista fechada de etapas, whitelist de campos por etapa, escopo de
 * organização pelo token (M-4) e guard de congelamento (409 `PROJETO_CONGELADO`).
 * Nenhuma rota nova foi criada — a lacuna da FV-OPS-001 era de TELA, não de API.
 *
 * O servidor decide tudo: o cliente só transporta `{ etapa, dados }`.
 */
export function salvarEtapaProjeto(projetoId, etapa, dados) {
  return enviar(`${base(projetoId)}/etapa`,
    { method: 'PUT', body: json({ etapa, dados }) }, `salvarEtapa:${etapa}`)
}

/**
 * Cria um Projeto FV — FV-UX-014.
 *
 * `POST /api/projetos-fv` já existia (é o mesmo endpoint que o wizard usa). O
 * tenant é carimbado no servidor a partir do JWT; o cliente não o envia.
 * Exige `clienteId` e `nome` — a validação é do controller, não daqui.
 */
export function criarProjeto(dados) {
  return enviar('/api/projetos-fv', { method: 'POST', body: json(dados) }, 'criarProjeto')
}

/**
 * Catálogo canônico de equipamentos — FV-UX-019.
 *
 * `GET /api/equipamentos/engenharia` é a API oficial do catálogo desde a S8.1:
 * já filtra por tipo, já exclui o que está bloqueado para projeto
 * (`utilizavel_em_projeto`) e devolve o documento do `Equipamento` como está.
 * Nenhum endpoint novo — e nenhuma especificação é copiada para outro lugar.
 *
 * @param {'modulo'|'inversor'} tipo
 */
export function listarCatalogo(tipo) {
  return obterJson(`/api/equipamentos/engenharia?tipo=${encodeURIComponent(tipo)}`, 'listarCatalogo')
}

/**
 * Executa o motor de dimensionamento existente — FV-UX-020.
 *
 * `POST /api/dimensionamento/calcular` roda `dimensionarFV`, que é stateless e
 * NÃO persiste: a gravação continua sendo `PUT /:id/etapa`. Nenhuma fórmula de
 * dimensionamento existe do lado do cliente.
 *
 * ── Atenção ao que vem junto ─────────────────────────────────────────────────
 * A resposta traz também `payback_anos`, `vpl_r`, `tir_aa`, `economia_*` e
 * `custo_total_r`, calculados pelo motor ANTIGO com defaults próprios de tarifa,
 * custo por kWp, inflação e taxa. A FV-DOM-015E auditou esse bloco e o manteve
 * onde estava. Ele NÃO entra no fluxo canônico: o financeiro é o contrato V1.
 */
export function calcularDimensionamento(dados) {
  return enviar('/api/dimensionamento/calcular',
    { method: 'POST', body: json(dados) }, 'calcularDimensionamento')
}

/**
 * Irradiância do local — Sprint B.
 *
 * `GET /api/irradiancia/local` já existia e já é servido: consulta a NASA POWER
 * por latitude/longitude (`utils/nasaPowerAPI.js`) e, quando ela não responde,
 * devolve o padrão com `fonte: 'padrão'`. Nenhuma rota nova foi criada aqui — a
 * UX nova apenas passou a consumir o que o wizard antigo (`E4Irradiancia.jsx`)
 * já consumia e que a migração havia deixado para trás.
 *
 * Resposta: `{ sucesso, hsp_dia, hsp_anual, latitude, longitude, fonte, kt_medio?, mensagem? }`.
 * `fonte` é `'nasa-power'` ou `'padrão'` — o cliente NÃO reinterpreta: exibe o
 * que o servidor declarou.
 */
export function consultarIrradiancia({ latitude, longitude }) {
  const q = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) })
  return enviar(`/api/irradiancia/local?${q}`, { method: 'GET' }, 'consultarIrradiancia')
}

/**
 * Validação elétrica canônica — FV-UX-026.
 *
 * `POST /api/engenharia/compatibilidade-eletrica` é o adapter do contrato
 * consolidado na FV-DOM-025: Isc × 1,25 (NBR 16690 §5.2), Voc a Tmin, Vmpp na
 * condição quente, coeficiente em %/°C convertido na fronteira, NOCT 44.
 *
 * Stateless — não persiste. Voc, Vmpp e Isc são grandezas POR MPPT, então a
 * tela chama uma vez por MPPT. Nenhum cálculo elétrico existe no cliente.
 */
export function validarCompatibilidadeEletrica(corpo) {
  return enviar('/api/engenharia/compatibilidade-eletrica',
    { method: 'POST', body: json(corpo) }, 'validarCompatibilidadeEletrica')
}

/** Clientes da organização — necessários para vincular o projeto na criação. */
export function listarClientes() {
  return obterJson('/api/clientes', 'listarClientes')
}

/** Todas as cotações do projeto (agregado `Cotacao`). */
export function listarCotacoes(projetoId) {
  return obterJson(`${base(projetoId)}/cotacoes`, 'listarCotacoes')
}

/** Todos os orçamentos do projeto (agregado `Orcamento`, N por projeto). */
export function listarOrcamentos(projetoId) {
  return obterJson(`${base(projetoId)}/orcamentos`, 'listarOrcamentos')
}

/** Orçamento vigente: o aprovado manda; senão o mais recente em elaboração. */
export function obterOrcamentoVigente(projetoId) {
  return obterJson(`${base(projetoId)}/orcamentos/vigente`, 'obterOrcamentoVigente')
}

/** Baseline congelada + verificação de integridade feita no servidor. */
export function obterBaseline(projetoId) {
  return obterJson(`${base(projetoId)}/baseline`, 'obterBaseline')
}

/** Decisão AUTORITATIVA do Gate por fase da bifurcação. */
export function obterGate(projetoId) {
  return obterJson(`${base(projetoId)}/gate`, 'obterGate')
}

/** Estado das fases paralelas Engenharia ∥ Homologação. */
export function listarFases(projetoId) {
  return obterJson(`${base(projetoId)}/fases`, 'listarFases')
}

// ── Beneficiárias — FV-UX-015 ───────────────────────────────────────────────
// Agregado `UnidadeBeneficiaria` com API pronta desde a S8.7. A regra de rateio
// (soma <= 100%, modalidades GD) é do servidor — nada é validado aqui.

/** Beneficiárias + rateio consolidado + modalidades aceitas. */
export function obterResumoBeneficiarias(projetoId) {
  return obterJson(`${base(projetoId)}/beneficiarias/resumo`, 'obterResumoBeneficiarias')
}

export function criarBeneficiaria(projetoId, dados) {
  return enviar(`${base(projetoId)}/beneficiarias`, { method: 'POST', body: json(dados) }, 'criarBeneficiaria')
}

export function atualizarBeneficiaria(projetoId, beneficiariaId, dados) {
  return enviar(`${base(projetoId)}/beneficiarias/${beneficiariaId}`, { method: 'PUT', body: json(dados) }, 'atualizarBeneficiaria')
}

export function removerBeneficiaria(projetoId, beneficiariaId) {
  return enviar(`${base(projetoId)}/beneficiarias/${beneficiariaId}`, { method: 'DELETE' }, 'removerBeneficiaria')
}

/** Importa em lote. `substituir` zera as existentes antes de inserir. */
export function importarBeneficiariasLote(projetoId, beneficiarias, substituir = false) {
  return enviar(`${base(projetoId)}/beneficiarias/lote`,
    { method: 'POST', body: json({ beneficiarias, substituir }) }, 'importarBeneficiariasLote')
}

/** Preview da validação de rateio — não persiste nada. */
export function validarRateioBeneficiarias(projetoId, beneficiarias) {
  return enviar(`${base(projetoId)}/beneficiarias/validar-rateio`,
    { method: 'POST', body: json({ beneficiarias }) }, 'validarRateioBeneficiarias')
}

// ── Unifilar — FV-UX-016 ────────────────────────────────────────────────────
// Endpoint canônico da FV-DOM-007B. Nenhum endpoint novo foi criado aqui.

/**
 * Gera o unifilar do projeto pelo motor canônico.
 *
 * É POST porque a rota é POST, não porque grava algo: o domínio não persiste
 * (INV-58) — o SVG é derivado dos dados do projeto a cada chamada. Por isso
 * chamar ao abrir a etapa é seguro e não produz efeito colateral.
 *
 * Devolve `{ svg, origem, proveniencia, lacunas, especificacoes }`. O cliente
 * usa esses campos como vieram: não recalcula nem reinterpreta nenhum deles.
 */
export function gerarUnifilar(projetoId) {
  return enviar(`${base(projetoId)}/unifilar/gerar`,
    { method: 'POST', body: json({}) }, 'gerarUnifilar')
}

// ── Financeiro — FV-UX-017 ──────────────────────────────────────────────────
// Endpoint canônico do contrato V1 (FV-DOM-012). Nenhum endpoint novo.

/**
 * Executa o contrato financeiro V1 para o projeto.
 *
 * POST porque a rota é POST — o domínio NÃO persiste (INV-58): o resultado é
 * derivado do projeto e do orçamento vigente a cada chamada. O servidor ignora
 * o corpo por completo: totais, payback ou VPL enviados pelo cliente não entram
 * no cálculo.
 *
 * Devolve `{ payback, payback_descontado, vpl, tir, economia, premissas,
 * proveniencia, lacunas, contrato_versao, premissas_versao }`. O cliente
 * apresenta esses campos como vieram — nenhum é recalculado aqui.
 */
export function calcularFinanceiro(projetoId) {
  return enviar(`${base(projetoId)}/financeiro/calcular`,
    { method: 'POST', body: json({}) }, 'calcularFinanceiro')
}

/** Topologia, quando `instalacao_ref` está preenchido. */
export function buscarInstalacao(instalacaoId) {
  return obterJson(`/api/instalacoes/${instalacaoId}`, 'buscarInstalacao')
}

// ── Escrita — FV-API-002 ────────────────────────────────────────────────────
// Cada função corresponde a UMA operação do domínio. Nenhuma decide nada: a
// validação de estado, unicidade e congelamento acontece no servidor.

/** Cria uma cotação. O domínio permite N por projeto. */
export function criarCotacao(projetoId, dados) {
  return enviar(`${base(projetoId)}/cotacoes`, { method: 'POST', body: json(dados) }, 'criarCotacao')
}

export function obterCotacao(projetoId, cotacaoId) {
  return obterJson(`${base(projetoId)}/cotacoes/${cotacaoId}`, 'obterCotacao')
}

/** Cria um orçamento a partir de uma cotação — é aqui que a cotação é "escolhida". */
export function criarOrcamento(projetoId, dados) {
  return enviar(`${base(projetoId)}/orcamentos`, { method: 'POST', body: json(dados) }, 'criarOrcamento')
}

export function obterOrcamento(projetoId, orcamentoId) {
  return obterJson(`${base(projetoId)}/orcamentos/${orcamentoId}`, 'obterOrcamento')
}

/** Edita o conteúdo. O servidor recusa a partir de EMITIDO (409). */
export function atualizarOrcamento(projetoId, orcamentoId, dados) {
  return enviar(`${base(projetoId)}/orcamentos/${orcamentoId}`, { method: 'PUT', body: json(dados) }, 'atualizarOrcamento')
}

const acao = (nome) => (projetoId, orcamentoId, corpo = {}) =>
  enviar(`${base(projetoId)}/orcamentos/${orcamentoId}/${nome}`, { method: 'POST', body: json(corpo) }, nome)

export const emitirOrcamento   = acao('emitir')
/** Aprovar congela o orçamento e gera a Baseline — tudo no servidor. */
export const aprovarOrcamento  = acao('aprovar')
export const rejeitarOrcamento = acao('rejeitar')
export const cancelarOrcamento = acao('cancelar')

// ─── FV-DOM-032 · Opções concorrentes da mesma proposta ──────────────────────
//
// Cada opção é um ProjetoFV completo; o vínculo é `proposta_grupo_id`. O cliente
// só transporta — quem decide numeração, herança e aceite é o servidor.

/** Opções irmãs do grupo de proposta, na ordem. Sem grupo → lista vazia. */
export function listarOpcoes(projetoId) {
  return enviar(`${base(projetoId)}/opcoes`, {}, 'listarOpcoes')
}

/** Cria uma opção irmã. A primeira chamada converte a origem em "Opção 01". */
export function criarOpcao(projetoId, rotulo = null) {
  return enviar(`${base(projetoId)}/opcoes`,
    { method: 'POST', body: json(rotulo ? { rotulo } : {}) }, 'criarOpcao')
}

/**
 * Aceita ESTA opção da proposta — ato separado da aprovação do orçamento.
 * Recusa com 409 `PROPOSTA_JA_ACEITA` se o grupo já tiver uma aceita.
 */
export function aceitarOpcao(projetoId, motivo = null) {
  return enviar(`${base(projetoId)}/proposta/aceitar`,
    { method: 'POST', body: json(motivo ? { motivo } : {}) }, 'aceitarOpcao')
}

// ─── FV-UX-034 · Homologação da opção aceita ─────────────────────────────────
//
// A API de homologação já existia inteira; a nova UX não expunha nada dela —
// a tela mostrava só o estado do Gate. O cliente aqui só transporta: quem
// decide se a fase está liberada é `BaselineService.exigirGate` no servidor,
// que responde 409 com o motivo (`SEM_BASELINE`, `PROPOSTA_SEM_ACEITE`,
// `OPCAO_NAO_ESCOLHIDA`).

/** Estado da homologação do projeto — consulta, liberada mesmo para a não escolhida. */
export function obterStatusHomologacao(projetoId) {
  return enviar(`${base(projetoId)}/homologacao/status`, {}, 'statusHomologacao')
}

/** Checklist de documentos — consulta. */
export function obterChecklistHomologacao(projetoId) {
  return enviar(`${base(projetoId)}/homologacao/checklist`, {}, 'checklistHomologacao')
}

/** Avança o estado da homologação. Passa pelo Gate no servidor. */
export function atualizarStatusHomologacao(projetoId, status) {
  return enviar(`${base(projetoId)}/homologacao/status`,
    { method: 'PATCH', body: json({ status }) }, 'atualizarStatusHomologacao')
}

/** Marca documentos do checklist. Passa pelo Gate no servidor. */
export function atualizarChecklistHomologacao(projetoId, documentos) {
  return enviar(`${base(projetoId)}/homologacao/checklist`,
    { method: 'PATCH', body: json({ documentos }) }, 'atualizarChecklistHomologacao')
}

/**
 * Gera um documento de homologação (`memorial` | `carta` | `art`).
 * O corpo é montado por quem chama a partir do projeto já carregado — nenhum
 * dado é derivado aqui.
 */
export function gerarDocumentoHomologacao(projetoId, tipo, corpo) {
  return enviar(`${base(projetoId)}/homologacao/${tipo}`,
    { method: 'POST', body: json(corpo) }, `documentoHomologacao:${tipo}`)
}

// ─── FV-UX-035 · Envio da proposta ao cliente ────────────────────────────────
//
// O envio é do GRUPO: um link com todas as opções. Depois dele — e só depois —
// o aceite é possível, tanto pelo cliente na página pública quanto pelo
// operador aqui dentro. Quem decide é o domínio no servidor; estas funções
// apenas transportam.

/** Disponibiliza a proposta ao cliente e devolve o link público. */
export function enviarProposta(projetoId, dados = {}) {
  return enviar(`${base(projetoId)}/proposta/enviar`,
    { method: 'POST', body: json(dados) }, 'enviarProposta')
}

/** Estado do envio: se já foi, se está vigente, o link e o tracking de acesso. */
export function obterEnvioDaProposta(projetoId) {
  return enviar(`${base(projetoId)}/proposta/envio`, {}, 'envioDaProposta')
}

// ─── FV-UX-036 · PDF da proposta ─────────────────────────────────────────────
//
// O documento é POR OPÇÃO — cada `ProjetoFV` do grupo gera o seu, identificado
// na capa pelo `opcao_rotulo`. O frontend não monta nem recalcula nada: pede o
// PDF pronto ao backend, que é a autoridade sobre o conteúdo.
//
// `gerar` devolve bytes (download direto); `visualizar` devolve base64 mais as
// lacunas que o documento não pôde afirmar.

/**
 * Baixa o PDF da proposta desta opção. Devolve um Blob.
 *
 * Não passa por `enviar`: aquele helper faz `r.json()`, e a resposta aqui é
 * binária. O tratamento de erro segue a MESMA convenção — `erro`/`mensagem` e
 * `codigo` do servidor, nunca reinterpretados no cliente.
 */
export async function baixarPdfDaProposta(projetoId) {
  const r = await apiFetch(`${base(projetoId)}/proposta/gerar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: json({}),
  })
  if (!r.ok) {
    const corpo = await r.json().catch(() => null)
    const erro = new Error(corpo?.erro || corpo?.mensagem || `baixarPdfDaProposta: ${r.status}`)
    erro.status = r.status
    erro.codigo = corpo?.codigo ?? null
    throw erro
  }
  return r.blob()
}

/** Gera o PDF para exibição, com as lacunas declaradas pelo servidor. */
export function visualizarPdfDaProposta(projetoId) {
  return enviar(`${base(projetoId)}/proposta/visualizar`,
    { method: 'POST', body: json({}) }, 'visualizarPdfDaProposta')
}

// ─── FV-UX-040 · Protocolo na concessionária ─────────────────────────────────
//
// O número que a concessionária devolve ao receber o pedido de acesso. É o
// único nó do trecho "Concessionária" com regra e persistência já definidas
// (campo, histórico e auditoria existem desde P1-CENTRAL-HOMOLOGACAO-MVP); o
// que faltava era a UX alcançá-lo.

/** Registra (ou limpa, com string vazia) o protocolo. Passa pelo Gate. */
export function registrarProtocoloHomologacao(projetoId, numero_protocolo) {
  return enviar(`${base(projetoId)}/homologacao/protocolo`,
    { method: 'PATCH', body: json({ numero_protocolo }) }, 'protocoloHomologacao')
}

// ─── FV-UX-043 · Parecer de Acesso ───────────────────────────────────────────
//
// Transporte apenas. A regra é da FV-DOM-042: normalização, validação em três
// níveis e comparação de conflito acontecem no servidor, e a tela renderiza o
// que ele respondeu. Nada é revalidado nem reinterpretado aqui.

/** Registra uma extração de parecer no projeto. `metodo` é declarado. */
export function registrarParecer(projetoId, corpo) {
  return enviar(`${base(projetoId)}/parecer`,
    { method: 'POST', body: json(corpo) }, 'registrarParecer')
}

/** Envelope do parecer: estado, dados, validação. */
export function obterParecer(projetoId) {
  return enviar(`${base(projetoId)}/parecer`, {}, 'obterParecer')
}

/** O portão humano. Só passa quando o servidor considera confirmável. */
export function confirmarParecer(projetoId) {
  return enviar(`${base(projetoId)}/parecer/confirmar`,
    { method: 'POST', body: json({}) }, 'confirmarParecer')
}
