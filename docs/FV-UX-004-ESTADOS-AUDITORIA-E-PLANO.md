# FV-UX-004 — F3: Consolidação das Máquinas de Estado do Projeto FV

**Data:** 2026-08-02
**Natureza:** auditoria + plano. **Nenhuma alteração de código, banco, API ou agregado.**
**Base de evidência:** `backend/src/models/ProjetoFV.js`, `controllers/projetosFVController.js`,
`utils/statusLifecycle.js`, `utils/homologacao/homologacaoAssistida.js`, `frontend/src/utils/comercialStateMachine.js`
+ consulta somente-leitura à base de produção (587 projetos).

---

## 0. Correção da auditoria FV-UX-001

Três caminhos de campo que reportei na FV-UX-001 **não existem**. Corrigidos aqui, porque implementar sobre eles falharia:

| Reportado em FV-UX-001 | Real |
|---|---|
| `workflow.estado` | `governanca.comercial.workflow_status` |
| `governanca.status` | `governanca.freeze_status` |
| `governanca.crm.estagio` | `governanca.comercial.crm_pipeline` |

E duas correções de fato:

- **`workflow` não é máquina de estado.** `workflowV3Schema` guarda progresso do wizard (`etapa_atual`, `etapas_completas`, `fluxo_origem`). Não tem estado de negócio. Fica fora desta consolidação.
- **São 9 máquinas, não 7.** Faltaram `homologacao.status_homologacao`, `governanca.comercial.followup.status` e `status_migracao`. Há ainda uma décima replicada dentro de `cenarios_governanca` (Mixed).

Também errei o sinal do risco. Ver §3.

---

## 1. Inventário e matriz

| # | Campo | Proprietário | Origem (quem escreve) | Consumidores | Persistido | Dependências | Remover? | Absorver? | Permanecer? |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `status` (raiz)<br>11 valores | Ciclo de vida | `alterarStatusCiclo` (`PUT /:id/status`); default `'rascunho'` na criação | `statusLifecycle`, `projetosFiltro`, listagem, CRM, painel | sim | nenhuma | não | — | **sim — vira o canônico** |
| 2 | `governanca.freeze_status`<br>5 valores | Governança de engenharia | `alterarStatusGovernanca`, `congelarProjetoFV`, `criarRevisaoProjetoFV`, `homologacaoController` | `GovernancaPainel`, `DocumentCenter`, `PropostaEnterprise`, `ProjetosFVDetalhes`, `alertDetectors`, `engenhariaGovernanca`, `painel` | sim | lê `status` | não | **parcial** — `CONGELADO`/`HOMOLOGADO` viram Baseline | vira flag de baseline |
| 3 | `governanca.comercial.workflow_status`<br>11 valores | Workflow comercial | `atualizarWorkflowComercial`, `registrarAssinaturaComercial`, `criarRevisaoComercial` | `DashboardComercial`, `DocumentCenter`, `PropostaEnterprise`, `ProjetosFVDetalhes`, `gerarPropostaPDF`, `painel` | sim | dita `status_juridico` | não | **sim — absorvido pelo canônico** | não |
| 4 | `governanca.comercial.status_juridico`<br>5 valores | Jurídico | **nunca escrito diretamente** — sempre `_statusJuridicoDeEstado(workflow_status)` | `PropostaEnterprise`, `gerarPropostaPDF` | sim (redundante) | 100 % derivado de #3 | **SIM** | — | não — vira getter |
| 5 | `governanca.comercial.crm_pipeline`<br>7 valores | CRM | `atualizarCrm` | `CrmPainel`, `DashboardComercial`, `ProjetosFVDetalhes`, `projetoFVApi` | sim | paralela a #3 | não | **sim** — projeção de #3 | não |
| 6 | `governanca.comercial.followup.status`<br>**sem enum** | CRM operacional | `atualizarCrm` | `CrmPainel` | sim | nenhuma | não | não | **sim** — é lembrete, não estado do projeto |
| 7 | `proposta.status`<br>5 valores | Proposta comercial | nenhum escritor de produção localizado | nenhum consumidor de produção localizado | sim | — | **SIM — órfão** | — | não |
| 8 | `homologacao.status`<br>5 valores | Homologação (legado) | `homologacaoController:327` | `homologacaoAssistida` (fallback) | sim | — | não | **sim** — por #9 | não |
| 9 | `homologacao.status_homologacao`<br>7 valores | Homologação (S9.0) | `routes/homologacao`, `homologacaoAssistida` — **derivado**, não escrito à mão | `CentralDados`, `CrmProjetos` | sim | deriva de #8 + documentos | não | vira estado da fase Homologação | **sim** |
| 10 | `status_migracao`<br>3 valores | Importação (LME) | importador SolarMarket | `ativosController`, `CrmProjetos` | sim | — | não | não | **sim** — pertence ao LME, não ao ciclo |
| 11 | `cenarios_governanca[*].{freeze_status,workflow_status,status_juridico}` | Governança por cenário | `congelarCenarioComercial`, `workflowCenarioComercial`, `assinarCenarioComercial` | `PropostaEnterprise` | sim (**Mixed — sem validação**) | replica #2/#3/#4 | não | **sim** — vira estado do Orçamento | não |

---

## 2. Transições existentes

Três tabelas de transição, **em três lugares diferentes**, sem relação entre si:

**`freeze_status`** — `projetosFVController.js:1082`
```
RASCUNHO → APROVADO | EM_REVISAO
EM_REVISAO → APROVADO | RASCUNHO
APROVADO → CONGELADO | RASCUNHO | EM_REVISAO
CONGELADO → HOMOLOGADO | EM_REVISAO
HOMOLOGADO → EM_REVISAO
```

**`workflow_status`** — `projetosFVController.js:1250` **e duplicada** em `frontend/src/utils/comercialStateMachine.js:29`
```
RASCUNHO → EM_ANALISE | CANCELADO
EM_ANALISE → NEGOCIACAO | AGUARDANDO_CLIENTE | REPROVADO | CANCELADO
NEGOCIACAO → AGUARDANDO_CLIENTE | APROVADO | REPROVADO | CANCELADO
AGUARDANDO_CLIENTE → APROVADO | NEGOCIACAO | REPROVADO | EXPIRADO | CANCELADO
APROVADO → ASSINADO | NEGOCIACAO | CANCELADO | EXPIRADO
ASSINADO → IMPLANTACAO | CANCELADO      CONCLUIDO/CANCELADO → (terminal)
IMPLANTACAO → CONCLUIDO | CANCELADO      REPROVADO/EXPIRADO → EM_ANALISE
```

**`status` (raiz) — não tem tabela de transição.** `alterarStatusCiclo` aceita qualquer valor (§4, I-1).

---

## 3. Estado real em produção — 587 projetos

| Campo | Distribuição |
|---|---|
| `status` | **null = 541 (92,2 %)** · rascunho 28 · proposta 17 · em_simulacao 1 |
| `governanca.freeze_status` | null 584 · **EM_REVISAO 1 · HOMOLOGADO 1 · RASCUNHO 1** |
| `governanca.comercial.workflow_status` | null 585 · **NEGOCIACAO 1 · EM_ANALISE 1** |
| `governanca.comercial.status_juridico` | null 585 · PENDENTE_ASSINATURA 2 |
| `governanca.comercial.crm_pipeline` | null 585 · PROPOSTA 1 · LEAD 1 |
| `proposta.status` | **null 587 — nunca usado** |
| `homologacao.status` | null 541 · rascunho 46 (todos no valor default) |
| `homologacao.status_homologacao` | **null 587 — nunca usado** |

**Combinações realmente existentes: 7** (não centenas)

```
541x  (null)       | (null)      | (null)
 28x  rascunho     | (null)      | (null)
 14x  proposta     | (null)      | (null)
  1x  proposta     | EM_REVISAO  | NEGOCIACAO
  1x  proposta     | HOMOLOGADO  | (null)
  1x  proposta     | RASCUNHO    | EM_ANALISE
  1x  em_simulacao | (null)      | (null)
```

Outros números: **0 assinaturas** · 2 snapshots congelados · 1 documento com `cenarios_governanca` · `legacy: true` em 0.

**Composição da base:** `status_migracao` = `proposta_importada` 514 · `shell_importado` 52 · null 21.
**566 dos 587 (96,4 %) são importações do SolarMarket** — território do LME por `dominio/README.md`, não do Core.

### Correção do risco que estimei na FV-UX-001

Eu classifiquei a F3 como *"o maior risco do plano — toca dados existentes com combinações inconsistentes em produção"*. **Está errado.**

Projetos com mais de uma máquina preenchida: **3**. Duas das nove máquinas nunca foram usadas. A base nativa (não importada) é de **21 projetos**.

As 9 máquinas concorrentes são um problema de **esquema e código**, quase não de dados. Isso muda a F3 de "migração de dados de alto risco" para **"consolidação de código com backfill trivial"** — e permite executá-la muito antes do que o plano previa.

---

## 4. Duplicações, inconsistências e estados impossíveis

### Duplicações

| # | Item | Evidência |
|---|---|---|
| DUP-1 | Tabela `TRANSICOES_COMERCIAL` existe **duas vezes**, idêntica | `projetosFVController.js:1250` e `comercialStateMachine.js:29` — cópias manuais que podem divergir |
| DUP-2 | `status_juridico` é 100 % função de `workflow_status` | `_statusJuridicoDeEstado()` (controller:1266) e `statusJuridicoDeEstado()` (frontend) — persistir é redundante |
| DUP-3 | `crm_pipeline` reexpressa o funil de `workflow_status` | `LEAD/QUALIFICADO/PROPOSTA/NEGOCIACAO/FECHADO/PERDIDO/IMPLANTACAO` ≈ `RASCUNHO…IMPLANTACAO` |
| DUP-4 | `homologacao.status` × `homologacao.status_homologacao` | o segundo foi declarado "aditivo, não substitui o legado" (schema:858) e nunca substituiu |
| DUP-5 | `cenarios_governanca[*]` replica 3 máquinas por cenário | mesmo nome de campo, **sem enum** (Mixed) |
| DUP-6 | 2 vocabulários de "concluído" | `status='concluido'` × `workflow_status='CONCLUIDO'` × `freeze_status='HOMOLOGADO'` |

### Inconsistências

| # | Problema | Evidência | Consequência |
|---|---|---|---|
| **I-1** | **`alterarStatusCiclo` não valida transição.** `paraModel()` mapeia qualquer valor desconhecido para `'rascunho'` | `controller:429-434`, `statusLifecycle.js:29` | `PUT /:id/status {status:"qualquer_coisa"}` → grava `rascunho` silenciosamente. Um projeto `concluido` pode voltar a `rascunho` sem erro |
| **I-2** | **`freeze_status` tem dois vocabulários com o mesmo nome.** No documento: `RASCUNHO\|EM_REVISAO\|APROVADO\|CONGELADO\|HOMOLOGADO`. Em `cenarios_governanca`: **`EDITAVEL`\|`CONGELADO`** | `controller:1574` grava `'EDITAVEL'`, valor **fora do enum** | Só não falha porque `cenarios_governanca` é `Mixed`. Qualquer código que trate os dois uniformemente erra |
| **I-3** | `status` (raiz) tem 11 valores mas a camada de exibição só reconhece 9 | `statusLifecycle.js` mapeia `em_simulacao→RASCUNHO`, `dimensionado→EM_ANALISE` | 2 valores do enum são inalcançáveis pela UI. Há 1 projeto em `em_simulacao` em produção |
| **I-4** | Nenhuma máquina sincroniza com outra | não existe hook, middleware ou serviço de sincronização | `status` e `workflow_status` evoluem independentemente |
| **I-5** | `followup.status` é `String` livre, sem enum | schema:459 (só um comentário lista valores) | não é validável nem consultável de forma confiável |
| **I-6** | `derivarStatusSeguro` já deriva `status` de `freeze_status` + assinaturas | `statusLifecycle.js:47` | a derivação cross-máquina **já existe**, mas só na leitura e só quando `status` é null — precedente útil, hoje inconsistente com a escrita |

### Estados impossíveis (permitidos pelo esquema)

Nenhum é bloqueado hoje; nenhum ocorreu ainda porque a base é quase toda importada.

| # | Combinação | Por que é impossível |
|---|---|---|
| **X-1** | `status='concluido'` + `workflow_status='RASCUNHO'` | obra concluída com proposta em rascunho |
| **X-2** | `freeze_status='HOMOLOGADO'` + `status='rascunho'` | homologado sem nunca ter sido aprovado |
| **X-3** | `workflow_status='ASSINADO'` + `freeze_status='RASCUNHO'` | contrato assinado sem baseline congelada |
| **X-4** | `crm_pipeline='PERDIDO'` + `status='em_execucao'` | venda perdida em execução |
| **X-5** | `homologacao.status='conectado'` + `status='rascunho'` | usina conectada à rede em projeto rascunho |
| **X-6** | `status_juridico='ASSINADO'` + `workflow_status='NEGOCIACAO'` | só não ocorre porque #4 é sempre derivado — **nada impede** uma escrita direta |
| **X-7** | `cenarios_governanca[i].freeze_status='CONGELADO'` + `governanca.freeze_status='RASCUNHO'` | cenário congelado em projeto editável — **já quase ocorre**: 1 projeto tem `cenarios_governanca` |

Um caso real já se aproxima disso: `proposta | HOMOLOGADO | (null)` — projeto homologado sem nenhum workflow comercial.

---

## 5. Máquina canônica

Uma máquina, um campo, uma tabela de transição.

```
LEAD → COLETA → DIMENSIONAMENTO → COTACAO → ORCAMENTO → APROVACAO
  → [bifurcação] ENGENHARIA ∥ HOMOLOGACAO → INSTALACAO → COMISSIONAMENTO
```

### Estados

| Estado | Entra quando | Sai quando |
|---|---|---|
| `LEAD` | projeto criado | dados do cliente/UC confirmados |
| `COLETA` | cliente vinculado | fatura, consumo, local e superfícies completos |
| `DIMENSIONAMENTO` | coleta completa | potência e topologia definidas e coerentes com a área |
| `COTACAO` | dimensionamento fechado | ≥1 cotação registrada |
| `ORCAMENTO` | ≥1 orçamento gerado | um orçamento é escolhido |
| `APROVACAO` | orçamento submetido | aprovado **e** Baseline Contratual congelada |
| `ENGENHARIA` ∥ `HOMOLOGACAO` | baseline congelada (bifurcação — **fases paralelas, não estados exclusivos**) | projeto executivo emitido / parecer de acesso aprovado |
| `INSTALACAO` | ambas as fases concluídas | as-built registrado |
| `COMISSIONAMENTO` | as-built registrado | comissionada |
| `CONCLUIDO` | comissionamento aceito | terminal |
| `PERDIDO` · `CANCELADO` · `ARQUIVADO` | a qualquer momento antes de `INSTALACAO` | terminais |

### Decisão estrutural: bifurcação não cabe em um campo escalar

`ENGENHARIA` e `HOMOLOGACAO` correm **em paralelo**. Um único campo não representa "engenharia concluída, homologação pendente".

Modelo proposto — **um estado + duas fases**:

```
ciclo: { estado, em, por }                        ← máquina única, escalar
fases: {
  engenharia:    { estado, iniciada_em, concluida_em },
  homologacao:   { estado, iniciada_em, concluida_em },
}
```

`ciclo.estado` só avança para `INSTALACAO` quando **ambas** as fases estão concluídas. Isso é a regra que hoje não existe (DIV-7 da FV-UX-001) e a razão de a bifurcação ser hoje "abas acessíveis a qualquer momento".

`homologacao.status_homologacao` (#9) **já é exatamente `fases.homologacao.estado`** — é a única das nove máquinas que sobrevive quase intacta, apenas realocada.

---

## 6. Mapa de absorção

| Máquina atual | Destino | Regra |
|---|---|---|
| `status` (11) | **`ciclo.estado`** | `rascunho\|em_simulacao → LEAD` · `em_analise\|dimensionado → DIMENSIONAMENTO` · `proposta → ORCAMENTO` · `aprovado → APROVACAO` · `em_execucao → INSTALACAO` · `concluido → CONCLUIDO` · `perdido\|cancelado\|arquivado` → homônimos |
| `governanca.freeze_status` (5) | **flag de Baseline**, não estado | `RASCUNHO\|EM_REVISAO` → sem baseline · `APROVADO` → baseline pronta p/ congelar · `CONGELADO` → baseline congelada · `HOMOLOGADO` → `fases.homologacao.estado = homologado` |
| `governanca.comercial.workflow_status` (11) | **`ciclo.estado`** | `RASCUNHO\|EM_ANALISE → ORCAMENTO` · `NEGOCIACAO\|AGUARDANDO_CLIENTE → ORCAMENTO` · `APROVADO\|ASSINADO → APROVACAO` · `IMPLANTACAO → INSTALACAO` · `CONCLUIDO → CONCLUIDO` · `REPROVADO\|CANCELADO → CANCELADO` · `EXPIRADO → PERDIDO` |
| `governanca.comercial.status_juridico` (5) | **eliminado** — vira getter derivado | já é `_statusJuridicoDeEstado()`; deixa de ser persistido |
| `governanca.comercial.crm_pipeline` (7) | **eliminado** — vira projeção de `ciclo.estado` | `LEAD→LEAD` · `QUALIFICADO→COLETA` · `PROPOSTA→ORCAMENTO` · `NEGOCIACAO→ORCAMENTO` · `FECHADO→APROVACAO` · `IMPLANTACAO→INSTALACAO` · `PERDIDO→PERDIDO` |
| `governanca.comercial.followup.status` | **permanece** | é lembrete operacional de CRM, não estado do projeto. Ganha enum |
| `proposta.status` (5) | **removido** | órfão: 0 escritores, 0 consumidores, 0 registros |
| `homologacao.status` (5) | **absorvido por #9** | `rascunho→nao_iniciado` · `enviado→pendente_concessionaria` · `analise→pendente_concessionaria` · `aprovado→homologado` · `conectado→homologado` |
| `homologacao.status_homologacao` (7) | **`fases.homologacao.estado`** | movido, valores preservados |
| `status_migracao` (3) | **permanece, fora do ciclo** | pertence ao LME (ADR-022) |
| `cenarios_governanca[*].{3 campos}` | **estado do Orçamento** | depende do agregado `Orçamento` (F4). `EDITAVEL→rascunho` · `CONGELADO→congelado` |

**Resultado: 9 máquinas → 1 máquina + 2 fases + 1 flag de baseline.**
Removidas: 2 (`proposta.status`, `status_juridico`). Absorvidas: 4. Realocadas: 2. Fora do escopo: 1.

---

## 7. Plano de migração

### Pré-condição

`ciclo.estado` inclui `COTACAO` e `ORCAMENTO`, que pressupõem os agregados `Cotacao` e `Orcamento` (F4 do plano FV-UX-001). **A consolidação pode e deve vir antes deles** — os estados existem como valores do enum mesmo antes de os agregados existirem; o que não existirá ainda é a *transição automática* para eles. É o inverso do que a FV-UX-001 supôs.

### Sequência

| # | Etapa | Arquivos afetados | Critério de aceitação |
|---|---|---|---|
| **F3.1** | **Fonte única de transições.** Extrair `TRANSICOES_COMERCIAL` + `ORDEM` + derivações para um módulo em `packages/fv-shared` (infra da F2 já pronta). Elimina DUP-1 e DUP-2. Nenhuma mudança de comportamento. | `packages/fv-shared/ciclo/*` (novo), `projetosFVController.js`, `comercialStateMachine.js` | Tabela definida em 1 lugar; identidade de referência provada entre back e front; suíte idêntica ao baseline |
| **F3.2** | **Fechar I-1.** `alterarStatusCiclo` passa a validar transição e a rejeitar valor desconhecido com 422 em vez de degradar para `rascunho`. | `projetosFVController.js`, `statusLifecycle.js` | Valor inválido → 422 (não 200) · transição ilegal → 422 · nenhum caminho grava `rascunho` por fallback |
| **F3.3** | **Fechar I-2.** Unificar o vocabulário de `freeze_status` nos cenários (`EDITAVEL` → `RASCUNHO`) e tipar `cenarios_governanca` (sai de `Mixed`). | `ProjetoFV.js`, `projetosFVController.js` | Um único vocabulário; enum validado; 1 documento existente migrado |
| **F3.4** | **Remover os órfãos.** `proposta.status` e `status_juridico` deixam de ser persistidos; `status_juridico` vira getter. | `ProjetoFV.js`, `PropostaEnterprise.jsx`, `gerarPropostaPDF.js` | 0 escritas · leitores recebem o valor derivado · saída do PDF byte-idêntica em amostra |
| **F3.5** | **Introduzir `ciclo` e `fases`** em paralelo, **derivados por leitura** dos campos atuais (padrão já usado por `derivarStatusSeguro`, I-6). Nada de escrita ainda. | `ProjetoFV.js`, novo `dominio/ciclo/`, `projetosFVController.js` | `GET /:id` devolve `ciclo` e `fases` corretos para as **7 combinações reais** · nenhuma escrita nova |
| **F3.6** | **Inverter a direção.** `ciclo.estado` passa a ser escrito; as máquinas antigas passam a ser derivadas dele (compat de leitura para os 11 consumidores de frontend). | `projetosFVController.js`, `routes/painel.js`, `homologacaoController.js` | Toda escrita passa por um único ponto · máquinas antigas continuam respondendo valores coerentes |
| **F3.7** | **Backfill.** 21 projetos nativos (`status_migracao: null`); os 566 importados ficam com `ciclo.estado` derivado de `status_migracao`, **sem reescrita** — responsabilidade do LME. | script de backfill (LME) | 21/21 migrados com mapeamento explícito · dry-run + hash antes do apply · reversível |
| **F3.8** | **Remoção definitiva.** Excluir `workflow_status`, `crm_pipeline`, `homologacao.status`, `freeze_status` como estado (permanece só como flag de baseline). | `ProjetoFV.js` + consumidores | 0 leituras dos campos removidos · X-1..X-7 tornam-se irrepresentáveis no esquema |

### Ordem irredutível

```
F3.1 ──► F3.2 ──► F3.5 ──► F3.6 ──► F3.7 ──► F3.8
F3.3 ──┘                     ▲
F3.4 ──────────────────────┘
```

F3.1, F3.3 e F3.4 são independentes entre si e podem correr em paralelo.

### Riscos

| # | Risco | Grau | Mitigação |
|---|---|---|---|
| R1 | 11 arquivos de frontend leem as máquinas antigas | **alto** — é o volume real | F3.6 mantém as antigas como derivadas até F3.8 |
| R2 | Backfill de dados | **baixo** (era o que eu classificara como alto) | 21 projetos nativos; 3 com multi-máquina; dry-run obrigatório |
| R3 | `cenarios_governanca` é `Mixed` sem validação | médio | F3.3 tipa antes de qualquer outra coisa tocá-lo |
| R4 | `COTACAO`/`ORCAMENTO` sem agregado correspondente | médio | estados existem no enum; transição automática só após F4 |
| R5 | Projetos congelados/homologados/com ART | baixo | 2 snapshots, 1 homologado — política S1: não reconverter |
| R6 | 566 importados sem estado nativo | baixo | ficam sob `status_migracao`; Core não decide sobre dado legado (`dominio/README.md`) |

---

## 8. Conclusão

O critério pedido — *plano completo para eliminar as múltiplas máquinas e substituí-las por um modelo canônico compatível com o SSOT* — está atendido: **9 máquinas → 1 máquina + 2 fases + 1 flag**, com mapa de absorção valor a valor e sequência em 8 etapas.

Dois pontos que mudam o planejamento anterior:

1. **A F3 é muito mais barata do que a FV-UX-001 previu.** Eu a classifiquei como maior risco por supor dados inconsistentes em massa. São 7 combinações reais, 3 projetos multi-máquina, 21 projetos nativos. O custo está no **código** (11 arquivos de frontend, 3 tabelas de transição), não nos dados.

2. **A F3 não depende da F4.** Pode começar imediatamente, antes de `Cotacao`/`Orcamento`. As etapas F3.1–F3.4 são correções de defeito com valor próprio — em especial **F3.2**, que fecha um caminho onde qualquer valor inválido vira `rascunho` silenciosamente.

**Nenhuma alteração foi realizada.** Implementação aguarda aprovação.
