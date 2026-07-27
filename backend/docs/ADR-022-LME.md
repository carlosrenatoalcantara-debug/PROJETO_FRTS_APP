# ADR-022 — Legacy Migration Engine (LME)

**Status:** aceita · **Data:** 2026-07-27 · **Depende de:** ADR-021 (arquitetura congelada)
**Implementação:** `backend/src/lme/` · **Doc operacional:** `backend/src/lme/README.md`

> ADR-021 não está persistida como arquivo neste repositório; suas regras vivem em
> `backend/src/dominio/README.md`. Esta ADR referencia aquelas regras.

---

## Contexto

A ADR-021 nomeia o LME e lhe atribui toda a responsabilidade sobre o legado, mas
o LME não existia como código. Na prática, a migração acontecia em:

| Onde | Volume | Problema |
|---|---|---|
| `src/integracoes/solarmarket/` | 2.782 LOC | pipeline correto, mas específico do SM e sem ledger |
| `backend/scripts/*.mjs` | ~25 scripts | cada um com laço, dry-run e relatório próprios |
| `backend/scripts/legacy/*` | ~37 scripts | one-shot, sem contrato, sem rastro |

Consequências: nenhuma migração é auditável ("este registro legado virou o quê,
por qual critério?"), a idempotência depende de disciplina do autor do script, e
a pressão do legado tende a vazar para o Core — exatamente o que a ADR-021 proíbe.

O gatilho imediato é o bloqueio #1 da Fase 0.5: backfill de `empresa_id` nos dados
legados. Sem ele, o enforcement fail-closed de tenancy torna todo dado legado
inacessível. Esse backfill não pode ser mais um script solto.

---

## Decisão

Criar o LME como **motor único**, com contrato de pipeline obrigatório. Toda
migração de legado — importação externa ou reprocessamento de dado já no banco —
é declarada como **plano** e executada por um **orquestrador único**.

```
Fonte → [validação bruta] → Normalizador → [validação canônica]
      → Matcher → Reconciliador → Aplicador
```

### D-1 · Contrato antes de implementação
Nenhum plano implementa laço, contagem, dry-run ou relatório próprio. Isso é do
orquestrador. Plano incompleto é rejeitado na largada, com a lista completa de falhas.

### D-2 · Dry-run é o padrão
Escrever exige `{ dryRun: false }` explícito. O default de qualquer migração é simular.

### D-3 · `conflito` é ação de primeira classe
Divergência entre legado e destino **não** chega ao aplicador. Vai para fila humana.
Migração jamais sobrescreve por conta própria.

### D-4 · Ledger obrigatório
Uma entrada por item, com a etapa onde parou. Nenhum item some em silêncio.
`descartes()` é o produto mais valioso: o **gap real do legado** — o que não coube
no modelo canônico. Essa lista alimenta decisões de negócio, não mudanças no Core.

### D-5 · Tolerância assimétrica a falhas
Falha de **item** registra e segue (o legado é sujo por definição). Falha de
**contrato** (plano inválido, tenant ausente) aborta antes de começar.

### D-6 · Fail-closed de tenancy na origem
Se o agregado de destino é `ESCOPO_TENANT` (ADR-021 M-4), a migração não roda sem
`empresa_id`. É o LME que consome `dominio/tenancy` — nunca o inverso.

### D-7 · O ETL SolarMarket vira uma Fonte, não é reescrito
`integracoes/solarmarket/` permanece a implementação real; o LME o adapta ao
contrato. Reescrever duplicaria 2.782 linhas homologadas. O adaptador é o único
ponto do LME que conhece o formato SM.

### D-8 · Fronteira verificada mecanicamente
A regra "o Core não conhece o LME" é um check executável, não um parágrafo de README:
`lme.check.js` falha se qualquer arquivo de `dominio/` importar do LME.

---

## Alternativas descartadas

| Alternativa | Por que não |
|---|---|
| Generalizar o ETL SM in loco | acopla o motor ao formato de uma origem; a ADR-021 proíbe formato de importação virar requisito |
| Biblioteca de ETL de terceiros | o valor está no contrato de domínio (tenancy, conflito, ledger), não no laço |
| Manter scripts, só padronizar relatório | não resolve idempotência, conflito nem rastro; a disciplina continua opcional |

---

## Consequências

**Positivas:** migração auditável e repetível; o gap do legado vira dado explícito;
o Core fica protegido por construção; o backfill da Fase 0.5 tem onde nascer.

**Custos:** todo novo importador paga o preço de declarar 5 estágios; os ~62 scripts
existentes ficam fora do contrato até serem triados (não bloqueia nada, mas é dívida).

**Aberto:** persistência do ledger (`MigracaoExecucao`) depende de MongoDB;
o plano de backfill `empresa_id` depende da decisão D-4 da Fase 0.5 (empresa default).
