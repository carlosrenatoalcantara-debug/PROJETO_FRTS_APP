# FV_PRODUCTION_READINESS_ROADMAP.md

**Sprint:** P1-FV-PRODUCTION-READINESS-01
**Data:** 2026-06-20
**Veredito:** PRONTO PARA PRODUÇÃO COM RESSALVAS (maturidade ~80%)

---

## 🔴 BLOQUEADORES DE PRODUÇÃO

Corrigir antes de operação comercial intensa (dados em risco real).

### B1 — Persistir status de homologação no MongoDB (NEW-01) · P1
- **Problema:** `homologacaoController.js:13` usa `new Map()` em memória. Railway redeploya a cada push → perde checklist, status, número ART e datas.
- **Correção mínima:** mover o tracking para subdoc no `ProjetoFV` (ex.: `homologacao_status: { documentos, status, art_numero, data_envio, data_aprovacao }`). Substituir `homologacoesDB.set/get` por leitura/escrita no documento.
- **Esforço:** Baixo. Não toca geração de documentos (já vem do projeto).

### B2 — Persistência server-side do wizard antes do passo 8 (NEW-02) · P1
- **Problema:** projeto só é criado em `E8Orcamento.jsx:354`; E1–E7 vivem em `localStorage`. Perda total se fechar antes do passo 8.
- **Correção mínima:** criar o projeto como `rascunho` ao concluir a etapa 2 (consumo) ou 3 (cliente+localização resolvidos), setar `projetoId` no contexto. O autosave por slice já existe e passa a disparar automaticamente.
- **Esforço:** Médio. Reusa `criarProjeto` + `salvarEtapa` existentes; cuidar de não duplicar projeto no passo 8.

---

## 🟡 MELHORIAS (corrigir na sequência — confiabilidade)

### M1 — Recalibrar motor de qualidade + gate utilizável (BUG-QUAL-01 / BUG-CAT-01) · P0 técnico
- Corrigir falso-positivo `MPPT_INCOERENTE` (permitir `MPPT_max == Voc_max_DC`).
- Incluir `import_solarmarket` na tabela `BASE_POR_ORIGEM` de confiança.
- Recalcular `utilizavel_em_projeto=false` quando faltarem specs mínimas (potência, MPPT) — para barrar registros ocos no seletor.
- **Ref:** memória `quality_rules_micro_miscalibration`.

### M2 — Enriquecer inversores identity-only (BUG-CAT-01) · P0 dado
- 87 inversores deriváveis por regex do modelo; 35 exigem datasheet/manual.
- Rodar enriquecimento + revisar os não-deriváveis via cadastro manual.

### M3 — Priorizar `state.clienteId` no E8 (E8-CLIENTE-NOME) · P2
- Quando `state.clienteId` existe, usar diretamente em vez de `resolverClientePorNome`.

### M4 — Backfill de `equipamento_id` em arranjos legados (BUG-EQID-01) · P1
- Script de migração: casar (fabricante, modelo) → preencher `equipamento_id`.

---

## 🟢 NICE TO HAVE (não bloqueia produção)

- **N1 — Semear catálogo de estruturas e baterias** (NEW-03): 0 itens hoje; estrutura usa hardcoded. Criar page de cadastro de estruturas ou seed.
- **N2 — Desacoplar frontend de `backend/src`** (BUG-ARCH-01): extrair utilitários compartilhados para diretório/pacote comum.
- **N3 — Diagrama de layout FV multiarranjo** (BUG-LAY-01): substituir InteractiveDiagram EV-centric.
- **N4 — Fallback de OCR para fatura-imagem** sem Gemini (OCR-IMG-GEMINI), ou documentar a chave como requisito de deploy.
- **N5 — Completar potência dos 3 módulos** (BUG-MOD-01): baixo impacto (0 projetos afetados).

---

## FORA DE ESCOPO DESTA LINHA (Scanner — domínio excluído)
- BUG-SCAN-01 (upload de galeria), BUG-SCAN-02 (QR iOS Safari) — pertencem ao domínio Scanner/QR, excluído da auditoria.

---

## PROCESSO

- **Revisão cruzada por Gemini** (obrigatória pela sprint) — executar externamente; este ambiente não dispõe da ferramenta.

---

## SEQUÊNCIA RECOMENDADA

```
Sprint N+1: P0-FV-PERSISTENCE-HARDENING-01
  ├── B1 (homologação → MongoDB)
  ├── B2 (criar projeto na etapa 2/3)
  └── M1 (gate utilizável confiável)

Sprint N+2: P1-FV-CATALOG-INTEGRITY-01
  ├── M2 (enriquecer inversores)
  ├── M4 (backfill equipamento_id)
  └── N1 (seed estruturas/baterias)

Backlog: N2, N3, N4, N5 + revisão Gemini
```
