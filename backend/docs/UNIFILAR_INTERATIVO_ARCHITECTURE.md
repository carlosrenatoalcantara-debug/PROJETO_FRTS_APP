# P1-UNIFILAR-INTERATIVO-01 — Arquitetura (FASE 2 / 3 / 7)

## Princípio

> O unifilar **operacional** não é um novo fluxo: é uma **camada de entrada** que leva o instalador ao
> **mesmo** `/ativo/:qr` (comissionamento já existente). Reusa `AtivoEquipamento`; **não toca** ProjetoFV/Atlas.

## FASE 2 — Contrato de ligação

Cada elemento desenhado é derivado de um `AtivoEquipamento` e carrega:

| Campo do contrato | Origem (`AtivoEquipamento`) |
|---|---|
| `ativo_id` | `_id` |
| `equipamento_id` | `equipamento_id` (ref. Atlas, somente leitura) |
| `arranjo_id` | `arranjo_id` (= `ProjetoFV.arranjos[].id`) |
| `tipo` | `tipo` (`modulo`/`inversor`/`microinversor`/`bess`/…) |
| `qr_code` | `qr_code` (`FORTE-<TIPO3>-<SEQ6>`) |
| `status` | `status` (cor do símbolo) |

**Como o unifilar localiza o ativo correto:**
1. `GET /api/ativos/projeto/:projetoId` → lista de ativos (já filtrável por `arranjo_id`/`tipo`/`status`).
2. Agrupa por **`arranjo_id`** (preserva multiarranjo) e numera por tipo (`INV-01`, `MIC-01`, `BESS-01`, `MOD-01`…).
3. Cada símbolo guarda o ativo; o clique resolve via **`qr_code`** (único e imutável).

Nenhuma escrita: o unifilar é **somente leitura** sobre os ativos.

## FASE 3 — Estratégia de clique

**Adotada: `navigate('/ativo/<qr_code>')`.**

| Opção | Decisão |
|---|---|
| `/ativo/<id>` (por `_id`) | preterida — exigiria nova rota/lookup |
| **`/ativo/qr/<qr_code>`** (via página `/ativo/:qr`) | **escolhida** — a página e o endpoint já existem; é o **mesmo fluxo** de comissionamento (não cria fluxo paralelo); o `qr_code` é o identificador de campo (também impresso na etiqueta) |

→ Clicar `INV-01`/`MIC-01`/`BESS-01` faz `navigate('/ativo/FORTE-…')`. Coerência total entre **desenho**,
**etiqueta física** e **ficha do ativo**.

## Componentes

- **Frontend:** `frontend/src/pages/Unifilar.jsx` (rota pública `/unifilar/:projetoId`). SVG responsivo;
  símbolos `<g role="button">` clicáveis; cores por `status`; agrupamento por arranjo.
- **Backend:** **nenhuma mudança** — reusa `GET /api/ativos/projeto/:id` (P1-ASSET-CORE-01) e `/ativo/:qr` (P1-ASSET-QR-CODE-01).

```
Engenharia (ProjetoFV/arranjos)  ──gera──▶  AtivoEquipamento (_id, qr, arranjo_id, tipo)
                                                   │
        /unifilar/:projetoId  ──lê──▶  /api/ativos/projeto/:id  ──desenha símbolos clicáveis──▶
                                                   │ (clique no símbolo)
                                            /ativo/<qr>  ──▶  comissionamento (serial/rede/senha cripto)
```

## FASE 7 — Contrato para `P1-COMMISSIONING-SCAN-01` (próxima sprint)

Objetivo: **sem digitação**. Câmera → OCR/QR-scan → preenche o form de `/ativo/:qr`.

**Contrato proposto (a implementar na próxima sprint):**
- Componente `<ScannerEtiqueta onCapture={(campos) => preencher(campos)} />` na página `/ativo/:qr`.
- `campos` (parcial; só o que a etiqueta tiver): `{ numero_serie, mac_address, wifi_ssid, wifi_senha }`.
- Fontes:
  - **QR/Datamatrix** da etiqueta do fabricante → `numero_serie` (+ às vezes MAC).
  - **OCR** (texto da etiqueta) → `mac_address`, `wifi_ssid`, `wifi_senha` (quando impressos).
- O componente apenas **popula os inputs** do form atual; o **POST `/api/ativos/qr/:qr/comissionar`**
  permanece inalterado (senha continua criptografada AES-256-GCM no backend).
- Permissões da câmera tratadas no cliente; nenhum dado sai sem o "Salvar" do instalador.

> Assim a próxima sprint é **puramente frontend** (scanner) + um util de OCR — sem mudar API/modelo.
