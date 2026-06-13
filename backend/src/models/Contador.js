import mongoose from 'mongoose'

/**
 * Contador — P1-ASSET-CORE-01 (FASE 4)
 * Sequência atômica por chave (ex.: "qr_MOD", "qr_INV"). Garante numeração única
 * e sem corrida via $inc atômico (NUNCA Math.random). Base do QR institucional.
 */
const ContadorSchema = new mongoose.Schema({
  _id: { type: String },              // ex.: "qr_MOD"
  seq: { type: Number, default: 0 },
}, { collection: 'contadores' })

/** Incrementa atomicamente e devolve o novo valor da sequência. */
ContadorSchema.statics.proximo = async function (chave) {
  const doc = await this.findOneAndUpdate(
    { _id: chave },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  )
  return doc.seq
}

export const Contador = mongoose.models.Contador || mongoose.model('Contador', ContadorSchema)
export default Contador
