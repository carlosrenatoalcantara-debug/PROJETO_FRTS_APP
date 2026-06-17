# P1-ASSET-MONITORING-REGISTRY-01 — Registro permanente de monitoramento no ativo

> - **Data:** 2026-06-14 · **Executor:** Sonnet · **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE
> - **Commit:** separado (branch `sprint/p1-asset-monitoring-registry`)
> - **Não altera** ProjetoFV, Atlas, Multiarranjo, QR nem o Scanner OCR. Aditivo + reuso do AES-256-GCM.

## VEREDITO

O `AtivoEquipamento` agora guarda o **registro de monitoramento** (portal/plant_id/gateway/logger/url +
usuário/senha). **Usuário e senha são criptografados** (AES-256-GCM) e **nunca expostos**. Endpoints
POST/GET por ativo + aba **Monitoramento** em `/ativo/:qr`. Verificado nos ativos-piloto.

## FASE 1 — Auditoria de fabricantes (portal · logger/gateway · campos)

| Fabricante | Portal | Logger/Gateway | Campos-chave |
|---|---|---|---|
| **Deye** | Solarman (Home/Business) | WiFi stick LSW3 / LSE | plant_id, logger SN, usuário/senha |
| **TSUN** | TSUN Smart / Solarman (OEM) | datalogger TSUN | plant_id, logger SN |
| **Hoymiles** | S-Miles Cloud | DTU-Pro / DTU-Lite | plant_id, DTU (gateway) SN |
| **NEP** | NEPViewer | gateway BDG | plant_id, gateway SN |
| **IRC** | *(verificar — provável OEM/Solarman)* | logger WiFi | plant_id, logger SN |
| **Growatt** | ShinePhone / OSS | ShineWiFi / ShineLink | plant_id, datalogger SN |
| **Kehua** | Kehua Cloud | logger Kehua | plant_id, logger SN |
| **Solis** | SolisCloud (Ginlong) | datalogger DLS / Stick | plant_id, datalogger SN |

**Campos necessários (união):** `portal`, `plant_id`, `gateway_sn`, `logger_id`, `url`, `usuario`, `senha`
→ exatamente o subdoc adicionado. *(Ressalva honesta: IRC não confirmado; portais/loggers variam por geração.)*

## FASE 2 — Campos no `AtivoEquipamento` (aditivo)

```js
monitoramento: { portal, plant_id, gateway_sn, logger_id, usuario, senha, url,
                 atualizado_em, atualizado_por }   // default null
```

## FASE 3 — Criptografia (reuso AES-256-GCM)

`usuario` e `senha` são gravados via `ativoSeguranca.criptografar(valor, ativo._id)` (mesmo `ENCv1:` do
Wi-Fi). Verificado: em repouso ambos são `ENCv1:` e descriptografam para o valor original. Demais campos
(portal/plant_id/gateway_sn/logger_id/url) ficam em texto (não-secretos).

## FASE 4 — Endpoints (sem expor segredos)

- **`POST /api/ativos/:id/monitoramento`** → grava; criptografa usuário/senha; registra histórico
  (`tipo:'monitoramento'`); devolve **view mascarada** (`usuario_definido`/`senha_definida`).
- **`GET /api/ativos/:id/monitoramento`** → devolve a view; **nunca** `usuario`/`senha`.

Verificado: POST/GET retornam só `*_definido`; a resposta **não contém** usuário/senha em claro; a consulta
pública por QR (`/qr/:qr`) **não inclui** monitoramento.

## FASE 5 — Aba Monitoramento em `/ativo/:qr`

Card **Monitoramento** (`MonitoramentoCard`) com visualização (portal/plant_id/gateway/logger/url +
"•••••• definido/definida") e form de edição (senha/usuário como `password`/`(manter atual)`). Verificado
no preview: Portal `Solarman`, Plant ID `PLT-2024-0091`, usuário/senha mascarados, **0 erros de console**.

## RESPONDER

1. **Campos adicionados** → `monitoramento{ portal, plant_id, gateway_sn, logger_id, usuario🔒, senha🔒, url, atualizado_em, atualizado_por }`.
2. **Compatibilidade com ativos atuais** → **Total.** Aditivo `default null`; os 6 ativos existentes seguem válidos (monitoramento vazio até preenchido).
3. **Compatibilidade com QR** → **Total.** `render.svg` e consulta por QR inalterados; QR **não** expõe monitoramento (endpoint dedicado, mascarado).
4. **Compatibilidade com scanner** → **Total.** Scanner/OCR e comissionamento intactos; monitoramento é seção/endpoint separados.
5. **Compatibilidade multiarranjo** → **Total.** Monitoramento é **por ativo**; cada ativo de cada arranjo tem seu registro; `arranjo_id` preservado.

## Critério de aceite
✅ Subdoc aditivo · ✅ usuário/senha AES-256-GCM · ✅ POST/GET sem expor segredos · ✅ aba em `/ativo/:qr`
· ✅ QR/scanner/multiarranjo/ProjetoFV/Atlas intactos · ⚠️ Revisão Gemini PENDENTE · ✅ commit separado.

## Honestidade
- A tabela de portais/loggers (FASE 1) é **representativa** (conhecimento de produto); **IRC** não foi confirmado
  e portais variam por geração — o registro é **livre** (campos texto), então acomoda qualquer fabricante.
- `usuario` (login do portal) é tratado como **sensível** e criptografado junto com a senha.
- Verificado no preview o **render + GET** mascarado; a edição/salvamento foi validada via endpoint (POST/GET).
