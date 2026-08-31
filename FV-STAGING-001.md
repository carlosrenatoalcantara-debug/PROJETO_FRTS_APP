# FV-STAGING-001 — arquitetura e provisionamento do ambiente web de QA

Produzido pela **FV-INFRA-059**. Complementa `FV-QA-BASELINE-001.md` (a matriz a
ser executada depois) e o §8/§9 de `FV-ESTADO-COMPACTADO.md`.

Nada aqui foi publicado. Este documento é o que falta **executar com credenciais
que o repositório não tem**, e o que o repositório já garante sozinho.

---

## 1 · Topologia

```
  navegador
     │
     ▼
┌─────────────────────────┐     VITE_API_URL (absoluta, no bundle)
│  FRONTEND STAGING       │ ─────────────────────────────────────┐
│  Vercel · projeto QA    │                                      │
│  build:staging          │   SEM rewrite de /api                │
│  vercel.staging.json    │   (o de produção proxia p/ Railway)  │
└─────────────────────────┘                                      │
                                                                 ▼
                                                  ┌─────────────────────────┐
                                                  │  API STAGING            │
                                    CORS ◄────────│  Railway · serviço QA   │
                              allowlist exata     │  APP_AMBIENTE=staging   │
                              vinda de APP_URL    │  APP_URL=<frontend QA>  │
                                                  └─────────────────────────┘
                                                                 │
                                            exigirBancoDeQa      │ MONGODB_URI
                                            recusa produção      ▼
                                                  ┌─────────────────────────┐
                                                  │  MONGODB QA             │
                                                  │  Atlas · cluster/base   │
                                                  │  nome contém `staging`  │
                                                  └─────────────────────────┘

  PRODUÇÃO permanece intocada e inalcançável a partir deste caminho.
```

### Por que estas três separações existem

| Separação | Sem ela | Garantida por |
|---|---|---|
| Bundle de staging × produção | `npm run build` gera frontend que fala com a API real — **medido na FV-QA-057** | `build:staging` + `verificar-bundle.mjs` |
| CORS por origem exata | `https://localhost.dominio-malicioso.com` lia respostas autenticadas | `config/origens.js` |
| Banco de QA × Atlas de produção | `backend/.env` carrega URI de produção; um staging sem URI própria escreveria na base real | `config/bancoQa.js` + guarda em `conectarBD` |

---

## 2 · O que o repositório já garante

Verificado nesta sprint, sem provisionar nada:

| Barreira | Comportamento | Prova |
|---|---|---|
| CORS | recusa `localhost.evil`, `outro.com` e até a origem de produção quando não declarada | curl contra o servidor em modo staging |
| `APP_URL` | staging/produção **não sobem** sem ela | `origemPublica()` lança `ORIGEM_NAO_CONFIGURADA` |
| Link público | nasce de uma fonte única, resolvido na chamada | `infraOrigens.check.js` §4/§5 |
| Banco no boot | `APP_AMBIENTE=staging` + URI de produção → **processo aborta** | executado: `BANCO_DE_PRODUCAO` |
| Banco em scripts | seed recusa URI que não se declare de teste | `exigirBancoDeQa` |
| Bundle | build de staging com origem de produção → **falha** | `verificar-bundle.mjs` |
| SPA fallback | `/fv/...` e `/proposta/...` servem `index.html` | preview: HTTP 200 nas 4 rotas |
| Segredo em log | URI mascarada (`mongodb://***@host/base`) | `mascararUri` |

**Preflight:** `node backend/scripts/preflight-staging.mjs` reúne tudo isso e
devolve exit ≠ 0 enquanto o ambiente não estiver coerente.

---

## 3 · Os cinco bloqueios — runbook

Os cinco exigem **contas externas**. Nenhum pode ser executado a partir do
repositório, e nenhum foi executado.

### 3.1 · Frontend de staging

| | |
|---|---|
| Plataforma | Vercel — projeto **novo**, separado do de produção |
| Build Command | `npm run build:staging` |
| Root Directory | `frontend` |
| Config | usar `vercel.staging.json` (SPA fallback, **sem** rewrite de `/api`) |
| Env do projeto | nenhuma — o build lê `frontend/.env.staging` |
| Proteção | ativar Vercel Password Protection ou Preview-only |
| Saída | a URL — anote como `<FRONTEND_QA>` |

⚠️ Não reaproveitar o projeto de produção. O `vercel.json` da raiz do frontend
reescreve `/api/*` para o Railway **de produção**.

### 3.2 · Backend de staging

| | |
|---|---|
| Plataforma | Railway — serviço **novo** |
| Start | `Procfile` já existente (`cd backend && npm start`) |
| Health | `GET /api/health` |
| Saída | a URL — anote como `<API_QA>` |

Variáveis obrigatórias:

```
APP_AMBIENTE=staging
APP_URL=<FRONTEND_QA>
MONGODB_URI=<URI do cluster QA, base com "staging" no nome>
JWT_SECRET=<48+ caracteres, PRÓPRIO de staging>
SMTP_USER=
SMTP_PASS=
NODE_ENV=production        # runtime; APP_AMBIENTE é que decide o comportamento
```

Opcionais: `CORS_ORIGENS` (origens extras), `ANTHROPIC_API_KEY` e
`SOLARMARKET_API_KEY` **próprias de staging** — sem elas os recursos
correspondentes ficam inativos, o que é aceitável para a matriz FV.

`SMTP` vazio é deliberado: nenhum e-mail sai do ambiente de teste. A FV-UX-035
enviou dois e-mails reais por causa de credencial de produção carregada em teste.

### 3.3 · MongoDB de QA

| | |
|---|---|
| Onde | Atlas — cluster novo, ou base separada num cluster que **não** seja o de produção |
| Nome da base | **precisa conter** `staging`, `qa`, `homolog` ou `teste` — é o que a guarda reconhece |
| Network Access | liberar o egress do Railway de staging |
| Usuário | credencial própria, escopo apenas nessa base |

Semear: `MONGODB_URI=<URI QA> node backend/scripts/seed-catalogo-fv-ux-027.mjs`
(51 inversores + Znshine 650 W). A URI é validada antes de conectar.

Reset: apagar a base e semear de novo. **Nunca** backfill de produção.

Projetos de QA: prefixo `QA-` no nome, para separá-los de qualquer coisa.

### 3.4 · Secrets de staging

| Segredo | Origem | Nunca |
|---|---|---|
| `JWT_SECRET` | gerar novo (`openssl rand -base64 48`) | reaproveitar o de produção |
| `MONGODB_URI` | usuário próprio da base de QA | usuário de produção |
| `ANTHROPIC_API_KEY` | chave própria com limite baixo | a de produção |
| `SOLARMARKET_API_KEY` | chave própria, se necessária | a de produção |
| `SMTP_*` | **vazios** | qualquer credencial real |

### 3.5 · Rotação da chave do Google Maps — **ação manual pendente**

`frontend/.env.production` está **versionado** e contém
`VITE_GOOGLE_MAPS_API_KEY`. A chave está no histórico do Git; trocar o conteúdo
do arquivo não a remove de lá.

Sequência correta, **fora do repositório**:

1. Google Cloud Console → criar chave **nova** para produção, com restrição de
   referrer para o domínio de produção;
2. atualizar a variável no provedor de produção;
3. **revogar** a chave antiga;
4. criar uma **terceira** chave, restrita ao domínio de staging, para
   `frontend/.env.staging`;
5. só então `git rm --cached frontend/.env.production` — o `.gitignore` já cobre
   o caminho, o arquivo é que entrou antes.

Não alterei o arquivo: mudar o valor quebraria os mapas em produção e **não**
resolveria a exposição, que é histórica.

---

## 4 · Sequência de publicação

Cada passo só começa quando o anterior passou.

```
1. Atlas: criar base de QA (nome com "staging") + usuário + network access
2. Railway: criar serviço, definir as variáveis do §3.2
3. Verificar:  GET <API_QA>/api/health  →  200
4. Semear:     MONGODB_URI=<QA> node backend/scripts/seed-catalogo-fv-ux-027.mjs
5. Preencher frontend/.env.staging com <API_QA>/api e a chave de staging
6. npm run build:staging          →  precisa terminar em "OK — bundle coerente"
7. Vercel: criar projeto, publicar com vercel.staging.json
8. Voltar ao Railway e ajustar APP_URL=<FRONTEND_QA>  (só existe depois do 7)
9. node backend/scripts/preflight-staging.mjs  com o ambiente de staging → exit 0
10. Validar isolamento — §5
```

O passo 8 é circular por natureza: o CORS do backend depende da URL do frontend,
que só existe depois de publicado. Publique o frontend, pegue a URL, ajuste a
variável, aguarde o redeploy do backend.

---

## 5 · Validação de isolamento — antes de qualquer teste funcional

| # | Verificação | Esperado |
|---|---|---|
| 1 | `GET <API_QA>/api/health` | `200` |
| 2 | `curl -H "Origin: <FRONTEND_QA>" <API_QA>/api/health` | devolve `Access-Control-Allow-Origin` |
| 3 | `curl -H "Origin: https://localhost.evil.io" …` | **sem** cabeçalho |
| 4 | `curl -H "Origin: https://projeto-frts-app.vercel.app" …` | **sem** cabeçalho — produção não fala com staging |
| 5 | bundle publicado | não contém `fortesolar.com.br` nem `railway.app` de produção |
| 6 | login no frontend de staging | funciona |
| 7 | criar projeto `QA-isolamento-01` | aparece **só** na base de QA |
| 8 | contagem de documentos na base de produção | **não conferir** — produção proibida |
| 9 | enviar uma proposta | o link gerado começa com `<FRONTEND_QA>`, nunca `localhost` |
| 10 | abrir `<FRONTEND_QA>/fv/projetos/<id>/unifilar` direto na barra | carrega, sem 404 |

O item 9 é o que fecha o defeito `:5173` medido na FV-QA-056 — e só pode ser
comprovado num ambiente publicado.

---

## 6 · Checklist de corte

- [x] CORS por allowlist exata
- [x] fonte única da origem pública
- [x] `APP_URL` obrigatória em staging/produção
- [x] `build:staging` separado, com verificação de bundle
- [x] SPA fallback validado
- [x] guarda de banco nos **scripts** (FV-INFRA-058)
- [x] guarda de banco no **boot** (FV-INFRA-059)
- [x] preflight de ambiente
- [ ] `<FRONTEND_QA>` provisionado
- [ ] `<API_QA>` provisionado
- [ ] base de QA criada e semeada
- [ ] secrets de staging emitidos
- [ ] chave do Google Maps rotacionada e `.env.production` destrackeado
- [ ] validação de isolamento §5 executada

---

## 7 · Mudança de contrato para PRODUÇÃO

A FV-INFRA-058 tirou `https://projeto-frts-app.vercel.app` de dentro do código.
O próximo deploy de produção **precisa** definir:

```
APP_URL=https://projeto-frts-app.vercel.app
```

Sem essa variável, o backend de produção não sobe (fail-closed) — e se subisse
com `NODE_ENV` fora de `production`, recusaria o CORS do frontend atual. Isso é
deliberado, mas **precisa ser feito antes**, não durante.
