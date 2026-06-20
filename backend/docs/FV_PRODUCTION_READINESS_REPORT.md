# FV_PRODUCTION_READINESS_REPORT.md

**Sprint:** P1-FV-PRODUCTION-READINESS-01
**Data:** 2026-06-20
**Modelo:** Claude Opus 4.8
**Tipo:** Auditoria Final de Prontidão para Produção (READ-ONLY — nenhuma alteração de código nesta sprint)

---

## ⚠️ NOTA SOBRE GEMINI (revisão obrigatória)

A sprint marca **GEMINI: Obrigatória**. **Não há ferramenta Gemini disponível neste ambiente de execução.**
A auditoria foi conduzida por Claude Opus 4.8 com leitura de código + 4 verificações de runtime reais contra o Railway.
**A revisão cruzada por Gemini permanece PENDENTE** e deve ser executada externamente antes de qualquer decisão final de go-live. Não declaro este relatório "validado por Gemini".

---

## HONESTIDADE — TIPO DE EVIDÊNCIA

```
VALIDADO EM CÓDIGO:   SIM (leitura integral dos fluxos FV)
VALIDADO EM RUNTIME:  PARCIAL (4 checks reais no Railway — abaixo)
REVISÃO GEMINI:       PENDENTE (ferramenta indisponível no ambiente)
```

### Evidências de runtime coletadas (2026-06-20)

| Check | Endpoint | Resultado |
|---|---|---|
| Saúde do backend | `/api/equipamentos/debug/status` | `mongodb_conectado: true` ✅ |
| Catálogo total | idem | 382 equipamentos (189 módulos, 177 inversores, 16 carreg.) |
| Inversores utilizáveis | `/api/equipamentos/engenharia?tipo=inversor` | 177 passam o filtro |
| Módulos utilizáveis | `/api/equipamentos/engenharia?tipo=modulo` | 189 passam o filtro |
| Estruturas no catálogo | `/api/equipamentos/engenharia?tipo=estrutura` | **0** |

---

## FASE 1 — INVENTÁRIO

### 1.1 Entregue e ATIVO (produção)

| Domínio | Estado | Evidência |
|---|---|---|
| Clientes (CRUD) | ATIVO | `clientesController.js`, page Clientes |
| OCR Fatura (PDF) | ATIVO | `faturaController` — PDFParse + parser de texto |
| OCR Fatura (imagem) | ATIVO c/ dependência | Gemini Vision (`gemini-2.0-flash`) — sem fallback de IA |
| OCR Datasheet | ATIVO c/ contingência | Claude (`datasheetController`) + parser de texto |
| Cadastro Manual | ATIVO (recém-corrigido) | Módulo/Inversor/Bateria/Estrutura — commit `a2fa744` |
| Projeto FV (wizard E1–E8) | ATIVO | `ProjetoFVContext` + `ProjetosFVNovo` |
| Dimensionamento | ATIVO | E5 + `dimensionamentoController` |
| Multiarranjo | ATIVO | `GerenciadorArranjos`, slice `arranjos` |
| Equipamentos (E7) | ATIVO | Seletores leem `/engenharia` (catálogo Mongo) |
| Orçamento | ATIVO | E8 + `orcamentoController` |
| Governança / Freeze | ATIVO (robusto) | `congelarProjetoFV` + freeze-guard no save |
| Snapshot técnico/catálogo/RT | ATIVO | `governanca.snapshot_*` no `ProjetoFV` |
| Homologação (documentos) | ATIVO | memorial/ART/carta gerados sob demanda do projeto |
| Beneficiárias (% e prioridade) | ATIVO | `BeneficiariasPainel` — rateio prioridade corrigido |
| Irradiância | ATIVO | NASA POWER + fallback CRESESB/estado |
| Unifilar | ATIVO | `unifilarController` + `gerarUnifilarSVG` |
| PDFs (proposta/kit/detalhado) | ATIVO | corrigido P1-FV-PDF-KIT-RESTORE-01 |

### 1.2 EXPERIMENTAL / Parcial

| Item | Estado |
|---|---|
| Homologação — tracking de status/checklist | **VOLÁTIL** — `Map()` em memória (ver Fase 4) |
| Catálogo de Estruturas | VAZIO no Mongo (0) — usa lista hardcoded |
| Catálogo de Baterias | VAZIO no Mongo (0) |
| Editor de Layout (diagrama) FV | Genérico — não desenha multiarranjo (BUG-LAY-01) |

---

## FASE 2 — BUGS ABERTOS

Reconciliação com a matriz consolidada anterior (`FV_OPEN_BUGS_MATRIX.json`, 2026-06-18) + achados desta auditoria.

### Corrigidos desde a última matriz ✅
- **BUG-BEN-01** (rateio "prioridade" na UI) — `BeneficiariasPainel` agora tem seletor `['percentual','prioridade']` (linha 256). CORRIGIDO.
- **BUG-ART-01** (DadosART GET sem corpo) — agora `method:'POST'` com `body:{projeto}` (DadosART.jsx:30). CORRIGIDO.
- Huawei 50KTL, Parser 380V, React #31, Cadastro Manual — sprints recentes.

### Ainda ABERTOS

| ID | Severidade | Área | Impacto | Status |
|---|---|---|---|---|
| BUG-CAT-01 | **P0** | Catálogo | ~122 inversores identity-only sem `especificacoes` (forense). Em runtime, **os 177 passam o filtro `utilizavel_em_projeto`** → registros ocos vazam para o seletor | ABERTO |
| BUG-QUAL-01 | **P0** | Qualidade catálogo | Regras invalidam microinversores; `import_solarmarket` nunca atinge nível "utilizável". Gate de qualidade desacoplado de `utilizavel_em_projeto` | ABERTO (ver [[quality_rules_micro_miscalibration]]) |
| NEW-01 | **P1** | Homologação | Checklist/status/ART/datas em `Map()` em memória — perdidos a CADA redeploy do Railway | ABERTO (novo) |
| NEW-02 | **P1** | Persistência wizard | Projeto só é criado na etapa 8. E1–E7 vivem só em `localStorage` — perda total se fechar antes do passo 8 / trocar dispositivo / limpar storage | ABERTO (novo, by-design) |
| BUG-EQID-01 | P1 | Linkagem catálogo | `equipamento_id=null` em projetos legados → vínculo Atlas por ID não dispara (cai em fabricante+modelo) | ABERTO (mapeado) |
| NEW-03 | P2 | Catálogo | 0 estruturas e 0 baterias no Mongo. Estrutura usa hardcoded; bateria sem itens | ABERTO (novo) |
| BUG-ARCH-01 | P2 | Arquitetura | Frontend importa de `backend/src/...` (E7, Inversores, BeneficiariasPainel) → acoplamento de build | ABERTO (confirmado) |
| BUG-LAY-01 | P2 | Layout editor | Diagrama genérico, não desenha multiarranjo FV | ABERTO |
| BUG-MOD-01 | P2 | Catálogo | 3 módulos sem potência (0 projetos afetados) | ABERTO (baixo) |
| BUG-SCAN-01/02 | P1/P2 | Scanner | Sem upload de galeria; QR indisponível iOS Safari | ABERTO — **fora de escopo** (Scanner excluído) |

**P0 restantes: 2** (BUG-CAT-01, BUG-QUAL-01)
**P1 restantes (em escopo): 3** (NEW-01, NEW-02, BUG-EQID-01)

---

## FASE 3 — FLUXOS (ponta a ponta)

| Etapa | Estado | Observação |
|---|---|---|
| Cliente | ✅ Completo | CRUD + pré-preenchimento do wizard via `?clienteId=` |
| OCR | ✅ Completo | PDF: parser próprio. Imagem: Gemini. Sempre há saída manual (E2) |
| Projeto FV | ⚠️ Parcial | Funciona, mas só persiste no banco na etapa 8 (NEW-02) |
| Dimensionamento | ✅ Completo | E5 + recálculo no configurador E7 |
| Equipamentos | ✅ Completo | Seletores leem catálogo Mongo; cadastro manual disponível |
| Orçamento | ✅ Completo | E8 cria projeto + salva todos os slices com relato de falha parcial |
| Aprovação | ✅ Completo | Workflow comercial (ASSINADO trava edição) |
| Freeze | ✅ Completo | `congelarProjetoFV` + guard de 409 no save |
| Homologação (docs) | ✅ Completo | Memorial/ART/carta sob demanda; usa snapshot quando congelado |
| Homologação (status) | ❌ Volátil | Tracking em memória (NEW-01) |

**Conclusão Fase 3:** o fluxo principal é navegável de ponta a ponta. Os dois pontos frágeis são *persistência precoce do wizard* e *tracking de homologação*.

---

## FASE 4 — DADOS (risco de perda)

| Aspecto | Estado | Risco |
|---|---|---|
| Persistência (etapa 8+) | ✅ Sólida | `salvarTodosSlices` relata falha parcial ao operador |
| Persistência (etapas 1–7) | ⚠️ localStorage | **NEW-02** — perda se não chegar ao passo 8 |
| Reabertura (`?id=`) | ✅ Robusta | Hidratação completa de todos os slices |
| Snapshot (freeze) | ✅ Robusto | Cópia profunda imutável; homologação consome snapshot |
| Versionamento (revisões A→B…) | ✅ Presente | `_proximaRevisao`, freeze-guard exige revisão p/ reabrir |
| Beneficiárias | ✅ OK | Locais até o passo 8, depois lote no DB; rateio % e prioridade |
| Multiarranjo | ✅ OK | Slice `arranjos` substitui array inteiro (remoção limpa índice) |
| Homologação status | ❌ Em memória | **NEW-01** — perda a cada redeploy |

---

## FASE 5 — CATÁLOGO

1. **Catálogo está operacional?** SIM. 382 equipamentos, MongoDB conectado, seletores leem do banco. **Porém** módulos/inversores incompletos não são filtrados pelo gate `utilizavel_em_projeto` (todos os 177/189 passam) — risco de seleção de registro oco (BUG-CAT-01/QUAL-01).
2. **Cadastro manual está operacional?** SIM (em código, commit `a2fa744`) para módulo, inversor, bateria e estrutura. Runtime ainda não exercido nesta sprint.
3. **Há dependência excessiva do OCR?** PARCIAL.
   - Datasheet: NÃO — Claude + parser de texto + cadastro manual.
   - Fatura PDF: NÃO — parser de texto próprio.
   - **Fatura imagem: SIM** — Gemini-only, sem fallback de IA (mitigado por E2 manual).

---

## FASE 6 — PRODUÇÃO (uma instaladora amanhã)

| Tarefa | Sem desenvolvedor? |
|---|---|
| Cadastrar cliente | ✅ Sim |
| Criar projeto | ✅ Sim |
| Dimensionar | ✅ Sim |
| Aprovar | ✅ Sim |
| Congelar | ✅ Sim |
| Homologar (gerar docs) | ✅ Sim |
| Homologar (acompanhar status até conexão) | ⚠️ Sim, mas o status se perde a cada redeploy (NEW-01) |

**Veredito:** uma instaladora consegue operar o ciclo completo sem desenvolvedor. As ressalvas são *durabilidade* (status de homologação volátil) e *risco de perda* do wizard antes do passo 8 — ambos contornáveis com disciplina operacional, mas devem ser corrigidos.

---

## FASE 7 — TOP 10 RISCOS

Ver `FV_PRODUCTION_READINESS_RISKS.json`. Resumo por impacto:

1. **NEW-01** — Status de homologação em memória (perda a cada redeploy Railway). **Impacto operacional direto.**
2. **BUG-QUAL-01** — Motor de qualidade miscalibrado; gate `utilizavel` não confiável.
3. **BUG-CAT-01** — Inversores ocos vazam para o seletor de engenharia.
4. **NEW-02** — Wizard sem persistência server-side antes do passo 8.
5. **Fatura-imagem Gemini-only** — sem chave Gemini, OCR de imagem cai (manual salva).
6. **BUG-EQID-01** — Projetos legados sem `equipamento_id`.
7. **NEW-03** — Catálogo de estruturas/baterias vazio.
8. **BUG-ARCH-01** — Frontend acoplado a `backend/src`.
9. **BUG-LAY-01** — Editor de layout não representa multiarranjo.
10. **Dependência de `resolverClientePorNome`** no E8 — salvar falha se o nome não casar.

---

## FASE 8 — ROADMAP

Ver `FV_PRODUCTION_READINESS_ROADMAP.md`.

---

## RESPOSTAS OBRIGATÓRIAS

1. **Maturidade do FV (%):** **~80%** (núcleo sólido; pendências de durabilidade e qualidade de catálogo).
2. **Bugs P0 restantes:** **2** — BUG-CAT-01, BUG-QUAL-01.
3. **Bugs P1 restantes (em escopo):** **3** — NEW-01 (homologação memória), NEW-02 (persistência wizard), BUG-EQID-01.
4. **Maior risco operacional:** NEW-01 — status de homologação em `Map()` em memória, perdido a cada redeploy do Railway.
5. **Maior dívida técnica:** BUG-QUAL-01 — motor de qualidade miscalibrado, desacoplado do gate `utilizavel_em_projeto` (registros ocos passam).
6. **Produção aprovada?** Não sem ressalvas.
7. **Produção aprovada com ressalvas?** **SIM.**
8. **Produção reprovada?** Não.
9. **Próxima sprint recomendada:** **P0-FV-PERSISTENCE-HARDENING-01** — (a) migrar tracking de homologação `Map()` → subdoc MongoDB no `ProjetoFV`; (b) criar o projeto mais cedo (etapa 2/3) para persistência server-side contínua; (c) corrigir o gate `utilizavel_em_projeto` para barrar inversores/módulos sem specs.
10. **Commit gerado:** ver rodapé (entregáveis desta auditoria).

---

## RESULTADO FINAL

```
PRONTO PARA PRODUÇÃO COM RESSALVAS
```

**Ressalvas bloqueantes de durabilidade (corrigir antes de operação comercial intensa):**
- NEW-01 — persistir status de homologação no MongoDB.
- NEW-02 — persistência server-side do wizard antes do passo 8.

**Ressalvas de qualidade (corrigir em seguida):**
- BUG-QUAL-01 / BUG-CAT-01 — confiabilidade do gate de catálogo.

**Pendência de processo:**
- Revisão cruzada por Gemini (obrigatória pela sprint) — executar externamente.
