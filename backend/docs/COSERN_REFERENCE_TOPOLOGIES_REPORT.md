# COSERN_REFERENCE_TOPOLOGIES_REPORT.md

**Sprint:** P1-COSERN-REFERENCE-TOPOLOGIES-01
**Data:** 2026-06-20
**Modelo:** Claude Opus 4.8
**Tipo:** Biblioteca técnica de topologias de referência COSERN

---

## ⚠️ GEMINI — revisão cruzada PENDENTE (sem ferramenta no ambiente)

## ⚠️ HONESTIDADE SOBRE OS LIMITES COSERN

A fatura COSERN estava disponível, mas **não a Norma Técnica de classes de entrada**.
Os **limites de classe** (disjuntor, cabo, caixa, aterramento, demanda) abaixo são
**valores de REFERÊNCIA** baseados em padrões BT brasileiros comuns — **devem ser
confirmados com a NT COSERN vigente** antes do projeto executivo. As **topologias**
são sugestões iniciais editáveis, ancoradas em inversores reais do catálogo.

```
VALIDADO EM CÓDIGO:   build OK; motor unit-tested 18/18; coerência elétrica
VALIDADO EM RUNTIME:  endpoint /api/referencia (T5/T7/T8 × 3 arq.) — Railway/Atlas
NÃO EXERCIDO:         botão "Aplicar" no navegador (componente build-validado)
```

## RESULTADO

```
APROVADO — biblioteca + motor + endpoint + frontend entregues e validados.
Pronto para uso como SUGESTÃO inicial (não substitui o dimensionamento).
```

---

## FASE 1 — CLASSES COSERN (referência; validar com NT)

| Classe | Ligação | Pot. limite | Demanda | Disjuntor | Cabo | Caixa | Aterramento |
|---|---|---|---|---|---|---|---|
| M2 | mono 220V | ~8 kW | 9 kVA | 40 A | 10 mm² | CM mono | haste + 10 mm² |
| M3 | mono 220V | ~10 kW | 11 kVA | 50 A | 16 mm² | CM mono | haste + 16 mm² |
| T5 | tri 380V | ~27 kW | 30 kVA | 50 A | 16 mm² | CM-4 | malha + 16 mm² |
| T6 | tri 380V | ~40 kW | 45 kVA | 100 A | 35 mm² | CM-4 | malha + 25 mm² |
| T7 | tri 380V | ~57 kW | 63 kVA | 150 A | 70 mm² | cabine | malha + 50 mm² |
| T8 | tri 380V | ~75 kW | 84 kVA | 200 A | 120 mm² | cabine | malha + 70 mm² |

## FASES 2–6 — TOPOLOGIAS (18 = 6 classes × 3 arquiteturas)

Módulo de referência: **mono PERC 550 Wp** (Voc 49,5 · Vmp 41,5 · Isc 13,9). Resumo string:

| Classe | Inversor (string) | Módulos | CC/CA | Over | MPPT | Strings×mód | Voc est. |
|---|---|---|---|---|---|---|---|
| M2 | Kehua SPI6000-B2 (6 kW) | 12 | 6,6/6 | 1,10 | 2 | 2×6 | 312 V |
| M3 | Growatt MIN 8000TL-X (8 kW) | 16 | 8,8/8 | 1,10 | 2 | 2×8 | 416 V |
| T5 | SolaX X3-ULT-25K (25 kW) | 50 | 27,5/25 | 1,10 | 3 | 5×10 | 520 V |
| T6 | Huawei SUN2000-40KTL-M3 (40 kW) | 72 | 39,6/40 | 0,99 | 4 | 4×18 | 936 V |
| T7 | Huawei SUN2000-50KTL-M0 (50 kW) | 108 | 59,4/50 | 1,19 | 6 | 6×18 | 936 V |
| T8 | Huawei SUN2000-60KTL-M0 (60 kW) | 120 | 66,0/60 | 1,10 | 6 | 6×20 | 1040 V |

- **MICRO** (Fase 5): TSUN TSOL-MP2250 (4 entradas/micro), nº de micros por classe (3→30).
- **OTIMIZADOR** (Fase 6): SolarEdge P401/P850 + inversor SE compatível por classe.

## FASE 7 — JSON

Gerado: `COSERN_REFERENCE_TOPOLOGIES.json` (classes + 18 topologias).

## FASE 8 — MOTOR DE SUGESTÃO

`sugerirTopologia({ concessionaria, classe, arquitetura })` (puro) +
`GET /api/referencia/topologia` / `GET /api/referencia/classes` (read-only, sem auth).

## FASE 9 — FRONTEND

`SugestaoTopologiaReferencia.jsx` aparece no E7 quando a concessionária é **COSERN**;
o usuário escolhe classe + arquitetura, vê a referência e o botão **"Aplicar
configuração técnica de referência"** (opcional — pré-preenche a quantidade de
módulos; **não aplica automaticamente** o projeto inteiro).

## FASE 11 — CRITÉRIOS TÉCNICOS

Todas as topologias respeitam: Voc estimado < Vmáx do inversor; Isc por MPPT ≤
corrente máx (1 string/MPPT nos Huawei de 22 A); oversizing 0,94–1,19×. Motor
unit-tested: **18/18 coerentes, 0 problemas**.

## FASE 12 — RUNTIME

```
COSERN+T5/T7/T8 × string/micro/otimizador → todos HTTP 200, estrutura correta
T7 string → Huawei 50KTL, 6 MPPT, 6×18, Voc 936V, over 1.19
T8 string → Huawei 60KTL, 6×20, Voc 1040V (<1100), over 1.10
classe inválida (Z9) → HTTP 404 + classes_validas
```

---

## RESPOSTAS OBRIGATÓRIAS

1. **Quantas topologias criadas:** **18** (6 classes × 3 arquiteturas).
2. **Classes COSERN cobertas:** **6** (M2, M3, T5, T6, T7, T8).
3. **Arquiteturas cobertas:** **3** (string, micro, otimizador).
4. **JSON criado:** SIM (`COSERN_REFERENCE_TOPOLOGIES.json`).
5. **Motor de sugestão criado:** SIM (service + 2 endpoints).
6. **Frontend integrado:** SIM (painel no E7, botão opcional, gated COSERN).
7. **Runtime executado:** SIM (T5/T7/T8 × 3 + erro 404).
8. **Regressões:** nenhuma (aditivo; nada de governança/homologação/snapshot/EV/BESS/OCR/datasheet alterado).
9. **Commit:** `1c4515a` (+ docs).
10. **Pronto para uso operacional:** SIM como **sugestão/pré-config editável** — com a ressalva de validar os limites de classe com a NT COSERN.

---

## CRITÉRIO DE ACEITAÇÃO

> COSERN + M2/M3/T5/T6/T7/T8 + string/micro/otimizador → sugestão técnica inicial coerente e editável.

**ATENDIDO:** o motor retorna topologia coerente para qualquer combinação; o E7 mostra
e oferece "Aplicar" (pré-config), reduzindo o tempo do projetista sem substituir a engenharia final.

---

## VEREDITO

```
APROVADO — biblioteca de referência COSERN operacional (18 topologias, motor,
endpoint, frontend). Aditivo, sem regressões. Limites de classe a confirmar com NT COSERN.
```
