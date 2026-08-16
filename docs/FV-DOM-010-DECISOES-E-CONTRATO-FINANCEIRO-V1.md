# FV-DOM-010 — Decisões e contrato financeiro V1

**Data:** 2026-08-15
**Natureza:** auditoria + especificação. Nenhum código funcional, banco, UX ou PDF alterado.
**Status geral:** **D1–D5 PENDENTES.** Nenhuma decisão de negócio foi tomada por mim.

---

## 0 · Duas ressalvas antes de qualquer coisa

### 0.1 · Uma das fontes de verdade não existe

O prompt manda consultar `FV-ESTADO-COMPACTADO.md` antes de qualquer alteração. **Esse arquivo não existe no repositório** — busquei na raiz, em `docs/` e por padrão em toda a árvore.

Os outros três foram lidos e conferidos contra o código. Se `FV-ESTADO-COMPACTADO.md` contém decisões já tomadas, elas **não estão refletidas aqui** — e este documento pode estar reabrindo algo já fechado. Fornecer o arquivo é pré-requisito para confiar nas classificações abaixo.

### 0.2 · Minhas auditorias anteriores subcontaram os motores

A FV-DOM-008 disse quatro. A FV-DOM-008A corrigiu para seis. **São oito.**

Faltaram:

| # | Caminho | Rota | Consumidor |
|---|---|---|---|
| 7 | `backend/controllers/financeiroController.js` | `POST /api/financeiro/simular` | **`pages/SimulacaoFinanceira.jsx`** — vivo |
| 8 | `backend/services/dimensionamentoFV.js` | — | `dimensionamentoController`, `projetoFVFunilController` — vivos |

**Causa do erro:** usei `head` para truncar greps de inventário nas sprints 008/008A. Os dois arquivos existiam e apareceriam sem o corte. Método falho, não ausência de evidência.

Ambos estão **vivos e consumidos** — não são código morto.

---

## 1 · Estado atual: oito caminhos, um caso

Investimento R$ 80 000 · geração 18 000 kWh/ano · tarifa R$ 0,98 · economia ano 1 R$ 17 640.

| # | Caminho | Payback | TIR % | VPL R$ | Premissas |
|---|---|---|---|---|---|
| 1 | `financeiroEngine` | 4,58 | 21,40 | — | infl. 0 % · degr. 0,5 % · sem desconto |
| 2 | `fluxoCaixa` (engenharia) | 5 | 29,29 | 412 646 | infl. 8 % · degr. 0,5 % · desc. 6 % |
| 3 | `propostaComercialService` (PDF) | 4,5 | — | — | sem inflação · sem degradação |
| 4 | `bessController` | 5 | — | — | arredondado |
| 5 | `projetoController` `/simular` | 5 | 29,83 | 244 499 | infl. 8 % · **sem degradação** · desc. 10 % |
| 6 | `regulatorioBR` (14.300) | 4,79 | 24,41 | — | reaj. 5 % × infl. 2 % · Fio B |
| 7 | **`financeiroController`** | **14** | 8,57 | **−13 119** | O&M 1 % · cresc. consumo 2 % · **fator 0,2** |
| 7b | idem, `com_bateria` | **3** | 42,24 | 517 262 | mesmo motor, **fator 1,5** |
| 8 | **`dimensionamentoFV`** | **2,2** | 27,32 | 173 320 | infl. 6 % · desc. 10 % · **economia média** |

**O mesmo projeto vale entre 2,2 e 14 anos de payback.** Em VPL, entre −R$ 13 119 e R$ 517 262.

### Quatro conjuntos de inflação, três de desconto

| Premissa | Valores em uso |
|---|---|
| Inflação energética | **0 %** (`financeiroEngine`) · **6 %** (`dimensionamentoFV`, comentado como "histórica COSERN") · **8 %** (caminhos 2, 5, 7) · **5 % × 2 %** composto ≈ 7,1 % (regulatório) |
| Taxa de desconto | **6 %** (caminho 2) · **10 %** (caminhos 5, 7, 8) · **nenhuma** (caminho 1) |
| Degradação | **0,5 %** onde existe (1, 2, 6, 8) · **ausente** em 5 e 7 |
| Horizonte | **25 anos** em todos os oito |

### Dois achados novos que mudam o peso das decisões

**`dimensionamentoFV.calcularPayback` usa economia MÉDIA, não acumulada:**

```js
const economia_media = economia25 / ANOS_PROJETO
return round(custo_total / economia_media, 1)
```

Divide o investimento pela média dos 25 anos — incluindo anos futuros já inflacionados que ainda não ocorreram. **Subestima sistematicamente:**

| Caso | Economia média | Economia acumulada | Diferença |
|---|---|---|---|
| R$ 80 000 / 18 000 kWh | 2,2 | 4,08 | **−1,88 ano** |
| R$ 200 000 / 5 100 kWh | 19,2 | 21,51 | **−2,31 anos** |
| R$ 120 000 / 6 100 kWh | 9,7 | 13,71 | **−4,01 anos** |

Isto não é "convenção fracionário × inteiro" (D1 como estava formulada). É **outra fórmula**, e ela sempre favorece a venda.

**`financeiroController` aplica fatores de cenário arbitrários:**

```js
if (tipo_cenario === 'com_bateria') economia *= 1.5
else                                economia *= 0.2
```

O mesmo projeto rende payback **14 anos** ou **3 anos** conforme o cenário — sem justificativa no código. É o motor que a tela `SimulacaoFinanceira.jsx` consome. Também é o único com O&M (1 % a.a.) e crescimento de consumo (2 % a.a.).

---

## 2 · D1 — Payback

**Status: `PENDENTE`** — decisão de negócio.

### Estado atual
Três fórmulas distintas, não duas:

| Fórmula | Onde | Comportamento |
|---|---|---|
| Acumulada **fracionária** (interpola a fração do ano) | `financeiroEngine`, `regulatorioBR` | 4,58 |
| Acumulada **inteira** (primeiro ano fechado) | `fluxoCaixa`, `projetoController`, `financeiroController`, `bessController` | 5 |
| **Economia média** | `dimensionamentoFV` | 2,2 |
| Simplificada `inv/(eco×12)` | `propostaComercialService` | 4,5 |

### Alternativas e impacto

| Opção | Efeito | Risco |
|---|---|---|
| **Fracionária acumulada** | precisão; nunca superestima | sugere precisão intra-anual que a premissa anual não sustenta |
| **Inteira acumulada** | conservadora; nunca subestima | superestima até 12 meses |
| **Economia média** | — | **subestima até 4 anos**; recomendo explicitamente **não** adotar, mas a escolha é do negócio |

### O que precisa ser decidido
1. fórmula oficial;
2. arredondamento (hoje: 2 casas / inteiro / 1 casa, conforme o caminho);
3. unidade exibida (anos decimais × anos+meses);
4. comportamento quando não se paga no horizonte — hoje `null` (caminho 1), `"> 25"` (string, caminhos 2/5/7) ou `0` (caminho 8, que devolve zero para economia não positiva — **valor ambíguo**, confunde "não se paga" com "instantâneo").

### Retrocompatibilidade
Qualquer escolha muda números já exibidos em pelo menos cinco caminhos. Propostas emitidas carregam o valor do caminho 3.

---

## 3 · D2 — VPL e taxa de desconto

**Status: `PENDENTE`** — decisão de negócio.

### Estado atual
Três VPL para o mesmo projeto: **R$ 412 646** (6 %), **R$ 244 499** (10 %, sem degradação), **R$ 173 320** (10 %, com degradação). Variação de **138 %** entre o maior e o menor.

O `financeiroEngine` — motor da aba Financeiro do FV — **não calcula VPL**.

### O que precisa ser decidido
1. VPL vira indicador oficial? Adotá-lo acrescenta número que o cliente FV não vê hoje.
2. Qual TMA? Valores observados: 6 % e 10 % (comentado como "custo de oportunidade (CDI ref)" em `dimensionamentoFV`). Nenhum tem justificativa documentada.
3. Premissa obrigatória? Sem taxa não há VPL — o contrato prevê `null` + lacuna declarada, nunca default silencioso.
4. Convenção temporal: todos descontam fluxo do ano *t* por `(1+i)^t` (fim de período). Unânime — pode ser confirmado sem debate.
5. Entradas inválidas: hoje o caminho 8 devolve `null` se `custo_total ≤ 0`; os demais produzem `NaN` ou número sem sentido.

---

## 4 · D3 — Inflação

**Status: `PENDENTE`** — decisão de negócio.

### Estado atual
Quatro conjuntos (0 %, 6 %, 8 %, 5 %×2 %). Impacto isolado, 25 anos, mesmo projeto:

| Inflação | Payback | Economia 25 anos |
|---|---|---|
| 0 % | 4,58 | R$ 415 527 |
| 2 % | 4,42 | R$ 529 645 |
| 5 % | 4,22 | R$ 783 457 |
| 8 % | 4,05 | R$ 1 192 205 |

**2,9× na economia apresentada, sem mudar uma fórmula.**

### O que precisa ser decidido
1. obrigatória com valor explícito, ou com default?
2. se default, qual — e com que justificativa documentada (o único valor com fonte declarada no código é 6 %, "inflação histórica COSERN");
3. pode ser zero? (hoje é o default de fato do caminho 1);
4. composição: `(1+reajuste)×(1+inflação)−1` (caminhos 1 e 6) ou fator único (caminhos 2, 5, 7, 8);
5. tratamento por cenário — o regulatório separa reajuste tarifário de inflação energética; os demais não.

---

## 5 · D4 — PDF e autoridade financeira

**Status: `PENDENTE`** — decisão de negócio.

### Estado atual

| PDF | Origem dos números | Situação |
|---|---|---|
| `propostaComercialService` | calcula internamente | diverge de todos |
| `gerarPdfComercial` | `/api/projeto/simular` | **campos não batem** — lê `paybackAnos`/`roi25Anos`/`paybackDescontado`; a API responde `payback`/`tir`/`vpl` → imprime `undefined` |
| `gerarPropostaPDF` | `financeiroEngine` | **defaults literais** `economiaAnual = 15000, payback = 8.5` |
| `gerarPdfSimulacao` | simulação | herda o caminho 5 |
| `gerarPdfOrcamento` | orçamento | sem cálculo de retorno |

### O que precisa ser decidido
1. qual caminho é a autoridade;
2. quais APIs e PDFs passam a consumi-la obrigatoriamente;
3. como preservar rastreabilidade — proposta: carimbar `motor_versao` + `premissas.versao` em cada documento emitido daqui em diante;
4. o que fazer com propostas já emitidas.

### Retrocompatibilidade — o ponto mais delicado
Corrigir o caminho 3 muda o payback de **40 → 19 anos** nos casos longos medidos na FV-DOM-008. São documentos que clientes receberam.

**Não levantei quantas propostas existem** — isso exige acesso a produção, que esta sprint não toca. O levantamento é pré-requisito para decidir.

---

## 6 · D5 — Lei 14.300

**Status: `PENDENTE`** — decisão de negócio.

### Estado atual
`regulatorioBR.js` implementa cronograma do Fio B (2023: 15 % → 2028: 90 % → 2029+: **100 %**, escolha conservadora **do código**, não da norma), direito adquirido até 2045, custo de disponibilidade (30/50/100 kWh por tipo de ligação), modalidades GD I/II/III, simultaneidade 30 %, Fio B como 28 % da tarifa.

Produz dois cenários — otimista e realista. Hoje **o código decide**: quando o regulatório está ativo, o realista vira a base da visão do cliente. Isso nunca foi decisão de negócio escrita.

Neste caso: economia 25 anos otimista R$ 1 192 205 × regulatório R$ 848 828 · perda regulatória ano 1 R$ 2 041.

### O que precisa ser decidido
1. cenário oficial (otimista, realista, ou ambos com o realista em destaque);
2. quais premissas são fixas e quais são por projeto;
3. versionamento do cronograma — a ANEEL pode alterar 2029+;
4. **sazonalidade inerte**: `calcularRetornoRegulatorio` aceita `geracaoMensalKwh`/`consumoMensalKwh`, chama `normalizarPesos`, e **nunca usa o resultado**. Decidir: implementar, remover o parâmetro, ou documentar como não suportado. Preservado intacto (corrigir mudaria resultado);
5. separação entre cálculo econômico e regulatório — hoje o regulatório recalcula retorno por conta própria em vez de compor com o motor econômico.

---

## 7 · Itens determináveis sem decisão de negócio

Estes decorrem de invariantes já vigentes no projeto ou de unanimidade factual do código. **Não os apliquei** — esta sprint não altera código — mas não precisam de deliberação:

| # | Item | Fundamento |
|---|---|---|
| E1 | Não persistir derivados financeiros | INV-58, já vigente; exceção é o `snapshot_financeiro` (congelar transforma derivado em fato) |
| E2 | Proveniência por campo + lacunas declaradas | M-3, já aplicado em FV-DOM-007B |
| E3 | `calculado_em` fora do cálculo (determinismo) | hoje `calcularFinanceiroCompleto` grava `new Date()` no meio do resultado, impedindo comparação direta |
| E4 | Horizonte 25 anos como default | unânime nos oito caminhos |
| E5 | Degradação 0,5 % a.a. **quando aplicada** | unânime nos quatro que a aplicam (aplicar sempre é D3) |
| E6 | Desconto no fim de período `(1+i)^t` | unânime nos que descontam |
| E7 | TIR devolve `{ valor, convergiu, motivo }` | acrescenta campo, não altera número; hoje `null` mudo (caminho 1), teto 1000 % (2, 5, 7) e `null` acima de 150 % (8) são indistinguíveis de resultado |
| E8 | Engineering lock: geração e potência do snapshot técnico | já respeitado pelo `financeiroEngine` |

---

## 8 · Contrato financeiro V1 — o que já pode ser formalizado

**Formalizado apenas o esqueleto e os itens E1–E8.** Os campos que dependem de D1–D5 estão marcados e ficam sem valor até a decisão.

```
FinancialCalculationContract v1
├── contrato_versao      "1.0.0"
├── motor_versao         semver do motor que executou
├── calculado_em         ISO-8601 UTC — metadado, NUNCA entra no cálculo   [E3]
│
├── premissas                                    ← nenhuma com default oculto
│   ├── versao                  string (obrigatória)
│   ├── horizonte_anos          25                                        [E4]
│   ├── degradacao_aa_pct       0,5 quando aplicada                       [E5]
│   ├── convencao_desconto      'fim_de_periodo'                          [E6]
│   ├── inflacao_energia_aa_pct     ⛔ D3
│   ├── reajuste_tarifa_aa_pct      ⛔ D3
│   ├── composicao_reajuste         ⛔ D3  'composta' | 'simples'
│   ├── taxa_desconto_aa_pct        ⛔ D2  (null ⇒ sem VPL)
│   ├── convencao_payback           ⛔ D1  'fracionario' | 'inteiro'
│   └── tarifa_kwh              obrigatória, com proveniência             [E2]
│
├── entradas
│   ├── investimento_r
│   ├── geracao_anual_kwh       do snapshot técnico                       [E8]
│   ├── consumo_anual_kwh
│   └── potencia_wp
│
├── fluxo_caixa[]        ano · economia_r · saldo_acumulado_r
│                        · valor_presente_r|null · saldo_descontado_r|null
│
├── payback              ⛔ D1  { anos|null, convencao, dentro_horizonte }
├── payback_descontado   ⛔ D2  { anos|null, dentro_horizonte } | null
├── vpl                  ⛔ D2  { valor_r, taxa_aa_pct } | null
├── tir                  { valor_aa_pct|null, convergiu, intervalo_busca,
│                          motivo: 'ok'|'fora_do_intervalo'|'sem_troca_de_sinal' }  [E7]
├── margem               preco · custo_total · bruta_pct · liquida_pct
│                        · lucro_total · lucro_por_wp
├── financiamento        Price + carência + CET | null
├── regulatorio          ⛔ D5  { aplicavel, lei, premissas, cenario_oficial,
│                                otimista, realista, comparacao }
├── proveniencia         { <campo>: 'caminho.no.projeto' | null }         [E2]
├── lacunas              [ <campo> ]                                      [E2]
└── arredondamento
    ├── moeda            2 casas
    ├── percentual       2 casas
    ├── anos             ⛔ D1
    └── coeficiente      6 casas
```

### Critérios de validade
Um resultado é **válido** quando: `investimento_r > 0`, `geracao_anual_kwh > 0`, `tarifa_kwh > 0`, e toda premissa que algum indicador solicitado exige está presente. Faltando qualquer uma, o indicador correspondente é `null` e o campo entra em `lacunas` — **nunca um valor assumido**.

### Comportamento de erro
Entrada inválida não lança: devolve o contrato com `lacunas` preenchidas e indicadores `null`. Erros de programação (tipo errado, estrutura ausente) lançam. Nenhum indicador jamais devolve `0`, `"> 25"` ou o teto do intervalo para significar "não foi possível calcular" — a ambiguidade dos caminhos 2, 5, 7 e 8 é exatamente o que E7 e os critérios acima eliminam.

### Compatibilidade histórica
`contrato_versao` + `motor_versao` + `premissas.versao` reconstroem qualquer cálculo. Documentos emitidos antes do contrato não têm esses carimbos e **não são reproduzíveis** — o que fazer com eles é D4.

---

## 9 · Impacto por área

| Área | Afetada por | Observação |
|---|---|---|
| **Dados** | E1 | `orcamento.irr_pct/npv_r/payback_anos` e `financeiro.*` persistem derivados (INV-58 violado no legado). Migrar exige backfill — **fora de escopo**, LME congelado |
| **APIs** | D1–D3 | 4 rotas devolvem indicadores: `/api/engenharia/fv` (órfã), `/api/projeto/simular`, `/api/financeiro/simular`, dimensionamento |
| **PDFs** | D4 | 5 geradores; 2 com defeito próprio já registrado |
| **UX** | D1–D5 | `CentroFinanceiroFV`, `SimulacaoFinanceira` (×2), `SimulacaoFV`, `PropostaEnterprise`, `RecomendacaoFinal` |

---

## 10 · Riscos (atualizados)

| # | Risco | Grau |
|---|---|---|
| R1 | `propostaComercialService` entrega payback até **2×** maior em PDF assinado | **alto** |
| R2 | TIR: `null` mudo, teto 1000 % e `null` acima de 150 % — três formas de esconder não-convergência | **alto** |
| R3 | VPL varia **138 %** entre os três caminhos que o calculam | **alto** |
| R4 | Inflação vale **2,9×** na economia apresentada | **alto** |
| R5 | `gerarPropostaPDF` e `SimulacaoFV` exibem **defaults literais** como dado do projeto | **alto** |
| **R12** | **`dimensionamentoFV` usa economia média — subestima payback em até 4 anos, sempre a favor da venda** | **alto** |
| **R13** | **`financeiroController` multiplica economia por 0,2 ou 1,5 conforme cenário, sem justificativa — payback 14 × 3 anos** | **alto** |
| R6 | `gerarPdfComercial` lê campos que a API não devolve → `undefined` no PDF | médio |
| R7 | Lei 14.300 só no navegador até FV-DOM-009; mudança da ANEEL exigia deploy de frontend | médio |
| R8 | Derivados persistidos em `orcamento`/`financeiro` | médio |
| R9 | `decisaoController` usa `financeiro?.payback \|\| 8` | médio |
| R10 | Sazonalidade regulatória inerte | baixo |
| R11 | Import sem extensão (resolvido na FV-DOM-009) | ✅ |

---

## 11 · Próximos passos

1. **Fornecer `FV-ESTADO-COMPACTADO.md`** — pode conter decisões já tomadas.
2. **Aprovar D1–D5** com a matriz da §12.
3. ~~FV-DOM-011~~ — **concluída.** Os oito caminhos estão consolidados; zero cópias vivas.
4. **FV-DOM-012** — implementar o contrato V1: adapter de domínio + `POST /:id/financeiro/calcular`. Depende de D1, D2, D3.
5. **FV-UX-017** — aba Financeiro na nova UX.
6. **FV-DOM-013** — absorver caminhos 3, 4 e 5. Depende de D4.

---

# 12 · Matriz final de decisão — FV-DOM-011A

**Data:** 2026-08-15. Consolida FV-DOM-008, 008A, 010 e 011.
**A coluna "Decisão Negócio" permanece `PENDENTE` em todas as linhas.** As recomendações abaixo são **técnicas** — indicam o que a evidência sustenta, não substituem a aprovação.

---

## D1 · Payback — quatro fórmulas, não duas

| Fórmula | Onde | Cálculo | Caso R$ 120 000 / 6 100 kWh |
|---|---|---|---|
| **Acumulada fracionária** | `financeiroEngine`, `regulatorioBR` | acumula economia ano a ano; **interpola** a fração do ano em que cruza o investimento | **13,71** |
| **Acumulada inteira** | `fluxoCaixa`, `projetoController`, `financeiroController`, `bessController` | mesmo acúmulo; devolve o **primeiro ano fechado** já positivo | 14 |
| **Economia média** | `dimensionamentoFV` | `custo / (economia25 / 25)` | **9,7** |
| **Simplificada** | `propostaComercialService` | `investimento / (economia_mensal × 12)` — sem inflação, sem degradação | 19,7 |

### Impacto numérico

| Caso | Fracionária | Inteira | Média | Simplificada |
|---|---|---|---|---|
| R$ 80 000 / 18 000 kWh | 4,08 | 5 | **2,2** | 4,5 |
| R$ 120 000 / 6 100 kWh | 13,71 | 14 | **9,7** | 19,7 |
| R$ 200 000 / 5 100 kWh | 21,51 | 22 | **19,2** | 39,2 |

### Riscos

- **Fracionária × inteira**: 5 a 9 meses. Diferença de convenção — ambas defensáveis.
- **Economia média (R12)**: **subestima em até 4 anos**, sempre a favor da venda. Divide o investimento pela média de 25 anos, incluindo anos futuros já inflacionados que ainda não ocorreram. Não é convenção — é erro de método: o payback pergunta *quando* o acumulado cobre o investimento, e uma média não tem "quando".
- **Simplificada (R1)**: superestima porque ignora inflação e degradação; o erro cresce com o prazo (39,2 × 21,51 anos). É o número do PDF assinado.
- **Não se paga no horizonte**: hoje `null`, `"> 25"` (string) ou `0`. O `0` é o pior — confunde "não se paga" com "instantâneo".

### Recomendação técnica

Adotar **acumulada** como método; **fracionária** como valor oficial, com o inteiro disponível como campo secundário para quem prefere o conservador. **Descontinuar economia média e simplificada** — não são convenções alternativas, são aproximações que erram em direções opostas. Quando não se paga: `null` + `dentro_horizonte: false`, nunca `0` nem string.

*A escolha entre fracionária e inteira é convenção comercial — essa parte é do Negócio.*

---

## D2 · VPL e taxa de desconto

| Motor | Taxa | Degradação | VPL (R$ 80 000 / 18 000 kWh) |
|---|---|---|---|
| `fluxoCaixa` | 6 % | sim | **412 646** |
| `projetoController` | 10 % | **não** | 244 499 |
| `financeiroController` | 10 % | n/a (modelo próprio) | −13 119 *(sem bateria)* |
| `dimensionamentoFV` | 10 % | sim | **173 320** |
| `financeiroEngine` | — | sim | **não calcula** |

**Variação de 138 %** entre o maior e o menor VPL comparável. Nenhuma taxa tem justificativa documentada além de um comentário: *"10 % a.a. — custo de oportunidade (CDI ref)"*.

O motor da aba Financeiro do FV — `financeiroEngine` — **não calcula VPL nem payback descontado**. Adotá-los acrescenta indicadores que o cliente FV não vê hoje.

### Recomendação técnica

VPL **sim**, como indicador oficial: é o único que responde "vale a pena contra a alternativa de não investir", e já existe em 3 dos 8 caminhos. Taxa como **premissa obrigatória versionada**, sem default — projeto sem taxa devolve `vpl: null` + lacuna declarada. Convenção temporal `(1+i)^t` (fim de período) é unânime e pode ser fixada sem debate.

*O valor da TMA é decisão do Negócio: depende do custo de capital da empresa, não de evidência técnica.*

---

## D3 · Inflação energética

| Valor | Onde | Justificativa no código |
|---|---|---|
| **0 %** | `financeiroEngine` (parâmetro sem default) | nenhuma |
| **6 %** | `dimensionamentoFV` | *"inflação histórica COSERN"* — **único com fonte declarada** |
| **8 %** | `fluxoCaixa`, `projetoController`, `financeiroController` | nenhuma |
| **5 % × 2 %** (≈ 7,1 % composto) | `regulatorioBR` | reajuste tarifário × inflação energética, separados |

### Impacto — mesmo projeto, 25 anos

| Inflação | Payback | Economia 25 anos |
|---|---|---|
| 0 % | 4,58 | R$ 415 527 |
| 2 % | 4,42 | R$ 529 645 |
| 5 % | 4,22 | R$ 783 457 |
| 8 % | 4,05 | **R$ 1 192 205** |

**2,9× na economia apresentada ao cliente**, sem alterar uma linha de fórmula.

### Recomendação técnica

**Premissa obrigatória, explícita e versionada** — sem default silencioso. Zero deve ser permitido (é o cenário conservador legítimo), mas como escolha declarada, não como ausência. Adotar a **composição em dois fatores** (reajuste tarifário × inflação energética) do `financeiroEngine`/`regulatorioBR`: separa o que a concessionária reajusta do que a energia encarece, e permite justificar cada um.

*O valor é decisão do Negócio. Registro apenas que 6 % é o único com fonte citada no código.*

---

## D4 · PDFs e autoridade financeira

### Quem calcula, quem recebe, quem inventa

| PDF / superfície | Origem | Defaults artificiais |
|---|---|---|
| `propostaComercialService` | **calcula internamente** (payback simplificado) | `investimento \|\| 25000` · `vpl \|\| 85000` · `tir \|\| 15.5` · `conta_media \|\| 500` |
| `gerarPropostaPDF` | recebe do `financeiroEngine` | `economiaAnual = 15000` · `payback = 8.5` · `total = 150000` |
| `gerarPdfComercial` | recebe de `/api/projeto/simular` | — mas **lê campos que a API não devolve** → `undefined` |
| `gerarPdfSimulacao` | recebe da simulação | nenhum |
| `gerarPdfOrcamento` | valores do orçamento | nenhum (sem indicadores de retorno) |
| `SimulacaoFV.jsx` | tela | `vpl \|\| 15000` |
| `decisaoController` | decisão automatizada | `payback \|\| 8` · `tir \|\| 12` |

**Sete superfícies com defaults artificiais.** Um projeto sem dados financeiros pode gerar um PDF afirmando VPL de R$ 85 000 e TIR de 15,5 % — números que não vieram de lugar nenhum.

### Historicamente afetados

Toda proposta emitida por `POST /api/proposta/gerar` carrega o payback simplificado. **Não levantei quantas** — exige produção, e a sprint proíbe.

### Arquitetura que elimina múltiplas verdades

```
ProjetoFV → adapter de domínio → motor canônico (fv-shared)
          → contrato V1 { resultado, premissas, proveniencia, lacunas, versoes }
          → API única  →  UX · PDFs · decisão automatizada
```

Regra: **nenhum consumidor calcula, nenhum consumidor inventa**. Faltando dado, o indicador é `null` e o PDF **omite a linha** em vez de imprimir um número plausível. Cada documento emitido carimba `motor_versao` + `premissas.versao`, tornando-se reproduzível.

### Recomendação técnica

Autoridade única: o motor canônico. **Prioridade máxima e independente de D1–D3: remover os defaults artificiais.** Eles não são convenção divergente — são números fabricados apresentados como dado do projeto, e nenhuma decisão de negócio é necessária para reconhecer que um PDF não deve inventar um VPL.

Sobre propostas já emitidas: **não reprocessar**. Preservar o histórico como está, marcar a versão a partir da qual o motor canônico vale, e tratar documentos antigos como não reproduzíveis.

*Se e quando o PDF passa a consumir o motor canônico — mudando o payback de 39,2 para 21,5 anos nos casos longos — é decisão do Negócio.*

---

## D5 · Lei 14.300

### Cenários existentes

| Cenário | Origem | Economia 25 anos (caso padrão) |
|---|---|---|
| **Otimista** | `financeiroEngine.calcularRetorno` — compensação integral | R$ 1 192 205 |
| **Realista** | `regulatorioBR.calcularRetornoRegulatorio` — Fio B, simultaneidade, compensação parcial | R$ 848 828 |
| Comparação | `compararCenarios` | perda regulatória ano 1: R$ 2 041 |

Hoje **o código decide**: quando o regulatório está ativo, o realista vira a base da visão do cliente (`calcularFinanceiroCompleto`). Isso nunca foi decisão de negócio escrita.

### Premissas

| Premissa | Valor | Natureza |
|---|---|---|
| Cronograma Fio B 2023–2028 | 15 % → 90 % | **regulatória** — Lei 14.300 |
| Fio B 2029+ | **100 %** | **decisão do código** — a ANEEL ainda não definiu |
| Direito adquirido | protocolo < 2023 → 0 % até 2045 | regulatória |
| Custo de disponibilidade | 30 / 50 / 100 kWh por ligação | regulatória — REN 1.000/2021 |
| Modalidades GD I/II/III | fator 1,0 / 1,0 / 0,9 | regulatória |
| Simultaneidade | **30 %** | **premissa de projeto** — varia por perfil de consumo |
| Fio B em R$/kWh | **28 % da tarifa** | **estimativa** — o valor real está na tarifa homologada |
| Reajuste / inflação | 5 % / 2 % | premissa econômica (ver D3) |

### Sazonalidade — defeito técnico, não decisão

`calcularRetornoRegulatorio` aceita `geracaoMensalKwh` e `consumoMensalKwh`, chama `normalizarPesos`, e **nunca usa o resultado** (`pesosGer` é calculado e descartado). O cálculo é anual.

Isso importa porque simultaneidade e compensação dependem do casamento **mensal** entre geração e consumo — anualizar superestima a compensação em perfis sazonais.

**Isto é R10, defeito técnico.** Não requer decisão de negócio para ser reconhecido como defeito; requer apenas escolher entre implementar, remover o parâmetro ou documentar como não suportado.

### O que é decisão e o que é defeito

| Item | Natureza |
|---|---|
| Cenário oficial (otimista × realista) | **decisão de negócio** |
| Simultaneidade 30 % e Fio B 28 % da tarifa | **decisão de negócio** (premissas comerciais) |
| Fio B 2029+ = 100 % | **decisão de negócio** com revisão regulatória futura |
| Sazonalidade inerte | **defeito técnico** (R10) |
| Regulatório recalcular retorno por conta própria em vez de compor com o motor econômico | **defeito de arquitetura** |

### Recomendação técnica

Cenário **realista como oficial** para o cliente, com o otimista exibido lado a lado e rotulado — é o que a Lei 14.300 torna verdadeiro, e apresentar apenas o otimista cria expectativa que a fatura vai desmentir. Premissas regulatórias **versionadas por ano-calendário**, para que a mudança da ANEEL em 2029 seja um dado novo e não um deploy. Sazonalidade: **implementar ou remover o parâmetro** — mantê-lo documentado e inerte é a pior das três opções.

*A escolha do cenário oficial é do Negócio.*

---

## 12.1 · Matriz final

| Decisão | Alternativas | Impacto | Recomendação técnica | Decisão Negócio |
|---|---|---|---|---|
| **D1 Payback** | acumulada fracionária · acumulada inteira · economia média · simplificada | 9,7 a 19,7 anos no mesmo projeto (**2×**) | acumulada; fracionária oficial + inteira como secundária; descontinuar média e simplificada; `null` quando não se paga | **PENDENTE** |
| **D2 VPL / taxa** | não adotar · 6 % · 10 % · premissa obrigatória | VPL de −13 119 a 412 646 (**138 %** entre comparáveis) | adotar VPL; taxa como premissa obrigatória versionada, sem default; `null` + lacuna quando ausente | **PENDENTE** |
| **D3 Inflação** | 0 % · 6 % · 8 % · 5 %×2 % · premissa obrigatória | economia 25 anos de R$ 415 527 a R$ 1 192 205 (**2,9×**) | premissa obrigatória e versionada; zero permitido como escolha declarada; composição em dois fatores | **PENDENTE** |
| **D4 PDF / autoridade** | manter múltiplas verdades · motor canônico como autoridade | 7 superfícies com defaults artificiais; payback do PDF **até 2×** o real | autoridade única; **remover defaults artificiais imediatamente** (não depende de D1–D3); não reprocessar histórico; carimbar versões | **PENDENTE** |
| **D5 Lei 14.300** | otimista oficial · realista oficial · ambos | R$ 343 377 de diferença em 25 anos | realista oficial com otimista rotulado ao lado; premissas versionadas por ano-calendário; resolver sazonalidade inerte | **PENDENTE** |

---

**Nenhuma decisão de negócio tomada. Nenhum código, banco, UX, API, PDF, LME ou premissa alterado. Nenhuma divergência eliminada. Sem commit.**

---

# 13 · FV-DECISAO-001 — tentativa de fechamento

**Data:** 2026-08-15.
**Resultado: as cinco decisões continuam `PENDENTE`.** As opções foram apresentadas ao Negócio com os números de impacto; não houve resposta. Nenhuma foi decidida por mim.

## 13.1 · Situação de cada decisão

| Decisão | Status | O que falta |
|---|---|---|
| **D1 Payback** | `PENDENTE` | escolher entre fracionário acumulado, inteiro acumulado, ou ambos oficiais |
| **D2 VPL / TMA** | `PENDENTE` | adotar VPL ou não; se sim, TMA obrigatória sem default, ou default de 6 % ou 10 % |
| **D3 Inflação** | `PENDENTE` | obrigatória sem default, ou default de 0 %, 6 % ou 8 % |
| **D4 PDF** | `PENDENTE` | motor canônico como autoridade e o que fazer com propostas já emitidas |
| **D5 Lei 14.300** | `PENDENTE` | cenário oficial (otimista × realista) e tratamento do alternativo |

Nenhuma decisão está implícita: onde não há escolha registrada, o código **permanece exatamente como estava**, com as divergências protegidas por check (`financeiroConsolidacao`, `financeiroRestante`, `defaultsFinanceiros`).

## 13.2 · Por que não decidi por conta própria

D2 e D3 dependem de números que **não existem no código nem podem ser inferidos dele**: o custo de capital da empresa e a premissa comercial de reajuste tarifário. D1 é convenção de apresentação. D4 muda documentos que clientes já receberam. D5 define o que a empresa promete.

O código não é fonte para nenhuma delas — ele é o registro de que nunca foram decididas: quatro premissas de inflação, três de desconto e quatro fórmulas de payback coexistindo é o sintoma, não a resposta.

## 13.3 · Impacto nas fórmulas, por decisão

Mapeado para que a implementação seja mecânica quando a decisão vier:

| Decisão | Fórmulas afetadas | Natureza da mudança |
|---|---|---|
| **D1** | `financeiroEngine.calcularRetorno` · `fluxoCaixa.calcularFluxoCaixa` · `dimensionamentoRetorno.calcularPayback` · `propostaComercialService` · `bessController` | escolher **uma** e fazer as demais convergirem. A de economia média (R12) e a simplificada saem em qualquer cenário — não são convenções alternativas |
| **D2** | `fluxoCaixa` (6 %) · `dimensionamentoRetorno` (10 %) · `projetoController` (10 %) · `financeiroController` (10 %) | uniformizar a taxa; `financeiroEngine` **ganha** VPL e payback descontado, que hoje não tem |
| **D3** | os quatro conjuntos de premissas | premissa passa a ser dado de entrada; os defaults saem do corpo das funções |
| **D4** | nenhuma fórmula muda — muda **quem chama** | os 5 geradores de PDF e `decisaoController` passam a consumir o contrato |
| **D5** | `regulatorioBR` · `financeiroEngine.calcularFinanceiroCompleto` | a escolha do cenário sai do código e vira premissa declarada |

## 13.4 · Impacto no contrato V1

Os campos marcados `⛔` na §8 permanecem sem valor definido:

```
premissas.convencao_payback        ⛔ D1
premissas.taxa_desconto_aa_pct     ⛔ D2
premissas.inflacao_energia_aa_pct  ⛔ D3
premissas.reajuste_tarifa_aa_pct   ⛔ D3
premissas.composicao_reajuste      ⛔ D3
regulatorio.cenario_oficial        ⛔ D5
payback · payback_descontado · vpl ⛔ D1/D2
```

O **esqueleto do contrato não depende de nenhuma decisão** e está formalizado: estrutura, proveniência, lacunas, versionamento triplo, critérios de validade, comportamento de erro e regras de arredondamento (exceto a casa decimal do payback, que é D1).

## 13.5 · Compatibilidade histórica

Independe de qual alternativa for escolhida:

- documentos emitidos **antes** do contrato não têm `motor_versao` nem `premissas.versao` e **não são reproduzíveis** — qualquer tentativa de recalculá-los produziria números diferentes dos entregues;
- a partir da adoção, todo documento carimba as três versões e passa a ser reproduzível;
- **nada será reprocessado sem decisão explícita** (D4);
- os indicadores derivados já persistidos em `ProjetoFV.orcamento` e `ProjetoFV.financeiro` permanecem intocados — migrá-los exige backfill, e o LME está congelado.

## 13.6 · Itens técnicos — não dependem do Negócio

Já executados, sem decisão:

| # | Item | Onde |
|---|---|---|
| ✅ | Consolidação dos 8 caminhos em `fv-shared/financeiro` | FV-DOM-009 e 011 |
| ✅ | Eliminação das 2 cópias literais da TIR | FV-DOM-009 e 011 |
| ✅ | **Remoção dos 18 valores financeiros fabricados** | FV-DOM-011B |
| ✅ | Import sem extensão (R11) | FV-DOM-009 |

Pendentes e **igualmente independentes** de D1–D5:

| # | Item | Fundamento |
|---|---|---|
| E3 | `calculado_em` fora do cálculo (determinismo) | metadado, não resultado |
| E7 | TIR devolver `{ valor, convergiu, motivo }` | acrescenta campo, **não altera número**; hoje `null` mudo, teto de 1000 % e `null` acima de 150 % são indistinguíveis de resultado |
| R6 | `gerarPdfComercial` lê campos que a API não devolve → `undefined` no PDF | descasamento de nomes, não divergência de fórmula |
| R10 | Sazonalidade regulatória inerte (`pesosGer` calculado e descartado) | parâmetro documentado que não faz nada |
| — | `POST /api/engenharia/fv` órfã (zero consumidores) | rota sem uso |

**Estes cinco podem ser executados a qualquer momento, sem aguardar o Negócio.**

## 13.7 · Bloqueio persistente

`FV-ESTADO-COMPACTADO.md` é citado como fonte obrigatória desde a FV-DOM-010 e **não existe no repositório** — verificado três vezes, na raiz, em `docs/` e por padrão em toda a árvore. Se ele contém decisões já tomadas, elas não estão refletidas aqui e este documento pode estar reabrindo algo fechado.

---

**Nenhuma decisão tomada. D1–D5 `PENDENTE`. Nenhum código, banco, UX, PDF ou LME alterado. Sem commit.**


---

# 14 · FV-DOM-015 — fechamento de D3 e D4

**Data:** 2026-08-15. Registro documental; nenhum código, PDF, banco ou histórico alterado.

## 14.1 · Decisões aprovadas

| # | Decisão | Valor aprovado |
|---|---|---|
| **D1** | Payback | acumulado **fracionário** oficial · **inteiro** como campo secundário |
| **D2** | VPL / TMA | VPL **obrigatório** · TMA **nominal 10 % a.a.**, versionada |
| **D3** | Inflação | **premissa obrigatória, sem default** · `0 %` válido só quando informado · versionada · ausência gera `lacuna`, nunca valor implícito |
| **D4** | Autoridade | **opção C** — motor canônico para novos cálculos e documentos; histórico não recalculado; `Baseline` intocada; propostas históricas preservadas |
| **D5** | Lei 14.300 | **PENDENTE** |

As linhas correspondentes da matriz §12.1 ficam superadas por esta seção.

## 14.2 · Impacto no código

| Decisão | Alteração necessária |
|---|---|
| D1 | **nenhuma** — implementada em FV-DOM-012 |
| D2 | **nenhuma** — implementada em FV-DOM-012 (`v1-2026-08`, TMA 10 % nominal) |
| **D3** | **nenhuma** — o contrato V1 já trata a inflação como entrada obrigatória: `PREMISSAS_VERSOES['v1-2026-08'].inflacao_energia_aa_pct = null` e `lacunas.push('inflacao_energia_aa_pct')` quando ausente. A decisão **confirma** o comportamento existente |
| **D4** | **pendente de execução** — 8 superfícies seguem com motores próprios |

D3 não exige implementação porque o contrato foi construído sem assumir valor — a decisão tornou definitivo o que era provisório.

## 14.3 · O que D4 destrava e o que exige

**Destrava:** a dependência dura registrada em FV-DOM-014 §6 estava em D3, agora fechada. Com inflação declarada como premissa obrigatória, o contrato produz números assim que o chamador a informa — os PDFs deixam de sair com `—` por decisão faltante.

**Exige (sprint de execução):** migrar, por ordem de risco —

1. `propostaComercialService` — PDF assinado, erro de até **+106 %** no payback de projetos longos;
2. `decisaoController` — decisão automatizada;
3. `CentroFinanceiroFV` — aba Financeiro FV (hoje calcula no navegador);
4. `projetoController` `/simular` e `financeiroController` `/simular`;
5. `bessController`;
6. `dimensionamentoFV` — maior superfície, usada no funil.

Cada documento emitido passa a carimbar `contrato_versao`, `motor_versao` e `premissas.versao`. Documentos anteriores não têm esses campos e permanecem **não reproduzíveis** — condição aceita por D4-C.

## 14.4 · Conflitos documentais

Verificados: **nenhum**. Os únicos textos que ainda declaram D3 pendente são comentários em `agregadosFvController.js:140` e `dominio/financeiro/index.js:70`, que descrevem o comportamento — o qual **não muda**. Ficam desatualizados apenas na referência à pendência, e serão ajustados na sprint de execução de D4, quando o código for tocado.

---

**D1, D2, D3 e D4 DEFINIDAS. D5 PENDENTE. Nada commitado.**
