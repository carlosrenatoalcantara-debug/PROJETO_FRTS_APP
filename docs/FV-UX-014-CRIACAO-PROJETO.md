# FV-UX-014 — Criação de Projeto FV na nova UX

**Data:** 2026-08-14
**Resultado:** `/fv` passa a **Listar · Abrir · Criar**. Desbloqueia a AMB-1 da FV-UX-013.

---

## O que foi entregue

```
Projetos FV  (Sidebar › Projetos › Fotovoltaico → /fv/projetos)
├── Listar   ✅ GET /api/projetos-fv
├── Abrir    ✅ /fv/projetos/:id (fluxo canônico)
└── Criar    ✅ POST /api/projetos-fv → abre o projeto criado
```

### Camadas

| Camada | Mudança |
|---|---|
| `api/agregadosFvApi.js` | `criarProjeto()` e `listarClientes()` |
| `providers/ProjetosProvider` | mutação `acoes.criar` + recarga da lista |
| `componentes/FormNovoProjeto.jsx` | formulário (cliente + nome), **novo** |
| `paginas/ListaProjetos.jsx` | botão no cabeçalho; ao criar, navega para o projeto |

**Nenhum endpoint novo.** `POST /api/projetos-fv` já existia — é o mesmo que o wizard usava. O tenant é carimbado no servidor a partir do JWT.

### Por que o formulário é tão pequeno

O wizard abria um funil de 9 passos para criar um projeto. No domínio, criar um Projeto FV sempre exigiu **duas coisas**: um cliente e um nome. Cotação, orçamento e contrato são o **fluxo canônico**, não pré-requisito para o projeto existir.

---

## Bug pré-existente encontrado e corrigido

Ao exercitar a criação pela interface, o servidor respondeu:

```
carimbarTenant is not defined
```

`projetosFVController.js` usava `carimbarTenant` em **três** funções — `criarProjetoFV`, `duplicarProjetoFV`, `ampliarProjetoFV` — e **não o importava**.

Verifiquei no `git HEAD`, antes de todas as sprints desta sessão:

```
import { aplicarEscopo, exigirTenant } from '../dominio/tenancy/index.js'
carimbarTenant: 3 usos
```

**Defeito pré-existente, não introduzido aqui.** Criar, duplicar e ampliar projeto FV estouravam `ReferenceError` em runtime — nunca detectado porque nenhum teste automatizado exercita esses caminhos com MongoDB conectado.

Corrigido com uma linha: `carimbarTenant` adicionado ao import.

---

## Entradas migradas para a nova UX

| Origem | Antes | Depois |
|---|---|---|
| `Dashboard:116,127` | `/projetos-fv/novo` (2 botões) | `/fv/projetos` |
| `Clientes:631` | `/projetos-fv/novo` | `/fv/projetos` |
| `Clientes:641` | `/projetos-fv/:id` | `/fv/projetos/:id` |
| `ClienteGerenciamento:280` | `/projetos-fv/novo?clienteId=` | `/fv/projetos` |
| `ClienteGerenciamento:308,309` | `/projetos-fv/:id` (clique e teclado) | `/fv/projetos/:id` |
| `FaturaRevisao:86` | `/projetos-fv` | `/fv/projetos` |

**6 das 7 entradas externas migradas.**

### A que ficou — e por quê

`CRM.jsx:412` — botão *"Criar Proposta"* a partir de um **lead** → `/propostas/nova?leadId=`.

`NovaProposta` busca o lead em `/api/crm/leads/:id` e pré-preenche o formulário: é uma **conversão lead → proposta**. A nova UX cria projeto a partir de **cliente existente**, e um lead ainda não é cliente. Converter exigiria a regra de negócio "criar cliente a partir do lead", que esta sprint não pode criar.

Fica como pendência explícita, com o caminho antigo preservado e funcional.

---

## Validação pela interface

Ambiente isolado (`mongodb-memory-server`), backend e frontend reais, fluxo pela UI:

| Passo | Resultado |
|---|---|
| **Listar** | 1 projeto exibido com badge de estado |
| Abrir formulário | clientes carregados de `GET /api/clientes` |
| **Criar** | navegou para `/fv/projetos/6a7def35…/projeto` |
| **Abrir** | tela do projeto com nome, cliente e o fluxo canônico completo |

**Verificação no banco** — 2 projetos criados (um pela UI, um por `curl`):

```
empresa_id carimbado : SIM  (ambos)
clienteId vinculado  : SIM  (ambos)
status               : rascunho
orcamento (legado)   : null  (ambos)
```

O tenant é carimbado corretamente e o subdocumento legado permanece intocado.

---

## Regressão

| Check | Resultado |
|---|---|
| Build frontend | ✓ 2396 módulos |
| Suíte frontend | **idêntica ao baseline** — 25 falhas pré-existentes |
| 7 checks de backend | ✓ todos |
| **Produção intocada** | 588 projetos; `cotacaos`/`orcamentos`/`baselines` seguem inexistentes |

### Um teste que precisou acompanhar a mudança

`clienteAbreProjeto.test.jsx` passou a falhar (4 casos). Ele protege a regressão **P0-PROJETO-OPEN-BUG-01**: *clicar num projeto na ficha do cliente deve navegar*.

A intenção continua válida — o que mudou foi o **destino**, de `/projetos-fv/:id` para `/fv/projetos/:id`, que é exatamente o objetivo da sprint. Atualizei as asserções FV e documentei o motivo no cabeçalho do teste. As asserções de **EV não foram tocadas**.

Não é falha mascarada: o teste continua verificando que o clique navega, e falharia se a navegação sumisse.

---

## Estado da AMB-1 (FV-UX-013)

> *"A nova UX não cria projetos. Remover o wizard eliminaria a capacidade de criar projetos FV."*

**Desbloqueada.** `/fv/projetos` cria, e 6 das 7 entradas externas já apontam para lá.

**AMB-2 permanece:** 7 das 11 abas de `ProjetosFVDetalhes` (Layout, BESS, Financeiro, Unifilar, Documentos, CRM, Beneficiárias) e a Homologação seguem só no legado. Dependem de sprints de UX e dos agregados da FV-DOM-006/007.

**Nada commitado.**
