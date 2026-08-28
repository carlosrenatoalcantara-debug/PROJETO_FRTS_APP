/**
 * conexao/ — Conexão física da usina — FV-DOM-047.
 *
 * Implementa exclusivamente o FATO de a usina estar ligada à rede, conforme as
 * decisões medidas nas FV-DOM-044, 045 e 046. Domínio PURO: sem Mongoose, sem
 * Express, sem I/O.
 *
 * ── O que conexão é, e o que não é ──────────────────────────────────────────
 * Conexão é um EVENTO: acontece uma vez, tem data, e depois é permanente. Não é
 * máquina de estado — `conectada_em` já é a máquina binária inteira (`null` =
 * não conectada). Modelar um enum aqui seria criar processo onde há fato.
 *
 * E não é homologação. Homologação é a resposta da concessionária ao pedido de
 * acesso; conexão depende de obra, vistoria e troca de medidor, e tem outro ator
 * (FV-DOM-041 §2.1). Foi essa mistura, no enum legado `homologacao.status`, que
 * permitiu o caso `conectado + reprovado` medido na FV-DOM-040.
 *
 * ── O que este módulo NÃO faz, por decisão ──────────────────────────────────
 *   • não altera Gate — o Gate decide por Baseline íntegra + opção aceita, ambos
 *     anteriores à conexão (FV-DOM-046/D2);
 *   • não altera Baseline — imutável (M-2), e conexão lhe é posterior;
 *   • não altera `projeto.status` — o ciclo de vida do projeto **não tem
 *     nenhuma transição automática** em todo o sistema; três escritores, todos
 *     manuais. Fazer a conexão movê-lo seria criar a primeira;
 *   • não libera fase — Projeto Executivo, Execução e As-Built são stubs sem
 *     agregado: não há etapa com conteúdo a liberar;
 *   • não exige `homologado` — nenhuma regra do sistema usa `homologado` como
 *     pré-condição de coisa alguma (FV-DOM-045/D1). A divergência é DECLARADA,
 *     não impeditiva.
 */

export const MOTIVOS_CONEXAO = Object.freeze({
  DATA_INVALIDA:        'DATA_INVALIDA',
  DATA_NO_FUTURO:       'DATA_NO_FUTURO',
  SEM_DATA:             'SEM_DATA',
  OPCAO_NAO_ESCOLHIDA:  'OPCAO_NAO_ESCOLHIDA',
})

export class ErroConexao extends Error {
  constructor(motivo, mensagem) {
    super(mensagem)
    this.name = 'ErroConexao'
    this.codigo = motivo
    this.status = motivo === MOTIVOS_CONEXAO.OPCAO_NAO_ESCOLHIDA ? 409 : 400
  }
}

const texto = (v) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}

/** Conexão ausente. `null` em `conectada_em` é a única forma de "não conectada". */
export function conexaoVazia() {
  return { conectada_em: null, numero_medidor: null, observacoes: null }
}

/** A usina está conectada? Uma data responde tudo. */
export function estaConectada(conexao) {
  return !!conexao?.conectada_em
}

/**
 * Normaliza a entrada para o contrato. PURO — não lança para campo ausente.
 *
 * `numero_medidor` e `observacoes` em branco viram `null`, nunca valor
 * plausível. Não existe regra alguma sobre medidor no sistema — nem campo, nem
 * tipo de ativo, nem validação (FV-DOM-045 §1.3) —, então exigi-lo seria
 * inventar bloqueio a partir do nada. Ausente é lacuna declarada.
 */
export function normalizarConexao(bruto = {}) {
  return {
    conectada_em: bruto.conectada_em ?? null,
    numero_medidor: texto(bruto.numero_medidor),
    observacoes: texto(bruto.observacoes),
  }
}

/**
 * Valida o registro de conexão. Lança `ErroConexao`.
 *
 * Só três coisas podem estar erradas, e todas são sobre a DATA — que é o único
 * campo obrigatório, porque é o próprio fato:
 *
 *   1. data ausente quando se pretende registrar conexão;
 *   2. data ilegível;
 *   3. data no futuro — uma usina não é conectada amanhã.
 *
 * `numero_medidor` NÃO é validado: não há regra que o sustente.
 */
export function exigirRegistroValido({ conectada_em, agora = new Date() }) {
  if (conectada_em === null || conectada_em === undefined || conectada_em === '') {
    throw new ErroConexao(MOTIVOS_CONEXAO.SEM_DATA,
      'Informe a data em que a usina foi conectada.')
  }
  const d = new Date(conectada_em)
  if (Number.isNaN(d.getTime())) {
    throw new ErroConexao(MOTIVOS_CONEXAO.DATA_INVALIDA,
      `Data de conexão inválida: "${conectada_em}".`)
  }
  if (d.getTime() > agora.getTime()) {
    throw new ErroConexao(MOTIVOS_CONEXAO.DATA_NO_FUTURO,
      'A data de conexão não pode estar no futuro.')
  }
  return d
}

/**
 * Divergência entre conexão e homologação — DERIVADA, nunca persistida.
 *
 * A FV-DOM-045/D1 decidiu que `homologado` é recomendação, não bloqueio: nenhuma
 * regra do sistema o usa como pré-condição, e bloquear tornaria irrepresentável
 * a ligação antes do deferimento definitivo — caso real do setor que ninguém
 * decidiu proibir.
 *
 * Então o sistema INFORMA em vez de impedir. E informa por cálculo: persistir um
 * `sem_homologacao` violaria INV-58, além de criar um segundo jeito de dizer a
 * mesma coisa — exatamente a duplicação que este ciclo de sprints eliminou.
 *
 * @returns {{ divergente: boolean, motivo: string|null }}
 */
export function avaliarDivergencia({ conexao, statusHomologacao }) {
  if (!estaConectada(conexao)) return { divergente: false, motivo: null }
  if (statusHomologacao === 'homologado') return { divergente: false, motivo: null }
  return {
    divergente: true,
    motivo: statusHomologacao === 'reprovado'
      ? 'Usina registrada como conectada, mas a homologação foi REPROVADA.'
      : `Usina registrada como conectada antes do deferimento `
        + `(homologação em "${statusHomologacao ?? 'nao_iniciado'}").`,
  }
}

/**
 * A opção pode registrar conexão? — regra 5 da FV-DOM-032.
 *
 * Registrar conexão é avanço operacional, e a opção NÃO escolhida de uma
 * proposta nunca é construída. Esta função aplica a regra que já existe; não
 * inventa nem toca o Gate — que segue decidindo por Baseline + aceite, sem
 * saber que conexão existe.
 *
 * `estadoDaOpcao` devolve `null` para projeto sem grupo ou com grupo de uma só
 * opção: nesses casos não há escolha a respeitar, e nada bloqueia.
 */
export function exigirOpcaoEscolhida(estadoOpcao) {
  if (estadoOpcao === null || estadoOpcao === undefined) return true
  if (estadoOpcao.aceita === true) return true
  if (estadoOpcao.grupo_tem_aceita !== true) return true   // ninguém escolheu ainda
  throw new ErroConexao(MOTIVOS_CONEXAO.OPCAO_NAO_ESCOLHIDA,
    `${estadoOpcao.rotulo ?? 'Esta opção'} não foi a escolhida da proposta — `
    + 'a usina construída é a da opção aceita.')
}

/** Lacunas declaradas do registro. Nada aqui impede coisa alguma. */
export function lacunasDaConexao(conexao) {
  const lacunas = []
  if (!estaConectada(conexao)) return ['conexao.conectada_em']
  if (!conexao?.numero_medidor) lacunas.push('conexao.numero_medidor')
  return lacunas
}
