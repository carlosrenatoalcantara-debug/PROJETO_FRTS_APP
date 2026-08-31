# Conexão — decisões travantes D1 e D2 — FV-DOM-046

**Decisão. Nenhum código alterado.** As duas decisões **fecham** com evidência do
próprio sistema — não houve necessidade de parar.

---

## 1 · D1 — Quem pode registrar conexão

### Recomendação: **alternativa A** — quem já pode `editar` em `fv`

Sem controle novo, sem primeira ativação de mecanismo adormecido.

### A evidência que decide

Procurei o precedente: **como o sistema protege hoje o ato mais consequente que
tem?**

```
POST /:id/orcamentos/:orcamentoId/aprovar        (routes/projetosFV.js:146)
app.use('/api/projetos-fv', protegerModulo('fv'), …)   (server.js:235)
                                    ↓
                          POST → ação 'editar'
```

Aprovar orçamento **congela a Baseline, origina o contrato e é irreversível**
(INV-ORC-3: um único aprovado por projeto; M-2: Baseline imutável). E é protegido
apenas por `editar`. `OrcamentoService` não checa perfil em lugar nenhum.

**Consequência de fato, hoje:** o perfil `comercial` já aprova orçamento e
congela Baseline.

Diante disso, exigir `aprovar` para registrar conexão seria **incoerente**:
aplicaria o controle mais estrito ao ato **menos** consequente. Conexão, pela
FV-DOM-045/D5, não altera Gate, não altera Baseline, não altera `projeto.status`
— é fato reversível por correção. Congelar a Baseline não é.

### Por que não a alternativa B

O enunciado pede, se B for recomendada, demonstrar qual permissão existente seria
reutilizada. Ela existe — e está **inteiramente adormecida**:

| Peça | Estado |
|---|---|
| `MATRIZ_RBAC` com nível `aprovar` (`diretor`) e `administrar` (`administrador`) | existe |
| `verificarPermissao(modulo, acao)` | existe — **nunca usado** |
| `verificarPerfil(...perfis)` | existe — **nunca usado** |
| Pontos de aplicação de `aprovar` em qualquer rota | **zero** |

Usar `verificarPermissao('fv', 'aprovar')` não seria criar RBAC — a matriz, os
níveis e o helper já existem. Mas seria o **primeiro ponto de aplicação** desse
nível em toda a aplicação, num campo factual e periférico, enquanto aprovação de
orçamento e congelamento de Baseline seguem em `editar`.

Começar por conexão inverteria a ordem do risco.

### Por que não a alternativa C

Não há outro mecanismo. `verificarPerfil` nunca foi usado, e não existe no FV
nenhuma amarração papel-por-operação.

### O que isto deixa exposto — e não é sobre conexão

Fica registrado, **separado desta decisão**: se o negócio quer restringir atos
consequentes por perfil, o alvo certo não é conexão — é **aprovação de orçamento**,
onde `comercial` congela contrato hoje. §4.1.

---

## 2 · D2 — Conexão encerra execução?

### Recomendação: **alternativa A** — apenas registrar o fato

Não encerra execução, não altera `projeto.status`, não libera etapa.

### Evidência 1 — não existe transição automática de `projeto.status`

Escritores em produção, todos manuais e explícitos:

| Onde | Escreve | Como |
|---|---|---|
| `projetosFVController.js:435` | `arquivado` | ação de arquivar |
| `projetosFVController.js:460` | `rascunho` | ação de restaurar |
| `projetosFVController.js:495` | qualquer valor válido | `PUT /:id/status`, com `paraModel`, 422 para inválido e auditoria `STATUS_ALTERADO` |

**Nenhum fluxo do sistema move um projeto para `em_execucao` ou `concluido` como
consequência de coisa alguma.** O ciclo de vida é dirigido por decisão humana
explícita, nunca inferido de outro fato — nem aceite de proposta, nem Baseline
congelada, nem homologação deferida movem `projeto.status`.

Fazer a conexão mover seria **criar a primeira transição automática** dessa
máquina, contrariando a semântica que o sistema adotou em todos os outros casos.

### Evidência 2 — nada liga conexão a encerramento

Busca por qualquer associação entre `conectado` e `concluido` no backend e no
frontend: **zero ocorrências**. Nenhum fluxo, comentário ou regra sugere que
conexão encerre projeto.

### Evidência 3 — não há etapa para liberar (alternativa C é inviável)

| Etapa | Estado |
|---|---|
| Projeto Executivo | stub — declara "não implementado" |
| Execução | stub — declara "não implementado" |
| As-Built | stub — declara "não implementado" |

Confirmado na FV-UX-040 e reconfirmado agora: **não têm agregado**. A alternativa
C — *"liberar uma etapa específica sem encerrar o projeto"* — não é
implementável, porque não existe etapa com conteúdo a ser liberada. Liberar um
stub é operação sem efeito.

### Evidência 4 — o significado atual de cada estado

| Estado | Quem o lê | O que significa hoje |
|---|---|---|
| `em_execucao` | `dashboard.js:11` — conta como **projeto ativo** | obra em andamento; começa antes da conexão e não diz nada sobre a rede |
| `concluido` | `dashboard.js` — **não** conta como ativo; `backfillLocalSuperficie:67` trata como legado intocável | encerramento do **projeto** — entrega, documentação, garantias |

`concluido` é indicador de carteira, não de energização. Ligá-lo à conexão
mudaria o que o dashboard conta, sem que ninguém tenha pedido isso.

### Evidência 5 — os gates entre execução, homologação e encerramento

Só existe **um** gate: o da bifurcação (`dominio/gate`), que decide Engenharia e
Homologação a partir de **Baseline íntegra + opção aceita** — ambos anteriores à
conexão. Não há gate entre execução e encerramento, nem entre homologação e
encerramento.

Não há, portanto, nenhum portão que a conexão pudesse abrir.

### Conclusão

Conexão é fato factual e terminal em si mesmo. O projeto continua sendo encerrado
como sempre foi: por decisão humana em `PUT /:id/status`.

---

## 3 · Contrato final de `ProjetoFV.conexao`

**Proposta consolidada. Não implementada.**

```
conexao: {
  conectada_em:   Date|null      // o FATO e sua data. null = não conectada
  registrada_por: String|null    // quem declarou (evidência mínima — D3/FV-DOM-045)
  numero_medidor: String|null    // opcional; ausente = lacuna declarada
  observacoes:    String|null
}
```

Exatamente os quatro campos do enunciado. **Retirei os dois que eu havia proposto
na FV-DOM-045**, por não passarem no teste de necessidade comprovada:

| Campo retirado | Por quê |
|---|---|
| `sem_homologacao` | é **derivável**: `conectada_em != null` × `status_homologacao !== 'homologado'`. INV-58 proíbe persistir valor derivado. A divergência de D1 é calculada na leitura, não gravada |
| `registrada_em` | redundante com a auditoria. O endpoint futuro deve auditar, como as rotas assistidas já fazem (7 pontos de `_auditar` em `routes/homologacao.js`) — e aí quando e por quem ficam no `AuditLog` |

**Requisito que substitui `registrada_em`:** o endpoint que gravar `conexao`
**tem de auditar**. Sem isso repetiríamos o defeito da máquina A, que grava sem
auditar e por isso perdeu para sempre a data e o autor de todo `conectado`
existente (FV-DOM-045 §1.7).

`conectada_em` continua sendo a máquina inteira: `null` = não conectada, data =
conectada. Sem enum, sem transição, sem agregado.

---

## 4 · Pendências

### 4.1 Fora do escopo de conexão — mas encontrada aqui

**Aprovação de orçamento está protegida por `editar`.** O perfil `comercial`
congela Baseline e origina contrato hoje. Se o negócio quiser controle por
perfil, este é o alvo — não conexão. Decisão comercial, sprint própria.

### 4.2 Herdadas, ainda sem suporte no sistema

| # | Pendência | Origem |
|---|---|---|
| a | Quais exceções operacionais permitem conexão sem `homologado` (conexão provisória) | FV-DOM-043/D4 · FV-DOM-045 §3.1 — zero evidência no sistema |
| b | O que fazer com os projetos que já têm `homologacao.status = 'conectado'` | FV-DOM-045 §3.4 — depende da contagem, que exige acesso a produção |

**Nenhuma das duas trava a implementação de `ProjetoFV.conexao`**: (a) é tratada
pela divergência declarada em leitura, e (b) é migração assistida, posterior.

---

## 5 · Resumo

| | Decisão | Alternativa | Evidência decisiva |
|---|---|---|---|
| **D1** | quem registra | **A** — `editar` em `fv` | aprovar orçamento (congela Baseline, irreversível) também é só `editar`; `verificarPermissao` e `verificarPerfil` **nunca foram usados** |
| **D2** | encerra execução? | **A** — apenas o fato | `projeto.status` **não tem nenhuma transição automática**; nada liga conexão a `concluido`; as etapas seguintes são stubs sem agregado |

**As duas decisões fecharam.** O que resta são duas pendências herdadas, nenhuma
travante, e um achado sobre autorização de orçamento que não pertence a esta
sprint.

Nenhum código alterado: sem `ProjetoFV.conexao`, sem endpoint, sem schema, sem
RBAC, sem migração, sem UX, sem Gate, sem Baseline.
