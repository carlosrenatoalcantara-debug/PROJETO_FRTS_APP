# MULTIARRANJO_STATUS_REPORT.md

**Sprint:** P2-FV-MULTIARRANJO-STATUS-01
**Data:** 2026-06-19
**Modelo:** Claude Sonnet 4.6
**Tipo:** Auditoria read-only — sem alterações de código

---

## DECLARAÇÃO DE HONESTIDADE

```
RAILWAY ACESSADO:     NÃO
VERCEL ACESSADO:      NÃO
RUNTIME EXECUTADO:    NÃO
LEITURA DE CÓDIGO:    SIM — E7Equipamentos.jsx, GerenciadorArranjos.jsx,
                            ProjetoFVContext.jsx
GIT LOG CONSULTADO:   SIM
```

---

## QUESTÃO 1 — Existe bloco visual independente para Arranjo A, B, C?

### Arranjo A (primário)

**NÃO existe um bloco rotulado "Arranjo A".**

O arranjo primário é implícito: está distribuído nas três seções colapsáveis
do topo de E7Equipamentos.jsx:

- Seção âmbar: **Módulos Fotovoltaicos** (via `SeletorPaineis`)
- Seção azul: **Inversores** (via `SeletorInversores`)
- Seção slate: **Estruturas de Fixação** (via `SeletorEstrutura`)
- Seção violeta: **Configuração Elétrica do Arranjo** (via `ConfiguradorArranjoFV`)

Nenhuma dessas seções usa a palavra "Arranjo A" na interface.
Os dados ficam em `state.equipamentos.painel`, `.inversor`, `.estrutura`.

### Arranjos secundários (B, C, D…)

**SIM — existem cards visuais independentes.**

`GerenciadorArranjos.jsx` renderiza `state.arranjos` (array) como uma lista
de cards. Cada card tem:

- Título editável (input com o rótulo, ex.: "Arranjo B")
- Sub-seção **Módulos** (lista de linhas Fabricante → Modelo → Qtd)
- Sub-seção **Inversores** (lista de linhas Fabricante → Modelo → Qtd)
- Sub-seção **Orientação / Inclinação** (select + número)
- Botões Duplicar e Excluir por card

Os cards são renderizados via `arranjos.map((a, i) => <div key={a.id}…>)`.

---

## QUESTÃO 2 — Cada arranjo possui módulos, inversores e estrutura próprios?

| Campo      | Arranjo A (primário)         | Arranjos B, C… (secundários)     |
|---|---|---|
| Módulos    | ✅ SIM — `equipamentos.painel` | ✅ SIM — `arranjo.paineis[]`      |
| Inversores | ✅ SIM — `equipamentos.inversor` | ✅ SIM — `arranjo.inversores[]`  |
| Estrutura  | ✅ SIM — `equipamentos.estrutura` | ❌ NÃO — sem campo estrutura    |

**Estrutura é GLOBAL** — única para todo o projeto (`SeletorEstrutura` em E7).
Não existe seleção de estrutura por arranjo secundário nem em `GerenciadorArranjos`
nem no shape de dados (`arranjos[]` não tem campo `estrutura`).

---

## QUESTÃO 3 — O botão "Adicionar Arranjo" cria card visual?

**SIM.**

`GerenciadorArranjos.jsx` linha 187:
```jsx
<Button variante="secundario" icone={Plus} onClick={addArranjo} tamanho="sm">
  Novo arranjo
</Button>
```

`addArranjo` (linha 80):
```js
const addArranjo = () => { const nova = [...arranjos, arranjoVazio(arranjos)]; setArranjos(nova) }
```

`arranjoVazio` cria: `{ id, rotulo: "Arranjo B", tipo: 'secundario', paineis: [], inversores: [], orientacao: 'Norte', inclinacao: '', somente_leitura: false }`

O novo arranjo aparece imediatamente na lista renderizada como um card vazio.

**Rótulo gerado:** A função `proximaLetra` (linhas 45-51) percorre as letras B–Z
e usa a primeira não ocupada. Se B, C, D já existem → próximo é E, etc.

---

## QUESTÃO 4 — Qual componente renderiza os arranjos?

| Camada | Componente | Arquivo |
|---|---|---|
| Arranjo primário (A) | `E7Equipamentos.jsx` | `frontend/src/components/fv/etapas/E7Equipamentos.jsx` |
| Arranjos secundários (B, C…) | `GerenciadorArranjos.jsx` | `frontend/src/components/fv/GerenciadorArranjos.jsx` |
| Sub-linhas (equipamento) | `LinhaEquip` (inner component) | Dentro de `GerenciadorArranjos.jsx` linha 104 |
| Contexto/estado | `ProjetoFVContext` | `frontend/src/contexts/ProjetoFVContext.jsx` |

`E7Equipamentos.jsx` importa e renderiza `<GerenciadorArranjos />` na linha 374:
```jsx
{/* ── Múltiplos Arranjos (FASE 1/3) ───────────────────────────────────── */}
<GerenciadorArranjos />
```

---

## QUESTÃO 5 — Quais commits implementaram o multiarranjo atual?

| Commit | Mensagem |
|---|---|
| `d32bd30` | `P1-PROJETO-AMPLIACAO-MULTIINVERSOR-01: arquitetura definitiva multi-arranjo (read-only)` |
| `e4b803f` | `P1-UX-CORE-EVOLUTION-01: funil enxuto, seletor de irradiacao, multiplos arranjos e ampliacao` |
| `6fed7f6` | `P1-UX-FRONT-CONNECT-01: conecta UI a multiplos arranjos, ampliacao e read-only` |
| `5506d34` | `P1-PROJETO-AMPLIACAO-MULTIINVERSOR-IMPLEMENT-01: arranjos[] com N inversores/tecnologias/expansoes` |
| `dd2ac3c` | `sprint(P1-MULTIARRANJO-UX-RESTORE-01): configurador de arranjos para instalacoes reais` |

---

## QUESTÃO 6 — Comparação com requisito do usuário

### Requisito:
```
Arranjo A: Módulos / Inversor / Estrutura
Arranjo B: Módulos / Inversor / Estrutura
Arranjo C: Módulos / Inversor / Estrutura
```

### Implementação atual:

```
┌─── E7 (seções colapsáveis globais) ─────────────────────────────────┐
│  [Módulos Fotovoltaicos]    ← Arranjo A (implícito, sem rótulo)     │
│  [Inversores]               ← Arranjo A (implícito)                 │
│  [Estruturas de Fixação]    ← GLOBAL — não pertence a um arranjo    │
│  [Configuração Elétrica]    ← Arranjo A (implícito)                 │
└─────────────────────────────────────────────────────────────────────┘

┌─── GerenciadorArranjos (card B) ────────────────────────────────────┐
│  Arranjo B                                                           │
│  ├── Módulos: [Fabricante] [Modelo] [Qtd]                           │
│  ├── Inversores: [Fabricante] [Modelo] [Qtd]                        │
│  └── Orientação / Inclinação                                        │
│  ❌ SEM ESTRUTURA                                                    │
└─────────────────────────────────────────────────────────────────────┘

┌─── GerenciadorArranjos (card C) ────────────────────────────────────┐
│  Arranjo C                                                           │
│  ├── Módulos: [Fabricante] [Modelo] [Qtd]                           │
│  ├── Inversores: [Fabricante] [Modelo] [Qtd]                        │
│  └── Orientação / Inclinação                                        │
│  ❌ SEM ESTRUTURA                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## QUESTÃO 7 — Classificação

### ATENDE PARCIALMENTE

---

## QUESTÃO 8 — O que falta

| # | Gap | Detalhe |
|---|---|---|
| 1 | **Arranjo A sem rótulo visual** | Não existe bloco "Arranjo A" na tela. O usuário não vê que as seções globais correspondem ao Arranjo A. |
| 2 | **Estrutura não é por arranjo** | `GerenciadorArranjos` não tem seção de estrutura. Só existe uma estrutura global em E7 (`SeletorEstrutura`). |
| 3 | **Shape de dados sem estrutura** | `arranjos[]` no ProjetoFVContext e no shape de backend (`blocoParaBackend`) não tem campo `estrutura`. |
| 4 | **Arranjo A sem integração visual com B, C** | A e B/C são experiências separadas (seções globais vs cards do GerenciadorArranjos). O usuário precisa entender que as seções globais = Arranjo A e os cards abaixo = B, C. Não há linha visual conectando os dois. |
| 5 | **Quantidade de módulos por arranjo secundário** | `GerenciadorArranjos` registra `quantidade` por linha de módulo, mas não tem campo `quantidadeTotal` nem integração com estimativa de E5 por arranjo. O número de módulos do sistema completo não é redistribuído entre os arranjos. |

---

## SUMÁRIO EXECUTIVO

```
BLOCOS VISUAIS INDEPENDENTES
  Arranjo A:  NÃO — implícito nas seções globais de E7 (sem rótulo "Arranjo A")
  Arranjo B:  SIM — card em GerenciadorArranjos
  Arranjo C:  SIM — card em GerenciadorArranjos (criado via "Novo arranjo")

CAMPOS POR ARRANJO
  Módulos:    PARCIAL — A via seletor global, B/C via array paineis[]
  Inversores: PARCIAL — A via seletor global, B/C via array inversores[]
  Estrutura:  NÃO — única estrutura global, sem vinculação por arranjo

BOTÃO "Novo arranjo": FUNCIONA — cria card visual imediatamente

COMPONENTES
  Primário (A):     E7Equipamentos.jsx
  Secundários (B+): GerenciadorArranjos.jsx

CLASSIFICAÇÃO FINAL: ATENDE PARCIALMENTE
```
