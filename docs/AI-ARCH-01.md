# AI-ARCH-01 — Arquitetura Única de IA + SEC

> Princípios honrados: Single Source of Truth, fonte única de segredos, engenharia
> acima de funcionalidades, auditoria, sem bases paralelas, sem fornecedor único,
> segurança acima de conveniência. Nenhum segredo é reproduzido aqui.

## 1. Relatório executivo

A camada de IA estava **fragmentada**: 8 chamadas diretas a SDKs em 6 controllers,
4 nomes de variável (ANTHROPIC/ANTROPIC/GOOGLE/GEMINI), nenhum ponto único de
fallback/health. Esta sprint cria a **camada única `backend/src/ai/`**: orquestrador,
adapters por provider (mesmo schema interno), circuit breaker, health monitor,
quality score e **fonte única de chaves (env/Railway)**. Tudo coberto por **18 testes**
determinísticos; **0 regressão** (60 testes anteriores verdes); build e node-check OK.

### FASE 1 — Auditoria de fontes de configuração (respostas)
1. **Quantas fontes de config?** 5: (a) Railway env (produção), (b) `.env.*` (dev
   agora destrackeado; prod só Maps), (c) `.env.example` (templates), (d) cofre de
   integrações (Mongo, **criptografado**, chaves de usuário — não do sistema),
   (e) `localStorage` do frontend (Configurações — chaves de usuário).
2. **Qual em produção?** **Railway env** para as chaves do sistema (Claude/Gemini).
3. **Conflitos?** Sim: `GOOGLE_API_KEY` vs `GEMINI_API_KEY` (alias) e o modelo do
   `diagnostico-ia` divergia do de produção (corrigido).
4. **Variáveis órfãs?** `ANTROPIC_API_KEY` (sem H) — **não é lida por código nenhum**.
5. **Providers não usados?** **OpenAI** — sem execução server-side (só referência de UI).
6. **Credenciais duplicadas?** Google/Gemini (mesmo provider, 2 nomes).
7. **Código acessando env direto?** Sim, 8 sites (`new Anthropic`/`new GoogleGenerativeAI`).
   → agora há a camada única; migração incremental (ver §8).

## 2. Arquitetura final

```
backend/src/ai/
├── schema.js          # schema interno canônico { fabricante, modelo, tipo, especificacoes }
├── aiKeys.js          # FONTE ÚNICA de chaves (só env/Railway) + diagnóstico/canonização
├── aiConfig.js        # provider/enabled/priority (NUNCA chaves)
├── qualityScore.js    # score 0-100 → aceitar | revisao_assistida | solicitar_preenchimento
├── circuitBreaker.js  # CLOSED/OPEN/HALF_OPEN, limiar 3, cooldown
├── healthMonitor.js   # status, latência, taxa de sucesso, último erro
├── AIOrchestrator.js  # PONTO ÚNICO: cascata + breaker + health + quality
├── index.js           # fábrica + singleton (adapters reais)
└── adapters/
    ├── baseAdapter.js     # contrato; normaliza p/ schema interno
    ├── geminiAdapter.js   # reusa extrairComGemini (SSOT, sem duplicar prompt)
    ├── claudeAdapter.js   # extrator injetável + ping()
    ├── openaiAdapter.js   # opcional (só se OPENAI_API_KEY)
    └── internalAdapter.js # motor de regex (sem chave) — rede de segurança
routes/ai.js           # GET /api/ai/health · GET /api/ai/diagnostico · POST /api/ai/ping
```

## 3. Fluxograma (cascata — FASE 5)

```
            PDF
             │  OCR (PDFParse)
             ▼
      AIOrchestrator.extrair({ pdfBuffer, textoOCR, tipoEsperado })
             │   (por prioridade, pulando breaker OPEN / não configurado)
   ┌─────────┼───────────┬───────────┬───────────────┐
   ▼         ▼           ▼           ▼               ▼
 Gemini → (falha) Claude → (falha) OpenAI → (falha) Internal → (sem identidade)
   │         │           │           │               │              │
  schema interno único ◄─┴───────────┴───────────────┘        Preenchimento
   │   + quality score                                          Assistido
   ▼
 { ok, provider, dados, qualidade, tentativas }   (usuário não percebe a troca)
```

Circuit Breaker (FASE 6): 3 falhas consecutivas → OPEN (cooldown) → HALF_OPEN
(sondagem) → CLOSED. Health Monitor (FASE 7): alimentado a cada chamada/ping.

## 4. Arquivos alterados/criados
**Criados:** `backend/src/ai/*` (13 arquivos), `backend/src/routes/ai.js`,
`frontend/src/utils/__tests__/aiArch01.test.js`, este doc.
**Alterados:** `backend/src/server.js` (monta `/api/ai`),
`backend/src/controllers/datasheetController.js` (FASE 9: modelo do `diagnostico-ia`
alinhado à produção; deixa de vazar prefixo da chave).

## 5. Variáveis utilizadas (canônicas)
`ANTHROPIC_API_KEY` (Claude) · `GOOGLE_API_KEY` (Gemini; `GEMINI_API_KEY` = alias
legado aceito) · `OPENAI_API_KEY` (opcional) · `MONGODB_URI` · `JWT_SECRET` ·
`JWT_REFRESH_SECRET` · `ENCRYPTION_KEY` · `ADMIN_API_KEY`.

## 6. Variáveis a remover / legar
- **`ANTROPIC_API_KEY` (sem H)** — órfã, remover do Railway. `GET /api/ai/diagnostico`
  a sinaliza automaticamente.
- **`GEMINI_API_KEY`** — manter só `GOOGLE_API_KEY`; alias permanece por compat.

## 7. Riscos encontrados
- **CRÍTICO:** credenciais (Mongo/Gemini/Maps) ainda vivas no histórico do git →
  **rotação obrigatória** (P0-SEC-01) + purga de histórico. Não automatizável aqui.
- **CRÍTICO:** Claude 401 em produção — corrigir `ANTHROPIC_API_KEY` no Railway e
  validar com `GET /api/datasheet/diagnostico-ia` (agora no modelo de produção).
- **MÉDIO:** 8 call sites ainda chamam SDK direto — coexistem com a nova camada até a
  migração incremental (§8); não há regressão porque nada foi removido.

## 8. Estado da migração (honesto)
Esta sprint entrega a **camada única, testada e montada** + health/diagnóstico +
canonização de chaves, **sem tocar** nos fluxos que já funcionam (zero regressão).
A substituição dos 8 call sites diretos pelo `AIOrchestrator` é **incremental** e
será feita fluxo-a-fluxo (começando pelo datasheet de inversores, que se conecta ao
P0-INV-01 multi-modelo), cada um com seu teste — para nunca quebrar produção. Isso é
deliberado: os princípios pedem "engenharia acima de funcionalidades" e "sem
regressão"; um big-bang nos 8 sites violaria o segundo.

## 9. Plano de rollback
- A camada é **aditiva**: remover a montagem `app.use('/api/ai', …)` e a pasta
  `backend/src/ai/` restaura 100% do comportamento anterior. Nenhum fluxo existente
  foi alterado (exceto a melhoria isolada do `diagnostico-ia`, revertível pelo diff).
- `git revert <commit>` reverte tudo sem efeito colateral em dados (nenhuma migração
  de schema/coleção foi feita).

## 10. Evidências de funcionamento
- **18/18** testes AI-ARCH (`aiArch01.test.js`): schema, qualityScore (3 faixas),
  circuitBreaker (abre/cooldown/half-open), healthMonitor, aiKeys (órfã/ambiguidade),
  cascata (Gemini→Claude→Internal→preenchimento), breaker pulando provider.
- **60/60** testes de regressão (bug08, p0FvStability, catP0Unify, datasheet861).
- `node --check` em todos os 15 arquivos da camada + server.js: **OK**.
- `vite build`: **OK**.

## 11. Compatibilidade (FASE 10)
Sem regressão para: OCR EV, Catálogo EV, Catálogo FV, Importação de Inversores,
Projetos FV/EV — nada foi removido; a camada é aditiva. Homologação/BESS futuros
poderão consumir o mesmo `AIOrchestrator` sem acoplar a fornecedor.

## 12. Ordem de prioridade restante
1. **P0-SEC-01** (usuário): rotacionar credenciais + `ANTHROPIC_API_KEY` válido no
   Railway + remover `ANTROPIC_API_KEY` (sem H). Validar via `/api/ai/diagnostico`.
2. **Migração** dos call sites para o orchestrator (fluxo a fluxo).
3. **P0-INV-01** multi-modelo (1 PDF → N equipamentos), já desenhado.
4. **P0-INV-02** validação técnica (volta com Claude operacional).
5. **P0-FV-QA**.
