# P0-CATALOG-QUALITY-GOVERNANCE-01 — Governança de qualidade do Atlas (read-only)

> **100% READ-ONLY.** Auditoria, métricas e proposta. NÃO altera Atlas/SSOT/parser/OCR/SolarMarket.

## FASE 1 — Inventário real (349 equipamentos)

| Tipo | Total | Fabricantes (canônicos) | Modelos | Completo | Parcial | Shell |
|---|---|---|---|---|---|---|
| **Inversor** | **172** | 20 (**19**) | 172 | **32** | 10 | **130** |
| **Módulo** | **161** | 28 (**23**) | 158 | **50** | 45 | **66** |
| **Carregador EV** | **16** | 13 (13) | 16 | **6** | 10 | 0 |
| **BESS / Bateria** | **0** | — | — | — | — | — |

*Completo = possui o mínimo para dimensionar; Shell = ≤1 campo de especificação.* **`0W/0V/0A`
literais: 0** — o problema **não** é valor-zero, e sim **campo ausente** (shells do import SolarMarket).

## FASE 2 — Normalização de fabricantes (6 duplicados — todos **classe A: unificar**)

| Canônico | Variantes (qtde) | Total | Classe |
|---|---|---|---|
| **ZNShine** | `ZNShine Solar` ×29 · `Znshine` ×16 | 45 | A — unificar |
| **Trina** | `Trina Solar` ×6 · `Trina` ×4 | 10 | A — unificar |
| **OSDA** | `OSDA SOLAR` ×1 · `Osda` ×9 | 10 | A — unificar |
| **SolaX** (inversor) | `SolaX` ×9 · `Solax` ×1 | 10 | A — unificar |
| **Risen** | `Risen Energy` ×7 · `Risen` ×2 | 9 | A — unificar |
| **Canadian** | `Canadian Solar` ×2 · `Canadian` ×7 | 9 | A — unificar |

**Nenhum caso B (dúvida) ou C (distinto).** Os 6 são variações de grafia/sufixo do **mesmo
fabricante** → canonicalizar reduz 28→23 fabricantes de módulo e 20→19 de inversor. **Estratégia:**
campo `fabricante_canonico` + `aliases[]` (aditivo; **não** sobrescreve o `fabricante` original).

## FASE 3 — Critérios de qualidade

| Status | Critério |
|---|---|
| 🟢 **REAL** | possui o **mínimo para dimensionar** (módulo: Pmpp+Voc+Isc+Vmp+Imp; inversor: potência+tensão máx+nº MPPT; EV: potência+tensão+corrente), de datasheet/parser/cadastro completo |
| 🟡 **INFERIDO** | dados de **fallback/aproximação/recuperação conservadora** (`enriquecimento.fonte='fallback'`) — **0 hoje** (fallback ainda não existe) |
| 🔴 **INCOMPLETO** | sem o mínimo para dimensionar (shell, ou campo crítico ausente/zero) |

## FASE 4 — Classificação do catálogo

| Tipo | 🟢 REAL | 🟡 INFERIDO | 🔴 INCOMPLETO |
|---|---|---|---|
| Módulo | **50** | 0 | **111** |
| Inversor | **32** | 0 | **140** |
| Carregador EV | **6** | 0 | **10** |
| **TOTAL** | **88** | **0** | **261** |

→ **75% do catálogo (261/349) está INCOMPLETO** — dominado pelos **shells do import SolarMarket**
(130 inversores + 66 módulos) que entraram só com identidade.

## FASE 5 — UX e filtros (auditoria + proposta)

**Hoje existe** (infra parcial): `QualidadeBadge` + dashboard de qualidade (`Catalogo.jsx`,
`/api/admin/catalogo/qualidade-relatorio`), `SaudeCatalogo.jsx` (completude média, auditoria <80%),
e o `SeletorInversores` tem checkbox **"Mostrar equipamentos incompletos"**.

1. **Incompletos aparecem hoje?** Sim — por padrão ocultos no seletor, mas reveláveis pelo checkbox;
   no Catálogo aparecem com badge de qualidade (score), **sem** a tricotomia REAL/INFERIDO/INCOMPLETO.
2. **Como são exibidos?** Badge de score de completude (0–100), não o status semântico desta sprint.
3. **Como deveriam aparecer?** Tricotomia **🟢 REAL / 🟡 INFERIDO / 🔴 INCOMPLETO** consistente em
   card, busca e seleção; **INCOMPLETO bloqueado** para uso em projeto (selecionável só com aviso).

**Proposta de filtros rápidos** (reusando o badge/seletor existentes):
`[ Mostrar apenas válidos (🟢) ]  [ Incluir inferidos (🟡) ]  [ Mostrar incompletos (🔴) ]` — default
= só 🟢+🟡; 🔴 oculto salvo opt-in.

## FASE 6 — Impacto operacional

| # | Pergunta | Resposta |
|---|---|---|
| 1 | Usáveis em projetos hoje | **88** (50 módulos + 32 inversores + 6 EV) |
| 2 | Não deveriam aparecer ao operador | **261** (shells/incompletos) |
| 3 | Dependem de fallback | **110 módulos** (têm potência inferível, faltam Voc/Isc/Vmp/Imp) |
| 4 | Dependem de datasheet | **140 inversores** incompletos + os módulos não-cobertos por fallback |

**Risco: 🔴 ALTO** — 75% incompleto **misturado** com válidos e **sem distinção semântica forte** na
seleção → operador pode escolher um shell (sem specs) e gerar dimensionamento/parecer inválido.

## FASE 7 — Preparação para o fallback (módulos)

| # | Pergunta | Resposta |
|---|---|---|
| 1 | Candidatos ao fallback conservador | **110** (têm potência/tecnologia → dá p/ inferir Voc/Isc/Vmp/Imp conservadores) |
| 2 | Já possuem dados suficientes | **50** (🟢 REAL) |
| 3 | Continuariam bloqueados mesmo com fallback | **1** (sem nem potência identificável) |
| 4 | Ganho estimado de completude | módulos utilizáveis **50 → 160** (110 viram 🟡 INFERIDO) — de **31% → ~99%** dos módulos com dados mínimos p/ dimensionar |

→ Entrada pronta para **`P1-MODULE-FALLBACK-CONSERVADOR-01`** (110 candidatos, marcados 🟡, origem
rastreável, **nunca** sobrescrevendo dado real).

## FASE 8 — Respostas obrigatórias

1. **Fabricantes duplicados:** **6** (ZNShine, Trina, OSDA, SolaX, Risen, Canadian).
2. **Aliases a unificar:** os 6 acima (todos classe A — mesma marca, variação de grafia/sufixo).
3. **REAL:** **88**.
4. **INFERIDO:** **0** (fallback ainda não implementado).
5. **INCOMPLETO:** **261**.
6. **Maior problema atual:** **75% do catálogo é INCOMPLETO** (shells do import SolarMarket entraram
   só com identidade) e **aparecem misturados** aos válidos, sem normalização de fabricante e sem
   bloqueio semântico — risco de o operador dimensionar com equipamento sem specs.
7. **Próxima sprint recomendada:** **`P1-MODULE-FALLBACK-CONSERVADOR-01`** (destrava 110 módulos 🟡)
   + **`P1-CATALOG-NORMALIZE-FABRICANTES`** (unificar os 6 aliases via `fabricante_canonico`/`aliases`,
   aditivo). Em paralelo: continuar **datasheet/Vision** para os inversores incompletos.

### Conclusão
O catálogo tem **88 equipamentos REAL** e **261 INCOMPLETO** (75%), com **6 fabricantes duplicados**
e **0 inferidos** (fallback inexistente). O maior risco é operacional: shells misturados aos válidos.
Dois caminhos de maior ROI: **(1) fallback conservador** (110 módulos 🟡 — leva módulos utilizáveis
de 31%→~99%) e **(2) normalização de fabricantes** (6 aliases, aditiva). A infra de UX já existe
(badge/filtro/dashboard) e só precisa adotar a tricotomia 🟢/🟡/🔴. Nada foi alterado (read-only).


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P0-CATALOG-QUALITY-GOVERNANCE-01 (READ-ONLY)

A auditoria de qualidade do catálogo Atlas, focada em equipamentos e normalização de fabricantes, apresenta um diagnóstico detalhado e propostas de melhoria. A abordagem "read-only" garante a segurança das operações atuais.

**Avaliação dos Pontos Chave:**

1.  **Critérios de Qualidade (Mínimo para Dimensionar):** Os critérios definidos para "REAL" (completo com dados mínimos para dimensionar) são **corretos e bem fundamentados**, cobrindo os parâmetros essenciais para cada tipo de equipamento (módulo, inversor, EV). A ausência de "INFERIDO" (fallback) é uma limitação atual, mas a definição do que ele representaria é adequada. O critério para "INCOMPLETO" (campo ausente/zero) é claro.

2.  **Classificação de Aliases (Classe A):** A classificação dos 6 aliases de fabricantes como **Classe A (unificar)** está **correta**. A análise demonstra que são variações de grafia/sufixo do mesmo fabricante, justificando a canonicalização para reduzir a redundância e melhorar a consistência.

3.  **Relevância e Honestidade do Achado (Campo Ausente):** O achado de que o problema principal são **campos ausentes (shells do import SolarMarket)**, e não valores literais de 0W/0V/0A, é **altamente relevante e honesto**. Essa distinção é crucial para direcionar as soluções corretas, focando na ingestão e enriquecimento de dados, em vez de apenas na validação de valores.

4.  **Segurança da Normalização Aditiva:** A estratégia de normalização **aditiva** (`fabricante_canonico` + `aliases[]` sem sobrescrever) é **segura**. Ela preserva a integridade dos dados originais enquanto introduz a canonicalização, permitindo rastreabilidade e flexibilidade futura.

5.  **UX (Tricotomia + Filtros + Bloqueio):** A proposta de adotar a tricotomia **🟢 REAL / 🟡 INFERIDO / 🔴 INCOMPLETO**, combinada com filtros rápidos e o bloqueio de equipamentos incompletos para uso em projeto, representa a **UX correta e necessária**. Essa abordagem aumenta drasticamente a clareza e a segurança para o operador, prevenindo o uso de dados inválidos.

6.  **Plausibilidade do Ganho do Fallback:** O ganho estimado do fallback para módulos (de 31% para ~99% de utilizáveis) é **plausível**, considerando que 110 módulos são candidatos a terem seus dados mínimos inferidos conservadoramente. Isso demonstra o alto potencial de melhoria na completude do catálogo.

7.  **Acerto da Priorização:** A priorização em focar no **fallback conservador** e na **normalização de fabricantes** é **acertada**. Estas são as ações com maior impacto imediato na usabilidade e confiabilidade do catálogo, abordando os riscos mais críticos.

**Veredito:**

**APROVADO COM RESSALVAS**

**Ressalvas:**

*   Embora a sprint seja "read-only", é fundamental que as próximas etapas (P1) sejam executadas com rigor para mitigar os riscos identificados.
*   A proposta de bloqueio de "incompletos" para uso em projeto é excelente, mas a implementação deve ser clara para o usuário, com avisos explícitos sobre o motivo do bloqueio e como contorná-lo (se aplicável).
*   A estratégia de "fallback conservador" deve ser documentada detalhadamente, incluindo as regras de inferência e a origem dos dados para garantir a confiança.

A auditoria é robusta e as conclusões são bem fundamentadas. A clareza sobre os problemas e as soluções propostas é um ponto forte.
