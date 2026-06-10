# P1-CATALOG-NORMALIZE-FABRICANTES-01 — Normalização de fabricantes

> Normalização **não-destrutiva** dos 6 fabricantes duplicados. Adiciona `fabricante_canonico` +
> `aliases[]`; **preserva** `fabricante`, `_id`, `origem`, `historico`, `hash_unico`,
> `especificacoes`. Não toca parser/OCR/SolarMarket/memorial/parecer.

## FASE 1 — Validação dos 6 grupos (todos **A — mesmo fabricante**)

| Canônico | Variantes (aliases) | Registros | Tipo | Classe |
|---|---|---|---|---|
| **ZNShine** | `ZNShine Solar`, `Znshine` | 45 | módulo | A |
| **SolaX** | `SolaX`, `Solax` | 10 | inversor | A |
| **Trina** | `Trina Solar`, `Trina` | 10 | módulo | A |
| **OSDA** | `OSDA SOLAR`, `Osda` | 10 | módulo | A |
| **Risen** | `Risen Energy`, `Risen` | 9 | módulo | A |
| **Canadian** | `Canadian Solar`, `Canadian` | 9 | módulo | A |

Nenhum caso B (dúvida) ou C (distinto) — todas são variações de grafia/sufixo do mesmo fabricante.

## FASE 2 — Modelo de governança

Campos **aditivos** por registro (o `fabricante` bruto permanece):
```json
{ "fabricante": "OSDA Solar", "fabricante_canonico": "OSDA", "aliases": ["OSDA SOLAR", "Osda"] }
```
Mapa completo em **`CATALOG_FABRICANTE_ALIAS_MAP.json`**.

## FASE 3 — Aplicação (não-destrutiva, idempotente)

**93 registros** atualizados via `$set { fabricante_canonico, aliases }`. **Não tocou** `fabricante`/
`_id`/`origem`/`historico`/`hash_unico`/`especificacoes`. **Idempotente** — re-execução = **0 updates**.

## FASE 4 — Busca (`fabricanteQuery.js`)

`queryFabricante(termo)` → `{ $or: [{fabricante}, {fabricante_canonico}, {aliases}] }` (regex
escapado, case-insensitive). **Verificação empírica no Atlas — busca canônica vs alias retorna o
MESMO conjunto:**

| Grupo | "canônico" | "alias completo" | Mesmo conjunto |
|---|---|---|---|
| OSDA | 10 | 10 | ✅ |
| Trina | 10 | 10 | ✅ |
| Canadian | 9 | 9 | ✅ |
| Risen | 9 | 9 | ✅ |
| ZNShine | 45 | 45 | ✅ |
| SolaX | 10 | 10 | ✅ |

`fabricanteQuery.test.js` (5 testes verdes). Pronto para adoção nas rotas de busca/listagem de
equipamento (e agrupamento por `fabricante_canonico` no seletor) — substituição de `{fabricante: rx}`
por `queryFabricante(termo)`.

## FASE 5 — Impactos

| # | Pergunta | Resposta |
|---|---|---|
| 1 | Registros atualizados | **93** |
| 2 | Fabricantes canônicos | **6** |
| 3 | Aliases criados | **12** strings distintas (2 por grupo) |
| 4 | Quebra de compatibilidade | **0** — `fabricante` bruto preservado; campos aditivos |
| 5 | Duplicação criada | **0** — 3 hashes duplicados são **pré-existentes**; nenhum novo |

## Segurança / Aceite

✅ **Não destrutivo** (só adiciona `fabricante_canonico`/`aliases`) · ✅ `historico`/`hash_unico`/
`origem`/`_id`/`especificacoes` **preservados** (0 perderam fabricante/hash) · ✅ **Busca funcionando**
(6/6 grupos casam canônico↔alias) · ✅ **Sem duplicação** · ✅ Idempotente.

### Conclusão
Os **6 fabricantes duplicados** (93 registros) foram unificados de forma **aditiva e
não-destrutiva** via `fabricante_canonico`+`aliases`, com **busca canônica comprovada** (canônico e
alias retornam o mesmo conjunto) e **0 quebra/duplicação**. O `fabricante` bruto e toda a
proveniência permanecem intactos. Entregue o helper `queryFabricante` (testado) para as rotas
adotarem. Lote/mapa em `CATALOG_FABRICANTE_ALIAS_MAP.json`.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P1-CATALOG-NORMALIZE-FABRICANTES-01

A sprint P1-CATALOG-NORMALIZE-FABRICANTES-01 aborda a normalização de fabricantes de forma **não-destrutiva**, um ponto crucial para a integridade dos dados no Atlas. A metodologia de adicionar `fabricante_canonico` e `aliases` preservando os campos originais (`fabricante`, `_id`, `origem`, `historico`, `hash_unico`, `especificacoes`) é a **abordagem correta e segura** para normalização. Essa estratégia aditiva minimiza riscos de perda de informação ou quebra de compatibilidade.

A classificação dos 6 grupos como **Classe A (unificar)** parece acertada, dado que as variantes identificadas são claramente grafias ou sufixos do mesmo fabricante, sem indícios de serem entidades distintas.

A implementação do helper `queryFabricante` com `$or` e a **verificação empírica** que demonstra que a busca pelo canônico e por um alias completo retorna o **mesmo conjunto de registros** é uma prova robusta de que a funcionalidade de busca está operando corretamente. Os 5 testes verdes do helper reforçam essa conclusão.

A **idempotência** da aplicação, juntamente com a ausência de quebras de compatibilidade e a não criação de duplicações (os hashes duplicados pré-existentes são corretamente identificados como tal), **comprovam a não-destrutividade** da operação. A preservação do `fabricante` bruto e do `hash_unico` garante que nenhum registro perdeu sua identidade ou integridade.

**Pontos de atenção e possíveis gaps:**

*   **Adoção do Helper:** A menção de que o helper `queryFabricante` está pronto para adoção nas rotas de busca/listagem é positiva. É fundamental garantir que todas as rotas relevantes, especialmente aquelas que realizam buscas por fabricante, sejam atualizadas para utilizar este novo helper. Rotas que ainda não o adotaram representam um risco de inconsistência na busca.
*   **Agrupamento no Seletor:** A sugestão de utilizar `fabricante_canonico` para agrupamento no seletor é uma boa prática. É importante que essa implementação seja feita de forma consistente em toda a interface do usuário.

**Veredito:**

**APROVADO**

A abordagem é sólida, a execução parece ter sido minuciosa e os resultados comprovam a eficácia e segurança da normalização. Apenas a garantia da adoção completa do helper `queryFabricante` em todas as rotas e a implementação consistente do agrupamento no seletor precisam ser monitoradas para assegurar a totalidade do benefício.
