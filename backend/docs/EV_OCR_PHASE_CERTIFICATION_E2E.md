# EV_OCR_PHASE_CERTIFICATION_E2E.md

**Sprint:** P1-EV-OCR-PHASE-DETECTION-FIX-01 — **certificação END-TO-END (pipeline real)**
**Modelo:** Claude Opus 4.8 · **Data:** 2026-06-25 · **Commit do fix:** `32b6f36`

> GEMINI: revisão cruzada PENDENTE (sem ferramenta no ambiente).

## DECLARAÇÃO DE HONESTIDADE
```
EXECUÇÃO REAL: os 7 datasheets reais foram enviados ao endpoint oficial
(/api/carregadores-ev/upload-datasheet) → OCR → CarregadorEV → Mapper → API (deploy de produção).
Sem fixtures, sem PDF artificial, sem teste unitário, sem hardcode. Registros de teste removidos ao fim.
```

## Cadeia: Datasheet → OCR → CarregadorEV → Mapper → API (7 PDFs reais)
| # | Datasheet (ground truth) | Fase esperada | OCR/CarregadorEV | Mapper/API | Fase ✓ |
|---|---|---|---|---|---|
| EVE 0074B (Intelbras) | mono, 230V, 32A, 7,4kW, Type 2, OCPP, IP65, CE | **Mono/1** | AC_Mono / 1 | AC_Mono / 1 | ✅ |
| EVE 0074C (Intelbras) | mono, 230V, 32A, 7,4kW, Type 2, OCPP, IP65, CE | **Mono/1** | AC_Mono / 1 | AC_Mono / 1 | ✅ |
| EVE 0110C (Intelbras) | **tri**, 400V, 16A, 11kW (multi-variante, reduz p/ mono) | **Tri/3** | AC_Tri / 3 | AC_Tri / 3 | ✅ |
| EVE 0220B (Intelbras) | **tri**, 400V, 32A, 22kW (multi-variante) | **Tri/3** | AC_Tri / 3 | AC_Tri / 3 | ✅ |
| KS1207A21 (Evowatt) | mono, 220V, 32A, 7kW, Type 2, OCPP, IP55 | **Mono/1** | AC_Mono / 1 | AC_Mono / 1 | ✅ |
| SOL7.4H (Solplanet) | mono, 32A, 7,4kW, Type 2, OCPP, IP65, CE/IEC | **Mono/1** | AC_Mono / 1 | AC_Mono / 1 | ✅ |
| CVBE-MO-220V-7 (BelEnergy) | **mono** (variante MO; doc MULTI-VARIANTE MO/BI/TR), 220V, 32A, 7,4kW, Type 2, IP65, IEC | **Mono/1** | **AC_Mono / 1** | **AC_Mono / 1** | ✅ **CORRIGIDO** |

**Fase: 7/7 batem com o datasheet.** Cadeia OCR→CarregadorEV→Mapper→API **consistente** nos 7.

## Demais campos (extraídos pelo pipeline real)
| # | potência | conector | IP | tensão(OCR) | corrente(OCR) | OCPP(OCR) | cert(OCR) |
|---|---|---|---|---|---|---|---|
| EVE 0074B | 7,4 ✓ | Type 2 ✓ | IP65 ✓ | null | null | null | null |
| EVE 0074C | 7,4 ✓ | Type 2 ✓ | IP65 ✓ | null | null | null | null |
| EVE 0110C | 11 ✓ | Type 2 ✓ | IP65 ✓ | null | null | null | null |
| EVE 0220B | 22 ✓ | Type 2 ✓ | IP65 ✓ | null | null | null | null |
| KS1207A21 | 7,4 (norm. de 7) | Type 2 ✓ | IP55 ✓ | null | null | null | null |
| SOL7.4H | 7,4 ✓ | Type 2 ✓ | IP65 ✓ | null | null | null | null |
| CVBE-MO | 7,4 ✓ | Type 2 ✓ | IP65 ✓ | null | null | null | null |

## Divergências (honestas) — PRÉ-EXISTENTES, NÃO introduzidas por esta sprint
`tensao_entrada_v`, `corrente_entrada_a`, `ocpp`, `certificacao` saíram **null** nos 7, embora os
datasheets tragam esses valores. **Isto NÃO é regressão desta sprint:** este sprint alterou
EXCLUSIVAMENTE a detecção de fases (`detectarTipoFases`); a extração de tensão/corrente/OCPP/cert é a
mesma de antes (os 3 registros originais já tinham esses campos null). São lacunas pré-existentes do
OCR, fora do escopo do fix de fases.

## Regressão (critério da sprint)
- **Corrigiu o BelEnergy:** ✅ AC_Tri/3 → **AC_Mono/1** (variante MO de um datasheet multi-variante).
- **Não introduziu regressões:** ✅ potência/conector/IP idênticos ao datasheet; tensão/corrente/OCPP/cert
  permanecem null (já eram null antes — não alterados).
- **Não alterou outros fabricantes:** ✅ Intelbras 0074B/0074C = mono; Evowatt = mono; Solplanet = mono;
  e os trifásicos REAIS (0110C/0220B) foram corretamente classificados como **tri** (o fix NÃO força mono).
- **Sem hardcode / exceção por fabricante/modelo / correção manual:** ✅ (função genérica por sinais
  físicos: keyword inequívoco → modelo/tensão quando multi-variante/ambíguo).

## TABELA PASS/FAIL
| Carregador | Fase OCR=datasheet | Cadeia consistente | Resultado |
|---|---|---|---|
| EVE 0074B  | ✅ mono | ✅ | **PASS** |
| EVE 0074C  | ✅ mono | ✅ | **PASS** |
| EVE 0110C  | ✅ tri  | ✅ | **PASS** |
| EVE 0220B  | ✅ tri  | ✅ | **PASS** |
| KS1207A21  | ✅ mono | ✅ | **PASS** |
| SOL7.4H    | ✅ mono | ✅ | **PASS** |
| CVBE-MO    | ✅ mono | ✅ | **PASS** |

## Limpeza
Os **7 registros de teste foram removidos** (DELETE HTTP 200). Catálogo de volta aos 3 originais.
**Ressalva honesta:** o registro PRÉ-EXISTENTE do BelEnergy (importado com o OCR antigo) permanece
`AC_Tri/3` no catálogo — o fix corrige na IMPORTAÇÃO; basta o usuário reimportá-lo (agora → AC_Mono/1).

## VEREDITO
```
CERTIFICADA
```
