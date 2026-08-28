/**
 * estrutura.js — regra da estrutura de fixação — SSOT — FV-DOM-039.
 *
 * ── Por que este arquivo existe ─────────────────────────────────────────────
 * A regra nasceu na FV-UX-030, dentro do frontend. A FV-UX-037 mediu que a API
 * aceitava `{ tipo: 'Outro', descricao: '' }` com HTTP 200 — a regra valia só
 * para quem passasse pela tela. A FV-UX-038 fechou esse buraco criando uma
 * SEGUNDA cópia no domínio do backend, espelhada palavra por palavra, e
 * registrou a duplicação como dívida.
 *
 * Duas cópias espelhadas é melhor que uma regra só na interface, e pior que uma
 * definição só. Este arquivo é a definição só. Backend e frontend passam a
 * importá-lo; nenhum dos dois guarda a sua versão.
 *
 * ── O que a regra é, exatamente ─────────────────────────────────────────────
 *   • `Outro` COM descrição      → válido
 *   • `Outro` SEM descrição      → inválido (o único erro que existe aqui)
 *   • `Fibrocimento` e afins     → válido
 *   • `Mini Trilho` (histórico)  → PRESERVADO — fora da lista não é erro
 *   • estrutura ausente          → LACUNA declarada, nunca erro
 *
 * ── O que a regra NÃO faz ───────────────────────────────────────────────────
 * Não cria default (ausente é vazio, não "Fibrocimento"), não reclassifica
 * valor legado, não traduz para slug, não precifica, não escolhe material.
 *
 * ── Por que o valor persistido é o RÓTULO, não uma chave ────────────────────
 * `memorialDescritivoService` e `propostaComercialService` imprimem
 * `estrutura.tipo` DIRETO no documento gerado — um slug (`fibrocimento`) sairia
 * cru no memorial. O vocabulário é o mesmo que o wizard legado já grava
 * (`SeletorEstrutura.jsx`), então projetos antigos e novos falam a mesma língua
 * e nada precisa ser convertido.
 *
 * Puro: sem React, sem Mongoose, sem I/O.
 */

/**
 * Tipos oferecidos. `valor` é o que persiste (e o que sai no memorial);
 * `rotulo` é o que a tela mostra.
 */
export const TIPOS_ESTRUTURA = Object.freeze([
  Object.freeze({ valor: 'Fibrocimento', rotulo: 'Telhado fibrocimento' }),
  Object.freeze({ valor: 'Cerâmico',     rotulo: 'Telhado cerâmico' }),
  Object.freeze({ valor: 'Metálico',     rotulo: 'Telhado metálico' }),
  Object.freeze({ valor: 'Solo',         rotulo: 'Solo' }),
  Object.freeze({ valor: 'Laje',         rotulo: 'Laje' }),
  Object.freeze({ valor: 'Outro',        rotulo: 'Outro' }),
])

/** O único tipo que exige descrição — regra 8 da FV-UX-030. */
export const TIPO_OUTRO = 'Outro'

const texto = (v) => (typeof v === 'string' ? v.trim() : '')

/** Estrutura ausente. Não é "Fibrocimento por omissão": é vazio mesmo. */
export function estruturaVazia() {
  return { tipo: '', descricao: '' }
}

/**
 * `equipamentos.estrutura` → forma editável.
 * Valor gravado fora da lista (ex.: "Mini Trilho", do wizard legado) é
 * PRESERVADO como está — não é reclassificado nem apagado.
 */
export function daEquipamentos(equipamentos) {
  const e = equipamentos?.estrutura ?? null
  if (!e) return estruturaVazia()
  return { tipo: texto(e.tipo), descricao: texto(e.descricao) }
}

/** O tipo persistido não consta da lista oferecida? */
export function tipoForaDaLista(tipo) {
  const t = texto(tipo)
  return t !== '' && !TIPOS_ESTRUTURA.some((x) => x.valor === t)
}

/** Rótulo de exibição. Valor fora da lista é exibido como veio. */
export function rotuloDaEstrutura(tipo) {
  const t = texto(tipo)
  if (t === '') return null
  return TIPOS_ESTRUTURA.find((x) => x.valor === t)?.rotulo ?? t
}

/** A descrição é obrigatória para este tipo? */
export function exigeDescricao(tipo) {
  return texto(tipo) === TIPO_OUTRO
}

/**
 * Validação da etapa. Ausência de estrutura NÃO é erro: é lacuna declarada,
 * porque a estrutura não é pré-requisito de nada no fluxo. `Outro` sem
 * descrição É erro — "Outro" sozinho não informa nada, e essa linha vazia sai
 * impressa numa proposta assinada.
 *
 * Tipo FORA da lista NÃO é erro: a FV-UX-030 §5 garante que valor legado é
 * aceito e devolvido intacto. A FV-UX-038 tentou recusá-lo e a validação daquela
 * sprint pegou — "Mini Trilho" existe em projeto histórico, e reclassificá-lo
 * reescreveria o que a venda diz.
 */
export function validarEstrutura(estrutura) {
  const tipo = texto(estrutura?.tipo)
  const descricao = texto(estrutura?.descricao)
  const erros = []
  const lacunas = []

  if (tipo === '') lacunas.push('estrutura não informada')
  else if (exigeDescricao(tipo) && descricao === '') {
    erros.push('Tipo "Outro" exige descrição da estrutura.')
  }

  return { valida: erros.length === 0, erros, lacunas, informada: tipo !== '' }
}

/**
 * Forma editável → payload da etapa `equipamentos`.
 *
 * O handler faz `$set.equipamentos = dados` — SUBSTITUI o subdocumento inteiro.
 * Sem carregar `paineis`/`inversor` por cima, salvar a estrutura apagaria a
 * composição. É o mesmo defeito que a FV-UX-018 encontrou em `localizacao`.
 * Daí o spread do que o servidor devolveu.
 *
 * Campo vazio vira `''` e não `undefined`: o `$set` precisa escrever algo para
 * que LIMPAR a estrutura tenha efeito.
 */
export function paraEquipamentos(estrutura, equipamentosExistentes = null) {
  const tipo = texto(estrutura?.tipo)
  const descricao = texto(estrutura?.descricao)
  return {
    ...(equipamentosExistentes ?? {}),
    estrutura: { tipo, descricao },
  }
}
