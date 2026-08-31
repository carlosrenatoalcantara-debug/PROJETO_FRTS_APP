# FV-UX-011 — Nova UX como entrada do módulo FV

**Data:** 2026-08-07
**Resultado:** o módulo FV passa a abrir no fluxo canônico. Nenhuma tela antiga removida, nenhum arquivo de backend tocado.

---

## 1. Mapa da navegação

```
Sidebar › Projetos › Fotovoltaico
        ↓
  /fv/projetos                    (listagem — entrada principal)
        ↓  clique no projeto
  /fv/projetos/:id                → redireciona para /projeto
        │
        ├── /projeto        Projeto        ProjetoFV
        ├── /cotacao        Cotação        Cotacao
        ├── /orcamentos     Orçamentos     Orcamento
        ├── /aprovacao      Aprovação      Orcamento + Baseline
        ├── /baseline       Baseline       Baseline
        ├── /gate           Gate           Gate
        ├── /engenharia     Engenharia  ∥  Gate (liberação)
        ├── /homologacao    Homologação ∥  Gate (liberação)
        ├── /executivo      Proj. Executivo   ⛔ sem agregado
        ├── /execucao       Execução          ⛔ sem agregado
        └── /asbuilt        As-Built          ⛔ sem agregado
```

**Convivência (restrição "não remover a UX antiga"):**

| Item | Destino |
|---|---|
| Sidebar › Fotovoltaico | `/fv/projetos` — **novo** |
| Sidebar › Fotovoltaico (clássico) | `/projetos-fv` — preservado |
| Link "Abrir a listagem clássica" | dentro da listagem nova |
| Link "Abrir na tela clássica" | dentro do layout do fluxo |

As 6 rotas clássicas continuam registradas e inalteradas: `projetos-fv`, `projetos-fv/novo`, `projetos-fv/:id`, `projetos-fv/simulacao`, `propostas/nova`, `homologacao`.

---

## 2. Telas migradas

| Tela | Escopo | Fonte |
|---|---|---|
| **ListaProjetos** (nova) | entrada do módulo | `GET /api/projetos-fv` |
| **EtapaProjeto** | identificação, cliente, local, topologia | `GET /:id` |
| **EtapaCotacao** | listagem · seleção · visualização · histórico | `GET /:id/cotacoes` |
| **EtapaOrcamentos** | vigente · aprovado · histórico | `GET /:id/orcamentos` + `/vigente` |
| **EtapaAprovacao** | marcos do contrato (5 fatos lidos) | orçamentos + baseline |
| **EtapaBaseline** | integridade · hash · conteúdo congelado | `GET /:id/baseline` |
| **EtapaGate** | decisão por fase | `GET /:id/gate` |
| **EtapaEngenharia / EtapaHomologacao** | liberação pelo Gate | `GET /:id/fases` |

### §3 Cotações — as quatro capacidades pedidas

- **Listagem** — todas as cotações do projeto (N por projeto)
- **Seleção** — clique alterna a cotação exibida; estado **local de tela**, não de domínio, por isso não vive em provider
- **Visualização** — premissas + composição, como vieram do agregado
- **Histórico** — nenhuma cotação é escondida; a que originou o orçamento vigente é marcada

### §4 Orçamentos — os quatro recortes

`vigente` vem do **endpoint dedicado** (`/orcamentos/vigente`), não é deduzido da lista. A regra ("o aprovado manda; senão o mais recente em elaboração") é do `OrcamentoService` — reimplementá-la no cliente criaria uma segunda verdade.

`historico` = tudo que não é o vigente. É recorte de apresentação, não regra: nada é descartado (INV-ORC-2).

---

## 3. §6 — remoção do cálculo local

Esta foi a mudança mais relevante da sprint.

| Sprint | `ContratoProvider` |
|---|---|
| FV-UX-010 | **calculava** a decisão no cliente (`avaliarCongelamento`) — não havia endpoint |
| FV-API-001 | lia da API, mas **reduzia** as fases a um booleano `congelado` |
| **FV-UX-011** | **repassa** o que a API respondeu — nenhuma redução, nenhum cálculo |

```diff
- congelado: fases.length > 0 && liberadas === fases.length   // redução local
- gateLiberado: congelado
+ liberadaPara(fase)   // acessor puro: fases[fase].liberado
+ motivoDe(fase)       // acessor puro: fases[fase].motivo
```

Inventar um "congelado" agregado no cliente seria reintroduzir exatamente a decisão local que a FV-UX-004 identificou como defeito — 17 reimplementações do mesmo booleano espalhadas pela base.

`FluxoNav` e `EtapaGate` passaram a consultar a fase específica. `fluxo.js` teve o parâmetro renomeado de `congelado` para `execucaoLiberada`, deixando claro que recebe uma resposta da API, não uma conclusão.

---

## 4. Providers — um endpoint cada

| Provider | Endpoint canônico |
|---|---|
| `ProjetoProvider` | `buscarProjeto` |
| `ProjetosProvider` **(novo)** | `listarProjetos` |
| `OrcamentosProvider` | `listarOrcamentos`, `obterOrcamentoVigente` |
| `CotacoesProvider` | `listarCotacoes` |
| `ContratoProvider` | `obterBaseline`, `obterGate` |
| `FasesProvider` | `listarFases` |

Os 6 endpoints canônicos da FV-API-001 estão em uso. Nenhum provider lê de outro provider para obter dados — só para correlacionar referências (`CotacoesProvider` usa `cotacao_ref` do orçamento vigente para marcar a origem, M-1).

---

## 5. Componentes

### Criados nesta sprint (4)

`ProjetosProvider` · `ListaProjetos` · `CartaoOrcamento` · `DetalheCotacao` (interno a `EtapaCotacao`)

### Reescritos (6)

`ContratoProvider` · `OrcamentosProvider` · `EtapaCotacao` · `EtapaOrcamentos` · `EtapaAprovacao` · `EtapaGate`

### Adaptados (4)

`fluxo.js` (parâmetro renomeado) · `FluxoNav` (decisão por fase) · `Sidebar` (entrada) · `Header` (títulos)

### Removidos

**Nenhum.** A restrição proíbe remover a UX antiga nesta sprint.

### Ainda legados (intactos)

`ProjetoFVContext` (195 linhas, 16 consumidores) · `projetoFVApi` (33 funções) · 6 páginas FV · 39 componentes em `components/fv/` · 9 etapas em `components/fv/etapas/` · `config/etapasFunilFV.js`

---

## 6. Validação

```
módulos da árvore nova:            27/27 carregam
navegação hardcoded p/ wizard:     nenhuma
etapa numérica:                    nenhuma
dependência de ProjetoFVContext:   nenhuma (só menção em comentário no fluxo.js)
dependência de projetoFVApi:       nenhuma
rotas clássicas preservadas:       6/6
sidebar → /fv/projetos            ✓  (clássico mantido em item próprio)
```

Endpoints consumidos pela árvore nova — **todos canônicos**:

```
/api/projetos-fv
/api/projetos-fv/:id
/api/projetos-fv/:id/cotacoes
/api/projetos-fv/:id/orcamentos
/api/projetos-fv/:id/orcamentos/vigente
/api/projetos-fv/:id/baseline
/api/projetos-fv/:id/gate
/api/projetos-fv/:id/fases
/api/instalacoes/:id
```

### Regressão

| Check | Resultado |
|---|---|
| Build frontend | ✓ 2389 → **2392 módulos** |
| Suíte frontend | **idêntica ao baseline** — 6 arquivos, 25 falhas, 940 passando |
| Suítes que não coletaram | 0 |
| Backend boot | ✓ |
| `agregadosFv` · `fluxoCanonico` · `congelamento` · `legadoOrcamento` · `convergenciaOrcamento` · `lme` | ✓ todos |
| **Arquivos de backend tocados** | **0** |

**Um susto no caminho:** a primeira rodada da suíte mostrou 9 falhas a menos em `phase2.realista.test.jsx`. Rodando o arquivo isolado, continuam **9 falhas** — igual ao baseline. Foi flutuação do reporter, não melhoria nem regressão. A segunda rodada completa confirmou: idêntica ao baseline.

---

## Critério de conclusão

| Exigência | Status |
|---|---|
| Fluxo novo operacional | ✅ entrada pelo menu, 12 rotas, 8 telas com dados reais |
| Consumo exclusivo da API canônica | ✅ 9 endpoints, todos canônicos |
| Nenhuma dependência do `ProjetoFVContext` | ✅ |
| Nenhuma dependência do wizard legado | ✅ sem navegação hardcoded, sem etapa numérica |
| Nenhuma regressão | ✅ suíte idêntica; 6/6 rotas clássicas preservadas |

**Nada commitado.**
