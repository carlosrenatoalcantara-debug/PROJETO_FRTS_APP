# P1-MODULE-PARSER-COLUMN-FIX-01 — Correção da seleção de coluna

> Objetivo: destravar o enriquecimento dos módulos **já cobertos** pela biblioteca, corrigindo a
> seleção de coluna de potência. **Sem escrita no Atlas** (parser-fix + medição). Regras de
> segurança **inalteradas** — continua proibindo falso-positivo, extrapolação e inferência.

## FASE 1 — Módulos cobertos que só receberam físicos (enrich-02)

Da biblioteca de 8 datasheets, ficaram **só com físicos** (sem elétrico): Jinko **JKM550M-72HL4-V**,
DAH **DHM72X10-550W** (×3 FS/BF), e os Trina **TSM-DE18-540…560** (só dimensões). Causa comum:
**a coluna de potência exata não era resolvida**.

## FASE 2 — Causa por modelo (diagnóstico empírico)

| Causa | Modelo(s) | Evidência |
|---|---|---|
| **A — seleção de coluna incorreta** | DAH DHM72X10-550 | tokens `... 540 545 550 555` limpos, mas o merge texto/tokens devolvia **555** |
| **B — potência próxima, não exata** | Jinko JKM550M | número **quebrado** pelo tokenizador: `550Wp` → `"5"`+`"50"`+`"Wp"`; proximidade ≤10 pegava **545** |
| **C — parser não reconhece o rótulo/linha** | Trina TSM-DE18 | há 2 linhas "Peak Power-P MAX": **NMOT (408…)** e **STC (540…)**; pegava a 1ª (NMOT 408) |
| **D — conflito com valor existente** | 6 módulos | datasheet diverge >5% de valor já gravado → pulado (segurança) |
| **E — datasheet imagem** | 3 módulos | 0 campos extraíveis (Vision) |

## FASE 3 — Correções (A, B, C) sem afrouxar segurança

`parserTecnicoModulo.js` (3 mudanças, parser-only):

1. **Defragmentação de números quebrados** (`reconstruirLinhas`): cola fragmentos numéricos
   adjacentes com gap pequeno (`"5"+"50"→"550"`). Resolve a **causa B** (potência).
2. **Seleção de coluna EXATA (±1, era ±10)**: nunca usa coluna vizinha. Resolve a **causa A** e
   impede o falso-positivo de pegar 545/555 para um módulo 550.
3. **Merge texto/tokens prefere o caminho com potência exata** (preserva alinhamento de coluna —
   não mistura Voc de um caminho com potência de outro). Resolve a **causa A** (DAH).
4. **Guarda anti-truncado** (no dry-run de enriquecimento): se `voc/vmp/imp` extraídos forem
   **todos inteiros** (≥2) → decimais perdidos (ex.: Jinko 550 → Voc 49 em vez de 49.8) →
   **bloqueia o elétrico** (mantém físico). Impede falso-positivo onde o defrag não recompõe o
   decimal. **Segurança reforçada, não afrouxada.**

> A **causa C (Trina linha NMOT)** e o **Jinko 550 com decimais quebrados** **não** foram
> totalmente resolvidos (exigem alinhamento multi-linha STC×NMOT), mas **caem com segurança em
> físico-only** — **0 falso-positivo**.

## FASE 4 — Benchmark (seleção de coluna por potência-alvo)

| Datasheet | alvo | ANTES | DEPOIS |
|---|---|---|---|
| DAH DHM72X10 | 540 / 550 / 555 | 555 / **555** / 555 (errado p/ 540,550) | **540 / 550 / 555** ✅ exato |
| Jinko 530-550M | 530 / 540 / 550 | 530 / 540 / **545** (errado p/ 550) | 530 / 540 / **550** (pot ok; elétrico truncado → bloqueado) |
| Trina DE18 | 540 | 408 (NMOT) | 408 (NMOT) — ainda B/C, **físico-only seguro** |

**Suíte:** 15/15 testes do parser de módulo · **672 passed** (14 falhas pré-existentes de diagram,
inalteradas) · **build OK**. Fixtures golden (Astronergy/ZNShine 9/9) preservadas.

## FASE 5 — Re-dry-run de enriquecimento (sem escrita)

| # | Pergunta | Resposta |
|---|---|---|
| 1 | **Módulos adicionais enriquecíveis (com elétrico)** | **+3** (DAH DHM72X10-550 série) — coluna 550 agora exata → +12 campos elétricos |
| 2 | **Continuam bloqueados** | **7 físico-only** (B: Jinko-550 truncado, Trina NMOT, 550s não-exatos) + **6 conflitos** + **116 sem datasheet** |
| 3 | **Dependem de Vision** | **3** (PDF-imagem com modelo casado) + os ~8 PDF-imagem da biblioteca |
| 4 | **Ganho potencial de completude** | **+3 módulos × 4 elétricos = +12 campos** → completude módulos ~2,24 → ~2,31/9 (marginal) |
| 5 | **Vale continuar baixando datasheets?** | **Não como prioridade.** O fix confirma que o gargalo **migrou para o parser de layouts difíceis** (STC×NMOT interleaved, decimais quebrados) e para **Vision** (imagem). Baixar mais datasheets de série tem **ROI baixo** até resolver: **(a)** alinhamento multi-linha STC×NMOT no parser, **(b)** Vision para imagem. |

### Conclusão
A correção **eliminou o falso-positivo de coluna vizinha** (545/555 para módulos 550) e tornou a
seleção **exata**: DAH 540/550/555 agora resolvem corretamente (**+3 módulos elétricos**, +12
campos), e a **guarda anti-truncado** bloqueia o lixo do Jinko-550. O ganho imediato é **modesto e
seguro**; o gargalo restante é **layout-específico** (Trina NMOT-row, Jinko split-decimals) e
**imagem** — ambos com fallback seguro para físico-only (**0 falso-positivo**). **Recomendação:**
antes de expandir a biblioteca, priorizar **(1)** o alinhamento multi-linha STC×NMOT do parser e
**(2) Vision** para PDF-imagem. Nenhuma escrita no Atlas (parser-fix + medição).


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P1-MODULE-PARSER-COLUMN-FIX-01

A sprint P1-MODULE-PARSER-COLUMN-FIX-01 abordou um problema crítico na seleção de coluna de potência, que impedia o enriquecimento elétrico de módulos já cobertos. A análise e as correções apresentadas são detalhadas e demonstram um bom entendimento das causas raiz.

**Avaliação Detalhada:**

1.  **Diagnóstico das Causas (A-E):** O diagnóstico é **correto e bem fundamentado**. A decomposição do problema em causas específicas (A-E) com evidências claras para cada modelo (DAH, Jinko, Trina) é exemplar. A identificação de múltiplos fatores, desde a interpretação de texto/tokens até a estrutura de datasheets com múltiplas linhas de potência, demonstra uma análise profunda.

2.  **Correções Técnicas e Segurança da Seleção EXATA ±1:** As quatro correções propostas são **tecnicamente sólidas**.
    *   A **defragmentação de números colados** (`reconstruirLinhas`) é uma solução inteligente para o problema de tokens quebrados.
    *   A **seleção de coluna EXATA ±1** é significativamente **mais segura** que a anterior ±10. Ela minimiza drasticamente o risco de selecionar uma coluna adjacente incorreta, focando na precisão. A decisão de não usar "vizinhos" reforça a segurança.
    *   A preferência do merge pelo caminho com potência exata é um bom ajuste para preservar a integridade da informação.
    *   A **guarda anti-truncado** é um heurístico **eficaz e seguro**. Ao identificar a situação onde todos os valores elétricos são inteiros, ela corretamente infere a perda de decimais e bloqueia o enriquecimento elétrico, prevenindo falsos positivos. Este é um bom exemplo de como reforçar a segurança em vez de afrouxá-la.

3.  **Guarda Anti-Truncado (Heurístico):** Como mencionado acima, a guarda anti-truncado é um **bom heurístico anti-falso-positivo**. A lógica de que a ausência de decimais em múltiplos campos elétricos é suspeita é válida. É improvável que rejeite valores legítimos, pois a perda de decimais é um sintoma de truncamento, não de um valor inteiro natural.

4.  **Tratamento de Trina/Jinko-550 em Físico-Only:** Deixar Trina/Jinko-550 em físico-only seguro, em vez de forçar um enriquecimento elétrico potencialmente incorreto, **respeita plenamente o princípio de segurança** de evitar falsos positivos. A abordagem de "fallback seguro" é a mais prudente quando a precisão total não pode ser garantida pelo parser.

5.  **Honestidade sobre o Ganho e Recomendação:** A honestidade sobre o ganho modesto (+3 módulos elétricos) e a recomendação de priorizar o alinhamento multi-linha STC×NMOT e Vision antes de baixar mais datasheets são **acertadas**. Isso demonstra uma visão estratégica focada no ROI e na resolução dos gargalos reais, em vez de esforços de baixo impacto. A priorização correta dos próximos passos é crucial.

**Veredito:**

**APROVADO**

A sprint foi bem-sucedida em corrigir um problema de longa data com um conjunto de correções robustas e seguras. O diagnóstico foi preciso, as correções são tecnicamente sólidas e a estratégia para os próximos passos é bem definida. O foco em segurança e a honestidade sobre os resultados são pontos fortes.
