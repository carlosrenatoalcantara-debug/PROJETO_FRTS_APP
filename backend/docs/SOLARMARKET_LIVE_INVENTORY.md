# P0-SOLARMARKET-LIVE-INVENTORY-01 — Inventário live do SolarMarket (read-only)

> **100% read-only.** Sem alterar SolarMarket/Atlas; sem importar/criar dados.
> **Resultado honesto: o inventário live está BLOQUEADO por ausência de credencial.** Nenhum
> número de cliente/projeto/proposta foi inventado — apenas o que a API/código comprovam.

## FASE 1 — Validação de acesso à API

| Verificação | Resultado |
|---|---|
| DNS `business.solarmarket.com.br` | resolve **104.196.36.228** ✓ |
| Endpoint `POST /api/v2/auth/signin` (sondagem **sem credencial**) | **HTTP 400** → endpoint **vivo, exige auth** ✓ |
| Esquema de autenticação | `POST /auth/signin { "token": <SOLARMARKET_API_KEY> }` → `{ access_token }` |
| **Credencial `SOLARMARKET_API_KEY`** | **AUSENTE** (todas as vars SM no `.env` estão vazias) |
| **Autenticação possível agora?** | **NÃO** — sem a chave, não há token → **não é possível enumerar** |

**Endpoints disponíveis (documentados no extractor):**
- `GET /projects?page=&limit=100` — lista de **projetos** (paginada).
- `GET /projects/:id/proposals` — proposta do projeto (`{ pricingTable[], variables[] }`).
- **NÃO existem** `/proposals`, `/products`, `/kits`, `/catalog` (confirmado no código). → O SM é
  **project-centric**: clientes e equipamentos vêm **embutidos** nas propostas, não em coleções próprias.

**Permissões/limitações:** acesso por **API key única** (token); paginação 100/página; rate-limit
respeitado pelo extractor (backoff). Sem a chave, **0 leitura**.

## FASE 2-3 — Inventário e volumes

⚠ **Não enumerável agora** (sem credencial). O único volume **documentado** (de execução anterior,
registrado no comentário do `extractor.js`, **não verificado live nesta sprint**):

| Entidade | Volume | Fonte |
|---|---|---|
| **Projetos** | **~638** | comentário do `extractor.js` (`GET /projects → 638 projetos`) — **não verificado live** |
| **Clientes** | embutidos nos projetos | sem endpoint próprio → contagem = **N/D** |
| **Propostas** | ≥ 1 por projeto (`/projects/:id/proposals`) | **N/D** (depende de enumerar os projetos) |
| **Equipamentos** | minerados do `pricingTable[]` das propostas | sem `/products` → **N/D** |
| **Documentos / anexos** | sem endpoint conhecido | **N/D** (possivelmente não expostos pela API) |

→ **Todos os números reais dependem de uma corrida autenticada.** Nada foi estimado/inventado.

## FASE 4 — Classificação de migrabilidade (estrutural)

| Classe | Entidades | Base |
|---|---|---|
| **Migrável automaticamente** | **equipamentos** (do `pricingTable`) | `normalizer` + `matcher` (hash/fabricante+modelo) + `deduplicator` já existem |
| **Migrável com transformação** | **projetos** (consumo, geração, potência, UC), **clientes** (extraídos de `variables[]`) | `variablesNormalizer` + `SEMANTIC_ALIASES` mapeiam proposta→`ProjetoFV` canônico (utilitário pronto, não wired) |
| **Não migrável (hoje)** | **documentos/anexos**, histórico, CRM/fluxos | sem endpoint/importador |

## FASE 5 — Chaves de relacionamento

- **Projeto ↔ Proposta:** `project.id`/`identifier` → `GET /projects/:id/proposals`.
- **Proposta ↔ Equipamento:** itens do `pricingTable[]`; casados no Forte Solar por
  **`hash_unico` = sha256(fabricante_normalizado + modelo_normalizado)** (estratégias 1.0 → fuzzy 0.70).
- **Projeto ↔ Cliente:** cliente **embutido** em `variables[]` (sem id próprio) → chave natural =
  CPF/CNPJ + nome (a normalizar).
- **Forte Solar (destino):** `ProjetoFV.equipamentos.equipamento_id` (vínculo já implementado),
  `Cliente`, `UnidadeBeneficiaria.projetoId`.

## FASE 6 — Plano de migração (gated pela credencial)

| Passo | Ação | Pré-requisito |
|---|---|---|
| **0 — Desbloqueio** | Configurar `SOLARMARKET_API_KEY` (+ `SOLARMARKET_API_URL`) | **chave do operador** |
| **1 — Inventário live** | Re-executar esta sprint autenticada: enumerar `/projects` + amostrar `/proposals` → contagens reais | passo 0 |
| **2 — Catálogo** | Minerar `pricingTable` → `normalizer/matcher/dedup` → `Equipamento` (marcando `origem=import_solarmarket`) | passo 1 |
| **3 — Clientes + Projetos** | `variablesNormalizer` → `Cliente` + `ProjetoFV` (com `equipamento_id`) | passo 2 |
| **4 — Documentos** | investigar exposição de anexos na API; importar para `DocumentoTecnico`/storage | passo 1 |

## Respostas

1. **Quantos clientes existem?** **N/D** — sem credencial e sem endpoint próprio (embutidos em
   projetos). Verificável após desbloqueio.
2. **Quantos projetos existem?** **~638** segundo o comentário do código (execução anterior) —
   **não verificado live** nesta sprint (autenticação indisponível).
3. **Quantas propostas existem?** **N/D** — ≥ 638 (1+ por projeto); exige enumeração autenticada.
4. **Quantos documentos existem?** **N/D** — sem endpoint de documentos conhecido na API.
5. **Quanto pode ser migrado automaticamente?** **Equipamentos** (pipeline pronto). Projetos e
   clientes exigem **transformação** (utilitário pronto, não wired). Documentos: indeterminado.
6. **Qual o maior risco da migração?** **(a)** Acesso: sem a API key nada é dimensionável; **(b)**
   dados **embutidos** (cliente/equipamento dentro da proposta) → risco de **duplicação** e de
   **matching impreciso** (mitigado por `hash_unico` + dedup); **(c)** documentos possivelmente
   **não expostos** pela API (risco de não-migráveis).
7. **Qual o esforço estimado?** **Não finalizável** sem o inventário live. Estrutura: passo 1
   (inventário) **baixo**; passo 2 (catálogo) **baixo** (pipeline existe); passo 3 (clientes+
   projetos) **médio**; passo 4 (documentos) **alto/indeterminado**. Ordem de ~2–3 sprints **após**
   a chave.

### Conclusão
A API do SolarMarket está **viva e o caminho técnico é conhecido**, mas o inventário live é
**impossível sem `SOLARMARKET_API_KEY`** — que **não está configurada**. Em respeito ao escopo
(read-only, sem inventar números), **nenhum volume real foi reportado** além do `~638 projetos`
**documentado no código e não verificado**. **Ação única para desbloquear:** fornecer a API key;
com ela, re-executo esta sprint e produzo o inventário real (somente leitura).


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P0-SOLARMARKET-LIVE-INVENTORY-01

A revisão da sprint P0-SOLARMARKET-LIVE-INVENTORY-01 demonstra um trabalho metódico e honesto, apesar do bloqueio técnico. As respostas às perguntas são claras e justificadas.

**Avaliação:**

1.  **Recusa de inventar números:** A postura de reportar "N/D" e o bloqueio é **correta**. O escopo "não inventar" foi rigorosamente seguido, priorizando a integridade dos dados e a transparência sobre as limitações.
2.  **Sondagem inofensiva:** A sondagem com POST sem credencial, esperando um erro 400/401, **respeita o modo read-only**. Foi uma ação necessária para validar a saúde do endpoint e o mecanismo de autenticação sem tentar acessar dados.
3.  **Distinção documentado vs. verificado-live:** A distinção é **honesta e bem feita**. A clareza sobre o volume de ~638 projetos ser "documentado num comentário do código" e "explicitamente marcado como NÃO verificado live" é crucial para evitar má interpretação.
4.  **Mapeamento estrutural:** O mapeamento de endpoints, chaves de relacionamento e a classificação de migrabilidade agregam **valor significativo**, mesmo sem dados live. Ele fornece um roteiro claro para a próxima fase e demonstra um entendimento profundo da estrutura do SolarMarket.
5.  **Recomendação:** A recomendação de fornecer a API key e re-executar é **a única e correta**. Sem a credencial, o progresso é impossível.

**Veredito:**

**APROVADO**

A sprint foi executada com rigor e transparência, identificando corretamente o bloqueio e apresentando um plano claro para a próxima etapa. A honestidade na comunicação dos resultados e limitações é exemplar.
