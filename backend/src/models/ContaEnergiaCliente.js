import mongoose from 'mongoose'

/**
 * ContaEnergiaCliente — conta de energia anexada ao cadastro do cliente.
 *
 * Coleção própria (não embutida em Cliente): o arquivo pode ter até 10 MB e não
 * deve viajar em toda leitura do cliente. O conteúdo vai para o storage da
 * empresa (documentStorageService); aqui ficam metadados + referência.
 * `url_storage` é select:false — a listagem nunca carrega o conteúdo.
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
}, { timestamps: true })

contaEnergiaClienteSchema.index({ empresa_id: 1, clienteId: 1, createdAt: -1 })

export const ContaEnergiaCliente = mongoose.models.ContaEnergiaCliente
  || mongoose.model('ContaEnergiaCliente', contaEnergiaClienteSchema)
