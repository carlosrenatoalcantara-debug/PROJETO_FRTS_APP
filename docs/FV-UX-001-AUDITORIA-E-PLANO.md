# FV-UX-001 — Auditoria e Plano de Substituição Definitiva do Fluxo FV

**Data:** 2026-08-02
**Natureza:** auditoria + plano. **Nenhuma alteração de código, banco, API ou agregado.**
**Referências:** ADR-019, ADR-021 (arquitetura congelada), SSOT-GOV-001/002/003, S1–S4C.

---

## 1. Auditoria

### 1.1 Páginas

| Arquivo | Rota | Linhas | Papel |
|---|---|---|---|
| `pages/ProjetosFV.jsx` | `/projetos-fv` | 464 | Listagem/filtros |
| `pages/ProjetosFVNovo.jsx` | `/projetos-fv/novo` | 515 | **Host oficial do wizard** (E1–E8) |
| `pages/ProjetosFVDetalhes.jsx` | `/projetos-fv/:id` | 648 | Detalhe + abas (financeiro, homologação, ativos) |
| `pages/SimulacaoFV.jsx` | `/projetos-fv/simulacao` | 820 | Simulação avulsa, **fora do funil** |
| `pages/Homologacao.jsx` | `/homologacao` | — | Homologação **genérica**, sem projeto |
| `pages/NovaProposta.jsx` | `/propostas/nova` | **1206** | **DEPRECATED_DO_NOT_USE** (declarado no `App.jsx:55`) — ainda roteada |
| `pages/NovaPropostaV2.jsx` | — | — | **Morta**: importada em `NovaProposta.jsx:15`, render comentado em `:1030` |
| `pages/PropostaPublica.jsx` | `/p/:token` | — | Leitura pública (S5) |

### 1.2 Wizard — etapas

Host: `ProjetosFVNovo.jsx`. Ordem canônica em `config/etapasFunilFV.js` (9 passos, 4 macro-grupos).

| Etapa | Arquivo | Linhas | Escreve em |
|---|---|---|---|
| 1 | `E1Upload.jsx` | 212 | `fatura_extracao`, `dadosCliente`, `dadosConsumo` |
| 2 | `E2Consumo.jsx` | 281 | `dadosConsumo` |
| 2.5 | `E2BBeneficiarias.jsx` | 368 | `UnidadeBeneficiaria` (AR próprio) |
| 3 | `E3Localizacao.jsx` | 207 | `localizacao` (flat + subdoc) |
| 4 | `E4Irradiancia.jsx` | 214 | `irradiancia_local` |
| 5 | `E5Dimensionamento.jsx` | 371 | `dimensionamento` |
| 6 | `E6Area.jsx` | 214 | `area`, `telhado`, `layout_solar` |
| 7 | `E7Equipamentos.jsx` | 525 | `equipamentos`, **`arranjos[]`** |
| 8 | `E8Orcamento.jsx` | **1052** | `orcamento`, `proposta`, `workflow`, `governanca`, `financeiro` |

**Total do wizard ativo: 3.444 linhas.**

**Órfãos na pasta `etapas/` (zero referências):**
- `E2UnidadesConsumidoras.jsx` — 266 linhas
- `E3PreDimensionamento.jsx` — 243 linhas

### 1.3 Contexto e estado

`contexts/ProjetoFVContext.jsx` (195 linhas) — raiz única do wizard, consumida por 16 arquivos.

- Persistência local: `localStorage['forte_solar_wizard_fv_v3']`, gravada a cada mudança de estado.
- Navegação **hardcoded no contexto** (`proxima`/`anterior`), com salto fracionário `2 → 2.5 → 3` e `Math.min(…, 8)` fixo — **não deriva de `ETAPAS`**, apesar de `ETAPAS` se declarar "fonte única de verdade".
- Shape do estado espelha 1:1 as etapas do wizard, não os agregados do domínio.

### 1.4 Serviços e transporte

| Arquivo | Linhas | Papel |
|---|---|---|
| `services/projetoFVApi.js` | 489 | Adapters de leitura/escrita + `salvarEtapa` + governança comercial |
| `services/projetosFvLifecycleApi.js` | — | Duplicar / ampliar / arquivar / restaurar / status |
| `services/http.js` | — | `apiFetch` — injeção automática de JWT por origem |

Contrato de escrita dominante: `PUT /api/projetos-fv/:id/etapa` → `$set[chave_da_etapa]`.
Consequência: **o backend não valida transição de etapa** — aceita qualquer chave, em qualquer ordem.

### 1.5 APIs FV (backend)

| Rota | Guardas |
|---|---|
| `/api/projetos-fv` | `protegerModulo('fv')` + `exigirOrganizacao` |
| `/api/instalacoes` | `protegerModulo('fv')` + `exigirOrganizacao` — **zero consumidores no frontend** |
| `/api/projetos-fv/:id/homologacao` | `protegerModulo('fv')` + `exigirOrganizacao` |
| `/api/projetos-fv/:id/proposta` | idem |
| `/api/projetos-fv/:id/beneficiarias` | idem |
| `/api/engenharia` | **sem guarda** |
| `/api/orcamento` | **sem guarda** (`/gerar`, `/validar`) |
| `/api/dimensionamento` | **sem guarda** |
| `/api/unifilar`, `/api/irradiancia`, `/api/referencia`, `/api/projeto`, `/api/recomendacao`, `/api/decisao` | **sem guarda** |

Endpoints de governança em `routes/projetosFV.js`: 20 rotas — 4 de ciclo de vida, 16 de governança comercial/engenharia.

### 1.6 Persistência

`models/ProjetoFV.js` — **1.095 linhas, ~55 caminhos de primeiro nível**, com duplicação estrutural declarada (`schema_version` v2 flat × v3 subdocs):

| Conceito | Representação v2 (flat) | Representação v3 (subdoc) | Representação SSOT |
|---|---|---|---|
| Local | `endereco_completo`, `latitude`, `longitude`, `cidade`, `estado`, `cep` | `localizacao{}` | `Local` (AR) + `local_ref` |
| Superfície | `telhado{}` | `layout_solar{}` | `Superficie` (subdoc de `Local`) |
| Topologia | `equipamentos{}`, `arranjos[]`, `strings[]` | — | `Instalacao` (AR) + `instalacao_ref` |
| Dimensionamento | `potencia_kwp`, `geracao_mensal_kwh` | `dimensionamento{}` | derivado (INV-58) |

`local_ref` e `instalacao_ref` **existem no schema e nunca são preenchidos pelo fluxo** (S4A/S4C-0 entregues, não conectados).

---

## 2. Código morto, duplicação, acoplamento

### 2.1 Código morto (confirmado por varredura de referências)

| # | Item | Evidência | Linhas |
|---|---|---|---|
| M-1 | `pages/NovaPropostaV2.jsx` | único importador é `NovaProposta.jsx`, cujo `return <NovaPropostaV2 />` está comentado (`:1030`) | — |
| M-2 | `components/fv/funilv2/` (4 arquivos) | alcançável só via M-1 | 324+ |
| M-3 | `components/fv/etapas/E2UnidadesConsumidoras.jsx` | 0 referências | 266 |
| M-4 | `components/fv/etapas/E3PreDimensionamento.jsx` | 0 referências | 243 |
| M-5 | `components/fv/ValidadorEquipamentoFV.jsx` | 0 referências | 354 |
| M-6 | `components/fv/ModalCadastroPainel.jsx` | 0 referências | — |
| M-7 | `pages/NovaProposta.jsx` | `DEPRECATED_DO_NOT_USE`, mas rota `/propostas/nova` ativa | 1206 |
| M-8 | `arranjoMPPTs` (dispatch do Context) | não existe no schema `ProjetoFV` — nunca persiste | — |
| M-9 | `topologia2` (`ConfiguradorArranjoFV`) | estado local parcialmente descartado no salvamento | — |

**Total imediatamente removível (M-1 a M-6): ~1.200 linhas.**
Com M-7: **~2.400 linhas.**

### 2.2 Lógica duplicada

| # | Duplicação | Detalhe |
|---|---|---|
| D-1 | **Homologação em dois lugares** | `components/homologacao/` (usada por `/homologacao`) × `components/fv/homologacao/` (usada por `ProjetosFVDetalhes`). Três arquivos homônimos: `CartaConcessionaria`, `DadosART`, `ChecklistDocumentos` |
| D-2 | **Topologia** | `arranjos[]` (produção) × `Instalacao` (dormente) |
| D-3 | **Local** | `localizacao`/`telhado`/`area` (produção) × `Local`/`Superficie` (dormente) |
| D-4 | **Schema dual** | v2 flat × v3 subdoc no mesmo documento |
| D-5 | **Proposta** | `Proposta.jsx` × `PropostaEnterprise.jsx` × `gerarPropostaPDF` × `gerarPdfOrcamento` × `gerarPdfComercial` |
| D-6 | **Simulação** | `pages/SimulacaoFV.jsx` (820) × `E5Dimensionamento` — mesmo cálculo, entradas diferentes |
| D-7 | `derivarTopologia` | dois significados distintos: `TopologiaMPPTEditor` (expansão) × `equipamentos/inversores` (classificação) |

### 2.3 Estados redundantes — **7 máquinas de estado concorrentes no mesmo documento**

| Campo | Valores |
|---|---|
| `status` | `rascunho, em_simulacao, em_analise, dimensionado, proposta, aprovado, em_execucao, concluido, perdido, cancelado, arquivado` (11) |
| `workflow.estado` | `RASCUNHO, EM_ANALISE, NEGOCIACAO, AGUARDANDO_CLIENTE, APROVADO, ASSINADO, IMPLANTACAO, CONCLUIDO, REPROVADO, CANCELADO, EXPIRADO` (11) |
| `workflow.status_juridico` | `PENDENTE_ASSINATURA, ASSINADO, EXPIRADO, CANCELADO, EM_REVISAO` |
| `governanca.status` | `RASCUNHO, EM_REVISAO, APROVADO, CONGELADO, HOMOLOGADO` |
| `governanca.crm.estagio` | `LEAD, QUALIFICADO, PROPOSTA, NEGOCIACAO, FECHADO, PERDIDO, IMPLANTACAO` |
| `proposta.status` | `rascunho, enviada, aceita, recusada, expirada` |
| `homologacao.status` | `nao_iniciado, em_preparacao, pendente_documentacao, pendente_engenharia, pendente_concessionaria, homologado, reprovado` |
| `homologacao.parecer.status` | `rascunho, enviado, analise, aprovado, conectado` |

**Nenhuma sincronização declarada entre elas.** Um projeto pode estar `status: aprovado` + `workflow.estado: RASCUNHO` + `governanca.status: CONGELADO` simultaneamente. Este é o maior débito estrutural do módulo.

### 2.4 Dependências ocultas e acoplamentos

| # | Acoplamento | Gravidade |
|---|---|---|
| **A-1** | **12 arquivos de produção do frontend importam código-fonte do backend por caminho relativo** (`../../../../backend/src/...`): `E7Equipamentos`, `BeneficiariasPainel`, `AssistenteImportacaoDatasheet`, `CentralDados`, `CentralDocumentos`, `fv/homologacao/Homologacao`, `Catalogo`, `Inversores`, `catalogoEngenhariaAdapter`, `catalogQualityEngine`, `engenhariaPayload` | **Crítica** — o bundle do frontend contém código de backend; quebra a separação de deploy (Vercel × Railway) |
| A-2 | Navegação do wizard hardcoded no `ProjetoFVContext` em vez de derivada de `ETAPAS` | Alta |
| A-3 | `localStorage` fixa o shape do estado — trocar o Context invalida sessões em curso silenciosamente | Alta |
| A-4 | `salvarEtapa` aceita `$set` de qualquer chave, sem validação de ordem ou completude no backend | Alta |
| A-5 | `E8Orcamento` acopla 5 domínios (orçamento, proposta, financeiro, governança, CRM) num único componente | Alta |
| A-6 | `ConfiguradorArranjoFV` (1.108 linhas) concentra captura de topologia, validação elétrica e layout | Alta |
| A-7 | `/api/orcamento`, `/api/engenharia`, `/api/dimensionamento` sem `exigirOrganizacao` — cálculo acessível fora do escopo de tenant | Média (segurança) |
| A-8 | `Proposta.jsx` com 31 referências — nome genérico colidindo em buscas; risco em refatoração automática | Média |

### 2.5 Componentes monolíticos

| Arquivo | Linhas | Responsabilidades acumuladas |
|---|---|---|
| `NovaProposta.jsx` | 1206 | fluxo inteiro deprecado |
| `ConfiguradorArranjoFV.jsx` | 1108 | topologia + validação + layout + persistência |
| `E8Orcamento.jsx` | 1052 | orçamento + proposta + financeiro + governança + CRM + PDF + unifilar |
| `SimulacaoFV.jsx` | 820 | funil paralelo de simulação |
| `ProjetosFVDetalhes.jsx` | 648 | detalhe + homologação + ativos + financeiro |
| `models/ProjetoFV.js` | 1095 | 7 máquinas de estado + 2 esquemas + 4 domínios |

---

## 3. Confronto com o fluxo canônico

```
Lead → Coleta de Dados → Dimensionamento → Cotação → Orçamento → Aprovação
   → ⑂ Engenharia | Homologação → Instalação → Comissionamento
```

| Etapa canônica | Implementação atual | Divergência |
|---|---|---|
| **Lead** | `governanca.crm.estagio = LEAD`; `CrmLead`/`CrmFunil` separados; wizard **não nasce de um Lead** | **DIV-1** — o funil FV começa em Fatura (E1). Lead existe em outro módulo, sem ligação obrigatória |
| **Coleta de Dados** | E1 Fatura + E2 Consumo + E2.5 Beneficiárias + E3 Localização | Cobre. **DIV-2** — não há *visita técnica* nem registro de completude da coleta |
| **Dimensionamento** | E4 Irradiância + E5 Dimensionamento + E6 Área | **DIV-3** — E6 (Área) vem **depois** de E5, sem realimentação. A área não restringe a potência; o laço área↔potência não existe |
| **Cotação** | **INEXISTENTE** | **DIV-4 (bloqueante)** — o termo só aparece em comentário. Não há entidade de cotação, nem cotação de fornecedor, nem comparação. `BuscaKitsFV`/`SeletorAutomaticoKits` selecionam kit, mas isso é **seleção de equipamento**, não cotação |
| **Orçamento** | E8 → `orcamento{}` subdoc **1:1** de `ProjetoFV` | **DIV-5 (bloqueante)** — orçamento não é agregado; **um projeto tem exatamente um orçamento**. O fluxo canônico pressupõe orçamento como resultado de cotação, e a prática comercial exige N cenários comparáveis |
| **Aprovação** | `workflow.estado = APROVADO` + `governanca.congelar` + assinatura | **DIV-6** — três mecanismos concorrentes de aprovação (`workflow`, `governanca`, `proposta.status`), sem ordem definida entre eles. Não existe *baseline contratual* congelada como referência das fases seguintes |
| **Bifurcação** | **INEXISTENTE** | **DIV-7 (bloqueante)** — não há ponto de bifurcação. Engenharia e Homologação são abas de `ProjetosFVDetalhes`, acessíveis a qualquer momento, inclusive antes da aprovação |
| **⑂ Engenharia** | `/api/engenharia` (cálculo), `engenharia_eletrica{}`, unifilar | **DIV-8** — engenharia é **cálculo sob demanda**, não uma fase com entradas, saídas e conclusão. Não existe *Projeto Executivo* |
| **⑂ Homologação** | `homologacao{}` + `/api/projetos-fv/:id/homologacao` + **duas UIs** | **DIV-9** — implementação duplicada (D-1); a página `/homologacao` opera **sem projeto vinculado** |
| **Instalação** | `status: em_execucao`; `AtivoEquipamento` (Gêmeo Digital) | **DIV-10** — sem fase de execução modelada: sem cronograma, sem apontamento, sem *as-built*. O termo "Instalação" no código designa o **agregado de topologia** (`Instalacao`), não a fase de obra — colisão de nomenclatura |
| **Comissionamento** | **INEXISTENTE** | **DIV-11 (bloqueante)** — nenhum campo, rota ou tela |

### 3.1 Síntese das divergências

| Classe | Divergências |
|---|---|
| **Etapa ausente por completo** | Cotação (DIV-4), Bifurcação (DIV-7), Comissionamento (DIV-11) |
| **Etapa presente mas sem modelo** | Instalação/obra (DIV-10), Engenharia como fase (DIV-8) |
| **Cardinalidade errada** | Orçamento 1:1 em vez de 1:N (DIV-5) |
| **Sequência errada** | Área depois do dimensionamento, sem laço (DIV-3) |
| **Controle concorrente** | Aprovação em 3 lugares (DIV-6); 7 máquinas de estado (§2.3) |
| **Entrada errada do funil** | Fatura em vez de Lead (DIV-1) |
| **Duplicação de implementação** | Homologação (DIV-9) |

### 3.2 Conclusão do confronto

**O fluxo atual não é uma versão degradada do fluxo canônico — é um fluxo diferente.**

O fluxo atual é um **wizard linear de 9 passos que produz uma proposta comercial**. O fluxo canônico é um **ciclo de vida de projeto com bifurcação e fases de execução**. Eles coincidem apenas entre Coleta e Orçamento.

Das 9 etapas canônicas, **3 não existem** (Cotação, Bifurcação, Comissionamento) e **2 existem sem modelo** (Engenharia como fase, Instalação como obra). Substituir a UX exige, antes, existir o que a UX exibiria.

---

## 4. Plano de migração

### 4.1 Princípio ordenador

A ordem abaixo é imposta pelas dependências reais, não por preferência:

1. **Nada de UX nova sem o agregado correspondente** — telas sobre agregados inexistentes produzem estado órfão, exatamente o que gerou `arranjoMPPTs` (M-8) e `topologia2` (M-9).
2. **Remoção de morto antes de qualquer coisa nova** — reduz a superfície de migração em ~2.400 linhas sem risco.
3. **Unificação das máquinas de estado antes da bifurcação** — a bifurcação (DIV-7) é uma transição de estado; com 7 máquinas concorrentes ela é indefinível.
4. **Remoção do legado é etapa própria e obrigatória** — sem ela a coexistência vira permanente.

### 4.2 Sequência

---

#### **F1 — Limpeza de código morto** *(sem dependências; pode iniciar imediatamente)*

**Arquivos afetados**
- Remover: `pages/NovaPropostaV2.jsx`, `components/fv/funilv2/` (4), `components/fv/etapas/E2UnidadesConsumidoras.jsx`, `components/fv/etapas/E3PreDimensionamento.jsx`, `components/fv/ValidadorEquipamentoFV.jsx`, `components/fv/ModalCadastroPainel.jsx`
- Editar: `pages/NovaProposta.jsx` (remover import morto)
- Editar: `contexts/ProjetoFVContext.jsx` + `ConfiguradorArranjoFV.jsx` (remover `arranjoMPPTs`, `topologia2`)

**Riscos:** mínimos. Único ponto de atenção: `ValidadorEquipamentoFV` e `ModalCadastroPainel` podem estar previstos para uso futuro — confirmar com o autor antes de remover.

**Critérios de aceitação**
- Build do frontend passa; suíte `vitest` verde.
- `grep` do nome de cada item removido retorna zero ocorrências.
- Nenhuma rota alterada.

---

#### **F2 — Desacoplamento frontend ↔ backend** *(A-1; independente de F1)*

**Arquivos afetados:** os 12 arquivos de produção listados em A-1.

**Ação:** extrair a lógica compartilhada para um pacote comum (`shared/`) ou expô-la por API. Nenhuma regra de cálculo muda.

**Riscos:** alto volume de import a reescrever; risco de divergência se o código for **copiado** em vez de compartilhado. Mitigação: pacote único, nunca cópia.

**Critérios de aceitação**
- `grep -r "backend/src" frontend/src --include=*.jsx --include=*.js` retorna zero fora de `__tests__`.
- Build do frontend não referencia arquivos de `backend/`.
- Resultados numéricos idênticos antes/depois (teste de regressão sobre casos existentes).

---

#### **F3 — Unificação das máquinas de estado** *(§2.3, DIV-6; depende de decisão de negócio)*

**Ação:** definir **uma** máquina de estado do projeto, derivada do fluxo canônico. As 6 restantes tornam-se derivadas ou são eliminadas.

**Arquivos afetados:** `models/ProjetoFV.js`, `utils/comercialStateMachine.js`, `controllers/projetosFVController.js`, `routes/projetosFV.js` (16 rotas de governança), `GovernancaPainel.jsx`, `E8Orcamento.jsx`.

**Riscos:** **o maior risco do plano.** Toca dados existentes. Requer mapeamento de cada combinação atual para o estado unificado — e há combinações inconsistentes em produção (§2.3).

**Critérios de aceitação**
- Um único campo de estado governa a transição; os demais são derivados ou removidos.
- Toda combinação existente em produção mapeia para exatamente um estado novo — sem ambiguidade e sem descarte.
- Transições inválidas rejeitadas no backend, não só no frontend.

---

#### **F4 — Backend: Cotação e Orçamento como agregado** *(DIV-4, DIV-5)*

**Ação:** `Orcamento` deixa de ser subdoc 1:1 e passa a agregado com `projeto_ref` (1:N). Introduzir a etapa de Cotação que o origina.

> **Nota de restrição:** este prompt proíbe criar novos agregados. F4 **não é executável sob a restrição atual** — requer autorização explícita e sprint própria de backend.

**Arquivos afetados:** `models/ProjetoFV.js` (remover `orcamento{}`), novo model, novo controller/service/rotas, `E8Orcamento.jsx`, `projetoFVApi.js`.

**Riscos:** migração de dados dos orçamentos existentes; `proposta{}` e `financeiro{}` referenciam o orçamento implicitamente.

**Critérios de aceitação**
- Um projeto suporta N orçamentos comparáveis.
- Orçamentos existentes migrados 1→1 sem perda, com hash de verificação.
- Nenhum cálculo financeiro alterado.

---

#### **F5 — Backend: Aprovação, Baseline e Bifurcação** *(DIV-6, DIV-7)*

**Ação:** aprovação de **um** orçamento congela a Baseline Contratual; a bifurcação Engenharia ∥ Homologação torna-se transição explícita, com pré-condição verificável.

**Riscos:** define o que fazer com projetos já `APROVADO` sob a semântica antiga.

**Critérios de aceitação**
- Engenharia e Homologação inacessíveis antes da aprovação.
- Baseline imutável após congelamento (M-2 da ADR-021).
- Projetos legados aprovados recebem tratamento declarado — migrados ou marcados como legado permanente.

---

#### **F6 — Backend: Instalação (obra) e Comissionamento** *(DIV-10, DIV-11)*

**Ação:** modelar as duas fases finais. Resolver a colisão de nomenclatura: o agregado de topologia chama-se `Instalacao`; a fase de obra precisa de outro nome (ex.: `Execucao`).

**Riscos:** colisão de nomenclatura induz erro em toda a base. Decidir o nome **antes** de escrever qualquer código.

**Critérios de aceitação**
- Nomenclatura decidida e documentada em ADR antes da implementação.
- `AtivoEquipamento` liga-se à fase de execução, não ao projeto genérico.

---

#### **F7 — Backfill de `Local`/`Superficie` e migração de E3/E4/E6**

**Ação:** popular `local_ref`; E3/E4/E6 passam a escrever nos agregados.

**Dependência:** exige o backfill de `empresa_id` concluído (**SSOT-GOV-003**) — hoje **0% de cobertura em produção**.

**Arquivos afetados:** `E3Localizacao.jsx`, `E4Irradiancia.jsx`, `E6Area.jsx`, `projetoFVApi.js`, adapters `dominio/local/`.

**Critérios de aceitação**
- 100% dos projetos ativos com `local_ref` preenchido.
- `obterLocalProjeto` retorna do `Local` (novo caminho) para projetos migrados — verificável por contador.
- Projetos congelados/homologados/com ART **não migrados** (política S1).

---

#### **F8 — Migração da topologia: E7 → `Instalacao`** *(ADR-019)*

**Ação:** integrar `montarInstalacao.js` (S4C-1, pronto, 35 testes passando, **não commitado**); `ConfiguradorArranjoFV` captura `superficie_id`; E7 grava `Instalacao` e preenche `instalacao_ref` (S4C-0, pronto).

**Pré-requisito não resolvido:** política de distribuição módulo→String/MPPT (**S4C-D**, nunca autorizada). Sem ela o tradutor não tem regra de partição.

**Arquivos afetados:** `E7Equipamentos.jsx`, `ConfiguradorArranjoFV.jsx`, `GerenciadorArranjos.jsx`, `TopologiaMPPTEditor.jsx`, `projetoFVApi.js`, `dominio/topologia/`.

**Riscos:** `ConfiguradorArranjoFV` tem 1.108 linhas e concentra três responsabilidades — decompor antes de migrar.

**Critérios de aceitação**
- Todo projeto novo nasce com `instalacao_ref`.
- INV-03 validado (nº de MPPTs = `n_mppts` do Catálogo).
- Unifilar gerado a partir da `Instalacao` é idêntico ao gerado a partir de `arranjos[]` para os mesmos dados.

---

#### **F9 — Novo estado e navegação do wizard**

**Ação:** `ProjetoFVContext` substituído por estado orientado a agregados; navegação derivada de `ETAPAS` (remove A-2); `localStorage` versionado (mitiga A-3).

**Critérios de aceitação**
- Nenhum passo hardcoded fora de `etapasFunilFV.js`.
- Sessão em `localStorage` de versão anterior é detectada e descartada **com aviso ao usuário**, nunca silenciosamente.

---

#### **F10 — Decomposição de E8 e da UX de Engenharia/Homologação**

**Ação:** E8 (1.052 linhas) decomposto em Cotação → Orçamentos(N) → Aprovação → Baseline. Homologação unificada (elimina D-1). Engenharia vira fase com entrada/saída.

**Critérios de aceitação**
- Nenhum componente FV acima de 400 linhas.
- Uma única implementação de homologação.
- A página `/homologacao` sem projeto vinculado é eliminada ou justificada como ferramenta avulsa distinta.

---

#### **F11 — Remoção definitiva do legado** *(obrigatória)*

**Momento:** somente após F10 concluída **e** verificação de que nenhum caminho de leitura ativo depende do legado.

**Remover:**
- `arranjos[]`, `strings[]`, `equipamentos.paineis/inversor` de `ProjetoFV`
- `arranjosService`, `agregarArranjosFV`
- campos flat v2 (`endereco_completo`, `latitude`, `longitude`, `telhado`, `potencia_kwp`, …)
- adapters de compatibilidade: `obterLocalProjeto`, `obterTopologiaProjeto`, `obterTopologiaState`
- rota `/propostas/nova` e `pages/NovaProposta.jsx`
- `schema_version` (deixa de fazer sentido)

**Exceções permanentes** (não removíveis, por decisão já registrada):
- Projetos congelados, homologados ou com ART emitida — permanecem no modelo legado
- `AtivoEquipamento.arranjo_id` — referência persistida em ativos de campo
- `governanca.snapshot_*` — snapshots congelados com shape histórico

**Critérios de aceitação**
- Zero leituras de `arranjos[]` fora do caminho de projetos congelados.
- Adapters removidos; nenhum fallback ao legado no código ativo.
- Contador em produção: 0 projetos ativos sem `instalacao_ref` e sem `local_ref`.

---

### 4.3 Grafo de dependências

```
F1 (limpeza)          ──────────────────────────────────┐
F2 (desacoplamento)   ──────────────────────────────────┤
                                                        │
[SSOT-GOV-003: backfill empresa_id] ──► F7 ─────────────┤
                                          │             │
F3 (estados) ──► F4 (cotação/orçamento) ──► F5 (aprovação/bifurcação)
                                              │
                                              ├──► F6 (obra/comissionamento)
                                              │
                        [S4C-D: política] ──► F8 (topologia)
                                              │
                                              └──► F9 ──► F10 ──► F11
```

**Caminho crítico:** `SSOT-GOV-003 → F3 → F4 → F5 → F9 → F10 → F11`.

### 4.4 Riscos transversais

| # | Risco | Mitigação |
|---|---|---|
| R1 | **Deploy bloqueado**: 0% de cobertura de `empresa_id` em produção; fail-closed ativo | F7 e tudo que depende dela param até SSOT-GOV-003 concluir |
| R2 | F3 toca dados existentes com combinações de estado inconsistentes | Auditoria prévia de todas as combinações reais antes de escrever migração |
| R3 | F4/F5/F6 criam agregados — **proibido por este prompt** | Requer autorização explícita; tratar como sprints de backend próprias |
| R4 | Coexistência antigo/novo entre F7 e F11 | Prazo declarado para F11 no momento em que F7 iniciar; sem F11, a coexistência vira permanente |
| R5 | `ConfiguradorArranjoFV` e `E8Orcamento` monolíticos | Decompor antes de migrar, nunca durante |
| R6 | S4C-1 pronto e não commitado há semanas | Commitar em F8 ou descartar explicitamente — não deixar em limbo |

---

## 5. Situação em relação ao critério de conclusão

O critério pedido é: *"plano completo para substituir integralmente o fluxo FV antigo pelo fluxo aprovado, permitindo iniciar a implementação sem coexistência permanente."*

**O plano está completo.** A implementação pode iniciar **por F1 e F2** imediatamente — ambas são independentes, de risco baixo, e removem ~2.400 linhas mortas mais o acoplamento crítico A-1.

**F3 em diante depende de decisões que não são técnicas:**

| Bloqueio | Natureza | Responsável |
|---|---|---|
| Backfill de `empresa_id` (0% em produção) | operacional | LME + Negócio (SSOT-GOV-001/003) |
| Máquina de estado única | negócio | Negócio |
| Criar `Cotacao`, `Orcamento` (AR), `Baseline`, `Execucao`, `Comissionamento` | arquitetural | **proibido por este prompt** — requer autorização |
| Política de distribuição módulo→String/MPPT (S4C-D) | engenharia | Engenharia |
| Nome da fase de obra (colisão com o agregado `Instalacao`) | arquitetural | ADR |

**Nenhuma alteração foi realizada.** A implementação aguarda aprovação do plano.
