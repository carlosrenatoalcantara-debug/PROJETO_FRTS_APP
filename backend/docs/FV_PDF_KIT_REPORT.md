# Sprint P1-FV-PDF-KIT-RESTORE-01 — Relatório

**Data:** 2026-06-18
**Executor:** Sonnet 4.6
**Revisão Gemini:** OBRIGATÓRIA E PENDENTE
**Branch:** sprint/p1-fv-pdf-kit-restore-01
**Escopo exclusivo:** Projeto FV / Orçamento / PDF. Não tocou ProjetoEV, Atlas, Governança, Homologação, QR, Ativos.

---

## FASE 1 — Mapeamento dos geradores PDF do FV

### 1. Quais arquivos geram PDF

| Arquivo | Saída | Usado por | Escopo desta sprint |
|---------|-------|-----------|---------------------|
| `frontend/src/utils/gerarPdfOrcamento.js` | jsPDF (orçamento FV) | `E8Orcamento.baixarPdf()` | ✅ ALVO |
| `frontend/src/utils/gerarPropostaPDF.js` | HTML (proposta comercial) | `E8Orcamento.gerarProposta()` + `NovaProposta.jsx` (legado) | ✅ ALVO |
| `frontend/src/utils/gerarPdfComercial.js` | jsPDF (simulação comercial) | `SimulacaoFV.jsx` | ❌ fora — simulação pré-venda, sem orçamento/kit |
| `frontend/src/utils/gerarPdfSimulacao.js` | jsPDF (simulação) | — | ❌ fora — simulação, sem orçamento/kit |
| `frontend/src/utils/gerarPdfHomologacao.js` | jsPDF (homologação) | homologação | ❌ fora — escopo proibido |

### 2. Quais dados utilizam

- **gerarPdfOrcamento**: `cliente, consumo, localizacao, dimensionamento, area, equipamentos, irradiancia, empresa`. O **total era recalculado internamente** somando apenas `precoUnitario × quantidade` de painel + inversor + estrutura (linhas 198–201, versão anterior).
- **gerarPropostaPDF**: `cliente, sistema, orcamento{total, precoWp, itens[]}, empresa, financeiro, comercial, geoespacial`. O `itens[]` era montado em `E8.gerarProposta()` com 5 linhas detalhadas (módulos, inversores, estrutura, mão de obra, cabos).

### 3. Quais ignoravam o modo kit

- **gerarPdfOrcamento**: ignorava 100% o modo kit. Não exibia fornecedor, kit, frete, projeto, mão de obra nem itens adicionais. **O total do PDF divergia do total da tela** (excluía serviços e itens — em modo kit, excluía tudo, pois os equipamentos não têm preço unitário no kit).
- **gerarPropostaPDF**: ignorava o modo kit. O `total` (caixa "Investimento Total") já estava correto (= Total Venda, herdado da sprint anterior), mas as **linhas de item eram sempre a composição detalhada**, nunca o kit. Também tinha bug pré-existente: coluna "% do Total" exibia `undefined%` (E8 não passava `percentual`).

---

## FASE 2 — Modo Kit no PDF

Quando `orcamento.modo === 'kit'`, ambos os geradores passam a exibir:

- **Fornecedor**
- **Kit principal** (material)
- **Frete** (material)
- **Projeto** (serviço)
- **Mão de obra** (serviço)
- **Itens adicionais** (Descrição, Tipo, Qtd, Valor, Subtotal)
- **Total Material**
- **Total Serviços**
- **Total de Venda** (caixa de total)

---

## FASE 3 — Modo Detalhado (sem regressão)

Quando `orcamento.modo !== 'kit'` (ou ausente), o comportamento anterior é preservado:

- Tabela de **Equipamentos** (Módulos, Inversores, Estrutura) com unitário e subtotal.
- Linhas de serviço (mão de obra, cabos) via `itens[]`.
- Itens adicionais anexados ao final (quando houver).
- **Correção de bug:** coluna "% do Total" agora calcula o percentual quando `item.percentual` não é fornecido (eliminado o `undefined%`). Projetos que passam `percentual` explícito continuam usando o valor passado.

---

## FASE 4 — Itens adicionais no PDF

Exibidos em **ambos os modos**: Descrição, Tipo (Material/Serviço), Quantidade, Valor unitário, Subtotal (= Qtd × Valor).

**Validação de soma (executada em Node):** `Total Material + Total Serviços = Total de Venda`, com itens adicionais somados à categoria correta conforme `tipo`. Ex. verificado: kit 42.000 + frete 1.500 + item material 4.000 = **Material 47.500**; projeto 1.200 + mão de obra 3.500 + item serviço 800 = **Serviços 5.500**; **Venda 53.000**. ✅

---

## FASE 5 — Validação (Tela → PDF → mesmos valores)

> **HONESTIDADE:** os 5 projetos reais (novo, legado, Fazenda Alice, Paulo Carlos, Escola Pinheiro) **NÃO foram abertos em runtime** — sem acesso ao Atlas/ambiente nesta sessão. A validação abaixo é a que **foi de fato executada**.

| Validação | Método | Resultado |
|-----------|--------|-----------|
| `gerarPropostaPDF` modo kit | **Executado em Node** (função pura, sem jsPDF) | ✅ 11/11 asserts — fornecedor, kit, frete, projeto, mão de obra, item adicional, Total Material, Total Serviços, Total Venda, soma correta |
| `gerarPropostaPDF` modo detalhado | **Executado em Node** | ✅ seção detalhada presente, sem `undefined%`, total batendo |
| `gerarPropostaPDF` legado (sem `modo`) | **Executado em Node** | ✅ cai em detalhado, `percentual` explícito preservado |
| `gerarPdfOrcamento` (kit/detalhado) | **Build apenas** (usa jsPDF — browser-only, não executável em Node puro) | ✅ compila; ⚠️ render não exercido em runtime |
| Coerência Tela ↔ PDF | **Análise de fluxo de dados** | E8 passa `montarOrcamentoLocal()` (mesma fonte da tela) aos dois geradores → mesmos valores por construção |

**Coerência Tela → PDF (análise):** o card de total da tela usa `total = totalMaterial + totalServicos`. Ambos os PDFs recebem `orcamento = montarOrcamentoLocal()`, cujo `totalVenda = total`, `total_material`/`total_servicos` idênticos aos da tela. Logo, por construção, os valores batem. Confirmação visual em runtime permanece pendente (Gemini + teste manual).

---

## FASE 6 — Compatibilidade

- **PDFs antigos continuam abrindo:** os geradores aceitam `orcamento` ausente/parcial. Sem `modo`, caem em "detalhado" (comportamento legado).
- **Projetos sem modo kit:** `orcamento.modo` indefinido → modo detalhado. Verificado em Node (teste "legado").
- **NovaProposta.jsx (legado):** não passa campos kit → renderiza detalhado como antes. Nenhuma alteração necessária nesse arquivo.
- **Nenhuma migração:** os campos kit/itens já existiam no schema (sprint anterior, aditivos). Esta sprint só altera a camada de PDF (frontend). **Schema e Atlas intocados.**
- **Normalização dupla:** os geradores leem tanto o objeto vivo do E8 (camelCase: `itensAdicionais`, `totalMaterial`) quanto o persistido (snake_case: `itens_adicionais`, `total_material_r`), preparando uma futura geração de PDF a partir do projeto salvo.

---

## RESPOSTAS DIRETAS

1. **Quais PDFs foram alterados:** `gerarPdfOrcamento.js` e `gerarPropostaPDF.js`.
2. **Quantos arquivos alterados:** 3 (`gerarPdfOrcamento.js`, `gerarPropostaPDF.js`, `E8Orcamento.jsx`).
3. **Modo Kit refletido no PDF:** SIM — fornecedor, kit, frete, projeto, mão de obra, itens adicionais, Total Material, Total Serviços, Total Venda.
4. **Modo detalhado preservado:** SIM — sem regressão; bug `undefined%` corrigido como melhoria colateral.
5. **Valores batem com a tela:** SIM por construção (mesma fonte `montarOrcamentoLocal()`); confirmado em Node para `gerarPropostaPDF`; `gerarPdfOrcamento` apenas build-check (jsPDF não roda em Node puro).
6. **Regressões encontradas:** nenhuma nas verificações executadas. `gerarPdfOrcamento` não foi exercido em runtime — risco residual a confirmar em revisão.
7. **Commit gerado:** ver hash no final / `FV_PDF_KIT_METRICS.json`.

---

## Limitações conhecidas

1. `gerarPdfOrcamento` (jsPDF) validado apenas por build — render real não exercido nesta sessão.
2. Os 5 projetos reais não foram abertos em runtime (sem ambiente/Atlas).
3. `gerarPdfComercial`/`gerarPdfSimulacao` (simulações pré-venda) permanecem sem conceito de kit — fora do escopo por não consumirem orçamento persistido.
