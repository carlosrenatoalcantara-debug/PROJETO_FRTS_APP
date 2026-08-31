# FV-DOM-013 — Decisão D3: inflação energética

**Data:** 2026-08-15
**Natureza:** auditoria + matriz. Nenhum motor, API, UX, PDF ou banco alterado.
**Status de D3:** **`DECISÃO DE NEGÓCIO — NÃO INFERÍVEL DO CÓDIGO`**

---

## 1 · Auditoria: onde a inflação existe hoje

| Local | Valor | Unidade | Tipo | Onde é aplicado | Fonte no código |
|---|---|---|---|---|---|
| `contratoV1` (v1-2026-08) | `null` | — | premissa de entrada | exigida do chamador; ausente → lacuna | **deliberadamente vazia** (D3) |
| `financeiroEngine.calcularRetorno` | `0` | % a.a. | inflação energética *adicional* | `tarifa × (1+cresc)^(ano−1)` | nenhuma |
| `financeiroEngine` (reajuste) | `0` | % a.a. | reajuste tarifário | compõe com a inflação | nenhuma |
| `fluxoCaixa` | `0.08` | fração a.a. | fator único | `economia × (1+i)^(ano−1)` | nenhuma |
| `dimensionamentoRetorno` | `0.06` | fração a.a. | fator único | tarifa ano a ano | **"inflação histórica COSERN"** |
| `regulatorioBR` | `5` e `2` | % a.a. | reajuste **×** inflação | `(1+r)(1+i)−1` | nenhuma |
| `projetoController.simularFinanceiroLocal` | `0.08` | fração a.a. | fator único | economia ano a ano | nenhuma |
| `simulacaoOM` | `0.08` | fração a.a. | fator único | tarifa **e** custo de O&M | nenhuma |

**Quatro conjuntos distintos.** Apenas um — 6 % — tem qualquer fonte citada, e ela é um comentário (`inflação histórica COSERN`), sem referência verificável, série ou período.

### Um esclarecimento que a auditoria produziu

Dois motores separam **reajuste tarifário** de **inflação energética**; quatro usam fator único. Medi se isso muda o resultado:

```
fator único 7,1 %          → economia 25a R$ 1.048.358 · VPL R$ 201.186
reajuste 5 % × inflação 2 % → economia 25a R$ 1.048.358 · VPL R$ 201.186
(1,05 × 1,02 − 1 = 7,10 %)
```

**Idênticos.** A composição não é um modelo diferente — é a mesma taxa escrita como dois fatores. A escolha entre elas é de **expressividade** (poder justificar cada parcela separadamente), não de número.

---

## 2 · Impacto quantitativo — já com a TMA de 10 % (D2)

Caso típico: R$ 80 000 · 18 000 kWh/ano · R$ 0,98/kWh.

| Inflação | Payback | Pb inteiro | Pb descontado | **VPL @10 %** | Economia 25 a | TIR |
|---|---|---|---|---|---|---|
| **0 %** | 4,58 | 5 | 6,46 | R$ 74 321 | R$ 415 527 | 21,40 % |
| 2 % | 4,42 | 5 | 6,06 | R$ 99 595 | R$ 529 645 | 23,37 % |
| 4 % | 4,28 | 5 | 5,74 | R$ 131 824 | R$ 685 251 | 25,35 % |
| 5 % | 4,22 | 5 | 5,60 | R$ 151 240 | R$ 783 457 | 26,33 % |
| **6 %** | 4,16 | 5 | 5,47 | R$ 173 320 | R$ 898 568 | 27,32 % |
| **8 %** | 4,05 | 5 | 5,24 | R$ 227 214 | R$ 1 192 205 | 29,29 % |
| 10 % | 3,95 | 4 | 5,04 | R$ 297 752 | R$ 1 597 605 | 31,27 % |

**Amplitude 0 % → 8 %:** payback −0,53 ano · VPL **×3,1** · economia acumulada **×2,9**.

Verificado em quatro portes (5 kWp, 14,3 kWp, 50 kWp e um caso marginal): o padrão se mantém — o payback é pouco sensível, o **VPL e a economia acumulada são muito sensíveis**.

### O achado que muda o peso da decisão

Testei a que inflação o VPL deixa de ser negativo:

| Caso | VPL ≥ 0 a partir de |
|---|---|
| típico 14,3 kWp | **0 %** |
| pequeno 5 kWp | **0 %** |
| grande 50 kWp | **0 %** |
| **marginal** (R$ 120 000 / 6 100 kWh) | **9,2 %** |

Em projeto saudável, a inflação **não decide nada** — o VPL já é positivo com 0 %, e escolher 8 % apenas aumenta um número que já era favorável.

No projeto marginal, ela **decide sozinha**: a 8 % o VPL é −R$ 13 764 (reprovado, mas por pouco); a 10 % vira +R$ 10 628 (aprovado). O mesmo projeto muda de lado conforme uma premissa que ninguém verificou.

**É exatamente onde a decisão importa que um default é mais perigoso.**

---

## 3 · Matriz das alternativas

| # | Alternativa | Coerência econômica | Coerência com o existente | Payback | VPL @10 % | Economia 25 a | Risco de hipótese virar fato |
|---|---|---|---|---|---|---|---|
| 1 | **Obrigatória, sem default** | neutra — não afirma nada | compatível com o contrato V1 (premissa é dado) e com E2/lacunas | conforme o valor informado | idem | idem | **nulo** — nada é assumido |
| 2 | **0 % a.a.** | irreal: a tarifa subiu historicamente no Brasil | é o default de fato do `financeiroEngine` hoje | 4,58 | R$ 74 321 | R$ 415 527 | **médio** — subestima e parece conservadorismo prudente |
| 3 | **6 % a.a.** | plausível; **único com fonte citada** ("histórica COSERN"), mas sem série verificável | usado por `dimensionamentoRetorno` | 4,16 | R$ 173 320 | R$ 898 568 | **alto** — a fonte no comentário dá aparência de fato |
| 4 | **8 % a.a.** | mais otimista dos quatro; sem nenhuma fonte | usado por `fluxoCaixa`, `projetoController`, `simulacaoOM` | 4,05 | R$ 227 214 | R$ 1 192 205 | **alto** — o mais favorável à venda, sem justificativa |
| 5 | **Composição (r × i)** | idêntica a um fator único equivalente | `financeiroEngine` e `regulatorioBR` já fazem | — | — | — | **depende do valor** — a forma não protege de nada |

### Coerência com D2 — restrição já fechada

A TMA foi definida como **nominal 10 % a.a.** Isso obriga a inflação a ser **nominal** também: descontar fluxo real por taxa nominal subestimaria o VPL sistematicamente.

Consequência aritmética: com inflação abaixo de 10 %, o fluxo cresce menos que a taxa que o desconta. Isso é coerente — significa que o projeto precisa de retorno próprio, não de inflação, para ter VPL positivo. Os três casos saudáveis passam nesse teste a 0 %.

---

## 4 · Recomendação técnica

**Alternativa 1 — obrigatória, sem default.** Separada da decisão de negócio, e fundamentada em três fatos medidos:

1. **Nos projetos saudáveis, o valor não altera a decisão** — o VPL é positivo em todo o intervalo de 0 % a 10 %. Um default aqui só infla um número que já era favorável.
2. **No projeto marginal, o valor decide sozinho** — e é justamente onde um default embutido seria mais nocivo, porque decidiria sem que ninguém percebesse que decidiu.
3. **Nenhum dos valores existentes tem fundamento verificável.** O único com fonte citada (6 %) aponta para um comentário, não para uma série. Promover qualquer um deles a padrão do sistema converteria hipótese em fato — precisamente o que o contrato V1 foi desenhado para impedir.

Adicionalmente, recomendo adotar a **composição em dois fatores** (reajuste tarifário × inflação energética). Não muda número nenhum — muda o que se pode justificar: separar "a concessionária reajustou" de "a energia encareceu" permite defender cada parcela na proposta.

**Se o Negócio preferir um default**, a recomendação técnica é que ele seja:
- **explícito na versão de premissas** (`v1-2026-XX`), nunca embutido em função;
- acompanhado de **fonte verificável** (série ANEEL/concessionária, período);
- **sobrescritível por projeto**, com proveniência declarada.

---

## 5 · Valor que precisa ser aprovado

```
D3 — inflação energética anual

  [ ] obrigatória, sem default          ← recomendação técnica
  [ ] default de 0 % a.a.
  [ ] default de 6 % a.a.
  [ ] default de 8 % a.a.
  [ ] outro valor: ______ % a.a., fonte: ______________

  Forma:  [ ] fator único    [ ] reajuste × inflação (recomendado)
```

**`DECISÃO DE NEGÓCIO — NÃO INFERÍVEL DO CÓDIGO.`**

O código contém quatro valores contraditórios e uma única fonte, não verificável. Não há no repositório nada que permita eleger um deles tecnicamente — a escolha depende de política comercial e de qual série tarifária a empresa considera representativa.

---

## 6 · O que muda quando D3 for aprovada

| Se a decisão for | Alteração necessária |
|---|---|
| Obrigatória sem default | **nenhuma** — o contrato V1 já se comporta assim |
| Qualquer default | nova versão de premissas (`v1-2026-XX`) com o valor e a fonte; o motor não muda |
| Composição em dois fatores | **nenhuma** — `contratoV1` já declara `composicao_reajuste: 'composta'` e o motor já a aplica |

Em nenhum cenário o motor precisa ser reescrito. É por isso que o contrato foi construído com a inflação como entrada.

**Propagação às superfícies não migradas** (`fluxoCaixa` 8 %, `dimensionamentoRetorno` 6 %, `simulacaoOM` 8 %, `projetoController` 8 %) continua dependendo de D3 **e** D4 — é sprint separada.

---

**Nenhuma decisão tomada. Motor, API, UX, PDF, banco, D4 e D5 intocados. Sem commit.**
