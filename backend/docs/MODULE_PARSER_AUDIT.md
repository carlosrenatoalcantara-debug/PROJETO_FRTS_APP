# P1-MODULE-PARSER-AUDIT-01 — Auditoria do parser de módulos (read-only)

> **100% read-only.** Sem alterar Atlas/parser/SSOT. Mede a capacidade **real** de extrair
> especificações de **módulos fotovoltaicos** (PV).

## FASE 1 — Inventário dos módulos do Atlas (161)

| Classe (campos de módulo presentes) | Qtde |
|---|---|
| **Completos** (≥8 dos 13 campos) | **0** |
| **Parciais** (3–7) | **54** |
| **Mínimos** (<3) | **107** |

**Cobertura por campo (de 161):** `voc` 54 · `isc` 54 · `vmp` 54 · `imp` 54 · `eficiencia` 53 ·
**`pmpp`/`potencia_nominal` 0 · `vmpp`/`impp` 0 · `num_celulas` 0 · `dimensoes` 0 · `peso` 0 ·
`coef_temp` 0**.

→ **Nenhum módulo é completo.** Os 54 "parciais" têm apenas **5 campos** (voc/isc/vmp/imp/efic) e
**nenhum tem potência (Pmpp), dimensões, peso ou nº de células**. Esses 5 campos foram populados
por via **manual/outra** — não pelo parser (ver FASE 4).

## FASE 2 — Módulos importados do SolarMarket (105)

| | |
|---|---|
| Quantidade | **105** (todos **mínimos** — shells de identidade, completude 0,33) |
| Fabricantes (21) | ZNShine 16, DAH 13, Leapton 10, Jinko 9, OSDA 9, Honor 8, Canadian 7, Renesola 6, JA Solar 4, Trina 4, Sunova 3, Hanersun 3, Astronergy 2, Resun 2, Risen 2, Maxeon 2, Tongwei 1, Longi 1, Minasol 1, Topsola 1, DMEGC 1 |
| Modelos | limpos (ex.: `JKM530M-72HL4-TV`, `DHN72X16/FS-585W`) |

## FASE 3 — Auditoria do parser atual

**Não existe parser de módulo dedicado.** A extração de módulo dependeria do
`parserTecnicoInversor.js` (orientado a inversor) + `parserMatricial.js`.

| Campo de módulo | Regex | Extrator | Normalização | Validação |
|---|---|---|---|---|
| **Pmpp / Pmax (Wp)** | ❌ | ❌ | ❌ | ❌ |
| **Voc (módulo)** | ❌ (regex é "Max DC voltage" do inversor) | ❌ | — | — |
| **Isc (módulo)** | ❌ (regex é "Short Circuit Current **per MPPT**") | ❌ | — | — |
| **Vmp / Vmpp** | ❌ | ❌ | ❌ | ❌ |
| **Imp / Impp** | parcial (`imp` colide com inversor) | ❌ | ❌ | ❌ |
| **Eficiência** | ✅ (compartilhado) | ✅ | parcial | parcial |
| **Nº de células** | ❌ | ❌ | ❌ | ❌ |
| **Dimensões** | ✅ (compartilhado) | ✅ | ⚠ **falso-positivo** | ❌ |
| **Peso** | ✅ (compartilhado) | ✅ | parcial | ❌ |
| **Coef. temperatura** | ❌ | ❌ | ❌ | ❌ |
| **Bifacialidade / tecnologia** | ❌ | ❌ | ❌ | ❌ |

→ Os rótulos do parser são de **inversor** (Vmáx CC, Isc por MPPT, tensão de partida…). Os
rótulos de **módulo** (STC: *Maximum Power Pmax*, *Open-Circuit Voltage Voc*, *Short-Circuit
Current Isc*, *Voltage at Pmax Vmp*, *Current at Pmax Imp*, *Module Efficiency*, *Number of
Cells*) **não têm regex**.

## FASE 4 — Teste empírico (datasheets reais de módulo, somente leitura)

Datasheets em `datasheets/Modulo/` (DAH, Astronergy, Risen, Resun) processados pelo parser:

| Datasheet | Campos extraídos |
|---|---|
| **DAH 440W** | `dimensoes:"90x80x975"` (**garbled** — DAH 440W é ~1903×1134×30 mm) · `IP68` · `INMETRO` |
| **DAH 585W** | **{}** — **nada** |
| **Risen 700W** | `dimensoes:"80x90x100"` (**garbled**) · `IP68` |

→ **0 campos elétricos extraídos** (Pmpp/Voc/Isc/Vmp/Imp/eficiência = nenhum). As únicas saídas
são **dimensões erradas** (falso-positivo) + IP/certificação ocasionais.

## FASE 5 — Respostas

1. **Quais campos são extraídos?** Praticamente **nenhum campo de módulo**. Apenas (de forma
   instável) `grau_protecao_ip`, `certificacoes` e `dimensoes` — esta última **errada**.
2. **Quais falham?** **TODOS os essenciais:** `pmpp`/Pmax, `voc`, `isc`, `vmp`, `imp`,
   `eficiencia` (no datasheet de módulo), `num_celulas`, `peso`, `dimensoes` (correta),
   `coef_temp`, tecnologia/bifacialidade.
3. **Taxa de completude?** **~0%** — 0/161 módulos completos; o parser extrai **~0 campos úteis**
   de datasheets de módulo (testes: DAH 440W ~0, DAH 585W 0, Risen 0).
4. **Taxa de falso positivo?** **Alta no campo `dimensoes`** (valores garbled tipo `90x80x975`)
   — o parser **inventaria dimensões incorretas** se usado para módulos.
5. **O parser de módulo está pronto para produção?** **NÃO.** Ele **não existe** como parser de
   módulo; o parser de inversor é **não-funcional** para módulos (0 campos elétricos + falso-positivo).
6. **Quais ajustes faltam?** **Tudo:** criar regex/extratores de módulo (Pmpp/Voc/Isc/Vmp/Imp/
   eficiência/células/peso/dimensões/coef-temp) com rótulos STC; **fixtures golden** de módulo;
   **validação de faixas** (Pmpp 100–800 W, Voc 30–60 V, Isc 8–20 A, eficiência 15–24%, dimensões
   ~1700–2400 × 1000–1300 × 30–40 mm, peso 18–35 kg); corrigir o **falso-positivo de dimensões**.

## FASE 6 — Roadmap de enriquecimento automático de módulos

| Prioridade | Item |
|---|---|
| **P0** | **Criar o parser de módulo** — `ROTULOS_BASE`/extratores para os 9 campos essenciais (Pmpp, Voc, Isc, Vmp, Imp, eficiência, nº células, dimensões, peso) com rótulos STC; **corrigir o falso-positivo de dimensões** (faixa de módulo); **3–5 fixtures golden** (DAH, Astronergy, Risen, Jinko, Canadian). Sem isso, enriquecimento de módulo = **0** e há **risco de gravar lixo**. |
| **P1** | **Cobertura de formatos** — mono/bifacial, half-cell, TOPCon/PERC/HJT; normalização de unidades (W/V/A/%/mm/kg); validação de faixas; layout **matricial** (datasheets multi-modelo de módulo, ex.: série 580/585/590 W). |
| **P2** | **Campos avançados** — coef. de temperatura (Pmax/Voc/Isc), tolerância, garantias (produto/performance), NOCT; **Gemini Vision** como fallback para datasheets-imagem; integração ao enriquecimento dos 105 shells + 54 parciais. |

### Conclusão
**O sistema NÃO tem um parser de módulo funcional.** Empiricamente, o parser de inversor extrai
**~0 campos elétricos** de datasheets de módulo e **produz dimensões erradas** (falso-positivo).
Dos 161 módulos do Atlas, **0 são completos**; os 54 "parciais" têm 5 campos (de via manual) e os
105 do SolarMarket são shells. **Conclusão: módulos NÃO podem ser enriquecidos automaticamente
hoje** — é necessário **construir o parser de módulo (P0)** antes de qualquer enriquecimento em
lote. Nada foi alterado (read-only).


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório. Nota: o veredito **REPROVADO** refere-se ao **parser de módulo auditado** (não-funcional), confirmando a conclusão da auditoria; a metodologia e os achados da auditoria foram validados como sólidos/corretos/honestos.

## Revisão da Sprint P1-MODULE-PARSER-AUDIT-01

A auditoria realizada na sprint P1-MODULE-PARSER-AUDIT-01 expõe uma fragilidade crítica na capacidade de extração de especificações de módulos fotovoltaicos. A análise é detalhada e a metodologia empírica, embora limitada pela natureza "read-only", é sólida para diagnosticar o estado atual.

1.  **Teste Empírico e Conclusão:** O teste empírico, ao aplicar o parser existente em datasheets reais, é uma metodologia robusta para avaliar a funcionalidade. A conclusão de que a taxa de completude é de aproximadamente 0% é **justificada** pelos achados, que demonstram a ausência de extração de campos essenciais e a presença de dados incorretos.

2.  **Distinção Manual vs. Parser:** A distinção entre campos populados manualmente e aqueles que o parser deveria extrair é **crucial e correta**. Ela evidencia que a aparente presença de alguns campos no Atlas não se deve à capacidade do parser, mas sim a intervenções externas, reforçando a inexistência de um parser de módulo funcional.

3.  **Falso-Positivo em Dimensões:** O achado de falso-positivo em dimensões é **grave e bem identificado**. A extração de dados "garbled" e incorretos é pior do que não extrair nada, pois introduz ruído e desinformação no sistema, comprometendo a integridade dos dados.

4.  **Roadmap P0/P1/P2:** O roadmap proposto é **adequado e bem priorizado**. O P0 foca na criação do parser de módulo essencial, corrigindo os problemas mais urgentes (falso-positivo, fixtures). Os P1 e P2 abordam de forma incremental complexidades adicionais, como formatos variados e campos avançados.

5.  **Conclusão sobre Enriquecimento Automático:** A conclusão de que módulos **NÃO podem ser enriquecidos automaticamente hoje é honesta e precisa**. A ausência de um parser funcional impede qualquer automação confiável, e o relatório comunica essa limitação de forma clara.

6.  **Algo Deixado Passar?** A auditoria parece ter sido abrangente dentro das restrições. A ênfase na natureza "read-only" é importante, pois limita a profundidade de análise de causa raiz de por que os parsers atuais falham em módulos.

7.  **Veredito:** **REPROVADO**. O sistema não possui um parser de módulo funcional, com uma taxa de completude próxima de zero e um alto índice de falsos positivos em campos críticos como dimensões. A construção de um parser de módulo dedicado (P0) é um pré-requisito absoluto para qualquer avanço em enriquecimento automático.
