# FV-DOM-014 — Decisão D4: autoridade financeira e PDF

**Data:** 2026-08-15
**Natureza:** auditoria + matriz. Nenhum código, PDF, banco ou histórico alterado.
**Status de D4:** **PENDENTE** — decisão de negócio, com uma dependência técnica dura (§6).

---

## 0 · Correção de premissa do enunciado

O prompt afirma *"D1, D2 e D3 permanecem DEFINIDAS"*. **D3 não está definida.**

A FV-DOM-013 concluiu `DECISÃO DE NEGÓCIO — NÃO INFERÍVEL DO CÓDIGO` e nenhum valor foi aprovado depois disso. `FV-ESTADO-COMPACTADO.md` §1 registra D3 como `PENDENTE`.

Isso não é detalhe formal: **D4 depende de D3** para produzir qualquer número (§6).

Estado real: **D1 DEFINIDA · D2 DEFINIDA · D3 PENDENTE · D4 em análise · D5 PENDENTE**.

---

## 1 · Inventário das superfícies

### Calculam indicadores

| # | Superfície | Motor | Premissas | Natureza |
|---|---|---|---|---|
| 1 | `POST /:id/financeiro/calcular` | **contrato V1** | TMA 10 % · fracionário · inflação de entrada | cálculo atual — **autoridade candidata** |
| 2 | `POST /api/engenharia/fv` | `fluxoCaixa` | infl. 8 % · TMA 6 % · inteiro | cálculo atual — **órfã** (0 consumidores) |
| 3 | `POST /api/projeto/simular` | `simularFinanceiroLocal` | infl. 8 % · TMA 10 % · **sem degradação** | cálculo atual — usada por `SimulacaoFV` |
| 4 | `POST /api/financeiro/simular` | `simulacaoOM` | infl. 8 % · TMA 10 % · O&M 1 % · fator 0,2/1,5 | cálculo atual — usada por `SimulacaoFinanceira` |
| 5 | `dimensionamentoFV` | `dimensionamentoRetorno` | infl. 6 % · TMA 10 % · **economia média** | cálculo atual — dimensionamento e funil |
| 6 | `POST /api/proposta/gerar` | inline | **sem inflação, sem degradação** | cálculo atual — **PDF assinado** |
| 7 | `POST /api/bess/dimensionar` | inline | sem inflação · arredondado | cálculo atual |
| 8 | `decisaoController` | consome | — | decisão automatizada |
| 9 | `CentroFinanceiroFV` (aba FV) | `financeiroEngine` | inflação **0 %** por default · sem VPL | cálculo atual — no navegador |

### Exibem sem calcular

`PropostaEnterprise` · `RecomendacaoFinal` · `PainelExecutivo` · `PropostaPublica` · `E8Orcamento` · `ProjetosFVDetalhes` · `gerarPdfComercial` · `gerarPdfSimulacao` · `gerarPropostaPDF` · `ComparacaoBESS`.

### Histórico congelado

| Superfície | Congela indicadores? | Consequência para D4 |
|---|---|---|
| **`Baseline`** (agregado) | **NÃO** — só itens, quantidades, valores unitários e condições | **não é afetada por D4** |
| `governanca.snapshot_financeiro` | **SIM** — pacote completo (retorno, margem, financiamento) | histórico imutável; leitura por `ComparadorRevisoes`, `DashboardComercial`, `DocumentCenter` |
| `ProjetoFV.orcamento` / `.financeiro` (legado) | **SIM** — `irr_pct`, `npv_r`, `payback_anos` | derivados persistidos (INV-58 violado no legado) |

**Que a Baseline não congele indicadores é o achado que mais reduz o risco de D4**: nenhum contrato assinado tem, no agregado canônico, um payback ou VPL que uma mudança de motor pudesse contradizer.

---

## 2 · Divergências medidas contra o contrato V1

Caso R$ 80 000 · 18 000 kWh/ano · R$ 0,98 · inflação 8 % (única em que os motores são comparáveis).

| Superfície | Payback | VPL | Divergência |
|---|---|---|---|
| **Contrato V1** | **4,05** | **R$ 227 214** | referência (TMA 10 %, fracionário) |
| `fluxoCaixa` | 5 | R$ 412 646 | payback +0,95 a · **VPL +82 %** (TMA 6 %) |
| `dimensionamentoFV` | 2,2 | R$ 173 320 | payback **−1,85 a** (economia média, infl. 6 %) |
| PDF comercial | 4,5 | — | payback +0,45 a |
| `bessController` | 5 | — | payback +0,95 a |
| aba Financeiro FV | 4,58 | não calcula | payback +0,53 a (inflação 0 %) |

### Onde a divergência do PDF explode

| Projeto | Contrato V1 | PDF comercial | Diferença |
|---|---|---|---|
| R$ 120 000 / 6 100 kWh | 12,54 a | 19,7 a | **+7,2 a (57 %)** |
| R$ 200 000 / 5 100 kWh | 19,01 a | 39,2 a | **+20,2 a (106 %)** |

O erro do PDF **cresce com o prazo**, porque ele ignora inflação e degradação. Em projeto marginal — justamente onde o cliente mais precisa de precisão — ele **dobra** o payback.

Direção do erro: o PDF é **conservador** (promete menos). Isso reduz o risco jurídico, mas significa que propostas foram perdidas com um número pior que o real.

---

## 3 · As cinco categorias

| # | Categoria | Situação | Afetada por D4? |
|---|---|---|---|
| 1 | **Novos cálculos** | 9 superfícies, 6 motores | **sim** — é o alvo |
| 2 | **Propostas editáveis** | orçamento em elaboração; recalculam a cada abertura | **sim** — passariam a mostrar o número do contrato |
| 3 | **Propostas emitidas** | PDF gerado, orçamento `EMITIDO` | **só se reprocessadas** |
| 4 | **Propostas históricas** | PDFs entregues a clientes | **não** — arquivos estáticos, fora do sistema |
| 5 | **Baselines congeladas** | agregado `Baseline` | **não** — não contém indicadores |

**Quantidade em produção: não levantada.** Exige acesso ao banco, que a sprint proíbe. O que se sabe estruturalmente: 588 projetos FV, 18 com subdoc legado (7 com conteúdo), e `cotacaos`/`orcamentos`/`baselines` inexistentes em produção — ou seja, **o fluxo canônico ainda não emitiu nenhuma proposta lá**.

Isso torna o risco histórico de D4 **muito menor do que parecia**: não há base canônica de propostas emitidas para contradizer.

---

## 4 · Matriz das opções

### A · Autoridade única para todos os novos cálculos e PDFs

| | |
|---|---|
| **Impacto** | 6 motores → 1. Payback e VPL passam a ter um único valor por projeto |
| **Muda números** | sim, em 9 superfícies — PDF até **+106 %** no payback de projetos longos |
| **Histórico** | intocado (nada é reprocessado) |
| **Custo** | alto — migrar 6 superfícies, cada uma com consumidores próprios |
| **Risco** | duas propostas do mesmo cliente, antes e depois, com números diferentes e sem explicação |
| **Bloqueio** | **exige D3** (§6) |

### B · Manter múltiplas autoridades

| | |
|---|---|
| **Impacto** | nenhum — status quo |
| **Muda números** | não |
| **Histórico** | intocado |
| **Custo** | zero imediato; permanente em manutenção e em erro |
| **Risco** | **o mesmo projeto continua valendo 2,2 ou 5 anos conforme a tela**; PDF segue com até 106 % de erro |
| **Bloqueio** | nenhum |

### C · Motor canônico só para documentos novos, histórico integralmente preservado

| | |
|---|---|
| **Impacto** | novos cálculos convergem; documentos antigos ficam como estão |
| **Muda números** | sim, a partir da data de adoção |
| **Histórico** | **preservado por construção** — nada reprocessado, nada recalculado |
| **Custo** | mesmo de A, distribuído; permite migrar superfície por superfície |
| **Risco** | período de convivência com dois números — mitigável pelo carimbo de versão |
| **Bloqueio** | **exige D3** (§6) |

**A e C só diferem no tratamento do histórico.** Como nem a Baseline congela indicadores nem existe base canônica emitida em produção, a diferença prática entre elas hoje é pequena — C é A com uma garantia explícita a mais.

---

## 5 · Recomendação técnica

**Opção C**, com migração por superfície e carimbo de versão em cada documento emitido.

Fundamento medido, não preferência:

1. **B é insustentável.** Não é divergência de convenção — é o mesmo projeto valendo 2,2 ou 5 anos conforme a tela, e um PDF que erra 106 % no payback de projetos longos. Manter isso é manter um defeito conhecido em documento assinado.
2. **C custa o mesmo que A e entrega mais.** A garantia de não tocar o histórico é explícita, não implícita.
3. **O risco histórico é menor do que a auditoria original sugeria** — Baseline não congela indicadores, e produção não tem propostas canônicas emitidas.
4. **Ordem sugerida por risco decrescente:** PDF comercial (maior erro, documento assinado) → `decisaoController` (decisão automatizada) → aba Financeiro FV → simulações → BESS → `dimensionamentoFV` (usado no funil, maior superfície).

Sobre propostas já emitidas: **não reprocessar**. Marcar a versão a partir da qual o motor canônico vale e tratar documentos anteriores como não reproduzíveis — eles não têm `motor_versao` nem `premissas.versao`, então não há como recalculá-los fielmente de qualquer forma.

---

## 6 · Dependência dura: D4 não pode ser implementada antes de D3

O contrato V1 exige inflação como premissa de entrada. Com **D3 pendente**, ele hoje devolve:

```
lacunas: ['inflacao_energia_aa_pct']
payback: null · vpl: null · economia: null
```

**Adotar o motor canônico como autoridade dos PDFs hoje faria todo PDF sair com "—" em vez de número.** Não porque o motor esteja errado — porque a premissa que ele exige ainda não foi decidida.

Consequência para o sequenciamento: D4 pode ser **aprovada** agora, mas só é **implementável** depois de D3.

---

## 7 · Decisão de negócio necessária

```
D4 — autoridade financeira

  [ ] A · autoridade única, todos os novos cálculos e PDFs
  [ ] B · manter múltiplas autoridades (status quo)
  [ ] C · autoridade para documentos novos, histórico preservado   ← recomendação técnica

  Propostas já emitidas:
  [ ] não reprocessar (recomendado)    [ ] reprocessar as ainda não assinadas
```

O que **não** é decisão de negócio e já está resolvido: os 18 valores fabricados foram removidos (FV-DOM-011B) e o descasamento de nomes do `gerarPdfComercial` foi corrigido (FV-DOM-011C). Nenhum PDF inventa número hoje.

---

**Nenhuma decisão tomada. Código, PDFs, banco e histórico intocados. D5 permanece PENDENTE. Sem commit.**
