# P1-ASSET-QR-CODE-01 — QR do Gêmeo Digital utilizável em campo

> - **Data:** 2026-06-14 · **Executor:** Sonnet · **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE
> - **Commit:** separado (branch `sprint/p1-asset-qr-code`)
> - Usa **exclusivamente** a arquitetura `AtivoEquipamento` (P0-ASSET-MODEL-01 / P1-ASSET-CORE-01).
> - **Não altera** ProjetoFV, Atlas nem arranjos (apenas leitura para o join).

## VEREDITO

O QR do Gêmeo Digital agora é **utilizável em campo**: render SVG escaneável + endpoint de consulta
(QR → Ativo → Projeto → Arranjo → Equipamento) + página pública `/ativo/:qr`. Validado nos 3 casos reais.

## FASE 1 — Estado atual (auditoria)

1. **Quantos ativos existem?** → **6** (3 inversores + 3 módulos).
2. **Quantos possuem QR?** → **6/6** (100%, formato `FORTE-<TIPO3>-<SEQ6>`, único via Contador atômico).
3. **Endpoints que já funcionavam:**
   - `GET /api/ativos/projeto/:id` · `POST /api/ativos/gerar/:projetoId` · `GET /api/ativos/:id` · `POST /api/ativos` · `PUT /api/ativos/:id`

> Os 6 ativos correspondem exatamente aos 3 casos obrigatórios (1 inversor + 1 módulo cada).

## FASE 2/3/4 — Resumo (detalhe em ASSET_QR_API_REPORT.md e ASSET_QR_UI_REPORT.md)

- **FASE 2 — Render:** `GET /api/ativos/qr/:qr/render.svg` → QR padrão (SVG escaneável, lib `qrcode`).
- **FASE 3 — Consulta:** `GET /api/ativos/qr/:qr` → Ativo → Projeto → Arranjo → Equipamento (catálogo).
- **FASE 4 — Página:** rota pública `/ativo/:qr` (`AtivoQR.jsx`) — mobile, exibe QR + equipamento + projeto + arranjo + status + histórico.

## FASE 5 — Validação dos casos reais

| Caso | QR | Ativo | Projeto | Arranjo (id) | Catálogo |
|---|---|---|---|---|---|
| **Paulo Carlos** | FORTE-INV-000009 | Tsun TSOL-MS2000 | 207 - Paulo Carlos | arr_mqcqgwwv_1 | Tsun TSOL-MS2000 |
| **Escola Pinheiro** | FORTE-INV-000010 | Solaredge SE 33.3K | 197 - Escola Pinheiros | arr_mqcqgx9t_2 | Solaredge SE 33.3K |
| **Fazenda Alice** | FORTE-INV-000011 | Deye SUN-3K-G | 132.1 - Fazenda Alice | arr_mqcqgxme_3 | (sem bind no Atlas) |

**Respostas:**
1. **QR abre ativo?** → **SIM** (os 3 resolvem; HTTP 200; página renderiza).
2. **Dados corretos?** → **SIM** (fabricante/modelo/projeto batem com o real; link de catálogo onde existe).
3. **Multiarranjo preservado?** → **SIM** — cada ativo carrega seu `arranjo_id` distinto (`…_1/_2/_3`); o
   Gêmeo Digital mantém ativos por arranjo. Nestes projetos legados SM o `ProjetoFV.arranjos[]` está vazio
   (arranjo único via `equipamentos`), então a página mostra o `arranjo_id` do ativo (linkage preservado no
   Gêmeo Digital). Em projeto multiarranjo real, cada arranjo gera seus próprios ativos com ids distintos.

## Critério de aceite

| Critério | Status |
|---|---|
| QR renderizado | ✅ SVG escaneável |
| Consulta por QR | ✅ endpoint join |
| Página funcional | ✅ `/ativo/:qr` (verificada no preview, 0 erros de console) |
| Multiarranjo preservado | ✅ `arranjo_id` por ativo |
| Revisão Gemini | ⚠️ PENDENTE |
| Commit separado | ✅ |

## Entregáveis
- `ASSET_QR_REPORT.md` (este) · `ASSET_QR_API_REPORT.md` · `ASSET_QR_UI_REPORT.md`

## Honestidade
- Os projetos-piloto são **single-arranjo** (legado SM) → o `arranjo` detalhado vem do `ativo.arranjo_id`,
  não de `ProjetoFV.arranjos[]` (que está vazio). A multiarranjo é suportada pela arquitetura; falta um
  projeto multiarranjo real para exibir N arranjos na mesma tela. Não populei `arranjos[]` (fora de escopo).
- Adicionada a dependência `qrcode` (render). Não altera arquitetura/modelos.
