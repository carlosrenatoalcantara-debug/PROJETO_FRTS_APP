# EV_WORKFLOW_SIMPLIFICATION_REPORT.md

**Sprint:** P0-EV-WORKFLOW-SIMPLIFICATION-01
**Data:** 2026-06-20
**Modelo:** Claude Opus 4.8
**Tipo:** Auditoria + Simplificação do fluxo EV (READ-ONLY — nenhuma alteração de código)

---

## ⚠️ GEMINI — revisão cruzada PENDENTE (sem ferramenta no ambiente)

## DECLARAÇÃO DE HONESTIDADE

```
VALIDADO EM CÓDIGO:  campos do modelo, cadastro datasheet-only, motor de dimensionamento,
                     BOM automático, materiais display-only, ausência de etapa de orçamento
                     (4 etapas), unifilar automático.
VALIDADO EM RUNTIME: dimensionamento + BOM dos 3 cenários (motor NBR replicado + BOM real).
NÃO TESTADO:         fluxo EV completo no navegador (criar/salvar/gerar unifilar visual);
                     extração de datasheet via Claude Vision.
```

## RESULTADO

```
EV NÃO está pronto para uso comercial. Dimensionamento, materiais (auto) e unifilar
são sólidos; falta a etapa de ORÇAMENTO e materiais editáveis.
```

---

## FASE 1 — CADASTRO DE CARREGADORES

`CarregadorEV.js` tem **~30 campos**; o cadastro (`ModalNovoCarregadorEV`) é **datasheet-only** (upload PDF → Claude Vision), **sem form manual**.

| Categoria | Qtd | Campos |
|---|---|---|
| **Obrigatórios** | 4 | tipo, potencia_kw, marca, modelo |
| **Opcionais → "Dados Avançados"** | 14 | frequência, eficiência, FP, IP, temperatura, peso, dimensões, protocolo, tipo_carregamento, tempo_carga, comunicação, garantia, datasheet, DC (tensão/corrente) |
| **Inúteis p/ projeto** | 3 | disjuntor_recomendado_a, dr_recomendado_ma, bitola_cabo_minima_mm2 (calculados pelo motor) |

1. **Quantos campos existem:** ~30.
2. **Obrigatórios:** 4.
3. **Para "Dados Avançados":** 14.
4. **Sem utilidade para engenharia:** 3 (proteções recomendadas — redundantes).
→ **17 campos podem sair do fluxo principal.**

## FASE 2 — CADASTRO MÍNIMO

**Definido (8 campos):** Fabricante · Modelo · Potência kW · Tensão (127/220/380) · Fases (mono/bi/tri) · Tipo de plug (Tipo1/Tipo2/CCS2/GB-T/NACS) · Qtd conectores · OCPP (sim/não).

**Gaps no modelo atual:** falta `qtd_conectores`, `OCPP` (boolean), `tipo_conector` é String livre (sem enum de plug), tensão sem enum, `fases` enum [1,3] **sem Bifásico**, e **não há cadastro manual** (só datasheet).

## FASE 3 — DIMENSIONAMENTO

**SIM.** `calculosNBR5410EV` calcula **corrente, cabo, disjuntor, DR, DPS** + queda de tensão (3%), tempo de seccionamento e `validarNBR5410`. Operacional.

## FASE 4 — MATERIAIS

1. **Existe?** SIM — `gerarBOM` (11 itens: carregador, cabo, disjuntor, DR, DPS×2, eletroduto, abraçadeiras, fixações, fita, haste, conectores).
2. **É editável?** **NÃO** (exibido em `<ul>` read-only).
3. **Adicionar item?** NÃO.
4. **Remover item?** NÃO.
5. **Alterar quantidade?** NÃO.

## FASE 5 — ORÇAMENTO

1. Equipamentos? **NÃO.** 2. Materiais? **NÃO.** 3. Serviços? **NÃO.** 4. Margem? **NÃO.**
→ **A etapa de orçamento NÃO existe.** O fluxo do `NovaPropostaEV` tem **4 etapas** (Localização → Carregadores → Cálculos+Materiais → Unifilar). O campo `ProjetoEV.financeiro` existe mas **não é preenchido**.

## FASE 6 — UNIFILAR

1. **Geração automática?** SIM (`gerarUnifilarEVSVG`). 2. **Dados:** cálculos NBR + dados do projeto + carregadores. 3. **Depende de aprovação de orçamento?** NÃO (etapa 4; orçamento inexistente). 4. **Operacional?** SIM (modo edição, download, recalcular).

## FASE 7 — RUNTIME (3 cenários)

| Cenário | I | Imax | Cabo | Disj | DR | DPS | Queda | BOM |
|---|---|---|---|---|---|---|---|---|
| A · 7,4kW/220V mono | 35,4A | 44,3A | 10mm² | 50A | 300mA | 275V | 0,58% | 11 |
| B · 22kW/380V tri | 35,2A | 44,0A | 10mm² | 50A | 300mA | 420V | 0,50% | 11 |
| C · 2×22kW/380V tri | 70,4A | 88,0A | 35mm² | 100A | 300mA | 420V | 0,28% | 11 |

Dimensionamento + materiais corretos nos 3. O fluxo quebra no **Orçamento** (não há materiais→preço→margem antes do unifilar).

## FASE 8 — GARGALOS

| ID | Sev | Gargalo |
|---|---|---|
| EV-GAP-01 | **CRÍTICO** | Orçamento inexistente (sem preço/custo/margem/serviços) |
| EV-GAP-02 | ALTO | Cadastro de carregador datasheet-only (sem form manual) |
| EV-GAP-03 | ALTO | Materiais não editáveis (sem add/remove/qtd) |
| EV-GAP-04 | MÉDIO | Cadastro mínimo incompleto (qtd conectores, OCPP, enums, bifásico) |
| EV-GAP-05 | MÉDIO | ~17 campos avançados/inúteis no cadastro |
| EV-GAP-06 | BAIXO | DR fixo 300mA p/ >40A; conector/protocolo como String livre |

## FASE 9 — ROADMAP

Ver `EV_WORKFLOW_SIMPLIFICATION_ROADMAP.md`. Resumo: **P0** orçamento + materiais editáveis; **P1** cadastro manual mínimo + dados avançados; **P2** refinamentos.

---

## RESPOSTAS OBRIGATÓRIAS

1. **Campos removíveis do fluxo principal:** **17** (de ~30; mínimo operacional = 8).
2. **Cadastro mínimo definido:** SIM (8 campos).
3. **Materiais automáticos existem?** SIM (`gerarBOM`).
4. **Lista editável existe?** NÃO.
5. **Orçamento operacional?** NÃO (etapa inexistente).
6. **Unifilar operacional?** SIM.
7. **Runtime executado?** SIM (3 cenários — dimensionamento + BOM).
8. **Principais gargalos:** Orçamento inexistente (CRÍTICO); cadastro datasheet-only (ALTO); materiais não editáveis (ALTO).
9. **Próxima sprint recomendada:** **P0-EV-ORCAMENTO-MATERIAIS-01** (criar orçamento + materiais editáveis).
10. **EV pronto para uso comercial?** **NÃO** — falta a etapa de orçamento para fechar `carregador → materiais → orçamento → unifilar`.

---

## CRITÉRIO DE ACEITAÇÃO

- **O que é necessário para projetar um carregador EV:** os 8 campos mínimos (Fase 2) + distância → o motor já calcula corrente/cabo/disjuntor/DR/DPS e gera materiais e unifilar.
- **O que pode sair da tela principal:** os 17 campos avançados/inúteis (→ "Dados Avançados").
- **O que falta para `carregador → materiais → orçamento → unifilar`:** a **etapa de orçamento** (equipamentos+materiais+serviços+margem) e a **edição da lista de materiais**.

---

## VEREDITO

```
EV FUNCIONAL para dimensionamento/materiais/unifilar, mas NÃO PRONTO COMERCIALMENTE:
falta a etapa de ORÇAMENTO e materiais editáveis. Cadastro orientado a equipamento
(datasheet-only, ~17 campos supérfluos) deve virar orientado a projeto.
```
