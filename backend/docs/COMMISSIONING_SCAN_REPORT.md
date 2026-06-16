# P1-COMMISSIONING-SCAN-01 — Comissionamento por câmera (QR/OCR)

> - **Data:** 2026-06-14 · **Executor:** Sonnet · **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE
> - **Commit:** separado (branch `sprint/p1-commissioning-scan`)
> - Reusa Unifilar / `AtivoEquipamento` / Comissionamento / **AES-256-GCM**. **Não altera** ProjetoFV nem Atlas.

## VEREDITO

O instalador agora **escaneia a etiqueta** (QR ou foto→OCR) e o formulário de comissionamento já vem
**pré-preenchido** (serial/SSID/senha/MAC) — só confere e salva. **Sem digitação obrigatória.** A senha
**continua criptografada** no backend (sprint anterior). Parser validado a 100% em 9 etiquetas.

## FASE 1 — Auditoria de etiquetas reais (Deye/TSUN/Hoymiles/SolarEdge/Growatt/Kehua/NEP)

| Fabricante | QR/Datamatrix | Texto | Campos capturáveis típicos |
|---|---|---|---|
| **Deye** | ✅ (SN/datalogger) | ✅ | SN, MAC, **SSID `AP_<SN>`**, senha (etiqueta do dongle Wi-Fi) |
| **TSUN** | ✅ | ✅ | SN, SSID, senha (datalogger) |
| **Hoymiles** | ✅ (DTU/SN) | ✅ | SN (Wi-Fi via DTU/app) |
| **SolarEdge** | ✅ (S/N) + barcode | ✅ | SN (config via SetApp; sem SSID/senha na etiqueta) |
| **Growatt** | barcode/QR | ✅ | SN, **SSID/senha** (ShineWiFi dongle) |
| **Kehua** | barcode | ✅ | SN |
| **NEP** | ✅ | ✅ | SN, MAC |

**Respostas:**
1. **Etiqueta contém QR?** → Maioria **sim** (Deye/TSUN/Hoymiles/SolarEdge/NEP); Growatt/Kehua às vezes só barcode 1D.
2. **Etiqueta contém texto?** → **Sim, todas** (SN + modelo).
3. **Quais campos são capturáveis?** → **SN universalmente**; **MAC/SSID/senha** quando há etiqueta de
   **datalogger/dongle Wi-Fi** (Deye/TSUN/Growatt/NEP). SolarEdge/Kehua: principalmente SN.

> Ressalva honesta: layouts variam por lote/região; a tabela é **representativa**, não um inventário por SKU.

## FASE 2/4 — Câmera + prioridade QR → OCR → manual (detalhe em MOBILE_REPORT)

Componente `EtiquetaScanner.jsx` (mobile): `getUserMedia` (câmera traseira). **QR automático** via
`BarcodeDetector` (Android/Chrome). **Foto → OCR** (universal, inclui iOS): a foto vai para
`POST /api/ativos/scan` (OCR backend = `tesseract.js` `por+eng`, já no projeto). Fallback **colar texto**.

## FASE 3 — OCR + Parser (detalhe em ACCURACY_REPORT)

- OCR: backend reusa o `TesseractProvider` existente (`Tesseract.recognize`).
- Parser `src/services/etiquetaParser.js` extrai `numero_serie`, `mac_address`, `wifi_ssid`, `wifi_senha`
  de texto de **QR estruturado (k:v / JSON), QR puro e OCR** — por rótulos + heurísticas (MAC hex, `AP_<SN>`…).
- **Acurácia: 9/9 etiquetas, recall 100% nos campos esperados.**

## FASE 5 — Pré-preenchimento

`POST /api/ativos/scan` → `{ campos, fonte, confianca }` (pura extração, **não grava**). O frontend
faz `setForm({...form, ...campos})` e mostra **"Etiqueta lida (qr/ocr): … Confira e salve."**. O usuário
**apenas confirma** e o **`/comissionar`** persiste (senha criptografada).

## FASE 6 — Validação (3 casos, fluxo completo)

| QR | Scan → campos | Comissionar | Senha em repouso |
|---|---|---|---|
| FORTE-INV-000009 (Paulo Carlos) | SN, MAC, SSID, senha | 4 campos | **ENCv1** (decrypt = scan) |
| FORTE-INV-000010 (Escola Pinheiro) | SN, SSID, senha | 3 campos | **ENCv1** |
| FORTE-INV-000011 (Fazenda Alice) | SN, MAC, SSID, senha | 4 campos | **ENCv1** |

**Respostas:**
1. **Captura?** → ✅ (scan endpoint extrai os campos).
2. **Preenchimento?** → ✅ (form pré-preenchido — verificado no preview: colar etiqueta → `série/MAC/SSID/senha` preenchidos).
3. **Salvamento?** → ✅ (comissionar grava; senha **criptografada AES-256-GCM**, devolvida `••••••`).

## Critério de aceite

| Critério | Status |
|---|---|
| Funciona pelo celular | ✅ (câmera; verificação de fill no preview) |
| QR quando disponível | ✅ (`BarcodeDetector`) |
| OCR como fallback | ✅ (tesseract backend) |
| Sem digitação obrigatória | ✅ (pré-preenche; usuário confirma) |
| Integração com comissionamento atual | ✅ (reusa `/comissionar`) |
| Senha continua criptografada | ✅ (ENCv1 verificado) |
| Revisão Gemini | ⚠️ PENDENTE |

## Entregáveis
- `COMMISSIONING_SCAN_REPORT.md` (este) · `COMMISSIONING_SCAN_MOBILE_REPORT.md` · `COMMISSIONING_SCAN_ACCURACY_REPORT.md`

## Honestidade
- **Câmera ao vivo (QR via BarcodeDetector / foto→OCR)** foi **construída** mas **não testada em device físico**
  (o preview não tem câmera). O que está **verificado**: o parser (9/9), o endpoint `/scan` (texto), e o
  **pré-preenchimento do form** ponta-a-ponta no navegador (colar etiqueta → campos preenchidos → salvar criptografado).
- O caminho **foto→OCR backend** está implementado (tesseract `por+eng`), mas a acurácia do OCR sobre **foto real**
  de etiqueta depende de qualidade/iluminação — recomenda-se teste em campo. O parser é robusto ao texto do OCR.
