# Relatório Executivo — Pendências P0 (Forte Solar)

> Consolida evidências de SEC-AI-AUDIT-01, INV-CAT-02-VERIFY e P0-FV-STABILITY.
> Toda afirmação tem arquivo/linha. Onde não há prova: **CAUSA NÃO COMPROVADA**.
> Nenhuma funcionalidade nova proposta. Nenhum segredo reproduzido.

---

## 1. Situação atual real do sistema

| Área | Estado | Evidência |
|------|--------|-----------|
| Persistência de inversores | ✅ Funcional | corrigido em BUG-08 (commit `c30de6f`) |
| Identificação fabricante/modelo | ✅ Funcional (multi-fabricante) | `fabricanteModeloFallback.js` |
| Catálogo de inversores — **multi-modelo** | ❌ 1 PDF → 1 inversor | `ModalNovoInversor.jsx:107-172`; `datasheetController.js:464-469,550` |
| Catálogo de inversores — **dados técnicos** | ⚠️ Condicional ao Claude | `datasheetController.js:438,466`; `Inversores.jsx:344-350` |
| Claude (IA inversores/módulos) | ❌ Falha de auth (401) em produção | `datasheetController.js:616-621` |
| Gemini (fatura/parecer) | ✅ Caminho presente | `faturaController.js`, `pareceracessoController.js` |
| Abrir/editar projeto, resumo, docs, unifilar | ✅ Corrigido | P0-FV-STABILITY (commit `93b40de`) — fixes presentes |
| Segredos no repositório | ⚠️ Redigidos; **rotação pendente** | SEC-AI-AUDIT-01 (commit `d7ab193`) |

---

## 2. Riscos críticos

1. **CRÍTICO — Credenciais vivas no histórico do git.** MongoDB Atlas e Gemini key
   continuam recuperáveis em commits antigos mesmo após redação. → rotação obrigatória.
2. **CRÍTICO — Claude inoperante em produção.** Sem Claude, inversores entram **sem
   dados técnicos** (fallback de texto = `variantes:[{}]`). Impacto direto no catálogo.
3. **ALTO — Catálogo multi-modelo quebrado.** Datasheets de série (MID15/20/25)
   geram só 1 equipamento → catálogo incompleto, dimensionamento prejudicado.
4. **ALTO — Segredos de app** (`JWT_SECRET`, `ENCRYPTION_KEY`, `ADMIN_API_KEY`)
   estiveram em `.env.development` rastreado; se reusados em produção, comprometem
   sessões e criptografia.

---

## P0-SEC-01 — Auditoria e Correção de Segurança

### Inventário de credenciais (lidas pelo código — `git grep process.env`)

**Utilizadas (segredos):**
| Variável | Uso | Arquivo |
|----------|-----|---------|
| `ANTHROPIC_API_KEY` | Claude (datasheets) | `datasheetController.js:186,603` |
| `GOOGLE_API_KEY` | Gemini (fatura, parecer, equip., unificado) | `faturaController.js:7`, `pareceracessoController.js:28`, `equipamentosController.js:398`, `datasheetGeminiUnificado.js:37` |
| `MONGODB_URI` | conexão DB | conexão Mongoose |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | auth | segurança |
| `ENCRYPTION_KEY` | cripto de integrações | segurança |
| `ADMIN_API_KEY` | rotas admin | segurança |
| `SOLARMARKET_*` (KEY/URL/TOKEN/EMAIL/PASSWORD/ENDPOINT) | importador SolarMarket | `importadores/`, `integracoes/solarmarket/` |
| `VITE_GOOGLE_MAPS_API_KEY` (frontend) | Google Maps | bundle do cliente |

**Config (não-segredo):** `NODE_ENV`, `PORT`, `FRONTEND_URL`, `ALLOWED_ORIGINS`,
`USE_MEMORY_STORAGE`, `SKIP_MONGODB_RETRIES`, `DEBUG`, `EMPRESA_*`,
`RESPONSAVEL_TECNICO`, `CREA_N`, `API_URL`, `SEED_CONFIRM`, `ATLAS_API_KEY`.

**Possivelmente não utilizadas / redundantes:**
- `GEMINI_API_KEY` — só como **alias de fallback** de `GOOGLE_API_KEY`
  (`faturaController.js:7`). Padronizar para `GOOGLE_API_KEY` único.
- `ANTROPIC_API_KEY` (sem H) — **não é lida por nenhum código**. Se existir no
  Railway, é lixo que causa confusão → remover.

### Credenciais que exigem rotação (expostas no histórico)
| Credencial | Classe | Ação |
|------------|--------|------|
| MongoDB Atlas (senha `forte-solar`) | CRÍTICO | trocar no Atlas + atualizar `MONGODB_URI` |
| Gemini key `AIzaSy…NNSs` | CRÍTICO | revogar no GCP + nova `GOOGLE_API_KEY` |
| Google Maps `AIzaSy…F6Qq0` | MÉDIO | rotacionar + restringir referrer/APIs |
| `JWT_SECRET`/`JWT_REFRESH_SECRET`/`ENCRYPTION_KEY`/`ADMIN_API_KEY` | ALTO | rotacionar se reusados em prod |

### Plano de rotação sem downtime
1. **Mongo:** criar **novo usuário** Atlas (não trocar o atual ainda) → setar novo
   `MONGODB_URI` no Railway → deploy → confirmar conexão → **só então** remover o
   usuário antigo. (Zero downtime: dois usuários válidos durante a transição.)
2. **Gemini/Maps:** gerar nova key → setar no Railway/`.env.production` → deploy →
   revogar a antiga após validar.
3. **JWT:** rotação de `JWT_REFRESH_SECRET` invalida refresh tokens (re-login). Fazer
   em janela de baixa demanda; manter `JWT_SECRET` aceitando ambos por um curto TTL
   se houver suporte; senão, comunicar re-login. `ENCRYPTION_KEY`: **cuidado** — dados
   já criptografados precisam de re-encrypt; planejar migração antes de trocar.
4. **Purgar histórico** (`git filter-repo`/BFG) **após** rotacionar tudo.

---

## P0-AI-01 — Fechamento da Auditoria de IA

1. **Provider operacional:** **Gemini** (via `GOOGLE_API_KEY`) tem caminho íntegro em
   fatura/parecer. **Claude** está com falha de auth. **OpenAI** não tem execução
   server-side (só referência de UI/integração).
2. **Provider chamado em produção (inversores):** **Claude** —
   `ModalNovoInversor.jsx:71` → `POST /api/datasheet/extrair-datasheet` →
   `datasheetController.extrairDatasheet` (Claude primário). Gemini-unificado é
   **admin-only** (`adminCatalogo.js:972`), fora do fluxo de import.
3. **Provider falhando:** **Claude** — mensagem exata da UI nasce só em
   `datasheetController.js:616-621` (`err.status===401`).
4. **Fallback funcionando?** Sim, **parcialmente**: se Claude falha, cai em
   `extrairPorTexto` (`datasheetController.js:623`) → recupera **fabricante+modelo**
   por regex, mas **NÃO** dados técnicos (inversor retorna `variantes:[{}]`, L438).
   Logo: o equipamento é cadastrado, porém **sem specs** — exatamente o sintoma real.
5. **Como validar:** `GET /api/datasheet/diagnostico-ia` (`datasheetController.js:708`).
   Retorna `{ok:false, motivo:'…não configurada'}` se a var faltar, ou `{ok, motivo,
   chave_prefixo}` após chamar a Anthropic. **Atenção:** usa modelo
   `claude-haiku-4-5-20251001` (L714), **diferente** do de produção
   `claude-3-5-sonnet-20241022` (L189) — alinhar para o teste ser representativo.

> **CAUSA NÃO COMPROVADA (nome vs valor):** se a UI mostra o texto do 401, a var
> `ANTHROPIC_API_KEY` está setada e a **chave é inválida**. Se o Railway só tem
> `ANTROPIC_API_KEY` (sem H), a mensagem deveria ser "não configurada". Decidir com
> `diagnostico-ia` no Railway.

---

## P0-INV-01 — Multi-Modelo de Inversores

### Por que 1 PDF → 1 inversor (provado)
- `normalizar()` colapsa as variantes: usa só `primeira = variantesNorm[0]` e um
  `dados.modelo` único (`datasheetController.js:464-469`). Expõe `resposta.variantes`
  só na resposta (L550), **mas** `dados.modelo` continua único.
- `ModalNovoInversor.processarItem()` lê **apenas `json.dados`**, **nunca
  `json.variantes`**, monta **1 payload** e faz **1 POST** (`:77,107-110,172`).
- Parser de texto de inversor não tem multi-modelo: retorna `variantes:[{}]` (`:438`).

### Arquitetura proposta (1 PDF → N modelos → N equipamentos)
1. **OCR:** inalterado (texto único já cobre a tabela inteira).
2. **IA (Claude):** o prompt **já pede** N variantes com `modelo_variante`
   (`datasheetController.js:108,141`). Nenhuma mudança de prompt necessária.
3. **Normalização (backend):** novo `normalizarMulti()` que devolve **uma lista**
   `[{modelo, especificacoes}...]` — uma entrada por variante (usando
   `variante.modelo_variante` + specs daquela variante), em vez de colapsar em
   `primeira`.
4. **Parser de texto (fallback):** estender `extrairPorTexto` para detectar séries
   (ex.: faixa `MID15/20/25KTL3-X`, `GW17/20/25K-DT`) e emitir N modelos — mesmo sem
   Claude. (Conservador, para não inventar modelos inexistentes.)
5. **Modal (frontend):** iterar a lista; **1 POST por modelo**, reutilizando
   `verificar-duplicata` por modelo. UI mostra "N modelos detectados".
6. **Persistência:** N documentos `Equipamento{tipo:'inversor'}` independentes
   (Single Source of Truth preservado; snapshot por equipamento).

**Arquivos a alterar:** `datasheetController.js` (normalização multi),
`ModalNovoInversor.jsx` (loop + N POST), opcional helper de séries em
`utils/catalogo/`. **Risco:** duplicatas (mitigado por `verificar-duplicata`),
variante sem `modelo_variante` (fallback ao top-level), regex de série gerando
falso-positivo (validação conservadora).

---

## P0-INV-02 — Extração Técnica Completa

`especificacoes` é `Mixed` (`Equipamento.js:99-100`) → **sem mudança de schema**.
O mapeamento de chaves modal↔normalizador está correto (sem bug de nome). A captura
depende **inteiramente do provider**:

| Campo | Extraído (Claude OK) | Extraído (fallback texto) | Persistido | Exibido |
|-------|:---:|:---:|:---:|:---:|
| potência nominal CA | ✅ | ❌ | = extraído | ✅ `Inversores.jsx:344` |
| potência FV máx (CC) | ✅ | ❌ | = extraído | ✅ |
| MPPT / strings | ✅ | ❌ | = extraído | ✅ `:347` |
| corrente (CA/CC/MPPT/Isc) | ✅ | ❌ | = extraído | ✅ |
| tensão (máx/MPPT/partida) | ✅ | ❌ | = extraído | ✅ `:348` |
| eficiência (máx/EU/CEC/MPPT) | ✅ | ❌ | = extraído | ✅ `:349` |
| peso / dimensões | ✅ | ❌ | = extraído | ✅ `:350,163-164` |
| proteções (IP/anti-ilha/surto) | ✅ | ❌ | = extraído | ✅ |

- **Campos ausentes hoje (produção):** todos os técnicos, porque o **Claude falha** e
  o fallback de texto não extrai specs de inversor.
- **Ajuste necessário:** (a) restaurar Claude; (b) opcional parser técnico de texto
  para inversores (parcial), se quiser robustez sem IA.
- **Impacto no schema:** nenhum (`Mixed`). Frontend já renderiza tudo.

---

## P0-FV-VALIDATION — Validação ponta a ponta

Os bugs históricos foram corrigidos em **P0-FV-STABILITY** (commit `93b40de`) e os
fixes **permanecem presentes** (verificado):

| Fluxo | Estado | Evidência |
|-------|--------|-----------|
| Abrir projeto salvo | ✅ | `ProjetosFV.jsx onAbrir` → `/projetos-fv/:id` |
| Editar projeto salvo | ✅ corrigido | `ProjetosFV.jsx:330` → `/projetos-fv/novo?id=` (wizard hidrata) |
| Resumo com dados recém-salvos | ✅ corrigido | `ProjetosFVDetalhes.jsx:55` `cache:'no-store'` + refetch on focus |
| Central de documentos | ✅ corrigido | mesmo refetch (mesma fonte `projeto`) |
| Unifilar vinculado ao projeto correto | ✅ corrigido | chave por `_id`/`draftId`; `chaveProjetoValida` |

- **Bugs novos encontrados:** nenhum com evidência de regressão. Recomenda-se 1 ciclo
  manual de QA (criar FV 12/30kWp + micro, salvar/fechar/reabrir) para confirmar em
  runtime — o que exige o app rodando com Mongo (fora deste ambiente).
- **Prioridade:** P2 (validação de confirmação), pois o código dos fixes está intacto.

---

## 3. Pendências P0 (resumo)

| ID | Pendência | Severidade |
|----|-----------|-----------|
| P0-SEC-01 | Rotacionar 3 credenciais + purgar histórico | CRÍTICO |
| P0-AI-01 | Corrigir auth do Claude no Railway (`ANTHROPIC_API_KEY` válido) | CRÍTICO |
| P0-INV-01 | Multi-modelo: 1 PDF → N equipamentos | ALTO |
| P0-INV-02 | Dados técnicos (resolve junto com Claude) | ALTO |
| P0-FV | QA de confirmação ponta a ponta | P2 |

## 4. Plano de execução priorizado

1. **SEC — rotação sem downtime** (usuário, nos consoles) + purga de histórico.
2. **AI — Claude operacional:** acertar `ANTHROPIC_API_KEY` no Railway; validar com
   `diagnostico-ia`; alinhar o modelo do diagnóstico ao de produção.
3. **INV-02 automático:** com Claude de volta, os dados técnicos voltam (sem código).
4. **INV-01 multi-modelo:** implementar `normalizarMulti` + loop de POST no modal
   (+ parser de série no fallback de texto).
5. **FV — QA de confirmação** manual.

## 5. Ordem recomendada de implementação

> **SEC-01 → AI-01 → (INV-02 valida sozinho) → INV-01 → FV-VALIDATION.**

Justificativa: segurança primeiro (risco vivo); Claude restaurado **destrava
INV-02 sem código**; multi-modelo (INV-01) é a maior melhoria de catálogo restante;
FV é apenas confirmação. **Nenhuma funcionalidade nova antes de fechar esses P0.**
