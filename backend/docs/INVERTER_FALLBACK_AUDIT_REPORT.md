# P1-INVERTER-FALLBACK-CONSERVADOR-AUDIT-01 — Viabilidade de fallback p/ inversores (read-only)

> **100% READ-ONLY.** Avalia se a estratégia de fallback conservador dos módulos é aplicável aos
> inversores. Sem escrita, sem alterar Atlas/parser.

## FASE 1 — Inventário dos incompletos (172 inversores; 32 completos, **140 incompletos**)

| O que o incompleto possui | Qtde (de 140) |
|---|---|
| **Potência** em `especificacoes` | 10 |
| **Potência inferível do modelo** (ex.: `SUN-5K-G`, `MID25KTL3`, `SPI 30K-B`) | **84** |
| **Sem potência** identificável | **46** |
| `tensao_max_entrada` conhecida | **6** |
| `n_mppts` conhecido | **3** |
| Fabricante / Modelo | 140 / 140 |

→ **A potência é recuperável (94 = 10 spec + 84 modelo). Mas os campos de _gating_ do
dimensionamento — `tensao_max_entrada` (só 6) e `n_mppts` (só 3) — estão quase todos ausentes.**

## FASE 2 — Classificação A/B/C

| Classe | Critério | Qtde |
|---|---|---|
| **A — recuperável automaticamente** | dá p/ recuperar o **mínimo** (potência + tensão + nº MPPT) com segurança | **0** |
| **B — recuperável parcialmente** | só **potência** (do modelo); tensão/MPPT são parâmetros de **projeto** | **94** |
| **C — bloqueado** | nem potência inferível do modelo | **46** |

## FASE 3 — Impacto

1. **Quantos se tornariam utilizáveis?** **~0.** Recuperar só a potência **não** torna o inversor
   dimensionável — o mínimo exige `tensao_max_entrada` + `n_mppts` (gating de string), ausentes.
2. **Ganho de completude?** **Marginal** (1 campo — potência — em ~84 registros). Não atinge o
   mínimo para dimensionar; inversores REAL permanecem ~32.
3. **Risco de falso-positivo?** **ALTO** se inferir tensão/MPPT; **baixo mas insuficiente** se só potência.
4. **Campos que podem receber fallback (seguro):** `potencia_kw` (do modelo — confiável); no máximo
   `fases` por classe (mono/tri).
5. **Campos que NÃO podem:** `tensao_max_entrada`, `n_mppts`, `tensao_mppt_min/max`,
   `corrente_max_por_mppt`, `eficiencia`, `strings_por_mppt` — **parâmetros de projeto**, sem lei
   física, com variação de **2–3×** entre inversores de mesma potência.

## FASE 4 — Comparação com módulos — **a mesma estratégia é viável? → NÃO**

| Aspecto | Módulo | Inversor |
|---|---|---|
| Origem dos valores | **Lei física** (N células em série × Voc_célula) | **Parâmetros de projeto** do fabricante |
| Determinismo a partir da potência | Alto (Voc/Isc/Vmp/Imp ~±5%) | **Baixo** (tensão 600/1000/1100/1500 V; 1–12 MPPT) |
| "Lado seguro" conservador | Claro (Voc alto, Vmp baixo) | **Ambíguo/perigoso** — superestimar `tensao_max` → **sobretensão de string** (inseguro); subestimar → inversor inútil |
| Resultado do fallback | Torna o módulo **dimensionável** (50→156) | Recupera **só potência** — **não** dimensionável |

**Justificativa técnica:** o módulo é uma estrutura física previsível — dada a potência e o nº de
células, Voc/Isc/Vmp/Imp seguem dentro de ~5%, e o conservador tem direção segura inequívoca. O
inversor é um produto de **engenharia de projeto**: `tensao_max_entrada` (faixa 600–1500 V),
`n_mppts`, faixa de MPPT e corrente são **escolhas do fabricante** que variam **2–3×** para a mesma
potência. **Não existe valor conservador seguro** para esses campos — um chute de tensão para baixo
inutiliza o inversor; para cima, gera **dimensionamento inseguro** (string acima da Vmáx real).

## FASE 5 — Respostas obrigatórias

1. **Inversores candidatos:** **94** (potência recuperável) — mas **só para o campo potência**.
2. **Permanecem bloqueados:** **46** sem potência; e os 94 **seguem sem tensão/MPPT** → **140 não se
   tornam dimensionáveis** por fallback.
3. **Ganho estimado:** **~0 em utilizabilidade** (potência sozinha não dimensiona); +1 campo em ~84.
4. **Riscos:** inferir tensão/MPPT = **risco ALTO** (sobretensão/dimensionamento inseguro).
5. **Vale executar fallback?** **NÃO.** O ganho real (inversor dimensionável) é **~0** e o risco de
   inferir os campos de gating é alto. **O caminho correto é DATASHEET/parser**, não fallback.
6. **Próxima sprint recomendada:** **`P1-INVERTER-DATASHEET-ENRICH-01`** — o **parser de inversor já
   é maduro** (13 fixtures golden: Deye, Kehua, Goodwe, Chint, SAJ, SolaX, Solis, Solplanet,
   Sungrow, TSUN, Hopewind, Huawei, Hoymiles) e há **datasheets no repo**; os 94 com modelo limpo são
   **datasheet-localizáveis** (mesma trilha Tier-A dos módulos). Em paralelo, fetch de datasheets
   por modelo (como nos módulos).

### Conclusão
**A estratégia de fallback dos módulos NÃO é viável para inversores.** A razão é técnica e
fundamental: módulos seguem **lei física** (conservador determinístico e seguro); inversores são
**parâmetros de projeto** sem valor conservador seguro para os campos de gating
(`tensao_max_entrada`/`n_mppts`). O fallback recuperaria só a **potência** (94), sem tornar nenhum
inversor dimensionável. **Recomendação: NÃO executar fallback de inversores; enriquecer via
datasheet/parser** (maduro), começando pelos 94 com modelo limpo. Nada foi alterado (read-only).


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida). Veredito: excelente (APROVADO).

## Análise da Auditoria P1-INVERTER-FALLBACK-CONSERVADOR-AUDIT-01

A auditoria aborda a viabilidade de aplicar uma estratégia de fallback conservador, bem-sucedida para módulos fotovoltaicos, a inversores. A análise é detalhada e a conclusão parece robusta.

**1. Argumento Físico (Módulo vs. Inversor):** O argumento central é tecnicamente **correto**. Módulos, como dispositivos físicos, obedecem a leis fundamentais que permitem inferir parâmetros com um grau de previsibilidade e um "lado seguro" determinístico. Inversores, por outro lado, são produtos de engenharia com parâmetros de projeto que variam significativamente entre fabricantes e modelos, mesmo para potências similares. Não há uma lei física intrínseca que dite um valor conservador seguro para `tensao_max_entrada` ou `n_mppts`.

**2. Inferência de `tensao_max_entrada`/`n_mppts`:** A constatação de que `tensao_max_entrada` e `n_mppts` não são inferíveis com segurança, dada a variação de 2-3x, é **correta**. A baixa quantidade de dados conhecidos (6 para tensão, 3 para MPPTs) reforça essa dificuldade.

**3. Risco de Superestimar `tensao_max_entrada`:** O risco de superestimar `tensao_max_entrada` e causar sobretensão de string é **real e bem caracterizado**. Este é um ponto crítico que invalida a abordagem de fallback para esses parâmetros.

**4. Coerência da Classificação A/B/C:** A classificação é **coerente** com os dados apresentados. A ausência de qualquer inversor na classe A (recuperável automaticamente com o mínimo completo) demonstra a inviabilidade do fallback para tornar os inversores dimensionáveis. A classe B (94 inversores com potência recuperável) reflete a limitação de recuperar apenas um parâmetro, sem os de "gating".

**5. Conclusão: Fallback NÃO vs. Datasheet/Parser:** A conclusão de **NÃO executar o fallback para inversores e focar em datasheet/parser é a recomendação certa**. A análise demonstra que o fallback não traria o benefício desejado (inversores dimensionáveis) e introduziria riscos significativos. O parser de inversor, sendo maduro e com fixtures golden, representa o caminho mais seguro e eficaz.

**6. Algo Deixado Passar:** A auditoria parece ter coberto os pontos essenciais de forma abrangente. A distinção entre a natureza física dos módulos e a natureza de projeto dos inversores é o cerne da questão e foi bem explorada.

**7. Veredito:** A auditoria é **excelente**. A análise técnica é sólida, a argumentação é clara e a recomendação é justificada e prática. A estratégia de fallback conservador para módulos não é aplicável a inversores devido à natureza fundamentalmente diferente de seus parâmetros. O foco em enriquecimento de dados via datasheet e parser é o caminho correto.
