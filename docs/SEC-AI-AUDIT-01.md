# SEC-AI-AUDIT-01 — Auditoria da camada de IA e segredos

> Auditoria com evidência. Nenhum valor de segredo é reproduzido neste relatório.

## FASE 1 — Variável Claude

**Qual variável o código procura:** `ANTHROPIC_API_KEY` (grafia correta, com **H**).

| Arquivo | Função | Linha | Uso |
|---------|--------|------:|-----|
| `backend/src/controllers/datasheetController.js` | `extrairComClaude` | 186 | `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })` |
| `backend/src/controllers/datasheetController.js` | `extrairDatasheet` | 603 | `if (process.env.ANTHROPIC_API_KEY)` (gate) |
| `backend/src/controllers/datasheetController.js` | `extrairDatasheet` | 632 | warning "ANTHROPIC_API_KEY não configurada" |
| `backend/src/controllers/datasheetController.js` | `diagnosticoIA` | 709-712 | endpoint de teste |
| `backend/src/controllers/equipamentosController.js` | `analisarImagemComClaude` | 320 | `new Anthropic()` (SDK lê `ANTHROPIC_API_KEY` do env automaticamente) |
| `backend/.env.production.example` | — | — | documenta `ANTHROPIC_API_KEY=...` |

**Coincide com o Railway?** O usuário relata a variável do Railway como
**`ANTROPIC_API_KEY`** (sem o **H**). O código lê **`ANTHROPIC_API_KEY`**.
**→ Os nomes NÃO coincidem (falta o "H").** Se o Railway tiver apenas a versão
sem H, `process.env.ANTHROPIC_API_KEY` é `undefined` em runtime.

**Lida corretamente em runtime?** A leitura no código está correta; a questão é o
**nome** da variável no ambiente. Evidência adicional importante:

- A mensagem exata da UI — `"Claude: Chave da API inválida ou sem permissão"` — é
  produzida **somente** em `datasheetController.js:616-621`
  (`err.status === 401` → `avisosClaude.push(\`Claude: ${motivo}\`)`), e esse trecho
  só é alcançado quando `process.env.ANTHROPIC_API_KEY` é **truthy** (gate da L603)
  **e** a Anthropic responde **HTTP 401**.
- Portanto há duas leituras possíveis, e elas são mutuamente exclusivas:
  - **(a) Nome errado** (`ANTROPIC_API_KEY`): a L603 seria falsa → a UI mostraria
    *"Chave Claude não configurada — leitura por parser de texto"* (L633), **não** o 401.
  - **(b) Valor inválido**: `ANTHROPIC_API_KEY` existe (truthy) porém a chave é
    inválida/revogada/sem acesso → **401** → é exatamente a mensagem observada.
- **Conclusão honesta:** se a UI mostra literalmente o texto do 401, o código prova
  que `ANTHROPIC_API_KEY` **está setado** em runtime e a **chave é rejeitada (401)**.
  Se, ao contrário, a única variável no Railway for `ANTROPIC_API_KEY` (sem H), a
  mensagem deveria ser a de "não configurada". **A causa exata (nome vs valor) é
  `CAUSA NÃO COMPROVADA` sem o runtime do Railway** — ver FASE 2 para o teste decisivo.

## FASE 2 — Teste real da chave

**Endpoint embutido decisivo:** `GET /api/datasheet/diagnostico-ia`
(`datasheetController.js:708-722`, rota em `routes/datasheet.js:22`). Ele:
- retorna `{ok:false, motivo:'ANTHROPIC_API_KEY não configurada'}` se ausente;
- caso contrário chama a Anthropic e retorna `{ok, resposta|motivo, chave_prefixo}`.

**Detalhes da chamada Anthropic:**
- **Endpoint/SDK:** `@anthropic-ai/sdk` → `client.messages.create` (Messages API).
- **Modelo (extração real):** `claude-3-5-sonnet-20241022` (`datasheetController.js:189`).
- **Modelo (diagnóstico):** `claude-haiku-4-5-20251001` (`datasheetController.js:714`)
  — **divergente** do de extração. Um teste de chave que use modelo diferente pode
  passar/falhar por **acesso a modelo**, não por validade da chave. Recomenda-se
  alinhar o modelo do diagnóstico ao de produção.

**Resultado do teste local:** `ANTHROPIC_API_KEY` **não está setado neste ambiente
de desenvolvimento** (verificado de forma mascarada; `set: false`). Logo o teste
real **só pode ser executado no Railway**, via `GET /api/datasheet/diagnostico-ia`.
- **sucesso/falha/motivo aqui:** não executável (sem chave local) → `CAUSA NÃO
  COMPROVADA` localmente. O endpoint acima dá a prova definitiva em produção.

> Observação de segurança: `diagnosticoIA` devolve `chave_prefixo` (primeiros 10
> chars). Para `sk-ant-…` isso é só o prefixo público, mas convém reduzir/remover.

## FASE 3 — Mapa de providers

| Provider | Onde lê a chave | Módulo / uso | Evidência |
|----------|-----------------|--------------|-----------|
| **Claude (Anthropic)** | `ANTHROPIC_API_KEY` | **Datasheets de módulos e inversores** (OCR/extração) | `datasheetController.js:186,603` |
| Claude (Anthropic) | env (SDK) | Análise de imagem de datasheet | `equipamentosController.js:320` |
| Claude (Anthropic) | `ANTHROPIC_API_KEY` | EV (carregador) — **DEPRECATED** | `controllers/_deprecated/carregadorEVController.js:93` |
| **Gemini (Google)** | `GOOGLE_API_KEY` | **Parecer de acesso** | `pareceracessoController.js:28-33` |
| Gemini (Google) | `GOOGLE_API_KEY` | **Equipamentos (visão/datasheet via Gemini)** | `equipamentosController.js:398-404` |
| Gemini (Google) | header `x-gemini-key` ou env | **Fatura/conta de luz** | `faturaController.js:41-95` |
| **OpenAI** | n/d (sem chave server) | Apenas **referenciado** em UI/integrações (catálogo de provedores, `aiService`, modelo `ApiKey`) | `frontend/src/utils/aiService.js`, `routes/integrations.js`, `models/ApiKey.js` |

- **Baterias / Homologação:** sem provider de IA dedicado encontrado no código
  (homologação usa `routes/homologacao.js` sem chamada a IA). → para esses dois,
  **"não há provider de IA" é a conclusão por ausência de evidência**.
- **OpenAI não tem caminho de execução server-side** (nenhuma `new OpenAI()` /
  `OPENAI_API_KEY` em uso); aparece só como opção de integração/config.

## FASE 4 — Auditoria de segredos (arquivos rastreados no git)

| Segredo | Arquivo(s) | Linha | Classe | Status |
|---------|-----------|------:|--------|--------|
| **MongoDB Atlas** `forte-solar:<senha>@cluster0` | `backend/scripts/legacy/import-*.js` (5), `migrate-to-mongodb*.js` (2), `backend/migrate_final.py`, `import_to_atlas*.py` (2), `import_with_dns.py`, `WHITELIST_IP_INSTRUCTIONS.md`, `backend/.env.development` (comentado) | várias | **CRÍTICO** | exposto no repo e no histórico; legacy não é importado pelo server |
| **Google Gemini API key** `AIzaSyAHEzC…` | `GEMINI_PARECER_IMPLEMENTATION.md:213`, `GOOGLE_GEMINI_SETUP.md:45`, `RESUMO_SESSAO_LIMPEZA_2026_05_12.md:106`, `backend/scripts/legacy/list-models.mjs:1` | — | **CRÍTICO** | chave server (faturável) exposta em docs/scripts |
| **Google Maps API key** `AIzaSyDpn…` | `frontend/.env.development:2`, `frontend/.env.production:4` | — | **MÉDIO**¹ | chave de cliente (vai ao browser por design) |
| **Segredos de app** `ENCRYPTION_KEY`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_API_KEY` | `backend/.env.development` | — | **ALTO** | `.env.development` estava **rastreado** no git |

¹ Maps key é inerentemente pública (embutida no bundle). Risco real = **billing/abuso**
se não houver restrição de **referrer/domínio** e de **APIs** no Google Cloud Console.

## FASE 5 — Remediação aplicada (sem quebrar produção)

**Aplicado neste commit (zero impacto em produção — scripts legacy não são
importados pelo `server.js`; docs são documentação):**
1. **Redação** dos dois segredos vivos (senha Mongo e Gemini key) em **16 arquivos
   rastreados** (código legacy + docs) → substituídos por `REDACTED_ROTATE_VIA_ATLAS`
   / `REDACTED_ROTATE_VIA_GCP`. Verificação: `git grep` retorna **zero** ocorrências
   fora dos `.env`.
2. **Destrackeados** (mantidos em disco, já no `.gitignore`):
   `backend/.env.development` e `frontend/.env.development` (arquivos de
   desenvolvimento; não usados pelo build de produção).

**NÃO aplicado por risco a produção — RECOMENDADO ao responsável:**
3. **Rotacionar as 3 credenciais** (obrigatório — os valores continuam no histórico
   do git):
   - **MongoDB Atlas**: trocar a senha do usuário `forte-solar` no Atlas; atualizar
     `MONGODB_URI` no Railway.
   - **Gemini**: revogar a key `AIzaSy…NNSs` no Google Cloud e gerar nova em
     `GOOGLE_API_KEY` (Railway).
   - **Google Maps**: rotacionar e aplicar **restrição de referrer + APIs**.
   - Rotacionar também `JWT_SECRET`/`JWT_REFRESH_SECRET`/`ENCRYPTION_KEY`/`ADMIN_API_KEY`
     se os valores de `.env.development` foram reaproveitados em produção.
4. **`frontend/.env.production`**: mover `VITE_GOOGLE_MAPS_API_KEY` para variável de
   ambiente do Railway **antes** de destrackeá-lo (senão o build perde a key).
5. **Purga de histórico** (`git filter-repo`/BFG) após a rotação, para apagar os
   segredos dos commits antigos.
6. **Corrigir a variável Claude**: garantir que o Railway tenha exatamente
   `ANTHROPIC_API_KEY` (com H) com uma chave válida; remover a `ANTROPIC_API_KEY`
   (sem H) para evitar confusão. Validar com `GET /api/datasheet/diagnostico-ia`.

**Atividade das chaves:** não verificável neste ambiente (sem rede/credenciais e
sem realizar conexões com credenciais expostas). **Tratar as 3 como comprometidas e
rotacionar.**

---

## RELATÓRIO FINAL

1. **Variável Claude realmente usada:** `ANTHROPIC_API_KEY` (com H) — evidência:
   `datasheetController.js:186,603,709`; `equipamentosController.js:320` (SDK lê do env).
2. **Railway configurado corretamente?** O nome relatado (`ANTROPIC_API_KEY`, sem H)
   **diverge** do esperado. Corrigir para `ANTHROPIC_API_KEY`. (Prova definitiva de
   nome-vs-valor exige o runtime do Railway — FASE 2.)
3. **Chave é válida?** `CAUSA NÃO COMPROVADA` localmente (sem chave no ambiente). Se a
   UI mostra o texto do 401, o código prova que a chave está setada porém **rejeitada
   (401)** → inválida/sem permissão. Verificar via `diagnostico-ia`.
4. **Claude funcional?** Hoje **não** (a UI cai no fallback/erro). Funcional somente
   quando `ANTHROPIC_API_KEY` válido estiver no Railway.
5. **Segredos a rotacionar:** MongoDB Atlas (CRÍTICO), Gemini key (CRÍTICO), Google
   Maps key (MÉDIO), e `JWT/ENCRYPTION/ADMIN` do `.env.development` (ALTO) se reusados.
6. **Evidências:** seções FASE 1–5 acima, com arquivo/linha; verificação pós-redação
   `git grep` = 0; build ✓; `node --check` ✓; testes ✓ (45/45 nas suítes relevantes).
