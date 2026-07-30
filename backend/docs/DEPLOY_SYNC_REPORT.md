# P0-DEPLOY-SYNC-01 — Sincronização de produção (publicar o que já estava pronto)

> Não é sprint de desenvolvimento. Nenhuma funcionalidade criada, nenhuma arquitetura alterada.
> Objetivo: **publicar os 17 commits já aprovados/corrigidos** identificados na auditoria
> `P0-FRONTEND-PRODUCTION-FORENSICS-01`.
>
> - **Data:** 2026-06-14 · **Executor:** Sonnet (Claude Code)
> - **Frontend:** `https://projeto-frts-app.vercel.app` (Vercel) · **Backend:** `https://projetofrtsapp-production.up.railway.app` (Railway)
> - **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE (gate de aceite)

## VEREDITO

✅ **Produção sincronizada.** `origin/main` avançou de `a802b74` → **`127f7f5`** (17 commits).
A Vercel reconstruiu e passou a servir **exatamente o build corrigido** (bundle `index-Dj9f_EKD.js`,
idêntico byte-a-byte ao build local). INPE visível, fix panos presente, backend saudável.

---

## FASE 1 — Commits publicados (origin/main..main, 17)

| # | Commit | Sprint |
|---|---|---|
| 1 | `127f7f5` | P0-QUALITY-FORENSICS-01 (painel × Atlas, read-only) |
| 2 | `7f573f1` | P1-ASSET-CORE-01 (Gêmeo Digital — AtivoEquipamento) |
| 3 | `5506d34` | P1-PROJETO-AMPLIACAO-MULTIINVERSOR (arranjos[]) |
| 4 | `cf138ac` | P0-ASSET-MODEL-01 |
| 5 | `456d5d0` | P0-AUTH-MAIL-01 (Zoho MAIL_FROM) |
| 6 | `a4ef6dc` | P0-AUTH-MAIL-01 (SMTP Zoho + reset/convite) |
| 7 | `6fed7f6` | P1-UX-FRONT-CONNECT-01 |
| 8 | **`e4b803f`** | **P1-UX-CORE-EVOLUTION-01 — seletor de irradiação (INPE)** |
| 9 | `74528a5` | P0-INFRA-HYDRATE-01 (DNS SRV + desativa bypass memory-storage) |
| 10 | `9aafef6` | P0-CATALOG-MATCHER-FIX-02 |
| 11 | `ed21f58` | P1-CATALOG-HIGH-ROI-IMPORT-01 |
| 12 | `3cb68f7` | P0-CATALOG-REMAINING-GAPS-01 (read-only) |
| 13 | `a44765b` | P0-CATALOG-MATCHER-FIX-01 |
| 14 | `1bb9256` | P0-CATALOG-COVERAGE-GAP-02 (read-only) |
| 15 | `b0bce6b` | P1-SOLARMARKET-PROPOSAL-EQUIPMENT-BIND-01 |
| 16 | `b196bdb` | P0-SOLARMARKET-MIGRATION-INTEGRITY-01 |
| 17 | **`39629e5`** | **fix P0-DIMENSIONAMENTO-PANOS-CRASH-01 — crash `reading 'panos'`** |

---

## FASE 2 — Validação pré-push

| Verificação | Resultado |
|---|---|
| **Conflitos / divergência** | ✅ Nenhum. `main..origin/main` vazio → **fast-forward** puro (`a802b74..127f7f5`). |
| **Migrações pendentes** | ✅ Nenhuma bloqueante. Os arquivos "migration" são **relatórios `.md`**; mudanças de schema são **aditivas** (Mongoose), sem migração destrutiva no deploy. |
| **Variáveis de ambiente** | Novas documentadas em `.env.example`: `SMTP_HOST/PORT/USER/PASS/FROM`, `APP_URL` (feature de e-mail Zoho) e `MONGODB_DNS_SERVERS`/`USE_MEMORY_STORAGE`. |
| **Risco de boot do backend** | ✅ Baixo. `INFRA-HYDRATE` em `database.js` é **opt-in / no-op se a env ausente**; Atlas já estava acessível do Railway (health = conectado). O mesmo código foi bootado contra o Atlas de produção em sprint anterior, sem falha. |
| **SMTP/Zoho** | ⚠️ Variáveis **feature-gated** — se não setadas no Railway, e-mail (reset/convite) fica inativo, mas **não bloqueia boot** e **não afeta** os sintomas relatados. Recomenda-se setar no Railway. |

---

## FASE 3 — Sincronização executada

```
git push origin main:main
→ To github.com/carlosrenatoalcantara-debug/PROJETO_FRTS_APP
   a802b74..127f7f5  main -> main      (exit 0)
```
Pós-push: `origin/main` = `127f7f5`; `origin/main..main` = **0** (sincronizado).

> Observação: a sincronização publicou **`main`** (não a branch de trabalho `sprint/p0-quality-reprocess-01`).
> O commit do sprint de reprocessamento (`a38eb04`) permanece fora de `main`, como esperado.

---

## FASE 4 — Build e validação

| Item | Resultado |
|---|---|
| Vercel — rebuild | ✅ Concluído em ~18s após o push |
| Bundle servido | `index-i_vqAdiV.js` (antigo) → **`index-Dj9f_EKD.js`** (novo) |
| Identidade com build corrigido | ✅ **`cmp` idêntico** ao `frontend/dist/assets/index-Dj9f_EKD.js` local |
| Frontend HTTP | ✅ `/` → 200 |
| Backend Railway | 502 transitório (~restart do redeploy) → **recuperou para 200** na verificação seguinte |
| E2E (Vercel `/api` → Railway → Mongo) | ✅ `{"status":"ok","mongodb":"conectado"}` HTTP 200 |

---

## FASE 5 — Confirmações

1. **INPE aparece?** → ✅ **SIM.** Bundle ao vivo contém `"INPE / CRESESB"` (seletor) + `"NASA POWER"`. Antes do deploy eram **0** ocorrências de INPE.
2. **Wizard correto aparece?** → ✅ **SIM**, o fluxo corrigido (8 etapas **com** seletor de irradiância e fix panos). *Nota de escopo:* o fluxo **de 9 etapas com Beneficiárias** (flow C, `feature/fv-wizard-consolidated`) **continua não publicado** — não fazia parte de `main` e não era objetivo desta sync.
3. **Crash dos panos desapareceu?** → ✅ **SIM** (nível de código/bundle). O bundle ao vivo contém o default `panos:[]` e não mais o padrão `: undefined` que causava `reading 'panos'`. A condição de crash 100%-reprodutível em `E6Area.jsx:51` foi eliminada.
4. **Projeto avança até equipamentos?** → ✅ **Estruturalmente sim** — o ponto de falha (etapa 5→6, `E6Area`) foi removido. *Nível de verificação:* confirmado pelo **bundle servido** (fix presente), não por click-through autenticado (exigiria credenciais de usuário, fora do escopo read-safe).
5. **Build concluída sem erro?** → ✅ **SIM.** Vercel: bundle 200, idêntico ao build local. Railway: 502 transitório de restart, recuperado para 200; MongoDB conectado.

---

## Critério de aceite

| Critério | Status |
|---|---|
| Produção sincronizada | ✅ `origin/main` = `127f7f5`, ahead 0 |
| 17 commits publicados | ✅ `a802b74..127f7f5` |
| INPE visível | ✅ bundle ao vivo com "INPE / CRESESB" |
| Crash resolvido | ✅ `panos:[]` no bundle; padrão buggy removido |
| Build validada | ✅ Vercel 200 idêntico ao build local; backend 200 |
| Revisão Gemini | ⚠️ PENDENTE (obrigatória) |

## Evidências (comandos)

- `git push origin main:main` → `a802b74..127f7f5 main -> main`
- `curl …vercel.app/` → bundle `index-Dj9f_EKD.js`; `grep "INPE / CRESESB"` → presente (antes: 0)
- `cmp live_new.js dist/assets/index-Dj9f_EKD.js` → idêntico
- `grep "panos:\[\]" live_new.js` → 2 ocorrências (fix presente)
- `curl …vercel.app/api/health` (proxy→Railway) → `{"status":"ok","mongodb":"conectado"}` 200

## Pendências recomendadas (fora do escopo desta sync)

1. **Setar SMTP/Zoho no Railway** (`SMTP_HOST/PORT/USER/PASS/FROM`, `APP_URL`) para habilitar e-mail de reset/convite.
2. **Validação UI autenticada** end-to-end do wizard até Equipamentos (click-through com usuário real).
3. **Decisão de produto:** mergear `feature/fv-wizard-consolidated` para adotar o fluxo de 9 etapas com Beneficiárias.
