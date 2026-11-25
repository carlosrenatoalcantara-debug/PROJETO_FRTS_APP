/**
 * Wizard legado (E7) → `arranjos[].configuracao_eletrica.micros[]`.
 *
 * A fonte canônica da topologia de microinversor é `micros[]` (FV-DOM-031): é
 * o que o unifilar, o memorial e a homologação leem. O fluxo canônico grava
 * pela EtapaMicroinversores; o legado só gravava `inversores[].quantidade`, e o
 * unifilar declarava lacuna. Aqui o legado passa a gravar o MESMO fato, pelo
 * MESMO conversor (`paraConfigPersistida`) — nenhuma regra nova deste lado.
 *
 * Só monta quando tudo é conhecido: capacidade do catálogo (entradas × módulos
 * por entrada), quantidade de micros e de módulos. Faltou algo ⇒ `null` (o
 * arranjo segue sem `micros[]`, como antes) — nunca um valor presumido.
 */
import { paraConfigPersistida } from '../fv/microinversores'
import { referenciaDoCatalogo } from '../fv/catalogo'

const positivo = (v) => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

export function microsDoArranjoLegado({ inversor, numModulos, quantidade, fases = null }) {
  if (inversor?.tipo !== 'micro') return null
  const entradas = positivo(inversor?._micro?.entradas)
  const porEntrada = positivo(inversor?._micro?.modulos_por_entrada)
  const q = positivo(quantidade)
  const modulos = positivo(numModulos)
  if (entradas === null || porEntrada === null || q === null || modulos === null) return null
  const marca = inversor.fabricante || inversor.marca || null
  return paraConfigPersistida([{
    equipamento_id: referenciaDoCatalogo(inversor),
    marca,
    modelo: inversor.modelo || null,
    quantidade: q,
    entradas_por_micro: entradas,
    modulos_por_entrada: porEntrada,
    modulos,
    _fabricante: marca,
  }], fases)
}
