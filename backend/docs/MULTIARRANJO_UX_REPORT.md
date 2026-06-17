# P1-MULTIARRANJO-UX-RESTORE-01 — Configurador de arranjos para instalações reais

> - **Data:** 2026-06-14 · **Executor:** Sonnet · **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE
> - **Commit:** separado (branch `sprint/p1-multiarranjo-ux`)
> - **Escopo:** UX de engenharia FV (apenas `frontend/src/components/fv/GerenciadorArranjos.jsx`).
>   **Sem alterar** arquitetura/Mongo/ProjetoFV/Atlas/Ativos/QR/Comissionamento/Segurança/Unifilar.

## VEREDITO

O configurador passou a refletir instalações reais: **cada arranjo tem N módulos e N inversores**
(fabricantes/modelos diferentes), seleção **hierárquica Fabricante → Modelo**, quantidade por item, e
**Novo / Duplicar / Excluir** arranjo + orientação/inclinação. Os 3 cenários reais foram **aceitos pelo
schema do backend sem adaptação**. Backend/persistência/API já existiam — mudança foi só de **UX**.

## FASE 1 — Auditoria do configurador atual (`GerenciadorArranjos.jsx`)

| Pergunta | Antes |
|---|---|
| 1. Onde o fabricante é selecionado? | **Não havia.** Um único `<select>` listava TODOS os módulos/inversores (lista gigante). |
| 2. Onde o modelo é selecionado? | No mesmo dropdown gigante (fabricante+modelo+potência juntos). |
| 3. Onde a quantidade é definida? | Só **quantidade de módulos** (1 campo); inversor sempre `quantidade:1`. |
| 4. Onde o arranjo é criado? | Botão "Adicionar Novo Arranjo" (`ADD_ARRANJO`); remover via lixeira. |
| 5. **Limitações** | **1 módulo + 1 inversor por arranjo**; sem Fabricante→Modelo; sem qtd de inversor; **sem orientação/inclinação**; **sem duplicar**. |

> O backend **já** suportava `arranjos[].paineis[]` e `arranjos[].inversores[]` (arrays) — a UI usava só o `[0]`.

## FASE 2 — Módulos (N por arranjo)

Cada arranjo tem uma lista de módulos, cada linha: **Fabricante ▼ · Modelo ▼ · Quantidade · 🗑**, com
**+ Adicionar módulo**. Permite **mesmo fabricante / modelos diferentes** e **fabricantes diferentes** no mesmo arranjo.

## FASE 3 — Inversores (N por arranjo)

Idêntico para inversores: **Fabricante ▼ · Modelo ▼ · Quantidade · 🗑**, com **+ Adicionar inversor**. Mistura de
fabricantes/modelos no mesmo arranjo permitida (ex.: Escola Pinheiro com SE 33.3K + SE 20.1K).

## FASE 4 — Arranjos

- **Novo arranjo**, **Duplicar arranjo** (cópia profunda, editável), **Excluir arranjo**.
- Cada arranjo possui: **módulos próprios · inversores próprios · orientação · inclinação**.
- *(Persistência de orientação/inclinação: o subdoc `arranjos[]` não tem esses campos e o schema **não foi
  alterado**; são UX/informativas — a orientação canônica fica nos **panos** (E6/Área).)*

## FASE 5 — Cenários reais (`MULTIARRANJO_REAL_SCENARIOS.md`)

Validados contra o **schema real do `ProjetoFV`** (`validateSync`) — **0 erros de arranjo**:
- **Fazenda Alice** — Arranjo 1: 75× OSDA 575 + 1× Deye SUN-25K-G · Arranjo 2: 80× DAH 610 + 1× Kehua SPI40.
- **Paulo Carlos** — Original (`somente_leitura`) + Ampliação.
- **Escola Pinheiro** — 1 arranjo com 74+64 = 138 módulos (2 modelos) + 2 inversores (SE 33.3K + SE 20.1K).

Representados **sem adaptações / sem gambiarras**.

## FASE 6 — Persistência

- **Shape aceito pelo schema** (validado). Salva via `salvarArranjos` → `salvarEtapa('arranjos', { lista })`
  (já existente). `blocoParaBackend` (E7) já faz **pass-through** de `paineis[]`/`inversores[]`.
- Reabertura hidrata via `SET_ARRANJOS`; o configurador lê `block.paineis[]`/`block.inversores[]`.
- Editar/Duplicar/Excluir operam sobre `state.arranjos` via `SET_ARRANJOS` (**action existente** — sem novo reducer).
- **Ressalva:** o round-trip **ponta-a-ponta no wizard autenticado** (salvar→fechar→reabrir na UI) não foi
  percorrido (rota atrás de login); o que está **verificado** é a compilação do componente (Vite) + a aceitação
  do shape pelo schema.

## FASE 7 — UX

- **Seleção hierárquica** Fabricante → Modelo (Modelo filtrado pelo fabricante) → **elimina listas gigantes**.
- Layout em **linhas compactas** (grid 4 colunas: Fab · Modelo · Qtd · 🗑) → **menos uso vertical**.
- Rótulo do arranjo editável inline; ações por ícone.

## Mudança (1 arquivo, sem arquitetura)
| Arquivo | Mudança |
|---|---|
| `frontend/src/components/fv/GerenciadorArranjos.jsx` | reescrito: N módulos + N inversores por arranjo, Fabricante→Modelo, qtd por linha, Novo/Duplicar/Excluir, orientação/inclinação. Usa `SET_ARRANJOS`. |

## Critério de aceite
✅ N módulos/inversores por arranjo · ✅ Fabricante→Modelo · ✅ Novo/Duplicar/Excluir · ✅ cenários reais
aceitos pelo schema · ✅ sem alterar backend/Mongo/ProjetoFV · ⚠️ round-trip autenticado não percorrido ·
⚠️ Revisão Gemini PENDENTE.

## Entregáveis
- `MULTIARRANJO_UX_REPORT.md` (este) · `MULTIARRANJO_REAL_SCENARIOS.md` · `MULTIARRANJO_UX_METRICS.json`
