# FV-DOM-009 — Consolidação dos motores financeiros

**Data:** 2026-08-15
**Natureza:** arquitetura. Nenhuma fórmula, premissa, default ou resultado alterado.
**Resultado:** os motores puros passam a viver em um só lugar; uma cópia literal foi eliminada. **D1–D5 continuam abertas** — e isso é verificado por check.

---

## O que foi consolidado

```
packages/fv-shared/financeiro/
├── financeiroEngine.js   424 linhas  ← movido de frontend/src/utils/
├── regulatorioBR.js      269 linhas  ← movido de frontend/src/utils/ (Lei 14.300)
└── fluxoCaixa.js         ~110 linhas ← EXTRAÍDO de backend/controllers/engenhariaController.js
```

| Caminho | Antes | Depois |
|---|---|---|
| `financeiroEngine` | só no frontend | pacote · frontend re-exporta |
| `financeiroRegulatorioBR` | só no frontend | pacote · frontend re-exporta |
| `engenhariaController` | motor anônimo dentro do controller | importa `calcularFluxoCaixa` do pacote |
| `projetoController.calcularTIRLocal` | **cópia literal** | **eliminada** — usa a função compartilhada |
| `projetoController.simularFinanceiroLocal` | — | **preservado intacto** |
| `propostaComercialService` · `bessController` | payback inline | **não tocados** |

O frontend ficou com dois shims de re-export. Wizard, `CentroFinanceiroFV`, `comercialEngine` e `engenhariaGovernanca` seguem funcionando — agora executando o **mesmo arquivo** que o servidor, não uma cópia capaz de divergir.

---

## A cópia literal, e como foi provada antes de sumir

`projetoController.calcularTIRLocal` era `calcularTIR` do `engenhariaController` com outro nome: mesmo intervalo `[−0,99 ; 10]`, mesmas 300 iterações, mesma tolerância `|NPV| < 0,5`, mesmo retorno.

Não bastou parecer igual. O check compara as **duas versões originais reconstruídas do `git HEAD`** sobre **280 combinações** de investimento (R$ 1 000 → R$ 500 000) × economia (R$ 500 · 5 000 · 17 640 · 90 000). Zero divergências. Só então a cópia foi removida.

### O que NÃO foi unificado, e por quê

`simularFinanceiroLocal` **parece** o `calcularFluxoCaixa`, mas:

- não aplica degradação;
- desconta a **10 %**, contra 6 % do outro;
- devolve outro shape (`payback`, sem `paybackDescontado`).

**É outro cálculo, não outra cópia.** Fundir os dois mudaria o VPL da tela de simulação em 69 % — exatamente a decisão D2, que não é desta sprint.

O mesmo vale para os paybacks inline de `propostaComercialService` e `bessController`: divergem por fórmula, não por duplicação. Movê-los sem decidir D1/D4 seria disfarçar a divergência de arquitetura.

---

## A prova de que nenhum número mudou

`financeiroConsolidacao.check.js` reconstrói os três motores como estavam **antes desta sprint** (`git show HEAD:…`, com o import sem extensão corrigido para carregar em Node) e compara **valor a valor**, sem tolerância — comparação profunda que trata `NaN` e `−0`.

| Seção | Casos | Resultado |
|---|---|---|
| 1 · retorno / payback / TIR | 11 | ✓ |
| 2 · TIR isolada | 6 fluxos | ✓ |
| 3 · custos, modos, margem | 10 | ✓ |
| 4 · financiamento e parcelamento | 8 | ✓ |
| 5 · pacote completo | 4 | ✓ |
| 6 · fluxo de caixa do backend | 7 + 6 | ✓ |
| 7 · prova da cópia literal | 280 combinações | ✓ |
| 8 · Lei 14.300 | 5 cenários + 9 anos + tabelas | ✓ |

A malha inclui deliberadamente os casos que costumam esconder regressão: projeto que **não se paga** em 25 anos, TIR **acima do intervalo de busca** (devolve `null`), investimento zero, geração zero, tarifa negativa, entradas não numéricas, markup negativo com desconto acima de 100 %, entrada que cobre todo o financiamento e parcelas fracionárias.

Único campo ignorado na comparação: `calculado_em`, que é carimbo de tempo — metadado, não resultado.

---

## A verificação que impede decisão silenciosa

A seção 9 do check existe para um risco específico: uma sprint de arquitetura "arrumar" uma divergência de passagem.

```
✓ payback fracionário preservado (8.56)
✓ payback inteiro preservado (9)
✓ D1 continua ABERTA — os dois seguem discordando
✓ default de inflação do front continua 0 % (D3 aberta)
✓ taxa de desconto do back continua 6 % (D2 aberta)
✓ premissas do regulatório continuam 5 % / 2 %
```

**Se algum desses passar a coincidir, o check falha.** A convergência dos motores deixou de poder acontecer por acidente: exige decisão explícita.

Pela mesma razão, dois defeitos conhecidos foram **preservados de propósito**:

- **R10** — a sazonalidade do motor regulatório é inerte (`pesosGer` é calculado e nunca usado). Corrigir mudaria resultado.
- **R2** — a TIR do frontend devolve `null` acima de 200 % a.a.; a do backend satura em 1000 %. Ambas intactas.

### A única mudança de código além de mover

O import de `financeiroEngine` dentro do motor regulatório ganhou a extensão `.js` (R11). Sem ela o módulo resolve no Vite e **quebra em Node ESM puro** — era condição para o backend conseguir carregá-lo. Não altera comportamento algum; o check confirma resultados idênticos.

---

## Regressão

| Verificação | Resultado |
|---|---|
| `financeiroConsolidacao.check.js` | ✓ ~110 asserções |
| Controllers do backend carregam | ✓ `engenhariaController`, `projetoController` |
| Build frontend | ✓ 2396 módulos |
| Suíte frontend | **idêntica ao baseline** — 25 falhas em 6 arquivos, 973 testes |
| Demais checks de backend | 9 de 10 ✓ |
| Banco · UX · PDFs · produção | intocados |

A falha remanescente é `instalacaoRefEtapa.check.js` (`TENANT_AUSENTE`) — pré-existente, registrada desde a FV-UX-015.

---

## Estado do inventário

| Caminho | Situação |
|---|---|
| `financeiroEngine` | ✅ consolidado no pacote |
| `financeiroRegulatorioBR` | ✅ consolidado no pacote |
| `engenhariaController` (fluxo de caixa) | ✅ extraído para o pacote |
| `projetoController.calcularTIRLocal` | ✅ cópia eliminada |
| `projetoController.simularFinanceiroLocal` | ⏸ preservado — aguarda D1/D2 |
| `propostaComercialService` | ⏸ preservado — aguarda D4 |
| `bessController` | ⏸ preservado — aguarda decisão |

**Cópias vivas: zero.** Implementações divergentes: as mesmas de antes, agora nomeadas, localizadas e cercadas por check.

---

## Próximos passos

1. **D1–D5** — decisões de negócio (FV-DOM-008A).
2. **FV-DOM-010** — adapter de domínio + `POST /:id/financeiro/calcular`, implementando o `FinancialCalculationContract v1`. Depende de D1, D2, D3.
3. **FV-UX-017** — aba Financeiro na nova UX.
4. **FV-DOM-011** — absorver `simularFinanceiroLocal`, `propostaComercialService` e `bessController`. Depende de D4.

---

**Nenhuma fórmula, premissa, default ou resultado alterado. Banco, UX, PDFs e produção intocados. Sem commit.**
