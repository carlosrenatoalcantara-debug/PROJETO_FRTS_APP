import mongoose from 'mongoose'

/**
 * ContaEnergiaCliente — conta de energia do cadastro do cliente.
 *
 * Conta NOVA = só `dados` (o que a conta diz, poucos KB): o arquivo original não
 * é guardado e os dois arquivos entregues (JSON e Markdown) são derivados de
 * `dados` na hora. Conta ANTIGA (anterior a esta decisão) tem o arquivo no
 * storage da empresa (`document_path`/`url_storage`, select:false) e continua
 * abrindo; nada foi migrado nem apagado.
 */
const contaEnergiaClienteSchema = new mongoose.Schema({
  empresa_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  clienteId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true, index: true },
  nome:             { type: String, required: true },
  mimetype:         { type: String, required: true },
  tamanho:          { type: Number, required: true },
  hash_sha256:      { type: String, required: true },
  storage_provider: { type: String, default: 'local' },
  document_path:    { type: String, default: null },
  url_storage:      { type: String, default: null, select: false },
  enviado_por:      { type: String, default: null },
  // Conta como dados. `numero_cliente`/`distribuidora` repetem campos de `dados`
  // para serem indexáveis (busca por UC sem varrer o objeto).
  dados:            { type: mongoose.Schema.Types.Mixed, default: null },
  numero_cliente:   { type: String, default: null, index: true },
  distribuidora:    { type: String, default: null },
}, { timestamps: true })

contaEnergiaClienteSchema.index({ empresa_id: 1, clienteId: 1, createdAt: -1 })

export const ContaEnergiaCliente = mongoose.models.ContaEnergiaCliente
  || mongoose.model('ContaEnergiaCliente', contaEnergiaClienteSchema)
