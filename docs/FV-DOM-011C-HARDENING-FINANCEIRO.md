# FV-DOM-011C — Hardening financeiro pré-contrato

**Data:** 2026-08-15
**Natureza:** correções técnicas determinadas. **Nenhuma fórmula, premissa ou número alterado.**
**D1–D5:** `PENDENTE` — verificado por check.

---

## E3 · `calculado_em`

**Problema:** `calcularFinanceiroCompleto` e `dimensionarFV` gravavam `new Date()` no meio do resultado, impedindo comparar duas execuções diretamente.

**Correção:** o instante virou **injetável** (`agora` / `input.agora`), com `new Date()` apenas como fallback.

**Provado:**

- dois carimbos com **dez anos** de diferença produzem resultados idênticos em todo o resto;
- resultado idêntico ao `HEAD` quando o carimbo é ignorado;
- o hash da Baseline é determinístico e **não inclui** `calculado_em` — o check demonstra que incluí-lo mudaria o hash, que é exatamente o motivo de ele ficar fora.

---

## E7 · TIR com estado de convergência

**Problema:** três motores escondiam não-convergência de três formas distintas — `null` mudo, teto de 1000 % devolvido como resultado, e `null` acima de 150 %. Indistinguíveis de um cálculo bem-sucedido.

**Correção:** `calcularTIRDetalhado` passou a ser a **fonte única** em cada motor, devolvendo `{ valor, convergiu, motivo, intervalo_busca }`. `calcularTIR` permaneceu como camada de compatibilidade, retornando exatamente o mesmo número de antes.

**Uma implementação por motor** — o check conta os laços de bisseção: 1 em cada.

| Situação | Antes | Agora |
|---|---|---|
| Convergiu | valor | valor + `convergiu: true` |
| Acima do intervalo | `null` ou teto | mesmo valor + `motivo: 'fora_do_intervalo'` |
| Fluxo nunca positivo | `null` | `null` + `motivo: 'fluxo_nunca_positivo'` |
| Iterações esgotadas | valor | mesmo valor + `motivo: 'iteracoes_esgotadas'` |

**Nenhum número mudou** — 7 fluxos × 2 motores comparados contra o `HEAD`, incluindo o caso saturado, cujo valor continua sendo `10` (1000 %). O que mudou foi passar a **dizer** que aquilo é o teto da busca, não a TIR.

Comportamento de negócio nos extremos **não foi decidido** — o valor segue como estava; apenas ganhou rótulo.

---

## R6 · PDF comercial

**Problema:** `gerarPdfComercial` lia `paybackAnos`, `roi25Anos`, `paybackDescontado`, `economiaAnual`, `custoTotalEstimado` e `taxaDesconto`; `/api/projeto/simular` responde `payback`, `tir`, `vpl`, `fluxo_caixa`. O PDF imprimia `undefined`.

**Correção:** mapeamento explícito dos nomes reais, com ausência virando `—`.

**Sem fallback numérico.** Nenhuma fórmula ou premissa tocada — o PDF apenas passou a ler os campos certos e a admitir que não tem o dado quando não tem.

---

## R10 · Sazonalidade

**Auditoria:** `calcularRetornoRegulatorio` aceitava `geracaoMensalKwh`/`consumoMensalKwh`, chamava `normalizarPesos` e **descartava o resultado** (`pesosGer` nunca era lido). O cálculo era anual.

**Prova de que era morto:** o check executa o motor do `HEAD` **com** e **sem** o array de sazonalidade e compara — resultado idêntico. O parâmetro não fazia nada.

**Decisão:** removido o parâmetro e o helper. A fórmula pretendida **não estava determinada pelo código** — só havia normalização de pesos, sem regra de aplicação —, então implementá-la seria inventar regra regulatória.

Registrado no módulo: qualquer regra real de compensação mensal depende de **D5**.

---

## Rota `/api/engenharia/fv`

**Classificação: órfã, tecnicamente preservada.**

- zero consumidores no frontend (varredura confirmada no check);
- **não removida**: o `calcularFluxoCaixa` que ela expõe é a única implementação do sistema com **VPL e payback descontado** — exatamente os indicadores que D2 vai avaliar;
- risco de manter: nulo (ninguém chama, não afeta EV);
- justificativa registrada no próprio `routes/engenharia.js`, para reavaliação quando D2 fechar.

---

## Validação

`hardeningFinanceiro.check.js` — 60 asserções contra o `git HEAD`.

| Verificação | Resultado |
|---|---|
| E3 · carimbo não altera cálculo, determinismo nem hash | ✓ |
| E7 · TIR: valores idênticos ao HEAD, estado explícito | ✓ |
| E7 · uma única implementação por motor | ✓ |
| R6 · PDF sem `undefined`, sem fallback numérico | ✓ |
| R10 · parâmetro comprovadamente morto; regulatório idêntico | ✓ |
| Rota órfã preservada e justificada | ✓ |
| Equivalência dos cálculos não afetados por D1–D5 | ✓ |
| Zero defaults financeiros artificiais | ✓ |
| Zero cópias financeiras novas | ✓ |
| **D1–D5 seguem divergindo** (payback 8,56 × 9 × 9,7; VPL 6 % × 10 %; inflação 6 %) | ✓ |

### Regressão comparada ao baseline

| | Baseline | Agora |
|---|---|---|
| Suíte frontend | 25 falhas / 6 arquivos / 973 testes | **idêntico** |
| Build | 2396 módulos | ✓ |
| Checks backend | 13 ✓ + 1 falha pré-existente | **14 ✓ + 1** (novo check somado) |
| Backend boot | — | ✓ 6 módulos carregam |

A falha remanescente é `instalacaoRefEtapa.check.js` (`TENANT_AUSENTE`), pré-existente ao `HEAD` desde a FV-UX-015.

Um segfault do vitest na primeira execução; repetido, passou — pressão de memória do runner, como nas sprints anteriores.

---

**Nenhuma alteração ficou parcialmente validada.** Fórmulas, premissas, UX, banco, LME e produção intocados. Sem commit.
