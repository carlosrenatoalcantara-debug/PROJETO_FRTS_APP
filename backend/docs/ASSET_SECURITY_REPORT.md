# P1-ASSET-SECURITY-01 — Proteção de dados sensíveis de comissionamento

> - **Data:** 2026-06-14 · **Executor:** Sonnet · **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE
> - **Commit:** separado (branch `sprint/p1-asset-security`)
> - Mudança **exclusiva** em persistência/exposição. **Não altera** ProjetoFV, Atlas, QR nem o fluxo de comissionamento.

## VEREDITO

A `conectividade.senha_wifi` agora é **criptografada em repouso com AES-256-GCM** (reutilizando o
módulo existente). Gravação → criptografa; consulta → mascara (`senha_definida`). **0 senhas em texto
puro** restantes (2 migradas). API/QR/página **sem regressão**.

## FASE 1 — Auditoria do AES-256-GCM existente

1. **Onde?** → `src/security/encryption.js` (`EncryptionService`): AES-256-GCM, chave derivada via
   PBKDF2 (100k iterações, SHA-256), **salt + IV + authTag por registro**; chave-mestra em `ENCRYPTION_KEY`.
2. **Quem usa?** → `src/security/api-key-service.js` e o model `ApiKey` (criptografia de API keys). Em produção.
3. **Pronto para reúso?** → **SIM.** `ENCRYPTION_KEY` configurada; round-trip validado. Reutilizado **sem alterar** o módulo.

## FASE 2 — Campos sensíveis

1. **Outro campo exige proteção?** → Não no escopo mínimo. O único **segredo** é a senha Wi-Fi.
   MAC/SSID/firmware/IP/série são **identificadores** (necessários em campo, não-secretos).
2. **Permanecem em texto:** `numero_serie`, `conectividade.{mac_wifi, wifi_ssid, firmware, endereco_ip}`.
   **Criptografado:** `conectividade.senha_wifi`.

## FASE 3 — Transparência (gravar/consultar)

- **Wrapper** `src/services/ativoSeguranca.js` (reusa `EncryptionService`): `criptografar` / `descriptografar`
  / `mascarar`. Formato tagueado **`ENCv1:<base64(JSON)>`** (distingue de legado em texto puro).
- **Gravar** (`POST …/comissionar`): senha → `criptografar(valor, ativo._id)` antes de persistir. Diff no
  histórico fica **mascarado** (`•••••• → ••••••`).
- **Consultar** (`GET …/qr/:qr`): retorna apenas **`senha_definida: boolean`** — nunca o valor nem o blob.
- O frontend **nunca** recebe a senha em claro (verificado: resposta sem `ENCv1`/plaintext).

## FASE 4 — Migração (detalhe em ASSET_SECURITY_MIGRATION_REPORT.md)

1. **Texto puro antes:** **2** (FORTE-INV-000009, FORTE-INV-000011).
2. **Migrados:** **2** (round-trip validado antes de gravar).
3. **Falhas:** **0**.

## FASE 5 — Regressão (3 casos)

Re-comissionados Paulo Carlos / Escola Pinheiro / Fazenda Alice:

| Verificação | Resultado |
|---|---|
| Gravação | ✅ senha persistida **criptografada** (`ENCv1:`) |
| Leitura | ✅ `descriptografar` round-trip OK (interno); API devolve `••••••` |
| Histórico | ✅ preservado; diffs de senha mascarados |
| QR | ✅ `render.svg` HTTP 200 |
| Página pública | ✅ exibe "•••••• (definida)"; sem plaintext/sem blob |

## FASE 6 — Auditoria final

1. **Senhas em texto puro restantes?** → **0** (3/3 criptografadas).
2. **Endpoints expondo sensível?** → **Nenhum.** Consulta = `senha_definida`; comissionar = `••••••`;
   histórico mascarado; nenhuma resposta contém `ENCv1` ou a senha.
3. **Regressão funcional?** → **Nenhuma** (QR/consulta/comissionamento/página OK).

Dados: `ASSET_SECURITY_AUDIT.json`.

## Critério de aceite

| Critério | Status |
|---|---|
| AES-256-GCM reutilizado | ✅ |
| Senha não em texto puro | ✅ (0 restantes) |
| API compatível | ✅ (contrato mantido; só `senha_definida`/`••••••`) |
| Frontend funcional | ✅ |
| QR funcional | ✅ |
| Migração executada | ✅ 2/2, 0 falhas |
| Revisão Gemini | ⚠️ PENDENTE |

## Entregáveis
- `ASSET_SECURITY_REPORT.md` (este) · `ASSET_SECURITY_MIGRATION_REPORT.md` · `ASSET_SECURITY_AUDIT.json`

## Honestidade
- A chave de derivação usa `ativo._id` como contexto (estável). A **chave-mestra** vive em `ENCRYPTION_KEY`
  (env) — a segurança depende da proteção dessa variável (já é o modelo do projeto para API keys).
- Outros campos (MAC/IP/SSID/firmware/série) **continuam em texto** por decisão (identificadores de campo,
  não segredos). Se forem considerados sensíveis no futuro, o mesmo wrapper cobre.
