/**
 * proposta/ — Envio e aceite da proposta — FV-UX-035.
 *
 *     Orçamento aprovado → Proposta montada → [ENVIO] → cliente analisa
 *                                                  ↓
 *                                            [ACEITE de UMA opção]
 *                                                  ↓
 *                                       ⑂ Homologação ∥ Engenharia   (gate/)
 *
 * ── Por que este módulo existe ──────────────────────────────────────────────
 * A auditoria da FV-UX-035 mediu que o aceite acontecia com HTTP 200 sem que a
 * proposta jamais tivesse sido disponibilizada ao cliente. A regra desta sprint
 * fecha essa porta: só se aceita o que foi enviado.
 *
 * E o aceite passa a ter DUAS origens — o cliente, na página pública, e o
 * operador, quando o cliente confirma por outro meio. A decisão de negócio foi
 * explícita: "não criar um segundo mecanismo de aceite; página pública e
 * registro interno devem convergir para o mesmo domínio e as mesmas regras".
 * Por isso a regra mora aqui, PURA — sem Mongoose, sem Express, sem I/O — e os
 * dois caminhos a chamam. Nenhum dos dois decide por conta própria.
 *
 * ── O que este módulo NÃO faz ───────────────────────────────────────────────
 *   • não monta snapshot (quem monta é `montarSnapshotDaProposta`, que lê o
 *     Orçamento aprovado e a Baseline — fontes canônicas);
 *   • não grava nada;
 *   • não decide o gate de Engenharia/Homologação — isso é `dominio/gate/`,
 *     que continua a única autoridade sobre o que avança depois do aceite.
 */

/** Motivos de bloqueio — vocabulário estável para o cliente da API. */
export const MOTIVOS_PROPOSTA = Object.freeze({
  SEM_GRUPO_DE_PROPOSTA: 'SEM_GRUPO_DE_PROPOSTA',
  PROPOSTA_NAO_ENVIADA:  'PROPOSTA_NAO_ENVIADA',
  PROPOSTA_JA_ACEITA:    'PROPOSTA_JA_ACEITA',
  ENVIO_EXPIRADO:        'ENVIO_EXPIRADO',
  OPCAO_FORA_DO_ENVIO:   'OPCAO_FORA_DO_ENVIO',
  ORIGEM_INVALIDA:       'ORIGEM_INVALIDA',
  SEM_ORCAMENTO_APROVADO: 'SEM_ORCAMENTO_APROVADO',
})

/** Origens legítimas de um aceite. Fechado: qualquer outra é recusada. */
export const ORIGENS_ACEITE = Object.freeze(['cliente', 'interno'])

export class ErroProposta extends Error {
  constructor(motivo, mensagem) {
    super(mensagem)
    this.name = 'ErroProposta'
    this.codigo = motivo
    this.status = motivo === MOTIVOS_PROPOSTA.ENVIO_EXPIRADO ? 410
      : motivo === MOTIVOS_PROPOSTA.ORIGEM_INVALIDA ? 400
      : 409
  }
}

/** Marca canônica de um compartilhamento criado pelo fluxo /fv. */
export const ORIGEM_ENVIO_CANONICO = 'canonico'

/**
 * O compartilhamento é um envio canônico desta proposta?
 *
 * O array `governanca.comercial.compartilhamentos[]` é compartilhado com o
 * wizard legado, que cria entradas por CENÁRIO e sem grupo. Um envio canônico
 * se identifica por duas marcas juntas — a origem e o grupo — para que uma
 * entrada legada nunca seja confundida com envio de proposta.
 */
export function ehEnvioCanonico(share, grupoId) {
  if (!share || !grupoId) return false
  return share.origem === ORIGEM_ENVIO_CANONICO
    && String(share.proposta_grupo_id ?? '') === String(grupoId)
}

/** Um envio vencido não vale como disponibilização vigente. */
export function envioVigente(share, agora = new Date()) {
  if (!share) return false
  if (!share.validade) return true          // sem validade declarada = não expira
  return new Date(share.validade) >= agora
}

/**
 * Estado de envio da proposta. PURO — não lança.
 *
 * @param {object} args
 * @param {string|null} args.grupoId          `proposta_grupo_id` da proposta
 * @param {Array}       args.compartilhamentos entradas de `governanca.comercial`
 * @param {Date}        [args.agora]
 * @returns {{ enviada:boolean, vigente:boolean, envios:number, ultimo:object|null }}
 */
export function avaliarEnvio({ grupoId, compartilhamentos = [], agora = new Date() }) {
  const canonicos = (compartilhamentos ?? []).filter((s) => ehEnvioCanonico(s, grupoId))
  if (canonicos.length === 0) {
    return { enviada: false, vigente: false, envios: 0, ultimo: null }
  }
  // O último envio é o que o cliente tem em mãos.
  const ultimo = canonicos.reduce((a, b) =>
    new Date(b.criado_em ?? 0) > new Date(a.criado_em ?? 0) ? b : a)
  return {
    enviada: true,
    vigente: canonicos.some((s) => envioVigente(s, agora)),
    envios: canonicos.length,
    ultimo,
  }
}

/**
 * Pode aceitar esta opção? PURO — não lança, apenas decide.
 *
 * Regras, todas medidas na FV-UX-035:
 *   1. a opção precisa participar de uma proposta com grupo;
 *   2. a proposta precisa ter sido ENVIADA ao cliente — a regra da sprint;
 *   3. o envio precisa estar vigente (link expirado não sustenta aceite novo);
 *   4. a opção precisa constar do envio — não se aceita o que não foi mostrado;
 *   5. o grupo não pode já ter outra opção aceita (regra 8 da FV-DOM-032);
 *   6. a origem precisa ser declarada e conhecida.
 *
 * Idempotência: reaceitar a MESMA opção é permitido e não é erro — devolve
 * `{ liberado:true, repetido:true }` para que o chamador não regrave evidência.
 *
 * @returns {{ liberado:boolean, repetido?:boolean, motivo?:string, mensagem?:string }}
 */
export function avaliarAceite({ opcao, irmas = [], envio, origem, agora = new Date() }) {
  if (!ORIGENS_ACEITE.includes(origem)) {
    return {
      liberado: false,
      motivo: MOTIVOS_PROPOSTA.ORIGEM_INVALIDA,
      mensagem: `Origem do aceite inválida: ${origem ?? 'ausente'}. Esperado: ${ORIGENS_ACEITE.join(' ou ')}.`,
    }
  }
  if (!opcao?.proposta_grupo_id) {
    return {
      liberado: false,
      motivo: MOTIVOS_PROPOSTA.SEM_GRUPO_DE_PROPOSTA,
      mensagem: 'Projeto não participa de uma proposta com opções.',
    }
  }

  // Já aceita? Antes de tudo — reaceitar a mesma opção é idempotente.
  if (opcao?.proposta_aceite?.aceita === true) {
    return { liberado: true, repetido: true }
  }
  const outraAceita = (irmas ?? []).find((i) =>
    i?.proposta_aceite?.aceita === true && String(i._id) !== String(opcao._id))
  if (outraAceita) {
    return {
      liberado: false,
      motivo: MOTIVOS_PROPOSTA.PROPOSTA_JA_ACEITA,
      mensagem: `A proposta já tem uma opção aceita: ${outraAceita.opcao_rotulo ?? outraAceita.nome}.`,
      aceita_ref: outraAceita._id,
    }
  }

  if (!envio?.enviada) {
    return {
      liberado: false,
      motivo: MOTIVOS_PROPOSTA.PROPOSTA_NAO_ENVIADA,
      mensagem: 'A proposta precisa ser enviada ao cliente antes de qualquer aceite.',
    }
  }
  if (!envio?.vigente) {
    return {
      liberado: false,
      motivo: MOTIVOS_PROPOSTA.ENVIO_EXPIRADO,
      mensagem: 'O envio da proposta expirou. Envie novamente antes de registrar o aceite.',
    }
  }

  // A opção precisa estar entre as que o cliente viu.
  const mostradas = envio?.ultimo?.snapshot?.opcoes ?? null
  if (Array.isArray(mostradas) && mostradas.length > 0) {
    const consta = mostradas.some((o) => String(o.projeto_ref) === String(opcao._id))
    if (!consta) {
      return {
        liberado: false,
        motivo: MOTIVOS_PROPOSTA.OPCAO_FORA_DO_ENVIO,
        mensagem: 'Esta opção não constava da proposta enviada ao cliente.',
      }
    }
  }

  return { liberado: true, repetido: false }
}

/** Versão imperativa — lança `ErroProposta`. Devolve `{repetido}` quando passa. */
export function exigirAceitavel(args) {
  const r = avaliarAceite(args)
  if (!r.liberado) {
    const e = new ErroProposta(r.motivo, r.mensagem)
    if (r.aceita_ref) e.aceita_ref = r.aceita_ref
    throw e
  }
  return r
}

/**
 * Monta a EVIDÊNCIA do aceite, exigida pela decisão de negócio da FV-UX-035:
 * opção escolhida, quando, por qual origem, quem (interno) ou qual token
 * (público), e qual snapshot o cliente tinha diante dos olhos.
 *
 * Não inventa nada: o que não foi informado fica `null`, e fica visível que
 * ficou.
 */
export function montarEvidenciaAceite({ origem, usuario = null, token = null,
  ip = null, envio = null, motivo = null, agora = new Date() }) {
  return {
    aceita: true,
    aceita_em: agora,
    aceita_por: origem === 'interno' ? (usuario ?? null) : null,
    motivo: motivo ?? null,
    origem,
    // Evidência do canal público: o token É a credencial, então identifica a sessão.
    token_envio: origem === 'cliente' ? (token ?? null) : null,
    ip: ip ?? null,
    // A proposta exata que estava à vista no momento do aceite.
    share_id: envio?.ultimo?.share_id ?? null,
    snapshot_hash: envio?.ultimo?.snapshot_hash ?? null,
  }
}
