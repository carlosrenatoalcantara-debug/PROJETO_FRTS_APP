// P1-ASSET-SECURITY-01 — migra senhas Wi-Fi em texto puro -> AES-256-GCM. Idempotente. [--apply]
import 'dotenv/config'
import { conectarBD } from '../../src/config/database.js'
import mongoose from '../../src/config/database.js'
import { AtivoEquipamento } from '../../src/models/AtivoEquipamento.js'
import { criptografar, descriptografar, estaCriptografado } from '../../src/services/ativoSeguranca.js'
import fs from 'fs'; import { fileURLToPath } from 'url'

const APPLY = process.argv.includes('--apply')
await conectarBD(); if (mongoose.connection.readyState !== 1) { console.error('DB_OFFLINE'); process.exit(1) }

const ativos = await AtivoEquipamento.find({ 'conectividade.senha_wifi': { $ne: null } })
let textoPuro = 0, jaCripto = 0, migrados = 0, falhas = 0
const detalhe = []
for (const a of ativos) {
  const v = a.conectividade?.senha_wifi
  if (estaCriptografado(v)) { jaCripto++; detalhe.push({ qr: a.qr_code, estado: 'JA_CRIPTOGRAFADO' }); continue }
  textoPuro++
  try {
    const blob = criptografar(v, a._id)
    // valida round-trip antes de gravar
    const back = descriptografar(blob, a._id)
    if (back !== v) throw new Error('round-trip falhou')
    if (APPLY) { a.conectividade.senha_wifi = blob; a.markModified('conectividade'); await a.save() }
    migrados++; detalhe.push({ qr: a.qr_code, estado: APPLY ? 'MIGRADO' : 'MIGRARIA', round_trip_ok: true })
  } catch (e) { falhas++; detalhe.push({ qr: a.qr_code, estado: 'FALHA', erro: e.message }) }
}

const out = { sprint: 'P1-ASSET-SECURITY-01', aplicado: APPLY, gerado_em: new Date().toISOString(),
  ativos_com_senha: ativos.length, texto_puro_antes: textoPuro, ja_criptografados: jaCripto,
  migrados, falhas, detalhe }
const dir = fileURLToPath(new URL('./', import.meta.url))
fs.writeFileSync(dir + (APPLY ? 'MIGRATION_APPLY.json' : 'MIGRATION_DRY.json'), JSON.stringify(out, null, 2))
console.log('MODO', APPLY ? 'APPLY' : 'DRY', '| com senha:', ativos.length, '| texto puro:', textoPuro, '| ja cripto:', jaCripto, '| migrados:', migrados, '| falhas:', falhas)
for (const d of detalhe) console.log('  ', d.qr, d.estado, d.erro || '')
await mongoose.connection.close(); process.exit(0)
