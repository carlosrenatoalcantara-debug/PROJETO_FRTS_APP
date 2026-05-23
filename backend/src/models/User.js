import mongoose from 'mongoose'
import bcrypt from 'bcrypt'

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    nome: {
      type: String,
      required: true
    },
    cpf: {
      type: String,
      sparse: true,
      unique: true
    },
    senha_hash: {
      type: String,
      required: true
    },
    perfil: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user'
    },
    ativo: {
      type: Boolean,
      default: true
    },
    criado_em: {
      type: Date,
      default: () => new Date().toISOString()
    },
    ultimo_login: {
      type: Date,
      default: null
    },
    // Permissions
    permissoes: {
      criar_projetos: { type: Boolean, default: true },
      editar_projetos: { type: Boolean, default: true },
      deletar_projetos: { type: Boolean, default: false },
      visualizar_relatorios: { type: Boolean, default: true },
      exportar_dados: { type: Boolean, default: false },
      gerenciar_usuarios: { type: Boolean, default: false }
    }
  },
  { collection: 'usuarios', timestamps: true }
)

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('senha_hash')) return next()

  try {
    this.senha_hash = await bcrypt.hash(this.senha_hash, 10)
    next()
  } catch (error) {
    next(error)
  }
})

// Compare password method
userSchema.methods.compararSenha = async function (senhaFornecida) {
  return await bcrypt.compare(senhaFornecida, this.senha_hash)
}

// Remove password from JSON response
userSchema.methods.toJSON = function () {
  const obj = this.toObject()
  delete obj.senha_hash
  return obj
}

const User = mongoose.model('User', userSchema)

export default User
