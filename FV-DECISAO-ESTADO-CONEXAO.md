# Estado de conexão — auditoria e decisão — FV-DOM-044

**Auditoria. Nenhum código alterado:** sem entidade, sem campo, sem enum, sem
máquina de estado, sem migração. Nenhum projeto tocado.

---

## 0 · Correção de premissa

O enunciado pede mapear `projeto.status = conectado`. **Esse valor não existe.**

```
projeto.status      enum: rascunho · em_simulacao · em_analise · dimensionado ·
                          proposta · aprovado · em_execucao · concluido ·
                          perdido · cancelado · arquivado     ← sem 'conectado'

homologacao.status  enum: rascunho · enviado · analise · aprovado · conectado
                                                              ← aqui, e só aqui
```

`conectado` existe em **um único lugar**: o enum da máquina legada A. A auditoria
abaixo trata desse valor.

---

## 1 · Mapa de proveniência de `conectado`

### 1.1 Escritores

| Onde | Como |
|---|---|
| `homologacaoController.js:431` → `PATCH /homologacao/status` | `conectado` é apenas um dos cinco valores aceitos em `statusValidos`; não há caminho, evento ou regra específica que o produza |

**Um único escritor, e genérico.** Nada no sistema "conecta" uma usina — alguém
escolhe a palavra numa lista.

### 1.2 Leitores

| Onde | O que faz com o valor |
|---|---|
| `EtapaHomologacao.jsx:42` | rótulo `['conectado', 'Conectado']` na lista de botões |
| `EtapaHomologacao.jsx:132` | exibe como estado atual |

**Nenhum outro leitor.** Nenhuma regra, cálculo, relatório, Gate, Baseline,
filtro ou documento deriva comportamento de `conectado`. Ele é exibido e nada
mais.

*(Falso positivo descartado: `server.js:191` usa `'conectado'` para o estado da
conexão com o MongoDB — assunto alheio.)*

---

## 2 · O que existe para conexão física

Varredura por conceito em `backend/src`, `frontend/src` e `packages`:

| Conceito | Ocorrências | É campo persistido? |
|---|---|---|
| `medidor` | 65 | **não** — só símbolo de desenho (`simbolosUnifilar`, `diagram-engine`), render de unifilar e leitura da fatura (`faturaParser`) |
| `comissionamento` | 23 | **sim** — `AtivoEquipamento.data_comissionamento` e `comissionado_por` |
| `vistoria` | 9 | não — só um comentário em `ProjetoEV` |
| `ponto de conexão` | 2 | não |
| `energização` | 0 | — |
| `troca de medidor` | 0 | — |
| `data de conexão` | 0 | — |

### 2.1 O único agregado com semântica próxima

`AtivoEquipamento` — **por equipamento**, não pela usina:

```
tipo:    modulo | inversor | microinversor | otimizador | bess | carregador
status:  planejado → instalado → operacional → manutencao → substituido → desativado
         (com TRANSICOES declaradas em ativosController.js:53)
campos:  projeto_id, arranjo_id, numero_serie, qr_code,
         data_instalacao, data_comissionamento, comissionado_por,
         conectividade{ mac_wifi, wifi_ssid, firmware, endereco_ip },
         monitoramento{ portal, plant_id, gateway_sn, logger_id, … }
```

É o registro **as-built** da peça: quando foi instalada, quando foi comissionada,
por quem, em que portal é monitorada.

**Não há tipo `medidor`** no enum, nem campo de ponto de conexão, nem data de
energização da instalação.

---

## 3 · As quatro coisas que o enunciado manda distinguir

| Fato | Significado | Onde vive hoje |
|---|---|---|
| **homologação aprovada** | a distribuidora **deferiu** o pedido de acesso | `status_homologacao = homologado` (canônica, B) |
| **conexão física** | a usina está ligada à rede e injetando | **em lugar nenhum** — `conectado` é rótulo sem regra |
| **conexão provisória** | ligada antes/sem deferimento definitivo | **não existe** (confirmado na FV-DOM-043/D4) |
| **equipamento operacional** | *uma peça* instalada e comissionada | `AtivoEquipamento.status = operacional` + `data_comissionamento` |

São quatro fatos distintos. Hoje o sistema representa dois — o primeiro e o
quarto — e o quarto **por peça**, não pela instalação.

**Somar peças não produz o segundo.** Todos os inversores `operacional` significa
que os equipamentos foram comissionados; não significa que a concessionária
trocou o medidor e liberou a injeção. São eventos com atores diferentes: um é a
equipe de campo, o outro é a distribuidora.

---

## 4 · `projeto.status` — tem significado próprio, e `conectado` não é dele

`projeto.status` é a máquina **comercial/lifecycle** do projeto:

```
rascunho → em_simulacao → em_analise → dimensionado → proposta → aprovado
         → em_execucao → concluido        · perdido · cancelado · arquivado
```

Traço do funil comercial e da execução — do lead ao encerramento. Os terminais
negativos (`perdido`, `cancelado`, `arquivado`) confirmam a natureza: são
desfechos **de negócio**.

`em_execucao` e `concluido` são os únicos candidatos a hospedar `conectado`, e
**nenhum dos dois serve**:

* `em_execucao` cobre toda a obra — começa antes da conexão e não diz nada sobre
  a rede;
* `concluido` é o encerramento do **projeto**, que pode acontecer depois da
  conexão (entrega de documentação, garantias) ou, em casos de cancelamento após
  conexão, nunca.

Reinterpretar qualquer um deles mudaria o significado de um enum lido em toda a
aplicação — incluindo `derivarStatusSeguro` e o funil de CRM.

**Conclusão:** `conectado` não pertence a `projeto.status`.

---

## 5 · Preservação — o que se perde, e o que não posso medir

### 5.1 O que o valor afirma

Um projeto com `homologacao.status = 'conectado'` carrega **uma única
informação**: alguém, em algum momento, declarou que aquela usina está conectada.

E carrega **sem**:

* data — A não tem histórico; `data_aprovacao` é da aprovação, não da conexão;
* autor — A não registra quem;
* motivo ou número de medidor.

Se o valor for removido sem destino, perde-se **o fato de que a usina está em
operação** — que é a informação mais consequente do ciclo, porque é o que separa
uma obra entregue de uma obra parada.

Não se perde nenhuma data nem rastreabilidade, porque A nunca as teve.

### 5.2 Quantos projetos estão nessa situação — **não posso responder**

A ordem permanente desta série proíbe acessar o Atlas de produção. O ambiente
isolado só contém dados sintéticos criados pelas próprias auditorias, então
contá-los não responderia nada.

**A contagem precisa ser feita por quem tem acesso**, em leitura pura:

```js
// somente leitura — não altera nada
db.projetofvs.countDocuments({ 'homologacao.status': 'conectado' })

db.projetofvs.find(
  { 'homologacao.status': 'conectado' },
  { nome: 1, status: 1, 'homologacao.status_homologacao': 1,
    'homologacao.data_aprovacao': 1, 'homologacao.numero_protocolo': 1 }
).limit(50)
```

A segunda consulta responde o que importa para a migração: **quantos desses
projetos já têm `status_homologacao` preenchido** (e portanto a informação de
homologação preservada em B), e quantos só têm A — para os quais `conectado` é
a única afirmação existente.

Sem esse número, qualquer plano de migração é chute. **Nenhum projeto foi
alterado nesta sprint.**

---

## 6 · Decisão de domínio

A auditoria demonstra que **não existe destino adequado**:

* `status_homologacao` (B) — não deve receber: conexão não é resposta da
  concessionária (FV-DOM-041 §2.1);
* `projeto.status` — não deve receber: é máquina comercial (§4);
* `AtivoEquipamento` — não serve: é por peça, e comissionar equipamento não é
  conectar a usina (§3).

Portanto, conforme a própria instrução — *"somente propor uma nova
entidade/campo se a auditoria demonstrar que não existe destino adequado"* —
**registro como decisão de domínio pendente**, com a proposta abaixo. Nada foi
criado.

### 6.1 Proposta mínima

O fato "usina conectada" é **um evento, não um processo**: acontece uma vez, tem
data, e depois é permanente. Não precisa de máquina de estado — precisa de
registro.

Forma mínima suficiente, no próprio `ProjetoFV`, sem novo agregado:

```
conexao: {
  conectada_em:   Date|null      ← o fato e sua data
  registrada_por: String|null    ← quem declarou
  numero_medidor: String|null    ← identificação do ponto (lacuna se ausente)
  observacoes:    String|null
}
```

`conectada_em === null` significa "não conectada". Um campo de data já é a
máquina binária inteira, sem enum novo.

**Por que não um agregado `Conexao`:** não há ciclo, não há transições, não há
histórico a manter, e não há mais de uma conexão por projeto. Um agregado seria
estrutura sem conteúdo — o oposto do que este programa vem fazendo.

### 6.2 O que ainda depende de decisão de negócio

| # | Pergunta |
|---|---|
| 6.2.1 | Conexão exige `homologado`, ou pode ser registrada antes (conexão provisória — FV-DOM-043/D4, ainda sem evidência)? |
| 6.2.2 | Quem declara a conexão: equipe de campo, backoffice, ou vem do parecer/documento da distribuidora? |
| 6.2.3 | A conexão encerra o projeto (`projeto.status = concluido`) ou são fatos independentes? |
| 6.2.4 | `numero_medidor` é obrigatório, ou lacuna declarada como as demais? |

**Sem 6.2.1 e 6.2.3, o campo pode ser criado mas não integrado** — não se sabe o
que ele libera nem o que ele encerra.

---

## 7 · Resumo

| | Resultado |
|---|---|
| Premissa do enunciado | **corrigida**: `conectado` não está em `projeto.status`, e sim em `homologacao.status` |
| Escritores de `conectado` | 1, genérico (`PATCH /homologacao/status`) |
| Leitores | 2, ambos rótulo/exibição na mesma tela. **Nenhuma regra depende dele** |
| Agregado de conexão | **não existe** |
| Medidor / energização / data de conexão | **não são campos** — medidor só existe como símbolo de desenho |
| Destino adequado entre os existentes | **nenhum** |
| Recomendação | registrar `conexao.conectada_em` em `ProjetoFV` — evento com data, não máquina de estado |
| Projetos afetados | **não mensurável daqui** — consulta de leitura fornecida em §5.2 |
| Alterações feitas | **nenhuma** |
