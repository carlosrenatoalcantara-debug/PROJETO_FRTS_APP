/**
 * conflitosInversor.js — cadastro CONFLITANTE, e o que fazer com ele — Sprint E3.
 *
 * ── O que a auditoria da E3 mediu ───────────────────────────────────────────
 * Dois microinversores do catálogo real carregam pares de valores que não podem
 * ser ambos verdadeiros:
 *
 *   Hoymiles HMS-2250DW-4T   potencia_kw = 3      potencia_maxima_kw = 2.25
 *   Deye SUN2000G3-US-220    potencia_kw = 2      potencia_maxima_kw = 2000
 *
 * O primeiro é impossível (o máximo não pode ser menor que o nominal). O segundo
 * é unidade trocada (2000 W gravado num campo em kW). Nenhum dos dois pode ser
 * resolvido daqui: resolver exigiria o datasheet, e a E3 proíbe inferir por nome
 * de modelo. O Hoymiles, aliás, foi cadastrado com `origem.tipo = 'manual'`,
 * `fonte_dados: null` e nenhum documento técnico — não há fonte a consultar.
 *
 * ── O que este módulo faz, então ────────────────────────────────────────────
 * Detecta o conflito por REGRA ESTRUTURAL (relação entre os dois valores), nunca
 * por conhecimento do produto, e faz o valor deixar de estar disponível para
 * cálculo. `valorConfiavel` devolve `null` para um campo em conflito — é isso que
 * impede que um cálculo escolha silenciosamente um dos lados, que é o pedido do
 * §3. O conflito vai junto, nomeado, para a tela dizer "cadastro inconsistente".
 *
 * ── Segundo repositório de spec ─────────────────────────────────────────────
 * O mesmo equipamento guarda `especificacoes` (que `lerInversor` lê) e
 * `specs_canonicas` (que ele ignora). Onde os dois discordam há conflito; onde
 * só o segundo tem o dado, há um valor que o sistema nunca enxerga. Os dois casos
 * são reportados — sem que este módulo passe a ler o segundo repositório, o que
 * criaria mais uma fonte.
 *
 * Puro: sem I/O, sem React, sem dependência de node.
 */
import { valorCampo } from './dicionarioInversor.js'

export const TIPO_CONFLITO = Object.freeze({
  IMPOSSIVEL: 'impossivel',       // relação entre os valores não pode existir
  UNIDADE: 'unidade',             // mesma grandeza, escalas diferentes
  DIVERGENTE: 'divergente',       // dois repositórios, valores diferentes
  SO_EM_SPECS_CANONICAS: 'so_em_specs_canonicas', // dado que o leitor não vê
})

function _num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Campos que existem nos DOIS repositórios de spec, com o mesmo significado.
 * Base do conflito `divergente`. Pares medidos na auditoria do §1 — não é uma
 * tradução geral do schema, e sim a interseção que os micros realmente usam.
 */
const PARES_CANONICOS = Object.freeze([
  ['potencia_kw', 'potencia_kw_ca'],
  ['tensao_max_entrada', 'voc_max_dc_v'],
  ['tensao_mppt_min', 'mppt_min_v'],
  ['tensao_mppt_max', 'mppt_max_v'],
  ['corrente_isc_max', 'isc_max_por_mppt_a'],
  ['n_mppts', 'n_mppts'],
  ['fases', 'fases_saida'],
  ['tensao_ac', 'tensao_saida_v'],
])

/**
 * Conflitos de cadastro de UM equipamento.
 *
 * @param {Object} equipamento  registro do catálogo (com `especificacoes` e,
 *                              quando houver, `specs_canonicas`)
 * @returns {Array<{campo, tipo, valores, mensagem}>}
 */
export function detectarConflitos(equipamento = {}) {
  const esp = equipamento?.especificacoes ?? {}
  const canon = equipamento?.specs_canonicas ?? null
  const conflitos = []

  // ── Potência nominal × potência máxima ────────────────────────────────────
  // Duas regras estruturais, nenhuma delas ciente de qual produto é.
  const nominal = _num(valorCampo(esp, 'potencia_kw'))
  const maxima = _num(valorCampo(esp, 'potencia_maxima_kw'))
  if (nominal !== null && maxima !== null && nominal > 0) {
    const razao = maxima / nominal
    if (razao >= 100) {
      conflitos.push({
        campo: 'potencia_kw',
        tipo: TIPO_CONFLITO.UNIDADE,
        valores: [
          { chave: 'potencia_kw', valor: nominal },
          { chave: 'potencia_maxima_kw', valor: maxima },
        ],
        mensagem:
          `\`potencia_maxima_kw\` (${maxima}) é ${Math.round(razao)}× \`potencia_kw\` ` +
          `(${nominal}) — escala incompatível para a mesma grandeza, provável ` +
          'valor em W gravado em campo declarado em kW. Nenhum dos dois é adotado.',
      })
    } else if (maxima < nominal) {
      conflitos.push({
        campo: 'potencia_kw',
        tipo: TIPO_CONFLITO.IMPOSSIVEL,
        valores: [
          { chave: 'potencia_kw', valor: nominal },
          { chave: 'potencia_maxima_kw', valor: maxima },
        ],
        mensagem:
          `\`potencia_maxima_kw\` (${maxima} kW) é MENOR que \`potencia_kw\` ` +
          `(${nominal} kW) — a potência máxima não pode ser inferior à nominal. ` +
          'Qual dos dois está certo não é dedutível daqui: nenhum é adotado.',
      })
    }
  }

  // ── `especificacoes` × `specs_canonicas` ──────────────────────────────────
  if (canon && typeof canon === 'object') {
    for (const [campo, chaveCanon] of PARES_CANONICOS) {
      const a = _num(valorCampo(esp, campo))
      const b = _num(canon[chaveCanon])
      if (a !== null && b !== null && a !== b) {
        conflitos.push({
          campo,
          tipo: TIPO_CONFLITO.DIVERGENTE,
          valores: [
            { chave: `especificacoes.${campo}`, valor: a },
            { chave: `specs_canonicas.${chaveCanon}`, valor: b },
          ],
          mensagem:
            `\`${campo}\` vale ${a} em \`especificacoes\` e ${b} em ` +
            `\`specs_canonicas\`. Os dois repositórios discordam sobre a mesma ` +
            'grandeza; nenhum é eleito.',
        })
      } else if (a === null && b !== null) {
        conflitos.push({
          campo,
          tipo: TIPO_CONFLITO.SO_EM_SPECS_CANONICAS,
          valores: [{ chave: `specs_canonicas.${chaveCanon}`, valor: b }],
          mensagem:
            `\`${campo}\` existe apenas em \`specs_canonicas\` (${b}). O leitor ` +
            'canônico lê `especificacoes` e não o enxerga — o dado está no ' +
            'cadastro mas fora do alcance do cálculo.',
        })
      }
    }
  }

  return conflitos
}

/** Os campos que estão em conflito de VALOR (não os que só faltam ao leitor). */
export function camposEmConflito(equipamento) {
  return [...new Set(detectarConflitos(equipamento)
    .filter((c) => c.tipo !== TIPO_CONFLITO.SO_EM_SPECS_CANONICAS)
    .map((c) => c.campo))]
}

/**
 * Valor de um campo canônico, ou `null` se ele estiver em conflito.
 *
 * É a função que o §3 pede: com o cadastro contraditório, o cálculo não recebe
 * número nenhum. Um campo apenas AUSENTE também devolve `null` — a diferença
 * entre "não existe" e "existe duas vezes e discorda" vem de `detectarConflitos`,
 * e é ela que a tela mostra.
 */
export function valorConfiavel(equipamento, campo) {
  if (camposEmConflito(equipamento).includes(campo)) return null
  return valorCampo(equipamento?.especificacoes ?? {}, campo)
}

/** Há algum conflito de valor? Pergunta que a UX faz para marcar o registro. */
export const temConflito = (equipamento) => camposEmConflito(equipamento).length > 0

export default {
  TIPO_CONFLITO, detectarConflitos, camposEmConflito, valorConfiavel, temConflito,
}
