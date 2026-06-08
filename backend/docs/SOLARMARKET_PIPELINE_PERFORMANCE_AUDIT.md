# SOLARMARKET-PIPELINE-PERFORMANCE-AUDIT — Auditoria de performance (read-only)

> **100% read-only.** Auditoria por **leitura de código** do pipeline SolarMarket → Normalizer →
> Matcher → Dedup. Sem alterar código/Atlas; sem interromper o dry-run em execução.

## Mapa de etapas e custo

| Etapa | Implementação | Custo dominante |
|---|---|---|
| **1. Extração** (`extractor.js`) | `paginarProjetos` (7 págs) + `buscarPropostaDoProjeto` **1 chamada/projeto** | **~12 min** (rate-limit) |
| **2. Filtragem** (`validator.filtrarLote`) | CPU puro, síncrono | < 1 s |
| **3. Normalização** (`normalizer.normalizarLote`) | CPU puro + **dedup por hash** | < 1 s |
| **4. Validação pós** (`validarNormalizado`) | CPU puro | < 1 s |
| **5. Matching** (`matcher.encontrarMatchesEmLote`) | **`findOne` por item**, cascata 3 estratégias | ~30–90 s |
| **6. Dedup/decisão** (`deduplicator.decidirAcao`) | CPU puro | < 1 s |

## Respostas

### 1. Tempo gasto por etapa
- **Extração ≈ 12 min** (gargalo). `RATE_DELAY_MS = 1100` ms entre **cada** chamada externa;
  `642 propostas + 7 páginas ≈ 649 chamadas × 1,1 s = ~714 s (~11,9 min)` + auth.
- Normalização/filtragem/dedup: **somadas < 3 s** (CPU puro).
- Matching: **~30–90 s** (≈339 itens únicos × 1–3 `findOne` remotos via DoH/Atlas).

→ **>90% do tempo total é a extração** (espera de rate-limit).

### 2. Quantidade de chamadas externas
- **SolarMarket API:** ~**649** (1 auth cacheada + ~7 páginas de `/projects` + **642** `/projects/:id/proposals`).
- **MongoDB/Atlas (matcher):** ~**340–1000** `findOne`/`find` (1–3 por item, cascata hash→norm→fuzzy).
- **Total de I/O externo:** ~**1.000–1.650** chamadas sequenciais.

### 3. Quantidade de matching repetido
- **Itens idênticos: 0 repetições** — `normalizarLote` **deduplica por `hash_unico` ANTES** do
  matching (`duplicatasPorHash`), então cada hash é consultado **uma vez**.
- **Desperdício real:** para **não-matches**, a cascata executa **até 3 queries** (hash → norm →
  fuzzy) por item — a maioria dos ~313 inéditos paga as 3 queries só para concluir "sem match".

### 4. Oportunidades de cache
- **(alto)** **Respostas de `/proposals`** não são cacheadas → **toda** re-execução re-busca os 642
  (~12 min). Um cache local (arquivo/coleção) tornaria runs subsequentes **quase instantâneos**.
- **(alto)** **Matcher:** carregar **todos os `hash_unico` do Atlas em um `Set` (1 query)** e
  resolver o match exato **em memória** elimina ~339 `findOne` de hash.
- **(ok)** **Token JWT:** já cacheado (`_tokenCache` com expiração) ✓.

### 5. Oportunidades de processamento em lote
- **(alto) Matching em lote:** trocar `encontrarMatchesEmLote` (loop sequencial) por **1 query
  `Equipamento.find({ 'identificacao.hash_unico': { $in: [...hashes] } })`** + carregar o catálogo
  (113 docs) **uma vez** em memória para as estratégias norm/fuzzy → de ~340–1000 queries para **1–2**.
- **(médio) Extração concorrente:** os 642 fetches são sequenciais; **concorrência controlada**
  (ex.: 5 em paralelo) respeitando 60 req/min reduziria a espera ociosa — limitado pelo teto da API.
- **(baixo)** Filtro/normalização já são em lote e baratos.

### 6. Gargalo principal
**A extração — 642 chamadas sequenciais a `/proposals` com `sleep(1100 ms)` ≈ 12 min.** É
**imposto pelo rate-limit da API (60 req/min)**, não por ineficiência de código: 642 ÷ 54/min ≈
12 min é o **piso teórico por execução**. O gargalo **secundário e evitável** é o **matching
item-a-item** (~340–1000 queries remotas onde **1–2** bastariam).

### 7. Ganho estimado caso otimizado
| Otimização | 1ª execução | Execuções subsequentes |
|---|---|---|
| **Matching em lote** (`$in` + catálogo em memória) | −30 a 80 s (~5–10% do total) | idem |
| **Cache de `/proposals`** | sem ganho (1ª busca obrigatória) | **~12 min → segundos (~99%)** |
| **Concorrência controlada na extração** | ~12 min → ~3–5 min (se a API tolerar 60/min em rajada) | idem |

→ **1ª execução:** ganho **limitado (~10–20%)** — dominada pelo rate-limit irredutível.
**Execuções repetidas (dry-runs, re-imports):** ganho **~95–99%** com **cache de propostas** +
**matching em lote**. **Recomendação de maior ROI:** (1) **cache local das propostas** e (2)
**matcher em lote** — ambos transformam o ciclo de dry-run de ~12 min para **segundos**.

### Conclusão
O pipeline é **I/O-bound**: **>90% do tempo é espera de rate-limit da API SolarMarket** (642
fetches × 1,1 s). O processamento (normalizer/dedup) é trivial. As duas alavancas de maior
impacto são **cache das respostas de `/proposals`** (elimina a re-busca em runs repetidos) e
**matching em lote** (de ~340–1000 queries para 1–2). Nenhuma alteração foi feita (read-only);
o dry-run em execução não foi tocado.
