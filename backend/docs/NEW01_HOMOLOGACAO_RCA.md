# NEW01_HOMOLOGACAO_RCA.md

**Sprint:** P0-NEW01-HOMOLOGACAO-PERSISTENCE-RCA-01
**Data:** 2026-06-20
**Modelo:** Claude Opus 4.8
**Tipo:** Root Cause Analysis (READ-ONLY — nenhuma correção aplicada)

---

## ⚠️ GEMINI

Sprint marca **GEMINI: Obrigatória**. Não há ferramenta Gemini neste ambiente.
RCA conduzida por Claude Opus 4.8 via leitura de código. **Revisão cruzada por Gemini: PENDENTE.**

---

## RESULTADO

```
P0 CONFIRMADO (com escopo REDUZIDO em relação ao que a auditoria afirmou)
```

O `Map()` em memória existe e perde dados em restart/deploy — **não é falso positivo**.
Porém, ao contrário do que a auditoria P1-FV-PRODUCTION-READINESS sugeriu (“status de homologação se perde”), o **núcleo do status JÁ está persistido no MongoDB**. O que de fato vive no Map é limitado ao **estado de marcação do checklist** e a uma **rota de status legada sem uso pela UI**.

**Bônus (achado mais grave que o restart):** o checklist nem sequer é lido de volta — o GET `/checklist` regenera um template stateless e **nunca consulta o Map**. O tick-state do checklist se perde a **cada reload de página**, independente de restart.

---

## FASE 1 — LOCALIZAÇÃO DO ARMAZENAMENTO EM MEMÓRIA

| Item | Local | Evidência |
|---|---|---|
| `Map()` singleton | `backend/src/controllers/homologacaoController.js:13` | `const homologacoesDB = new Map()` + comentário `// Mock database - em produção usar banco real` |
| Escrita (checklist) | `homologacaoController.js:252` | `atualizarChecklist` → `homologacoesDB.set(chave, {...})` |
| Escrita (status legado) | `homologacaoController.js:307` | `atualizarStatusHomologacao` → `homologacoesDB.set(...)` |
| Leitura (status legado) | `homologacaoController.js:295, 325` | `homologacoesDB.get(chave)` |
| Chave | — | `homologacao:${projetoId}` |

Não há outro cache/singleton de homologação. A "Central de Homologação Assistida" (rotas inline em `routes/homologacao.js`) **não usa o Map** — usa `projeto.save()`.

---

## FASE 2 — FLUXO: ORIGEM DO STATUS → PERSISTÊNCIA

Existem **DOIS sistemas paralelos** de status de homologação:

### Sistema A — LEGADO (em memória, `Map`)
```
Frontend (Checklist tab)
  └─ PATCH /homologacao/checklist ──► atualizarChecklist ──► homologacoesDB.set()  [VOLÁTIL]
  └─ GET   /homologacao/checklist ──► obterChecklist ──► gerarChecklistDocumentos()  [STATELESS — NÃO lê o Map]

Rota legada SEM caller no frontend:
  PATCH /homologacao/status ──► atualizarStatusHomologacao ──► homologacoesDB.set()  [VOLÁTIL, MORTO]
  GET   /homologacao/status ──► obterStatusHomologacao ──► homologacoesDB.get()      [VOLÁTIL, MORTO]
```

### Sistema B — ASSISTIDA / ATUAL (MongoDB)
```
Frontend (Central de Homologação — components/fv/homologacao/Homologacao.jsx)
  ├─ CentralDados      ──► lê proj.homologacao.status_homologacao            [Mongo ✅]
  ├─ CentralHistorico  ──► PATCH /homologacao/protocolo ──► projeto.save()   [Mongo ✅]
  └─ (transição de status) PATCH /homologacao/assistida/status ──► projeto.save()  [Mongo ✅, sem caller na UI atual]
```

A UI ativa (embutida em `ProjetosFVDetalhes`) usa o **Sistema B** para status/protocolo, e o **Sistema A** apenas para o checklist.

---

## FASE 3 — RESPOSTAS DIRETAS

**O status atual está salvo no Mongo?**
**SIM.** `projeto.homologacao.status_homologacao` (enum S9.0) e `projeto.homologacao.status` (enum legado) são campos do schema `ProjetoFV` (linhas 763-804), gravados via `projeto.save()` em `/assistida/status`.

**O histórico está salvo no Mongo?**
**SIM.** `projeto.homologacao.historico_status[]` (de/para/por/motivo/em) e `projeto.homologacao.protocolo_historico[]` são persistidos.

**As transições estão salvas?**
**SIM (quando via `/assistida/status`).** A transição grava em `historico_status`. **NÃO** se a transição passar pela rota legada `/status` (Map) — mas essa rota não tem caller na UI.

**O que é perdido após restart?**
Somente o conteúdo do `Map`:
- **Checklist:** `documentos[].concluido` (quais documentos foram marcados), `observacoes`, `status` do checklist.
- **Status legado (rota morta):** `status`, `data_envio`, `data_aprovacao`, `art_numero`, `observacoes` — gravados por `atualizarStatusHomologacao`, sem uso pela UI atual.

> **Nota crítica:** o checklist tick-state é perdido **mesmo sem restart**, porque `obterChecklist` (GET) regenera um template via `gerarChecklistDocumentos()` e nunca lê o `Map`. A escrita no Map é efetivamente **write-only/morta**.

---

## FASE 4 — GRAVIDADE

```
GRAVIDADE REAL: MÉDIA
```

Rebaixada de "maior risco operacional / P1" (auditoria) para **MÉDIA**, com justificativa honesta:

| Fator | Avaliação |
|---|---|
| Status de homologação persiste? | SIM (Mongo) — não se perde |
| Histórico/transições persistem? | SIM (Mongo) |
| Protocolo da concessionária persiste? | SIM (Mongo) |
| Documentos (memorial/ART/carta) | Regenerados sob demanda do projeto persistido |
| O que realmente se perde | Tick-state do checklist + payload de rota morta |
| Dado legal/financeiro perdido? | NÃO |

**Por que não BAIXA:** há defeito real e ativo — o checklist operacional não persiste (pior: nem dentro da mesma sessão), gerando retrabalho e percepção de perda de dados.
**Por que não ALTA/CRÍTICA:** nenhum dado durável de homologação (status, histórico, protocolo, ART gerada) reside no Map; o núcleo migrou para Mongo em sprints S9.0/MVP anteriores.

---

## FASE 5 — CORREÇÃO RECOMENDADA (arquitetura, sem implementar)

### Princípio
Eliminar o Sistema A (Map). Unificar tudo no subdoc `projeto.homologacao`, que **já existe** no schema.

### Mudanças propostas
1. **`atualizarChecklist` → MongoDB.** Persistir o estado do checklist em `projeto.homologacao.checklist_documentos` (campo já no schema) ou em um novo array `checklist_itens[{ chave, concluido, em, por }]`. Trocar `homologacoesDB.set` por `projeto.save()`.
2. **`obterChecklist` → ler o estado persistido.** Mesclar o template determinístico (`gerarChecklistDocumentos`) com os flags `concluido` salvos no projeto. Corrige o bug de não-leitura.
3. **Rota legada `/status`:** aposentar `atualizarStatusHomologacao`/`obterStatusHomologacao` (Map) ou redirecioná-las para o handler `/assistida/status` (Mongo). Remover o `Map` e o comentário "Mock database".
4. **Auditoria:** registrar transições de checklist no `AuditLog` (padrão já usado em `/assistida/status`).

### Arquitetura recomendada
```
ProjetoFV.homologacao {
  status_homologacao   (já existe, Mongo)
  historico_status[]   (já existe, Mongo)
  numero_protocolo     (já existe, Mongo)
  protocolo_historico[](já existe, Mongo)
  checklist_documentos (já existe — popular via PATCH e LER via GET)   ◄── alvo da correção
}
```
Fonte única de verdade = documento `ProjetoFV`. Zero estado em processo.

---

## RESPOSTAS OBRIGATÓRIAS

1. **Onde está o `Map()`:** `backend/src/controllers/homologacaoController.js:13` (`const homologacoesDB = new Map()`).
2. **O que ele guarda:** por chave `homologacao:${projetoId}` — (a) checklist: `documentos[]`, `observacoes`, `status`; (b) rota legada sem uso: `status`, `data_envio`, `data_aprovacao`, `art_numero`, `observacoes`.
3. **O que está persistido (Mongo `projeto.homologacao`):** `status`, `status_homologacao`, `historico_status[]`, `numero_protocolo`, `protocolo_atualizado_em`, `protocolo_historico[]`, `iniciada/concluida_em/por`, `checklist_documentos` (schema), `documento_memorial/carta/art`, `concessionaria`.
4. **O que NÃO está persistido:** o conteúdo do `Map` — tick-state do checklist (`documentos[].concluido`), observações e status do checklist; e o payload da rota legada `/status`.
5. **O que é perdido após deploy:** o estado do `Map` (checklist tick-state + status legado). Na prática o checklist já se perde a cada reload (GET não lê o Map).
6. **Gravidade real:** **MÉDIA** (rebaixada de ALTA/crítica da auditoria; núcleo persiste em Mongo).
7. **Correção recomendada:** migrar checklist (e aposentar o status legado) para `projeto.homologacao.checklist_documentos`; fazer o GET ler o estado persistido; remover o `Map`.
8. **Necessita migração?** **De dados: NÃO** (o `Map` é volátil; não há dado durável a migrar). **De código: SIM** (reescrever `atualizarChecklist`/`obterChecklist` e aposentar `atualizar/obterStatusHomologacao`). **De schema: NÃO/mínimo** (`checklist_documentos` já existe; opcionalmente formalizar um array de itens).
9. **Commit gerado:** ver rodapé.

---

## VEREDITO

```
P0 CONFIRMADO (não é falso positivo) — porém com BLAST RADIUS REDUZIDO.
Gravidade real: MÉDIA. Migração de dados: NÃO. Migração de código: SIM.
```
