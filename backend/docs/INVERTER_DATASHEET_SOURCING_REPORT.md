# P1-INVERTER-DATASHEET-SOURCING-01 — Inventário e priorização para coleta de datasheets

> **READ ONLY.** Nenhuma alteração no Atlas, catálogo ou projetos. Nenhum datasheet buscado.
> Objetivo: inventariar e priorizar (preparar a execução; não enriquecer).
> - **Data:** 2026-06-14 · **Executor:** Sonnet (Claude Code)
> - **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE

## Resumo executivo

131 inversores inválidos (`SEM_ESPECIFICACOES`) = **131 modelos únicos**. Eles bloqueiam **464
projetos distintos**. A distribuição é fortemente **Pareto**: **5 datasheets recuperam 208 projetos
(45%)** e **10 datasheets recuperam 262 (56%)**. Identidade Deye já confirmada
(P0-INVERTER-IDENTITY-FORENSICS-01) — sem ambiguidade Huawei.

---

## FASE 1 — Inventário (por fabricante, ordenado por frequência)

- Inversores inválidos: **131** · Modelos únicos: **131** (1 ocorrência/modelo, sem duplicatas)
- Com ≥1 projeto: **119** · Com 0 projetos: **12** (baixa prioridade)

**Concentração por fabricante (top 10 por projetos):**

| Fabricante | Modelos | Projetos impactados |
|---|---|---|
| Deye | 41 | 243 |
| Growatt | 19 | 50 |
| Kehua | 18 | 40 |
| Tsun | 5 | 35 |
| Solaredge | 9 | 35 |
| Solplanet | 7 | 11 |
| Hoymiles | 3 | 10 |
| Saj | 1 | 9 |
| Nep | 1 | 7 |
| Solis | 6 | 5 |

> **Deye** sozinho concentra 41 modelos e **243 projetos** (52% do total bloqueado).

---

## FASE 2 — Ranking ROI

1. **Quantos modelos únicos existem?** → **131** (119 com projeto, 12 sem).
2. **Os 10 modelos que recuperam mais projetos** e **3. quantos projetos cada um impacta:**

| # | Fabricante | Modelo | Projetos | Classe |
|---|---|---|---|---|
| 1 | Deye | SUN2000G3-US-220 | **110** | A |
| 2 | Deye | SUN2000G-US-220 | 36 | A |
| 3 | Deye | SUN-M225G4-EU-Q0 | 30 | A |
| 4 | Tsun | TSOL-MP2250 | 16 | A |
| 5 | Tsun | TSOL-MX2250 | 16 | A |
| 6 | Growatt | MIN 5000TL-X | 13 | A |
| 7 | Kehua | TECH SPI6000-B2 | 12 | A |
| 8 | Solaredge | SE 27.6K 380/220v | 11 | A |
| 9 | Saj | M2-2.25K-S4 | 9 | A |
| 10 | Solaredge | SE 20.1K 380/220v | 9 | A |

> Os 5 maiores são **3 modelos Deye + 2 Tsun**. O #1 (Deye SUN2000G3-US-220, **110 projetos**) sozinho
> vale mais que os 9 seguintes somados. Lista completa de 131 em `INVERTER_DATASHEET_PRIORITY_LIST.json`.

**União deduplicada (um projeto não usa dois desses modelos → ROI é aditivo neste dataset):**

| Cobertura | Projetos recuperados | % de 464 |
|---|---|---|
| Top 1 | 110 | 24% |
| Top 3 | 176 | 38% |
| **Top 5** | **208** | **45%** |
| Top 10 | 262 | 56% |
| Top 20 | 316 | 68% |
| Todos (119 c/ projeto) | 464 | 100% |

---

## FASE 3 — Classificação A/B/C

| Classe | Definição | Modelos |
|---|---|---|
| **A** completo e identificável | fabricante conhecido + código de modelo limpo | **127** |
| **B** parcialmente identificável | nome com ruído/fraco | **4** |
| **C** ambíguo | lixo / sem fabricante | **0** |

**Os 4 da classe B** (nome com ruído `@`/genérico — exigem confirmação do SKU antes do datasheet):
- Deye `SUN-5K-G @220` (3 proj) · Deye `SUN-10K-G @380` (1) · Deye `SUN-5K-G @380` (0) · Solis `50K` (1)

> Sufixo `@220`/`@380` é tensão de rede anexada ao nome (ruído de import), não parte do modelo Deye.
> Provavelmente consolidam no datasheet base `SUN-5K-G` / `SUN-10K-G`.

---

## FASE 4 — Checklist de coleta de datasheets

Tabela completa (fabricante · modelo · projetos · A/B/C · `equipamento_ids`) em
**`INVERTER_DATASHEET_PRIORITY_LIST.json`** (131 itens, em ordem de prioridade ROI, `datasheet_status:"PENDENTE"`).
Campos-alvo a extrair de cada PDF: `potencia_kw`, `tensao_max_entrada`, `tensao_mppt_min`,
`tensao_mppt_max`, `corrente_max_por_mppt`, `n_mppts`, `strings_por_mppt`, `eficiencia_maxima`,
`fases`, `garantia_anos`.

**Top 10 do checklist (prioridade máxima):**

| Prioridade | Fabricante | Modelo | Projetos | Classe |
|---|---|---|---|---|
| 1 | Deye | SUN2000G3-US-220 | 110 | A |
| 2 | Deye | SUN2000G-US-220 | 36 | A |
| 3 | Deye | SUN-M225G4-EU-Q0 | 30 | A |
| 4 | Tsun | TSOL-MP2250 | 16 | A |
| 5 | Tsun | TSOL-MX2250 | 16 | A |
| 6 | Growatt | MIN 5000TL-X | 13 | A |
| 7 | Kehua | TECH SPI6000-B2 | 12 | A |
| 8 | Solaredge | SE 27.6K 380/220v | 11 | A |
| 9 | Saj | M2-2.25K-S4 | 9 | A |
| 10 | Solaredge | SE 20.1K 380/220v | 9 | A |

---

## FASE 5 — Respostas

1. **Quantos PDFs serão necessários?**
   - **Limite superior: 131** (um por modelo único). **Com ROI: 119** (os 12 sem projeto são opcionais).
   - **Na prática, menos**, por **famílias de datasheet**: Solaredge SE 20.1K/27.6K/33.3K, Growatt MIN 5000/6000TL-X, e a família Deye SUN-xK-G normalmente compartilham um PDF multi-modelo. O número exato só se fecha na coleta; estimativa pragmática ≈ **60–90 PDFs** cobrem os 119, e **10 PDFs já cobrem 56% do ROI**.
2. **Quantos projetos pelos 5 maiores modelos?** → **208 projetos** (união deduplicada) = **45%** dos 464.
3. **Qual o ROI esperado do enriquecimento?**
   - **Total destravável: 464 projetos distintos** (de `invalido` → potencialmente utilizável), enriquecendo os 119 modelos com projeto.
   - **Forte Pareto:** **5 PDFs → 208 projetos (45%)**, **10 PDFs → 262 (56%)**, **20 PDFs → 316 (68%)**.
   - **Maior alavanca isolada:** o datasheet **Deye SUN2000G3-US-220** sozinho = **110 projetos (24%)**.

---

## Critério de aceite

| Critério | Status |
|---|---|
| Read only | ✅ |
| Nenhuma alteração no Atlas | ✅ |
| Nenhuma alteração em projetos | ✅ |
| Ranking de ROI | ✅ (união deduplicada) |
| Revisão Gemini | ⚠️ PENDENTE |

## Entregáveis
- `INVERTER_DATASHEET_SOURCING_REPORT.md` (este)
- `INVERTER_DATASHEET_PRIORITY_LIST.json` — 131 modelos priorizados por ROI + campos-alvo + `equipamento_ids`
- Dados/scripts read-only: `backend/reports/inverter-sourcing/`

## Próximo passo sugerido
Coletar os PDFs na ordem do checklist (começar pelo top-5 = 45% do ROI), colocá-los na pasta de
datasheets e fornecer `GOOGLE_API_KEY`, para então rodar o pipeline oficial
(`npm run catalogo:enriquecer-datasheets -- --tipo=inversor --dir=… --scan-only` e depois `--apply`),
conforme decidido na P1-INVERTER-DATASHEET-ENRICH-01.
