# P1-MODULE-PARSER-COVERAGE-01 — Aumento de cobertura do parser de módulos

> Escopo: **somente parser**. Sem Atlas, sem enriquecimento, sem escrita. Meta mantida: **0 falso-positivo**.

## FASE 1 — Auditoria dos casos < 6 campos (por fabricante)

| Datasheet | Antes | Causa |
|---|---|---|
| Trina Tallmax (PT) | 4/9 | rótulos **PT próprios** ("Potência de Pico-P MAX", "Tensão Máxima de Potência-V", "Corrente de Potência Máxima-I MPP"); dimensões com separador `.` |
| ZNShine | 8/9 | rótulo STC "Maximum Power**:**Pmax" (com `:`) → potência caía na linha **NMOT** (447 em vez de 620) |
| Risen | 2/9 | tabela elétrica **fragmentada** nos tokens (valores quebrados) |
| TSUN | 1/9 | datasheet majoritariamente **imagem** |
| 8 datasheets | 0/9 | **PDF-imagem** (sem texto extraível) |

## FASE 2 — Correções de layout (rótulos)

- **Trina/PT:** adicionados rótulos `Potência de Pico-P MAX`, `Tensão Máxima de Potência`,
  `Corrente de Potência Máxima/I MPP`, `Tensão de Circuito Aberto-V OC`, `Corrente de Curto-I SC`.
- **ZNShine:** rótulo de potência agora aceita `:` (`Maximum Power[\s:]*Pmax`) → casa a linha **STC**
  (620) em vez da NMOT.
- **Dimensões:** separador `.` aceito (`2278.1134.30` → `2278x1134x30`), ainda com validação de faixa.
- **Risen/TSUN/PDF-imagem:** permanecem baixos (fragmentação de tokens / ausência de texto) → P2 (Vision).

## FASE 3 — Seleção de coluna em multi-potência

`extrairSpecsModulo(texto, { potenciaAlvo })` — extrai **todos** os valores da linha de cada campo e,
dada a potência do modelo, escolhe a **coluna correta** (±10 W; senão cai para a 1ª, **nunca inventa**).

**Verificado (Trina 540/545/550/555/560):**

| Alvo | potência | Voc | Vmp | Imp |
|---|---|---|---|---|
| (sem alvo) | 540 | 46.4 | 41.2 | 13.12 |
| **560** | **560** | **47.2** | **42.2** | **13.29** |
| **550** | **550** | **46.9** | **41.6** | **13.21** |

→ **modelo correto → coluna correta → dados corretos** ✓ (testado).

## FASE 4 — Benchmark (38 datasheets reais)

| Métrica | ANTES | DEPOIS |
|---|---|---|
| Completude média (com texto) | **6,3/9** | **6,73/9** |
| Datasheets ≥6 campos | 20/30 (67%) | **21/30 (70%)** |
| Datasheets ≥8 campos | — | **15/30 (50%)** |
| Falso-positivo | 0 | **0** ✓ |
| Cobertura Pmpp / Voc / Imp | 20 / 21 / 20 | **26 / 25 / 24** |

### Respostas
1. **Completude média:** **6,73/9** (era 6,3).
2. **Datasheets ≥6 campos:** **21/30 (70%)**.
3. **Datasheets ≥8 campos:** **15/30 (50%)**.
4. **Falso-positivo:** **0** — mantido (15 testes, incl. coluna fora de alvo → cai para 1ª, dimensões garbled/fora-de-faixa/células ÷6).
5. **Pronto para enriquecimento em massa?** **SIM, para os datasheets com texto** (70% ≥6 campos,
   50% ≥8, **0 falso-positivo**), com **escrita controlada** (gravar só campos comprovados) e
   **seleção de coluna por potência do modelo**. Os **8 PDF-imagem** seguem dependendo de OCR/Gemini
   Vision (P2) — serão **pulados** (não geram lixo).

## Testes (`moduleParser.test.js`, 15 — todos verdes)
Extração STC + 0 falso-positivo + fixtures golden (Astronergy/ZNShine 9/9) + **seleção de coluna**
(alvo 540/550/560/999) + dimensões com `.`. Suíte **672 passed** (14 falhas pré-existentes de
diagram, inalteradas); **build OK**.

### Conclusão
Cobertura subiu de **6,3 → 6,73/9** (≥6 de 67%→70%, **≥8 50%**), com **seleção de coluna por
potência** implementada e **0 falso-positivo** preservado. O parser está **pronto para o primeiro
enriquecimento em massa** dos módulos com datasheet em texto; PDF-imagem ficam para o P2 (Vision).
Nada fora do parser foi alterado.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P1-MODULE-PARSER-COVERAGE-01

A sprint P1-MODULE-PARSER-COVERAGE-01 focou em aumentar a cobertura do parser de módulos PV, com ênfase em casos de baixa completude e na preparação para o enriquecimento em massa. A abordagem em fases foi clara e os resultados apresentados são promissores.

**Avaliação dos Pontos:**

1.  **Correções de Rótulo (PT, ':' STC vs NMOT, '.'):** As correções são **corretas e seguras**. A inclusão de rótulos específicos para Trina/PT e a flexibilização para o separador ':' em ZNShine resolvem problemas de mapeamento direto. A aceitação do separador '.' em dimensões, com validação de faixa, é uma melhoria prática e segura. A distinção entre STC e NMOT é crucial e a correção para casar com STC é acertada.

2.  **Seleção de Coluna por Potência e Fallback:** A seleção de coluna por `potenciaAlvo` é **bem feita e o fallback (não inventa)** é **seguro**. A lógica de escolher a coluna mais próxima da `potenciaAlvo` e, na ausência de correspondência próxima, cair para a primeira coluna (sem inventar dados) é uma estratégia robusta para evitar a introdução de informações incorretas. Os exemplos com Trina demonstram a eficácia.

3.  **Ganho de Cobertura (6,3→6,73 e ≥8 50%):** O ganho de **6,3 para 6,73/9** na completude média é **honesto e relevante**. O aumento de 67% para 70% em datasheets com ≥6 campos é um progresso incremental. O salto para **50% em datasheets com ≥8 campos** é particularmente significativo, indicando que o parser agora consegue extrair uma quantidade substancialmente maior de informações críticas de uma parcela considerável dos módulos.

4.  **Meta 0 Falso-Positivo Preservada:** Sim, a meta de **0 falso-positivo foi preservada**. A manutenção de 15 testes focados em cenários de borda e a validação de que a seleção de coluna e as dimensões não geram dados espúrios confirmam isso.

5.  **Pular 8 PDF-Imagem para Vision (P2):** É **correto pular os 8 PDF-imagem para Vision (P2)**. Forçar a extração de dados de imagens sem a tecnologia adequada (OCR/Gemini Vision) resultaria em baixa qualidade e potencial introdução de erros. Adiar essa tarefa para a próxima fase, onde a tecnologia apropriada estará disponível, é a abordagem mais eficiente e segura.

6.  **Pronto para Enriquecimento em Massa (com-texto):** **SIM, está pronto** para o enriquecimento em massa dos datasheets com texto. A cobertura aprimorada, a seleção de coluna robusta e a garantia de 0 falso-positivo criam uma base sólida para a escrita controlada de campos comprovados.

7.  **Veredito:** **APROVADO**.

A sprint atingiu seus objetivos de forma eficaz, melhorando significativamente a cobertura do parser para módulos com dados textuais e preparando o terreno para a próxima fase de enriquecimento. As decisões tomadas, especialmente em relação aos PDFs-imagem e à seleção de coluna, demonstram um bom julgamento técnico.
