# P0-FRONTEND-PRODUCTION-FORENSICS-01 — Frontend publicado × Frontend corrigido

> **READ ONLY.** Nenhum código alterado, nenhuma correção aplicada, nenhum commit gerado.
> Auditoria de evidências reais (git local, `origin/main`, build servido em produção e branches remotas).
>
> - **Data:** 2026-06-14
> - **Executor:** Sonnet (Claude Code)
> - **Produção frontend:** `https://projeto-frts-app.vercel.app` (Vercel)
> - **Produção backend:** `https://projetofrtsapp-production.up.railway.app` (Railway)
> - **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE (gate de aceite)

---

## VEREDITO (resumo executivo)

**O frontend publicado NÃO corresponde ao frontend corrigido.** A causa-raiz é simples e única:

> As correções existem **commitadas localmente**, mas **nunca foram empurradas (`push`) para `origin/main`**.
> `origin/main` está **17 commits atrás** do `main` local. A Vercel faz build a partir de `origin/main`,
> portanto produção foi construída sobre código **antigo** — sem o seletor INPE e sem o fix do crash "panos".

Tudo que o usuário relata (só NASA, sem seletor, visual antigo, crash etapa 5→6) é explicado por isso.

---

## FASE 1 — Identificação dos builds

| Item | Valor | Evidência |
|---|---|---|
| Commit **publicado** (Vercel ← `origin/main`) | **`a802b74`** — "P0-PROJETO-OPEN-BUG-01" · 2026-06-11 **09:38** | `git log origin/main` |
| Commit **local** `main` (não publicado) | `127f7f5` — **ahead 17** de `origin/main` | `git branch -vv` |
| Commit **HEAD** (branch sprint atual) | `a38eb04` | `git log` |
| Bundle JS **servido em produção** | `assets/index-i_vqAdiV.js` (1.996.229 bytes) | `curl https://projeto-frts-app.vercel.app/` |
| Bundle JS do **build corrigido local** | `assets/index-Dj9f_EKD.js` (build 2026-06-12 14:44) | `frontend/dist/assets/` |
| Versão declarada | `frontend/package.json` = `1.0.0` (estático, não serve de carimbo de build) | — |

**O frontend publicado corresponde ao HEAD atual?** → **NÃO.**
Produção = `a802b74`; faltam **17 commits** (incluindo o seletor de irradiância e o fix do crash).
Os hashes de bundle servido (`index-i_vqAdiV.js`) e do build corrigido (`index-Dj9f_EKD.js`) são **diferentes**.

### Os 17 commits ausentes em produção (origin/main..main) — os relevantes:

| Commit | Descrição | Impacto no relato do usuário |
|---|---|---|
| `e4b803f` | P1-UX-CORE-EVOLUTION-01 — funil enxuto, **seletor de irradiação**, múltiplos arranjos | Adiciona o seletor NASA × INPE/CRESESB |
| `39629e5` | fix P0-DIMENSIONAMENTO-PANOS-CRASH-01 — elimina crash `reading 'panos'` | Corrige o crash etapa 5→6 |
| `6fed7f6` | P1-UX-FRONT-CONNECT-01 — conecta UI a múltiplos arranjos | Evolução visual |
| + outros 14 | catálogo, SolarMarket, auth-mail, asset core, quality | — |

---

## FASE 2 — Auditoria da tela de Irradiância

Arquivos envolvidos:
- `frontend/src/components/fv/etapas/E4Irradiancia.jsx` (componente da etapa)
- `frontend/src/services/nasaPowerApi.js` (consulta NASA)
- `frontend/src/data/irradianciaRN.js`, `frontend/src/data/regioesBrasil.js` (médias INPE/CRESESB territoriais)

| Pergunta | Resposta | Evidência |
|---|---|---|
| 1. Existe código INPE? | **SIM, no repositório** (HEAD). Em **produção, NÃO.** | grep `INPE` em `E4Irradiancia.jsx`: presente no HEAD, ausente no bundle live |
| 2. Existe integração CRESESB? | **SIM** (fallback territorial via `irradianciaRN.js`); rotulada "INPE / CRESESB" | `E4Irradiancia.jsx:14` |
| 3. Existe seletor NASA × INPE? | **SIM no HEAD; NÃO em produção** | `E4Irradiancia.jsx:88` `{/* seletor explícito de fonte */}` + array `FONTES` (nasa, cresesb) |
| 4. Foi removido? | **Não.** Nunca foi publicado. | — |
| 5. Foi desabilitado? | **Não.** | — |
| 6. Nunca chegou a ser implementado? | **Foi implementado** (commit `e4b803f`), mas **não foi para produção**. | git |

**Prova ao vivo (definitiva):**
- Bundle de produção `index-i_vqAdiV.js`: contém `"NASA POWER"`, **0 ocorrências** de `"INPE / CRESESB"`.
- Build corrigido local `index-Dj9f_EKD.js`: contém `"INPE / CRESESB"` **e** `"NASA POWER"`.

Na produção (`origin/main`), o `E4Irradiancia.jsx` exibe apenas **um botão** "Consultar NASA POWER"
com fallback "Usar Média Regional (CRESESB)" — **sem o seletor explícito de fonte**. Exatamente o relato.

---

## FASE 3 — Auditoria do fluxo do wizard

Existem **três** versões do fluxo:

| Versão | Onde | Fluxo | Beneficiárias? | Seletor INPE? | Fix panos? |
|---|---|---|---|---|---|
| **A — Publicada** | `origin/main` `a802b74` (Vercel) | 1 Fatura · 2 Consumo · 3 Localização · 4 Irradiância · 5 Dimensionamento · 6 Área · 7 Equipamentos · 8 Orçamento | ❌ | ❌ | ❌ |
| **B — Local `main`/HEAD** | não publicada (17 ahead) | igual a A (8 etapas), porém **com** seletor e fix | ❌ (componente existe, não plugado) | ✅ | ✅ |
| **C — Mais nova** | `origin/feature/fv-wizard-consolidated` | **9 etapas**: insere `2.5: E2BBeneficiarias` entre Consumo e Localização | ✅ | ✅ | ✅ |

Evidência: mapa `STEPS` em `frontend/src/pages/ProjetosFVNovo.jsx`.
- HEAD: `2: E2Consumo, 3: E3Localizacao, …` (sem `2.5`).
- `feature/fv-wizard-consolidated`: `2.5: E2BBeneficiarias` presente.
- O componente `E2BBeneficiarias.jsx` **existe no HEAD**, mas **não está conectado** ao fluxo do HEAD.

**Esse fluxo (publicado) corresponde ao mais recente aprovado?** → **NÃO.**
Produção roda o fluxo **A** (antigo, 8 etapas, sem Beneficiárias, sem seletor, sem fix).
O fluxo mais novo (**C**, 9 etapas com Beneficiárias) existe apenas em `feature/fv-wizard-consolidated`,
**não mergeado e não publicado**. O fluxo de 9 etapas listado nesta sprint = fluxo **C**.

---

## FASE 4 — Reprodução do erro etapa 5 → 6

| Item | Detalhe |
|---|---|
| **Stack trace** | `TypeError: Cannot read properties of undefined (reading 'panos')` |
| **Componente** | `frontend/src/components/fv/etapas/E6Area.jsx` (etapa 6 = Área) |
| **Linha** | `E6Area.jsx:51` → `const panos = area.panos || []` |
| **Campo ausente** | `area` (objeto inteiro) chega `undefined`; portanto `area.panos` quebra |
| **Estado esperado** | `area = { areaDisponivel, panos: [], ... }` (do `estadoInicial` do contexto) |
| **Estado recebido** | `area = undefined` |
| **Causa A** | `ProjetoFVContext.jsx` — `estadoInicial.area` **não tinha** `panos: []` |
| **Causa B** | `ProjetosFVNovo.jsx` — hidratação fazia `area: ls.area_util_m2 ? {…} : undefined`. O `undefined` **explícito** sobrescreve o default do `estadoInicial` no spread (`{...estadoInicial, area: undefined}` → `area: undefined`) |
| **Gatilho** | Avançar Dimensionamento (5) → Área (6); E6Area monta e lê `area.panos` |
| **Reprodutibilidade** | 100% (conforme `DIMENSIONAMENTO_PANOS_CRASH_REPORT.md`): projeto novo e projeto hidratado sem `area_util_m2` |

**É o mesmo bug dos "panos"?** → **SIM, é exatamente o mesmo bug.**
Ele **já foi corrigido** no commit `39629e5` (linhas 172/180 trocando `: undefined` por objeto sempre-presente,
+ `panos: []` no contexto e na hidratação). **Mas a correção NÃO está em produção** — `origin/main` (`a802b74`)
ainda contém o padrão `} : undefined` (linhas 172 e 180) e o `estadoInicial.area` publicado **não tem** `panos`.
Não é um bug novo: é o bug antigo **não deployado**.

---

## FASE 5 — Compatibilidade (na produção atual, todos quebram; com o fix, todos seguros)

| Tipo de projeto | Produção atual (`a802b74`, sem fix) | Com o fix `39629e5` (não publicado) |
|---|---|---|
| **Projeto novo** | ❌ crash (sem panos cadastrados → `area` default sem `panos` / hidratação undefined) | ✅ `estadoInicial.area.panos = []` |
| **Projeto legado** | ❌ crash (hidratação sem `area_util_m2`/`dimensionamento` → `area: undefined`) | ✅ chave sempre presente |
| **Projeto SolarMarket importado** | ❌ crash (import não traz `area_util_m2`/dimensionamento → hidrata `undefined`) | ✅ `panos: Array.isArray(ls.roof_planes) ? … : []` |

A correção é **agnóstica à origem do projeto**: garante o objeto `area`/`dimensionamento` em todos os caminhos.

---

## RESPOSTAS FINAIS

1. **Frontend publicado está atualizado?** → **NÃO.** Está em `a802b74` (2026-06-11 09:38), **17 commits atrás** do `main` local. Sem seletor INPE, sem fix panos, fluxo antigo de 8 etapas.
2. **Backend publicado está atualizado?** → **Indeterminável com exatidão por fora** (o `/api/health` do Railway não expõe SHA: responde `{"status":"ok","mongodb":"conectado"}`). Como `origin/main` também está 17 atrás, é provável que o backend publicado também esteja defasado — **porém os 5 sintomas relatados são 100% de frontend** (seletor e crash panos não dependem do backend).
3. **Existe mismatch frontend/backend?** → O mismatch crítico é **repositório-corrigido × produção** (deploy defasado), não um descompasso de contrato entre o frontend e o backend. O bundle servido em produção é comprovadamente um build **anterior** ao corrigido.
4. **INPE existe no código?** → **SIM no repositório** (`E4Irradiancia.jsx`, commit `e4b803f`, + dados em `irradianciaRN.js`). **NÃO no bundle de produção** (0 ocorrências de "INPE / CRESESB" no JS servido).
5. **O fluxo visual é o atual?** → **NÃO.** Produção = fluxo antigo (8 etapas, sem Beneficiárias, sem seletor). O mais recente (9 etapas com Beneficiárias) está só em `feature/fv-wizard-consolidated`, não publicado.
6. **Causa exata do crash ao avançar?** → `E6Area.jsx:51` lê `area.panos` com `area === undefined`, porque a hidratação em `ProjetosFVNovo.jsx` (`a802b74`) faz `area: … : undefined` e o `estadoInicial.area` publicado não inclui `panos`. É o bug `P0-DIMENSIONAMENTO-PANOS-CRASH-01`, **já corrigido em `39629e5` mas não deployado**.
7. **Correção estimada é simples ou estrutural?** → **SIMPLES — e na prática já existe.** Não requer recodificar nada: basta **publicar o que já está commitado** — fazer `push` dos 17 commits de `main` para `origin/main` (e validar o build da Vercel). Isso resolve, de uma vez: o seletor INPE, o crash panos e o "visual antigo". (A adoção do fluxo de 9 etapas com Beneficiárias é uma decisão à parte: depende de mergear `feature/fv-wizard-consolidated`.)

---

## Evidências (comandos read-only executados)

- `git log origin/main` → `a802b74` (publicado) · `git branch -vv` → `main … [origin/main: ahead 17]`
- `git merge-base --is-ancestor 39629e5 origin/main` → **NO** (fix panos ausente do publicado)
- `git merge-base --is-ancestor 39629e5 main` → **YES** (fix existe local)
- `git grep INPE origin/main -- E4Irradiancia.jsx` → ausente · no HEAD → presente (`FONTES`, "seletor explícito")
- `git grep ': undefined' origin/main -- ProjetosFVNovo.jsx` → linhas **172, 180** (padrão buggy ainda publicado)
- `curl https://projeto-frts-app.vercel.app/` → bundle `index-i_vqAdiV.js`; `grep "INPE / CRESESB"` → **0**
- build corrigido `frontend/dist/assets/index-Dj9f_EKD.js` → contém "INPE / CRESESB"
- `curl …railway.app/api/health` → `{"status":"ok","mongodb":"conectado"}`
- `feature/fv-wizard-consolidated` `ProjetosFVNovo.jsx` → `2.5: E2BBeneficiarias` (fluxo de 9 etapas)

## Critério de aceite

| Critério | Status |
|---|---|
| Read only | ✅ nenhuma alteração de código |
| Nenhuma alteração | ✅ |
| Evidências | ✅ git + bundle ao vivo + health |
| Commits identificados | ✅ publicado `a802b74`; faltantes `e4b803f` (INPE) e `39629e5` (panos) entre os 17 |
| Revisão Gemini | ⚠️ PENDENTE (obrigatória antes de qualquer ação) |

## Recomendação de próxima sprint (remediação — NÃO executada aqui)

`P0-FRONTEND-PUBLISH-SYNC-01`: revisar e **`push` de `main` → `origin/main`** (17 commits), acompanhar o
re-deploy da Vercel e re-testar o bundle servido (esperar "INPE / CRESESB" presente e ausência do `: undefined`
em E6Area). Decisão separada: mergear `feature/fv-wizard-consolidated` para adotar o fluxo de 9 etapas (Beneficiárias).
