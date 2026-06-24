# BUG_HIST_ENUM_01_REPORT.md

**Sprint:** P1-BUG-HIST-ENUM-01 · **Modelo:** Claude Opus 4.8 · **Data:** 2026-06-24
**Tipo:** Integridade de Catálogo · **Commit:** `9aa6029`

> GEMINI: revisão cruzada PENDENTE (sem ferramenta no ambiente).

## DECLARAÇÃO DE HONESTIDADE
```
VALIDADO EM CÓDIGO:  RCA na origem (catalogoQualidade.js:415 grava options.tipoEvento;
                     adminCatalogo.js emite reprocessamento_manual/edicao_manual/validacao_lote/
                     reprocessamento_lote; enum em Equipamento.js:72 não os continha).
VALIDADO EM RUNTIME: catálogo real (Railway/Atlas) — pré-fix: save() 422; pós-redeploy: save()
                     201 em inversor (ASW12K, 100KTL) E módulo (Astronergy). 0 valores fora do enum.
NÃO TESTADO:         UI do navegador (defeito é de backend/schema; validado via API).
```

## FASE 0 — Schema
`backend/src/models/Equipamento.js:70-78` → `EventoHistoricoSchema.tipo` (usado por todos os tipos
de equipamento via `ValidacaoSchema.historico`).

## FASE 1 — Auditoria (HISTORICO_ENUM_AUDIT.json)
- 382 equipamentos auditados (todos os tipos).
- Apenas **2 valores** de `validacao.historico[].tipo` no banco:
  - `validacao_automatica`: 474 eventos (no enum) ✓
  - `reprocessamento_manual`: 272 eventos — **FORA do enum** ✗
- **168 equipamentos distintos** afetados (módulos, inversores e 1 carregador_ev).

## FASE 2 — RCA
**Causa (A) — enum incompleto.** `reprocessamento_manual` é um evento **legítimo** emitido pelos
fluxos de admin (`adminCatalogo.js:287,468` → `processarEquipamento({ tipoEvento:'reprocessamento_manual' })`
→ `catalogoQualidade.js:415` grava `tipo`). Os eventos entraram no banco por caminho de escrita
sem validators (reprocessamento em lote), mas o enum do schema nunca foi atualizado. Agora qualquer
`save()` (validação completa) nesses 168 registros falhava com 422. **Não é dado inválido nem
migração quebrada** — o dado é correto; o enum estava desatualizado em relação ao código.

## FASE 3 — Correção
Enum sincronizado com os `tipoEvento` que o código realmente emite (1 linha, aditiva):
```
+ 'reprocessamento_manual','edicao_manual','validacao_lote','reprocessamento_lote'
```
(os 3 últimos ainda não estão no banco, mas são emitidos por adminCatalogo.js — incluídos para
impedir recorrência do MESMO bug). **Nenhum dado saneado** (valor era legítimo). **Sem migração.**

## FASE 4 — Runtime
| Evento | Pré-fix | Pós-redeploy |
|---|---|---|
| save() ASW12K-LT-G2 | 422 (enum) | **201 (atualizado)** |
| save() SUN2000-100KTL | 422 (enum) | **201 (atualizado)** |
| save() módulo Astronergy (afetado) | (bloqueado) | **201 (atualizado)** |
| valores fora do enum (re-audit) | 272 | **0** |
| total equipamentos | 382 | **382** (sem perda) |

## RESPOSTAS OBRIGATÓRIAS
1. **Registros afetados:** 168 equipamentos (272 eventos).
2. **Causa raiz:** enum incompleto (schema fora de sync com os eventos emitidos pelo código).
3. **Valor legítimo?** SIM (gerado por reprocessamento manual real do admin).
4. **Registros corrigidos:** 0 saneados (dado era válido); **168 desbloqueados** pelo fix de schema; save() validado em 3.
5. **Runtime executado?** SIM.
6. **Save voltou a funcionar?** SIM (422 → 201; inversor e módulo).
7. **Regressões?** NÃO (382 inalterado; specs intactas; enum aditivo).
8. **Necessitou migração?** NÃO.
9. **Commit:** `9aa6029`.
10. **Bug encerrado?** SIM.

## CRITÉRIO DE APROVAÇÃO
✅ nenhum erro 422 · ✅ enum consistente com o código · ✅ registros salvos normalmente ·
✅ integridade restaurada (382 registros, 0 valores fora do enum).
