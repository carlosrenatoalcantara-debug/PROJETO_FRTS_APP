# P0-SOLARMARKET-CACHE-BATCH-01 — Cache de propostas + matching em lote

> Escopo: **cache local de propostas** + **matching em lote**. Fora de escopo: importar
> clientes/projetos/catálogo, alterar equipamentos, escrever no Atlas. Toda escrita aqui é
> **local** (cache em disco); o Atlas é **somente lido**.

## FASE 1 — Baseline (instrumentado)

| Etapa | Medição |
|---|---|
| Extração (cold, 642 propostas) | **~18,2 min** (1.090.919 ms) · **642 chamadas** SolarMarket |
| Matching (per-item, baseline) | **1.824 queries** Atlas (1–3 `findOne` por item × 608 itens) |
| Processamento (normalizer/dedup) | < 1 s (CPU) |

## FASE 2 — Cache de propostas (`proposalCache.js`)

Camada **persistente em disco** (`backend/.cache/solarmarket/proposals/<id>.json`):
- **TTL configurável** (default 7 dias) · chave = `project_id` · 1 arquivo/projeto.
- **force-refresh** (opção) · **invalidação manual** (`limparCache`) · `infoCache()` (uso).
- `obterProposta(id, fetcher, opts)` — usa cache, busca só no miss, grava no miss.

| Métrica | Valor |
|---|---|
| Propostas armazenadas | **642** |
| Espaço consumido | **54,0 MB** (56.645.572 bytes) |
| Redução de chamadas futuras | **642 → 0** (100% cache hit) |

## FASE 3 — Matching em lote (`matcherLote.js`)

`carregarIndice()` carrega o catálogo (**1 query**, 113 docs) e monta índices em memória
(`porHash`, `porNorm`); `matchEmMemoria()` resolve as **3 estratégias** (hash 1.0 / normalizado
0.95 / fuzzy 0.70–0.92) **localmente**, replicando fielmente o `matcher.encontrarMatch`.

## FASE 4 — Comparação ANTES → DEPOIS

| Métrica | ANTES (per-item) | DEPOIS (cache + lote) | Ganho |
|---|---|---|---|
| Extração (642 propostas) | **18,2 min** | **0,76 s** (cache) | **~99,99%** (×1.430) |
| Chamadas SolarMarket | **642** | **0** | **−642** |
| Queries Atlas (matching) | **1.824** | **1** | **−1.823** |
| Tempo de matching | (rede × 1.824) | **~0,18 s** | — |
| Memória (índice em memória) | — | desprezível (113 docs) | — |
| **Precisão (resultados idênticos)** | — | **608/608** ✓ | **100%** |
| Decisão (criar/atualizar/ignorar) | — | **idêntica** ✓ | — |

→ **Resultados finais idênticos** (608/608 itens com mesma estratégia e mesmo doc; decisão
`decidirAcao` idêntica). O lote não muda o resultado — só o custo.

## FASE 5 — Segurança (somente leitura)

- **Nenhum equipamento criado/alterado** nesta sprint — o matcher em lote usa `find().lean()`
  (leitura) e o cache grava **apenas em disco local**.
- **Nenhum documento/projeto alterado.** O Atlas é apenas consultado (1 query de catálogo).
- Confirmado: `total` do catálogo inalterado durante o benchmark.

## FASE 6 — Respostas

1. **Tempo antes.** Extração ~18,2 min + matching com 1.824 queries.
2. **Tempo depois.** Extração **0,76 s** (cache) + matching **1 query / ~0,18 s**.
3. **Ganho percentual.** Extração **~99,99%** (×1.430); matching **~99,9%** (1.824→1 query).
4. **Chamadas SolarMarket eliminadas.** **642 → 0** em execuções repetidas (−642).
5. **Queries Atlas eliminadas.** **1.824 → 1** (−1.823).
6. **Espaço consumido pelo cache.** **54 MB** (642 propostas).
7. **Impacto em futuras importações.** O ciclo de dry-run/import (re-extração + matching)
   cai de **~18 min para segundos**; permite re-executar o pipeline à vontade **sem custo de
   rate-limit** e sem hammering da API (evita os 429/erros de re-fetch concorrente).
8. **Recomendação final.** **A) Pronto para importar.** Cache + matching em lote eliminam os dois
   gargalos; resultados comprovadamente idênticos (608/608). O catálogo permanece íntegro (leitura).

## FASE 7 — Recomendação

**A) PRONTO PARA IMPORTAR o catálogo SolarMarket.** Justificativa numérica: gargalo de extração
removido (642→0 chamadas; 18min→0,76s), gargalo de matching removido (1.824→1 query) e
**equivalência 608/608** comprovada — o pipeline de import pode ser executado de forma repetível,
barata e segura.

### Conclusão
As duas alavancas da auditoria de performance foram implementadas e validadas: **cache de
propostas** (54 MB, 642→0 chamadas, ×1.430 mais rápido) e **matching em lote** (1.824→1 query),
com **resultados idênticos** (608/608) e **zero escrita no Atlas**. Pipeline pronto para
importação eficiente.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P0-SOLARMARKET-CACHE-BATCH-01: Eliminação de Gargalos no Pipeline SolarMarket

A sprint P0-SOLARMARKET-CACHE-BATCH-01 abordou com sucesso os gargalos críticos no pipeline SolarMarket, focando na implementação de um cache de propostas persistente em disco e um mecanismo de matching em lote. As entregas, `proposalCache.js` e `matcherLote.js`, demonstram ganhos significativos em performance e eficiência.

**Avaliação Detalhada:**

1.  **Design do Cache:** O design do cache é **adequado**. A persistência em disco garante que os dados não sejam perdidos entre reinicializações. O TTL configurável, a chave por `project_id` e a opção `force-refresh` oferecem flexibilidade e controle sobre a validade dos dados. A invalidação manual é um ponto positivo para cenários de emergência. A estratégia de um arquivo por `project_id` é uma boa prática para organização e gerenciamento.

2.  **Replicação do Matcher e Equivalência:** O `matcherLote.js` parece replicar fielmente as três estratégias do matcher original. A equivalência de **608/608 resultados idênticos** é uma prova robusta de que o matching em lote produz os mesmos resultados que o processo item a item. A decisão `decidirAcao` idêntica reforça essa confiança.

3.  **Ganhos de Performance:** Os ganhos medidos são **reais e bem documentados**. A redução de 642 chamadas para 0 na extração, de 1824 queries para 1 no matching, e a diminuição do tempo de extração de 18 minutos para 0,76 segundos são transformadores. A medição parece ter sido realizada de forma rigorosa, comparando o estado "antes" e "depois" de forma clara.

4.  **Garantia de Read-Only no Atlas:** A garantia de **zero escrita no Atlas** é **convincente**. A utilização de `find().lean()` e o fato de o cache ser exclusivamente em disco local mitigam riscos de alterações indesejadas no banco de dados principal. A confirmação de que o catálogo permaneceu inalterado durante o benchmark reforça essa segurança.

5.  **Riscos Potenciais:**
    *   **Cache Stale:** Embora o TTL e a invalidação manual mitiguem isso, existe sempre um risco inerente de o cache ficar desatualizado se as propostas no SolarMarket mudarem e o TTL expirar antes da invalidação. A frequência de atualização do cache precisará ser monitorada.
    *   **Divergência Fuzzy em Memória:** A replicação de estratégias fuzzy em memória, embora bem intencionada, pode introduzir pequenas variações em implementações de bibliotecas ou arredondamentos, especialmente com a faixa de 0.70-0.92. A equivalência 608/608 sugere que isso não foi um problema nesta execução, mas é um ponto a se ter em mente para futuras iterações ou se as estratégias fuzzy forem ajustadas.

**Veredito:**

**APROVADO**

A sprint entregou resultados impressionantes, resolvendo gargalos significativos com uma abordagem segura e bem documentada. Os ganhos de performance são substanciais e a equivalência dos resultados é um forte indicador de sucesso. Os riscos identificados são inerentes a sistemas de cache e matching, mas foram mitigados de forma eficaz pelas implementações desta sprint. A recomendação de "Pronto para importar" é justificada pelos dados apresentados.
