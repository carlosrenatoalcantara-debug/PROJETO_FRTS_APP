# FV-UX-013 — Inventário do UX FV legado e bloqueio da remoção

**Data:** 2026-08-13
**Status:** FASE 1 e FASE 2 concluídas. **Remoção do wizard PARADA e reportada** — duas dependências ambíguas bloqueantes.

---

## Método

A sprint exige remoção "baseada em auditoria de dependências, não em exclusão cega". Construí o **grafo de imports** do frontend ([`inventario-fv-legado.mjs`](../frontend/scripts/inventario-fv-legado.mjs)): 244 módulos, arestas extraídas de `import`, `import()` dinâmico e `require`, com **comentários descartados** para não gerar aresta falsa.

Cada arquivo foi classificado por **quem o alcança transitivamente** — não por ter "fv" no nome.

---

## FASE 1 — Inventário

| Categoria | Qtd | Decisão |
|---|---|---|
| Exclusivo do wizard legado | **104** | REMOVER — **bloqueado**, ver §Bloqueio |
| Compartilhado com outros módulos | 26 | PRESERVAR |
| Órfãos (0 alcançadores) | 21 | REMOVER se código morto |
| Árvore nova (`fv/`) | 30 | PRESERVAR |

### Compartilhados relevantes (PRESERVAR)

| Arquivo | Alcançado por |
|---|---|
| `services/projetoFVApi.js` | **`pages/PropostaPublica.jsx`** (rota pública `/p/:token`) |
| `utils/catalogQualityEngine.js` | `pages/Catalogo.jsx` |
| `components/diagram/**` (10) | `NovaPropostaEV`, `ProjetosEVDetalhes` — **módulo EV** |
| `components/ui/**`, `context/AuthContext`, `hooks/*`, `utils/rbac` | toda a aplicação |

### Código morto confirmado e REMOVIDO (4 arquivos, 930 linhas)

`components/fv/AbaFinanceiro.jsx` · `AssistenteDatasheet.jsx` · `Proposta.jsx` · `SeletorEquipamentos.jsx`

Todos com **0 importadores** e **0 testes**. Verifiquei individualmente:
- `AbaFinanceiro` parecia usado em `ProjetosFVDetalhes:259`, mas ali é uma **função local** declarada em `:627` — o componente em `components/fv/` é outro, e morto.
- `Proposta` aparecia em um teste, mas era o texto `'Proposta'` num fixture de projeto — falso positivo por substring.

### Órfãos NÃO removidos (fora do escopo FV ou com teste)

`components/ev/UnifilarEV.jsx` · `components/diagram/componentes/ComponenteSVG.jsx` (módulo EV/diagram) · `components/ui/ColorPicker.jsx`, `LogoUpload.jsx` (UI genérica) · `utils/ocr.js` (4 testes), `qualidadeEquipamento.js` (1 teste), `calcularBitolaCabo.js`, `gerarPdfSimulacao.js`.

---

## FASE 2 — Entradas do wizard clássico

| Origem | Destino |
|---|---|
| `Sidebar:21` | `/projetos-fv` — item "Fotovoltaico (clássico)" |
| `Header:9,10` | títulos das rotas legadas |
| `App.jsx:59,61,66,67,68,75` | 6 rotas registradas |
| `Dashboard:116,127` | `/projetos-fv/novo` — **2 botões "Novo"** |
| `Clientes:631,641` | `/projetos-fv/novo` e `/projetos-fv/:id` |
| `ClienteGerenciamento:280,308,309` | `/projetos-fv/novo?clienteId=` e `/projetos-fv/:id` |
| `CRM:412` | `/propostas/nova?leadId=` |
| `FaturaRevisao:86` | `/projetos-fv` |
| `fv/paginas/ListaProjetos:55` | link de escape para a listagem clássica |

**7 entradas em 5 módulos externos** (Dashboard, Clientes, ClienteGerenciamento, CRM, FaturaRevisao) — nenhum deles é FV.

---

## Bloqueio — duas dependências ambíguas

A sprint determina: *"dependência ambígua → PARAR E REPORTAR"*. Há duas, e ambas são estruturais.

### AMB-1 — A nova UX não cria projetos

A árvore `fv/` **não tem criação de projeto**. Ela abre em `/fv/projetos` (listagem) e opera um projeto que já existe. Criar um projeto FV só é possível por `/projetos-fv/novo` — o wizard.

Os 5 módulos externos acima dependem disso: `Dashboard` e `Clientes` têm botões "Novo"; `ClienteGerenciamento` cria projeto para um cliente; `CRM` converte lead em proposta.

**Remover o wizard hoje eliminaria a capacidade de criar projetos FV no sistema.**

### AMB-2 — 7 funcionalidades existem só no legado

`ProjetosFVDetalhes` entrega **11 abas**. A nova UX cobre o ciclo comercial; as demais não têm substituto:

| Aba | Nova UX |
|---|---|
| Resumo · Comercial · Governança | ✅ coberto (Projeto/Orçamentos/Baseline/Gate) |
| **Layout** (telhado) | ❌ |
| **BESS** | ❌ |
| **Financeiro** | ❌ |
| **Unifilar** | ❌ |
| **Documentos** | ❌ |
| **CRM** | ❌ |
| **Homologação** | ❌ — placeholder; agregado é da FV-DOM-006 |
| **Beneficiárias** | ❌ |

Os 104 arquivos "exclusivos do wizard" incluem os componentes que **implementam** essas 7 funcionalidades (`MapaTelhado`, `UnifilarFV`, `homologacao/*`, `BeneficiariasPainel`, `CentroFinanceiroFV`…). São exclusivos apenas porque as páginas que os hospedam são as legadas — não porque sejam descartáveis.

### Por que isso não se resolve nesta sprint

O escopo proíbe *"criar agregados"* e *"alterar domínio"*. Homologação, Execução e As-Built dependem de `ProjetoExecutivo`, `Execucao` e `AsBuilt` — agregados das sprints **FV-DOM-006/007**, que não existem.

A premissa da sprint — *"não manter duas UX concorrentes para o mesmo fluxo"* — está satisfeita **para o fluxo comercial**: ele já é exclusivo da nova UX desde a FV-UX-012A (o wizard é recusado com 409 em projeto congelado). As duas UX não concorrem; elas cobrem **escopos diferentes**.

---

## O que foi entregue

| Item | Resultado |
|---|---|
| Inventário por grafo de dependências | ✅ 244 módulos, 4 categorias |
| Mapa das entradas do wizard | ✅ 7 externas + sidebar/header/rotas |
| Remoção de código morto | ✅ 4 arquivos, 930 linhas |
| Remoção do wizard | ⛔ **bloqueada** — AMB-1 e AMB-2 |

### Regressão

| Check | Resultado |
|---|---|
| Build frontend | ✓ 2395 módulos (inalterado — o código removido já não entrava no bundle) |
| Suíte frontend | **idêntica ao baseline** — 25 falhas pré-existentes |

---

## Sequência para desbloquear

| # | Pré-requisito | Sprint |
|---|---|---|
| 1 | **Criação de projeto na nova UX** (`POST /api/projetos-fv` já existe) | sprint de UX curta — desbloqueia AMB-1 |
| 2 | Redirecionar as 7 entradas externas para `/fv/projetos` | junto com 1 |
| 3 | Layout · BESS · Financeiro · Unifilar · Documentos · CRM · Beneficiárias na nova UX | sprints de UX |
| 4 | `ProjetoExecutivo`, `Execucao`, `AsBuilt` | FV-DOM-006/007 |
| 5 | Homologação na nova UX | depende de 4 |
| 6 | **Remoção do wizard** | depende de 1–5 |

O item 1 é pequeno e destrava a parte mais visível: com criação de projeto na nova UX, as entradas externas podem migrar e `/projetos-fv/novo` deixa de ser o único caminho de entrada.

**Nada commitado.**
