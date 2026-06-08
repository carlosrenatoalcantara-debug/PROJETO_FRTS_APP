# P1-PARSER-MULTIMODEL-AUDIT-01 — Auditoria multi-modelo (read-only)

> **100% read-only.** Sem alterar Atlas, catálogo, SSOT ou parser. Roda o pipeline ATUAL
> sobre as fixtures e procura os padrões corrigidos no SolaX. Dados em `MULTIMODEL_AUDIT.json`.

## FASE 1 — Inventário multi-modelo

**Multi-modelo (matricial, ≥2 colunas) — 11 fixtures:** `deye_2330` (3), `goodwe_dt` (3),
`goodwe_ms` (3), `hoymiles_hms` (3), `kehua_spi_commercial` (5), `kehua_spi_utility` (2),
`saj_r5_s2` (7), `solax_x1_spt` (2), `solax_x3_ultra` (7), `solplanet_7300` (2), `sungrow_rt` (6).

**Single-model (coluna-única):** `chint_sca`, `huawei_m2`, `huawei_m3`, `sungrow_sg110cx`,
`tsun_mx3000d`, `solis_30k_ocr`, `deye_lv`, `kehua_spi_{ocr,residential}`.

**Growatt: SEM fixture/PDF no repositório → não auditável** (lacuna a cobrir quando houver datasheet).

## FASE 2 — Comparação PDF vs Parser (por fabricante)

| Fabricante (fixture) | Modelos | Potência (por modelo) | Cobertura | Veredito |
|---|---|---|---|---|
| **GoodWe** DT | 3 | 17/20/25 ✓ | 100% | ✅ correto |
| **GoodWe** MS | 3 | 7/8.5/10 ✓ | 87.5% | ✅ (isc ausente no datasheet) |
| **Sungrow** RT | 6 | 5/6/7/8/10/12 ✓ | 100% | ✅ correto |
| **Kehua** comercial | 5 | 15/17/20/23/25 ✓; potmax 16.5→27.5 ✓ | 87.5% | ✅ (isc ausente no datasheet) |
| **Kehua** utility | 2 | 50/60 ✓ | 87.5% | ✅ |
| **SAJ** R5 | 7 | 3/3.68/4/5/6/7/8 ✓ | 75% | ✅ (potmax/isc ausentes no datasheet) |
| **SolaX** X1-SPT | 2 | 10/12 ✓ | 100% | ✅ correto |
| **SolaX** X3-ULTRA | 7 | 15/15/19.9/20/20/25/30 ✓; MPPT 120–950 ✓ | 100% | ⚠ potmax wrapped (conhecido) |
| **Deye** 2330 | 3 | 23/25/30 ✓ | 75% | ⚠ n_mppts + Vmáx ausentes |
| **Hoymiles** HMS | 3 | (em potmax 1.6/1.8/2 ✓) | 75% | ⚠ potencia_kw não mapeada |
| **Solplanet** 7300 | 2 | 7.3/9.1 ✓; isc 22.5/28 ✓ | 50% | ⚠ MPPT + n_mppts + Imppt ausentes |
| **Huawei** (M2 single) | 1 | 100 ✓ | — | ✅ |
| **Huawei** (M3 single) | 1 | 30 ✓ | — | ❌ **isc=4** (fonte: 40 A) |
| **Chint** (SCA single) | 1 de **2** | 50 ✓ | — | ❌ **60K não extraído** |

## FASE 3 — Detecção (A–E)

### A) Deslocamento de coluna
**Nenhum** além do SolaX (já corrigido). Em GoodWe/Sungrow/Kehua/Deye/SAJ a potência e os
campos progridem corretamente com o modelo. O **recuo de right-alignment** (sprint anterior)
não introduziu nenhum desvio nos demais.

### B) Falso-match de rótulos
**Nenhum** além do SolaX EPS (já corrigido). O **skip de backup/bateria** (EPS/UPS/charge/
battery) agora protege qualquer híbrido. Nenhuma outra linha de backup contamina specs.

### C) Mistura de linhas
**Nenhuma com valor errado.** Valores compartilhados (faixa MPPT, Vmáx, Isc por MPPT) são
corretamente replicados onde o datasheet os compartilha (ex.: Sungrow Imppt 25/25/25/37.5…).

### D) Modelos fantasmas
**Nenhum modelo fantasma** (toda coluna detectada é um código real). **Porém — o inverso:**
- **Chint SCA50/60KTL** — o datasheet contém **2 modelos** (`SCA50KTL-T` e `SCA60KTL-T`,
  confirmado no texto), mas a detecção de colunas falha → cai no coluna-única e **só extrai o
  50K**; o **60K é perdido**. Mesma classe do SolaX/SAJ (modelos não separados). **ALTA.**

### E) Valores
1. **Huawei M3 `isc=4`** — a fonte diz *"Short Circuit Current per MPPT **40** A"*; o parser
   captura **4** (Isc<Imppt=27 é fisicamente impossível). Erro de extração de valor. **ALTA.**
2. **SolaX X3-ULTRA `potencia_maxima`** — linha *"Max output apparent power"* **wrapped** no PDF
   (2 de 7 valores na linha) → 27.5 replicado. **Conhecido** (sprint anterior). MÉDIA.
3. **Lacunas de cobertura** (campo ausente — *label não casado*, não deslocamento):
   - **Solplanet** — faixa MPPT, `n_mppts`, `corrente_max_por_mppt` ausentes (rótulos próprios). MÉDIA.
   - **Deye** — `n_mppts` e `tensao_max_entrada` ausentes. BAIXA.
   - **Hoymiles** (micro) — `potencia_kw` não mapeada (valor está em `potencia_maxima`). BAIXA.
   - `corrente_isc_max` ausente em GoodWe-MS / Kehua / SAJ — **o datasheet não publica Isc por
     MPPT** (legítimo, não é bug). —

## Conclusão e priorização

**A notícia principal é positiva:** os bugs **sistêmicos** do SolaX (deslocamento de coluna por
right-alignment e falso-match de backup) **não se repetem** em nenhum outro fabricante — as
correções da sprint anterior já cobrem a classe inteira sem regressão.

**Achados acionáveis (para sprints de correção futuras, fora deste escopo read-only):**

| Sev. | Achado | Categoria | Fabricante |
|---|---|---|---|
| 🔴 ALTA | 60K não extraído (2 modelos → 1) | A/D | **Chint** SCA50/60KTL |
| 🔴 ALTA | `isc=4` (fonte 40 A) | E | **Huawei** M3 |
| 🟠 MÉDIA | `potencia_maxima` linha wrapped | C/E | **SolaX** X3-ULTRA |
| 🟠 MÉDIA | MPPT/n_mppts/Imppt sem label | E | **Solplanet** |
| 🟡 BAIXA | n_mppts/Vmáx ausentes | E | **Deye** |
| 🟡 BAIXA | potencia_kw não mapeada (micro) | E | **Hoymiles** |
| ⬜ LACUNA | sem fixture/PDF | — | **Growatt** |

**Próxima sprint recomendada:** `P1-PARSER-CHINT-HUAWEI-FIX-01` — separar os 2 modelos Chint
(detecção de colunas) e corrigir o `isc=4` da Huawei M3; em paralelo, obter um datasheet
**Growatt** multi-modelo para fechar a cobertura dos prioritários.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P1-PARSER-MULTIMODEL-AUDIT-01

A auditoria multi-modelo (read-only) foi executada com sucesso, focando na detecção de bugs corrigidos no SolaX em um conjunto de fabricantes multi-modelo. A metodologia empregada e os resultados apresentados são claros e bem estruturados.

**1. Adequação da Metodologia:**

A metodologia, incluindo as heurísticas de potência vs. nome do modelo, plausibilidade de valores e verificação de campos ausentes, é **altamente adequada** para detectar a classe de bugs observada no SolaX. A abordagem de rodar o parser em fixtures existentes e comparar com os PDFs é robusta. A inclusão de heurísticas específicas como "potência vs. nome do modelo" e "valores implausíveis" é particularmente eficaz para identificar inconsistências que podem passar despercebidas em uma análise puramente visual. A distinção entre modelos multi-modelo e single-model também é um ponto forte.

**2. Correção na Distinção entre Bug Real e Lacuna Legítima:**

A distinção entre bugs reais (Chint, Huawei) e lacunas legítimas (ausência de `isc` em datasheets que não o publicam) é **correta e bem fundamentada**. A análise de que a ausência de um campo em um datasheet específico é uma limitação da fonte, e não um erro do parser, é crucial para a priorização e para evitar esforços de correção desnecessários. A identificação de que o datasheet do Chint *contém* dois modelos, mas a detecção de colunas falha, é um exemplo claro de um bug real do parser.

**3. Sensatez da Priorização (ALTA/MÉDIA/BAIXA):**

A priorização é **sensata e bem justificada**.

*   **ALTA:** Os bugs do Chint (perda de modelo) e Huawei (valor incorreto de `isc`) têm impacto direto na precisão dos dados extraídos e na completude da informação, justificando a prioridade máxima.
*   **MÉDIA:** O `potencia_maxima` wrapped no SolaX é um problema conhecido, mas que não impede a extração de outros dados importantes. A ausência de labels no Solplanet afeta a completude, mas não a extração de valores principais.
*   **BAIXA:** Os campos ausentes em Deye e Hoymiles, ou o mapeamento de `potencia_kw` em microinversores, são menos críticos para a funcionalidade principal do parser, justificando a prioridade menor.

**4. Possíveis Falsos Negativos:**

Considerando a natureza "read-only" e o foco em bugs corrigidos no SolaX, a probabilidade de falsos negativos significativos é **baixa**. No entanto, alguns pontos podem ser considerados:

*   **Novos Padrões de Bugs:** A auditoria focou em padrões *já corrigidos* no SolaX. Se houverem novos tipos de bugs em outros fabricantes que não se assemelham aos do SolaX, eles poderiam ter passado despercebidos.
*   **Complexidade de Datasheets:** Datasheets com layouts extremamente incomuns ou com informações críticas em tabelas aninhadas de forma complexa poderiam, em teoria, apresentar desafios.
*   **Heurísticas de Limite:** Embora as heurísticas de plausibilidade sejam boas, valores que estão *ligeiramente* fora da faixa esperada, mas ainda fisicamente possíveis, poderiam não ser sinalizados.

**5. Veredito:**

**APROVADO COM RESSALVAS.**

A auditoria é um sucesso em seu objetivo principal: validar que os bugs sistêmicos do SolaX não se repetem e identificar novos problemas. A metodologia é sólida e a análise dos achados é precisa. As ressalvas se referem à necessidade de ações corretivas futuras para os achados de prioridade ALTA e MÉDIA, e à lacuna de cobertura para o fabricante Growatt. A recomendação para a próxima sprint é pertinente.
