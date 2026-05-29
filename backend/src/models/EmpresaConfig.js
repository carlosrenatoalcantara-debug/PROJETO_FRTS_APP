import mongoose from 'mongoose'

/**
 * EmpresaConfig — Sprint 7.1
 *
 * Configuração institucional centralizada (singleton). Reúne dados da empresa,
 * responsável técnico, identidade visual e uploads (assinatura/carimbo/ART/docs).
 *
 * Singleton: identificado por `chave: 'default'`. Os 4 grupos são Mixed para
 * flexibilidade e evolução sem migração. Uploads guardados como base64/URL.
 *
 * NÃO contém usuários/permissões (fora de escopo da S7.1).
 */
const empresaConfigSchema = new mongoose.Schema({
  chave: { type: String, default: 'default', unique: true, index: true },

  // Dados institucionais
  empresa_config: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  // Responsável técnico (CREA/CFT, modalidade, etc.)
  responsavel_tecnico: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  // Identidade visual (logos + cores)
  branding: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  // Uploads: { assinatura, carimbo, art_padrao, documentos: [] } (base64/URL)
  uploads: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },

  // S8.3.2 — RBAC flexível por empresa: { perfil: { modulo: nivel } }. Vazio → matriz padrão.
  permissoes_customizadas: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  // S8.3.2 — dados bancários (múltiplas contas) p/ propostas/contratos/financeiro.
  // [{ banco, agencia, conta, tipo_conta, pix, titular, documento }]
  dados_bancarios: { type: [mongoose.Schema.Types.Mixed], default: () => ([]) },
}, { timestamps: true })

export const EmpresaConfig = mongoose.model('EmpresaConfig', empresaConfigSchema)
