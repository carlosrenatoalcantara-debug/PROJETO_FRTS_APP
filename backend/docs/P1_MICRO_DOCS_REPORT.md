# P1-MICRO-DOCS-01 — Renderização micro em documentos (memorial / unifilar)

> Follow-up do `P0-ARRAY-CONFIG-MICROINVERSOR-01`: os documentos a jusante (memorial, unifilar,
> parecer) consomem o `topologia`+`micro` persistido e param de assumir **string** para
> microinversores. Escopo: **UI/documentos**. NÃO altera SSOT/Atlas/OCR/parser/SolarMarket.

## FASE 1 — Auditoria dos consumidores

| Artefato | Onde assumia string |
|---|---|
| `templatesHomologacao.js` (memorial) | `Tipo: String (on-grid…)` fixo + bloco de proteções com **"String box CC — fusíveis por string"** |
| `UnifilarFV.jsx` | estatística **"Strings"** = `numStrings` |
| `ValidacaoEletrica.jsx` | painel de `stringsConfig` (paineis/string, total strings) |

## FASE 2 — Helper de descrição (`descricaoTopologia.js`)

`descricaoTopologia(topologia, micro)` → `{ tipoInversor, protecoes[], resumoArranjo, usaString, rotulo }`
por topologia (string / micro / otimizador). `topologiaDoProjeto(d)` resolve a topologia do projeto
(**campo persistido tem prioridade**; senão classifica pelo modelo via `classificarTopologia`).

- **micro:** "Microinversor (CA distribuída — módulo a módulo, sem strings CC)"; proteções **sem
  string box CC** ("cada módulo conecta diretamente ao microinversor"; DPS no lado CA).
- **string:** mantém "String (on-grid…)" + string box CC com fusíveis por string.
- **otimizador:** "string com otimizadores de potência (MPPT por módulo)".

## FASE 3 — Cabeamento nos documentos

- **Memorial** (`gerarMemorialCalculo`): `Tipo` e a seção **7. Proteções Elétricas** agora vêm de
  `topo.*`; em micro adiciona linha `Arranjo: N microinversores — M módulos por micro` e usa a
  **quantidade de microinversores** (não de inversores string).
- **Unifilar** (`UnifilarFV`): a estatística **"Strings"** vira **"Microinversores"** (qtd de micros)
  quando topologia = micro.
- **ValidacaoEletrica:** o fluxo micro do configurador **não** alimenta `stringsConfig` (o painel
  string só aparece para topologia string) — sem regressão.

## FASE 4 — Validação (`microDocs.test.js`, 6 testes — verdes)

| Teste | Resultado |
|---|---|
| descrição micro: sem string box, "Microinversor" | ✓ |
| descrição string: "String (on-grid" + string box CC | ✓ |
| `topologiaDoProjeto`: persistido > classificação por modelo | ✓ |
| **memorial MICRO** (Hoymiles): contém "Microinversor", **NÃO** "String box…fusíveis por string", "7 unidade(s)" | ✓ |
| **memorial STRING** (Growatt): mantém "String (on-grid" + "fusíveis por string" | ✓ |

**Build OK · suíte 690 passed** (+6; 14 falhas pré-existentes de diagram, inalteradas).
Verificação por **conteúdo do documento gerado** (asserts diretos no texto do memorial) — prova mais
forte que screenshot para um gerador de documento.

## Conclusão
Memorial e unifilar agora **refletem a topologia real**: microinversor não aparece mais como "String
(on-grid)" nem com "string box CC / fusíveis por string", e o unifilar conta **microinversores** em
vez de strings. String/otimizador inalterados (compatibilidade preservada). Com isso, o ciclo
micro fica coerente da **configuração → persistência → documentos**. Nada fora do escopo
(SSOT/Atlas/OCR/parser/SolarMarket intocados).


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P1-MICRO-DOCS-01

A sprint P1-MICRO-DOCS-01 abordou de forma eficaz a necessidade de renderizar corretamente a topologia de microinversores em documentos gerados, corrigindo uma inconsistência significativa onde microinversores eram tratados como sistemas de string. A abordagem de criar um helper centralizado para descrever a topologia é tecnicamente sólida e promove a reutilização de código.

**Avaliação dos pontos levantados:**

1.  **Helper centralizado por topologia:** Sim, esta é a abordagem correta. Centralizar a lógica de descrição da topologia em `descricaoTopologia.js` garante consistência e facilita a manutenção futura. A separação clara entre os tipos de topologia (micro, string, otimizador) é bem definida.

2.  **Memorial micro tecnicamente correto:** Sim, o memorial micro parece tecnicamente correto. A ausência de "string box CC" e a inclusão da quantidade de microinversores e detalhes do arranjo são adequadas para sistemas com microinversores. A proteção CA é o foco principal nesse cenário.

3.  **Priorizar campo persistido sobre classificação por modelo:** Sim, esta é a abordagem correta. O campo persistido representa o estado real e intencional da configuração, sendo mais confiável do que uma classificação automática que pode falhar ou não refletir nuances específicas.

4.  **Testar por conteúdo do documento gerado (vs screenshot):** Sim, testar por conteúdo do documento gerado com asserts é uma prova adequada e, em muitos casos, superior a screenshots para geradores de documentos. Permite verificar a precisão textual e a presença/ausência de informações específicas de forma automatizada e robusta.

5.  **Compatibilidade string/otimizador preservada:** Sim, a sprint explicitamente menciona que a compatibilidade com string e otimizador foi preservada, o que é crucial para evitar regressões em sistemas existentes.

6.  **Gap (parecer/carta concessionária):** A sprint foca em memorial e unifilar. Documentos como parecer e carta concessionária, que podem ter requisitos de formatação ou conteúdo mais específicos e dependentes de regras externas, **não foram cobertos** por esta sprint. Este é um gap identificado, mas que parece estar fora do escopo definido.

**Veredito:**

**APROVADO COM RESSALVAS**

**Justificativa:** A sprint foi bem-sucedida em corrigir a renderização de microinversores em memorial e unifilar, com uma abordagem técnica sólida e testes adequados. As ressalvas se referem à identificação de que documentos como parecer e carta concessionária ainda não foram cobertos, o que pode ser um próximo passo a ser considerado em sprints futuras, dependendo da prioridade.
