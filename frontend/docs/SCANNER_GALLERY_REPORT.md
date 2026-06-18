# Sprint P1-SCANNER-GALLERY-01 — Relatório

**Data:** 2026-06-18
**Modelo:** Sonnet
**Revisão Gemini:** Não necessária
**Branch:** sprint/p1-scanner-gallery-01
**Escopo alterado:** `EtiquetaScanner.jsx` (único arquivo). Backend, Atlas, ProjetoEV, Governança, Homologação, Snapshot — intocados.

> **HONESTIDADE:** Vite build 0 erros. App não executada em dispositivo real.
> Android (galeria/câmera) e iOS (Fotos) **não testados** em hardware real — comportamento documentado
> com base na especificação do atributo `accept="image/*"` sem `capture` em browsers móveis.

---

## FASE 1 — Auditoria

### EtiquetaScanner.jsx (antes)

| Recurso | Estado |
|---|---|
| Câmera (`getUserMedia`) | ✅ funcional |
| QR automático (`BarcodeDetector`) | ✅ funcional (Android Chrome) |
| OCR via câmera (`tirarFoto` → canvas → blob) | ✅ funcional |
| Texto colado (fallback) | ✅ funcional |
| **Upload de galeria** | ❌ **ausente — BUG-SCAN-01** |

### Backend `/api/ativos/scan`

- `multer.single('foto')` com `memoryStorage()`, limite 8MB
- Aceita `multipart/form-data` campo `foto` (`Blob` ou `File` — ambos funcionam)
- Tesseract `por+eng` quando `req.file` presente
- Retorna `{ sucesso, fonte, campos: { serial, mac, ssid, senha }, confianca, texto_bruto }`
- **Nenhuma alteração necessária** — endpoint já pronto

### Compatibilidade File/Blob

`File extends Blob` no DOM. `FormData.append('foto', file)` e `FormData.append('foto', blob, 'etiqueta.jpg')`
produzem o mesmo resultado para multer memoryStorage. A função `enviar({ foto })` existente reutilizada sem alteração.

---

## FASE 2 — Input de arquivo

Adicionado `<input type="file" accept="image/*">` oculto com ref `galleryRef`.
Sem atributo `capture` — permite escolher entre galeria e câmera (comportamento nativo do browser).

```jsx
<input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onGalleryChange} />
<button onClick={() => galleryRef.current?.click()} disabled={estado === 'processando'} ...>
  🖼️ Selecionar da galeria (OCR)
</button>
```

Handler:
```js
async function onGalleryChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = '' // permite re-selecionar o mesmo arquivo
  await enviar({ foto: file })
}
```

---

## FASE 3 — Android (esperado, não testado em hardware)

`<input type="file" accept="image/*">` sem `capture` no Chrome Android:
- Abre seletor nativo com opções "Câmera" e "Galeria de fotos"
- Foto selecionada → `onGalleryChange` → `enviar({ foto: file })` → POST `/api/ativos/scan`
- Mesma rota de processamento OCR do botão "Capturar foto"

**NÃO TESTADO EM HARDWARE REAL.**

---

## FASE 4 — iPhone/iOS Safari (esperado, não testado em hardware)

`<input type="file" accept="image/*">` sem `capture` no Safari iOS:
- Abre sheet com opções: "Tirar Foto ou Vídeo", "Escolher Foto ou Vídeo", "Escolher Arquivo"
- "Escolher Foto" → `onGalleryChange` → `enviar({ foto: file })` → POST `/api/ativos/scan`
- `BarcodeDetector` ausente no Safari → modo câmera usa "Capturar foto" (OCR). Galeria reforça o iOS.

**NÃO TESTADO EM HARDWARE REAL.**

---

## FASE 5 — Fluxo completo

```
Usuário toca "Selecionar da galeria"
    ↓
Browser abre seletor nativo (galeria/câmera conforme plataforma)
    ↓
onGalleryChange(e) — lê e.target.files[0] (File object)
    ↓
enviar({ foto: file })
    ↓
FormData.append('foto', file, 'etiqueta.jpg')
POST /api/ativos/scan  [multipart/form-data]
    ↓
Backend: multer → req.file.buffer → Tesseract.recognize(buffer, 'por+eng')
    ↓
parseEtiqueta(texto, { fabricante })
    ↓
{ campos: { serial, mac, ssid, senha }, confianca, fonte: 'ocr' }
    ↓
onCapture(j.campos, j.fonte) → pré-preenche formulário
```

Pré-preenchimento de Serial/MAC/SSID/Senha via `onCapture` — comportamento **já existente**, não alterado.

---

## FASE 6 — Deye / TSUN / NEP (não testado)

O parser `parseEtiqueta` (backend) não foi alterado. Suporte a fabricantes depende do backend existente.
Não há fotos reais disponíveis para teste nesta sessão.

**NÃO TESTADO com fotos reais.**

---

## Arquivos alterados

| Arquivo | Tipo | Mudança |
|---|---|---|
| `frontend/src/pages/EtiquetaScanner.jsx` | MODIFICADO | +`galleryRef`, +`onGalleryChange`, +`<input type="file">`, +botão galeria (+20 linhas) |

## Não alterados

- Backend `/api/ativos/scan` (reutilizado integralmente)
- `ativosController.js`, `ativos.js` (routes), `ocr.js`
- Atlas, ProjetoEV, Governança, Homologação, Snapshot

---

## Limitações honestas

1. **Não testado em hardware real** (Android/iPhone). Comportamento documentado via especificação.
2. **Fase 6 (Deye/TSUN/NEP):** sem fotos reais — parser backend intocado, não validado.
3. iOS Safari sem `BarcodeDetector`: QR via câmera não funciona automaticamente (pré-existente, fora do escopo).
4. Arquivos > 8MB rejeitados pelo multer (limite pré-existente).
