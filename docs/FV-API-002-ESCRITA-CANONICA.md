# FV-API-002 — Escrita canônica do fluxo comercial FV

**Data:** 2026-08-12
**Resultado:** fluxo Cotação → Orçamento → Aprovação → Baseline → Gate operável pela API. Nenhuma regra nova; delegação pura ao domínio.

---

## Achado que precede o relatório

A sprint foi encontrada **parcialmente executada** — uma rodada anterior foi interrompida no meio e deixou três defeitos estruturais:

| # | Defeito | Impacto |
|---|---|---|
| **D-1** | **Dois controllers paralelos** com os mesmos 9 handlers de escrita: `agregadosFvController.js` e `agregadosFvEscritaController.js` | Viola diretamente *"Não criar implementação paralela"* |
| **D-2** | **Bloco de 9 rotas duplicado** em `routes/projetosFV.js` | Segundo registro é código morto (Express usa o primeiro) |
| **D-3** | **Import duplicado** dos mesmos símbolos | `SyntaxError: Identifier 'criarCotacao' has already been declared` — **o backend não subia** |

Corrigido: mantido o controller **unificado** (mais recente, leitura + escrita coesas, `filhoNoEscopo` compartilhado para M-4), removidos o paralelo, o bloco duplicado e o import redundante. O check que apontava para o controller paralelo foi redirecionado.

---

## FASE 1 — Auditoria das operações de escrita

| Operação | Service | Método | Já possui regra? | Endpoint antes | Falta |
|---|---|---|---|---|---|
| Criar cotação | `CotacaoService` | `criar(dados)` | ✅ valida M-4, projeto, catálogo | ❌ | endpoint |
| Consultar cotação | `CotacaoService` | `buscar(id)` | — | ❌ | endpoint |
| Listar cotações | `CotacaoService` | `listarPorProjeto(filtro)` | — | ✅ FV-API-001 | — |
| Atualizar cotação | `CotacaoService` | `atualizar(id, patch)` | ✅ revalida | ❌ | **não exposto** (ver nota) |
| Excluir cotação | `CotacaoService` | `excluir(id)` | — | ❌ | **não exposto** (ver nota) |
| Criar orçamento | `OrcamentoService` | `criar(dados)` | ✅ valida cotação do mesmo projeto (M-1) | ❌ | endpoint |
| Editar conteúdo | `OrcamentoService` | `atualizarConteudo(id, patch)` | ✅ recusa a partir de EMITIDO | ❌ | endpoint |
| Emitir / rejeitar / cancelar | `OrcamentoService` | `transicionar(id, estado, opts)` | ✅ máquina de estados canônica | ❌ | endpoint |
| Aprovar | `OrcamentoService` | `aprovar(id, opts)` | ✅ congela + gera Baseline + INV-ORC-3 | ❌ | endpoint |
| Vigente | `OrcamentoService` | `vigenteDoProjeto(filtro)` | ✅ regra do vigente | ✅ FV-API-001 | — |
| Criar baseline | — | — | nasce **só** de `aprovar` | ❌ | **não deve existir** |
| Consultar baseline | `BaselineService` | `doProjeto(filtro)` | ✅ verifica integridade | ✅ FV-API-001 | — |
| Gate | `BaselineService` | `avaliarGate(fase, filtro)` | ✅ decisão autoritativa | ✅ FV-API-001 | — |

**Conclusão da FASE 1:** **toda** operação necessária já existia no domínio. Nada precisou ser criado — não houve motivo para parar e reportar.

**Nota sobre atualizar/excluir cotação:** existem no service mas **não foram expostas**. O escopo pede apenas criar/listar/consultar, e *"eventualmente selecionar/associar, somente se essa operação já existir no domínio"*. Não existe operação de "selecionar cotação" no domínio — a escolha acontece implicitamente ao criar um orçamento com aquele `cotacao_ref`. Expor edição/exclusão sem pedido seria ampliar escopo.

---

## FASE 2 — Contrato implementado

### Escrita (FV-API-002)

| Método | Rota | Delega a |
|---|---|---|
| POST | `/:id/cotacoes` | `CotacaoService.criar` |
| POST | `/:id/orcamentos` | `OrcamentoService.criar` |
| PUT | `/:id/orcamentos/:orcamentoId` | `OrcamentoService.atualizarConteudo` |
| POST | `/:id/orcamentos/:orcamentoId/emitir` | `transicionar('EMITIDO')` |
| POST | `/:id/orcamentos/:orcamentoId/aprovar` | `aprovar` |
| POST | `/:id/orcamentos/:orcamentoId/rejeitar` | `transicionar('REJEITADO')` |
| POST | `/:id/orcamentos/:orcamentoId/cancelar` | `transicionar('CANCELADO')` |

### Leitura adicionada

`GET /:id/cotacoes/:cotacaoId` · `GET /:id/orcamentos/:orcamentoId`

### Baseline — sem escrita, por desenho

**Não existe** POST, PUT, PATCH nem DELETE de Baseline. Ela nasce exclusivamente de `/orcamentos/:id/aprovar` e é imutável (M-2). O check verifica que `criarBaseline` não é exportado.

### Ordem das rotas

`/orcamentos/vigente` é declarada **antes** de `/orcamentos/:orcamentoId` — senão o parâmetro capturaria a palavra "vigente" como id. Verificado no check.

---

## FASE 3 — Cotação

| Garantia | Como |
|---|---|
| N cotações por projeto | nenhum limite; `CotacaoService.criar` não restringe |
| Pertence ao projeto correto | `projetoNoEscopo` + validação do service |
| Não vira Orçamento automaticamente | criar cotação não toca `Orcamento` |
| Não abre Engenharia / Homologação | Gate depende de Baseline, que depende de aprovação |
| Não cria Baseline | só `aprovar` cria |
| Não abre Gate | idem |

---

## FASE 4 — Orçamento

| Garantia | Como |
|---|---|
| N orçamentos por projeto | `criar` não restringe |
| `cotacao_ref` válido e do mesmo projeto | validado em `OrcamentoService.validar` (M-1) |
| Histórico preservado | rejeitados/cancelados permanecem na listagem |
| Vigente determinado pelo service | `vigenteDoProjeto` — controller e frontend não deduzem |
| Não persiste em `ProjetoFV.orcamento` | verificado pelo `legadoOrcamento.check.js` |

---

## Delegação pura — o princípio da camada

Cada handler faz exatamente três coisas: resolve posse (M-4), chama **uma** operação de domínio, traduz erro em HTTP.

Nenhuma regra é reimplementada no controller: validação de transição, unicidade do aprovado (INV-ORC-3), congelamento e travamento de conteúdo vivem nos services. O controller não conhece a máquina de estados — passa o estado alvo e recebe o erro tipado.

**Posse (M-4) é responsabilidade da borda:** os services recebem `id` puro e não filtram por tenant. Sem `filhoNoEscopo`, conhecer um `_id` bastaria para operar sobre recurso de outra organização. O check cobre os 9 handlers de escrita com dois tenants.

---

## Validação

[`fluxoComercialEscrita.check.js`](../backend/src/controllers/__checks__/fluxoComercialEscrita.check.js):

```
OK — fluxo comercial operável pela API: Cotação → Orçamento → Aprovação → Baseline → Gate
```

Cobertura relevante:

| Prova | Resultado |
|---|---|
| Exatamente 1 aprovado (INV-ORC-3) | ✓ |
| `APROVADO → EMITIDO` → 422 `TRANSICAO_INVALIDA` | ✓ |
| 3 orçamentos coexistem — nada apagado | ✓ |
| Vigente vem do `OrcamentoService` | ✓ |
| `updateOne` na Baseline → `BASELINE_IMUTAVEL` | ✓ |
| Não existe endpoint de escrita de Baseline | ✓ |
| Gate abre após aprovação; fecha com baseline adulterada (`BASELINE_CORROMPIDA`) | ✓ |
| **Tenant B → 404 nos 9 handlers de escrita de A** | ✓ |
| Orçamento de outro projeto do mesmo tenant → 404 | ✓ |
| Reaprovar não duplica cotação, orçamento nem Baseline | ✓ |
| Erros de domínio nunca viram 500 | ✓ |
| Todo caminho chamado pela UX existe no router | ✓ |
| `/orcamentos/vigente` declarada antes de `/:orcamentoId` | ✓ |

### Regressão

| Check | Resultado |
|---|---|
| `node --check` backend + boot | ✓ (antes do fix, **não subia**) |
| `agregadosFv` · `fluxoCanonico` · `congelamento` · `legadoOrcamento` · `convergenciaOrcamento` · `estadosFV` · `lme` | ✓ todos |
| `instalacaoRefEtapa` | 5 falhas — pré-existente |
| Build frontend | ✓ 2392 → **2393 módulos** |
| Suíte frontend | **idêntica ao baseline** — 25 falhas, 940 passando |

---

## Critério de conclusão

| Exigência | Status |
|---|---|
| Fluxo comercial operável pela API | ✅ |
| Reutilização do domínio, sem implementação paralela | ✅ **após remover a duplicação encontrada** |
| Sem segunda máquina de estados | ✅ controller não conhece transições |
| Sem regra no frontend | ✅ cliente só repassa erro do servidor |
| Sem escrita no legado | ✅ verificado |
| Baseline sem endpoint de escrita | ✅ |

**Nada commitado.**
