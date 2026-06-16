# P1-COMMISSIONING-SCAN-01 — Acurácia do parser (FASE 3)

> `src/services/etiquetaParser.js` — extrai `numero_serie`, `mac_address`, `wifi_ssid`, `wifi_senha`
> de texto vindo de **QR (estruturado/puro/JSON)** ou **OCR**. Dados: `COMMISSIONING_SCAN_ACCURACY.json`.

## Estratégia de extração

- **MAC:** regex de 6 pares hex (`AA:BB:…` / `AA-BB-…` / 12 hex) → normaliza para `AA:BB:CC:DD:EE:FF`.
- **Serial:** rótulos `S/N`, `SN`, `Serial`, `Nº série`; em **QR estruturado** lê `SN=…`; em **QR puro**
  usa o token alfanumérico longo (8–30) como serial.
- **SSID:** rótulos `SSID`, `WiFi`, `AP name`, `WLAN`; heurística `AP_<…>` / `AP-<…>`.
- **Senha:** rótulos `PWD`, `Password`, `Senha`, `KEY`, `PASS`.
- **QR estruturado/JSON:** parse `k:v;k:v` e `{json}` antes das heurísticas (maior confiança).

## Resultados

- **Casos de teste:** 9 (Deye, TSUN, Hoymiles, SolarEdge, Growatt, Kehua, NEP; fontes QR-k:v, QR-puro, JSON, OCR).
- **Casos 100% (todos os campos esperados):** **9/9.**
- **Recall de campos:** **100%** (todos os campos esperados extraídos; sem falsos faltantes).

| Fabricante | Fonte | Campos esperados | Extraídos | OK |
|---|---|---|---|---|
| Deye | QR k:v | SN, SSID, senha, MAC | idem | ✅ |
| Deye | OCR | SN, SSID, senha, MAC | idem | ✅ |
| TSUN | OCR | SN, SSID, senha | idem | ✅ |
| Hoymiles | QR puro | SN | SN | ✅ |
| SolarEdge | OCR | SN | SN | ✅ |
| Growatt | OCR | SN, SSID, senha | idem | ✅ |
| Kehua | OCR | SN | SN | ✅ |
| NEP | OCR | SN, MAC | idem | ✅ |
| Deye | JSON QR | SN, SSID, senha | idem | ✅ |

## Confiança (heurística, devolvida por campo)

`mac_address` 0.95 · `wifi_senha` 0.8 · `wifi_ssid` 0.75–0.8 · `numero_serie` 0.85 (rótulo) / 0.7 (QR puro).
→ O frontend pode realçar campos de baixa confiança para revisão; **o usuário sempre confirma antes de salvar.**

## Limites honestos

- A acurácia medida é sobre **texto** (QR decodificado ou OCR já transcrito). A **qualidade do OCR sobre foto
  real** (iluminação, foco, etiqueta amassada) **não** está nesta medição — depende do tesseract em campo.
- Formatos de serial variam por fabricante/lote; o parser é **rótulo-guiado + heurístico** (não um schema por SKU).
  Casos sem rótulo e sem padrão reconhecível caem no **manual** (o instalador digita).

## Critério de aceite (acurácia)
✅ Extrai serial/SSID/senha/MAC · ✅ QR estruturado/puro/JSON + OCR · ✅ 9/9 casos · ✅ usuário confirma.
