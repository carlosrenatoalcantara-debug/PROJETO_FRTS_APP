# FV-UX-010 — Nova arquitetura da UX FV

**Data:** 2026-08-07
**Natureza:** substituição de arquitetura de interface. Nenhuma funcionalidade nova, nenhum agregado novo, nenhuma API alterada.

---

## 1. Auditoria da árvore atual

### Páginas

| Arquivo | Linhas | Papel | Situação |
|---|---|---|---|
| `NovaProposta.jsx` | 1203 | 8 etapas internas + host | **quebrada** (§4) |
| `SimulacaoFV.jsx` | 820 | simulação avulsa | legada |
| `ProjetosFVDetalhes.jsx` | 654 | detalhe + 5 abas | legada (migrada na FV-DOM-003) |
| `ProjetosFVNovo.jsx` | 515 | host do wizard E1–E8 | legada |
| `ProjetosFV.jsx` | 464 | listagem | legada |
| `Homologacao.jsx` | 260 | homologação sem projeto | legada |

`NovaProposta` contém 8 funções-etapa internas: `Etapa1Localizacao`, `Etapa2Unidades`, `Etapa3KitGerador`, `Etapa4PreDimensionamento`, `Etapa5Irradiancia`, `Etapa6Dimensionamento`, `Etapa7Orcamento`, `Etapa8Proposta`.

### Contexts, providers, hooks

| Item | Situação |
|---|---|
| `ProjetoFVContext` (195 linhas, 16 consumidores) | legado — reducer com shape de wizard + `localStorage` |
| `EmpresaContext` | permanece |
| `useBulkSelection`, `useHistorioDiagrama`, `usePermissao` | permanecem (genéricos) |
| `useCompatibilidadeEletrica` | legado — lê `arranjos[]` |

### Serviços e adapters

| Item | Dependência do fluxo legado |
|---|---|
| `projetoFVApi.js` (33 funções) | `salvarEtapa`, 8 adaptadores `adaptar*`, 16 rotas de governança comercial |
| `projetosFvLifecycleApi.js` (7 funções) | ciclo de vida — reutilizável |
| `services/http.js` (`apiFetch`) | **reutilizado integralmente** |

---

## 2. Restrição que limitou o §5

O §5 exige leitura exclusiva via `Cotacao`, `Orcamento`, `Baseline` e `ProjetoFV`. As RESTRIÇÕES proíbem alterar APIs.

**Os endpoints necessários não existem:**

| Endpoint | Estado |
|---|---|
| `GET /api/projetos-fv/:id` | ✅ existe — devolve `orcamento_vigente` (FV-DOM-003) |
| `GET /api/instalacoes/:id` | ✅ existe |
| `GET /api/projetos-fv/:id/cotacoes` | ❌ não existe |
| `GET /api/projetos-fv/:id/orcamentos` | ❌ não existe |
| `GET /api/projetos-fv/:id/baseline` | ❌ não existe |
| `GET /api/projetos-fv/:id/gate/:fase` | ❌ não existe |

**Consequência assumida:** os providers enxergam **um** orçamento (o vigente) e conhecem Cotação/Baseline **apenas por referência**. Isso é compatível com o objetivo declarado — *"não cria novas funcionalidades... apenas estruturar a navegação"* — mas precisa estar explícito.

**Como foi tratado:** cada provider expõe `listaCompleta: false` e `endpointPendente`, e cada tela **declara a lacuna ao usuário** em vez de simular completude. Nenhum dado foi fabricado a partir de outros campos.

---

## 3. Nova árvore

```
frontend/src/fv/                        ← isolada; nada da árvore antiga foi tocado
├── fluxo.js                       92   fonte única do fluxo canônico
├── rotas.jsx                      42   rotas /fv/*
├── api/
│   └── agregadosFvApi.js          70   só endpoints existentes
├── providers/
│   ├── ProjetoProvider.jsx        64   agregado ProjetoFV
│   ├── OrcamentosProvider.jsx     49   agregado Orcamento
│   ├── CotacoesProvider.jsx       50   agregado Cotacao
│   ├── ContratoProvider.jsx       81   Baseline + Gate
│   └── FvProviders.jsx            33   composição
├── componentes/
│   ├── FluxoNav.jsx               62   navegação do fluxo
│   └── EtapaPendente.jsx          38   placeholder estrutural
└── paginas/
    ├── ProjetoFluxoLayout.jsx     44   shell
    └── etapas/                   310   11 telas
```

**22 arquivos. Maior: 92 linhas.** Nenhum acima de 300 (§4).

---

## 4. Arquitetura dos providers

```
ProjetoProvider          ← GET /api/projetos-fv/:id
   └── OrcamentosProvider    ← projeto.orcamento_vigente
         └── CotacoesProvider    ← orcamento.cotacao_ref
               └── ContratoProvider  ← orcamento aprovado + baseline_ref
```

A ordem é **dependência real**, não estilo: `Cotacoes` precisa do `cotacao_ref` que só o orçamento vigente carrega; `Contrato` precisa saber se há orçamento aprovado. Inverter quebra em runtime com erro explícito do `use*`.

### O que mudou em relação ao `ProjetoFVContext`

| Aspecto | Antigo | Novo |
|---|---|---|
| Shape | etapas do wizard (`dadosCliente`, `area`, `arranjos`…) | um provider por agregado |
| Fonte da verdade | `localStorage` + servidor (duplicados) | **só o servidor** |
| Navegação | hardcoded no contexto (`2 → 2.5 → 3`) | rotas do React Router |
| Persistência | `localStorage['forte_solar_wizard_fv_v3']` | nenhuma |
| Reducer | 15 actions | nenhum |

### O contrato de congelamento **não é reimplementado**

`ContratoProvider` importa `avaliarCongelamento` de `@fortesolar/fv-shared/estados/congelamento` — **o mesmo módulo que o backend usa**. A UI alimenta os fatos e exibe o resultado. Nenhuma decisão de domínio nasce no frontend; foi exatamente isso que a FV-UX-004 apontou como defeito (17 reimplementações do mesmo booleano).

`gateAutoritativo: false` e `baselineVerificada: false` deixam explícito que a UI **não é a autoridade** — o backend continua bloqueando por conta própria.

---

## 5. Fluxo canônico — estruturado

```
projeto → cotacao → orcamentos → aprovacao → baseline → gate
        → engenharia ∥ homologacao → executivo → execucao → asbuilt
```

`fluxo.js` é a fonte única. Diferenças em relação a `config/etapasFunilFV.js`:

- **sem numeração** — chaves estáveis; inserir etapa não renumera nada (o antigo tem `2.5`)
- **bifurcação real** — `paralela: true` em Engenharia e Homologação
- **agregado declarado** por etapa; `null` = não implementado no domínio

### Novas rotas

| Rota | Tela | Agregado |
|---|---|---|
| `/fv/projetos/:id` | → redireciona para `projeto` | — |
| `/fv/projetos/:id/projeto` | `EtapaProjeto` | ProjetoFV ✅ |
| `/fv/projetos/:id/cotacao` | `EtapaCotacao` | Cotacao ⚠️ sem endpoint |
| `/fv/projetos/:id/orcamentos` | `EtapaOrcamentos` | Orcamento ✅ |
| `/fv/projetos/:id/aprovacao` | `EtapaAprovacao` | Orcamento ✅ |
| `/fv/projetos/:id/baseline` | `EtapaBaseline` | Baseline ⚠️ sem endpoint |
| `/fv/projetos/:id/gate` | `EtapaGate` | Baseline ⚠️ indicativo |
| `/fv/projetos/:id/engenharia` | `EtapaEngenharia` | ⛔ não existe |
| `/fv/projetos/:id/homologacao` | `EtapaHomologacao` | ⛔ não existe |
| `/fv/projetos/:id/executivo` | `EtapaExecutivo` | ⛔ não existe |
| `/fv/projetos/:id/execucao` | `EtapaExecucao` | ⛔ não existe |
| `/fv/projetos/:id/asbuilt` | `EtapaAsBuilt` | ⛔ não existe |

Cada etapa é uma **rota**, não um passo de estado: recarregar mantém o lugar, o link é compartilhável.

---

## 6. Componentização de `NovaProposta` (§4)

As 8 etapas internas foram mapeadas para o fluxo canônico. **A arquitetura antiga não foi reutilizada** — nenhuma linha copiada; as telas novas leem agregados, não `dados`/`setDados`.

| Etapa antiga | Destino canônico | Estado |
|---|---|---|
| `Etapa1Localizacao` | `projeto` (Local resolvido) | ✅ estruturada |
| `Etapa2Unidades` | `projeto` | ✅ estruturada |
| `Etapa3KitGerador` | `cotacao` | ⚠️ sem endpoint |
| `Etapa4PreDimensionamento` | `cotacao` | ⚠️ sem endpoint |
| `Etapa5Irradiancia` | `cotacao` | ⚠️ sem endpoint |
| `Etapa6Dimensionamento` | `cotacao` | ⚠️ sem endpoint |
| `Etapa7Orcamento` | `orcamentos` | ✅ lê o agregado |
| `Etapa8Proposta` | `aprovacao` + `baseline` | ✅ estruturada |

`NovaProposta.jsx` **não foi alterada nem removida** — §6 e a restrição "não remover código legado" mandam.

---

## 7. Classificação dos componentes

| Categoria | Itens |
|---|---|
| **Criados (22)** | toda a árvore `src/fv/` |
| **Adaptados (1)** | `App.jsx` — 2 linhas: import + registro das rotas |
| **Ainda legados** | 6 páginas, `ProjetoFVContext`, `projetoFVApi` (33 funções), 39 componentes em `components/fv/`, 9 etapas em `components/fv/etapas/` |

---

## 8. Validação

### Estrutura

```
22/22 módulos carregam em modo dev
fluxo: projeto → cotacao → orcamentos → aprovacao → baseline → gate
       → engenharia → homologacao → executivo → execucao → asbuilt
rota base: fv/projetos/:id  ·  12 sub-rotas registradas
```

### §5 — leitura exclusiva pelos agregados

```
leitura do subdoc legado: 0 em 11 arquivos da árvore nova
```

Varredura no código-fonte servido pelo dev server: nenhum `.orcamento` que não seja `orcamento_vigente`.

### §6 — convivência

```
rotas clássicas preservadas: 5/5
```

`projetos-fv/novo`, `projetos-fv/:id`, `projetos-fv/simulacao`, `propostas/nova`, `homologacao` — todas intactas. O layout novo tem link "Abrir na tela clássica".

### Regressão

| Check | Resultado |
|---|---|
| Build frontend | ✓ 2365 → **2388 módulos** (+23) |
| Suíte frontend | **idêntica ao baseline** (25 falhas pré-existentes) |
| Suítes que não coletaram | **0** |
| Backend boot | ✓ |
| `fluxoCanonico` · `congelamento` · `legadoOrcamento` · `convergenciaOrcamento` · `lme` | ✓ todos |
| Arquivos do Core alterados | **0** |

---

## 9. Riscos

| # | Risco | Grau | Mitigação |
|---|---|---|---|
| R1 | **Nova UX não é utilizável sem os endpoints** — 4 dos 6 agregados só têm referência | **alto** | telas declaram a lacuna; sprint de API é pré-requisito da FV-UX-012 |
| R2 | Gate indicativo pode divergir do backend (baseline adulterada não é detectável no cliente) | médio | `gateAutoritativo: false`; backend continua sendo a autoridade |
| R3 | Duas árvores de UX convivendo aumentam a superfície de manutenção | médio | convivência exigida pelo §6; prazo = FV-UX-014 |
| R4 | `ProjetoFVContext` segue vivo com 16 consumidores | médio | substituição depende das telas legadas saírem |
| R5 | Rotas novas herdam o `Layout` e o RBAC existentes | baixo | nenhuma mudança de permissão |

---

## 10. Pré-requisito da próxima sprint

A nova UX está **estruturalmente completa e funcionalmente vazia** nas etapas 2, 5 e 6. Antes da FV-UX-012 é preciso implementar os endpoints listados na FV-DOM-002A §B.5 — o que exige uma sprint que **possa alterar APIs**, coisa que esta proibia.

Sem isso, `EtapaCotacao`, `EtapaBaseline` e a listagem de N orçamentos continuam mostrando apenas referências.

---

## Critério de conclusão

| Exigência | Status |
|---|---|
| Nova arquitetura da UX estabelecida | ✅ 22 arquivos, providers por agregado |
| Fluxo canônico existe estruturalmente | ✅ 11 etapas, 12 rotas |
| Nenhum comportamento do Core alterado | ✅ 0 arquivos de backend tocados; 5 checks verdes |
| Nenhuma regressão | ✅ suíte idêntica; 5/5 rotas clássicas preservadas |

**Nada commitado.**
