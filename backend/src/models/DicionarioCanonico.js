import mongoose from 'mongoose'

/**
 * DicionarioCanonico — CAT-KB-01
 *
 * Vocabulário OFICIAL Forte Solar (1 documento por campo canônico). Define o
 * nome canônico, a chave usada em `Equipamento.especificacoes` (compatibilidade
 * total — NÃO muda o schema de equipamento), tipo, unidade e grupo.
 *
 * Apenas LEITURA em runtime. Sem score, sem IA, sem aprendizado automático.
 */
const DicionarioCanonicoSchema = new mongoose.Schema({
  // Nome canônico definitivo (ex.: 'potencia_nominal_kw')
  campo: { type: String, required: true, unique: true, index: true },
  // Chave realmente gravada em Equipamento.especificacoes (ex.: 'potencia_kw')
  // — preserva compatibilidade com o catálogo atual.
  chave_especificacoes: { type: String, required: true },
  tipo: { type: String, enum: ['number', 'int', 'string', 'enum', 'array'], default: 'string' },
  unidade: { type: String, default: null },
  grupo: { type: String, default: 'GERAL' }, // AC | DC | EFIC | PROT | FIS | GERAL
  rotulo_ui: { type: String, default: null },
  obrigatorio: { type: Boolean, default: false },
  origem: { type: String, default: 'seed' },
}, { timestamps: true })

export const DicionarioCanonico = mongoose.model('DicionarioCanonico', DicionarioCanonicoSchema)
