# P1-ASSET-COMMISSIONING-01 — UI (FASE 3)

> `frontend/src/pages/AtivoQR.jsx` (mesma rota pública `/ativo/:qr`). Mobile-first.

## Fluxo (escanear → abrir → preencher → salvar)

1. Técnico **escaneia o QR** → abre `/ativo/<QR>`.
2. A ficha mostra equipamento, **conectividade as-built** (MAC/SSID/firmware/IP/senha-definida) e status.
3. Botão **"Registrar dados instalados"** abre o formulário (pré-preenchido com o que já existe; senha em branco).
4. Campos: Nº de série · MAC address · Firmware · IP local · Wi-Fi SSID · Wi-Fi senha (`type=password`) · Comissionado por.
5. **Salvar** → `POST /api/ativos/qr/<QR>/comissionar` → recarrega a ficha + mensagem de sucesso.

Detalhes:
- Só envia campos preenchidos; **senha em branco = mantém a atual** (placeholder "(manter atual)").
- Status muda para **INSTALADO** após o primeiro comissionamento.
- **Histórico** renderiza os diffs (`campo: antes → depois`, com `quem · quando`), senha mascarada.
- Estados: carregando · 404 · erro de salvar · sucesso.

## Verificação no preview (real)

- **Paulo Carlos** (FORTE-INV-000009): após comissionar via API, a ficha exibiu série `TSUN-SN-2024-0091`,
  MAC, SSID `ObraPauloCarlos`, firmware `v2.1.4`, IP, **Senha •••••• (definida)**, status **INSTALADO** (screenshot).
- **Escola Pinheiro** (FORTE-INV-000010): comissionado **pela própria tela** (preenchi a série pelo form e
  cliquei Salvar) → mensagem "registrado", série `SE-SN-2024-7700`, status INSTALADO. ✅ form posta de verdade.
- **0 erros de console.**

## Segurança na UI
- Campo senha é `type=password`; a ficha mostra apenas "•••••• (definida)", nunca o valor.
- A consulta usada pela tela já recebe `senha_definida` (boolean), não a senha.

## Critério de aceite (UI)
✅ Tela mobile · ✅ escanear→abrir→preencher→salvar · ✅ histórico visível · ✅ QR continua funcionando.
