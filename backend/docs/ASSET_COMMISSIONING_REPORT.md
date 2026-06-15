# P1-ASSET-COMMISSIONING-01 — Registro do equipamento instalado (as-built) via QR

> - **Data:** 2026-06-14 · **Executor:** Sonnet · **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE
> - **Commit:** separado (branch `sprint/p1-asset-commissioning`)
> - Usa **exclusivamente** `AtivoEquipamento` + QR. **Não altera** Atlas nem ProjetoFV.

## VEREDITO

O técnico agora **escaneia o QR e registra os dados reais do equipamento instalado** (série, rede,
firmware, IP, Wi-Fi, responsável). Tudo gravado **só em `AtivoEquipamento`**, com **histórico de
diffs** (quem/quando/antes/depois) e **senha Wi-Fi nunca exposta**. Validado nos 3 casos reais.

## FASE 1 — Extensão do modelo (`AtivoEquipamento`)

Campos pedidos × estado: a maioria **já existia**; adicionei os faltantes (aditivo, sem quebrar nada):

| Campo (sprint) | No modelo | Ação |
|---|---|---|
| numero_serie | top-level | já existia |
| mac_address | `conectividade.mac_wifi` | já existia (mapeado) |
| firmware | `conectividade.firmware` | já existia |
| ip_local | `conectividade.endereco_ip` | já existia |
| **wifi_ssid** | `conectividade.wifi_ssid` | **adicionado** |
| wifi_senha | `conectividade.senha_wifi` | já existia (sensível) |
| data_comissionamento | top-level | já existia |
| **comissionado_por** | top-level | **adicionado** |
| **histórico de diffs** | `historico[].alteracoes[{campo,de,para}]` | **adicionado** |

## FASE 2/3/4 — Resumo (detalhe em API/UI reports)

- **FASE 2 — Endpoint:** `POST /api/ativos/qr/:qr/comissionar` — atualiza o ativo pelo QR.
- **FASE 3 — Tela mobile:** form em `/ativo/:qr` (escanear → abrir → preencher → salvar).
- **FASE 4 — Histórico:** evento `comissionamento` com `quem`, `quando` e `alteracoes[{campo, de, para}]` (senha mascarada).

## FASE 5 — Validação (3 casos reais)

| Caso | QR | Status | Série | Wi-Fi SSID | Comissionado por | Arranjo |
|---|---|---|---|---|---|---|
| **Paulo Carlos** | FORTE-INV-000009 | instalado | TSUN-SN-2024-0091 | ObraPauloCarlos | tecnico.joao | arr_…_1 |
| **Escola Pinheiro** | FORTE-INV-000010 | instalado | SE-SN-2024-7700 *(via UI)* | — | campo | arr_…_2 |
| **Fazenda Alice** | FORTE-INV-000011 | instalado | DEYE-SN-2024-3001 | FazendaAlice | tecnico.maria | arr_…_3 |

- **QR continua funcionando:** `render.svg` HTTP 200; consulta por QR OK; status avançou `planejado → instalado` no comissionamento.
- **Multiarranjo preservado:** cada ativo mantém seu `arranjo_id` distinto.

## Critério de aceite

| Critério | Status |
|---|---|
| QR continua funcionando | ✅ |
| Serial registrado | ✅ |
| Dados de rede registrados | ✅ (MAC/SSID/firmware/IP) |
| Histórico preservado | ✅ (diffs quem/quando/antes/depois) |
| Sem alterar Atlas | ✅ |
| Sem alterar ProjetoFV | ✅ |
| Revisão Gemini | ⚠️ PENDENTE |

## Entregáveis
- `ASSET_COMMISSIONING_REPORT.md` (este) · `ASSET_COMMISSIONING_API_REPORT.md` · `ASSET_COMMISSIONING_UI_REPORT.md`

## Honestidade / segurança
- **Senha Wi-Fi nunca é devolvida em claro** (consulta mostra só `senha_definida: true`; histórico grava `••••••`).
  Persistida em texto no banco (igual ao desenho atual do modelo) — recomendo **criptografar** (há módulo
  AES-256-GCM no projeto) numa sprint de segurança.
- Os 3 ativos-piloto receberam **dados de comissionamento de teste** (validação) — podem ser re-comissionados.
- "Escola Pinheiro" foi comissionado **pela própria tela** (só preenchi a série → `comissionado_por` caiu no default `campo`).
