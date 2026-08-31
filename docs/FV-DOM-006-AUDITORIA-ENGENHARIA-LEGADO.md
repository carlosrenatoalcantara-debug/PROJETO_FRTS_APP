# FV-DOM-006 — Auditoria: o que já existe para substituir o legado FV

**Data:** 2026-08-14
**Natureza:** auditoria. Nenhum agregado criado, nenhum código alterado.
**Contexto:** a FV-UX-014 eliminou a AMB-1 (criar projeto). Resta a **AMB-2** — 8 funcionalidades ainda só no wizard.

---

## Conclusão que corrige a FV-UX-013

Eu havia registrado que as 7 abas remanescentes *"dependem de sprints de UX e dos agregados da FV-DOM-006/007"*. **A auditoria mostra outra coisa.**

Das 8 funcionalidades, **apenas 2 exigem agregado novo**. Seis já têm backend em graus variados — três delas praticamente prontas, faltando só UX.

| # | Funcionalidade | Agregado | API | Regra no domínio | O que falta de verdade |
|---|---|---|---|---|---|
| 1 | **Beneficiárias** | ✅ `UnidadeBeneficiaria` | ✅ 7 rotas | ✅ `beneficiariaRateio` (fv-shared) | **só UX** |
| 2 | **Homologação** | ⚠️ subdoc | ✅ 12 rotas | ✅ `homologacaoAssistida`, `memorialDescritivoService` | UX + mover estado p/ agregado |
| 3 | **Unifilar** | ⚠️ cache SVG em subdoc | ✅ 3 rotas + `POST /:id/unifilar/gerar` | ✅ `@fortesolar/diagram-engine` | **só UX** |
| 4 | **CRM** | ✅ `CrmLead`/`CrmFunil`/`CrmColuna` | ✅ 12 rotas | ⚠️ **duplicado** | resolver duplicação + UX |
| 5 | **Layout / telhado** | ✅ `Local` + `Superficie` (dormente) | ⚠️ `GET/POST /:id/telhado` (legado) | ✅ `obterLocalProjeto` | **backfill** + UX |
| 6 | **BESS** | ❌ | ⚠️ `POST /api/bess/dimensionar` (só cálculo) | cálculo sem persistência | agregado + UX |
| 7 | **Financeiro** | ❌ | ❌ | ⚠️ **regra vive no FRONTEND** | mover regra + UX |
| 8 | **Documentos** | ⚠️ `DocumentoTecnico` **órfão** | ❌ **sem rotas CRUD** | — | expor API + UX |

---

## Detalhamento

### 1. Beneficiárias — pronta no backend

`UnidadeBeneficiaria` é agregado próprio (15 campos), classificado como `ESCOPO_TENANT`, com **7 rotas** sob `/api/projetos-fv/:id/beneficiarias`:

```
GET /  ·  GET /resumo  ·  POST /  ·  PUT /:id  ·  DELETE /:id
POST /lote  ·  POST /validar-rateio
```

A regra de rateio (`parsearTextoExcel`, `validarRateio`, `normalizarParaCem`, `MODALIDADES_GD`) já vive em `@fortesolar/fv-shared/beneficiarias/rateio` — compartilhada entre front e back desde a F2.

**Nada de backend é necessário.** É a candidata mais barata da lista.

### 2. Homologação — backend completo, estado no lugar errado

**12 rotas** sob `/api/projetos-fv/:id/homologacao`: memorial, carta, ART, checklist (GET/PATCH), status (GET/PATCH) e a trilha *assistida* (checklist, validação, pacote, status).

Serviços prontos: `memorialDescritivoService`, `homologacaoAssistida`, `parecerNormalizerService`, `concessionariaDictionaryService`.

**O que falta não é capacidade, é modelagem:** o estado vive em `ProjetoFV.homologacao` (subdoc), com as duas máquinas de estado que a FV-UX-004 mapeou (`status` legado × `status_homologacao`). O agregado `fases.homologacao` da FV-DOM-002A §5 é a forma canônica.

### 3. Unifilar — pronto no backend

`POST /api/unifilar/fv/gerar`, `GET /api/unifilar/arquitetura` e `POST /api/projetos-fv/:id/unifilar/gerar`. O motor é o `@fortesolar/diagram-engine` — pacote versionado e vendorizado, compartilhado com EV.

`ProjetoFV.unifilar` guarda só **cache do SVG**, não regra.

**Nada de backend é necessário.**

### 4. CRM — agregado existe, mas há duplicação

`CrmLead` (25 campos), `CrmFunil`, `CrmColuna` + **12 rotas** em `/api/crm`.

**A duplicação:** o pipeline comercial existe em **dois lugares** —
- `CrmLead` (agregado próprio, com funil e colunas configuráveis)
- `ProjetoFV.governanca.comercial.crm_pipeline` (enum de 7 valores)

A FV-UX-004 já classificou `crm_pipeline` como **absorvível** — projeção de `ciclo.estado`. Resolver isso é FV-DOM-004, não uma sprint de CRM.

### 5. Layout / telhado — agregado dormente, falta backfill

`Local` + `Superficie` existem desde a S1 e são o modelo canônico. O adapter `obterLocalProjeto` já resolve leitura com fallback.

O legado vive em `ProjetoFV.telhado` e `layout_solar`, servidos por `GET/POST /:id/telhado`.

**O bloqueio é dado, não código:** `local_ref` nunca foi populado. Depende do backfill — que depende de SSOT-GOV-003 (`empresa_id` com 0% de cobertura).

### 6. BESS — só cálculo, sem persistência

Uma rota: `POST /api/bess/dimensionar`. Nenhum model. O resultado é guardado em `ProjetoFV.bess` (subdoc).

**Exige agregado novo** se BESS for virar parte do fluxo canônico. A memória `bess_architecture_decision` já registrou a direção: *BESS como módulo irmão (`ProjetoBESS`) reusando engines horizontais, compondo com FV por referência*.

### 7. Financeiro — o pior caso: a regra está no frontend

`frontend/src/utils/financeiroEngine.js` — **424 linhas** com o motor financeiro completo:

```
composicaoCustos · calcularModoKitFechado · calcularModoComposicao
calcularMargem · calcularFinanciamento · calcularParcelamento
calcularRetorno · calcularTIR · calcularFinanceiroCompleto
```

**Não existe equivalente no backend.** O único cálculo financeiro do servidor é em `propostaComercialService:43`:

```js
const payback = (investimento / (economiaGerada * 12)).toFixed(1)
```

— um payback simplificado, só para o PDF. **Divergente** do motor do cliente, que faz TIR por bisseção, NPV, financiamento com carência e margem por Wp.

Ou seja: **duas implementações financeiras diferentes**, uma no cliente e uma no servidor, produzindo números que não precisam coincidir. É o achado mais sério desta auditoria.

Isso também explica a FV-DOM-003: o agregado `Orcamento` não persiste indicadores financeiros (INV-58) porque **nunca houve um motor no domínio** para derivá-los.

### 8. Documentos — agregado órfão

`DocumentoTecnico` existe com **33 campos** e está classificado como `ESCOPO_TENANT`. Mas:

- **não há rotas CRUD** para ele;
- os únicos consumidores são `geminiDocumentAnalyzer`, `adminCatalogo`, `alertcenter` e uma referência em `AlertaStatus`;
- a aba Documentos do legado (`DocumentCenter`) **não o usa** — lê `governanca.snapshot_*` e `documentacao_externa`.

Existem serviços de apoio prontos: `documentStorageService`, `documentOCRService`, `documentoEstruturadoService`, `storageProviders`.

**Falta expor a API** e ligar o agregado ao que a UX exibe.

---

## Ordenação por custo

### Grupo A — só UX, backend pronto (0 sprints de domínio)

| Funcionalidade | Justificativa |
|---|---|
| **Beneficiárias** | agregado + 7 rotas + regra compartilhada |
| **Unifilar** | 3 rotas + engine versionado |

### Grupo B — backend existe, precisa de ajuste pontual

| Funcionalidade | Ajuste |
|---|---|
| **Homologação** | 12 rotas prontas; mover estado do subdoc para `fases.homologacao` |
| **Documentos** | agregado pronto; **expor rotas CRUD** |
| **CRM** | resolver `crm_pipeline` duplicado (é FV-DOM-004) |

### Grupo C — bloqueado por dado, não por código

| Funcionalidade | Bloqueio |
|---|---|
| **Layout / telhado** | `Local`/`Superficie` prontos; falta **backfill** → SSOT-GOV-003 |

### Grupo D — exige domínio novo

| Funcionalidade | O que criar |
|---|---|
| **Financeiro** | motor financeiro no domínio (hoje só no cliente) |
| **BESS** | agregado `ProjetoBESS` (decisão já registrada) |

---

## Correção do plano anterior

A FV-UX-013 dizia que as 7 abas dependiam de FV-DOM-006/007. **Não dependem.**

- **2** precisam só de UX
- **3** precisam de ajuste pontual no backend
- **1** está bloqueada por backfill
- **2** exigem domínio novo — e uma delas (BESS) já tem decisão arquitetural tomada

O caminho mais curto para reduzir a AMB-2 é **Beneficiárias + Unifilar**: duas abas removidas do legado sem escrever uma linha de backend.

---

## Riscos registrados

| # | Risco | Grau |
|---|---|---|
| R1 | **Motor financeiro só no cliente** — dois cálculos divergentes de payback | **alto** |
| R2 | `DocumentoTecnico` órfão pode ter sido desenhado para um uso que mudou; expor API sem revisar o schema pode consolidar um modelo errado | médio |
| R3 | Homologação tem 2 máquinas de estado (`status` × `status_homologacao`) — migrar sem unificar propaga o defeito | médio |
| R4 | Layout depende de backfill que depende de decisão de negócio (SSOT-GOV-001) | médio |
| R5 | BESS: criar `ProjetoBESS` amplia o escopo do módulo FV para um módulo irmão | médio |

---

## Recomendação

Sequenciar por custo crescente, não por ordem das abas:

1. **FV-UX-015** — Beneficiárias e Unifilar na nova UX *(backend pronto)*
2. **FV-API-003** — expor CRUD de `DocumentoTecnico` *(agregado pronto)*
3. **FV-DOM-004** — ciclo unificado, absorve `crm_pipeline`
4. **FV-DOM-007** — motor financeiro no domínio *(fecha R1)*
5. **SSOT-GOV-003** → backfill → Layout
6. **BESS** — sprint própria, escopo de módulo irmão

**Nada foi alterado. Nenhum agregado criado.**
