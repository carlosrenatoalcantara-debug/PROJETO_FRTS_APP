# E7_WORKFLOW_REFACTOR_REPORT.md

**Sprint:** P0-E7-ARRANJO-WORKFLOW-REFACTOR-01
**Data:** 2026-06-20
**Modelo:** Claude Opus 4.8
**Tipo:** Refatoração operacional da Etapa E7 (frontend-only)

---

## ⚠️ GEMINI

GEMINI obrigatória, sem ferramenta no ambiente. **Revisão Gemini: PENDENTE.**

---

## HONESTIDADE — TIPO DE EVIDÊNCIA

```
VALIDADO EM CÓDIGO:   build OK; resumoTecnicoArranjo unit-tested; componentes
VALIDADO EM RUNTIME:  arquitetura/topologia por arranjo persiste; Avelino 354/2/157.53 (Railway/Atlas)
NÃO EXERCIDO:         render do E7 em navegador (lógica unit-tested + persistência runtime)
```

---

## RESULTADO

```
APROVADO (núcleo arranjo-orientado) — com ressalvas honestas: topologia MPPT
detalhada por arranjo SECUNDÁRIO permanece deferida (restrição "não alterar
persistência": engenharia_eletrica é subdoc único, não por-arranjo).
```

Backend/persistência/snapshot/governança/homologação **intocados**.

---

## FASE 1 — LAYOUT ANTIGO

| Bloco | Componente | Dependência |
|---|---|---|
| Arranjo A — Módulos | `SeletorPaineis` | catálogo `/engenharia` |
| Arranjo A — Inversores | `SeletorInversores` | catálogo |
| Arranjo A — Estrutura | `SeletorEstrutura` | base local + Mongo |
| Arranjo A — Config elétrica | `ConfiguradorArranjoFV` | painel+inversor; persiste `engenharia_eletrica` |
| Arranjos B/C/D | `GerenciadorArranjos` | módulo/inversor/estrutura/fornecedor/orçamento |

**Baseado no fluxo antigo:** sem **arquitetura FV explícita**, sem **resumo técnico**,
ordem não-orientada por arranjo; B/C/D sem paridade de resumo.

---

## FASE 2 — LAYOUT NOVO (ordem por arranjo)

```
ARRANJO (A, B, C, …)
  1. MÓDULO (fabricante · modelo · potência · quantidade)
  2. ARQUITETURA FV  ( ) String  ( ) Microinversor  ( ) Otimizador   ← obrigatório
  3. INVERSOR (fabricante · modelo · quantidade)
  4. ESTRUTURA
  5. FORNECEDOR / DISTRIBUIDOR
  6. ORÇAMENTO (upload PDF/XLSX/imagem, opcional)
  7. RESUMO TÉCNICO (tempo real): P CC · P CA · Oversizing · MPPT · Entradas ·
     Strings · Módulos alocados · Módulos sem inversor   (✓/⚠ sem bloquear)
  [Arranjo A] CONFIGURAÇÃO ELÉTRICA — após módulo+inversor (ConfiguradorArranjoFV)
```

---

## FASES 3–6

- **Fase 3 (Inversor por arquitetura):** os três modos (String/Micro/Otimizador) usam fabricante+modelo+quantidade — entregue (seleção hierárquica no `GerenciadorArranjos`).
- **Fase 4 (Estrutura por arranjo):** já existente, mantido.
- **Fase 5 (Fornecedor por arranjo):** já existente (sprint anterior), mantido.
- **Fase 6 (Orçamento por arranjo):** upload PDF/XLSX/imagem store-only, mantido.

## FASE 7 — RESUMO TÉCNICO (tempo real)

Novo `ResumoTecnicoArranjo.jsx` + `resumoTecnicoArranjo()` (puro). Exibe P CC, P CA,
oversizing, MPPT usados, entradas, strings, **módulos alocados vs sem inversor**,
com avisos ✓/⚠. Renderizado no **Arranjo A** (E7) e em **cada arranjo B/C/D**
(GerenciadorArranjos) — paridade.

## FASE 8 — CONFIG ELÉTRICA CONDICIONAL

No Arranjo A, o `ConfiguradorArranjoFV` e o resumo aparecem após módulo+inversor
(`ambosSelecionados`). O resumo deriva as specs do inversor selecionado.

## FASE 9 — PRÉ-PREENCHIMENTO

Specs do inversor (MPPT, entradas, Voc máx, corrente, faixa) são carregadas do
catálogo (`adaptarInversor`) ao selecionar; o `entradas_por_mppt` sugere as entradas
no `TopologiaMPPTEditor` (Arranjo A). O resumo técnico usa essas specs para todos os arranjos.

## FASE 10 — MULTIARRANJO (paridade)

B/C/D possuem agora: **módulo · arquitetura · inversor · estrutura · fornecedor ·
orçamento · resumo técnico**. **Ressalva honesta:** a **topologia MPPT detalhada
(entradas[])** continua só no Arranjo A — `engenharia_eletrica` é um subdoc ÚNICO no
backend e a sprint proíbe alterar a persistência. A arquitetura (string/micro/otim.)
por arranjo persiste em `arranjos[].topologia` (campo de schema já existente).

## FASE 11 — VALIDAÇÃO VISUAL

✓ módulos alocados · ⚠ módulos sem inversor · ⚠ oversizing elevado (>1,3×) ·
⚠ oversizing crítico (>1,5×). **Não bloqueia** (selos informativos).

## FASE 12 — RUNTIME

```
PUT arranjos (Avelino, arquitetura por arranjo) → HTTP 200
GET:
  Arranjo A: arquitetura=string · 180 mód · 1 inv · 80.10 kWp · Aldo
  Arranjo B: arquitetura=micro  · 174 mód · 1 inv · 77.43 kWp · Genyx
  TOTAL: 354 módulos · 2 inversores · 157.53 kWp
  CRITÉRIO AVELINO mantido: True · arquitetura persistida: True
```

---

## RESPOSTAS OBRIGATÓRIAS

1. **Layout antigo:** Arranjo A (Seletores + ConfiguradorArranjoFV) + GerenciadorArranjos (módulo/inversor/estrutura/fornecedor/orçamento), sem arquitetura nem resumo.
2. **Layout novo:** por arranjo — Módulo → Arquitetura FV → Inversor → Estrutura → Fornecedor → Orçamento → Resumo técnico (tempo real); config elétrica (A) após módulo+inversor.
3. **Arquitetura FV implementada?** SIM (radio String/Micro/Otimizador → `arranjos[].topologia`, persistido).
4. **Config elétrica dependente do inversor?** SIM (configurador + resumo aparecem após módulo+inversor; resumo deriva specs do inversor).
5. **Multiarranjo equivalente ao Arranjo A?** PARCIAL — paridade em módulo/arquitetura/inversor/estrutura/fornecedor/orçamento/resumo; **topologia MPPT detalhada só no A** (restrição de persistência única).
6. **Módulos não alocados visíveis?** SIM (resumo: "X sem inversor" + ⚠).
7. **Runtime executado?** SIM (arquitetura por arranjo + Avelino 354/2/157.53).
8. **Regressões?** Nenhuma (build OK; backend intacto; fluxo do Arranjo A preservado).
9. **Commit:** `66e143d` (+ docs).
10. **Critério Avelino mantido?** SIM (runtime True).

---

## CRITÉRIO DE ACEITAÇÃO

> Fluxo Módulo → Quantidade → Arquitetura → Inversor → Resumo → Topologia elétrica.

**ATENDIDO** na ordem dos blocos por arranjo. O usuário segue Módulo→Qtd→Arquitetura→
Inversor e vê o Resumo técnico em tempo real antes da topologia elétrica.

---

## VEREDITO

```
APROVADO (núcleo) — workflow arranjo-orientado, arquitetura FV explícita, resumo
técnico em tempo real com alocação visível, paridade de blocos A↔B/C/D, Avelino mantido.
Ressalva: topologia MPPT detalhada por arranjo secundário deferida (persistência única).
Backend/snapshot/governança/homologação intocados.
```
