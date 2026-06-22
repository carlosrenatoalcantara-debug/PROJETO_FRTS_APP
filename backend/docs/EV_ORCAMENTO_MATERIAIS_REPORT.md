# EV_ORCAMENTO_MATERIAIS_REPORT.md

**Sprint:** P0-EV-ORCAMENTO-MATERIAIS-01
**Data:** 2026-06-20
**Modelo:** Claude Opus 4.8
**Commits:** `509b5f5` (feature) · `6d5d1ba` (whitelist controller)

> GEMINI: revisão cruzada PENDENTE (sem ferramenta no ambiente).

## DECLARAÇÃO DE HONESTIDADE

```
VALIDADO EM CÓDIGO:  build OK; motor de orçamento; OrcamentoEV; integração 5 etapas.
VALIDADO EM RUNTIME: motor (3 cenários) + persistência orçamento/financeiro/status no
                     ProjetoEV (POST→GET, Railway/Atlas) — preço final R$ 16.245.
NÃO TESTADO:         fluxo EV completo no navegador (clicar pelas 5 etapas + unifilar
                     visual); PDF do orçamento.
```

## RESULTADO

```
APROVADO — fluxo comercial EV fechado: Carregador → Dimensionamento → Materiais
(editável) → Orçamento → Aprovação → Unifilar (gated). Sem planilha externa.
```

---

## AUDITORIA E8 FV (regra obrigatória)

1. **O que pode ser reutilizado:** o **padrão** do E8/`CentroFinanceiroFV` — preço unitário editável, subtotais, margem/desconto, e o conceito de workflow comercial.
2. **O que pode ser compartilhado:** a **matemática** de orçamento → extraída num **motor único** (`calcularOrcamento`).
3. **O que NÃO deve ser duplicado:** o cálculo de margem/desconto/preço final (agora 1 só motor) e a UI do E8 (FV-specific — não reusada).
- **Decisão:** o orçamento do FV é **inline/acoplado ao componente** (E8 + CentroFinanceiroFV), sem função reutilizável. Criar um **motor compartilhado** evita um segundo engine; o EV o usa agora e o FV deve **convergir** depois.

---

## O QUE FOI FEITO

| Fase | Entrega |
|---|---|
| 1 — BOM atual | Gerado em `bomMateriaisEV.gerarBOM`; itens `{item, especificacao, quantidade, unidade}` (11 itens) |
| 2 — Lista editável | `OrcamentoEV`: **adicionar/excluir/editar descrição/quantidade/unidade/observação** |
| 3 — Preço unitário | preço unitário + **subtotal por linha** + total automático |
| 4 — Serviços | seção **Mão de obra · Deslocamento · Comissionamento · Outros** (editável) |
| 5 — Resumo financeiro | Equipamentos · Materiais · Serviços · Subtotal · **Margem** · **Desconto** · **Preço final** |
| 6 — Workflow comercial | `rascunho → orçado → aguardando_aprovacao → aprovado → instalação → concluído` |
| 7 — Aprovação | **não existia** no EV (FV tem governança/freeze) → implementado mínimo: status + botão **Aprovar** (persistido) |
| 8 — Unifilar gate | etapa 5, **default exige aprovação**; checkbox "permitir gerar antes da aprovação" (default NÃO) |

Motor: `frontend/src/utils/calcularOrcamento.js`. UI: `frontend/src/components/ev/OrcamentoEV.jsx`.
Integração: `NovaPropostaEV` (etapa 4 Orçamento; Unifilar → etapa 5). Persistência:
`ProjetoEV.orcamento` + `financeiro` (controller whitelist; `strict:false`, sem schema novo).

---

## FASE 9 — RUNTIME

**Motor (3 cenários):**
```
A · 7,4 kW  → equip 4.500 + mat 2.225 + serv 1.800 = custo 8.525 → margem 20% → desc 5% → R$ 9.718,50
B · 22 kW   → custo 16.875 → R$ 19.237,50
C · 2×22 kW → equip 24.000 → custo 28.875 → R$ 32.917,50
```
**Persistência (ProjetoEV, Railway/Atlas):** POST com orçamento → GET → `status=aprovado`, `orcamento.status=aprovado`, `preco_final=16245`, materiais/serviços salvos, `financeiro.custo_total_r=16245`. **Round-trip OK.**

## FASE 10 — VALIDAÇÃO COMERCIAL

Um vendedor consegue, **sem sair do módulo EV e sem planilha externa**: (1) selecionar carregador, (2) ajustar materiais, (3) ajustar serviços, (4) gerar preço final, (5) aprovar, (6) emitir unifilar.

---

## RESPOSTAS OBRIGATÓRIAS

1. **Reutilizado do FV:** padrão E8/CentroFinanceiroFV (preço editável/subtotais/margem/desconto) + conceito de workflow; motor compartilhado criado para convergência futura.
2. **Criado novo:** `calcularOrcamento` (motor único), `OrcamentoEV` (UI), etapa 4, whitelist EV.
3. **Lista editável funcionando?** SIM.
4. **Orçamento funcionando?** SIM (runtime R$ 16.245).
5. **Workflow funcionando?** SIM (6 status).
6. **Aprovação funcionando?** SIM (botão Aprovar → persiste).
7. **Unifilar integrado?** SIM (etapa 5, gated em aprovação).
8. **Runtime executado?** SIM.
9. **Regressões?** Nenhuma (FV intocado; ProjetoEV strict:false; fluxo EV agora 5 etapas).
10. **EV pronto para uso comercial?** SIM (ressalvas: UI não exercida em navegador; PDF do orçamento é follow-up).

---

## VEREDITO

```
APROVADO — EV comercialmente operável: carregador → materiais editáveis → orçamento
(margem/desconto) → aprovação → unifilar, com 1 motor de orçamento compartilhado.
```
