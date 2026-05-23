/**
 * DatasheetProcessamento.js — S2.6.3
 *
 * Cache semântico de datasheets processados pelo Gemini Vision.
 * Cada documento armazena o resultado completo da extração indexado
 * pelo hash SHA-256 do arquivo PDF original.
 *
 * Estratégia de invalidação:
 *  - `hash_pdf` único: mesmo arquivo não é reprocessado
 *  - `versao_parser`: bump manual quando o prompt Gemini ou a lógica de
 *    extração muda. O serviço compara versoes e re-processa se diferirem.
 *
 * Additive only: esta coleção não afeta nenhuma coleção existente.
 */

import mongoose from 'mongoose'

const DatasheetProcessamentoSchema = new mongoose.Schema(
  {
    // ─── Identificação ──────────────────────────────────────────────────────
    // unique: removido do campo individual — a unicidade é garantida pelo
    // índice composto { hash_pdf, versao_parser } abaixo, permitindo que o
    // mesmo PDF coexista com múltiplas versões do parser sem conflito.
    // (Se o índice hash_pdf_1 único ainda existir no Atlas de uma versão
    //  anterior, ele pode ser removido com: db.datasheet_processamentos.dropIndex("hash_pdf_1"))
    hash_pdf: {
      type:     String,
      required: true,
      index:    true,   // índice simples mantido para buscas por hash isolado
      // SHA-256 hex = 64 chars — comprimento fixo
    },

    // ─── Metadados do equipamento extraído ──────────────────────────────────
    fabricante: { type: String, default: null },
    modelo:     { type: String, default: null },

    // ─── Versionamento do parser ─────────────────────────────────────────────
    // Bump para forçar re-extração após mudança de prompt ou lógica
    versao_parser: {
      type:    String,
      default: '1.0.0',
      index:   true,
    },

    // ─── Resultado completo da extração ──────────────────────────────────────
    // Mixed para flexibilidade: pode ser { sucesso, dados, tipoDocumento, ... }
    resultado_extraido: {
      type:     mongoose.Schema.Types.Mixed,
      required: true,
    },

    // ─── Métricas de qualidade ───────────────────────────────────────────────
    // Score de qualidade Gemini (0-100), se disponível
    qualidade: {
      type:    Number,
      default: null,
      min:     0,
      max:     100,
    },

    // ─── Origem da extração ──────────────────────────────────────────────────
    origem: {
      type:    String,
      default: 'gemini_vision',
      enum:    ['gemini_vision', 'manual', 'pdfparse_fallback'],
    },

    // ─── Timestamps ──────────────────────────────────────────────────────────
    processado_em: {
      type:    Date,
      default: Date.now,
    },

    // ─── Rastreabilidade ────────────────────────────────────────────────────
    arquivo_nome: {
      type:    String,
      default: null,
      // Nome relativo do arquivo original (ex: "modulo/jinko-540.pdf")
    },

    // ─── Contagem de hits ────────────────────────────────────────────────────
    // Incrementado a cada cache hit para métricas de uso
    total_hits: {
      type:    Number,
      default: 0,
    },

    ultimo_hit_em: {
      type:    Date,
      default: null,
    },
  },
  {
    timestamps: true,  // createdAt, updatedAt automáticos
    collection: 'datasheet_processamentos',  // nome explícito evita colisão
  }
)

// ─── Índices compostos ────────────────────────────────────────────────────────

// Chave composta única: mesmo PDF em versões diferentes do parser → docs separados
// Garante que hash_pdf + versao_parser identificam exatamente um resultado de extração
DatasheetProcessamentoSchema.index({ hash_pdf: 1, versao_parser: 1 }, { unique: true })

// Busca por fabricante + modelo (relatórios)
DatasheetProcessamentoSchema.index({ fabricante: 1, modelo: 1 })

// Relatório de uso: mais acessados
DatasheetProcessamentoSchema.index({ total_hits: -1 })

export const DatasheetProcessamento = mongoose.model(
  'DatasheetProcessamento',
  DatasheetProcessamentoSchema
)
