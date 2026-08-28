# Fechamento das decisões de homologação — D1 a D6

**Definição. Nenhum código alterado:** sem schema, sem estado novo, sem
transição implementada, sem Gate, sem Baseline, sem parecer, sem UX, sem
migração.

> **Nota de numeração:** o prompt chegou como `FV-DOM-042`, número já usado pela
> sprint do Parecer de Acesso (§5M). Registrado como **FV-DOM-043** no documento
> de estado para não sobrescrever aquele registro.

Continua a FV-DOM-041, que definiu **B (`status_homologacao`)** como canônica.

---

## 1 · Mapa de leitores e escritores

### Máquina A — `homologacao.status`

| Papel | Onde | Observação |
|---|---|---|
| **escreve** | `homologacaoController.js:443` (`PATCH /homologacao/status`) | único escritor de produção |
| escreve | `importadores/homologacaoDTO.js:230` | **não é produção**: está dentro de um teste de ataque a DTO congelado. Grava `'approved'`, valor que nem pertence ao enum — de propósito, para provar que a mutação é rejeitada |
| **lê** | `frontend/src/fv/paginas/etapas/EtapaHomologacao.jsx:132` | a UX nova |
| lê | `scripts/backfillLocalSuperficie.js:66` | **defeito** — ver §1.1 |

### Máquina B — `homologacao.status_homologacao`

| Papel | Onde |
|---|---|
| **escreve** | `routes/homologacao.js:154` (`PATCH /homologacao/assistida/status`) — único escritor |
| **lê** | `frontend/src/components/fv/homologacao/CentralDados.jsx` · `components/crm/CrmProjetos.jsx` (UX legada) |
| **lê** | `utils/homologacao/homologacaoAssistida.js` (checklist, validação, pacote) |

**Nenhum domínio decide com base em A ou B** — confirmado na FV-DOM-040: Gate,
BaselineService e o domínio da proposta não as leem.

### 1.1 Defeito encontrado no mapeamento

`backfillLocalSuperficie.js:66` faz:

```js
if (p.homologacao?.status === 'homologado') return { legado: true, motivo: 'homologado' }
```

`'homologado'` **não pertence ao enum de A** (`rascunho, enviado, analise,
aprovado, conectado`) — pertence a **B**. A comparação nunca é verdadeira: o
script acredita estar pulando projetos homologados e não pula nenhum.

Defeito pré-existente, alheio a esta decisão, **não corrigido aqui** (a sprint
proíbe alterar código). Registrado para sprint própria.

---

## 2 · D1 — `reprovado`

### O que existe no sistema (medido)

| Conceito | Existe? | Evidência |
|---|---|---|
| histórico de transições | **sim** | `historico_status: [{ em, de, para, por, motivo }]`, com `push` a cada mudança |
| histórico de protocolos | **sim** | `protocolo_historico: [{ em, valor, por }]`, acumulativo |
| marcos de início/fim | **sim** | `iniciada_em/por`, `concluida_em/por` |
| **reprotocolo** | **não** | nenhuma ocorrência no código |
| **ciclo de homologação** | **não** | não há id de ciclo, nem array de ciclos |
| **novo processo** | **não** | nada que separe tentativas |

### Recomendação

**`reprovado` não é terminal definitivo: permite `reprovado → em_preparacao`,
com `motivo` obrigatório.** Correção + reprotocolo é **nova transição no mesmo
ciclo** — alternativa 1.

Razão: é a **única das três alternativas que a persistência atual sustenta**.

* "novo ciclo" exigiria um identificador de ciclo e agrupamento do histórico —
  persistência que não existe;
* "novo processo/projeto" exigiria decidir o que acontece com Baseline,
  proposta aceita e Gate do projeto original — muito além de homologação.

E a alternativa 1 **não perde informação**: o reprotocolo já é expresso pelo par
que o sistema registra hoje — um número novo empilhado em `protocolo_historico`
e a transição `reprovado → em_preparacao` gravada em `historico_status` com
autor e motivo. A sequência de tentativas é reconstruível sem criar nada.

Fica a confirmação de negócio em §7.1: se a empresa considerar reprotocolo um
**processo comercialmente distinto** (com nova cobrança, novo prazo, novo
contrato), a alternativa 1 deixa de bastar — e aí a persistência precisaria
mudar.

### Linha revista da tabela de transições

```
reprovado: ['em_preparacao'],     // com motivo obrigatório
```

Substitui o `reprovado: []` que a FV-DOM-041 deixou em aberto.

---

## 3 · D2 — tratamento do legado (A)

### Recomendação

**Projeção derivada de B, somente leitura, com descontinuação prevista.**

O mapa do §1 sustenta a escolha: A tem **um** escritor de produção e **um**
leitor real (a UX nova). O custo de desligá-la é religar uma tela — não há
integração externa nem consumidor de domínio.

Três regras:

1. **A deixa de ser escrita.** `PATCH /homologacao/status` passa a traduzir o
   vocabulário antigo para B e gravar **apenas B**. Nunca as duas.
2. **A vira projeção derivada de B** na leitura, para não quebrar quem a lê:

   | B | A projetada |
   |---|---|
   | `nao_iniciado` | `rascunho` |
   | `em_preparacao`, `pendente_documentacao`, `pendente_engenharia` | `rascunho` |
   | `pendente_concessionaria` | `enviado` |
   | `homologado` | `aprovado` |
   | `reprovado` | **sem correspondente** — §7.2 |

3. **`conectado` deixa de ser produzido por A.** Chamada legada com `conectado`
   é recusada com erro explícito: não há para onde traduzir (§4).

### O dado que já existe

Projetos que hoje têm `homologacao.status = 'conectado'` carregam uma afirmação
real que **nenhum destino canônico recebe** enquanto D3 não for decidida. A
projeção não pode inventar esse valor a partir de B, porque B não o tem.

Preservar esse dado é requisito da migração — que esta sprint não escreve. Fica
registrado: **não descartar `status = 'conectado'` antes de D3**.

---

## 4 · D3 — conexão

### O que existe (medido)

**Não existe agregado nem entidade de conexão.** A busca por `conexao`, `usina`
e afins nos models retorna apenas `AtivoEquipamento.js`, que é outra coisa:

```
AtivoEquipamento — máquina por EQUIPAMENTO, não por usina:
  planejado → instalado → operacional → manutencao → substituido → desativado
```

Com tabela de transições declarada (`ativosController.js:53`) — mais um
precedente do padrão que a homologação não segue.

`operacional` descreve **uma peça funcionando**, não o ponto de conexão
homologado com a distribuidora. Não serve como destino de `conectado`.

### Recomendação

`conectado` **não pertence à homologação** — mantém-se o argumento semântico da
FV-DOM-041: é fato sobre a usina, posterior e condicionado ao deferimento, não
uma resposta da concessionária.

**Para onde vai é decisão de negócio (§7.3)**, porque as duas alternativas
plausíveis têm consequências distintas e nenhuma tem suporte hoje:

* **agregado de conexão próprio** (`nao_conectada → conectada`, com data e
  medidor) — exige persistência nova;
* **ciclo de vida do projeto** — `projeto.status` já tem `em_execucao` e
  `concluido`, mas nenhum deles significa "conectada à rede", e reinterpretá-los
  mudaria o significado de um enum usado em toda a aplicação.

**PARADO.** Criar qualquer um dos dois é criar estado/persistência, proibido
nesta sprint.

---

## 5 · D4 — conexão provisória

**Nenhuma evidência no sistema:** busca por `provisori`, `temporari.*conex` e
`conexao_provisoria` em `backend/src` e `frontend/src` não retorna nada. Nenhum
campo, nenhum estado, nenhum requisito escrito.

Conforme a instrução da própria sprint — *"se não houver evidência no sistema ou
requisito explícito, registrar como decisão pendente"* — fica **pendente**
(§7.4). Não invento estado para uma situação que o sistema nunca representou.

---

## 6 · D5 — regra de entrada em `homologado`

### O que condiciona `homologado` hoje (medido na fonte)

`PATCH /homologacao/assistida/status` exige **exclusivamente**:

1. `_exigirGateHomologacao` — Baseline íntegra + ser a opção aceita
   (FV-DOM-001 / FV-DOM-032, aplicado desde a FV-UX-040);
2. o valor pertencer a `STATUS_HOMOLOGACAO`.

E, ao entrar em `homologado`, grava `concluida_em/por` e audita
`HOMOLOGACAO_CONCLUIDA`.

**Não exige:** validação documental — `validarDocumentos` existe em
`homologacaoAssistida.js`, mas é só **leitura**, exposta em
`GET /assistida/validacao`, e não é chamada na transição. **Não consulta** o
parecer: `parecer_extracao` não tem leitor nenhum (medido na FV-UX-044).

### Recomendação — usando somente regras existentes

`homologado` exige, e só:

1. **o Gate** — já aplicado, é regra de domínio existente;
2. **vir de `pendente_concessionaria`** — pela tabela da FV-DOM-041: não se
   declara deferimento sem ter passado pela distribuidora. Isto não é regra
   nova; é a consequência de ordenar estados que já existem.

**O que eu não posso adicionar sem decisão:** tornar `validarDocumentos`
bloqueante, ou exigir parecer confirmado. As duas são regras novas — a primeira
transformaria um relatório em barreira, a segunda criaria uma dependência que
hoje não existe. §7.5.

---

## 7 · Decisões ainda não suportadas pelo sistema — **PARAR**

| # | Decisão | O que falta |
|---|---|---|
| **7.1** | Reprotocolo é o mesmo processo ou um processo comercialmente novo? | A alternativa 1 (§2) basta se for o mesmo. Se for novo — com cobrança, prazo ou contrato próprios — a persistência precisa de conceito de ciclo, que não existe |
| **7.2** | O que o leitor legado vê quando B diz `reprovado`? | A não tem correspondente, e criar valor em A é criar estado (proibido). Alternativas: projetar `rascunho`, projetar `analise`, ou aceitar que A fique `null` |
| **7.3** | Onde mora `conectado`, e qual entidade responde "a usina está conectada?" | Não existe agregado de conexão. `AtivoEquipamento` é por equipamento; `projeto.status` não tem o conceito |
| **7.4** | Existe conexão provisória no negócio? | Zero evidência no sistema |
| **7.5** | `homologado` deve exigir documentação validada e/ou parecer confirmado? | As duas seriam regras novas. Hoje `validarDocumentos` é relatório, e o parecer não é lido por ninguém |

### D6 — desistência/cancelamento: **não é pendência, e não deve virar estado**

O conceito **já existe**, no nível certo:

* `utils/statusLifecycle.js:97` —
  `MOTIVOS_ARQUIVAMENTO = ['Cliente desistiu', 'Duplicado', 'Teste', 'Perdeu venda', 'Outro']`;
* `projeto.status` inclui `perdido`, `cancelado` e `arquivado`.

Desistência é um fato sobre **o projeto**, não sobre o processo de homologação —
o cliente desiste da obra, não do protocolo. Criar `cancelado` dentro da máquina
de homologação duplicaria um conceito existente no nível errado, e produziria
uma nova classe de contradição: projeto `arquivado` com homologação `em_preparacao`.

**Recomendação: nenhum estado novo.** Quando o projeto é arquivado, a homologação
simplesmente para de avançar — o Gate já a bloqueia, porque a bifurcação exige
opção aceita e Baseline íntegra.

---

## 8 · Resumo das recomendações

| | Decisão | Recomendação | Suporte |
|---|---|---|---|
| D1 | `reprovado` | não terminal: `→ em_preparacao` com motivo; nova transição no mesmo ciclo | histórico já existe |
| D2 | legado A | projeção derivada de B, somente leitura, descontinuação prevista | 1 escritor, 1 leitor real |
| D3 | conexão | fora da homologação — **PARADO**: não há onde colocar | nenhum agregado |
| D4 | conexão provisória | **PENDENTE** | zero evidência |
| D5 | `homologado` | Gate + vir de `pendente_concessionaria`. Nada além | regras existentes |
| D6 | desistência | **nenhum estado novo** — o conceito existe no projeto | `MOTIVOS_ARQUIVAMENTO` |

**D3 é a única que trava implementação.** Com D1, D2, D5 e D6 acima, a tabela de
transições da FV-DOM-041 fica completa e implementável — exceto pelo destino de
`conectado`, que precisa de §7.3 antes de A poder ser desligada de vez.
