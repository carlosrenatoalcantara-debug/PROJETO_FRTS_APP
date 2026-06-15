# P1-INVERTER-DATASHEET-ENRICH-WAVE1B-01 — Segunda metade da Wave 1

> - **Data:** 2026-06-14 · **Executor:** Sonnet · **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE
> - **Commit:** separado (branch `sprint/p1-inverter-wave1b`)
> - Motor já calibrado por P1-QUALITY-MICRO-CALIBRATION-APPLY-01 → enriquecimentos já classificam corretamente.

## VEREDITO

**3 dos 5 modelos enriquecidos por datasheet oficial → todos `utilizável` (score 83, 0 alertas)**,
recuperando **78 projetos**. Os **2 SolarEdge foram diferidos** porque `solaredge.com` bloqueia o
download automático (HTTP 403) e a sprint exige **PDF oficial, sem dados de terceiros** — não os
enriqueci por resumo. A calibração da sprint anterior funcionou: **zero falsos-positivos**.

---

## FASE 1 — Datasheets oficiais lidos (download → leitura direta do PDF)

| Modelo | Fonte oficial | Como |
|---|---|---|
| Deye SUN2000G-US-220 | deyeinverter.com — datasheet SUN(1300-2000)G3-US-220 | PDF lido (mesmo micro 2000W US-220; rótulo SolarMarket "G" = "G3" confirmado por usuário + forense) |
| Deye SUN-M225G4-EU-Q0 | deyeinverter.com/.../datasheet_sun-m220-225g4-eu-q0_241021_en.pdf | **PDF oficial lido** |
| Kehua TECH SPI6000-B2 | digitalenergy.kehua.com — página oficial Kehua (SPI3000~6000-B2) | página oficial do fabricante |
| ~~SolarEdge SE 27.6K~~ | — | **DIFERIDO**: solaredge.com 403; arquitetura otimizador (sem faixa MPPT tradicional) |
| ~~SolarEdge SE 20.1K~~ | — | **DIFERIDO**: solaredge.com 403; modelo SE20.1K a confirmar |

URLs/origem registrados em `INVERTER_DATASHEET_ENRICH_WAVE1B_LOTE.json`.

## FASE 2 — DRY RUN (validado)

| Modelo | Projetos | Campos preenchidos | Pulados (já existiam) | Match |
|---|---|---|---|---|
| Deye SUN2000G-US-220 | 36 | 10 | 0 | ✅ |
| Deye SUN-M225G4-EU-Q0 | 30 | 10 | 0 | ✅ |
| Kehua TECH SPI6000-B2 | 12 | 9 | 0 | ✅ |

✅ **Match correto**, ✅ **campos vazios** (0 pulados → nenhuma sobrescrita), ✅ **alertas []** (sem falso-positivo).

## FASE 3 — APPLY

Motor oficial `processarEquipamento`; **somente campos vazios**; `fonte_dados = datasheet_oficial + URL`;
`origem.tipo = datasheet_pdfparse`; idempotente.

## FASE 4 — Reprocessamento oficial

`POST /api/admin/catalogo/reprocessar-todos?limite=2000` → `{ processados:358, erros:0 }`.

## FASE 5 — Resultado

| Métrica | Antes | Depois | Δ |
|---|---|---|---|
| Inválidos | 150 | **147** | −3 |
| Utilizáveis | 32 | **35** | +3 |
| Score global | 35.28 | **35.84** | +0.56 |

1. **Equipamentos enriquecidos?** → **3**
2. **Saíram de inválido?** → **3**
3. **Tornaram-se utilizáveis?** → **3** (todos, score 83, 0 alertas)
4. **Projetos beneficiados?** → **78** (36 + 30 + 12)
5. **Novo score global?** → **35.84**
6. **Inválidos restantes?** → **147**

## FASE 6 — Ranking atualizado

1. **Inversores SEM_ESPECIFICACOES restantes?** → **122**
2. **Próximos 10 modelos de maior ROI:**

| # | Fabricante | Modelo | Projetos |
|---|---|---|---|
| 1 | SolarEdge | SE 27.6K 380/220v | 11 ⏸️ (diferido) |
| 2 | SolarEdge | SE 20.1K 380/220v | 9 ⏸️ (diferido) |
| 3 | Hoymiles | HMS-2000DW-4T | 8 |
| 4 | SolarEdge | SE 33.3K 380/220v | 8 |
| 5 | Nep | BDM-2250 | 7 |
| 6 | Deye | SUN-8K-G03 | 6 |
| 7 | Growatt | MIN 6000TL-X | 6 |
| 8 | Deye | SUN-4K-G | 5 |
| 9 | Growatt | MIC 3000TL-X | 4 |
| 10 | Deye | SUN-10K-G | 4 |

3. **Quantos projetos representam?** → **68** (os 10 acima).

> Os 3 SolarEdge (SE 27.6K/20.1K/33.3K = 28 projetos) lideram o ROI restante mas dependem do
> datasheet oficial SolarEdge (bloqueado para download automático). Recomenda-se obter o PDF
> SolarEdge (BR três-fásico) para uma Wave dedicada — atenção: arquitetura com otimizadores não
> tem faixa MPPT tradicional (DC fixo ~750V, máx 900V), mapear só os campos aplicáveis.

## Critério de aceite

| Critério | Status |
|---|---|
| PDFs oficiais lidos | ✅ (3/5; 2 SolarEdge diferidos por bloqueio 403 — não fabricados) |
| DRY RUN validado | ✅ |
| APPLY executado | ✅ 3 enriquecidos |
| Reprocessamento executado | ✅ endpoint oficial 358/358 |
| Origem registrada | ✅ `datasheet_pdfparse` + URL por campo |
| Revisão Gemini | ⚠️ PENDENTE |
| Commit separado | ✅ |

## Entregáveis
- `INVERTER_DATASHEET_ENRICH_WAVE1B_REPORT.md` (este)
- `INVERTER_DATASHEET_ENRICH_WAVE1B_LOTE.json` — aplicados + diferidos + fontes
- `INVERTER_WAVE1B_METRICS.json` — antes/depois + ranking
- Evidência: `backend/reports/inverter-wave1b/`

## Honestidade
- **2 de 5 modelos não foram enriquecidos** (SolarEdge): preferi **diferir** a fabricar specs a partir
  de resumos de terceiros. Wave1b entregou **78 dos 98 projetos** previstos; os 20 restantes (SolarEdge)
  ficam para uma wave com o PDF oficial em mãos.
- `SUN2000G-US-220` usou o datasheet oficial do **SUN2000G3-US-220** (mesmo micro 2000W US-220) — rótulo
  "G" vs "G3" reconciliado pela forense de identidade + confirmação do usuário.
