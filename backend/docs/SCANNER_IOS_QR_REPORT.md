# BUG-SCAN-02 — Leitura de QR em iOS (Relatório)

**Sprint:** P1-SCANNER-IOS-QR-01 · **Modelo:** Sonnet
**Branch:** `sprint/p1-bug-art-01` (continuação)
**Data:** 2026-06-18
**Revisão Gemini:** Não necessária
**Tipo:** Correção mobile (frontend)

---

## 1. Causa raiz confirmada

`EtiquetaScanner.jsx` dependia exclusivamente de **`BarcodeDetector`** para a leitura
automática de QR ao vivo:

```js
const temBarcode = 'BarcodeDetector' in window
// ...
if (temBarcode) { /* loop de detecção de QR */ }
// else: nenhuma leitura automática de QR — só OCR
```

- **Android/Chrome:** `BarcodeDetector` disponível → QR automático funciona.
- **iOS/Safari:** `BarcodeDetector` **não é suportado** (Safari não implementa a API até hoje).
  Como não havia ramo `else`, o iPhone caía direto em **OCR** (foto) — sem leitura de QR.

Confirmado por leitura de código (linha 14 e 27 do arquivo original). A FASE 1 da sprint já
havia registrado o sintoma; aqui foi confirmada a ausência do ramo de fallback.

---

## 2. Estratégia adotada

Adicionar **decodificador QR puro em JS (`jsQR` 1.4.0)** como fallback, sem tocar
parser/backend/endpoint:

| Caminho | Antes | Depois |
|---|---|---|
| QR ao vivo (Android) | BarcodeDetector | **inalterado** (BarcodeDetector) |
| QR ao vivo (iOS) | ❌ não existia | **jsQR** sobre frames do vídeo (canvas 640px, throttle 200ms) |
| Foto "Capturar" | OCR direto | **QR-first (jsQR)** → se não houver QR, OCR (igual antes) |
| Galeria | OCR direto | **QR-first (jsQR)** → se não houver QR, OCR (igual antes) |
| Texto colado | manual | **inalterado** |

`jsQR` foi escolhido por ser leve (~puro JS, sem WASM) e operar diretamente sobre `ImageData`
de canvas. Decodifica **QR**; **Data Matrix** ao vivo permanece exclusivo do BarcodeDetector
(Android) — no iOS, etiquetas Data Matrix continuam caindo em OCR (limitação declarada).

---

## 3. Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/pages/EtiquetaScanner.jsx` | Import `jsQR`; helpers `lerQRDeContexto`, `lerQRDoVideo`, `carregarImagem`; ramo `else` de fallback iOS no loop; QR-first em `tirarFoto` e `onGalleryChange`; textos da UI |
| `frontend/package.json` | Dependência `jsqr ^1.4.0` |
| `frontend/package-lock.json` | Lockfile da nova dependência |

**Não alterados:** parser, backend, `POST /api/ativos/scan`, ProjetoEV, Ativos, QR do ativo,
Comissionamento, Segurança, Atlas.

---

## 4. Android preservado

O ramo `if (temBarcode)` permanece **idêntico** ao original — Android/Chrome continua usando
`BarcodeDetector` ao vivo (qr_code + data_matrix). O fallback jsQR só roda no ramo `else`
(quando `BarcodeDetector` não existe). Em foto/galeria, o QR-first é um ganho adicional com
OCR preservado como segundo nível — sem alterar o comportamento de sucesso anterior.

---

## 5. iPhone suportado

No iOS/Safari (`'BarcodeDetector' in window === false`), agora roda o loop jsQR:
frame do vídeo → canvas reduzido (640px) → `jsQR(ImageData)` a cada ~200ms. Ao detectar,
chama `enviar({ texto })` — o **mesmo contrato** que o BarcodeDetector já usava. Foto e
galeria também tentam QR antes do OCR.

---

## 6. OCR preservado

A prioridade **QR → OCR → texto colado** foi mantida:
- Ao vivo: QR (BarcodeDetector no Android / jsQR no iOS). Botão "Capturar foto" tenta QR e,
  se falhar, envia a imagem para OCR (`enviar({ foto })`) — comportamento original intacto.
- Galeria: tenta QR; em qualquer falha (`catch` ou sem QR), cai em `enviar({ foto: file })`,
  exatamente como antes.
- Texto colado: inalterado.

---

## 7. Regressões

**Nenhuma identificada por leitura de código + build.**
- Android: ramo BarcodeDetector inalterado.
- Galeria/foto: OCR preservado como fallback; QR-first só adiciona um atalho.
- Endpoint, parser e payloads (`{ texto }` / `{ foto }`) inalterados.
- Cleanup do `useEffect` agora limpa também o `setTimeout` do loop iOS (`clearTimeout`).

---

## 8. Honestidade

- **Build executado:** ✅ Vite `✓ built in 9.63s`, 0 erros. jsQR bundlado (chunk principal +~130KB).
- **Device físico utilizado:** ❌ não.
- **iPhone real utilizado:** ❌ **não** — não há iPhone/Safari nem câmera neste ambiente.
- **Validação ao vivo de QR (serial/SSID/senha/MAC):** ❌ não executada em hardware. O parser
  desses campos é responsabilidade do backend (`/api/ativos/scan`), **não alterado** — o
  conteúdo do QR é repassado como `texto`, exatamente como o BarcodeDetector já fazia.
- Testes automatizados de componente: ❌ não executados.
- A correção é **estrutural e verificada por build**; recomenda-se teste em iPhone real
  (Safari) antes de considerar BUG-SCAN-02 fechado.
