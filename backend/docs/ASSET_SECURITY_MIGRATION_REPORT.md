# P1-ASSET-SECURITY-01 — Migração (FASE 4)

> Script idempotente: `backend/reports/asset-security/migrate.mjs` (`--apply`).
> Migra `conectividade.senha_wifi` de **texto puro → AES-256-GCM** (`ENCv1:`), validando round-trip antes de gravar.

## Procedimento

1. Seleciona ativos com `conectividade.senha_wifi != null`.
2. Para cada um:
   - Se já `ENCv1:` → **pula** (idempotente).
   - Senão (texto puro): `criptografar(valor, ativo._id)` → **valida `descriptografar` == original** → grava.
   - Falha em qualquer etapa → registra, **não grava** aquele registro.

## Resultado

| Métrica | Valor |
|---|---|
| Ativos com senha | 2 (no momento da migração) |
| **Texto puro antes** | **2** |
| Já criptografados | 0 |
| **Migrados** | **2** |
| **Falhas** | **0** |

Detalhe:
| QR | Antes | Depois |
|---|---|---|
| FORTE-INV-000009 | texto puro | `ENCv1:` (round-trip OK) |
| FORTE-INV-000011 | texto puro | `ENCv1:` (round-trip OK) |

**Respostas FASE 4:**
1. Quantos estavam em texto puro? → **2**
2. Quantos migrados? → **2**
3. Alguma falha? → **0**

> Pós-migração + re-comissionamentos da FASE 5: **3/3** ativos com senha agora criptografados, **0 texto puro**
> (ver `ASSET_SECURITY_AUDIT.json`). Idempotente: re-rodar a migração → 3 "já criptografados", 0 migrados.

## Segurança da migração
- Round-trip validado **antes** de sobrescrever (não corrompe dado).
- Nenhuma senha em claro é logada (o script não imprime valores).
