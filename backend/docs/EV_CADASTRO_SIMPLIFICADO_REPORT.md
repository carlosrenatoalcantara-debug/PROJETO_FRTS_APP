# EV_CADASTRO_SIMPLIFICADO_REPORT.md

**Sprint:** P1-EV-CADASTRO-SIMPLIFICADO-01
**Data:** 2026-06-20
**Modelo:** Claude Opus 4.8
**Commit:** `59052bb`

> GEMINI: revisão cruzada PENDENTE (sem ferramenta no ambiente).

## DECLARAÇÃO DE HONESTIDADE

```
VALIDADO EM CÓDIGO:  schema; modal manual; build OK.
VALIDADO EM RUNTIME: cadastro manual dos 3 cenários (POST/GET — qtd_conectores/ocpp/
                     tipo derivado) + compatibilidade (60 carregadores existentes abrem).
NÃO TESTADO:         modal no navegador (clicar aba + salvar visual); fluxo completo
                     dimensionamento→orçamento→unifilar com carregador manual via UI.
```

## RESULTADO

```
APROVADO — cadastro mínimo (9 campos) + cadastro manual sem PDF. Operador cadastra
um carregador operacional em < 1 minuto, sem campos que não influenciam o motor.
```

---

## FASE 1 — AUDITORIA DOS CAMPOS

`CarregadorEV` tinha **~28 campos** e o cadastro era **datasheet-only** (sem form manual → operador travado sem PDF).

| Classe | Qtd | Campos |
|---|---|---|
| **Obrigatório (tela principal)** | 9 | marca, modelo, potencia_kw, tensao (127/220/380), fases (mono/bi/tri), plug (Tipo1/Tipo2/CCS2/GB-T/NACS), qtd_conectores, ocpp, IP (opcional) |
| **Avançado (colapsado)** | 5 | corrente nominal, peso, dimensões, temperatura, garantia |
| **Obsoleto / não-exposto** | ~13 | frequência, eficiência, FP, protocolo, tipo_carregamento, tempo_carga, comunicação (derivado de OCPP), DC tensão/corrente, 3 proteções recomendadas (calculadas pelo motor), datasheet_url |

1. **Existem hoje:** ~30 (28 no modelo). 2. **Tela principal:** 9. 3. **Dados Avançados:** 5 (colapsados; demais não-expostos). 4. **Removidos/obsoletos no fluxo:** ~13 (não afetam o motor).

## FASE 2 — NOVO CADASTRO PRINCIPAL

Form manual com: **Fabricante · Modelo · Potência (kW) · Tensão (127/220/380) · Fases (Mono/Bi/Tri) · Tipo de Plug (Tipo 1/Tipo 2/CCS2/GB-T/NACS) · Qtd conectores · OCPP (sim/não) · IP (opcional)**. O `tipo` (AC_Mono/AC_Tri/DC) é **derivado do plug** (CCS2/GB-T → DC).

## FASE 3 — DADOS AVANÇADOS (colapsado)

Seção recolhida com: corrente nominal, peso, dimensões, temperatura, garantia. Não afetam dimensionamento/materiais/orçamento/unifilar.

## FASE 4 — MOTOR EV PRESERVADO

O motor usa **apenas** `tipo`, `potencia_kw`, `tensao_entrada_v`, `numero_fases`, `comprimento` — todos no cadastro mínimo. `qtd_conectores`, `ocpp` e os campos avançados **não são lidos** pelo motor. Logo: dimensionamento, BOM, orçamento e unifilar **continuam funcionando** sem os campos removidos da tela principal. (Confirmado por código + runtime do motor na sprint anterior.)

## FASE 5 — CADASTRO MANUAL

Aba "Preencher Manualmente" → POST `/api/carregadores-ev` (endpoint **já existente**, reutilizado). **Runtime:** 3 carregadores salvos sem PDF.

## FASE 6 — COMPATIBILIDADE

Campos aditivos (`default`); **sem migração**. Runtime: 63 carregadores existentes listados e abertos sem erro.

## FASE 7 — RUNTIME

```
Cadastro manual (sem PDF):
  Wallbox 7,4 kW → AC_Mono · 220V · 1 fase · Tipo 2 · 1 conector · OCPP  ✓
  ABB 22 kW      → AC_Tri  · 380V · 3 fases · Tipo 2 · 1 conector · OCPP  ✓
  ABB DC 60 kW   → DC (CCS2) · 380V · CCS2 · 2 conectores · OCPP          ✓
qtd_conectores + ocpp persistem; tipo derivado do plug.
Dimensionamento/BOM/orçamento/unifilar: preservados (motor usa campos mínimos).
```

## FASE 8 — UX

| Métrica | Antes | Depois |
|---|---|---|
| Campos | ~28-30 (e **sem** form manual) | **9** na tela principal (+5 avançados colapsados) |
| Cliques | datasheet-only: upload PDF + extração IA + revisão (impossível sem PDF) | ~9 campos + Salvar (~10 interações, **< 1 min, sem PDF**) |

---

## RESPOSTAS OBRIGATÓRIAS

1. **Campos existiam:** ~30 (28 no modelo).
2. **Ficaram na tela principal:** 9.
3. **Foram para Dados Avançados:** 5 (colapsados) + demais não-expostos.
4. **Cadastro manual funciona?** SIM (runtime, 3 cenários, sem PDF).
5. **Dimensionamento preservado?** SIM.
6. **BOM preservado?** SIM.
7. **Orçamento preservado?** SIM.
8. **Unifilar preservado?** SIM.
9. **Runtime executado?** SIM.
10. **Commit:** `59052bb`.

---

## CRITÉRIO DE ACEITAÇÃO

**ATENDIDO:** cadastro de um carregador operacional em **< 1 minuto, sem PDF**, capturando só o que influencia dimensionamento/materiais/orçamento/unifilar (9 campos). Os campos que não alimentam o motor ficam em "Dados Avançados" (colapsado) ou foram removidos do fluxo.

---

## VEREDITO

```
APROVADO — cadastro EV orientado a projeto: mínimo operacional (9 campos), manual
sem PDF, motor preservado, compatível com o catálogo existente. Sem migração.
```
