# FV-UX-012A — Validação operacional do fluxo FV

**Data:** 2026-08-13
**Resultado:** fluxo comercial completo executado **pela interface nova**, com verificação no banco a cada passo. Nenhuma correção foi necessária.

---

## Decisão de ambiente — e por que produção não era opção

O `.env` do backend aponta para o **Atlas de produção** (`forte_solar`, 588 projetos). Três fatos, apurados por leitura antes de qualquer escrita:

| # | Fato | Consequência |
|---|---|---|
| 1 | As coleções `cotacaos` / `orcamentos` / `baselines` **não existem** em produção | o teste as criaria |
| 2 | A **Baseline é imutável e indeletável por desenho** (M-2; hooks bloqueiam `deleteOne`/`deleteMany`/`findOneAndDelete`) | um artefato de teste ficaria **permanentemente** no contrato de um projeto real |
| 3 | **Todos os 588 projetos têm `empresa_id: null`** e o RBAC é fail-closed desde a Fase 0.5 | nenhum token operaria sobre eles — **o fluxo nem executaria** |

O fato 3 encerra a discussão: produção não estava apenas desaconselhada, estava **tecnicamente bloqueada**.

Também não havia banco de desenvolvimento: `mongod` não está instalado e `.env.local` aponta para um `localhost:27017` inexistente.

**Solução:** [`ambiente-validacao-fv.mjs`](../backend/scripts/ambiente-validacao-fv.mjs) — MongoDB efêmero em porta fixa, semeado com empresa, cliente, catálogo e um projeto limpo. Backend real apontado para ele, frontend real, fluxo pela UI.

---

## §1 — Projeto de teste (estado inicial registrado)

```
projeto_id : 6a7daf9f27d8a60f4c8e93db
empresa_id : 6a7daf9f27d8a60f4c8e93d7
status     : rascunho        freeze_status : null
cotações   : 0    orçamentos : 0    baselines : 0
Gate       : engenharia=bloqueada  homologacao=bloqueada  (motivo: SEM_BASELINE)
```

Projeto **criado limpo** para o teste — nenhum projeto histórico foi alterado.

---

## §2 — Criar cotação (pela UI)

Preenchido em `/fv/projetos/:id/cotacao`: rótulo *"Cenário A — string 5kWp"*, tecnologia `string`, consumo 800 kWh/mês, tarifa R$ 0,92, HSP 5,2. Página recarregada; a cotação permaneceu.

**Verificação no banco:**

| Item | Resultado |
|---|---|
| `Cotacao` criada | ✅ 1 |
| pertence ao projeto correto | ✅ |
| pertence à organização correta | ✅ |
| premissas persistidas | `{consumo:800, tarifa:0.92, hsp:5.2}` |
| `criado_por` | `validacao@fortesolar.com.br` (do JWT) |
| **NÃO criou `Orcamento`** | ✅ 0 |
| **NÃO criou `Baseline`** | ✅ 0 |
| **`ProjetoFV.orcamento` intacto** | ✅ `null` |

---

## §3 — Criar orçamento (pela UI)

Cotação **selecionada explicitamente** no seletor. Itens: *Kit fotovoltaico 5kWp* (material, 1× R$ 20.000) e *Mão de obra e instalação* (serviço, 1× R$ 5.000).

A UI exibiu **R$ 25.000,00** — valor calculado pelo servidor, não pelo formulário.

**Verificação no banco:**

| Item | Resultado |
|---|---|
| Orçamento persistido | ✅ `ORC-VAL-001` / `RASCUNHO` |
| `cotacao_ref` correto | ✅ aponta a cotação criada (M-1) |
| projeto e organização corretos | ✅ |
| itens | 2, com tipos preservados |
| **totais persistidos no documento** | **NENHUM** ✅ — derivados a cada leitura (INV-58) |
| **`ProjetoFV.orcamento` intacto** | ✅ `null` |
| Baseline ainda ausente | ✅ |

---

## §4 — Emitir (pela UI)

Botão *Emitir* → estado passou a **EMITIDO** e o botão **desapareceu**: a UI refletiu o estado retornado pelo servidor, sem decidir nada.

Reload em `/aprovacao` confirmou a persistência — os marcos *Orçamento existe* e *Emitido ao cliente* apareceram preenchidos.

---

## §5 — Aprovar (pela UI)

Botão *Aprovar e congelar* → os cinco marcos fecharam:

```
● Orçamento existe   ● Emitido ao cliente   ● Aprovado
● Baseline gerada    ● Baseline íntegra
Contrato fechado — o projeto está congelado.
```

**Verificação no banco:**

| Item | Resultado |
|---|---|
| Orçamento | `APROVADO`, com `aprovado_em` e `aprovado_por` |
| `baseline_ref` no orçamento | ✅ aponta a Baseline gerada |
| Baseline criada | ✅ hash `c721d016…` |
| Total congelado | R$ 25.000 |
| Cotação congelada dentro do snapshot | `string` / *Cenário A — string 5kWp* |
| **`ProjetoFV.orcamento` intacto** | ✅ `null` |

**Imutabilidade — as três vias bloqueadas:**

```
updateOne        : bloqueado (BASELINE_IMUTAVEL)
findOneAndUpdate : bloqueado (BASELINE_IMUTAVEL)
deleteOne        : bloqueado (BASELINE_IMUTAVEL)
hash inalterado  : true
```

---

## §6 — Baseline e Gate (pela UI)

**Tela Baseline** exibiu integridade verificada, hash completo, quem congelou e quando, e a decomposição: materiais R$ 20.000 · serviços R$ 5.000 · **contratado R$ 25.000** · 2 itens · tecnologia `string`.

**Tela Gate:**

```
Decisão do domínio (autoritativa). · baseline ac67a3
Engenharia — liberada
Homologação — liberada
```

**Telas de fase:** ambas mostram *"Liberada pelo Gate"* e declaram que a conclusão não é rastreável (`concluida: null`) — não existe agregado que a registre (FV-DOM-006).

---

## Efeito colateral verificado: o contrato fecha o projeto

Com a Baseline criada, o wizard legado passou a ser recusado:

```
PUT /api/projetos-fv/:id/etapa  →  409 PROJETO_CONGELADO (motivo: CONTRATO)
```

O bloqueio veio do **contrato** (orçamento aprovado + baseline válida), não de `governanca.freeze_status` — que permaneceu `null` o tempo todo. É o contrato único da FV-DOM-002A funcionando ponta a ponta.

---

## Correções necessárias

**Nenhuma.** O fluxo executou integralmente na primeira tentativa, sem erro de interface, de payload ou de domínio.

---

## Regressão

| Check | Resultado |
|---|---|
| Suíte frontend | **idêntica ao baseline** — 25 falhas pré-existentes, 940 passando |
| `agregadosFv` · `fluxoComercialEscrita` · `fluxoCanonico` · `congelamento` · `legadoOrcamento` · `lme` | ✓ todos |
| **Produção intocada** | ✅ 588 projetos; `cotacaos`/`orcamentos`/`baselines` seguem **NÃO EXISTINDO** |

Ambiente encerrado; token e credenciais de teste removidos.

---

## Critério de conclusão

| Exigência | Status |
|---|---|
| Fluxo executado pela nova UX | ✅ Cotação → Orçamento → Emitir → Aprovar → Baseline → Gate |
| Wizard clássico **não** usado para as operações | ✅ — e passou a ser recusado com 409 |
| Verificação no banco a cada passo | ✅ |
| Totais derivados pelo servidor | ✅ nenhum total persistido |
| `ProjetoFV.orcamento` intacto | ✅ `null` do início ao fim |
| Baseline imutável | ✅ 3 vias bloqueadas |
| Sem regressão | ✅ |

**Nada commitado.**
