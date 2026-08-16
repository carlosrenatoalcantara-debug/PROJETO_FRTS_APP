# FV-DOM-011 — Consolidação dos caminhos financeiros restantes

**Data:** 2026-08-15
**Natureza:** arquitetura. Nenhuma fórmula, premissa ou resultado alterado.
**Resultado:** os oito caminhos estão consolidados. **Zero cópias vivas.** D1–D5 continuam PENDENTES — verificado por check.

---

## Fase 1 · Auditoria

### Caminho 7 — `controllers/financeiroController.js` (120 linhas)

| | |
|---|---|
| Rota | `POST /api/financeiro/simular` (com `protegerModulo('financeiro')`) |
| Consumidor | `pages/SimulacaoFinanceira.jsx` — **vivo** |
| Funções | `calcularTIR` (privada) · `simularFinanceiro` (handler) |
| Dependências | nenhuma — só `Math` |
| Motor compartilhável | o corpo do laço de fluxo de caixa |
| Adapter | leitura do body, validação de `investimento`, `res.json` |
| **Duplicação** | **`calcularTIR` é CÓPIA LITERAL** da já consolidada em `fluxo-caixa` |

### Caminho 8 — `services/dimensionamentoFV.js` (404 linhas)

| | |
|---|---|
| Consumidores | `dimensionamentoController`, `projetoFVFunilController` — **vivos**; ambos usam só `dimensionarFV` |
| Dependências | `data/irradianciaRN.js` (técnica, não financeira) |
| Motor compartilhável | `calcularEconomiaAnual`, `calcularCustoSistema`, `calcularEconomia25Anos`, `calcularPayback`, `calcularVPL`, `calcularTIR` |
| Específico do service | irradiância, potência kWp, geração, módulos, área, `dimensionarFV` |
| **Duplicação** | **nenhuma** — fórmulas e premissas próprias |

O arquivo é **misto**: dimensionamento técnico + retorno financeiro, unidos por três constantes (`ANOS_PROJETO`, `DEGRADACAO_ANUAL_PCT`, `DEFAULTS`).

---

## Fase 2 · Consolidação

```
packages/fv-shared/financeiro/
├── financeiroEngine.js        (FV-DOM-009)
├── regulatorioBR.js           (FV-DOM-009)
├── fluxoCaixa.js              (FV-DOM-009)
├── dimensionamentoRetorno.js  ← NOVO — 6 funções do caminho 8
└── simulacaoOM.js             ← NOVO — motor do caminho 7
```

| Antes | Depois |
|---|---|
| `financeiroController` com motor inline + cópia da TIR | **adapter fino** (24 linhas úteis): body → validação → delega → `res.json` |
| `dimensionamentoFV` com bloco financeiro embutido | importa do pacote e **re-exporta**; 404 → 330 linhas |
| `ANOS_PROJETO` / `DEGRADACAO_ANUAL_PCT` definidos no service | definidos no pacote, importados de volta — **uma fonte** |
| `DEFAULTS` com 7 chaves literais | `{ perdas, margem, simultaneidade, ...DEFAULTS_FINANCEIROS }` — mesma forma, mesmos valores |

A superfície pública do service foi **integralmente preservada**: os 14 nomes do `export default` e os exports nomeados continuam existindo. Os consumidores não foram tocados.

### O que foi mantido separado, e por quê

| Caminho | Motivo |
|---|---|
| `dimensionamentoRetorno` | premissas próprias (inflação **6 %**, desconto **10 %**) e **fórmula própria de payback** — economia média, não acumulada (R12). Não é cópia de nada |
| `simulacaoOM` | único com **O&M 1 % a.a.**, **crescimento de consumo 2 % a.a.** e **fator de cenário 0,2 / 1,5** (R13) |
| `simularFinanceiroLocal` (`projetoController`) | sem degradação, desconto 10 % — FV-DOM-009 já registrou |
| `propostaComercialService` · `bessController` | paybacks inline divergentes; unificar depende de D4 |

**Cinco motores nomeados e localizados, nenhum unificado à força.**

---

## Fase 3 · Prova de equivalência

`financeiroRestante.check.js` reconstrói ambos os caminhos do `git HEAD` e compara valor a valor.

| Seção | Cobertura | Resultado |
|---|---|---|
| 1 · payback / VPL / TIR do dimensionamento | 11 casos | ✓ |
| 2 · economia anual e custo do sistema | 8 casos | ✓ |
| 3 · defaults e constantes | 4 | ✓ |
| 4 · pipeline `dimensionarFV` completo | 4 casos | ✓ |
| 5 · resposta do controller | 10 casos | ✓ |
| 6 · **erros equivalentes** | 5 casos (400 e 500) | ✓ |
| 7 · prova da cópia literal da TIR | **280 combinações** | ✓ |

Casos incluídos deliberadamente: custo zero e negativo, geração zero, tarifa zero, investimento minúsculo (**TIR > 150 % → `null`**), investimento gigante (não converge), valores fracionários, horizonte 1 e 10 anos, cenário desconhecido, investimento como string, body ausente.

### Dois falsos positivos que investiguei antes de aceitar

1. **`dimensionarFV` divergia em 3 de 4 casos.** Causa: eu havia neutralizado o import de irradiância com stub na referência. O caso que passava era justamente o que informava a irradiância explicitamente. Corrigido apontando a referência para o arquivo real de dados — **artefato do harness, não regressão**.

2. **Restou 1 divergência.** Diffei campo a campo: `metadados.calculado_em`, **9 ms de diferença**. É carimbo de tempo — o item E3 do contrato V1 (metadado, não resultado). Comparar isso testaria o relógio. Passou a ser ignorado, como já era no check da FV-DOM-009.

Nenhuma implementação original foi removida antes da prova.

---

## Fase 4 · Divergências preservadas

Seção 8 do check — falha se algum destes convergir:

```
✓ payback por economia média continua 9,7 — R12 preservado
✓ payback acumulado continua 13,71
✓ D1 ABERTA — a média segue subestimando o acumulado
✓ R13 preservado — fator de cenário ainda muda o payback (14 × 3)
✓ VPL a 6 % intacto (D2)      ✓ VPL a 10 % intacto (D2)
✓ TIR acima de 150 % continua devolvendo null (E7/D2 abertas)
✓ inflação continua 6 % (D3 aberta)
```

Inflação, taxa de desconto, degradação, payback, VPL, TIR, cenário regulatório, sazonalidade e comportamento nos extremos: **todos intactos**.

---

## Fase 5 · Check permanente

`financeiroRestante.check.js` — 11 seções. Além da equivalência e das divergências, prova:

- **ausência de cópia viva**: o controller não redefine TIR nem contém `custoOMAnual`; o service não redefine `calcularPayback`/`calcularVPL`/`calcularEconomia25Anos`, não duplica constantes e compõe `DEFAULTS` da fonte única;
- **consumidores corretos**: ambos importam do pacote;
- **superfície pública**: os 8 nomes críticos seguem no `export default`;
- **pureza**: sem DOM, Express, Mongoose, `process.env`, `req.body` ou `res.json` nos módulos do pacote.

---

## Regressão

| Verificação | Resultado |
|---|---|
| `financeiroRestante.check.js` | ✓ ~70 asserções |
| Backend carrega | ✓ `financeiroController`, `dimensionamentoFV`, `dimensionamentoController`, `projetoFVFunilController` |
| Build frontend | ✓ 2396 módulos |
| Suíte frontend | **idêntica ao baseline** — 25 falhas em 6 arquivos, 973 testes |
| Demais checks | 11 de 12 ✓ |
| Banco · UX · PDFs · LME · produção | intocados |

A falha remanescente é `instalacaoRefEtapa.check.js` (`TENANT_AUSENTE`) — pré-existente desde a FV-UX-015.

---

## Inventário final

| # | Caminho | Situação |
|---|---|---|
| 1 | `financeiroEngine` | ✅ pacote |
| 2 | `fluxoCaixa` | ✅ pacote |
| 3 | `propostaComercialService` | ⏸ payback inline — D4 |
| 4 | `bessController` | ⏸ payback inline — decisão |
| 5 | `projetoController.simularFinanceiroLocal` | ⏸ cálculo próprio — D1/D2 |
| 6 | `regulatorioBR` | ✅ pacote |
| 7 | `financeiroController` | ✅ pacote (adapter fino) |
| 8 | `dimensionamentoFV` | ✅ pacote (bloco financeiro) |

**Cópias vivas eliminadas: 2** (as duas cópias literais da TIR — `projetoController` na FV-DOM-009, `financeiroController` aqui).
**Implementações divergentes: 5**, todas nomeadas, localizadas e cercadas por check.

Os caminhos 3, 4 e 5 são expressões inline de uma ou duas linhas dentro de handlers, com fórmulas divergentes. Consolidá-los sem decidir D1/D4 disfarçaria a divergência de arquitetura — por isso ficam.

---

## Próximos passos

1. **`FV-ESTADO-COMPACTADO.md`** — ainda ausente (FV-DOM-010 §0.1).
2. **Aprovar D1–D5.**
3. **FV-DOM-012** — contrato V1 executável: adapter de domínio + `POST /:id/financeiro/calcular`. Depende de D1, D2, D3.
4. **FV-UX-017** — aba Financeiro na nova UX.
5. **FV-DOM-013** — absorver caminhos 3, 4 e 5. Depende de D4.

---

**Nenhuma fórmula ou premissa alterada. D1–D5 PENDENTES. Banco, UX, PDFs e LME intactos. Sem commit.**
