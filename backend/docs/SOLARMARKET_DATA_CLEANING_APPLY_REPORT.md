# P1-SOLARMARKET-DATA-CLEANING-APPLY-01 — Aplicação de R1/R2/R3

> - **Data:** 2026-06-14 · **Executor:** Sonnet · **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE
> - **Commit:** separado (branch `sprint/p1-sm-data-cleaning`)
> - Apenas R1/R2/R3 automáticas · sem revisão manual · sem alterar multiarranjo/arquitetura.

## VEREDITO

Limpei **26 itens corrompidos em 25 projetos** (R1/R2/R3) → **corrupção causa-D 33 → 8**. O ganho de
**binding foi +1** (439 → 440), porque a maioria dos modelos limpos **ainda não existe no Atlas**: a
limpeza **converteu corrupção em alvos de import claros** (Znshine 8, Trina Solar 6, Dah 4, Helius 2).
8 itens degenerados ficaram para revisão manual.

> **Correção de premissa honesta:** a sprint de planejamento estimou **+25 bindings**. Na prática a
> limpeza de string **não basta** — o modelo limpo precisa existir no Atlas para bindar. O ganho real
> de binding é **+1**; os outros ~24 viram **causa-B (importáveis)**, não bindados.

## FASE 1-2 — DRY RUN

25 projetos / 26 itens corrigíveis automaticamente; 8 degenerados pulados (manual). Sem caso ambíguo
aplicado (multi-fabricante no KIT, valores "-"/só-fab/fab+wattage → **pulados**). Exemplos:

| Projeto | Regra | Antes | Depois |
|---|---|---|---|
| 197 - Escola Pinheiros | R1 | `ZXMR-UPLDD144 / ZXMR-UPLDD144` | `Znshine / ZXMR-UPLDD144` |
| 038 - Big Blue | R2 | `TRINA SOLAR TALLMAX TSM-DE18 / 550` | `Trina Solar / TALLMAX TSM-DE18` |
| 192 - Emerson | R1 | `SUN-M225G4-EU-Q0 / SUN-M225G4-EU-Q0` | `Deye / SUN-M225G4-EU-Q0` |
| 259 - Luiz de França | R1 | `DHN-SU1K5T-G0 / DHN-SU1K5T-G0` | `Dah / DHN-SU1K5T-G0` |

Diff completo (antes/depois por item) em `SOLARMARKET_DATA_CLEANING_DIFF.json`.

**Respostas FASE 2:**
1. **Projetos alterados?** → **25**
2. **Bindings recuperados?** → estimado baixo no dry-run (modelos não no Atlas); confirmado **+1** no APPLY.
3. **Caso ambíguo?** → sim: 8 itens degenerados (`-`/`-`, `Trina550`, `EnergySun`, `ZNSHINE`, `DAH`, `600W/Bifacial`, `630/630`) → **não aplicados** (revisão manual).

## FASE 3 — APPLY (R1/R2/R3)

- **R1** (duplicação `marca==modelo`): 18 itens → fabricante inferido do prefixo do modelo.
- **R2** (concatenado, `modelo`=wattage): 8 itens → separa fabricante / modelo / potência.
- **R3** (cross-ref `proposta_sm` KIT): usado como fallback de fabricante.
- Guard de degenerado: pula valores que não são modelo real (sem inventar).
- Idempotente (re-execução → 0, pois as chaves causa-D mudam). Diff rastreável.

## FASE 4 — Binding oficial + reprocessamento

`bind-sm-equipamentos.mjs --apply` → **+1 projeto** totalmente vinculado (Deye SUN-M225G4-EU-Q0, já no
Atlas via Wave1b). Forensics reprocessado.

## FASE 5 — Resultado

| Métrica | Antes | Depois |
|---|---|---|
| **Projetos completos** | 439 | **440** |
| Projetos incompletos | 75 | 74 |
| **Itens corrompidos (causa-D)** | 33 proj | **8 proj** |
| Strings limpas | — | 26 (25 projetos) |

1. Completos antes? **439** · 2. Completos depois? **440** · 3. Recuperados (binding)? **1**
4. Continuam sem bind? **74** · 5. Para revisão manual? **8** (degenerados)

> A causa-B subiu (24 → 44): os modelos limpos (Znshine, Trina, Dah, Helius) agora aparecem como
> **"modelo ausente — importável"**, não mais como corrupção. Esse é o ganho estrutural.

## FASE 6 — Casos obrigatórios (após limpeza)

| Caso | Melhora de representação? | Cross-ref KIT? | Consistência |
|---|---|---|---|
| **Paulo Carlos** (207 + 207.2) | ✅ ambos **completos** (Pulling+TSUN / Helius+NEP bound) | n/a (já legível) | ✅ |
| **Fazenda Alice** (132.1/132.2) | 132.2 **completo**; 132.1 falta inversor Deye SUN-3K-G (causa-B) | parcial | ✅ parcial |
| **Escola Pinheiro** (197) | ✅ painel `ZXMR-UPLDD144 / ZXMR-UPLDD144` → **`Znshine / ZXMR-UPLDD144`** | ✅ Znshine inferido (prefixo ZXM + KIT "ZNSHINE 600") | ✅ falta só importar Znshine ZXMR |

**Respostas:**
1. **Melhorou a representação?** → **SIM** — duplicações resolvidas, fabricantes reais expostos (ex.: Znshine em Escola Pinheiro).
2. **Cross-reference do KIT funcionou?** → **SIM** para inferência de fabricante (fallback R3).
3. **Ganho de consistência?** → **SIM** — 25 projetos com strings limpas; causa-D 33→8; fabricantes reais visíveis.

## Critério de aceite

| Critério | Status |
|---|---|
| Apenas R1/R2/R3 | ✅ |
| Sem revisão manual | ✅ (8 degenerados pulados) |
| Sem alterar multiarranjo | ✅ |
| DRY RUN validado | ✅ |
| Commit separado | ✅ |
| Revisão Gemini | ⚠️ PENDENTE |

## Entregáveis
- `SOLARMARKET_DATA_CLEANING_APPLY_REPORT.md` (este)
- `SOLARMARKET_DATA_CLEANING_DIFF.json` — antes/depois por item (26 correções)
- `SOLARMARKET_DATA_CLEANING_METRICS.json` — métricas + fabricantes expostos
- Script: `backend/reports/sm-cleaning/apply-cleaning.mjs`

## Próxima sprint recomendada
**Import wave dos fabricantes expostos** (agora limpos e visíveis): **Znshine (8), Trina Solar (6),
Dah (4), Helius modelo HMB132T12R (2)** + TSUN (9) → converteria os ~24 projetos limpos em completos
(ROI real desta limpeza). Os 8 degenerados restantes seguem para revisão manual.
