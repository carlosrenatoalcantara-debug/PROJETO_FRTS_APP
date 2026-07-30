# P0-QUALITY-RULE-MICRO-CALIBRATION-01 — Auditoria e simulação de calibração (micro × string × híbrido)

> **READ ONLY / SEM ALTERAR NADA.** Nenhuma regra, arquivo ou documento do Atlas foi modificado.
> Simulação em memória com **réplica do motor validada em 100% (172/172) contra o estado real do DB**.
> - **Data:** 2026-06-14 · **Executor:** Sonnet · **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE
> - Dados: `QUALITY_RULE_IMPACT_SIMULATION.json`

## VEREDITO

O motor **não diferencia tecnologia** (`REGRAS_INVERSOR` é tamanho-único). Três regras penalizam
**microinversores** com falso-positivo. A correção mínima é **cirúrgica** (3 ajustes pontuais +
marcar origem-datasheet no enriquecimento) e leva os 5 inversores já enriquecidos de inválido →
**utilizável** (recuperando 54 projetos), **sem** inflar os 126 inversores que ainda não têm specs.

---

## FASE 1 — Regras críticas de inversor (`src/services/regrasPlausibilidade.js`)

| Regra | Severidade | Condição | Afetados (inversores hoje) |
|---|---|---|---|
| **MPPT_INCOERENTE** | **crítico** | exige `min < max` **e `max < voc_max_dc`** (estrito) | **4** |
| **VOC_MAX_DC_IMPLAUSIVEL** | alto | `voc_max_dc ∈ [200,1500]V` | **4** |
| **MPPT_FAIXA_IMPLAUSIVEL** | médio | `mppt_min ∈ [50,400]`, `mppt_max ∈ [200,1000]` | **11** |
| ISC_MPPT_IMPLAUSIVEL | médio | `isc_max_por_mppt ∈ [10,40]A` | 16 |
| NUM_MPPTS_IMPLAUSIVEL | médio | `n_mppts ∈ [1,12]` inteiro | 0 |
| POTENCIA_FORA_FAIXA | baixo | `potencia_kw ∈ [1,100]` | 3 |
| DC_AC_INVERSO | médio | `DC ≥ AC` | 0 |
| OVERSIZE_EXCESSIVO | baixo | `DC/AC ≤ 1.5` | 0 |
| FASES_INVALIDAS | alto | fases ∈ {1,3} | 0 |
| TENSAO_SAIDA_NAO_PADRAO | médio | tensão ∈ {127,220,380,440} | 7 |
| EFICIENCIA_IMPLAUSIVEL | médio | `eficiência ∈ [90,99]%` | 0 |
| FABRICANTE/MODELO_DESCONHECIDO | alto | identificação válida | 0 |
| SEM_ESPECIFICACOES (estrutural) | médio | tem `especificacoes` | 125 |

> O `MPPT_INCOERENTE` **crítico** é o bloqueador: 1 alerta crítico força `invalido` independentemente do score.

---

## FASE 2 — Classificação por tecnologia

Distribuição detectada nos 172 inversores: **string 157 · microinversor 14 · híbrido 1**.

| Tipo de regra | Regras |
|---|---|
| **Universais** (independem de tecnologia) | NUM_MPPTS, FASES, POTENCIA_FORA_FAIXA, DC_AC_INVERSO, OVERSIZE, EFICIENCIA, TENSAO_SAIDA, FABRICANTE/MODELO, SEM_ESPECIFICACOES, ISC_MPPT |
| **Universal — com BUG de igualdade** | **MPPT_INCOERENTE** (a coerência `min<max` é universal, mas o `max < voc` estrito deveria ser `max ≤ voc`: datasheets legítimos têm `mppt_max == voc_max_dc`) |
| **Específicas por tecnologia** (faixas de tensão diferem) | **VOC_MAX_DC_IMPLAUSIVEL** e **MPPT_FAIXA_IMPLAUSIVEL** — micro opera em 16–60V; string em 80–1000V. As faixas atuais ([200,1500] / [50,400]) só valem para string. |

Evidências legítimas de micro confirmadas em datasheet oficial (Wave 1): `MPPT_max == Voc_max == 60V`,
`Voc_max = 60V`, `MPPT 16–60V`. Todas marcadas como implausíveis pelo motor atual.

---

## FASE 3 — Simulação da recalibração de regras (Cenário A — só regras)

Mudanças simuladas: (a) `MPPT_INCOERENTE` aceita `max ≤ voc`; (b) `VOC_MAX_DC` micro=[16,150]/string=[200,1500];
(c) `MPPT_FAIXA` micro=min[10,80] max[20,150]/string=min[50,400] max[200,1000].

1. **Inválidos → suspeitos?** → **0** (vão direto para **incompleto**; 4 inválidos saem de inválido → incompleto).
2. **Suspeitos → utilizáveis?** → **0** (a confiança ainda trava — ver FASE 4).
3. **Novo score global?** → **34.82** (de 34.67; +0.15).
4. **Projetos recuperados?** → **54** (os 4 microinversores enriquecidos saem de inválido).

> Só a recalibração de regras **tira de inválido**, mas para apenas "incompleto", porque a **confiança**
> continua em 20 (FASE 4). Para chegar a **utilizável**, ver Cenário C.

---

## FASE 4 — Auditoria de confiança (`BASE_POR_ORIGEM` em `catalogoQualidade.js`)

1. **`import_solarmarket` existe?** → **NÃO.** A tabela tem manual/datasheet_gemini/datasheet_pdfparse/import_planilha/import_legado/desconhecido.
2. **Confiança atual?** → cai no fallback **`desconhecido` = 20**.
3. **Impacto?** → `score = completude*0.4 + confiança*0.6`. Com confiança 20, mesmo completude 95 ⇒ score ≤ 50 → no máximo "incompleto", **nunca "utilizável"** (≥75). É o segundo bloqueador.

**Duas formas de corrigir a confiança — com efeitos MUITO diferentes:**

| Cenário | Mudança | inválido→ | Score global | Projetos | Risco |
|---|---|---|---|---|---|
| **B** | regras + `import_solarmarket=60` global | **126 → suspeito** + 4 → incompleto | 42.56 | 354 | ⚠️ **infla 126 inversores SEM specs** para "suspeito" (não têm dado técnico) |
| **C** | regras + origem **datasheet** só nos itens **enriquecidos** | **4 → utilizável** + 1 suspeito→utilizável | 35.28 | 54 | ✅ cirúrgico; os 126 sem specs **continuam inválidos** (correto) |

No Cenário C, `utilizavel` vai de **18 → 23** (exatamente os 5 inversores enriquecidos por datasheet
oficial tornam-se utilizáveis). Os 126 SEM_ESPECIFICACOES permanecem inválidos — pois realmente
faltam specs (não é falso-positivo).

---

## FASE 5 — Correção mínima proposta (NÃO reescrever motor)

**Três mudanças pontuais — nada de motor novo:**

1. **`regrasPlausibilidade.js` — MPPT_INCOERENTE (universal):** trocar `max >= vocmax` por `max > vocmax`
   (permitir igualdade legítima `mppt_max == voc_max_dc`). 1 linha.
2. **`regrasPlausibilidade.js` — VOC_MAX_DC + MPPT_FAIXA (tech-aware):** faixa por tecnologia, com um
   detector simples de tecnologia (micro se `voc_max_dc ≤ 100` ou nome micro; senão string/híbrido).
   Micro: VOC [16,150], MPPT min[10,80]/max[20,150]. String: faixas atuais.
3. **Enriquecimento marca origem-datasheet:** ao aplicar specs de datasheet, setar
   `origem.tipo = 'datasheet_gemini'|'datasheet_pdfparse'`. **O pipeline oficial já faz isso**
   (`montarAtualizacaoIncremental`); o APPLY manual da Wave 1 não setou — basta re-marcar os 5
   enriquecidos (ou re-rodar pelo pipeline). **Não é mudança de regra; é dado/origem.**

> **NÃO** alterar `import_solarmarket` na tabela de confiança (Cenário B) — inflaria 126 inversores
> sem specs. A confiança correta vem da **origem real do dado** (datasheet), não do canal de import.

**Resultado esperado da correção mínima (A+3 = Cenário C):** 5 inversores enriquecidos → utilizável,
54 projetos recuperados, score 34.67 → 35.28, **zero** inflação dos itens sem specs.

---

## Critério de aceite

| Critério | Status |
|---|---|
| Evidência quantitativa | ✅ réplica 100% fiel ao DB; contagens por regra/tech |
| Simulação antes/depois | ✅ 3 cenários (A/B/C) em `QUALITY_RULE_IMPACT_SIMULATION.json` |
| Sem alteração ainda | ✅ nada modificado |
| Revisão Gemini | ⚠️ PENDENTE |

## Entregáveis
- `QUALITY_MICRO_CALIBRATION_REPORT.md` (este)
- `QUALITY_RULE_IMPACT_SIMULATION.json` — cenários A/B/C, transições, score, ROI, validação de réplica
- Script read-only: `backend/reports/micro-calibration/simulate.mjs`

## Aguardando aprovação
Conforme a sprint: **aguardar aprovação antes do APPLY**. Recomendo aprovar o **Cenário C** (correção
mínima cirúrgica). O APPLY (editar as 3 regras + re-marcar origem dos 5 enriquecidos) seria uma sprint
própria, com commit separado.
