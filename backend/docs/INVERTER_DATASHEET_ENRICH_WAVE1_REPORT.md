# P1-INVERTER-DATASHEET-ENRICH-WAVE1-01 — Onda 1 de enriquecimento (inversores)

> - **Data:** 2026-06-14 · **Executor:** Sonnet (Claude Code)
> - **Escopo executado:** 5 dos 10 modelos top-ROI — os **verificados por datasheet oficial lido** (aprovado no DRY RUN pelo usuário). Os outros 5 ficam para a Onda 1b.
> - **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE
> - **Commit:** separado (branch `sprint/p1-inverter-wave1`)

## VEREDITO

Os **5 inversores foram enriquecidos com specs corretas de datasheet oficial** (completude 0 → **95**).
Porém **apenas 1 saiu de inválido** (Deye SUN2000G3-US-220 → suspeito). Os outros 4 **continuam
inválidos por um falso-positivo do motor de qualidade** (`MPPT_INCOERENTE` crítico), não por dado
ruim. Descoberta principal: **as regras de plausibilidade são calibradas para inversor STRING e
penalizam MICROINVERSOR**. Não alterei regras (fora de escopo).

---

## FASE 1-2 — Datasheets oficiais + DRY RUN

Método: `WebFetch` baixa o PDF oficial → `Read` (visão PDF) extrai os valores exatos → origem
registrada por URL. Todos os 5 alvos confirmados **vazios** (`specKeys=0`) antes de escrever.

| Modelo | Tipo | Potência | Vmáx DC | MPPT | Imáx/MPPT | Nº MPPT | Efic. | Fases | Gar. | Fonte oficial |
|---|---|---|---|---|---|---|---|---|---|---|
| Deye SUN2000G3-US-220 | micro | 2.0kW | 60V | 25-55V | 13A | 4 | 96.5% | 1 | 10a | deyeinverter.com |
| Tsun TSOL-MX2250 | micro | 2.25kW | 60V | 16-60V | 18A | 4 | 97.0% | 1 | 12a | TSUNESS GEN3 |
| Tsun TSOL-MP2250 | micro | 2.25kW | 60V | 16-60V | 18A | 4 | 97.0% | 1 | 12a | TSUNESS GEN3 (família) |
| Growatt MIN 5000TL-X | string | 5.0kW | 550V | 80-550V | 13.5A | 2 | 98.4% | 1 | 10a | Growatt MIN 2500-6000TL-X |
| SAJ M2-2.25K-S4 | micro | 2.25kW | 60V | 16-60V | 20A | 4 | 97.0% | 1 | 12a | SAJ M2 datasheet |

Match/fabricante/modelo validados (identidade Deye confirmada em P0-INVERTER-IDENTITY-FORENSICS-01).
Detalhe + URLs em `INVERTER_DATASHEET_ENRICH_WAVE1_LOTE.json`.

## FASE 3 — APPLY (princípios cumpridos)

- **Nunca sobrescrever real:** só preencheu campos vazios (todos os 5 tinham 0 specs).
- **Origem rastreável:** `fonte_dados[campo] = { fonte:'datasheet_oficial', url, modelo_datasheet, em }`.
- **Idempotência:** reexecução pula campos já preenchidos (sem mudança).
- **Motor oficial:** `processarEquipamento` (mesmo dos endpoints) — sem motor novo, sem alterar regras.

## FASE 4 — Reprocessamento

Reprocessamento de qualidade rodado por item no APPLY (motor oficial). Completude foi a 95 em todos.

## FASE 5 — Métricas (antes/depois)

| Nível (catálogo) | Antes | Depois | Δ |
|---|---|---|---|
| invalido | 155 | 154 | −1 |
| suspeito | 164 | 165 | +1 |
| score global médio | 34.35 | 34.67 | +0.32 |

**Respostas:**
1. **Inversores enriquecidos?** → **5** (10 campos cada; completude 0→95).
2. **Quantos saíram de inválido?** → **1** (Deye SUN2000G3-US-220 → suspeito). Os outros 4 seguem inválidos por `MPPT_INCOERENTE` crítico (falso-positivo de regra — ver abaixo).
3. **Projetos recuperados?** → **110 projetos** deixaram de ter inversor inválido (o SUN2000G3). **0** chegaram a "utilizável" (vide bloqueadores).
4. **Quantos continuam inválidos?** → **154** no catálogo (era 155). Dos 5 da onda, **4** continuam inválidos.
5. **Ganho no score global?** → **+0.32** global (34.35→34.67). Nos 5 itens, **completude 0→95**.

---

## 🔎 Descoberta crítica — por que 4/5 não saíram de inválido (NÃO é dado ruim)

O motor levantou alertas em cima de specs **corretas de datasheet**. Dois bloqueadores de calibração:

### A) Regras de plausibilidade calibradas para STRING, penalizam MICRO
`src/services/regrasPlausibilidade.js`:
- **`MPPT_INCOERENTE` (crítico):** exige `MPPT_max < Voc_max_DC` (estrito). Os datasheets legítimos
  têm **`MPPT_max == Voc_max_DC`** (Growatt 550=550; micros 60=60) → crítico falso → **força inválido**.
- **`VOC_MAX_DC_IMPLAUSIVEL` (alto):** exige Voc_max_DC ∈ [200,1500]V; microinversores são **60V por projeto** → falso-positivo.
- **`MPPT_FAIXA_IMPLAUSIVEL` (médio):** exige MPPT_min ∈ [50,400]; micros são **16–60V** → falso-positivo.

Resultado: TSOL-MX2250, TSOL-MP2250, MIN 5000TL-X e M2-2.25K-S4 ficam inválidos por crítico falso,
apesar de completude 95. (O SUN2000G3 escapa porque seu MPPT_max 55 < Voc 60 → coerente.)

### B) Confiança: `import_solarmarket` ausente da tabela
`catalogoQualidade.js` → `BASE_POR_ORIGEM` não tem `import_solarmarket` → tratado como `desconhecido`
(confiança base **20**). Como `score = completude*0.4 + confiança*0.6`, mesmo completude 95 não chega
a "utilizável" (≥75) com confiança ~20. Nenhum item alcança "utilizável".

> Isso é coerente com a **OBSERVAÇÃO** da sprint (fatores não-técnicos não devem invalidar). Aqui o
> fator é **regra mal calibrada para micro** + **tabela de confiança sem import_solarmarket** — não o dado.
> **Não alterei regras** (fora de escopo desta sprint).

---

## Critério de aceite

| Critério | Status |
|---|---|
| Datasheets oficiais | ✅ PDFs oficiais lidos (deye, TSUNESS, Growatt, SAJ) |
| DRY RUN aprovado | ✅ aprovado pelo usuário (5 verificados) |
| APPLY executado | ✅ 5 enriquecidos, idempotente, rastreável |
| Reprocessamento executado | ✅ motor oficial por item |
| Métricas antes/depois | ✅ `INVERTER_WAVE1_METRICS.json` |
| Revisão Gemini | ⚠️ PENDENTE |
| Commit separado | ✅ branch `sprint/p1-inverter-wave1` |

## Entregáveis
- `INVERTER_DATASHEET_ENRICH_WAVE1_REPORT.md` (este)
- `INVERTER_DATASHEET_ENRICH_WAVE1_LOTE.json` — DRY RUN + valores aplicados + fontes
- `INVERTER_WAVE1_METRICS.json` — métricas + análise dos bloqueadores
- Scripts/evidência: `backend/reports/inverter-wave1/`

## Próximas sprints recomendadas
1. **P0-QUALITY-RULE-MICRO-CALIBRATION-01:** ajustar `regrasPlausibilidade.js` para microinversor
   (permitir `MPPT_max ≤ Voc_max_DC`; faixas de tensão de micro: Voc_max_DC e MPPT por tipo de
   equipamento) **+** incluir `import_solarmarket` em `BASE_POR_ORIGEM` (ou elevar `origem.tipo`
   para origem-datasheet ao enriquecer). Só isso já promove os 4 micros enriquecidos para utilizável.
2. **Onda 1b:** ler PDFs oficiais e aplicar os 5 restantes (Deye SUN2000G-US-220, Deye SUN-M225G4-EU-Q0,
   Kehua SPI6000-B2, SolarEdge SE 27.6K/20.1K) — +98 projetos.
