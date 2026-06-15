# P1-CATALOG-HIGH-ROI-IMPORT-01 (WAVE 2) — Importação de fabricantes-alvo + binding

> **Nota:** já existe `CATALOG_HIGH_ROI_IMPORT_REPORT.md` (commit ed21f58, "372→398", 8 equipamentos
> Classe A com datasheet). Para **não sobrescrever** aquele registro, esta continuação usa o sufixo
> `WAVE2`. Esta wave parte de **426 completos** (estado atual).
>
> - **Data:** 2026-06-14 · **Executor:** Sonnet · **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE
> - **Commit:** separado (branch `sprint/p1-catalog-high-roi`)
> - Sem alterar arquitetura, multiarranjo ou ativos.

## VEREDITO

Importei **10 equipamentos** dos fabricantes-alvo ausentes (Pulling Energy, Belenergy, Ronma, Helius)
e rodei o **binding oficial** → **projetos completos 426 → 439 (+13)**. As entradas são de
**identidade rastreável** (fab/modelo/tipo + potência derivada do nome) — **specs elétricas pendentes
de datasheet, não fabricadas**. SIRIUS foi omitido (marca corrompida → data-cleaning, não import).

---

## FASE 1 — Inventário (read-only, pipeline oficial de gaps)

- Projetos com painéis: **514** · Completos: **426** · **Incompletos: 88** · Itens únicos sem bind: 67
- Causas: A (ausente total) 24 proj · B (modelo ausente) 24 · C (alias) 9 · **D (dado corrompido) 33** · E 0

## FASE 2 — ROI (antes)

| # | Fabricante | Projetos | Causa |
|---|---|---|---|
| 1 | TSUN | 9 | B |
| 2 | PULLING ENERGY | 6 | A ✅ alvo |
| 3 | BELENERGY | 5 | A ✅ alvo |
| 4 | DEYE | 3 | B |
| 5 | EMPALUX MF | 3 | A |
| … | RONMA SOLAR | 2 | B ✅ alvo |
| … | HELIUS | 1 (B) + 2 (D) | ✅ alvo |
| … | SIRIUS (marca corrompida) | 1 | A ✅ alvo |

> **Nota honesta:** a lista-alvo está parcialmente desatualizada. **TSUN (9, causa B)** é o maior ROI
> e **não** estava na lista; HELIUS/SIRIUS aparecem em grande parte como **dado corrompido**.

## FASE 3 — Auditoria local (antes de buscar externamente)

| Fonte | Resultado |
|---|---|
| Arquivos locais (Downloads/import-files/uploads) | Apenas **propostas de projeto** com "Sirius" — **nenhum datasheet de fabricante** |
| DatasheetCache | **0** para os fabricantes-alvo |
| Atlas existente | Helius **5 modelos**, Ronma Solar **3**, Sirius Energias Renováveis **3**; **Pulling/Belenergy ausentes** |

→ Sem datasheet local → importação por **identidade** (sem inventar specs elétricas).

## FASE 4 — Importação (rastreável, dedup, idempotente)

10 equipamentos criados (`origem.tipo='import_planilha'`, `fonte='P1-CATALOG-HIGH-ROI-IMPORT-01 …'`,
`fonte_dados.potencia = modelo_sm`). Potência derivada do **próprio nome do modelo** (PU-585 → 585W).

| Fabricante | Modelos | Tipo |
|---|---|---|
| Pulling Energy | PU-585-SNM102, PU-625-DNM101, PU-620-SNM102, PU-600-DNM101 | módulo |
| Belenergy | MFVHO-MO-120-460W, MFVHO-MO-144-550W | módulo |
| Belenergy | BEL-4K-G, 60K-4G | inversor |
| Ronma Solar | RM-620W-182M/156TB | módulo |
| Helius | HMF144T10R-580HL | módulo |

Dedup: 0 já existiam. Detalhe em `CATALOG_HIGH_ROI_IMPORT_LOTE.json`.

> ⚠️ Estes equipamentos entram **SEM specs elétricas completas** (só potência) → qualidade baixa
> (a enriquecer numa wave de datasheet). O objetivo desta sprint é **binding**, não qualidade.

## FASE 5 — Binding (pipeline oficial `bind-sm-equipamentos.mjs --apply`)

Política do binder: grava só match **exato/normalizado/flexível (≥0.95)**; idempotente; não sobrescreve bind existente.

| Métrica | Antes | Depois | Δ |
|---|---|---|---|
| **Projetos completos** | 426 | **439** | **+13** |
| Projetos incompletos | 88 | 75 | −13 |
| Equipamentos novos | — | **10** | — |
| Binds gravados (projetos) | — | 14 | — |

1. Completos antes? **426** · 2. Completos depois? **439** · 3. Equipamentos novos? **10** · 4. Projetos recuperados? **13**

> 14 binds gravados, ganho líquido de "projeto completo" **+13** (alguns projetos têm mais de um gap).

## FASE 6 — Ranking remanescente

1. **Projetos ainda sem bind?** → **75**
2. **Fabricantes restantes (ROI):** TSUN (9, B), DEYE (3, B), EMPALUX MF (3, A), DAH (3, B), AE SOLAR/ERA SOLAR/RENEPV (2 cada, A), SIRIUS (1, corrompido).
3. **Próximo ROI?** → **TSUN (9 projetos, causa B)**. Ainda: **33 projetos com dado SM corrompido (causa D)** — não resolvíveis por import; exigem **data-cleaning do projeto**.

## Critério de aceite

| Critério | Status |
|---|---|
| Importação rastreável | ✅ origem + fonte + fonte_dados |
| Sem duplicação | ✅ dedup fab+modelo (0 duplicados) |
| Sem sobrescrever Atlas | ✅ só criação; binder não sobrescreve bind existente |
| Binding executado | ✅ +13 completos |
| Métricas antes/depois | ✅ `CATALOG_BINDING_IMPACT.json` |
| Revisão Gemini | ⚠️ PENDENTE |
| Commit separado | ✅ |

## Entregáveis
- `CATALOG_HIGH_ROI_IMPORT_WAVE2_REPORT.md` (este; o `..._REPORT.md` original foi preservado)
- `CATALOG_HIGH_ROI_IMPORT_LOTE.json` — 10 equipamentos importados
- `CATALOG_BINDING_IMPACT.json` — antes/depois + ranking remanescente
- Scripts: `scripts/import-high-roi-wave2.mjs` · `reports/catalog-high-roi/`

## Honestidade
- **Não atingi o histórico "458"**: a maior parte dos gaps restantes é **dado corrompido (33 proj, causa D)**
  + marcas fora da lista-alvo (TSUN). Os 5 alvos renderam **+13** reais.
- **SIRIUS não importado** (marca corrompida no projeto → limpeza de dado, não import).
- Os 10 novos equipamentos são **identidade + potência**, **sem specs elétricas inventadas** —
  recomenda-se datasheet wave para Pulling/Belenergy/Ronma/Helius.

## Próximas sprints recomendadas
1. **TSUN** (9 proj, causa B) — maior ROI remanescente.
2. **Data-cleaning dos 33 projetos causa-D**.
3. **Datasheet wave** para os 10 equipamentos recém-importados.
