# FV-DOM-002A — Contrato Único de Congelamento + Arquitetura da Nova UX FV

**Data:** 2026-08-07
**Parte A:** implementada e validada.
**Parte B:** engenharia da solução — nenhuma tela implementada.

---

# PARTE A — Unificação do congelamento

## A.1 Auditoria — a mesma pergunta, 17 respostas

Antes desta sprint, "este projeto está congelado?" era respondido de forma independente em 17 lugares, quase todos reimplementando `['CONGELADO','HOMOLOGADO'].includes(governanca.freeze_status)`. **Nenhum deles conhecia o Baseline.**

### Backend — pontos de decisão

| # | Local | O que decidia | Situação |
|---|---|---|---|
| D-1 | `projetosFVController.js:776` | freeze guard do `salvarEtapa` | **migrado** |
| D-2 | `homologacaoController.js:23` — `_estaCongelado` | fonte de equipamentos (snapshot × catálogo vivo) | **migrado** |
| D-3 | `homologacao/homologacaoAssistida.js:90` | exigência de snapshot RT | **migrado** |
| D-4 | `alertcenter/alertDetectors.js:257` | alerta "congelado sem snapshot RT" | **migrado** |
| D-5 | `statusLifecycle.js:37` — `derivarStatusSeguro` | status derivado de projeto sem `status` | **migrado** |
| D-6 | `statusLifecycle.js:51` — `podeExcluirDefinitivo` | permissão de hard delete | **migrado** |
| D-7 | `statusLifecycle.js:84` — `avaliarLegacy` | diagnóstico de snapshot ausente | **migrado** |
| D-8 | `routes/painel.js:41` | contagem de congelados | **migrado** |
| D-9 | `routes/painel.js:62` | kWp instalados | **migrado** |
| D-10 | `routes/painel.js:74` | valor vendido | **migrado** |
| D-11 | `routes/painel.js:120` | `countDocuments` com `$in` | **não migrável** — ver A.4 |
| D-12 | `scripts/backfillLocalSuperficie.js:64` | script de migração | **fora do Core** (LME) |

### Backend — pontos que produzem congelamento (escrita)

| # | Local | Papel | Situação |
|---|---|---|---|
| E-1 | `OrcamentoService.aprovar` | gera Baseline — **origem canônica** | fonte do contrato |
| E-2 | `congelarProjetoFV` (`/governanca/congelar`) | grava `freeze_status` + snapshots | mantido (legado) |
| E-3 | `alterarStatusGovernanca` | transição de `freeze_status` | mantido (legado) |
| E-4 | `congelarCenarioComercial` | `cenarios_governanca[].freeze_status` | mantido (legado) |
| E-5 | `registrarAssinaturaComercial` | `workflow_status = ASSINADO` | mantido (legado) |

### Frontend — leitores (não migrados: "não alterar React")

`DocumentCenter.jsx:26,28` · `GovernancaPainel.jsx:34` · `PropostaEnterprise.jsx:60,319` · `ProjetosFVDetalhes.jsx:571` · `engenhariaGovernanca.js:470` · `gerarPropostaPDF.js:91,105`

## A.2 O contrato

[`packages/fv-shared/estados/congelamento.js`](../packages/fv-shared/estados/congelamento.js)

```
CONGELADO  ⟺  Orçamento APROVADO  ∧  Baseline VÁLIDA
```

| Motivo | Significado | Canônico? |
|---|---|---|
| `CONTRATO` | aprovado + baseline íntegra | ✅ |
| `APROVADO_SEM_BASELINE` | aprovado sem baseline → **não congela** (falha segura) | ✅ |
| `LEGADO_FREEZE` | `freeze_status` CONGELADO/HOMOLOGADO, sem agregados | ⚠️ compat |
| `LEGADO_ASSINATURA` | `workflow_status` ASSINADO/IMPLANTACAO/CONCLUIDO, sem agregados | ⚠️ compat |
| `ABERTO` | editável | ✅ |

Duas portas, uma decisão: `resolverCongelamento(projeto)` (faz I/O) e `projetoEstaCongelado(projeto)` (puro, para consumidores síncronos).

## A.3 A cláusula de compatibilidade — e por que ela existe

Aplicar a regra canônica **sozinha** teria descongelado todos os projetos anteriores à FV-DOM-001 — inclusive os 2 com snapshot congelado e o 1 HOMOLOGADO em produção. Contratos fechados voltariam a ser editáveis.

Por isso o legado também congela, com motivo próprio e `precisaBackfill: true`. **A cláusula sai quando o backfill de Cotacao/Orcamento/Baseline for concluído** — responsabilidade do LME (ADR-022), não do Core.

## A.4 Limite conhecido

`painel.js:120` conta congelados via `countDocuments({ 'governanca.freeze_status': { $in: [...] } })`. Uma função JavaScript não entra num `$match` do Mongo. Enquanto o backfill não ocorrer, a query legada é a aproximação disponível — está comentada no código. A saída definitiva é materializar o congelamento em campo indexável, em FV-DOM-003.

## A.5 Efeito colateral desejado: o achado A-2 fechou

Na FV-DOM-002 registrei que aprovar um `Orcamento` **não** travava a etapa `orcamento` — o guard olhava só `governanca`. Com o contrato único, passa a travar:

```
contrato fechado → etapa BLOQUEADA (409, motivo: CONTRATO)
```

Isso **mudou o comportamento** que a FV-DOM-002 havia validado. As asserções daquele check foram atualizadas para o comportamento canônico. Reabrir um projeto congelado exige revisão — não sobrescrita.

## A.6 Validação

[`congelamento.check.js`](../backend/src/dominio/__checks__/congelamento.check.js) — **37/37 asserções**.

Residual de decisão duplicada no backend: **1** (`backfillLocalSuperficie.js`, script LME).

---

# PARTE B — Arquitetura da Nova UX FV

## B.1 Fluxo operacional — do primeiro clique ao pós-venda

```
LEAD ──► COLETA ──► DIMENSIONAMENTO ──► COTAÇÃO(N) ──► ORÇAMENTO(N)
                                                             │
                                                        APROVAÇÃO
                                                             │
                                                     ┌── BASELINE ──┐
                                                     │   (M-2)      │
                                                     └───► GATE ────┘
                                                             │
                                              ┌──────────────┴──────────────┐
                                         ENGENHARIA                   HOMOLOGAÇÃO
                                              └──────────────┬──────────────┘
                                                    (ambas concluídas)
                                                             │
                                                        INSTALAÇÃO
                                                             │
                                                         AS-BUILT
                                                             │
                                                     COMISSIONAMENTO
                                                             │
                                                       ENTREGA / O&M
```

**Regra estrutural:** Engenharia e Homologação são **fases paralelas**, não estados exclusivos. `ciclo.estado` só avança para INSTALAÇÃO quando ambas concluem. Um campo escalar não representa isso — daí o modelo `{ ciclo.estado } + { fases.engenharia, fases.homologacao }` definido na FV-UX-004 §5.

## B.2 Telas

| Tela | Rota | Destino | Justificativa |
|---|---|---|---|
| `ProjetosFV` | `/projetos-fv` | **permanece** (adaptada) | listagem; passa a mostrar estado do ciclo |
| `ProjetosFVNovo` | `/projetos-fv/novo` | **dividida** | vira host de 3 fluxos: Coleta, Dimensionamento, Comercial |
| `ProjetosFVDetalhes` | `/projetos-fv/:id` | **dividida** | 648 linhas com 5 responsabilidades |
| `SimulacaoFV` | `/projetos-fv/simulacao` | **fundida** em Cotação | é cotação avulsa sem projeto |
| `Homologacao` (página) | `/homologacao` | **removida** | opera sem projeto; duplica `fv/homologacao/` |
| `NovaProposta` | `/propostas/nova` | **removida** | `DEPRECATED_DO_NOT_USE`, 1206 linhas |
| — | `/projetos-fv/:id/cotacoes` | **nova** | comparação de N cotações |
| — | `/projetos-fv/:id/orcamentos` | **nova** | N orçamentos + aprovação |
| — | `/projetos-fv/:id/baseline` | **nova** | contrato congelado (somente leitura) |
| — | `/projetos-fv/:id/engenharia` | **nova** | atrás do Gate |
| — | `/projetos-fv/:id/homologacao` | **nova** | atrás do Gate |
| — | `/projetos-fv/:id/execucao` | **nova** | instalação + as-built |

**Saldo:** 7 telas hoje → 4 permanecem/adaptam, 2 removidas, 1 fundida, 6 novas.

## B.3 Componentes — 48 arquivos FV classificados

### Reutilizar integralmente (12)

`SeletorPaineis` · `SeletorInversores` · `SeletorEstrutura` · `SeletorEquipamentos` · `AssistenteDatasheet` · `DatasheetForm` · `FichaTecnicaModal` · `GarantiaCard` · `MapaTelhado` · `EditorTelhadoMapa` · `PlanejadorTelhado` · `LayoutTelhado`

**Dependência:** Catálogo (GLOBAL, ADR-021 A-8) e geometria — independentes do modelo de projeto.

### Reutilizar parcialmente (6)

| Componente | O que muda |
|---|---|
| `TelhadoVisualizacao`, `PreviewLayoutPano` | fonte passa a ser `Local.superficies` |
| `GraficoGeracaoConsumo` | entrada vem da Cotação, não do wizard |
| `UnifilarFV` | fonte passa a `Instalacao` (adapter já existe) |
| `ValidacaoEletrica` | consome topologia do agregado |
| `ResumoTecnicoArranjo` | idem |

### Adaptar (11)

`E1Upload` · `E2Consumo` · `E2BBeneficiarias` · `E3Localizacao` · `E4Irradiancia` · `E6Area` · `TopologiaMPPTEditor` · `BeneficiariasPainel` · `ModalBeneficiaria` · `DocumentCenter` · `DocumentosExternos`

Capturam o dado certo; muda o **destino** da escrita (agregados) e a origem da leitura.

### Substituir (13)

| Componente | Linhas | Substituto |
|---|---|---|
| `E8Orcamento` | 1052 | Cotação → Orçamentos(N) → Aprovação → Baseline |
| `ConfiguradorArranjoFV` | 1108 | Editor de Gerador (Instalação) |
| `E7Equipamentos` | 525 | idem |
| `GerenciadorArranjos` | 403 | Gerenciador de Geradores |
| `E5Dimensionamento` | 371 | Dimensionamento com laço área↔potência |
| `PropostaEnterprise` | 525 | Visualizador de Baseline |
| `Proposta` | — | idem |
| `GovernancaPainel` | 286 | Painel de Contrato (baseado no contrato único) |
| `CentroFinanceiroFV` | 399 | Financeiro derivado do Orçamento |
| `AbaFinanceiro` | 306 | idem |
| `ComparadorRevisoes` | — | Comparador de Orçamentos |
| `RecomendacaoFinal` | 273 | Recomendação de Cotação |
| `CrmPainel`/`DashboardComercial` | — | consomem `ciclo.estado` unificado |

### Remover (6)

`NovaProposta` · `SugestaoTopologiaReferencia`¹ · `BuscaKitsFV`¹ · `SeletorAutomaticoKits`¹ · `SimulacaoFinanceira` (duplica página) · `MedicoesAtivoCard`²

¹ dependem do conceito "kit fechado", substituído por Cotação
² pertence a Ativos, não a FV

## B.4 Contextos, providers, stores, hooks

| Item | Situação | Redundância |
|---|---|---|
| `ProjetoFVContext` (195 linhas, 16 consumidores) | **substituir** | shape espelha as etapas do wizard, não os agregados |
| `EmpresaContext` | permanece | — |
| `useBulkSelection` | permanece | genérico |
| `useCompatibilidadeEletrica` | adaptar | passa a ler `Instalacao` |
| `useHistorioDiagrama.ts` | permanece | escopo diagrama |
| `usePermissao` | permanece | RBAC |

**Redundâncias identificadas:**

| # | Redundância |
|---|---|
| R-1 | `localStorage['forte_solar_wizard_fv_v3']` duplica o estado do servidor — fonte de divergência silenciosa |
| R-2 | Navegação hardcoded no Context (`2 → 2.5 → 3`) apesar de `ETAPAS` se declarar fonte única |
| R-3 | Não há store para os novos agregados — cada tela buscaria por conta própria |
| R-4 | `EmpresaContext` e `usePermissao` resolvem tenancy separadamente |

**Proposta:** um provider por agregado (`CotacoesProvider`, `OrcamentosProvider`, `ContratoProvider`), sem reducer monolítico. O estado do wizard deixa de ser a raiz.

## B.5 APIs

### Reutilizados sem alteração

`GET/POST /api/projetos-fv` · `GET /api/projetos-fv/:id` · `/api/clientes` · `/api/equipamentos` · `/api/materiais` · `/api/irradiancia` · `/api/dimensionamento` · `/api/engenharia/fv` · `/api/unifilar` · `/api/publico`

### Já existem, sem consumidor no frontend

`/api/instalacoes` (S4A) — **zero consumidores**. A nova UX de topologia passa a usá-lo.

### Obsoletos — remover com o legado

| Endpoint | Motivo |
|---|---|
| `PUT /:id/etapa` (etapa `orcamento`) | substituída por endpoints de Cotação/Orçamento |
| `POST /:id/governanca/congelar` | congelamento passa a ser consequência da aprovação |
| `PUT /:id/governanca/status` | `freeze_status` deixa de ser escrito à mão |
| `POST /:id/governanca/comercial/cenario/*` (4 rotas) | cenários viram Cotações |
| `POST /:id/governanca/comercial/snapshot` | Baseline substitui |
| `/api/orcamento/gerar`, `/validar` | sem guarda de tenancy; substituídos |

### Novos (a implementar)

```
GET    /api/projetos-fv/:id/cotacoes
POST   /api/projetos-fv/:id/cotacoes
PUT    /api/cotacoes/:id
DELETE /api/cotacoes/:id

GET    /api/projetos-fv/:id/orcamentos
POST   /api/projetos-fv/:id/orcamentos
PUT    /api/orcamentos/:id                    (só em RASCUNHO)
POST   /api/orcamentos/:id/emitir
POST   /api/orcamentos/:id/aprovar            → gera Baseline
POST   /api/orcamentos/:id/rejeitar
POST   /api/orcamentos/:id/cancelar

GET    /api/projetos-fv/:id/baseline
GET    /api/projetos-fv/:id/contrato          (contrato de congelamento + motivo)
GET    /api/projetos-fv/:id/gate/:fase        (engenharia | homologacao)
```

**Todos** sob `protegerModulo('fv')` + `exigirOrganizacao`.

## B.6 Fluxo de dados — agregados por etapa

| Etapa | Lê | Escreve | Agregados |
|---|---|---|---|
| Lead | `Cliente`, `CrmLead` | `ProjetoFV` | ProjetoFV |
| Coleta | `FaturaEnergia`, `Cliente` | `Local`, `UnidadeBeneficiaria` | Local + Superfície |
| Dimensionamento | `Local`, `Equipamento` | `Instalacao` | Instalação |
| **Cotação** | `Instalacao`, `Local`, `Equipamento` | `Cotacao` | **Cotação (N)** |
| **Orçamento** | `Cotacao`, `Material` | `Orcamento` | **Orçamento (N)** |
| **Aprovação** | `Orcamento`, `Cotacao` | `Baseline` | **Baseline (1)** |
| **Gate** | `Baseline` | — | contrato |
| Engenharia | `Baseline`, `Instalacao` | `ProjetoExecutivo` ⛔ | *não existe* |
| Homologação | `Baseline`, `Jurisdicao` | `homologacao` | parcial |
| Instalação | `Baseline`, `ProjetoExecutivo` | `Execucao` ⛔ | *não existe* |
| Entrega | `Execucao` | `AsBuilt` ⛔ | *não existe* |
| Pós-venda | `AtivoEquipamento` | `AtivoEquipamento` | existe |

⛔ = agregado ainda não implementado.

## B.7 Mapa de migração

| Origem | Destino | Tipo | Risco | Sprint |
|---|---|---|---|---|
| `ProjetoFV.orcamento` | `Orcamento` | substituição | **alto** (backfill) | FV-DOM-003 |
| `governanca.freeze_status` | contrato de congelamento | absorção | médio | FV-DOM-003 |
| `governanca.comercial.workflow_status` | `ciclo.estado` | absorção | **alto** | FV-DOM-004 |
| `crm_pipeline` | projeção de `ciclo.estado` | eliminação | baixo | FV-DOM-004 |
| `status_juridico` | getter derivado | eliminação | baixo | FV-DOM-004 |
| `proposta.status` | — | remoção | nulo (órfão) | FV-DOM-004 |
| `cenarios_governanca` | `Cotacao` + `Orcamento` | substituição | médio (1 doc) | FV-DOM-003 |
| `arranjos[]` | `Instalacao` | substituição | **alto** | FV-DOM-005 |
| `localizacao`/`telhado` | `Local`/`Superficie` | substituição | médio | FV-DOM-005 |
| `homologacao.status` | `fases.homologacao` | absorção | médio | FV-DOM-006 |
| `ProjetoFVContext` | providers por agregado | substituição | **alto** (16 consumidores) | FV-UX-010 |
| `E8Orcamento` | 4 telas | decomposição | **alto** | FV-UX-012 |
| `ConfiguradorArranjoFV` | Editor de Gerador | decomposição | **alto** | FV-UX-011 |
| campos flat v2 | subdocs v3 | remoção | médio | FV-DOM-007 |

## B.8 DAG das próximas sprints

```
        ┌──────────────────────────────────────────────┐
        │ SSOT-GOV-003 · backfill empresa_id (LME)     │ ◄── BLOQUEADOR GLOBAL
        └──────────────────┬───────────────────────────┘
                           │
     ┌─────────────────────┼─────────────────────┐
     ▼                     ▼                     ▼
FV-DOM-003            FV-DOM-005            FV-UX-010
remover legado        topologia →           providers por
comercial             Instalacao            agregado
     │                     │                     │
     ▼                     ▼                     │
FV-DOM-004            FV-DOM-006                 │
ciclo.estado          fases eng/homolog          │
     │                     │                     │
     └──────────┬──────────┘                     │
                ▼                                │
          FV-DOM-007 ◄──────────────────────────┘
          remover v2 flat
                │
      ┌─────────┼─────────┐
      ▼         ▼         ▼
  FV-UX-011  FV-UX-012  FV-UX-013
  topologia  comercial  eng/homolog
      └─────────┼─────────┘
                ▼
           FV-UX-014
           execução + entrega
```

| Classificação | Sprints |
|---|---|
| **Bloqueador global** | SSOT-GOV-003 (backfill `empresa_id` — **0% de cobertura em produção**) |
| **Caminho crítico** | GOV-003 → DOM-003 → DOM-004 → DOM-007 → UX-012 |
| **Paralelizáveis** | DOM-005 ∥ DOM-003 · UX-010 ∥ tudo (frontend puro) · UX-011 ∥ UX-013 |

## B.9 Dívida técnica restante

### Adapters e pontes temporários (todos com data de remoção)

| Item | Sai em |
|---|---|
| `obterOrcamentoProjeto` | FV-DOM-003 |
| `$set.orcamento` (`@deprecated`) | FV-DOM-003 |
| Cláusula `LEGADO_*` do congelamento | FV-DOM-003 (pós-backfill) |
| `obterLocalProjeto` | FV-DOM-005 |
| `obterTopologiaProjeto` / `obterTopologiaState` | FV-DOM-005 |
| `statusLifecycle` (reexport) | FV-DOM-004 |
| Shims de `@fortesolar/fv-shared` no backend (10) | permanentes por desenho |

### Código morto

| Item | Evidência |
|---|---|
| `CrmProjetos.jsx:86,95` — `p.orcamento?.resumo?.preco_final` | `resumo` não existe no schema |
| `NovaProposta.jsx` (1206) + rota | `DEPRECATED_DO_NOT_USE` |
| `controllers/_deprecated/carregadorEVController.js` | diretório de deprecados |
| `security/express-integration-example.js` | exemplo com 6 TODOs, não roteado |

### Duplicações remanescentes

| # | Item |
|---|---|
| DUP-A | Homologação em `components/homologacao/` × `components/fv/homologacao/` — 3 arquivos homônimos |
| DUP-B | `SimulacaoFinanceira` como página **e** componente |
| DUP-C | Schema dual v2 flat × v3 subdoc em `ProjetoFV` (1095 linhas) |
| DUP-D | `gerarPdfOrcamento` × `gerarPropostaPDF` × `gerarPdfComercial` |

### Marcadores reais

**14 TODOs** (concessionárias 4, auth/security 8, storage 4, EV 4), **4 `@deprecated`**, **2 `DEPRECATED_DO_NOT_USE`**. Nenhum FIXME.

### Endpoints sem guarda de tenancy

`/api/engenharia` · `/api/orcamento` · `/api/dimensionamento` · `/api/unifilar` · `/api/irradiancia` · `/api/referencia` · `/api/projeto` · `/api/recomendacao` · `/api/decisao` — **9 rotas**. Risco de vazamento entre organizações. Sprint própria de segurança.

## B.10 Roadmap executivo

| Sprint | Objetivo | Escopo | Risco | Depende de | Aceite |
|---|---|---|---|---|---|
| **SSOT-GOV-003** | Backfill `empresa_id` | LME executa; Core audita | **crítico** | decisão de negócio | 100% dos registros com tenant; certificado emitido |
| **FV-DOM-003** | Remover legado comercial | R-1..R-6 da FV-DOM-002 + cláusula de compat | alto | GOV-003 | 0 leituras de `ProjetoFV.orcamento`; campo fora do schema |
| **FV-DOM-004** | Ciclo unificado | `ciclo.estado` + `fases`; absorve 6 máquinas | alto | DOM-003 | 1 máquina de estado; estados impossíveis irrepresentáveis |
| **FV-DOM-005** | Topologia e Local | `arranjos[]` → `Instalacao`; backfill `Local` | alto | GOV-003 | 100% com `instalacao_ref`; unifilar idêntico |
| **FV-DOM-006** | Engenharia e Homologação | `ProjetoExecutivo`; fases atrás do Gate | médio | DOM-004 | fases inacessíveis sem Baseline |
| **FV-DOM-007** | Execução e entrega | `Execucao`, `AsBuilt`, comissionamento | médio | DOM-006 | nomenclatura em ADR antes do código |
| **FV-SEC-001** | Fechar 9 rotas sem tenancy | `exigirOrganizacao` | médio | — | 0 rotas FV sem guarda |
| **FV-UX-010** | Providers por agregado | substitui `ProjetoFVContext` | alto | — (paralelo) | nenhum passo hardcoded; `localStorage` versionado |
| **FV-UX-011** | UX de topologia | decompõe `ConfiguradorArranjoFV` | alto | DOM-005, UX-010 | nenhum componente > 400 linhas |
| **FV-UX-012** | UX comercial | decompõe `E8Orcamento` em 4 telas | alto | DOM-003, UX-010 | Cotação/Orçamento/Aprovação/Baseline separados |
| **FV-UX-013** | UX eng./homolog. | unifica as duas implementações | médio | DOM-006 | uma só homologação |
| **FV-UX-014** | UX execução | instalação → as-built → entrega | médio | DOM-007 | fluxo completo até pós-venda |
| **FV-CLEAN-001** | Limpeza final | DUP-A..D, código morto, TODOs | baixo | todas | 0 duplicações; 0 adapters temporários |

**Ordem irredutível:** `GOV-003 → DOM-003 → DOM-004 → DOM-007 → UX-012`
**Paralelismos:** UX-010 e FV-SEC-001 não dependem de nada — podem começar já.

---

## Ressalva

O roadmap tem 13 sprints e supõe que os agregados de Engenharia, Execução e As-Built serão construídos. Eles **não existem** hoje — só `Local`, `Instalacao`, `Cotacao`, `Orcamento`, `Baseline` e a fundação de tenancy. A parte de UX (UX-010..014) é a menor fatia do trabalho; o volume está no domínio e no backfill.

**Nada commitado.**
