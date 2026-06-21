# FV_ENGINEERING_WORKFLOW_REPORT.md

**Sprint:** P0-FV-ENGINEERING-WORKFLOW-CONSOLIDATION-01
**Data:** 2026-06-20
**Modelo:** Claude Opus 4.8
**Tipo:** Consolidação final do fluxo FV — E7 como fonte única

---

## ⚠️ GEMINI

GEMINI obrigatória, sem ferramenta no ambiente. **Revisão Gemini: PENDENTE.**

---

## HONESTIDADE — TIPO DE EVIDÊNCIA

```
VALIDADO EM CÓDIGO:   agregador (unit), build frontend, schema, componentes UI
VALIDADO EM RUNTIME:  caso Avelino (persist arranjos + agregação = 354/2/157.53),
                      fornecedor + orçamento round-trip (Railway/Atlas)
NÃO EXERCIDO:         renderização do E8 em navegador (lógica unit-tested + persist runtime)
```

---

## RESULTADO

```
APROVADO (critério Avelino atendido) — com ressalvas honestas nas Fases 2/6 (reorg
visual completa de E7 e topologia MPPT por arranjo secundário) parcialmente entregues.
```

---

## FASE 1 — RCA ORÇAMENTO (BUG-E8-01)

| Pergunta | Resposta |
|---|---|
| 1. Qual fonte a E8 usava? | `dim.numPaineis` / `dim.numInversores` (subdoc `dimensionamento` = estimativa do E5) |
| 2. Usava E5? | **SIM** — todas as ~20 referências de orçamento/resumo/PDF liam `dim.*` |
| 3. Usava E7? | **NÃO** — ignorava `state.arranjos[]` (multiarranjo configurado) |
| 4. Recalculava? | Sim — exibia a estimativa do E5 (ex.: 221 mód / 550W / 17 inv) em vez da config real |
| 5. Dado ignorado? | Os **arranjos[]** inteiros (Arranjo A em `equipamentos` + B/C em `state.arranjos`) |

**Causa-raiz:** o E8 nunca agregava os arranjos; para multiarranjo, somava nada dos secundários e usava a estimativa do E5 (550W = `potenciaPainelW` default).

**Correção:** novo `agregarTotaisArranjos(state)` (fonte única) que espelha o
`montarArranjosPayload()` do E7. O E8 **sombreia `dim`** com os totais agregados:
```js
const dim = useMemo(() => ({ ...dimBase,
  numPaineis:      totais.modulos,
  numInversores:   totais.inversores,
  potenciaRealKwp: totais.kwp }), [dimBase, totais])
```
Assim TODAS as referências `dim.*` passam a derivar de E7 — zero alteração pontual,
zero recálculo do E5. Fallback para `dim` original quando não há arranjos.

**Validação:** unit test do caso Avelino → **354 módulos, 2 inversores, 157.53 kWp**.

---

## FASE 8 — CONSISTÊNCIA (fonte única arranjos[])

Implementada como regra de derivação: `agregarTotaisArranjos` é a única fonte de
módulos/inversores/potência consumida pela E8. Proibido recalcular no E8 — os
valores vêm dos arranjos. O painel **"Resumo por arranjo · fonte única (E7)"** na
E8 torna a derivação visível e auditável.

---

## FASE 3 — DISTRIBUIDOR

Schema aditivo `arranjos[].fornecedor { nome, contato, observacoes }`. UI em
`GerenciadorArranjos`: campo com sugestões (Aldo, Genyx, Canal Solar, SolarZ, Sou
Energy, Edeltec, Fortlev) + contato + observações, por arranjo. **Runtime:** Aldo/Genyx persistidos.

## FASE 4 — ORÇAMENTO DISTRIBUIDOR

Schema aditivo `arranjos[].orcamento_distribuidor { nome, tipo, tamanho, data_upload,
conteudo_base64 }`. Upload PDF/XLSX/imagem (cap 4MB), **apenas armazenamento, SEM OCR**.
**Runtime:** metadata `orc_aldo.pdf` (pdf) persistida.

## FASE 5 — VALIDAÇÃO DE ALOCAÇÃO

`validarAlocacao(totalModulos, inversores)` → `{ atendidos, semInversor, suficiente }`.
Não bloqueia. **Unit test:** 100 módulos / TSUN ×10 (cap 40) → 40 atendidos, 60 sem inversor.
*Ressalva:* o surfacing visual completo na UI (capacidade real por inversor) é parcial.

## FASE 7 — MPPT INTEGRADO

A carga automática já existe: `adaptarInversor` (catálogo) expõe `tensao_max_entrada,
mppt_min/max, corrente_max_mppt, entradas_por_mppt` → `SeletorInversores` →
`ConfiguradorArranjoFV`. O `entradas_por_mppt` sugere as entradas no
`TopologiaMPPTEditor` (sprint anterior), com edição manual. **Satisfeito pelo código existente.**

## FASES 2 / 6 — REORG E7 / MULTIARRANJO (PARCIAL — honesto)

`GerenciadorArranjos` já entrega, por arranjo: **Módulo+qtd · Inversor+qtd · Estrutura
· Fornecedor · Orçamento**. A **agregação multiarranjo** (A+B+C) está correta e
validada. **NÃO entregue nesta sprint:** o layout visual exato "Linha 1..5" e a
**topologia MPPT detalhada por arranjo secundário** (hoje a topologia detalhada é do
Arranjo A). Deferido para sprint de UX dedicada.

---

## RESPOSTAS OBRIGATÓRIAS

1. **Por que E8 divergia:** lia `dim.numPaineis/numInversores` (estimativa E5) e ignorava `arranjos[]`.
2. **Como corrigido:** agregador de fonte única (`arranjos[]`) + sombreamento de `dim` no E8.
3. **E7 virou fonte única?** SIM para módulos/inversores/potência (runtime: Avelino 354/2/157.53).
4. **Multiarranjo completo?** Agregação SIM; UI por arranjo (módulo/inversor/estrutura/fornecedor/orçamento) SIM; topologia MPPT por arranjo secundário PARCIAL (deferida).
5. **Fornecedor implementado?** SIM (schema + UI + runtime).
6. **Upload de orçamento implementado?** SIM (schema + UI store-only, sem OCR + runtime).
7. **Módulos não alocados detectados?** SIM (helper unit-tested 40/60); surfacing UI parcial.
8. **Runtime executado?** SIM (Avelino + fornecedor/orçamento round-trip).
9. **Regressões?** Nenhuma no build/runtime; modo simples/kit preservados; fallback para `dim` sem arranjos.
10. **Commit gerado:** `f5b08fa` (+ docs).

---

## CRITÉRIO DE ACEITAÇÃO

> Avelino deve gerar 354 módulos, 445W, 157.53 kWp, 1 Huawei 60KTL + 1 Huawei 50KTL,
> sem divergência entre E7/Unifilar/Orçamento/Snapshot.

**ATENDIDO no núcleo:** runtime confirmou 354 / 157.53 kWp / 2 inversores (60KTL+50KTL),
derivados de `arranjos[]`. O Orçamento (E8) agora deriva da mesma fonte; o Unifilar
consome `dim` agregado (header correto); o Snapshot parte de `arranjos[]` persistido.
**Ressalva:** desenho por-arranjo do unifilar e reorg visual de E7 não foram alterados.

---

## VEREDITO

```
APROVADO — BUG-E8-01 corrigido, E7 = fonte única (runtime Avelino 354/2/157.53),
fornecedor + orçamento por arranjo implementados. Homologação/governança/snapshot intactos.
Ressalvas: Fases 2/6 (reorg visual + MPPT por arranjo secundário) e surfacing de alocação — parciais.
```
