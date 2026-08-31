# Mapa real do sistema FV — baseline técnico — FV-AUD-048

**Fotografia do comportamento efetivamente implementado.** Nada foi implementado,
corrigido ou inferido. Medido contra o código em execução, em ambiente isolado,
imediatamente após a FV-DOM-047.

Vocabulário: **OK** = existe e foi exercido · **STUB** = tela/rota sem domínio ·
**NÃO IMPLEMENTADO** = sem evidência no código · **DIVERGÊNCIA** = dois pontos
tratam o mesmo conceito de formas diferentes · **CONTRADIÇÃO** = dois estados
coexistem afirmando coisas incompatíveis.

---

## 1 · O fluxo, nó a nó

| Nó | Tela `/fv` | Endpoint | Controller/Service | Domínio | Persistência | Estado |
|---|---|---|---|---|---|---|
| **Cliente** | — (módulo próprio) | `POST /api/clientes` | `clientesController` | — | `Cliente` | OK |
| **Projeto** | `projeto` | `POST /api/projetos-fv` | `projetosFVController` | `tenancy` | `ProjetoFV` | OK |
| **Equipamentos** | `equipamentos` | `PUT /:id/etapa` (`equipamentos`) | `salvarEtapaProjetoFV` | — | `equipamentos.paineis[]`, `equipamentos.inversor` | OK |
| **Estrutura** | `estrutura` | `PUT /:id/etapa` (`equipamentos`) | idem | `estrutura` (SSOT em `fv-shared`) | `equipamentos.estrutura` | OK |
| **Dimensionamento** | `dimensionamento` | `PUT /:id/etapa` (`dimensionamento`) | idem | — | `dimensionamento` | OK |
| **Composição** | `equipamentos` | `PUT /:id/etapa` (`arranjos`) | idem | `arranjosService.composicaoDoProjeto` | `arranjos[]` | OK |
| **Topologia string** | `mppt` | `PUT /:id/etapa` (`engenharia_eletrica`) | idem | `unifilar/adaptarProjeto` | `engenharia_eletrica.arranjo.mppts[]` | OK |
| **Topologia micro** | `mppt` | `PUT /:id/etapa` (`arranjos`) | idem | `fv-shared/microinversores` | `arranjos[].configuracao_eletrica.micros[]` | OK |
| **Engenharia · unifilar** | `unifilar` | `POST /:id/unifilar/gerar` | `gerarUnifilarProjeto` | `dominio/unifilar` | não persistido (derivado) | OK |
| **Orçamento** | `cotacao`, `orcamentos`, `aprovacao` | `POST /:id/cotacoes`, `/orcamentos`, `/emitir`, `/aprovar` | `agregadosFvController` / `OrcamentoService` | `dominio/orcamento` | `Cotacao`, `Orcamento` | OK |
| **Baseline** | `baseline` | `GET /:id/baseline` | idem | `dominio/baseline` | `Baseline` (imutável) | OK |
| **Gate** | `gate` | `GET /:id/gate`, `/fases` | idem | `dominio/gate` | **não persistido** | OK |
| **Proposta / Opções** | `proposta` | `POST /:id/opcoes`, `GET /:id/opcoes` | `projetosFVController` | `dominio/proposta` | `proposta_grupo_id`, `opcao_numero` | OK |
| **PDF da proposta** | `proposta` | `POST /:id/proposta/gerar` | `propostaController` | `propostaComercialService` | não persistido | OK |
| **Envio** | `proposta` | `POST /:id/proposta/enviar` | `projetosFVController` | `EnvioPropostaService` | `governanca.comercial.compartilhamentos[]` | OK |
| **Aceite** | `proposta` + página pública | `POST /:id/proposta/aceitar` · `POST /api/publico/proposta-fv/:token/aceitar` | idem | `dominio/proposta` | `proposta_aceite` | OK |
| **Homologação** | `homologacao` | `/homologacao/*` (14 rotas) | `homologacaoController` + `routes/homologacao.js` | `homologacaoAssistida`, `concessionariaProvider` | `homologacao.*` | OK |
| **Parecer** | `homologacao` | `POST/GET /:id/parecer`, `/parecer/confirmar` | `projetosFVController` | `dominio/parecer` | `parecer_extracao` | OK |
| **Conexão** | **nenhuma** | `GET/PUT/DELETE /:id/conexao` | `projetosFVController` | `dominio/conexao` | `conexao` | OK (API) · **sem UX** |
| **Projeto Executivo** | `executivo` | — | — | — | — | **STUB** |
| **Execução** | `execucao` | — | — | — | — | **STUB** |
| **As-Built** | `asbuilt` | — | — | — | — | **STUB** |

### 1.1 Fluxo exercido de ponta a ponta

Todos os nós acima marcados OK foram executados em sequência contra a API real,
num único projeto, nesta auditoria — não são leitura de código.

---

## 2 · Depois do ACEITE — como o código realmente executa

```
                              ACEITE
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
        HOMOLOGAÇÃO                            ENGENHARIA
     liberada=true                          liberada=true
     paralela=true                          paralela=true
              │                                     │
   ├ documentação (checklist por concessionária)    ├ unifilar        OK
   ├ memorial · carta · ART            OK           ├ Projeto Executivo  STUB
   ├ protocolo                         OK           ├ Execução           STUB
   ├ estado assistido (7 posições)     OK           └ As-Built           STUB
   ├ parecer de acesso                 OK
   ├ orçamento/taxa de conexão    NÃO IMPLEMENTADO
   └ conexão (fato)                    OK (sem UX)
```

**Não são sequência.** Medido: a homologação avançou para `em_preparacao` (200)
sem a engenharia concluir nada, e o unifilar gerou (200) com a homologação em
preparação. Nenhum dos dois exige o outro, e o Gate declara ambos `paralela=true`.

**Só a opção aceita avança:** a irmã não escolhida recebe `409
OPCAO_NAO_ESCOLHIDA` em memorial, carta, ART, status, checklist, protocolo,
status assistido e conexão. Consulta permanece liberada.

---

## 3 · Máquinas de estado — sete, mantidas separadas

| Máquina | Campo | Enum / forma | Escritores | Leitores | Transições | Histórico |
|---|---|---|---|---|---|---|
| **Projeto** | `status` | `rascunho · em_simulacao · em_analise · dimensionado · proposta · aprovado · em_execucao · concluido · perdido · cancelado · arquivado` | 3, **todos manuais**: arquivar, restaurar, `PUT /:id/status` | `dashboard.js`, filtros de listagem, `backfillLocalSuperficie` | **livres** (valida só o valor, 422 fora do enum) | `AuditLog` (`STATUS_ALTERADO`) |
| **Proposta** | `proposta_aceite.aceita` | `Boolean` + evidência (`origem`, `token_envio`, `ip`, `share_id`, `snapshot_hash`) | `aceitarOpcaoDaProposta`, `aceitarPropostaFVPublica` | `dominio/gate`, `listarOpcoesFV`, UX | idempotente; **índice único parcial** por `proposta_grupo_id` | `AuditLog` |
| **Homologação A** (legada) | `homologacao.status` | `rascunho · enviado · analise · aprovado · conectado` | **1**: `PATCH /homologacao/status` | UX **nova** (`EtapaHomologacao`) | **livres** — pula e regride | **nenhum**, e **não audita** |
| **Homologação B** (assistida) | `homologacao.status_homologacao` | `nao_iniciado · em_preparacao · pendente_documentacao · pendente_engenharia · pendente_concessionaria · homologado · reprovado` | **1**: `PATCH /homologacao/assistida/status` | UX **legada** (`CentralDados`, `CrmProjetos`), `homologacaoAssistida` | **livres** — pula e regride | `historico_status[{em,de,para,por,motivo}]` + 7 pontos de auditoria |
| **Parecer** | `parecer_extracao.estado` | `extraido · confirmado` | `registrarParecerFV`, `confirmarParecerFV` | UX (`ParecerDeAcesso`) | `extraido → confirmado`, **não reversível**, confirmação idempotente | `AuditLog` |
| **Conexão** | `conexao.conectada_em` | `Date \| null` — **sem enum: a data é a máquina** | `PUT/DELETE /:id/conexao` | `GET /:id/conexao` | não há: é fato, não processo | `AuditLog` (`CONEXAO_REGISTRADA/CORRIGIDA/REMOVIDA`, com transição de datas) |
| **Gate** | — | derivado de Baseline + opção aceita | **nenhum** (INV-58) | `GET /:id/gate`, `/fases`, guards de homologação e conexão | — | — |
| **Baseline** | agregado `Baseline` | congelada na aprovação do orçamento | `OrcamentoService.aprovar` | Gate, `BaselineService` | **imutável** (M-2); índice único por projeto | hash + `congelado_em` |

Máquinas do wizard legado (`governanca.freeze_status`, workflow comercial,
assinatura, CRM) existem e estão fora deste escopo — não foram fundidas às acima.

---

## 4 · CONTRADIÇÕES

### 4.1 Homologação A × B — reproduzida nesta auditoria

```
PATCH /homologacao/status           { status: 'conectado' }  → 200
PATCH /homologacao/assistida/status { status: 'reprovado' }  → 200

homologacao.status             = conectado
homologacao.status_homologacao = reprovado
projeto.status                 = rascunho
```

Três afirmações incompatíveis no mesmo documento: usina **conectada**,
homologação **reprovada**, projeto ainda em **rascunho**. Nenhuma regra concilia
as três; as 5 × 7 = 35 combinações de A × B são aceitas.

Decidida em FV-DOM-041/043 (B é canônica, A vira projeção) — **decisão não
implementada**.

### 4.2 Contraste: a conexão nova não contradiz — declara

O mesmo cenário, pelo domínio criado na FV-DOM-047:

> *"Usina registrada como conectada, mas a homologação foi REPROVADA."*

A divergência é **derivada na leitura**, nunca persistida. É a diferença entre um
sistema que se contradiz em silêncio e um que informa.

---

## 5 · DIVERGÊNCIAS

| # | Divergência | Evidência |
|---|---|---|
| D-1 | **UX e máquinas invertidas** | a UX nova (`/fv`) dirige a máquina **legada** A; a UX legada dirige a **assistida** B |
| D-2 | **Dois motores de unifilar** | `dominio/unifilar` (canônico, string + micro) × `utils/simbolosUnifilar`, usado por `unifilarController` e pelo `pareceracessoController` desativado |
| D-3 | **Leitor comparando contra o enum errado** | `backfillLocalSuperficie.js:66` testa `homologacao.status === 'homologado'` — valor que pertence a **B**, não a A. A condição nunca é verdadeira |
| D-4 | **`homologacao.status` não audita** | 0 chamadas de auditoria no controller de A, contra 7 nas rotas de B. Por isso a data e o autor de todo `conectado` existente se perderam |
| D-5 | **Duas formas de composição** | `equipamentos.inversor` (objeto único, **sem quantidade**) × `arranjos[].inversores[]` (lista com quantidade). Mitigada pelo adaptador `composicaoDoProjeto`, mas as duas formas continuam no schema |

---

## 6 · NÃO IMPLEMENTADO

| Item | Situação medida |
|---|---|
| **Orçamento / taxa de conexão** | zero: nada no schema, nas rotas ou no provider |
| **Parecer como etapa do processo** | o parecer modela o **documento**; deferido/indeferido como estado do processo não existe |
| **Conexão provisória** | nenhuma evidência |
| **Prazo / SLA da concessionária** | `concessionariaProvider` declara documentos, normas, limites e formulários — **não declara prazo**. Nada mede atraso |
| **UX da conexão** | a API existe (FV-DOM-047); nenhuma tela a alcança |
| **PDF na página pública** | o cliente recebe a página com as opções, não o documento |
| **Homologação consome o parecer** | **ninguém lê `parecer_extracao`** — o parecer confirmado não influencia checklist, validação nem estado |
| **`GET /proposta/download`** | **STUB**: responde 404 sempre; `salvarPropostaEmArquivo` é exportado e nunca chamado |
| **Projeto Executivo · Execução · As-Built** | **STUB**: telas roteadas que declaram "não implementado"; sem agregado, sem endpoint |

---

## 7 · SSOT real de cada dado canônico

| Dado | SSOT | Observação |
|---|---|---|
| **Módulos** | `arranjos[].paineis[]` | lido via `composicaoDoProjeto`; `equipamentos.paineis[]` é a forma legada, resolvida pelo mesmo adaptador |
| **Inversores** | `arranjos[].inversores[]` | **única fonte de quantidade** — `equipamentos.inversor` não a persiste (D-5) |
| **Quantidades** | `arranjos[]`, e `configuracao_eletrica.micros[]` na topologia micro | |
| **Topologia** | `classificarTopologiaInversor` (`fv-shared/inversores/dicionario`) | classificador único (FV-DOM-031/4); `micros[]` é o fato da configuração |
| **Estrutura** | `@fortesolar/fv-shared/estrutura` | SSOT desde FV-DOM-039; backend e frontend **reexportam**, nenhum redefine |
| **Orçamento** | agregado `Orcamento` | totais **derivados** a cada leitura (`totaisDeItens`), nunca persistidos |
| **Baseline** | agregado `Baseline` | imutável, hash, um por projeto |
| **Gate** | `dominio/gate` | derivado; lê Baseline + opção aceita |
| **Proposta** | `proposta_grupo_id` nas irmãs | o grupo não tem documento próprio |
| **Aceite** | `proposta_aceite` | com evidência de origem, token, IP e snapshot |
| **Envio** | `governanca.comercial.compartilhamentos[]` com `origem: 'canonico'` | snapshot congelado; mesmo array do wizard legado, distinguido por origem + grupo |
| **Homologação** | **ambíguo — ver §4.1** | B é a canônica **por decisão**, A ainda é escrita |
| **Parecer** | `parecer_extracao` | envelope próprio, irmão de `fatura_extracao` |
| **Conexão** | `conexao.conectada_em` | fato datado |

---

## 8 · Documentos

| Documento | Estado | Onde |
|---|---|---|
| Proposta (PDF) | **CRIADO** por opção, sob demanda | `POST /:id/proposta/gerar` — 27,9 KB, identifica a opção |
| Download da proposta | **STUB** | `GET /:id/proposta/download` → 404 sempre |
| Snapshot do envio | **CONGELADO** e **ENVIADO** | `compartilhamentos[].snapshot` + hash; alterar o projeto depois não muda o que o cliente vê |
| Aceite | **ACEITO** | `proposta_aceite` com evidência |
| Memorial | **CRIADO** sob demanda | `POST /homologacao/memorial` |
| Carta | **CRIADO** sob demanda | `POST /homologacao/carta` |
| ART | **CRIADO** sob demanda | `POST /homologacao/art` |
| Unifilar | **CRIADO** sob demanda | `POST /:id/unifilar/gerar`; string e micro têm motores próprios |
| Pacote de homologação | **CRIADO** sob demanda | `GET /assistida/pacote` |
| Checklist de homologação | **CRIADO** e **LIDO** (persistido) | `homologacao.checklist`; concessionária vem do projeto |
| Parecer de acesso | **LIDO** (registro manual) e **CONFIRMADO** | `parecer_extracao`; extração automática **não existe** |
| Conexão | **CRIADO** (API) | `conexao`; **sem documento associado** |

Nenhum documento é armazenado como arquivo: todos são gerados sob demanda ou
referenciados por link externo (`documentacao_externa`).

---

## 9 · Resumo numérico

| | |
|---|---|
| Nós do fluxo **OK** | 19 |
| **STUB** | 4 (Executivo, Execução, As-Built, download da proposta) |
| **NÃO IMPLEMENTADO** | 7 |
| **CONTRADIÇÕES** | 1 (com três estados envolvidos) |
| **DIVERGÊNCIAS** | 5 |
| Máquinas de estado no escopo | 7, mantidas separadas |
| Domínios puros | 13 (`baseline`, `conexao`, `congelamento`, `estrutura`, `financeiro`, `gate`, `local`, `orcamento`, `parecer`, `proposta`, `tenancy`, `topologia`, `unifilar`) |

**A espinha comercial está fechada** — cliente → projeto → equipamentos →
engenharia → orçamento → proposta com opções → envio → aceite → bifurcação.
**O que falta é depois do aceite**, e a única contradição viva é a das duas
máquinas de homologação, cuja resolução já está decidida e não implementada.
