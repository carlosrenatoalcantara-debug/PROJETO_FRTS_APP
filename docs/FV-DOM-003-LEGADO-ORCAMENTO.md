# FV-DOM-003 — `ProjetoFV.orcamento` reduzido a legado

**Data:** 2026-08-07
**Resultado:** zero escrita e zero leitura funcional do subdocumento. O agregado `Orcamento` é a única fonte operacional.
**§4 (remoção do adapter):** **não executável nesta sprint** — evidência em §6.

---

## 1. Auditoria — antes

Revalidação dos consumidores identificados na FV-DOM-002. **Nenhum consumidor novo apareceu.**

| # | Local | Tipo | Detalhe |
|---|---|---|---|
| C-1 | `projetosFVController.js:694` | **escrita** | `$set.orcamento = dados` |
| C-2 | `projetosFVController.js:141` | leitura (adapter) | `obterOrcamentoProjeto(plano, orcVigente)` |
| C-3 | `ProjetosFVDetalhes.jsx:172` | leitura | `orc?.preco_venda_r`, `custo_total_r`, `margem_pct`, `tarifa_kwh`, `payback_anos` |
| C-4 | `engenhariaGovernanca.js:487` | leitura | `orcamento?.itens_adicionais` |
| C-5 | `CrmProjetos.jsx:86,95` | leitura | `orcamento?.resumo?.preco_final` — **campo inexistente** |

Adapters: `obterOrcamentoProjeto` com **1 consumidor**; `converterEtapaOrcamento` com **1 consumidor** (`OrcamentoService.gravarEtapaOrcamento`).

Falsos positivos descartados: `ProjetoEV.orcamento` (outro agregado, fora de escopo), `resultadoFinanceiro.orcamento` (saída do motor financeiro), `itensAdicionais` (variável local do E8).

---

## 2. O dado que definiu o escopo

Consulta somente-leitura à produção:

```
projetos FV total:              588
com subdoc orcamento != null:    18
com orcamento com conteúdo:       7
coleção cotacaos:        NÃO EXISTE
coleção orcamentos:      NÃO EXISTE
coleção baselines:       NÃO EXISTE
```

Dois fatos decisivos:

1. **Só 7 projetos têm orçamento legado com conteúdo real** — muito menos do que os 566 importados que eu supunha na FV-DOM-002. A superfície de risco é pequena.
2. **Os agregados nunca foram gravados em produção.** As coleções não existem. Todo projeto real está no caminho legado.

---

## 3. Implementação

### 3.1 Backend — escrita eliminada

`projetosFVController.js`, `case 'orcamento'`:

```diff
- $set.orcamento = dados
- // Espelha campos básicos para `financeiro` legado
  if (dados.payback_anos !== undefined) $set['financeiro.payback_anos'] = dados.payback_anos
  if (dados.irr_pct      !== undefined) $set['financeiro.irr_pct']      = dados.irr_pct
  if (dados.npv_r        !== undefined) $set['financeiro.npv_r']        = dados.npv_r
```

`financeiro.*` **permanece** — não é o subdocumento legado, é o campo de indicadores do próprio `ProjetoFV`, e o agregado deliberadamente não os persiste (INV-58: são derivados).

### 3.2 Backend — falha passou a ser fatal

Sem a ponte legada, engolir o erro perderia o orçamento: não há mais onde ele caia.

```diff
- try {
-   const r = await OrcamentoService.gravarEtapaOrcamento({...})
- } catch (e) {
-   console.error('❌ falha ao gravar o agregado:', e.message)
- }
+ const r = await OrcamentoService.gravarEtapaOrcamento({...})
```

Fecha o achado **A-3** da FV-DOM-002.

### 3.3 Backend — agregado exposto na forma própria

`GET /api/projetos-fv/:id` passou a devolver:

```js
orcamento_vigente: { _id, estado, numero, versao, cotacao_ref, baseline_ref,
                     itens, condicoes, totais }
```

É daqui que a UX lê. `orcamento` (projeção legada) continua na resposta, marcado `@deprecated`, servindo apenas os projetos históricos.

### 3.4 Frontend — 3 consumidores migrados

| Arquivo | Antes | Depois |
|---|---|---|
| `engenhariaGovernanca.js:487` | `projeto?.orcamento?.itens_adicionais` | `projeto?.orcamento_vigente?.itens` mapeado |
| `ProjetosFVDetalhes.jsx:172` | `orc?.preco_venda_r` etc. | `snapshot_financeiro` → `financeiro.*` → `orcamento_vigente.totais` |
| `CrmProjetos.jsx:86,95` | fallback `orcamento?.resumo?.preco_final` | **removido** (campo nunca existiu) |

**Correção necessária no caminho:** ao trocar `const orc = proj?.orcamento`, restavam 5 referências a `orc` no corpo da função — teria dado `ReferenceError` em runtime. Remapeadas para `fin` (`financeiro.*`). `margem_pct` e `tarifa_kwh` só existiam no subdoc; agora vêm de `snapshot_financeiro` ou caem em `null`/default.

---

## 4. Auditoria — depois

| Métrica | Antes | Depois |
|---|---|---|
| Escritas funcionais no subdoc | 1 | **0** |
| Leituras funcionais (backend) | 0 | **0** |
| Leituras funcionais (frontend) | 3 | **0** |
| Consumidores do adapter | 1 | **1** (fallback histórico) |
| Consumidores do tradutor | 1 | 1 (write path do agregado) |

Varredura **estática** do código-fonte (backend + frontend, excluindo testes, checks e arquivos de ProjetoEV) integrada ao check — a prova de "zero consumidores" não depende só de runtime.

---

## 5. Validação

[`legadoOrcamento.check.js`](../backend/src/dominio/__checks__/legadoOrcamento.check.js) — **17/17**:

```bash
node backend/src/dominio/__checks__/legadoOrcamento.check.js
```

| Prova | Resultado |
|---|---|
| Zero escrita estática | ✓ |
| Zero leitura estática fora do adapter | ✓ |
| Adapter com exatamente 1 consumidor | ✓ |
| Subdoc permanece `null` após salvar a etapa | ✓ |
| Orçamento gravado no agregado (5 itens) | ✓ |
| `orcamento_vigente` exposto e íntegro | ✓ |
| **Lixo no subdoc não contamina `orcamento_vigente`** | ✓ |
| Projeto histórico ainda exibe seu orçamento | ✓ |
| Falha ao gravar vira erro 500, não 200 silencioso | ✓ |

### Regressão

| Check | Resultado |
|---|---|
| `node --check` backend + boot | ✓ |
| `lme` · `estadosFV` · `fluxoCanonico` · `congelamento` · `convergenciaOrcamento` | ✓ |
| `instalacaoRefEtapa` | 5 falhas — pré-existente |
| Build frontend | ✓ 2365 módulos |
| Suíte frontend | **idêntica ao baseline** (25 falhas pré-existentes) |

Duas asserções da FV-DOM-002 ficaram obsoletas **por desenho** desta sprint e foram atualizadas:
- "subdoc legado ainda é gravado" → agora verifica que **não** é gravado
- "indicadores repassados do legado" → agora verifica que vivem em `financeiro.*`

---

## 6. §4 — por que o adapter não pôde ser eliminado

O escopo condiciona: *"eliminar `obterOrcamentoProjeto()` **desde que nenhum consumidor permaneça**"*. Permanece exatamente **um**, e ele não é um consumidor comum:

```js
// projetosFVController.js:141
base.orcamento = obterOrcamentoProjeto(plano, orcVigente)
```

Essa linha é o **único caminho pelo qual os 7 projetos históricos ainda mostram seu orçamento**. Para eles, o subdocumento é a única cópia existente — não há agregado, e a sprint proíbe backfill.

Remover o adapter agora produziria:

- 7 projetos com orçamento em branco na tela → **regressão**
- violação de *"Não alterar comportamento"*
- violação de *"Não executar backfill"* (a alternativa seria migrá-los agora)

A condição do §4 será satisfeita quando o **backfill** converter os 7 subdocumentos em `Cotacao`/`Orcamento`. Isso é do LME (ADR-022), que esta sprint mantém congelado.

**O que foi alcançado:** a *dependência funcional* acabou. O adapter deixou de ser fonte operacional e virou caminho de compatibilidade de leitura para dados históricos — o que o próprio escopo autoriza em §3 ("compatibilidade temporária quando estritamente necessária").

---

## 7. Dependências eliminadas

| Dependência | Estado |
|---|---|
| Escrita `ProjetoFV.orcamento` pela etapa do wizard | **eliminada** |
| Leitura do subdoc por `engenhariaGovernanca` | **eliminada** |
| Leitura do subdoc por `ProjetosFVDetalhes` | **eliminada** |
| Fallback morto em `CrmProjetos` | **eliminado** |
| Tolerância a falha na gravação do agregado | **eliminada** (agora fatal) |
| Leitura do subdoc por `obterOrcamentoProjeto` | **mantida** — compat histórica |

---

## 8. Confirmação

**`ProjetoFV.orcamento` tornou-se somente legado.**

- Nenhum caminho da aplicação o escreve.
- Nenhum fluxo funcional o lê.
- Alterá-lo ou zerá-lo não muda o comportamento de nenhum projeto que use o agregado.
- Ele só é lido no fallback de leitura dos projetos históricos.
- O campo **permanece no schema**, conforme a restrição da sprint.

### Pendências para a sprint de remoção física

1. **Backfill** dos 7 projetos → `Cotacao` + `Orcamento` (LME)
2. Remover `obterOrcamentoProjeto` e o campo `orcamento` do schema
3. Remover `orcamentoV3Schema` de `ProjetoFV.js`
4. Remover `base.orcamento` da resposta de `buscarProjetoFV`

**Nada commitado.**
