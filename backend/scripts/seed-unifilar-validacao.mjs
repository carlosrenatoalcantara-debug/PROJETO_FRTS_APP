/**
 * seed-unifilar-validacao.mjs — FV-DOM-007B
 *
 * Preenche o projeto do ambiente isolado com equipamento, topologia MPPT e dados
 * de ligação REAIS, para exercitar o motor canônico com um projeto completo — e
 * não com o projeto vazio, onde tudo cairia em default.
 *
 * Só toca o banco de validação (porta 37017). Nunca produção.
 */
import mongoose from 'mongoose'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cred = JSON.parse(readFileSync(path.join(RAIZ, '.ambiente-validacao.json'), 'utf8'))

if (!cred.uri.includes('37017')) {
  console.error('❌ Recusado: este script só roda no ambiente de validação (porta 37017).')
  process.exit(1)
}

await mongoose.connect(cred.uri)
const { ProjetoFV } = await import('../src/models/ProjetoFV.js')
const { AtivoEquipamento } = await import('../src/models/AtivoEquipamento.js')

await ProjetoFV.updateOne({ _id: cred.projeto_id }, {
  $set: {
    // `estado` na raiz é descartado pelo strict-mode: ele pertence a `localizacao`.
    localizacao: { cidade: 'Natal', estado: 'RN' },
    distribuidora: 'Neoenergia Cosern',
    'fatura_extracao.tipo_ligacao': 'Trifásico',
    'fatura_extracao.tensao_v': 380,
    equipamentos: {
      paineis: [{ id: 'dah_550', marca: 'DAH', modelo: 'DHN-72X16/DG(BW)-550W', potencia_w: 550, quantidade: 26 }],
      inversor: { marca: 'Deye', modelo: 'SUN-8K-G03', potencia_kw: 8, tipo: 'string', fases: 3 },
    },
    dimensionamento: {
      potencia_kwp: 14.3, num_paineis: 26, num_strings: 3, num_inversores: 1,
    },
    // `engenharia_eletrica` nasce null; dot-notation não cria o ancestral.
    engenharia_eletrica: { arranjo: {
      quantidade_modulos_por_string: 9,
      quantidade_strings_paralelo: 3,
      total_modulos: 26,
      num_mppts_usados: 2,
      mppts: [
        { mppt: 1, strings_paralelo: 2, modulos_por_string: 9, total_modulos: 18 },
        { mppt: 2, strings_paralelo: 1, modulos_por_string: 8, total_modulos: 8 },
      ],
    } },
  },
})

const jaTem = await AtivoEquipamento.countDocuments({ projeto_id: cred.projeto_id })
if (jaTem === 0) {
  await AtivoEquipamento.create([
    { projeto_id: cred.projeto_id, empresa_id: cred.empresa_id, tipo: 'modulo',   qr_code: 'QR-MOD-VAL-1', arranjo_id: 'A', status: 'instalado' },
    { projeto_id: cred.projeto_id, empresa_id: cred.empresa_id, tipo: 'inversor', qr_code: 'QR-INV-VAL-1', arranjo_id: 'A', status: 'operacional' },
  ])
}

const p = await ProjetoFV.findById(cred.projeto_id).lean()
console.log('projeto preenchido:', p.nome)
console.log('  inversor  :', p.equipamentos?.inversor?.marca, p.equipamentos?.inversor?.modelo)
console.log('  painel    :', p.equipamentos?.paineis?.[0]?.marca, p.equipamentos?.paineis?.[0]?.potencia_w + 'W')
console.log('  MPPTs     :', p.engenharia_eletrica?.arranjo?.mppts?.length)
console.log('  ligação   :', p.fatura_extracao?.tipo_ligacao, p.fatura_extracao?.tensao_v + 'V')
console.log('  ativos    :', await AtivoEquipamento.countDocuments({ projeto_id: cred.projeto_id }))

await mongoose.disconnect()
