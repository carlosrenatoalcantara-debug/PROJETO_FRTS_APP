# EV_CATALOG_SSOT_RCA.md

**Sprint:** P0-EV-CATALOG-SINGLE-SOURCE-OF-TRUTH-01 — **FASE 0/1/2 (RCA + decisão, READ-ONLY)**
**Modelo:** Claude Opus 4.8 · **Data:** 2026-06-24

> GEMINI: revisão cruzada PENDENTE (sem ferramenta no ambiente).

## DECLARAÇÃO DE HONESTIDADE
```
VALIDADO EM CÓDIGO:  caminhos de escrita/leitura de CarregadorEV e Equipamento mapeados linha a linha.
VALIDADO EM RUNTIME: catálogo vazio (0/0); sem dados a migrar nesta data.
NÃO IMPLEMENTADO:    nada (FASE 0 é read-only; a decisão exige ratificação — ver conflito de restrições).
```

## FASE 0 — RCA (respostas)
1. **Por que duas entidades?** `CarregadorEV` é o model NATIVO do módulo EV (rico, completo). `Equipamento` é o catálogo UNIFICADO do FV (SSOT do FV); os carregadores foram "encaixados" nele via um **mirror parcial** só para aparecerem no catálogo FV-style + motor de qualidade/score.
2. **Quem nasceu primeiro?** `CarregadorEV` (model próprio do EV). O mirror em `Equipamento` veio depois, para unificar com o catálogo FV.
3. **Quem depende de quem?** O mirror `Equipamento(carregador_ev)` é uma CÓPIA de `CarregadorEV` (depende dele). Os projetos EV dependem de `CarregadorEV` (fonte do snapshot).
4. **Quem sincroniza quem?** Só a importação por datasheet + endpoints de sync copiam `CarregadorEV → Equipamento` (one-way, parcial). **Cadastro manual e PUT NÃO sincronizam** → drift.
5. **Onde ocorre a perda?** (a) projeção lossy do mirror (13+ campos); (b) cadastro manual nunca cria o mirror (carregador some do catálogo Equipamento); (c) PUT atualiza só CarregadorEV (mirror envelhece).
6. **Quem usa cada um:**
   - OCR/import → escreve ambos.
   - Cadastro manual → **CarregadorEV**.
   - Projetos EV → **CarregadorEV** (snapshot subset em `projeto.snapshot_carregador`).
   - Dimensionamento/Orçamento/Unifilar → **`projeto.snapshot_carregador`** (derivado de CarregadorEV).
   - Catálogo unificado/Score → **Equipamento (mirror)**.
   - Catálogo EV (página) → **CarregadorEV** (`/api/carregadores-ev`).
7. **Verdadeira fonte de verdade?** Ver FASE 2.

## FASE 1 — Matriz de campos
Ver `EV_CATALOG_SSOT_FIELD_MATRIX.json` (campo × CarregadorEV × Equipamento × escreve × lê × pode-um-só × perdido).
**Resumo:** `CarregadorEV` é SUPERSET de `Equipamento`. O mirror é um SUBSET lossy.

## FASE 2 — Decisão de arquitetura (com conflito de restrições explícito)

### Causa raiz
O mirror `Equipamento(carregador_ev)` é uma **segunda fonte derivada e incompleta**, criada apenas para
dar visibilidade no catálogo/score FV-style. `CarregadorEV` é a fonte rica e nativa que os projetos EV
realmente consomem.

### Candidatos
- **CarregadorEV como SSOT** (recomendado tecnicamente): é o superset, nativo do EV, consumido pelos
  projetos e pelo cadastro manual. Eliminar o mirror = nenhuma duplicação. ✔ alinhado a "a fonte é quem
  os consumidores reais usam".
- **Equipamento como SSOT** (alinhado ao FV "um catálogo p/ tudo"): mas exigiria repontar a leitura dos
  **projetos EV** e da **API /carregadores-ev** — zonas RESTRITAS nesta sprint.

### ⚠️ CONFLITO REAL entre OBJETIVO e RESTRIÇÕES (precisa de ratificação)
A sprint quer **uma fonte única, sem mirror, sem sync** — porém proíbe alterar **Projetos EV,
Dimensionamento, APIs públicas, Score, Frontend, OCR**. Acontece que hoje **dois consumidores leem
modelos DIFERENTES**: projetos EV ↔ CarregadorEV; catálogo/score ↔ Equipamento. Logo, **é impossível ter
uma única fonte mantendo TODOS os consumidores intocados** sem cair num destes:
- (A) **CarregadorEV SSOT** → remover o mirror. Consequência: o catálogo FV-style/score deixa de ter docs
  de carregador (a menos que o catálogo passe a DERIVAR de CarregadorEV — toca a leitura do catálogo/score).
- (B) **Equipamento SSOT** → repontar a leitura dos projetos EV + API /carregadores-ev (toca zonas restritas).
- (C) **Manter mirror porém COMPLETO e sincronizado** em todos os caminhos → viola "nunca sincronizado/espelhado".

Nenhuma opção respeita 100% das restrições simultaneamente. **Isto é um achado, não uma escolha de
conveniência:** o objetivo "single source" é incompatível com "não tocar nenhum consumidor", porque os
consumidores hoje leem fontes diferentes.

### Recomendação
**CarregadorEV como fonte única de verdade** (opção A) — é o superset nativo que os projetos já usam.
O catálogo/score FV-style passaria a **derivar** a visão de carregador de CarregadorEV no momento da
leitura (projeção COMPLETA, nunca armazenada, nunca sincronizada). Isso toca **apenas a camada de leitura
do catálogo de carregadores** (não o score em si, não os projetos, não as APIs públicas de EV).
Como o catálogo está **vazio**, **não há migração** (FASE 5) e **não há os 7 para reprocessar** (FASE 6) —
ambos só fazem sentido após a re-importação.

## FASES 3-6 — pendentes de ratificação
A implementação (eliminar mirror + derivar a visão de catálogo) só deve começar após você ratificar a
opção (A/B/C) e autorizar qual camada de leitura pode ser tocada, já que o objetivo conflita com as
restrições como provado acima.

## RESPOSTAS OBRIGATÓRIAS (estado após FASE 0/1/2)
1. **Causa raiz?** Mirror parcial `Equipamento(carregador_ev)` = 2ª fonte derivada e lossy de `CarregadorEV`.
2. **Fonte única?** Recomendado: **CarregadorEV** (a ratificar).
3-6. Eliminação do mirror / sync / migração → **pendentes de ratificação** (catálogo vazio → sem migração/sem 7 agora).
7-8. Projetos EV / regressões → a validar na implementação.
9. **Runtime executado?** SIM (estado do catálogo + mapa de uso).
10. **Commit:** esta entrega (RCA + matriz).
