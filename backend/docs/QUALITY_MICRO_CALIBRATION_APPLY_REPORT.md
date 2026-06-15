# P1-QUALITY-MICRO-CALIBRATION-APPLY-01 — Aplicação do Cenário C

> Aplica **exclusivamente** o Cenário C aprovado em P0-QUALITY-RULE-MICRO-CALIBRATION-01.
> Sem reescrever motor, sem alterar arquitetura, sem nova classificação persistida, **sem inflar
> confiança do import_solarmarket**.
> - **Data:** 2026-06-14 · **Executor:** Sonnet · **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE
> - **Commit:** separado (branch `sprint/p1-micro-calibration-apply`)

## VEREDITO

✅ Resultado **idêntico à simulação validada (172/172)**: `utilizável 27 → 32`, `inválido 154 → 150`,
`score 34.67 → 35.28`. Os 5 inversores enriquecidos viraram **utilizável (score 83, zero alertas)**.
Os 126 inversores sem specs **continuam inválidos** — nenhuma inflação.

---

## FASE 1 — `MPPT_INCOERENTE` (universal)

`src/services/regrasPlausibilidade.js`:
```diff
- if (vocmax !== null && max >= vocmax) {           // bloqueava max == voc
-   mensagem: `MPPT max (${max}V) >= Voc max DC ...`
-   valor_esperado_max: vocmax - 10,
+ if (vocmax !== null && max > vocmax) {            // permite max == voc (legítimo)
+   mensagem: `MPPT max (${max}V) > Voc max DC ...`
+   valor_esperado_max: vocmax,
```
Continua inválido se `max > voc`. Permite `max == voc`.

## FASE 2 — Faixas por tecnologia (`VOC_MAX_DC_IMPLAUSIVEL`, `MPPT_FAIXA_IMPLAUSIVEL`)

Adicionado helper `tecnologiaInversor(specs)` (heurística micro/string/híbrido — **não persiste**
classificação, usado só dentro das duas regras de tensão).

**1. Limites por tecnologia:**

| Regra | microinversor | string / híbrido |
|---|---|---|
| `VOC_MAX_DC_IMPLAUSIVEL` (Voc máx DC) | **[16, 150] V** | [200, 1500] V |
| `MPPT_FAIXA_IMPLAUSIVEL` (MPPT mín) | **[10, 80] V** | [50, 400] V |
| `MPPT_FAIXA_IMPLAUSIVEL` (MPPT máx) | **[20, 150] V** | [200, 1000] V |

**2. Justificativa técnica:**
- **Microinversor** opera por módulo (1–4 painéis/entrada): tensão DC máx ~60 V e janela MPPT ~16–60 V.
  Confirmado nos datasheets oficiais da Wave 1 (Deye/Tsun/SAJ: Voc_max = 60 V, MPPT 16–60 V). As faixas
  antigas ([200,1500] / [50,400]) eram impossíveis de satisfazer por micro → falso-positivo sistemático.
- **String** agrega múltiplas strings em série: Voc_max típico 600–1500 V, MPPT 50–1000 V → faixas mantidas.
- **`MPPT_max == Voc_max_DC` é fisicamente válido** (a janela de operação MPPT pode estender até a tensão
  DC máxima nominal). Daí `≤` em vez de `<` (FASE 1). Híbrido herda faixas de string (conservador).

## FASE 3 — Origem do enriquecimento

Auditoria dos 5 equipamentos da Wave 1 + correção do pipeline (`apply-wave1` agora grava
`origem.tipo = 'datasheet_pdfparse'`).
1. **Quantos estavam sem origem (datasheet)?** → **5** (todos com `origem.tipo = import_solarmarket`, apesar de `fonte_dados = datasheet_oficial`).
2. **Quantos foram corrigidos?** → **5** → `origem.tipo = datasheet_pdfparse`.

> Isso **não** mexe na tabela de confiança (`BASE_POR_ORIGEM` intacta) — corrige a **origem real do dado**
> (que veio de datasheet). Os 126 sem specs continuam `import_solarmarket`/inválidos.

## FASE 4 — Reprocessamento oficial

`POST /api/admin/catalogo/reprocessar-todos?limite=2000` → `{ total_encontrados:358, processados:358, erros:0 }`.
(Servidor reiniciado para carregar as regras editadas.)

## FASE 5 — ANTES × DEPOIS

| Métrica | Antes | Depois | Δ |
|---|---|---|---|
| **Inválidos** | 154 | **150** | −4 |
| **Utilizáveis** | 27 | **32** | +5 |
| Suspeitos | 165 | 164 | −1 |
| Incompletos | 11 | 11 | 0 |
| Validados | 1 | 1 | 0 |
| **Score global** | 34.67 | **35.28** | +0.61 |

1. Inválidos antes? **154** · 2. Inválidos depois? **150**
3. Utilizáveis antes? **27** · 4. Utilizáveis depois? **32**
5. Score global antes? **34.67** · 6. Score global depois? **35.28**
7. **Projetos recuperados?** → **54** saíram de inválido (4 microinversores); **164 projetos** passam a ter
   **inversor utilizável** considerando os 5 enriquecidos (SUN2000G3 já estava suspeito e agora é utilizável).

> Bate **exatamente** com a simulação do Cenário C (score 35.28, utilizável +5). Sem inflar os 126 sem specs.

## FASE 6 — Validação dos 5 modelos

| Modelo | Antes | Depois | Alertas removidos | Score |
|---|---|---|---|---|
| Deye SUN2000G3-US-220 | suspeito (43) | **utilizável** | VOC_MAX_DC_IMPLAUSIVEL, MPPT_FAIXA_IMPLAUSIVEL | **83** |
| Tsun TSOL-MX2250 | inválido (38) | **utilizável** | MPPT_INCOERENTE, VOC_MAX_DC_IMPLAUSIVEL, MPPT_FAIXA_IMPLAUSIVEL | **83** |
| Tsun TSOL-MP2250 | inválido (38) | **utilizável** | MPPT_INCOERENTE, VOC_MAX_DC_IMPLAUSIVEL, MPPT_FAIXA_IMPLAUSIVEL | **83** |
| Growatt MIN 5000TL-X | inválido (38) | **utilizável** | MPPT_INCOERENTE | **83** |
| SAJ M2-2.25K-S4 | inválido (38) | **utilizável** | MPPT_INCOERENTE, VOC_MAX_DC_IMPLAUSIVEL, MPPT_FAIXA_IMPLAUSIVEL | **83** |

Todos: **0 alertas** após calibração, score **83**, nível **utilizável**.

## Critério de aceite

| Critério | Status |
|---|---|
| Apenas Cenário C | ✅ |
| Sem reescrever motor | ✅ (3 regras + 1 helper; 32 ins / 12 del) |
| Sem alterar arquitetura | ✅ |
| Sem inflar confiança import_solarmarket | ✅ `BASE_POR_ORIGEM` intacta; 126 sem specs seguem inválidos |
| Reprocessamento executado | ✅ endpoint oficial, 358/358 |
| Evidência antes/depois | ✅ `METRICS.json` + `DIFF.json` |
| Revisão Gemini | ⚠️ PENDENTE |
| Commit separado | ✅ |

## Entregáveis
- `QUALITY_MICRO_CALIBRATION_APPLY_REPORT.md` (este)
- `QUALITY_MICRO_CALIBRATION_METRICS.json` — antes/depois + projetos
- `QUALITY_MICRO_CALIBRATION_DIFF.json` — mudanças de código + transição dos 5
- Evidência: `backend/reports/micro-apply/` (BEFORE/AFTER) · regra: `src/services/regrasPlausibilidade.js`
