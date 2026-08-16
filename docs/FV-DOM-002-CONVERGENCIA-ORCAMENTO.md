# FV-DOM-002 — Convergência para o Novo Domínio Comercial

**Data:** 2026-08-07
**Resultado:** o Core do Projeto FV opera sobre `Cotacao` / `Orcamento` / `Baseline`.
`ProjetoFV.orcamento` permanece **apenas como ponte de compatibilidade**, sem papel operacional.

---

## 1. Auditoria — consumidores reais do subdocumento

A varredura por `.orcamento` devolve muito ruído. Três coisas diferentes usam esse nome:

| O que é | Exemplos | É o subdoc? |
|---|---|---|
| `ProjetoFV.orcamento` (subdoc legado) | `salvarEtapa`, `ProjetosFVDetalhes:172` | **sim** |
| `ProjetoEV.orcamento` (outro agregado) | `NovaPropostaEV`, `ProjetosEVDetalhes`, `projetosEVController` | não — fora de escopo |
| `resultadoFinanceiro.orcamento` (saída do motor) | `engenhariaGovernanca:329-382`, `CentroFinanceiroFV:133`, `PropostaEnterprise:66`, `financeiroEngine:400` | não — é retorno de cálculo |

Consumidores **reais** do subdoc, antes desta sprint:

| # | Local | Tipo | Situação |
|---|---|---|---|
| C-1 | `projetosFVController.js:693` — `case 'orcamento': $set.orcamento = dados` | **escrita** | migrado |
| C-2 | `projetosFVController.js:645` — `'orcamento'` na lista de etapas permitidas | escrita | mantido (a etapa continua existindo) |
| C-3 | `models/ProjetoFV.js:977` — definição do campo | schema | mantido por exigência da sprint |
| C-4 | `ProjetosFVDetalhes.jsx:172` — `orc?.preco_venda_r`, `orc?.custo_total_r` | leitura | atendido pelo adapter |
| C-5 | `engenhariaGovernanca.js:487` — `projeto?.orcamento?.itens_adicionais` | leitura | atendido pelo adapter |
| C-6 | `CrmProjetos.jsx:86,95` — `p.orcamento?.resumo?.preco_final` | leitura | **campo inexistente** — ver §5 |

Campos reais do `orcamentoV3Schema` (23): `custo_total_r`, `custo_equipamentos_r`, `custo_mao_obra_r`, `custo_outros_r`, `margem_pct`, `preco_venda_r`, `irr_pct`, `npv_r`, `payback_anos`, `payback_meses`, `economia_mensal_r`, `economia_anual_r`, `economia_25anos_r`, `co2_evitado_t`, `tarifa_kwh`, `reajuste_anual_pct`, `calculado_em`, `modo`, `kit`, `itens_adicionais`, `total_material_r`, `total_servicos_r`, `total_venda_r`.

---

## 2. Implementação

### Duas costuras, mesmo padrão de S1.5/S3/S4B

| Módulo | Papel |
|---|---|
| [`dominio/orcamento/converterEtapaOrcamento.js`](../backend/src/dominio/orcamento/converterEtapaOrcamento.js) | **escrita** — traduz o payload legado (kit/detalhado) em itens tipados do agregado |
| [`dominio/orcamento/obterOrcamentoProjeto.js`](../backend/src/dominio/orcamento/obterOrcamentoProjeto.js) | **leitura** — projeta o agregado de volta na forma legada que a UX espera |

Ambos são domínio puro: sem I/O, sem Mongoose.

### Write path

`PUT /:id/etapa` (etapa `orcamento`) passou a chamar `OrcamentoService.gravarEtapaOrcamento`:

1. resolve o orçamento **vigente** (aprovado manda; senão o mais recente em elaboração);
2. reaproveita a Cotação dele — ou **sintetiza uma** a partir do estado técnico do projeto;
3. se o vigente está editável → **atualiza**; se está travado → **cria um novo** (INV-ORC-2).

Salvar não é emitir: reenviar a etapa não gera orçamentos em série.

### Read path

`GET /:id` devolve `orcamento` derivado do agregado, na forma legada, com `origem: 'agregado'` para proveniência (M-3). Projeto histórico sem agregado devolve o subdoc como está.

### O que o tradutor deliberadamente NÃO copia

- **Totais** (`total_venda_r` etc.) — no modelo novo são derivados dos itens (INV-58). Copiá-los criaria duas verdades divergentes.
- **Indicadores financeiros** (`irr_pct`, `npv_r`, `payback_anos`, economias, CO₂) — não pertencem ao Orçamento em forma alguma; são saída do motor financeiro. O adapter os **repassa do legado** quando existem, nunca os inventa.

---

## 3. Decisão de projeto: a Cotação sintetizada

O agregado `Orcamento` exige `cotacao_ref` (M-1: Orçamento → Cotação). **O wizard não cria Cotação** — ele salta do dimensionamento direto para o orçamento.

Três saídas possíveis:

| Opção | Custo |
|---|---|
| tornar `cotacao_ref` opcional | quebraria M-1 e a regra central da FV-DOM-001 |
| alterar a UX para criar Cotação | proibido nesta sprint |
| **sintetizar a Cotação no Core** | escolhida |

`cotacaoDoProjeto()` monta a Cotação a partir do que o projeto já tem (consumo, tarifa, HSP, área, tipo de sistema), marcada nas observações como sintetizada. Preserva a regra de domínio sem tocar em React. Quando a UX ganhar a etapa Cotação, a síntese deixa de ser necessária.

---

## 4. Validação

[`convergenciaOrcamento.check.js`](../backend/src/dominio/__checks__/convergenciaOrcamento.check.js) — **31/31 asserções**:

```bash
node backend/src/dominio/__checks__/convergenciaOrcamento.check.js
```

| Exigência | Comprovação |
|---|---|
| Fluxo comercial usa os agregados | etapa grava `Cotacao` + `Orcamento`; aprovação gera `Baseline` |
| Dependência funcional do legado eliminada | **zerar `projeto.orcamento` não altera a resposta do GET** |
| Zero consumidores novos | única escrita restante está marcada `@deprecated` |
| Ausência de regressão | projeto histórico sem agregado continua legível |
| Histórico preservado | aprovar + salvar de novo → 2 orçamentos, aprovado intacto, Baseline inalterada |

A prova mais direta é a inversão: apagar o subdocumento e a leitura continuar correta (R$ 25.800, `origem: 'agregado'`).

| Regressão | Resultado |
|---|---|
| `node --check` backend + boot | ✓ |
| `lme.check.js` · `estadosFV.check.js` · `fluxoCanonico.check.js` | ✓ |
| `instalacaoRefEtapa.check.js` | 5 falhas — pré-existente, inalterado |
| Build frontend + suíte | idêntica ao baseline (25 falhas pré-existentes) |

---

## 5. Consumidores remanescentes — remoção em FV-DOM-003

| # | Local | O que fazer |
|---|---|---|
| **R-1** | `projetosFVController.js:693` — `$set.orcamento = dados` | remover o `case`; a etapa passa a gravar só o agregado. Já marcado `@deprecated`. |
| **R-2** | `models/ProjetoFV.js:977` — campo `orcamento` + `orcamentoV3Schema` | remover do schema **após** backfill dos projetos históricos |
| **R-3** | `ProjetosFVDetalhes.jsx:172` — lê `orc?.preco_venda_r` / `orc?.custo_total_r` | passar a ler do agregado (ou dos indicadores derivados) |
| **R-4** | `engenhariaGovernanca.js:487` — lê `orcamento?.itens_adicionais` | passar a ler `Orcamento.itens` |
| **R-5** | `obterOrcamentoProjeto.js` — o adapter inteiro | remover junto com o subdoc; a resposta passa a ser a forma nova |
| **R-6** | `CrmProjetos.jsx:86,95` — `p.orcamento?.resumo?.preco_final` | **já é código morto**: `resumo` não existe no schema. Remover o fallback. |

**Pré-condição de R-2:** os projetos históricos (sem agregado) precisam de backfill para `Cotacao`/`Orcamento`, senão perdem o orçamento na remoção. Isso é responsabilidade do **LME** (ADR-022), não do Core.

---

## 6. Achados registrados

**A-1 — `CrmProjetos` lê um campo que não existe.** `p.orcamento?.resumo?.preco_final`: não há `resumo` no `orcamentoV3Schema`. O fallback sempre resulta `null`; o valor exibido vem inteiramente de `p.financeiro?.custo_total_r`. Código morto desde que foi escrito. Não corrigi — é UX, fora do escopo desta sprint.

**A-2 — o freeze guard não conhece o agregado novo.** `salvarEtapa` bloqueia por `governanca.freeze_status` e `governanca.comercial.workflow_status`. Aprovar um `Orcamento` **não** trava a etapa: cria-se um novo orçamento (comportamento correto por INV-ORC-2), mas as duas noções de "congelado" seguem desconectadas. Unificá-las é a F3.6 (convergência de `workflow_status`), fora deste escopo.

**A-3 — falha ao gravar o agregado não desfaz a etapa.** O bloco de convergência é tolerante a erro: registra no log e segue, porque a ponte legada continua válida. É deliberado enquanto o legado existe. Em FV-DOM-003, com a ponte removida, a falha precisa passar a ser fatal.

---

**Nada commitado.**
