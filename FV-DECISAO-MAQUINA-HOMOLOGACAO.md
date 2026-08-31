# Máquina canônica de homologação — FV-DOM-041

**Definição. Nenhum código alterado: sem schema, sem estado novo, sem Gate, sem
Baseline, sem UX, sem migração.**

Parte exclusivamente do que a FV-DOM-040 mediu.

---

## 1 · Recomendação

**A máquina canônica é B — `homologacao.status_homologacao`.**

A máquina A (`homologacao.status`) passa a **adaptador de compatibilidade**, com
descontinuação prevista, e deixa de ser escrita diretamente.

---

## 2 · Justificativa técnica

### 2.1 A mistura dois assuntos; B não

A enumera `rascunho → enviado → analise → aprovado → conectado`. Os quatro
primeiros descrevem **o processo de homologação**. O quinto descreve **um fato
físico e comercial da usina** — ela está energizada e injetando na rede.

São coisas de naturezas diferentes:

* `aprovado` é uma resposta **da concessionária sobre um pedido**;
* `conectado` é um **evento posterior**, que depende de obra, vistoria e troca de
  medidor — nada disso é homologação.

Uma máquina cujo estado terminal pertence a outro assunto não pode ser a fonte
canônica daquele assunto. É a raiz do caso crítico: A pode dizer `conectado`
justamente porque `conectado` não é uma afirmação sobre homologação.

B termina no veredito da concessionária — `homologado` / `reprovado` — que é
exatamente o que a palavra "homologação" significa.

### 2.2 B nomeia o bloqueio; A nomeia só o andamento

B distingue `pendente_documentacao`, `pendente_engenharia` e
`pendente_concessionaria`. A tem um único `analise`, que não diz **de quem** é a
bola.

Isso importa operacionalmente: em `analise`, o operador não sabe se falta
documento dele, projeto da engenharia, ou resposta da distribuidora. É a
diferença entre um estado que informa e um que só passa o tempo.

Os nós do fluxo pedido na FV-UX-044 mapeiam 1:1 em B:

| Nó do fluxo | Estado em B |
|---|---|
| preparação documental | `em_preparacao`, `pendente_documentacao` |
| dependência de engenharia | `pendente_engenharia` |
| envio / acompanhamento na concessionária | `pendente_concessionaria` |
| retorno da concessionária | `homologado` / `reprovado` |

Em A, três desses quatro nós colapsam em `analise`.

### 2.3 B tem histórico; A não tem — e isso decide a migração

B grava, a cada transição, `historico_status: { em, de, para, por, motivo }` — e
grava de fato: `routes/homologacao.js` faz o `push` em toda mudança. Tem ainda
`iniciada_em/por` e `concluida_em/por`.

A não tem histórico nenhum. Tem apenas três marcas soltas: `data_envio`,
`data_aprovacao`, `art_numero`.

Consequência direta para o requisito de "migração sem perder histórico":

* **A → B é reconstrutível**: `data_envio` vira uma entrada
  `de: em_preparacao, para: pendente_concessionaria`; `data_aprovacao` vira
  `para: homologado`. O histórico que A não tinha é *criado* a partir do que ela
  registrou, sem inventar datas.
* **B → A destrói informação**: sete estados colapsam em cinco, e o histórico com
  autor e motivo não tem para onde ir.

Escolher A significaria escolher a máquina que perde dado.

### 2.4 Compatibilidade — o custo real está na UX, não nos dados

| | Máquina A | Máquina B |
|---|---|---|
| Gravada por | `PATCH /homologacao/status` | `PATCH /homologacao/assistida/status` |
| Lida pela **UX nova** (`/fv`) | ✔ | ✘ |
| Lida pela **UX legada** (`CentralDados`, `CrmProjetos`) | ✘ | ✔ |
| Histórico | ✘ | ✔ |
| Regras por concessionária | ✘ | ✔ (`concessionariaProvider`) |

A UX nova hoje dirige A. Escolher B custa **religar uma tela** — a mesma
`EtapaHomologacao` que a FV-UX-034 e a FV-UX-040 já reescreveram. Escolher A
custaria descartar histórico, o vocabulário de bloqueio e a integração com as
regras por concessionária (documentos obrigatórios, normas, limites, formulários
de Neoenergia/Cosern, Equatorial, Energisa, CPFL, CEMIG, COPEL), que só existem
do lado de B.

Trocar tela é barato; recriar `homologacaoAssistida.js` e o provider não é.

### 2.5 Nenhum domínio depende de qualquer uma das duas

A FV-DOM-040 confirmou na fonte: Gate, BaselineService e o domínio da proposta
não leem esses estados. Isso torna a escolha **reversível e de baixo risco**:
nenhum contrato, congelamento ou liberação de fase muda de comportamento.

---

## 3 · Tabela de estados canônicos

Os sete estados **já existentes** em B. Nenhum foi criado, renomeado ou removido.

| Estado | Significado | Tipo |
|---|---|---|
| `nao_iniciado` | a homologação ainda não começou | **inicial** |
| `em_preparacao` | montando o pacote documental | intermediário |
| `pendente_documentacao` | falta documento do cliente/empresa | intermediário (bloqueado) |
| `pendente_engenharia` | falta produto de engenharia (memorial, unifilar, ART) | intermediário (bloqueado) |
| `pendente_concessionaria` | protocolado; aguardando a distribuidora | intermediário (aguardando terceiro) |
| `homologado` | a concessionária deferiu | **terminal** |
| `reprovado` | a concessionária indeferiu | **terminal condicional** — ver §7.1 |

`null` permanece aceito no schema e é lido como `nao_iniciado` pelo adaptador —
projetos históricos não têm o campo.

---

## 4 · Tabela de transições proposta

Segue o padrão de `TRANSICOES_FREEZE` (`fv-shared/estados/governancaFreeze.js`):
objeto congelado, chave = estado atual, valor = destinos permitidos. O projeto já
aplica esse padrão em `ativosController` e em `projetosFVController`; a
homologação é a única máquina relevante que **não** o usa.

```
TRANSICOES_HOMOLOGACAO = {
  nao_iniciado:            ['em_preparacao'],
  em_preparacao:           ['pendente_documentacao', 'pendente_engenharia',
                            'pendente_concessionaria'],
  pendente_documentacao:   ['em_preparacao', 'pendente_engenharia',
                            'pendente_concessionaria'],
  pendente_engenharia:     ['em_preparacao', 'pendente_documentacao',
                            'pendente_concessionaria'],
  pendente_concessionaria: ['homologado', 'reprovado',
                            'pendente_documentacao', 'pendente_engenharia'],
  homologado:              [],
  reprovado:               [],        // ← ver §7.1
}
```

**O que a tabela impede** (hoje aceito com HTTP 200):

* saltar de `nao_iniciado` direto para `homologado`;
* regredir de `homologado` para `nao_iniciado`;
* declarar deferimento sem ter passado pela concessionária.

**O que ela permite de propósito:** voltar de qualquer pendência para outra
pendência ou para `em_preparacao`. Isso não é regressão indevida — é o caso real
de a concessionária exigir documento novo, ou a engenharia refazer o unifilar.
`pendente_concessionaria → pendente_documentacao` cobre a exigência ("comunique-se")
sem inventar estado.

**Histórico:** toda transição continua gravando `{em, de, para, por, motivo}`,
como B já faz. `motivo` passa a ser **obrigatório** nas transições que retrocedem
e em `reprovado` — sem isso o histórico registra que algo voltou, mas não por quê.

---

## 5 · Tratamento de `conectado + reprovado`

### 5.1 `conectado` não pertence à homologação

Conforme §2.1. Sob a máquina canônica B, o caso crítico **deixa de ser
representável dentro da homologação**, porque B não tem estado de conexão. A
contradição some por construção, não por validação cruzada.

### 5.2 Onde `conectado` deveria estar

`conectado` é um fato sobre a **usina**, não sobre um processo documental. As
duas leituras possíveis:

1. **máquina própria de conexão** (`nao_conectada → conectada`, com data e
   número de medidor);
2. **estado do ciclo de vida do projeto** — `projeto.status` já tem
   `em_execucao` e `concluido`.

Não escolho entre as duas: §7.3.

### 5.3 `reprovado` pode coexistir com conexão?

Tecnicamente, uma usina conectada após homologação indeferida é uma anomalia
regulatória. Mas existe o caso real de conexão provisória e de reprovação
posterior a uma conexão já feita, e **não tenho regra da casa que diga o que o
sistema deve fazer nessas situações**. §7.4.

### 5.4 Qual entidade representa a situação real da usina

**Hoje, nenhuma.** É o achado que a FV-DOM-040 já tinha exposto e que esta
análise confirma: no caso crítico o projeto afirmava, simultaneamente,
`homologacao.status = conectado`, `status_homologacao = reprovado` e
`projeto.status = rascunho` — três respostas incompatíveis, e a terceira, que é a
do ciclo de vida, sequer havia saído do início.

Definir essa entidade é decisão de negócio: §7.3.

---

## 6 · Tratamento da máquina não canônica (A)

**Adaptador de compatibilidade, com descontinuação prevista.** Três regras:

1. **A deixa de ser escrita diretamente.** `PATCH /homologacao/status` deixa de
   gravar `homologacao.status` por conta própria. A exigência da sprint —
   *"não permitir que ela continue alterando silenciosamente a máquina
   canônica"* — vale nos dois sentidos: A não escreve B, e A não escreve a si
   mesma em paralelo a B.

2. **A vira projeção derivada de B**, para os leitores legados não quebrarem:

   | B (canônica) | A (projetada) |
   |---|---|
   | `nao_iniciado` | `rascunho` |
   | `em_preparacao`, `pendente_documentacao`, `pendente_engenharia` | `rascunho` |
   | `pendente_concessionaria` | `enviado` |
   | `homologado` | `aprovado` |
   | `reprovado` | *sem correspondente em A* ← ver §7.2 |

   `analise` e `conectado` deixam de ser produzidos: `analise` porque B distingue
   quem está bloqueando, e `conectado` porque não é homologação.

3. **O endpoint legado passa a traduzir.** `PATCH /homologacao/status` aceita o
   vocabulário antigo, traduz para B e grava B — nunca os dois. Chamada com
   `conectado` é recusada com erro explícito, porque não há para onde traduzir.

Nada disso é implementado nesta sprint.

---

## 7 · Decisões de negócio ainda necessárias — **PARAR**

| # | Decisão | Por que não é minha |
|---|---|---|
| **7.1** | `reprovado` é terminal ou reabre? Se a concessionária indefere e a empresa corrige e reprotocola, isso é **nova transição** (`reprovado → em_preparacao`), **novo ciclo** (histórico separado) ou **novo projeto**? A tabela do §4 está com `reprovado: []` justamente porque a resposta muda a máquina | é regra de processo comercial |
| **7.2** | `reprovado` não tem correspondente em A. O leitor legado deve ver `rascunho`, ver `analise`, ou receber um valor novo? Criar valor em A é criar estado — proibido nesta sprint | define o que o legado enxerga |
| **7.3** | Onde mora `conectado`: máquina própria de conexão, ou `projeto.status`? E **qual entidade** passa a responder "a usina está funcionando?" | decisão de modelagem com efeito em relatório e operação |
| **7.4** | Conexão provisória existe no negócio? Uma usina pode estar conectada com homologação `reprovado`? | fato regulatório/comercial do dia a dia |
| **7.5** | `homologado` exige parecer confirmado? Hoje `parecer_extracao` não é lido por ninguém (FV-UX-044) — o parecer confirmado poderia ser pré-requisito de `pendente_concessionaria` ou de `homologado` | é regra de negócio, não inferência |
| **7.6** | Existe desistência/cancelamento? A máquina não tem estado para "cliente desistiu" nem "projeto cancelado" durante a homologação | criar estado é proibido e seria decisão de negócio |

**Sem 7.1 e 7.2, a tabela de transições do §4 não pode ser implementada como
final** — a linha de `reprovado` e a projeção de compatibilidade dependem delas.

---

## 8 · O que esta sprint NÃO fez

Nenhum arquivo de `src`, `packages` ou `frontend` foi alterado. Nenhum estado
criado, nenhuma transição implementada, nenhuma migração escrita, Gate e Baseline
intocados, o caso `conectado + reprovado` **não** foi corrigido por código —
conforme a instrução explícita de não corrigi-lo antes da decisão.
