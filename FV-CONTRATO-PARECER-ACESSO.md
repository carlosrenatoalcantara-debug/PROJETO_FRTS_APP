# Contrato Canônico do Parecer de Acesso — FV-UX-042

**Especificação. Não implementa extrator, não reativa rota, não altera fluxo.**

Responde: *quais informações um Parecer de Acesso pode fornecer, em qual formato
canônico, com quais regras de validação, e para qual destino cada uma vai.*

---

## 1 · Princípio

```
DOCUMENTO → EXTRAÇÃO → NORMALIZAÇÃO → DADOS CANÔNICOS → DECISÃO → FLUXO FV
```

As cinco setas são fronteiras, não etapas de uma função. O extrator legado
atravessava todas de uma vez — lia o PDF e saía criando `Cliente` e `ProjetoFV`
(FV-UX-041, achados 5, 9). O contrato existe para que cada fronteira possa
falhar, ser auditada e ser revertida isoladamente.

**Regra que atravessa tudo:** entre a EXTRAÇÃO e os DADOS CANÔNICOS nada é
inventado. Campo ausente é `null`, nunca um valor plausível. Isto não é novo —
é a decisão da FV-DOM-029, e o extrator legado a viola em seis pontos
(`fase_tensao || 'Monofásico'`, `voltagem || 220`, `gd_tier || 'GD II'`,
`potencia_w || 0`, `potencia_kw || 0`, `quantidade_paineis || 0`).

---

## 2 · O envelope: precedente já existente

O sistema **já resolveu** "documento → extração → confirmação humana → dado
canônico" uma vez: `ProjetoFV.fatura_extracao`. O contrato do parecer é o mesmo
envelope, e por isso não inventa arquitetura.

| Campo do envelope | Papel |
|---|---|
| `arquivo_original_nome` | rastreabilidade do documento de origem |
| `extraido_em` | quando |
| `metodo` | `gemini_vision` \| `pdf_parse` \| `manual` |
| `confianca` | 0–1 |
| `confirmado_pelo_usuario` | **o portão**: até ser `true`, o dado é candidato, não fato |

`confirmado_pelo_usuario` é o ponto arquitetural mais importante: extração de
LLM não é determinística (FV-UX-041, achado 1), e por isso não pode alimentar o
domínio sem um humano no meio.

---

## 3 · Inventário canônico

Campos que um Parecer de Acesso comprovadamente carrega — inventário derivado do
prompt do extrator legado, que codifica experiência real com Cosern, CELPE,
CEEE, Enel e AES.

Legenda de destino: **→** grava no fluxo · **⊘** sem destino canônico hoje ·
**◆** exige decisão (§6).

### 3.1 Identificação do documento

| Campo canônico | Tipo | Destino |
|---|---|---|
| `numero_parecer` | `String\|null` | ⊘ ◆ D1 — não existe campo. É a identidade do documento |
| `numero_contrato` | `String\|null` | ⊘ — nenhum consumidor no fluxo atual |
| `emitido_em` | `Date\|null` | ⊘ ◆ D1 |
| `distribuidora` | `String\|null` | → `fatura_extracao.concessionaria` (lida pelo checklist de homologação desde FV-UX-038/D3) |

### 3.2 Cliente

| Campo canônico | Tipo | Destino |
|---|---|---|
| `cliente.nome` | `String\|null` | → `Cliente.nome` ◆ D2 |
| `cliente.cpf_cnpj` | `String\|null` | → `Cliente.cpf_cnpj` — **chave de deduplicação** |
| `cliente.email` | `String\|null` | → `Cliente.email` — **nunca sintetizar** (§4.4) |
| `cliente.endereco` | `String\|null` | → `Cliente.endereco_completo` / `ProjetoFV.endereco_completo` |

### 3.3 Unidade consumidora

| Campo canônico | Tipo | Destino |
|---|---|---|
| `uc.numero_cliente` | `String\|null` | → `Cliente.numero_cliente` — segunda chave de deduplicação |
| `uc.tipo_ligacao` | `'Monofásico'\|'Bifásico'\|'Trifásico'\|null` | → etapa `fatura` → `fatura_extracao.tipo_ligacao` |
| `uc.tensao_v` | `Number\|null` | → `fatura_extracao.tensao_v` |
| `uc.grupo_tarifario` | `'A'\|'B'\|null` | → `fatura_extracao.grupo_tarifario` e `unidades_consumidoras[].grupo` |
| `uc.modalidade_gd` | `String\|null` | ◆ D3 — `unidades_consumidoras[].regra` só aceita `GD II` e `GD III` |
| `uc.potencia_contratada_kw` | `Number\|null` | ⊘ — o extrator legado extraía e **descartava** (`rede` nunca era persistido) |

### 3.4 Geração — o ponto crítico

| Campo canônico | Tipo | Destino |
|---|---|---|
| `geracao.modulos[]` | `Array<{marca, modelo, potencia_w, quantidade}>` | → `arranjos[].paineis[]` (§4.3) |
| `geracao.inversores[]` | `Array<{marca, modelo, potencia_kw, quantidade}>` | → `arranjos[].inversores[]` (§4.3) |
| `geracao.potencia_instalada_kwp` | `Number\|null` | → conferência contra `dimensionamento.potencia_kwp`, **nunca sobrescrita** |

**Os dois campos são LISTA, não objeto.** O extrator legado modelava um módulo e
um inversor únicos, sem quantidade de inversor — um parecer com 8 microinversores
virava "1 inversor" (FV-UX-041, achado 6). A forma de lista é a mesma que
`composicaoDoProjeto` (FV-UX-038/D1) já consome.

---

## 4 · Regras de normalização

Aplicadas entre EXTRAÇÃO e DADOS CANÔNICOS. Determinísticas, testáveis, sem LLM.

### 4.1 Ausência

Campo não encontrado é `null`. **Nenhum default.** Vale para todos os campos do
§3, inclusive `tipo_ligacao`, `tensao_v` e `modalidade_gd`, que o legado
preenchia.

### 4.2 Topologia do inversor

`geracao.inversores[].tipo` **não vem do documento** — é classificado por
`classificarTopologiaInversor` (`@fortesolar/fv-shared/inversores/dicionario`),
o classificador único da FV-DOM-031/decisão 4, a partir de marca e modelo.

Proibido gravar `tipo: 'string'` fixo, como o legado faz (FV-UX-041, achado 7):
isso contraria a FV-UX-038/D5, onde a topologia segue o equipamento.

### 4.3 Composição

Módulos e inversores vão para `arranjos[]`, a fonte canônica de composição e
quantidade (FV-UX-038/D1). A forma legada `equipamentos.inversor` **não recebe
quantidade** — quem precisa dela usa `composicaoDoProjeto`.

Um parecer que declara 8 microinversores produz um item com `quantidade: 8`,
não oito itens nem um item mudo.

### 4.4 E-mail

Se o parecer não traz e-mail, o campo é `null`. **Nunca** `<numero>@parecer.local`
(FV-UX-041, risco 2): endereço sintético é dado falso que entra na base como
verdadeiro e pode receber a proposta da FV-UX-035.

### 4.5 Vínculo com catálogo

Marca/modelo são casados contra `Equipamento` do catálogo. **Só com match real**
o `equipamento_id` é preenchido; sem match, o texto extraído é preservado e o
vínculo fica `null`. (Comportamento que o legado já acerta —
`P1-PARECER-ATLAS-LINK-01`.)

### 4.6 Estrutura de fixação

O parecer **não informa estrutura**. O campo permanece vazio e declara lacuna,
conforme o SSOT `@fortesolar/fv-shared/estrutura` (FV-DOM-039). Nada é assumido.

---

## 5 · Regras de validação

Três níveis. **Nenhum deles escreve** — validação decide se o dado pode ser
oferecido à confirmação humana.

### 5.1 Impeditivo — não há o que oferecer

* nenhum identificador de cliente (`cpf_cnpj` **e** `numero_cliente` nulos);
* `geracao.modulos[]` e `geracao.inversores[]` ambos vazios.

### 5.2 Bloqueia a confirmação — precisa de correção humana

* `cpf_cnpj` presente mas fora de `NNN.NNN.NNN-NN` / `NN.NNN.NNN/NNNN-NN`;
* `tensao_v` fora de `{127, 220, 380}` — conjunto declarado em
  `fv-shared/engenharia/unifilarSVG.js`, não escolhido aqui;
* `tipo_ligacao` fora de `{Monofásico, Bifásico, Trifásico}` — enum de
  `ProjetoFV.unidades_consumidoras[].fase_tensao`;
* `quantidade` ≤ 0 em qualquer item de geração;
* soma `potencia_w × quantidade` divergindo de `potencia_instalada_kwp` além de
  1 % — indica extração inconsistente consigo mesma.

### 5.3 Lacuna declarada — não impede nada

Todo campo `null` do §3 é lacuna nomeada, exibida ao operador. Mesmo tratamento
que o unifilar e a proposta já dão (FV-DOM-029, FV-UX-036).

**A taxa de completude do legado não faz parte deste contrato.** "72 % completo"
não é critério de decisão: o que importa é *quais* campos faltam, não quantos.

---

## 6 · Decisões pendentes — nada aqui foi decidido

| # | Decisão | Por que não posso decidir |
|---|---|---|
| **D1** | O parecer vira um **nó do fluxo** (`numero_parecer`, `emitido_em`) ou é só fonte de dados? | A FV-UX-040 mediu que "Parecer de Acesso" e "Orçamento de Conexão" não têm regra nenhuma. Criar campo aqui inventaria o estado que aquela sprint deixou em aberto |
| **D2** | Parecer **cria** projeto/cliente, ou só **anexa** a um existente? | Criar direto é o que a FV-UX-041 apontou como contorno do Gate. Anexar exige dizer o que acontece quando não há projeto |
| **D3** | `modalidade_gd` — o enum aceita só `GD II` e `GD III`. Um parecer "GD I" faz o quê? | Ampliar enum é decisão de negócio |
| **D4** | **Precedência** entre parecer e fatura: os dois trazem nome, CPF, nº de cliente, concessionária, ligação e tensão | Qual documento ganha, e o que acontece se divergirem, é regra comercial |
| **D5** | A extração usa **LLM externo**? | O PDF vai inteiro ao Google com nome, CPF, endereço (FV-UX-041, achados 1–3). É decisão de privacidade, não técnica |
| **D6** | Coleta para **treino** continua? | Grava dados de cliente em JSONL local |
| **D7** | O parecer alimenta **`fatura_extracao`** ou ganha envelope próprio `parecer_extracao`? | §2 recomenda o mesmo padrão; se é o mesmo campo ou um irmão depende de D4 |

---

## 7 · Fora deste contrato

* **Como** extrair (LLM, parser, OCR) — o contrato define a saída, não o meio;
* reativação de `POST /api/parecer-acesso/extrair`;
* o segundo motor de unifilar (`utils/simbolosUnifilar`) — o desenho canônico é
  `dominio/unifilar/`, e o parecer não precisa desenhar nada;
* qualquer escrita em homologação — o parecer **informa**, não avança fase.

---

## 8 · Resumo executável

Quando este contrato virar código, ele deve poder ser verificado assim:

```
extração  → objeto com as chaves do §3, todos os ausentes em null
normalizar→ topologia pelo dicionário · composição em arranjos[] ·
            e-mail nunca sintético · estrutura vazia
validar   → impeditivo / bloqueia confirmação / lacuna
confirmar → confirmado_pelo_usuario: true
gravar    → só então, e só pelas etapas canônicas do PUT /:id/etapa
```

Nenhuma dessas cinco linhas existe hoje. O legado faz as cinco de uma vez, sem a
quarta.
