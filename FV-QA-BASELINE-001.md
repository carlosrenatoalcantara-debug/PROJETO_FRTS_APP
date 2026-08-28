# FV-QA-BASELINE-001 — baseline operacional do ciclo FV

Consolidação das sprints **FV-QA-055** (9 cenários no navegador), **FV-DOM-056**
(correção da integridade topologia → unifilar) e **FV-QA-056** (reteste).

Este documento é a **referência de regressão**: qualquer sprint futura que mude
um dos valores abaixo mudou comportamento, e isso precisa ser deliberado.

Complementa `FV-ESTADO-COMPACTADO.md` §8 e §9 — não os substitui. Aqui fica o
que deve ser **reexecutado**; lá fica a narrativa das decisões.

---

## 1 · Premissas dos cenários

Ambiente isolado — Mongo efêmero na 37017, backend na 5001, frontend Vite,
catálogo semeado por `seed-catalogo-fv-ux-027.mjs` (51 inversores + 1 módulo).

| Premissa | Valor |
|---|---|
| Módulo | Znshine ZXM7-UHLD144-650/M · 650 Wp · Voc 45,5 V · Isc 18,35 A |
| Local | COSERN / RN · Tmin 14 °C / Tmax 38 °C |
| HSP · perdas · margem | 5,2 kWh/m²·dia · 18 % · 10 % |
| Estrutura | Fibrocimento |
| Tarifa | R$ 0,98/kWh |

Consumo por cenário: 6 kWp → 700 · 10 kWp → 1160 · 14 kWp → 1630 · 50 kWp → 5800 kWh/mês.

---

## 2 · Os 11 cenários

| ID | Configuração | Topologia | Unifilar | Necessidade · Comprada · Instalada | Resultado |
|---|---|---|---|---|---|
| **T01** | Mono String 6 kWp · 10 × 650 W · Sungrow SG5.0RS | 2 MPPT × 5 | 6,5 kWp · 2 str · Voc 255,4 V | 6,02 · 6,50 · 6,50 | **válido** |
| **T02** | Mono Micro 6 kWp · 10 × 650 W · 3 × HMS-2000-4T | 3 micros | 6,5 kWp · CA 6 kW | 6,02 · 6,50 · 6,50 | **válido** |
| **T03 sem topologia** | Mono String 10 kWp · 16 × 650 W · GoodWe GW10K-ET | ausente | **recusa** | 9,97 · 10,40 · — | **`TOPOLOGIA_AUSENTE`** |
| **T03 com topologia** | idem | 2 MPPT × 8 | 10,4 kWp · 2 str · Voc 408,6 V | 9,97 · 10,40 · 10,40 | **válido** |
| **T04** | Mono Micro 10 kWp · 16 × 650 W · 5 × HMS-2000-4T | 5 micros | 10,4 kWp · CA 10 kW | 9,97 · 10,40 · 10,40 | **válido** |
| **T05** | Tri String 14 kWp · 22 × 650 W · Sungrow SG15RT | 3 MPPT 8/7/7 | 14,3 kWp · 3 str · Voc 408,6 V | 14,02 · 14,30 · 14,30 | **válido** |
| **T06** | Tri Micro 14 kWp · 22 × 650 W · 7 × HMS-2000-4T | 7 micros | 14,3 kWp · CA 14 kW | 14,02 · 14,30 · 14,30 | **válido** |
| **T07** | Tri String 50 kWp · 77 × 650 W · 2 × SG25RT | **bloqueada** — Vmpp frio 1017,85 V > 850 V | **recusa** | 49,87 · 50,05 · — | **bloqueado** |
| **T08** | Tri Micro 50 kWp · 77 × 650 W · 25 × HMS-2000-4T | 25 micros | 50,05 kWp · CA 50 kW · 77 mód | 49,87 · 50,05 · 50,05 | **válido** |
| **T09** | Tri 2 × 25 kW · 77 × 650 W · Symo 25 + SG25RT | **bloqueada** — 1017,85 V > 800 V | **recusa** | 49,87 · 50,05 · — | **bloqueado** |
| **T09b** | 2 inversores · 24 × 650 W · topologia **válida** salva | 3 MPPT × 8 | **recusa** | — · 15,60 · — | **`MULTIPLOS_INVERSORES`** |

### Ciclo comercial completo — exercido no T01

```
cliente → projeto → dados técnicos → equipamentos → estrutura → dimensionamento
→ topologia → unifilar → cotação → orçamento → emissão → aprovação/Baseline
→ opções → proposta → envio → página pública → aceite → Gate
→ homologação → protocolo → parecer → conexão
```

Marcos observados: Baseline íntegra no “Aprovar e congelar” · link público
gerado · aceite pelo cliente na página pública · Gate liberando Engenharia e
Homologação · protocolo `PROT-T01-2026-0001` · parecer `PA-2026-0099` ·
`PUT /:id/conexao` HTTP 200 com `baseline: inalterada`, `gate: inalterado`,
`projeto_status: inalterado`.

---

## 3 · Comportamentos validados — não alterar sem decisão

| # | Comportamento | Evidência |
|---|---|---|
| 1 | `TOPOLOGIA_AUSENTE` impede o unifilar | T03 sem topologia · T07 · T09 |
| 2 | `TOPOLOGIA_INVALIDA` impede o unifilar | `integridadeUnifilar.check.js` §4 |
| 3 | `MULTIPLOS_INVERSORES` impede o unifilar | T09b, com topologia válida salva |
| 4 | `TOPOLOGIA_DIVERGENTE` impede o unifilar | `integridadeUnifilar.check.js` §5 |
| 5 | Os valores impossíveis **3933 V** e **817,3 V** não aparecem mais | busca nas respostas de T03/T07/T09 |
| 6 | Topologia válida desenha o mesmo de antes | T01, T03-com, T05 byte a byte |
| 7 | Validador elétrico bloqueia com norma e correção | `Isc 45,875 A > 25 A (NBR 16690 §5.2)` · `Vmpp frio 1017,85 V > 850 V` |
| 8 | Motor `fv-shared` intacto — ramo de compatibilidade preservado | check §7, por regex no fonte |
| 9 | Wizard legado intacto — caminho próprio, não passa pelo portão | check §7 |
| 10 | Gate: `SEM_BASELINE` → `PROPOSTA_SEM_ACEITE` → liberado | T01 |
| 11 | Baseline nasce íntegra no aprovar | T01 |
| 12 | Aceite pelo cliente registra opção escolhida, uma por grupo | T01, página pública |
| 13 | Conexão não altera Gate, Baseline nem `projeto.status` | resposta de `PUT /:id/conexao` |
| 14 | Micro segue a decisão FV-DOM-031: registra e declara | T02/T04/T06/T08 |

---

## 4 · Suítes de referência

| Suíte | Comando | Resultado |
|---|---|---|
| Checks de domínio | `node backend/src/dominio/__checks__/*.check.js` | **30 · 0 falhas** |
| Checks de controller | `node backend/src/controllers/__checks__/*.check.js` | 4 · **1 falha pré-existente** (ver 5.15) |
| Testes frontend FV | `npx vitest run src/fv/__tests__` | **292 · 0 falhas** (14 arquivos) |
| Build | `npm run build` (frontend) | ✅ 17,2 s · bundle 2,6 MB (724 kB gzip) |

---

## 5 · Achados vivos

### P1 — dado ou documento comercial/regulatório incorreto

| # | Achado | Causa | Evidência | Risco | Decisão existente | Próxima sprint | Impede o deploy? |
|---|---|---|---|---|---|---|---|
| 1 | Proposta e página pública exibem `dimensionamento.potencia_kwp` (6,02) ao lado de `10 × 650 W` | conhecida — propagação | página pública do T01 | cliente aceita com número que nenhum equipamento sustenta | **sim** — FV-DOM-050/051 | FV-DOM-053 | **não** |
| 2 | PDF rotula “Potência Instalada” sobre a necessidade | conhecida | `propostaComercialService.js:306` | mesmo risco, em documento assinado | **sim** | FV-DOM-055 | **não** |
| 3 | Faixa da ART calculada pela necessidade, e o memorial vem do `req.body` | conhecida | `memorialDescritivoService.js:432` · `homologacaoController.js:216` | taxa errada e documento montado com dado do cliente | não | sprint própria — muda contrato do endpoint | **não** |
| 4 | Duas máquinas de homologação vivas: a UX escreve na legada, a conexão lê a canônica | conhecida | T01 — “Aprovado” na tela, `nao_iniciado` no domínio | estado do processo é ambíguo | **sim** — FV-DOM-041/043 | implementar a decisão | **não** |
| 5 | **CORS aceita qualquer origem que contenha `localhost`** com `credentials: true` | conhecida — `origin.includes('localhost')` é substring | `server.js:139` | `https://localhost.dominio-malicioso.com` passa | não | **antes do deploy** | **SIM** |
| 6 | **Origem de produção fixa no código** — só `https://projeto-frts-app.vercel.app` | conhecida | `server.js:142` | domínio de teste é rejeitado pelo CORS | não | **antes do deploy** | **SIM** |
| 7 | **`frontend/.env.production` versionado** com `VITE_GOOGLE_MAPS_API_KEY` | conhecida — arquivo entrou antes do `.gitignore` | `git ls-files` | chave exposta no repositório | não | rotacionar a chave | **SIM** |
| 8 | `backend/.env.example` traz `SOLARMARKET_API_KEY` com aparência de valor real | conhecida | `.env.example:16` | idem | não | rotacionar/limpar | **SIM** |

### P2 — inconsistência funcional / UX

| # | Achado | Causa | Decisão existente | Depende de negócio | Impede o deploy? |
|---|---|---|---|---|---|
| 9 | Topologia cobre um inversor por vez | conhecida — declarada na própria tela | não | **sim** | não |
| 10 | Micro salva com CC/CA 1,30× acima do limite de 1,25× do fabricante | conhecida | **sim** — FV-DOM-031: registrar e declarar | não | não |
| 11 | Envio exige orçamento na Opção 02 vazia criada pela própria UX | conhecida | não | **sim** | não |
| 12 | Não existe UX de conexão — API pronta desde a FV-DOM-047 | conhecida | **sim** | não | não |
| 13 | Cotação redigita consumo, tarifa e HSP — segunda fonte | conhecida | não | **sim** | não |
| 14 | `homologacaoDTO.js:112` lê `dimensionamentoV3`, campo inexistente → sempre `0` | conhecida | não | não | não |
| 15 | `instalacaoRefEtapa.check.js` falha (5 asserções) — monta `req` sem `auth` e o tenancy é fail-closed | conhecida · **pré-existente no HEAD**, verificada com `git stash` | não | não | não |

### P3 — cosmético / baixa prioridade

| # | Achado | Causa | Impede o deploy? |
|---|---|---|---|
| 16 | Navegação diz “Agregado não implementado” e a tela de Homologação funciona | rótulo em `fluxo.js` | não |
| 17 | Opção 02 rotulada “Opção 01” na tela de Orçamentos | rótulo | não |
| 18 | Data do parecer exibida com um dia a menos | fuso na formatação | não |
| 19 | Link da proposta com origem fixa `:5173` | ver §6 | **configuração — resolver antes** |

---

## 6 · O `:5173` — causa raiz

**É configuração, com um defeito de código junto.** Não há hardcode cego.

```js
// backend/src/services/EnvioPropostaService.js:45
const APP_URL = process.env.APP_URL || 'http://localhost:5173'
// …
const url = `${APP_URL}/proposta/${token}`   // :201
```

Rodei sem `APP_URL` definida, o fallback de desenvolvimento assumiu, e como o
Vite subiu na 5175 (5173 e 5174 ocupadas) o link ficou apontando para uma porta
que não existia. Em produção com `APP_URL` definida, o link sai correto.

### O defeito real: três variáveis para a mesma coisa

| Arquivo | Lê | Consequência se faltar |
|---|---|---|
| `EnvioPropostaService.js:45` | `APP_URL` | link da proposta cai em `localhost:5173` |
| `routes/gestao.js:16` | `APP_URL \|\| FRONTEND_URL` | idem |
| `security-headers.js:76` | `FRONTEND_URL` | CORS cai em `localhost:5173` |

Definir só uma das duas deixa a outra metade quebrada em silêncio. E o
`.env.example` já sai inconsistente consigo mesmo: `FRONTEND_URL=…:3000` ao
lado de `APP_URL=…:5173`.

Detalhe menor: `APP_URL` é lida **no import do módulo**, não por chamada. Mudar
a variável em runtime não tem efeito — irrelevante em produção, relevante em
teste.

### Correção recomendada — **não aplicada**

| | |
|---|---|
| **Arquivos** | `EnvioPropostaService.js:45` · `routes/gestao.js:16` · `security-headers.js:76` · `backend/.env.example` |
| **Alteração** | uma única resolução (`APP_URL ?? FRONTEND_URL`) usada pelos três; **fail-closed em produção**: sem a variável, `NODE_ENV=production` recusa iniciar em vez de emitir link `localhost`; alinhar o `.env.example` |
| **Risco** | baixo no link; **médio** no CORS — mudar a origem permitida pode derrubar o frontend hoje em produção |
| **Testes** | check de que o link usa a origem configurada · check de que produção sem `APP_URL` não sobe · CORS aceitando o domínio real e recusando `localhost.qualquercoisa.com` |

Como o CORS é o mesmo arquivo de um P1 de segurança (§5.5/§5.6), as duas coisas
deveriam ser resolvidas na mesma sprint.

---

## 7 · Deploy web real — o que falta

### Frontend

| Item | Estado |
|---|---|
| Build | ✅ `npm run build` funciona · 17,2 s |
| **`VITE_API_URL` do build** | ⛔ **`.env.production` aponta para `https://fortesolar.com.br/api`** — um build sem modo próprio faz o ambiente de teste falar com a **API de produção**. Confirmado no bundle gerado. Exige `.env.staging` + `--mode staging` |
| SPA fallback | ⚠️ não configurado no repositório — rotas como `/proposta/:token` dependem do host reescrever para `index.html` |
| Origem/domínio | ⛔ a definir |
| Assets | ✅ emitidos em `dist/assets` |
| Chave Google Maps | ⛔ versionada — rotacionar |

### Backend

| Item | Estado |
|---|---|
| Health check | ✅ `GET /api/health` |
| `trust proxy` | ✅ ativo (`server.js:131`) |
| CORS | ⛔ ver §5.5/§5.6 |
| `APP_URL` | ⛔ ver §6 |
| JWT | ✅ fail-closed — sem `JWT_SECRET` a app não inicia |
| MongoDB | ⛔ URI de teste a definir |
| SMTP | ⚠️ o `.env` local tem credencial Zoho **real**; ambiente de teste deve subir com `SMTP_USER=""` e `SMTP_PASS=""` |
| Secrets externos | ⚠️ `ANTHROPIC_API_KEY`, `SOLARMARKET_API_KEY` — decidir se o ambiente de teste os recebe |
| Logs | ⚠️ `console` — sem coletor definido |

### Banco — isolamento obrigatório

| Item | Definição |
|---|---|
| Banco | **Atlas separado ou cluster de teste** — nunca a base de produção |
| Catálogo | `seed-catalogo-fv-ux-027.mjs` (51 inversores + Znshine 650 W), hoje travado à porta 37017 — precisa aceitar a URI de teste |
| Dados mínimos | 1 empresa · 1 cliente · catálogo |
| Identificação | prefixo `QA-` no nome do projeto e `origem.fonte` própria |
| Reset | recriar o banco de teste do zero; **sem backfill, sem migração** |
| Descarte | derrubar a base inteira |

**Produção permanece proibida sem autorização explícita.**

---

## 8 · Matriz de regressão pós-deploy

Reexecutar no ambiente web, comparando com a §2 deste documento.

| Cenário | Cobertura |
|---|---|
| T01 mono string 6 kWp | **ciclo completo** — é o único que precisa ir até a conexão |
| T03 mono string 10 kWp | técnico + **os dois estados** (sem e com topologia) |
| T05 tri string 14 kWp | técnico |
| T07 tri string 50 kWp | técnico — deve **bloquear** |
| T09 tri 2 × 25 kW | técnico — deve **bloquear** |
| T09b dois inversores, topologia válida | técnico — `MULTIPLOS_INVERSORES` |
| T02 · T04 · T06 · T08 micro | técnico |

**Justificativa da cobertura:** o ciclo comercial (cotação → aceite →
homologação → conexão) não depende da topologia nem da tecnologia do inversor —
a QA-055 e a QA-056 o exerceram por inteiro e obtiveram o mesmo comportamento.
Repeti-lo nove vezes no ambiente web custa muito e prova pouco. O que muda por
cenário é a metade técnica, e essa vai completa em todos.

Passos por cenário: cliente · projeto · dados técnicos · consumo · equipamentos ·
estrutura · dimensionamento · topologia · validação elétrica · unifilar ·
as três potências. No T01, adicionar: orçamento · Baseline · proposta · página
pública · aceite · Gate · homologação · parecer · conexão.

---

## 9 · Checklist de pré-deploy

- [ ] frontend builda — ✅ verificado nesta sprint
- [ ] **build usa `VITE_API_URL` de teste, não `fortesolar.com.br`** — ⛔ pendente
- [ ] backend inicia — ✅ verificado
- [ ] API pública responde (`GET /api/health`) — ⛔ pendente (URL pública)
- [ ] **CORS aceita o domínio de teste e recusa origens arbitrárias** — ⛔ pendente
- [ ] autenticação funciona — ✅ verificado no isolado
- [ ] MongoDB de teste isolado — ⛔ pendente
- [ ] catálogo disponível — ⚠️ seed travado à porta 37017
- [ ] URL pública correta (`APP_URL`) — ⛔ pendente
- [ ] **proposta não aponta para `:5173`** — ⛔ pendente
- [ ] secrets configurados — ⛔ pendente
- [ ] **chaves versionadas rotacionadas** — ⛔ pendente
- [ ] SMTP definido (vazio em teste) — ⛔ pendente
- [ ] SPA fallback no host — ⛔ pendente
- [ ] logs disponíveis — ⛔ pendente
- [ ] reset do ambiente possível — ⛔ pendente
- [ ] produção intocada — ✅ mantido

---

## 10 · Controle desta sprint

| | |
|---|---|
| HEAD | `f1edd01` · branch `s1-fv-domain-migration` |
| Arquivos de produto alterados | **nenhum** |
| Arquivos novos | este documento |
| Commits · pushes | **nenhum** |
| Produção | intocada |
