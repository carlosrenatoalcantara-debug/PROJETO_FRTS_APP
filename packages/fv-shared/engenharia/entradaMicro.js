/**
 * entradaMicro.js — compatibilidade módulo × entrada CC do MICROINVERSOR.
 *
 * O fabricante de micro não declara limite CC/CA. O que o datasheet declara — e
 * o que decide se o módulo serve — é, por entrada:
 *
 *   tensão máxima de entrada     Voc no FRIO              acima → INCOMPATÍVEL
 *   faixa MPPT                   Vmpp no frio / no quente fora  → INCOMPATÍVEL
 *   tensão de partida mínima     Voc no QUENTE            abaixo → INCOMPATÍVEL (não parte)
 *   tensão de partida máxima     Voc no FRIO              acima → ATENÇÃO (parte mais tarde)
 *   potência do módulo           faixa usual ("450-750+") fora  → ATENÇÃO
 *
 * Corrente (trabalho e curto) é de `correnteMicro.js`. A física é de
 * `classificacaoTensaoCC` / `engenhariaNormativa`: aqui não há fórmula nova.
 *
 * Sem default: dado ausente deixa o critério `nao_avaliado` e entra em `lacunas`.
 * A faixa de potência é recomendação do fabricante — ausente, não é lacuna.
 *
 * Puro: sem I/O, sem React.
 */
import { classificarTensaoCC, STATUS_TENSAO } from './classificacaoTensaoCC.js'
import { NOCT_PADRAO_C, coefParaFracao, fatorTermico, temperaturaCelula } from './engenhariaNormativa.js'

export const STATUS_ENTRADA = STATUS_TENSAO

const _num = (v) => {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const _pos = (v) => { const n = _num(v); return n !== null && n > 0 ? n : null }
const _r = (v) => Math.round(v * 100) / 100

const { OK, ATENCAO, INCOMPATIVEL, NAO_AVALIADO } = STATUS_TENSAO

function partidaMinima(vocQuente, limite) {
  const base = { valor_v: vocQuente, limite_v: limite }
  if (vocQuente === null || limite === null) return { ...base, status: NAO_AVALIADO }
  return { ...base, status: vocQuente < limite ? INCOMPATIVEL : OK }
}

function partidaMaxima(vocFrio, limite) {
  const base = { valor_v: vocFrio, limite_v: limite }
  if (vocFrio === null || limite === null) return { ...base, status: NAO_AVALIADO }
  return { ...base, status: vocFrio > limite ? ATENCAO : OK }
}

function potenciaDoModulo(potencia, min, max) {
  const base = { valor_w: potencia, min_w: min, max_w: max }
  if (potencia === null || (min === null && max === null)) return { ...base, status: NAO_AVALIADO }
  const fora = (max !== null && potencia > max) || (min !== null && potencia < min)
  return { ...base, status: fora ? ATENCAO : OK }
}

/**
 * @param {Object} p
 * @param {Object} p.modulo { voc, vmpp, coef_temp_voc, temp_noct, potencia_w }
 * @param {Object} p.micro  { modulos_por_entrada, tensao_max_entrada, mppt_min, mppt_max,
 *                            tensao_partida, tensao_partida_max, potencia_modulo_min_w, potencia_modulo_max_w }
 * @param {number} p.tMin   temperatura mínima de projeto (°C)
 * @param {number} p.tMax   temperatura máxima de projeto (°C)
 */
export function avaliarEntradaMicro({ modulo = {}, micro = {}, tMin = null, tMax = null } = {}) {
  const m = modulo ?? {}
  const i = micro ?? {}
  const voc = _pos(m.voc)
  const vmpp = _pos(m.vmpp)
  const coef = _num(m.coef_temp_voc)
  const tmin = _num(tMin)
  const tmax = _num(tMax)
  const noct = _pos(m.temp_noct) ?? NOCT_PADRAO_C
  const vMax = _pos(i.tensao_max_entrada)
  const mpptMin = _pos(i.mppt_min)
  const mpptMax = _pos(i.mppt_max)
  const partMin = _pos(i.tensao_partida)
  const partMax = _pos(i.tensao_partida_max)
  // Mais de um módulo por entrada: o cadastro não diz se é série ou paralelo.
  const umPorEntrada = _num(i.modulos_por_entrada) === 1
  // Coeficiente zero ou positivo é erro de cadastro: anularia o pior caso.
  const coefValido = coef !== null && coef < 0

  const t = classificarTensaoCC({
    voc, vmpp, coefTempVoc: coefValido ? coef : null, tempNoct: noct,
    modulosPorString: umPorEntrada ? 1 : null,
    tensaoMaxEntrada: vMax, mpptMin, mpptMax, tMin: tmin, tMax: tmax,
  })
  const vocFrio = t.tensoes.voc_string_max
  const vocQuente = vocFrio === null ? null
    : _r(voc * fatorTermico(coefParaFracao(coef), temperaturaCelula(tmax, noct)))

  const criterios = {
    tensao_maxima: t.voc,
    mppt_max: t.mppt_max,
    mppt_min: t.mppt_min,
    partida_min: partidaMinima(vocQuente, partMin),
    partida_max: partidaMaxima(vocFrio, partMax),
    potencia_modulo: potenciaDoModulo(
      _pos(m.potencia_w), _pos(i.potencia_modulo_min_w), _pos(i.potencia_modulo_max_w)),
  }

  const lacunas = []
  if (voc === null) lacunas.push('modulo.voc')
  if (vmpp === null) lacunas.push('modulo.vmpp')
  if (!coefValido) lacunas.push('modulo.coef_temp_voc')
  if (tmin === null || tmax === null) lacunas.push('clima')
  if (!umPorEntrada) lacunas.push('micro.modulos_por_entrada')
  if (vMax === null) lacunas.push('micro.tensao_max_entrada')
  if (mpptMin === null) lacunas.push('micro.tensao_mppt_min')
  if (mpptMax === null) lacunas.push('micro.tensao_mppt_max')
  if (partMin === null) lacunas.push('micro.tensao_partida')

  const todos = Object.values(criterios).map((c) => c.status)
  const status = todos.includes(INCOMPATIVEL) ? INCOMPATIVEL
    : todos.includes(ATENCAO) ? ATENCAO
      : lacunas.length > 0 ? NAO_AVALIADO : OK

  return { status, criterios, lacunas }
}

export default { STATUS_ENTRADA, avaliarEntradaMicro }
