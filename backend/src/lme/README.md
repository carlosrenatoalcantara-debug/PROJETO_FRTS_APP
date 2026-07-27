# LME — Legacy Migration Engine

Motor único de migração de legado. Implementa a **ADR-022**; existe para cumprir
a regra 2 da **ADR-021**: *"se um dado histórico não couber no modelo canônico, o
problema é do dado — resolve-se no LME, por normalização, nunca afrouxando o Core."*

```
node backend/src/lme/__checks__/lme.check.js
```

---

## Fronteira

| | Core (`dominio/`) | LME (`lme/`) |
|---|---|---|
| Responde | como a operação **deve** funcionar | como o dado histórico **está** |
| Conhece o outro? | **não** | sim |
| Muda por causa do legado? | **nunca** | é a única coisa que muda |

A dependência é unidirecional e **verificada mecanicamente**: o check falha se
qualquer arquivo de `dominio/` importar deste módulo.

---

## Pipeline

Todo plano percorre exatamente esta ordem. Não há laço, contagem ou dry-run próprio.

```
Fonte → [validação bruta] → Normalizador → [validação canônica]
      → Matcher → Reconciliador → Aplicador
```

| Estágio | Assinatura | Responsabilidade |
|---|---|---|
| `fonte.extrair(ctx)` | → iterável de `{ ref, dados }` | ler a origem. `ref` = identidade **estável** na origem |
| `validador.bruto` *(opcional)* | → `{ ok, motivo }` | barrar ruído antes de gastar normalização |
| `normalizador.normalizar` | → `{ ok, canonico, motivo }` | **único** lugar que conhece o formato legado |
| `validador.canonico` *(opcional)* | → `{ ok, motivo }` | segunda barreira |
| `matcher.encontrar` | → `{ alvo, criterio, confianca }` | já existe no destino? |
| `reconciliador.decidir` | → `{ acao, motivo }` | decide. **Não escreve** |
| `aplicador.aplicar` | → `{ ok, destino_id, erro }` | **único** que toca o destino. Respeita `ctx.dryRun` |

**Ações** (vocabulário fechado): `criar` · `atualizar` · `ignorar` · `conflito`.
Ação fora da lista é erro registrado — nunca escrita silenciosa.

---

## Garantias do motor

1. **Dry-run é o padrão.** Escrever exige `{ dryRun: false }` explícito.
2. **`conflito` nunca sobrescreve.** Divergência não chega ao aplicador; vai para a fila humana.
3. **Falha de item não derruba a execução** — vira entrada de erro. O legado é sujo por definição.
4. **Falha de contrato derruba antes de começar** — plano inválido ou tenant ausente.
5. **Nenhum item some.** Todo item extraído gera entrada no ledger, com a etapa onde parou.
6. **Fail-closed de tenancy.** Se o alvo é `ESCOPO_TENANT` (M-4), sem `empresa_id` não roda.

---

## Ledger

Uma entrada por item: `{ ref, etapa, acao, motivo, destino_id, hash, erro }`.

| Consulta | Uso |
|---|---|
| `conflitos()` | o que exige decisão humana |
| `descartes()` | **o gap real do legado** — o que não coube no canônico |
| `totais` | relatório de execução |

`hash` é a chave de idempotência: reexecutar um plano converge.

**Nesta fase:** memória + `paraJSON()`. Persistência em coleção `MigracaoExecucao`
fica para o backfill real (Fase 0.5) — o formato já é o que será gravado.

---

## Fontes

| Plano | Alvo | Tenancy | Estado |
|---|---|---|---|
| `LME-CATALOGO-SM-01` (`fontes/solarmarket/`) | `Equipamento` | GLOBAL — dispensa `empresa_id` | adaptador sobre o ETL existente |

O ETL de `integracoes/solarmarket/` (2.782 LOC homologadas) **não foi reescrito**.
O adaptador é fino e é o único ponto do LME que conhece o formato SM.

```js
import { executarMigracao, planoCatalogoSolarMarket } from '../lme/index.js'
const rel = await executarMigracao(planoCatalogoSolarMarket, { dryRun: true, limite: 10 })
```

---

## Pendente

| # | Item | Bloqueio |
|---|---|---|
| 1 | Plano de backfill `empresa_id` (bloqueio #1 da Fase 0.5) | decisão D-4 (empresa default) + MongoDB |
| 2 | Persistência do ledger (`MigracaoExecucao`) | MongoDB |
| 3 | Triagem dos ~62 scripts ad-hoc (`scripts/` + `scripts/legacy/`) | — |
| 4 | Fontes ausentes: baterias, clientes, projetos, propostas | ver `docs/SOLARMARKET_MIGRATION_AUDIT.md` |
