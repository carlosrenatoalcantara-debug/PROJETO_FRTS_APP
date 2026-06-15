# P1-CATALOG-ROI-CLOSURE-01 — Fechamento dos gaps de catálogo (pós-limpeza)

> - **Data:** 2026-06-14 · **Executor:** Sonnet · **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE
> - **Commit:** separado (branch `sprint/p1-catalog-roi-closure`)
> - Sem alterar arquitetura, multiarranjo ou ativos.

## VEREDITO

Importei **9 modelos** dos fabricantes expostos pela limpeza (Tsun, Trina Solar, Znshine, Helius, Dah)
e rodei o binding → **projetos completos 440 → 467 (+27)**. Esse é o **ROI real da limpeza
SolarMarket**: a limpeza expôs os fabricantes, este import os converteu em completos. Identidade
rastreável (potência do nome), **sem inventar specs elétricas**.

---

## FASE 1 — Inventário dos gaps (alvos)

Todos **causa-B** (fabricante já no Atlas, modelo ausente):

| Fabricante | Modelos ausentes | Projetos |
|---|---|---|
| **Tsun** | TS-S8B-144-560W | 9 |
| **Trina Solar** | TALLMAX TSM-DE18 | 6 |
| **Znshine** | ZXMR-UPLDD144-600W, ZXMR-UPLDD144, ZXM7-SHLD144-550/M, ZXM7-UPLDD144-595, ZXMR-UPLDD144-600/N | 8 |
| **Helius** | HMB132T12R | 2 |
| **Dah** | DHN-SU1K5T-G0 | 2 |

## FASE 2 — Priorização

Ordem seguida: **TSUN (9) → Znshine (8) → Trina Solar (6) → Dah (2) → Helius (2)**.

## FASE 3 — Verificação Atlas

| Fabricante | Atlas | Ação |
|---|---|---|
| Tsun | presente (5 modelos) | importar 1 modelo (causa-B) |
| Trina Solar | presente (6) | importar 1 modelo |
| Znshine | presente (16) | importar 5 modelos |
| Helius | presente (6) | importar 1 modelo |
| Dah | presente (13) | importar 1 inversor |

Nenhum fabricante ausente → **só import de modelo** (causa-B). Alias não foi necessário para os alvos.

## FASE 4 — Importação mínima (rastreável, dedup, idempotente)

9 equipamentos criados (`origem.tipo='import_planilha'`, `fonte='P1-CATALOG-ROI-CLOSURE-01 …'`).
Potência derivada do nome do modelo (TS-S8B-144-**560W** → 560W; Dah DHN-**SU1K5T** → 1.5kW). Sem specs
elétricas inventadas. Dedup: 0 já existiam. Detalhe em `CATALOG_ROI_CLOSURE_LOTE.json`.

**Diferidos (não-modelo / degenerado):** Dah "Solar Unit" (3 proj, placeholder), Znshine "650w" (1),
+ 8 projetos causa-D corrompidos → revisão manual.

## FASE 5 — Binding (pipeline oficial)

| Métrica | Antes | Depois | Δ |
|---|---|---|---|
| **Projetos completos** | 440 | **467** | **+27** |
| Projetos incompletos | 74 | 47 | −27 |
| Equipamentos novos | — | 9 | — |

1. Completos antes? **440** · 2. Completos depois? **467** · 3. Recuperados? **27** · 4. Incompletos restantes? **47**

> 9 modelos → 27 projetos completados (cada modelo cobre vários projetos; alguns projetos tinham só esse gap).

## FASE 6 — Ranking final

1. **Quantos ainda faltam?** → **47** incompletos.
2. **Quantos exigem revisão manual?** → **8** (causa-D, dado corrompido irrecuperável: "Solar Unit", "650w", marca==modelo sem modelo real). **+9** são **alias-fixáveis** (causa-C, semi-automático).
3. **Próximo ROI?** → pequeno e pulverizado: **Deye (3,B), Empalux MF (3,A), Dah (3,B)**, depois AE Solar / Era Solar / Renepv (2 cada). O grande ROI foi **fechado** (TSUN/Znshine/Trina/Helius).

**Causas restantes:** A (ausente) 14 · B (modelo ausente) 17 · C (alias) 9 · D (corrompido) 8.

## Arco cumulativo do catálogo
**426** (pré-import) → **439** (import alvos Wave2) → **440** (limpeza) → **467** (este closure) = **90.9%** de 514.

## Critério de aceite

| Critério | Status |
|---|---|
| Importação mínima | ✅ 9 modelos (só causa-B) |
| Binding executado | ✅ +27 completos |
| Sem duplicação | ✅ dedup fab+modelo (0 duplicados) |
| Métricas antes/depois | ✅ `CATALOG_ROI_CLOSURE_METRICS.json` |
| Revisão Gemini | ⚠️ PENDENTE |
| Commit separado | ✅ |

## Entregáveis
- `CATALOG_ROI_CLOSURE_REPORT.md` (este)
- `CATALOG_ROI_CLOSURE_LOTE.json` — 9 modelos importados
- `CATALOG_ROI_CLOSURE_METRICS.json` — antes/depois + ranking final
- Script: `scripts/import-roi-closure.mjs`

## Honestidade
- Os 9 novos equipamentos são **identidade + potência** (do nome), **sem specs elétricas** (entram
  SEM_ESPECIFICACOES) → recomenda-se **datasheet wave** para qualidade.
- O grande salto (+27) é o **ROI diferido da limpeza** P1-SOLARMARKET-DATA-CLEANING (que sozinha rendeu
  só +1, mas expôs estes alvos). Limpeza + import são complementares.
- Restam **8 projetos com dado corrompido** (revisão manual) + gaps pequenos pulverizados.

## Próximas sprints recomendadas
1. **Revisão manual dos 8 causa-D** + alias dos 9 causa-C.
2. **Datasheet wave** para os equipamentos importados (Wave2 + closure) — qualidade.
3. Gaps pequenos restantes (Deye/Empalux/Dah, ≤3 proj cada) conforme prioridade.
