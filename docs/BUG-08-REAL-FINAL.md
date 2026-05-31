# BUG-08-REAL-FINAL — Esteira de reconhecimento de inversores

> Evidência de produção: **Growatt MID25KTL3-X** → `POST /api/equipamentos`
> **400 Bad Request · CAMPOS_OBRIGATORIOS (tipo, fabricante, modelo)**.
> Objetivo: corrigir para **todos** os fabricantes, não só Growatt.

---

## FASE 1 — Prova da causa raiz

### Pipeline rastreado (Growatt MID25KTL3-X)

| # | Etapa | Resultado | Local |
|---|-------|-----------|-------|
| 1 | OCR (PDFParse) | texto contém "Growatt" e "MID25KTL3-X" | `datasheetController.js:416` |
| 2 | Parser texto (fallback IA) | `detectarFabricante`='Growatt'; **`detectarModelo`=null** | `datasheetController.js:215,246` |
| 3 | Fallback regex frontend | alias "growatt" ok, mas **série MID ausente** → `modelo=null` | `fabricanteModeloFallback.js` (Growatt L42-49) |
| 4 | Guard do modal | `&&` → só aborta se AMBOS lixo; fabricante ok + modelo null → **não aborta** | `ModalNovoInversor.jsx:104` |
| 5 | Payload | `{ tipo:'inversor', fabricante:'Growatt', modelo:null }` | `ModalNovoInversor.jsx:119` |
| 6 | POST | `!modelo` → **400 CAMPOS_OBRIGATORIOS** | `equipamentosController.js:181` |

### Onde os campos eram perdidos
- **modelo** perdido em **dois** lugares:
  1. `backend/src/controllers/datasheetController.js` → `detectarModelo()` (**L246-265**) — lista só padrões de **módulo** (ZXMR/JKM/CS/TSM/RSM/LR/JAM); zero inversor.
  2. `backend/src/utils/catalogo/fabricanteModeloFallback.js` → bloco **Growatt** (modelos sem série **MID**); e **Goodwe** com `\d{3,5}` (rejeitava `GW20KT`, 2 dígitos).
- **Não bloqueado** em: `frontend/src/components/equipamentos/ModalNovoInversor.jsx` → `processarItem()` **L104** (guard `&&`).

---

## FASE 2 — Parser de inversores extensível (multi-fabricante)

`backend/src/utils/catalogo/fabricanteModeloFallback.js`:
- **Growatt**: + série **MID** (`MID 25KTL3-X`) + **SPH** + **regex genérica de família** `M??\d+(K)TL(3)-X` (cobre séries futuras sem hardcode isolado).
- **Goodwe**: `\d{2,5}` (corrige `GW20KT-DT`, `GW25K-MT`).
- **Novos fabricantes**: **SolarEdge** (SE…), **Chint** (CPS…), **WEG inversor** (SIW…), **Fimer** (PVS/REACT/TRIO, separado do ABB).
- **Fallback de modelo genérico** (`_extrairModeloGenerico`): quando o fabricante é
  conhecido por alias mas nenhuma regex específica casa, extrai um token de modelo
  plausível — **extensibilidade** sem regex por série.
- **Órfãos**: + MID (Growatt), + GW (Goodwe), + SE (SolarEdge).

`backend/src/controllers/datasheetController.js` → `extrairPorTexto()` (inversor):
- Quando `detectarModelo`/`detectarFabricante` falham, **delega ao catálogo
  compartilhado** `extrairFabricanteModelo()` — fonte única de verdade, multi-fabricante.

Cobertura exigida: Growatt, GoodWe, Deye, Sungrow, Fronius, Solis, SolarEdge,
Huawei, WEG, Fimer, ABB, Chint — **todos** com padrão no catálogo.

---

## FASE 3 — Normalização obrigatória

Nova função pura `normalizarIdentificacao(dados, textoBruto, tipoPadrao)` em
`fabricanteModeloFallback.js`: consolida IA + fallback de regex e **garante**
`{ tipo, fabricante, modelo }` válidos, ou retorna `ok:false` + `faltando:[...]`.
Tratada como pré-condição: `ok:false` ⇒ **não enviar POST**.

---

## FASE 4 — Blindagem frontend

`ModalNovoInversor.jsx` → `processarItem()`:
- Substitui o guard `&&` pela `normalizarIdentificacao(...)`.
- Se `!ident.ok`, **não faz POST** e lança erro listando os campos faltantes
  (`campos não identificados: modelo`) — o operador vê exatamente o que preencher.
- Import reduzido a `normalizarIdentificacao` (helper único).

---

## FASE 5 — Testes

`frontend/src/utils/__tests__/bug08InversorParser.test.js` — **14/14 ✓**:
- **Growatt MID25KTL3-X** reconhecido (era o bug) → fabricante+modelo presentes.
- **Goodwe GW20KT-DT** reconhecido (2 dígitos).
- **Deye SUN-75K-G** reconhecido.
- SolarEdge, Sungrow, Fronius, Solis, Huawei, Chint, WEG reconhecidos.
- `normalizarIdentificacao`: recupera modelo via regex; trata "Inversor" lixo como
  ausente; bloqueia (ok:false + faltando) quando não há como identificar.

Não-regressão: `datasheetPipeline861` (15), `datasheetPipelineReal862` (8),
`evAlign01` (15) — **38/38 ✓**.

### Evidência do cadastro no catálogo
Com o modelo agora resolvido (`MID25KTL3-X`), o payload passa a conter os 3 campos
→ backend retorna **201 Created** (não mais 400). O modal grava `tipo:'inversor'`,
o pre-save hook nunca seta `ativo:false`, e a listagem
`GET /api/equipamentos?tipo=inversor&ativo=true` (Inversores.jsx) passa a exibi-lo.
*(Validação end-to-end de runtime requer Mongo+Claude ao vivo; a prova determinística
do reconhecimento está nos 14 testes do parser/normalização.)*

---

## Execução
- `vitest` bug08 → **14/14 ✓**; não-regressão → **38/38 ✓**
- `vite build` → **✓ (2299 módulos)**
- `node --check` fabricanteModeloFallback.js + datasheetController.js → **✓**

## Arquivos alterados
- `backend/src/utils/catalogo/fabricanteModeloFallback.js` (parser + genérico + normalização)
- `backend/src/controllers/datasheetController.js` (delega catálogo p/ inversor)
- `frontend/src/components/equipamentos/ModalNovoInversor.jsx` (blindagem)
- `frontend/src/utils/__tests__/bug08InversorParser.test.js` (novo)
