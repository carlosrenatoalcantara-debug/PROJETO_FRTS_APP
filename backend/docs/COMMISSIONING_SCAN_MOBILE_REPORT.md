# P1-COMMISSIONING-SCAN-01 — Mobile / Câmera (FASE 2 + FASE 4)

> `frontend/src/pages/EtiquetaScanner.jsx` (modal de scan) integrado em `AtivoQR.jsx` (`/ativo/:qr`).

## Captura por câmera (FASE 2)

- **`navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })`** → câmera traseira.
- `<video playsInline muted>` (necessário para autoplay em iOS); moldura-guia para mirar a etiqueta.
- Limpeza: `stream.getTracks().forEach(t => t.stop())` ao fechar/desmontar (não deixa a câmera ligada).
- Falha de permissão/sem câmera → cai no **modo manual** (colar texto).

## Prioridade QR → OCR → Manual (FASE 4)

| Prioridade | Mecanismo | Plataforma |
|---|---|---|
| **1. QR/Datamatrix** | `BarcodeDetector` (nativo) — leitura automática dos frames | Android/Chrome (e Chromium) |
| **2. Foto → OCR** | "📷 Capturar foto" → `canvas` → `blob` → `POST /api/ativos/scan` (tesseract backend) | **Universal (inclui iOS Safari)** |
| **3. Manual** | colar conteúdo do QR/texto → `POST /scan` `{texto}`; ou digitar no form | Universal |

- iOS Safari não tem `BarcodeDetector` → o fluxo usa **foto→OCR** (ou colar), sem travar.
- Em todos os casos o endpoint devolve `{ campos }` e o **form é pré-preenchido**; o instalador confirma.

## Integração na tela do ativo

- `/ativo/:qr` ganhou **"📷 Escanear etiqueta"** (e "Registrar manualmente"). Dentro do form, atalho "📷 Escanear".
- `onCapture(campos)` → `setForm({ ...form, ...campos })` + mensagem "Etiqueta lida (…). Confira e salve."
- O **POST `/comissionar`** é o mesmo da sprint anterior (senha criptografada AES-256-GCM).

## Verificação (preview)

- `/ativo/FORTE-INV-000009` → "📷 Escanear etiqueta" → modal abre (textarea de fallback presente).
- Colar `"Deye SN:UI2305SCAN;SSID:AP_UISCAN;PWD:uiPass2024;MAC:11:22:33:44:55:66"` → "Ler texto colado" →
  **form preenchido**: Nº série `UI2305SCAN`, MAC `11:22:33:44:55:66`, SSID `AP_UISCAN`, senha `uiPass2024`.
- **0 erros de console.**

## Ressalva honesta
- A leitura **ao vivo pela câmera** (BarcodeDetector e foto→OCR) **não** foi testada em **device físico**
  (preview sem câmera). Verificado: abertura do modal + caminho **colar/texto** ponta-a-ponta. Recomenda-se
  um teste rápido em Android e iPhone reais antes do uso em campo.

## Critério de aceite (mobile)
✅ Câmera traseira · ✅ QR automático (onde há suporte) · ✅ OCR/foto universal · ✅ manual/colar · ✅ pré-preenche o form.
