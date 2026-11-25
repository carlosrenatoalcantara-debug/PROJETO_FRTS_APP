import mongoose from 'mongoose'

/** Campos do ProjetoFV que apontam para um equipamento do catálogo. */
const CAMPOS_REF = [
  'equipamentos.paineis', 'equipamentos.inversor',
  'arranjos.paineis', 'arranjos.inversores', 'arranjos.baterias',
]

/** Filtro (puro) de projetos não excluídos que usam qualquer um dos ids. */
export function filtroDeUso(ids = []) {
  const textos = ids.map(String).filter((i) => mongoose.Types.ObjectId.isValid(i))
  const oids = textos.map((i) => new mongoose.Types.ObjectId(i))
  return {
    excluido: { $ne: true },
    $or: [
      ...CAMPOS_REF.flatMap((c) => [
        { [`${c}.equipamento_id`]: { $in: oids } },
        { [`${c}.id`]: { $in: textos } },
      ]),
      { 'arranjos.configuracao_eletrica.micros.equipamento_id': { $in: oids } },
    ],
  }
}

/**
 * Projetos que usam o equipamento. `total` conta todos; os nomes só saem da
 * empresa de quem pediu (o catálogo é comum, os projetos não).
 */
export async function projetosQueUsam(ids, empresaId = null) {
  const { ProjetoFV } = await import('../models/ProjetoFV.js')
  const filtro = filtroDeUso(ids)
  const total = await ProjetoFV.countDocuments(filtro)
  if (total === 0 || !empresaId) return { total, nomes: [] }
  const docs = await ProjetoFV.find({ ...filtro, empresa_id: empresaId }).select('nome').limit(5).lean()
  return { total, nomes: docs.map((d) => d.nome).filter(Boolean) }
}

export function mensagemEmUso({ total, nomes }) {
  const lista = nomes.length ? ` (${nomes.join(', ')}${total > nomes.length ? '…' : ''})` : ''
  return `Em uso em ${total} projeto(s)${lista}. Troque o equipamento nesses projetos antes de excluir.`
}
