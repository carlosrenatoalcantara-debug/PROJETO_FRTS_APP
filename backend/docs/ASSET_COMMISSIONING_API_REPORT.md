# P1-ASSET-COMMISSIONING-01 — API (FASE 2 + FASE 4)

> `src/controllers/ativosController.js` + `src/routes/ativos.js`. Aditivo · só `AtivoEquipamento`.

## FASE 2 — Endpoint de comissionamento

**`POST /api/ativos/qr/:qr/comissionar`**

Body (todos opcionais; envia-se só o que mudou):
```jsonc
{
  "numero_serie": "TSUN-SN-2024-0091",
  "mac_address":  "AA:BB:CC:11:22:33",
  "firmware":     "v2.1.4",
  "ip_local":     "192.168.0.50",
  "wifi_ssid":    "ObraPauloCarlos",
  "wifi_senha":   "segredo123",
  "comissionado_por": "tecnico.joao",
  "data_comissionamento": "2026-06-14"   // opcional; default = agora
}
```

Mapeamento campo → caminho no modelo:
| Campo | Caminho |
|---|---|
| numero_serie | `numero_serie` |
| mac_address | `conectividade.mac_wifi` |
| firmware | `conectividade.firmware` |
| ip_local | `conectividade.endereco_ip` |
| wifi_ssid | `conectividade.wifi_ssid` |
| wifi_senha | `conectividade.senha_wifi` *(sensível)* |

Comportamento:
- Busca o ativo por `qr_code`. 404 se não existir; 503 se DB offline.
- Para cada campo enviado, calcula **antes/depois**; **ignora** os sem mudança.
- Define `data_comissionamento` + `comissionado_por`.
- **Ciclo de vida:** `planejado → instalado` no primeiro comissionamento (registrado no histórico).
- **Resposta nunca devolve a senha em claro** (`senha_wifi: '••••••'`).

```
$ curl -X POST .../qr/FORTE-INV-000009/comissionar -d '{...}'
{ "sucesso": true, "qr_code": "FORTE-INV-000009", "alteracoes_registradas": 6, "status": "instalado", "item": { … senha_wifi:"••••••" } }
```

## FASE 4 — Histórico (diff por campo)

`HistoricoSchema` ganhou `alteracoes: [{ campo, de, para }]`. Cada comissionamento empurra:
```jsonc
{
  "tipo": "comissionamento",
  "usuario": "tecnico.joao",          // QUEM
  "data": "2026-06-15T…",             // QUANDO
  "status_de": "planejado", "status_para": "instalado",
  "alteracoes": [                      // ANTES → DEPOIS por campo
    { "campo": "numero_serie", "de": null, "para": "TSUN-SN-2024-0091" },
    { "campo": "mac_address",  "de": null, "para": "AA:BB:CC:11:22:33" },
    { "campo": "wifi_senha",   "de": null, "para": "••••••" }   // mascarado
  ]
}
```

## Consulta por QR (atualizada)

`GET /api/ativos/qr/:qr` agora expõe, no `ativo`: `data_comissionamento`, `comissionado_por` e
`conectividade { mac_wifi, wifi_ssid, firmware, endereco_ip, senha_definida }` — **sem** a senha em claro
(`senha_definida: boolean`). Pré-preenche o formulário da tela mobile.

## Segurança
- `wifi_senha` **nunca** sai do backend em claro (resposta e histórico mascarados).
- Persistida em texto no documento (desenho atual) → recomendação: criptografar (AES-256-GCM já no projeto).

## Critério de aceite (API)
✅ Atualiza ativo por QR · ✅ serial + rede · ✅ histórico diff (quem/quando/antes/depois) · ✅ só `AtivoEquipamento`.
