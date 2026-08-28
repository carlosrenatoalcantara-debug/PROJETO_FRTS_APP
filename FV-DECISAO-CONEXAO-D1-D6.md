# Domínio de conexão — fechamento D1 a D6 — FV-DOM-045

**Auditoria e decisão. Nenhum código alterado:** sem schema, sem estado, sem
migração, sem Gate, sem Baseline, sem homologação, sem UX. Nenhum dado tocado.

---

## 1 · Auditoria — os sete pontos

### 1.1 Papéis e permissões existentes

RBAC por **módulo × ação**, não por papel-por-operação
(`services/rbac.js`, `middleware/rbacMiddleware.js`):

```
MODULOS: fv · ev · financeiro · crm · governanca · catalogo · configuracoes
ACOES:   visualizar · editar · aprovar · administrar
```

Nível de cada perfil no módulo `fv`:

| Perfil | `fv` | Pode escrever hoje? |
|---|---|---|
| `administrador` | `administrar` | sim |
| `diretor` | `aprovar` | sim |
| `engenheiro` | `editar` | sim |
| `tecnico` | `editar` | sim |
| `comercial` | `editar` | **sim** |
| `financeiro` | `visualizar` | não |
| `visualizador` | `visualizar` | não |

`protegerModulo('fv')` mapeia `PATCH → editar`. Logo, **hoje qualquer perfil que
edite FV pode escrever qualquer estado de FV**, inclusive `conectado` — o
comercial inclusive.

Existe um nível acima já implementado — **`aprovar`**, detido por `diretor` e
`administrador` — e um helper pronto: `verificarPermissao('fv', 'aprovar')`.
Existe também `verificarPerfil(...perfis)`, que **nunca foi usado** em lugar
nenhum do código.

### 1.2 Documentos da concessionária já modelados

| Campo | O que guarda |
|---|---|
| `homologacao.documento_memorial` / `documento_carta` / `documento_art` | `String` — referências, não arquivos |
| `homologacao.checklist_documentos.carta_concessionaria` | `Boolean` — marcado/não marcado |
| `homologacao.checklist` (Mixed) | lista `[{ documento, obrigatorio, concluido, descricao }]` |
| `documentacao_externa.pasta_homologacao` | link para pasta externa (OneDrive/Drive) |

**O sistema não armazena arquivo de concessionária** — só referências, marcações
e links. Não há entidade "documento recebido da distribuidora" com data,
remetente ou conteúdo.

### 1.3 Campos de medidor

**Nenhum.** Confirmado na FV-DOM-044 e reconfirmado: `medidor` aparece 65 vezes,
todas em símbolo de desenho (`simbolosUnifilar`, `diagram-engine`), render de
unifilar e leitura de fatura (`faturaParser`). Nunca é campo persistido.

`AtivoEquipamento.tipo` aceita `modulo | inversor | microinversor | otimizador |
bess | carregador` — **medidor não está no enum**.

### 1.4 Regras que dependem de `homologado`

| Onde | O que faz |
|---|---|
| `routes/homologacao.js:163` | ao entrar em `homologado`, grava `concluida_em/por` e audita |
| `alertDetectors.js:375` | emite alerta *"apto à homologação"* enquanto `status_atual !== 'homologado'` |
| `homologacaoAssistida.js:209` | **ponte já existente**: `status_homologacao \|\| (status === 'aprovado' ? 'homologado' : 'nao_iniciado')` |
| `backfillLocalSuperficie.js:66` | compara contra `homologacao.status` — **defeito**, `'homologado'` não pertence ao enum de A (registrado na FV-DOM-043) |

O terceiro item importa: **o sistema já deriva B a partir de A** quando B está
vazio, mapeando `aprovado → homologado` — exatamente a projeção proposta na
FV-DOM-041. A direção da compatibilidade já está codificada.

Nenhuma regra usa `homologado` como **pré-condição** de qualquer outra coisa.

### 1.5 Efeitos atuais de `homologacao.status = conectado`

**Nenhum.** Reconfirmado: um escritor genérico, dois leitores que só exibem.
Nenhum cálculo, relatório, alerta, Gate, Baseline ou documento muda por causa
dele.

### 1.6 Leitores e escritores do valor legado

Mapeados na FV-DOM-044 §1 — 1 escritor (`PATCH /homologacao/status`), 2 leitores
(rótulo e exibição em `EtapaHomologacao`).

### 1.7 Preservação integral do histórico — **não é possível**

Descoberta desta auditoria:

```
homologacaoController.js  (máquina A)  →  0 chamadas de auditoria
routes/homologacao.js     (máquina B)  →  7 chamadas de auditoria
```

`atualizarStatusHomologacao` **não audita**: apenas grava e salva. A máquina
assistida audita `CHECKLIST_GERADO`, `PACOTE_GERADO`, `HOMOLOGACAO_INICIADA`,
`HOMOLOGACAO_CONCLUIDA`, `STATUS_HOMOLOGACAO_ALTERADO` e `PROTOCOLO_ATUALIZADO`.

**Consequência:** para um projeto com `status = 'conectado'`, a data e o autor da
declaração **não existem em lugar nenhum** — nem no documento (A não tem
histórico), nem no `AuditLog` (A não audita). Não é uma questão de escolher onde
buscar: o dado nunca foi gravado.

Isso decide o §6: a migração pode preservar **o fato**, nunca **quando** nem
**por quem**.

---

## 2 · Decisões

### D1 — Pré-condição

**Recomendação: `homologado` é recomendação, não pré-condição bloqueante.**

Evidência: nenhuma regra do sistema usa `homologado` como pré-condição de nada
(§1.4). O único uso condicional é um **alerta informativo**. Transformá-lo em
barreira criaria uma regra que hoje não existe.

E há razão de domínio: a FV-DOM-043/D4 registrou que **conexão provisória não
tem evidência no sistema** — mas também não tem evidência de que não ocorra.
Bloquear o registro tornaria irrepresentável um caso real e conhecido do setor
(ligação antes do deferimento definitivo), sem que ninguém tenha decidido isso.

**Forma recomendada:** registrar conexão sem `homologado` é permitido e
**declara divergência** — o mesmo padrão de conflito declarado que a FV-DOM-042
adotou para o parecer (§D4 daquela sprint): o sistema informa, não impede, e não
sobrescreve.

Exceção operacional: **§3.1 — pendente**, porque nomear as exceções válidas é
regra comercial.

### D2 — Autoridade

**Recomendação: nenhum controle novo. Usar o que existe: `editar` em `fv`.**

Evidência: o RBAC é por módulo × ação (§1.1). Não existe hoje nenhuma amarração
papel-por-operação em FV — `verificarPerfil` nunca foi usado. Criar a primeira
seria inventar um mecanismo de controle que este domínio nunca teve.

**Se o negócio quiser restringir**, o degrau já existe e não exige código novo
de arquitetura: `verificarPermissao('fv', 'aprovar')` limita a `diretor` e
`administrador`. É uma linha, não um mecanismo.

**Qual dos dois níveis vale — §3.2, pendente.** Note a consequência do estado
atual: hoje o perfil `comercial` pode declarar uma usina conectada.

### D3 — Evidência

**Recomendação: data + confirmação manual. Nada além.**

Evidência do que existe: o sistema **não armazena documento da concessionária**
(§1.2) — só referências e links. Exigir "documento da concessionária" como
evidência criaria obrigação que a persistência não sustenta.

Portanto a evidência mínima possível hoje é a que o próprio ato produz: **quem
registrou e quando**. `numero_medidor` entra como campo, não como evidência
exigida — §D4.

Isso é o mesmo princípio do parecer (FV-DOM-042): confirmação humana explícita é
o portão; o documento é rastreabilidade, não requisito.

### D4 — `numero_medidor`

**Recomendação: opcional, com lacuna declarada.**

Evidência: **não existe regra alguma sobre medidor no sistema** (§1.3) — nem
campo, nem tipo de ativo, nem validação. Não há base para obrigatoriedade.

Torná-lo obrigatório impediria registrar uma conexão real cujo número ainda não
chegou — inventando bloqueio a partir do nada. Como lacuna declarada, o sistema
diz que falta, sem impedir, exatamente como faz com estrutura, coeficiente de
temperatura e os demais campos ausentes desde a FV-DOM-029.

A terceira opção do enunciado — *"obrigatório somente quando disponível no
documento"* — **não é implementável**: o sistema não lê documento de
concessionária, então não tem como saber se o número estava lá.

### D5 — Efeito sobre o projeto

**Recomendação: apenas informação factual. Nenhum efeito colateral.**

Evidência: `conectado` hoje não produz efeito nenhum (§1.5) — e o Gate,
comprovadamente, decide por Baseline íntegra + opção aceita, sem olhar
homologação (FV-DOM-040 §6).

Ponto a ponto:

| Efeito | Recomendação | Razão |
|---|---|---|
| libera fase | **não** | o Gate tem dois insumos, ambos anteriores à conexão |
| encerra execução | **não** — §3.3 pendente | `projeto.status = concluido` é encerramento do projeto, não da ligação (FV-DOM-044 §4) |
| altera `projeto.status` | **não** | conexão não pertence àquela máquina |
| altera Gate | **não** | Gate é derivado de Baseline + aceite (INV-58) |
| altera Baseline | **não** | Baseline é imutável por definição (M-2) |

Criar qualquer um desses efeitos seria inferir regra de negócio — o contrário do
que este programa vem fazendo desde a FV-DOM-029.

### D6 — Legado

**Recomendação: `homologacao.status = conectado` fica como HISTÓRICO, sem
migração automática.**

Evidência decisiva, §1.7: **A não audita e não tem histórico.** Migrar
`conectado` para `conexao.conectada_em` exigiria uma data que não existe. As
alternativas seriam todas piores:

* inventar `conectada_em = updatedAt` — data falsa, e `updatedAt` muda a cada
  edição do projeto por qualquer motivo;
* inventar `conectada_em = data_aprovacao` — é a data da **aprovação**, não da
  conexão;
* deixar `conectada_em = null` com um flag "conectado sem data" — cria um segundo
  jeito de dizer conectado, exatamente a duplicação que este ciclo de sprints
  está eliminando.

Então: **o valor permanece onde está, como registro histórico**, e a projeção
proposta na FV-DOM-041 §6 simplesmente **não produz `conectado`** — quem o tem,
continua tendo; quem não tem, nunca receberá por projeção.

Migração dos projetos existentes: **§6, e só depois de contá-los** (a consulta de
leitura está na FV-DOM-044 §5.2 — não posso rodá-la).

---

## 3 · O que permanece sem evidência — **PENDENTE**

| # | Decisão | Por quê |
|---|---|---|
| **3.1** | Quais exceções operacionais permitem conexão sem `homologado`? | Conexão provisória não tem evidência nem negação no sistema (FV-DOM-043/D4). Nomear exceções é regra comercial |
| **3.2** | Registrar conexão exige `editar` ou `aprovar` em `fv`? | Ambos existem. Hoje o perfil `comercial` conseguiria declarar uma usina conectada — o negócio precisa dizer se isso é aceitável |
| **3.3** | Conexão encerra a execução do projeto? | `projeto.status` tem `em_execucao` e `concluido`, mas nenhum significa "ligada à rede". Ligar os dois é decisão de processo |
| **3.4** | O que fazer com os projetos que já têm `status = 'conectado'`? | Depende da contagem, que exige acesso a produção — proibido nesta série |

---

## 4 · Contrato final proposto para `ProjetoFV.conexao`

**Proposta. Não implementada.**

```
conexao: {
  conectada_em:    Date|null      // o FATO e sua data. null = não conectada
  registrada_por:  String|null    // quem declarou (evidência mínima — D3)
  registrada_em:   Date|null      // quando foi declarado no sistema
  numero_medidor:  String|null    // opcional; ausente = lacuna declarada (D4)
  sem_homologacao: Boolean        // true quando registrada sem `homologado` (D1)
  observacoes:     String|null
}
```

Três notas sobre a forma:

1. **`conectada_em` é a máquina inteira.** `null` = não conectada, data = conectada.
   Não há enum, não há transição, não há estado intermediário — conexão não tem
   "em andamento".
2. **`conectada_em` × `registrada_em` são coisas diferentes.** A usina pode ter
   sido ligada na terça e o registro feito na sexta. Separá-los evita a confusão
   que A criou ao não ter data nenhuma.
3. **`sem_homologacao` é declaração, não bloqueio** — é a divergência de D1
   registrada no próprio dado, no mesmo espírito do conflito declarado do parecer.

**Não é agregado próprio:** não há ciclo, transições, histórico a mnter, nem
mais de uma conexão por projeto. Um agregado seria estrutura sem conteúdo.

---

## 5 · Impacto da futura implementação

| Área | Impacto |
|---|---|
| Schema | **aditivo** — campo novo, `null` em todo documento existente; nenhum projeto muda de comportamento |
| Gate | **nenhum** — não passa a ler conexão |
| Baseline | **nenhum** — imutável, e conexão é posterior ao congelamento |
| Homologação | **nenhum** — B não ganha nem perde estado; `conectado` sai de cena por não ser produzido pela projeção |
| UX | uma seção nova na fase de homologação ou de execução — **§3.3 decide onde** |
| RBAC | **nenhum** se ficar em `editar`; uma linha se for `aprovar` (§3.2) |
| Leitores existentes de `conectado` | os dois são rótulo/exibição; passam a ler `conexao.conectada_em` |
| `alertDetectors` | poderia ganhar alerta "homologado há N dias e não conectado" — **não proposto**, seria regra nova |

Risco baixo e reversível: nenhum domínio passa a depender do campo novo.

---

## 6 · Plano de migração do legado — nível conceitual

**Nada disso é executado nesta sprint.**

**Passo 0 — contar.** Rodar as consultas de leitura da FV-DOM-044 §5.2. Sem o
número, os passos seguintes não têm dimensão. Especificamente: quantos projetos
têm `status = 'conectado'`, e quantos deles já têm `status_homologacao`
preenchido.

**Passo 1 — não migrar automaticamente.** Pelo §1.7, `conectada_em` não é
derivável. Nenhum backfill deve inventar data.

**Passo 2 — coexistência silenciosa.** `conexao.conectada_em` nasce `null` em
todos. `homologacao.status = 'conectado'` permanece intocado. Os dois convivem
sem se contradizer, porque um é fato datado e o outro é registro histórico sem
data.

**Passo 3 — a UX pergunta, o sistema não adivinha.** Para os projetos marcados
como `conectado` no legado, a tela exibe: *"registrado como conectado no sistema
antigo, sem data — informe a data da conexão"*. O operador supre o que só ele
sabe. É migração assistida, um projeto por vez, sem script.

**Passo 4 — desligar A.** Só quando `PATCH /homologacao/status` já traduzir para
B (FV-DOM-041 §6) e `conectado` for recusado por não ter destino em B. O valor
histórico continua legível no documento.

**O que nunca acontece:** apagar `homologacao.status`, inventar data, ou
converter `conectado` em `homologado` — são fatos diferentes.

---

## 7 · Resumo

| | Decisão | Base |
|---|---|---|
| D1 | pré-condição: **recomendação, não bloqueio**; divergência declarada | nenhuma regra usa `homologado` como pré-condição |
| D2 | autoridade: **`editar` em `fv`**, sem controle novo | RBAC é módulo × ação; `verificarPerfil` nunca usado |
| D3 | evidência: **data + confirmação manual** | o sistema não armazena documento de concessionária |
| D4 | `numero_medidor`: **opcional**, lacuna declarada | não existe regra alguma sobre medidor |
| D5 | efeito: **apenas fato**, zero colateral | `conectado` hoje não afeta nada; Gate e Baseline têm outros insumos |
| D6 | legado: **histórico**, sem migração automática | **A não audita e não tem histórico** — a data não existe |

**4 pendências de negócio** (§3). As travantes são 3.2 (hoje o comercial pode
declarar conexão) e 3.3 (se conexão encerra a execução).
