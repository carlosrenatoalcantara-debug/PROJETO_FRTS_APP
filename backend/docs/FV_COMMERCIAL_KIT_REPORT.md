# Sprint P1-FV-COMMERCIAL-KIT-FIRST-01 — Relatório

**Data:** 2026-06-17
**Executor:** Sonnet 4.6
**Revisão Gemini:** OBRIGATÓRIA E PENDENTE
**Branch:** sprint/p1-fv-commercial-kit-first-01
**Escopo exclusivo:** Projeto FV (E8 Orçamento). Não tocou ProjetoEV, Atlas, Homologação, Governança, Ativos, QR.

---

## FASE 1 — Forense do Orçamento Atual

### 1. Onde os valores são calculados

| Local | Responsabilidade |
|-------|------------------|
| `frontend/src/components/fv/etapas/E8Orcamento.jsx` | Orçamento "detalhado": subtotais = `dim.numPaineis × precoPainel`, `dim.numInversores × precoInversor`, `dim.numPaineis × precoEstrutura`, `dim.numPaineis × maoDeTrabaho`, `cabosProtecao` fixo → `total`. |
| `frontend/src/components/fv/CentroFinanceiroFV.jsx` (+ `utils/financeiroEngine.js`) | Centro Financeiro EPC: markup, margem, ROI, payback, parcelamento. Emite `resultadoFinanceiro` via `onResultado`. |
| `frontend/src/components/fv/PropostaEnterprise.jsx` | Comparação multi-cenário; consome `snapshotTecnico` + `resultadoFinanceiro`. |

### 2. Onde os valores são persistidos

- `E8.salvarProposta()` monta `orcamentoLocal` → `salvarTodosSlices(projetoId, state, orcamentoLocal)`.
- `services/projetoFVApi.js#adaptarOrcamento()` mapeia para o subdoc v3 → `PUT /api/projetos-fv/:id/etapa` com `etapa='orcamento'`.
- `backend/src/controllers/projetosFVController.js` (case `'orcamento'`, ~linha 643): `$set.orcamento = dados`; espelha `payback_anos/irr_pct/npv_r` em `financeiro.*`.
- Schema: `orcamentoV3Schema` em `backend/src/models/ProjetoFV.js` (`custo_total_r`, `custo_equipamentos_r`, `custo_mao_obra_r`, `custo_outros_r`, `margem_pct`, `preco_venda_r`, …). `strict: true` — campos fora do schema são descartados.

### 3. Onde os valores são exibidos

- E8: card "TOTAL DO INVESTIMENTO" + cards de equipamentos.
- `ProjetosFVDetalhes` → AbaFinanceiro (legado `dimensionamento`), AbaComercial (`PropostaEnterprise` via `derivarResultadoFinanceiro` — sprint anterior), CRM.
- PDFs: `gerarPdfOrcamento`, `gerarPropostaPDF`.

### 4. Quais dados já existem

- `orcamentoV3Schema` com custos por categoria, margem, preço de venda, KPIs financeiros.
- Modo detalhado 100% funcional (módulos, inversores, estrutura, mão de obra, cabos).
- **Lacuna:** não havia conceito de "kit fechado de fornecedor" nem de "itens adicionais" estruturados, nem separação Material/Serviços.

---

## FASE 2 — Modo Kit (Padrão)

Adicionado seletor de modo no topo do E8:

- ☑ **Orçamento por Kit** (padrão — `modoOrcamento = 'kit'`)
- ☐ Orçamento detalhado

Implementado como toggle `setModoOrcamento('kit' | 'detalhado')`. Estado inicial = `'kit'`.

---

## FASE 3 — Kit

Campos do formulário Kit:

| Campo | Estado | Tipo no total |
|-------|--------|---------------|
| Fornecedor | `kitFornecedor` | — |
| Valor do Kit | `kitValor` | Material |
| Frete | `kitFrete` | Material |
| Projeto | `kitProjeto` | Serviço |
| Mão de obra | `kitMaoObra` | Serviço |
| Observações | `kitObservacoes` | — |

Cálculos:

- **Total Material** = Valor do Kit + Frete + (itens adicionais tipo material)
- **Total Serviços** = Projeto + Mão de obra + (itens adicionais tipo serviço)
- **Total Venda** = Total Material + Total Serviços

---

## FASE 4 — Itens Adicionais

Repetidor "Adicionar Item" (disponível em **ambos** os modos). Campos: Descrição, Quantidade, Valor, Tipo (`material`/`servico`). Subtotal por item = quantidade × valor, somado a Material ou Serviços conforme `tipo`.

Exemplos sugeridos na UI: ampliação, inversor adicional, módulos adicionais, estrutura, BESS, adequação elétrica.

---

## FASE 5 — Modo Detalhado (compatibilidade)

Preservado integralmente: módulos, inversores, estrutura, mão de obra por painel, cabos/proteções. A composição item a item e os preços unitários editáveis continuam idênticos.

**Compatibilidade verificada por construção:** em modo detalhado, sem itens adicionais, `total = subtotalPaineis + subtotalInversores + subtotalEstrutura + subtotalMaoDeTrabaho + subtotalCabosProtecao` — exatamente o valor legado (apenas reorganizado como Material + Serviços).

---

## FASE 6 — Congelamento Comercial (pontos de integração — DOCUMENTAÇÃO)

> **Nenhuma alteração de geração de unifilar, engenharia ou homologação foi feita.** Apenas documentação dos pontos onde o orçamento aprovado pode servir de referência.

| Etapa | Ponto de integração atual | Como o orçamento Kit pode alimentar (futuro) |
|-------|---------------------------|----------------------------------------------|
| **Engenharia** | `construirSnapshotsE8()` → `construirTodosSnapshots({ orcamentoLocal })` já recebe os novos campos kit/itens. O snapshot financeiro congela o total. | O `snapshot_financeiro` congelado já carrega `total_venda_r`, `total_material_r`, `total_servicos_r`. Engenharia pode validar potência vs. equipamentos do kit. |
| **Unifilar** | `gerarUnifilarSVG(...)` deriva de `dimensionamento` (painel/inversor/arranjos). **Não lê orçamento.** | Quando o orçamento for "kit fechado", o unifilar deveria refletir os equipamentos do kit aprovado. **Gate sugerido (GAP-05 da forense anterior): exigir `freeze_status=CONGELADO` antes de liberar o unifilar.** NÃO implementado nesta sprint. |
| **Homologação** | `Homologacao.jsx` (conectado na sprint anterior) usa checklist/memorial/carta/ART a partir de `projeto`. | O memorial e a carta podem citar o kit (fornecedor, potência). Integração documental — sem mudança de código aqui. |

**Recomendação:** criar sprint dedicada `P1-FV-UNIFILAR-GATE-01` (já no roadmap) para travar geração de unifilar ao orçamento congelado. Esta sprint apenas garante que os dados do kit são persistidos e congeláveis.

---

## FASE 7 — Validação

> **HONESTIDADE:** os projetos abaixo **NÃO foram testados em runtime** nesta sessão. Não há acesso ao Atlas/ambiente nesta execução. A validação foi **estática** (build + node --check).

| Validação | Status |
|-----------|--------|
| Build Vite (`npm run build`) | ✅ 2322 módulos, 9.69s, 0 erros |
| `node --check` ProjetoFV.js | ✅ SCHEMA OK |
| Projeto novo (fluxo wizard) | ⚠️ NÃO testado em runtime |
| Projeto legado | ⚠️ NÃO testado em runtime |
| Fazenda Alice | ⚠️ NÃO testado em runtime |
| Paulo Carlos | ⚠️ NÃO testado em runtime |
| Escola Pinheiro | ⚠️ NÃO testado em runtime |

A compatibilidade do modo detalhado foi garantida por construção (total idêntico ao legado quando sem itens adicionais), mas requer confirmação manual + revisão Gemini.

---

## Limitações Conhecidas

1. **PDF (`gerarPropostaPDF` / `gerarPdfOrcamento`)**: continuam montando as linhas a partir dos subtotais detalhados. Em modo Kit, o `total` (= Total Venda) está correto, mas as linhas de item do PDF ainda refletem a composição detalhada. Rewire do gerador de PDF fica fora desta sprint.
2. **CentroFinanceiroFV**: recebe `custosIniciais` detalhados; em modo Kit o `total` propagado já é o Total Venda, mas a decomposição por categoria ainda é a detalhada.
3. **Gate de unifilar**: documentado, não implementado (respeitando a instrução "NÃO alterar geração do unifilar ainda").

---

## Próximos Passos

1. Revisão Gemini obrigatória.
2. Teste runtime dos 5 projetos de validação no ambiente Railway.
3. Sprint `P1-FV-UNIFILAR-GATE-01` (gate orçamento congelado → unifilar).
4. Rewire opcional do gerador de PDF para refletir o modo Kit nas linhas de item.
