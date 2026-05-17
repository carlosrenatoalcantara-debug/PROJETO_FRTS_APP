# Backend Map — Forte Solar API

> Documentação gerada na **Auditoria FASE 2** (2026-05-17).
> Snapshot do estado pós-estabilização (commit a publicar).
> **NÃO edite manualmente sem revisar `server.js`, `routes/` e `models/`.**

---

## 1. Endpoints públicos × controllers × models

| Prefixo | Arquivo de rota | Controller principal | Model(s) MongoDB | Auth |
|---|---|---|---|---|
| `/api/health` | inline em `server.js` | — | — | aberto |
| `/api/reconectar` | inline em `server.js` | — | mongoose direct | aberto |
| `/api/auth/*` | `routes/auth-security.js` | inline | (mock — credenciais hardcoded) | parcial (verify, logout) |
| `/api/integrations/*` | `routes/integrations.js` | inline | `ApiKey` + `integrationsMemoryStore` | **🔐 sim** |
| `/api/calculadora` | `routes/calculadora.js` | inline | `Lead` (legacy) | aberto |
| `/api/carregadores-ev` | `routes/carregadoresEV.js` | `carregadorEVControllerGemini.js` | `CarregadorEV` | aberto |
| `/api/dashboard` | `routes/dashboard.js` | inline | múltiplos (Cliente, ProjetoFV, ProjetoEV) | aberto |
| `/api/clientes` | `routes/clientes.js` | `clientesController.js` | `Cliente` | aberto |
| `/api/projetos-fv` | `routes/projetosFV.js` | `projetosFVController.js` | `ProjetoFV` | aberto |
| `/api/projetos-fv/:id/homologacao` | `routes/homologacao.js` | `homologacaoController.js` | `ProjetoFV` (subdoc) | aberto |
| `/api/projetos-fv/:id/proposta` | `routes/proposta.js` | `propostaController.js` | `ProjetoFV` (subdoc) | aberto |
| `/api/projetos-fv/:id/beneficiarias` | `routes/beneficiarias.js` | `beneficiariasController.js` | `UnidadeBeneficiaria` | aberto |
| `/api/projetos-ev` | `routes/projetosEV.js` | `projetosEVController.js` | `ProjetoEV`, `CarregadorEV` | aberto |
| `/api/upload` | `routes/upload.js` | inline | — | aberto |
| `/api/equipamentos` | `routes/equipamentos.js` | `equipamentosController.js` | `Equipamento` | aberto |
| `/api/engenharia` | `routes/engenharia.js` | inline | — | aberto |
| `/api/string` | `routes/string.js` | `stringController.js` | — | aberto |
| `/api/carga` | `routes/carga.js` | inline | — | aberto |
| `/api/bess` | `routes/bess.js` | inline | — | aberto |
| `/api/financeiro` | `routes/financeiro.js` | inline | — | aberto |
| `/api/orcamento` | `routes/orcamento.js` | `orcamentoController.js` | — | aberto |
| `/api/crm` | `routes/crm.js` | inline | `CrmLead`, `CrmColuna`, `CrmFunil` | aberto |
| `/api/projeto` | `routes/projeto.js` | `projetoController.js` | múltiplos | aberto |
| `/api/recomendacao` | `routes/recomendacao.js` | `recomendacaoController.js` | — | aberto |
| `/api/decisao` | `routes/decisao.js` | inline | — | aberto |
| `/api/datasheet` | `routes/datasheet.js` | `datasheetController.js`, `datasheetGeminiUnificado.js` | `DatasheetCache`, `Equipamento` | aberto |
| `/api/admin` | `routes/admin.js` | `adminController.js` | múltiplos | aberto (⚠️) |
| `/api/unifilar` | `routes/unifilar.js` | `unifilarController.js` | `ProjetoFV` | aberto |
| `/api/irradiancia` | `routes/irradiancia.js` | inline | `irradianciaRN.js` (estático) | aberto |
| `/api/fatura` | `routes/fatura.js` | `faturaController.js` | — (PDF/IMG via Gemini) | aberto |
| `/api/parecer-acesso` | `routes/pareceracesso.js` | `pareceracessoController.js` | `ProjetoFV` | aberto |

---

## 2. Models × Schema status

| Model | Coleção (MongoDB) | Status | Notas |
|---|---|---|---|
| `ApiKey` | `apikeys` | ativo | Usa AES-256-GCM. Schema `{keyId, userId, integrationName, encrypted: {iv, encryptedData, salt}, isActive, rotationDueAt, ...}` |
| `CarregadorEV` | `carregadorevs` | ativo (56 docs) | Schema enum AC_Mono/AC_Tri/DC. **Coexistência com `Equipamento.tipo='carregador_ev'` — dupla fonte da verdade — ver §5** |
| `Cliente` | `clientes` | ativo | Usado por: projetos FV/EV, CRM, propostas |
| `CrmColuna` | `crmcolunas` | ativo | Novo CRM (kanban-style) |
| `CrmFunil` | `crmfunis` | ativo | Funis de venda |
| `CrmLead` | `crmleads` | ativo | Novo modelo de lead |
| `DatasheetCache` | `datasheetcaches` | ativo | Cache de extração Gemini/Vision |
| `Empresa` | `empresas` | ativo | Configuração da empresa |
| `Equipamento` | `equipamentos` | ativo (192 docs) | Enum `tipo`: modulo, inversor, estrutura, bateria, **carregador_ev** |
| `Lead` | `leads` | **legacy** | Usado apenas por `routes/calculadora.js`. Candidato a remoção quando `CrmLead` o substituir |
| `ProjetoEV` | `projetoevs` | ativo | Agora com campo `diagrama_editado` + `strict: false` |
| `ProjetoFV` | `projetofvs` | ativo | Schema grande, inclui homologação, proposta, beneficiárias |
| `UnidadeBeneficiaria` | `unidadebeneficiarias` | ativo | Subordinada a ProjetoFV |

---

## 3. Camada de segurança (`backend/src/security/`)

| Módulo | Função |
|---|---|
| `encryption.js` | AES-256-GCM. **Requer `ENCRYPTION_KEY` em env**. Construtor lança erro se ausente |
| `jwt.js` | JWT access (15min) + refresh (7d). Default secrets se env ausente (não falha) |
| `api-key-service.js` | Wrapper de criação/rotação/validação de chaves de integração |
| `audit-logger.js` | Log estruturado em `src/logs/audit.log`. Construtor cria diretório |
| `validation.js` | DOMPurify + validação de email/senha |
| `auth-middleware.js` | `authenticateToken`, `createRateLimiter`, `auditLogger` (middleware) |
| `security-headers.js` | Helmet, HSTS, CSP via `setupSecurityHeaders(app)` |
| `index.js` | Re-export central de tudo |

**Atenção:** `auth-security.js` antes instanciava `EncryptionService` no topo do módulo, causando crash em Railway sem `ENCRYPTION_KEY`. Corrigido em commit `29140fa`.

---

## 4. Memory storage (fallback quando MongoDB offline)

| Arquivo | Função |
|---|---|
| `config/memoryStorage.js` | Storage geral (Cliente, Equipamento, ProjetoFV, ProjetoEV) — persiste em `data/memory-storage.json` |
| `config/integrationsMemoryStore.js` | Storage de chaves de API — persiste em `data/api-keys.json` |

Trigger: `mongoose.connection.readyState !== 1` em qualquer controller que implemente fallback.

**Controllers com fallback implementado:**
- `clientesController.js`
- `equipamentosController.js`
- `projetosEVController.js`
- `projetosFVController.js` (parcial)
- rotas inline: `integrations.js`

**Controllers SEM fallback** (assumem MongoDB sempre):
- `carregadoresEV.js` (rota direta, sem fallback)
- `crm.js`
- `dashboard.js`
- demais controllers menores

---

## 5. Dupla fonte de verdade: carregadores EV

⚠️ **Inconsistência arquitetural conhecida** (não resolvida na FASE 2A/2B):

```
MongoDB:
├── equipamentos (col)
│   └── tipo='carregador_ev'  → 77 docs   (acessível via /api/equipamentos?tipo=carregador_ev)
│
└── carregadorevs (col)        → 56 docs   (acessível via /api/carregadores-ev)
```

**Quem usa cada uma:**
| Consumidor | Endpoint | Coleção |
|---|---|---|
| Frontend `pages/CarregadoresEV.jsx` | `/api/equipamentos?tipo=carregador_ev` | `equipamentos` (77) |
| Frontend `pages/NovaPropostaEV.jsx` (relacionamento) | `/api/carregadores-ev` | `carregadorevs` (56) |
| Backend `projetosEVController` (cálculos NBR) | depende do caminho | ambas |

**Decisão pendente (FASE 2C):**
- (a) Migrar tudo para `Equipamento.tipo='carregador_ev'` e remover model `CarregadorEV`
- (b) Manter `CarregadorEV` como source-of-truth e remover o tipo `carregador_ev` da enum de Equipamento

---

## 6. Scripts utilitários

| Localização | Conteúdo |
|---|---|
| `backend/scripts/legacy/` | 37 scripts movidos da raiz na FASE 2B: importadores, migradores, testes de conexão, limpeza de duplicatas. **Não executar sem auditoria — vários contêm `deleteMany()`/`drop()`** |
| `backend/src/controllers/_deprecated/` | `carregadorEVController.js` (antigo, Anthropic Claude Vision). Substituído por `carregadorEVControllerGemini.js` (Gemini + regex) |
| `backend/src/seeds/initial.js` | **Destrutivo** — `deleteMany` em Cliente, Empresa, Equipamento. Bloqueado em produção (`NODE_ENV=production`) e requer `SEED_CONFIRM=YES` para rodar |
| `backend/src/seeds/crmInitialData.js` | **Idempotente** — só cria se coleções vazias. Roda automaticamente no startup |

---

## 7. Variáveis de ambiente (Railway / .env)

| Variável | Obrigatória? | Notas |
|---|---|---|
| `MONGODB_URI` | sim para prod | Atlas SRV URI |
| `ENCRYPTION_KEY` | **CRÍTICA em prod** | Sem ela, crashes em rotas que instanciam EncryptionService |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | opcional | Há defaults inseguros para dev |
| `PORT` | recomendado | Padrão 5001 |
| `USE_MEMORY_STORAGE` | opcional | `true` → ignora MongoDB e força memory storage |
| `SKIP_MONGODB_RETRIES` | opcional | `true` → apenas 1 tentativa de conexão |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | opcional | Para Gemini Vision (fatura/datasheets). Frontend pode passar via `X-Gemini-Key` header |
| `ANTHROPIC_API_KEY` | opcional | Para Claude Vision (em rotas legadas) |
| `ALLOWED_ORIGINS` | opcional | CORS em produção |
| `RATE_LIMIT_ATTEMPTS` / `RATE_LIMIT_WINDOW_MS` | opcional | Rate limiting |
| `MAX_REQUEST_SIZE` | opcional | Default 50mb |

---

## 8. Health & diagnóstico

```bash
# Status geral + MongoDB
curl https://projetofrtsapp-production.up.railway.app/api/health

# Contagem de equipamentos por tipo (debug)
curl https://projetofrtsapp-production.up.railway.app/api/equipamentos/debug/status

# Reconectar MongoDB manualmente
curl https://projetofrtsapp-production.up.railway.app/api/reconectar
```

**mongodbState (mongoose readyState) — mapeamento correto:**
- `0` → desconectado
- `1` → conectado
- `2` → conectando
- `3` → desconectando

(O label estava invertido até o commit da FASE 2A; agora reflete o valor real.)

---

## 9. Riscos remanescentes

| ID | Risco | Mitigação prevista |
|---|---|---|
| CR-5 | Dupla fonte de carregadores | FASE 2C (decisão arquitetural) |
| CR-7 | Sem `ProtectedRoute` no frontend | FASE 2C |
| CR-8 | 28/30 rotas backend abertas | FASE 2C |
| CR-11 | `Lead.js` (legacy) coexistindo com `CrmLead` | FASE 2C — só após validar que calculadora pode migrar |
| CR-12 | Login mockado (credenciais hardcoded) | FASE 2C — integrar com User real ou OAuth |
| CR-13 | Controllers sem fallback assumem MongoDB online | Já mitigado pelo Atlas estar estável; revisar se cair |

---

_Documento mantido por: auditoria automatizada — atualizar a cada commit que toque `routes/`, `models/` ou `controllers/`._
