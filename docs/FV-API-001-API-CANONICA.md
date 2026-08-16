# FV-API-001 — API canônica dos agregados FV

**Data:** 2026-08-07
**Resultado:** 6 endpoints de leitura respondendo direto pelos agregados. Providers sem placeholders. `GET /:id` inalterado.

---

## 1. Auditoria — mapa antigo × novo

### Permanecem (sem alteração)

| Endpoint | Papel |
|---|---|
| `GET /api/projetos-fv` | listagem |
| `GET /api/projetos-fv/:id` | projeto + campos derivados — **contrato preservado** |
| `GET /:id/totais`, `GET /:id/telhado`, `GET /cliente/:clienteId` | leituras auxiliares |
| `POST /`, `PUT /:id`, `PATCH /:id`, `DELETE /:id` | CRUD |
| `PUT /:id/etapa` | write path do wizard (grava no agregado desde FV-DOM-002) |
| `POST /:id/duplicar` · `/ampliar` · `/arquivar` · `/restaurar` · `PUT /:id/status` | ciclo de vida |
| `GET /api/instalacoes/:id` | topologia |

### Substituídas (a antiga continua viva)

| Antiga | Nova | Diferença |
|---|---|---|
| `GET /:id` → campo `orcamento` (projeção legada) | `GET /:id/orcamentos` | N orçamentos, forma própria, sem adapter |
| `GET /:id` → campo `orcamento_vigente` | `GET /:id/orcamentos/vigente` | endpoint dedicado |
| — (não havia) | `GET /:id/cotacoes` | N cotações |
| `governanca.freeze_status` lido pela UI | `GET /:id/gate` | decisão autoritativa do domínio |

### Obsoletas (mantidas — a sprint proíbe remover)

`POST /:id/governanca/congelar` · `PUT /:id/governanca/status` · `POST /:id/governanca/comercial/cenario/*` (4) · `POST /:id/governanca/comercial/snapshot` · `POST /api/orcamento/gerar` · `POST /api/orcamento/validar`

Sucessão: congelar vira consequência da aprovação; cenários viram Cotações; snapshot vira Baseline.

### Faltantes — implementadas nesta sprint

Todas as 6 do escopo. Continua faltando: **escrita** pelos agregados (criar/emitir/aprovar cotação e orçamento) — fora do escopo declarado (*"Implementar exclusivamente leitura"*).

---

## 2. Endpoints criados

[`agregadosFvController.js`](../backend/src/controllers/agregadosFvController.js) — 6 handlers, todos somente leitura, registrados em [`routes/projetosFV.js`](../backend/src/routes/projetosFV.js) sob os guards já existentes (`protegerModulo('fv')` + `exigirOrganizacao`).

| Método | Rota | Agregado |
|---|---|---|
| GET | `/api/projetos-fv/:id/cotacoes` | `Cotacao` |
| GET | `/api/projetos-fv/:id/orcamentos` | `Orcamento` |
| GET | `/api/projetos-fv/:id/orcamentos/vigente` | `Orcamento` |
| GET | `/api/projetos-fv/:id/baseline` | `Baseline` |
| GET | `/api/projetos-fv/:id/gate` | Gate (domínio) |
| GET | `/api/projetos-fv/:id/fases` | Gate + fases |

**Sem adapters:** nenhum handler passa por `obterOrcamentoProjeto` nem produz a forma legada. Provado no check: a resposta não contém `kit`, `modo` nem `itens_adicionais`.

**Sem regra nova:** toda decisão vem de `CotacaoService`, `OrcamentoService`, `BaselineService` e `dominio/gate` — nenhum deles alterado.

**M-4 em toda consulta:** o projeto é resolvido dentro do escopo antes de qualquer leitura. Outra organização recebe **404**, não lista vazia.

---

## 3. Payloads

### `GET /:id/cotacoes`
```jsonc
{ "projeto_ref": "…", "total": 3,
  "cotacoes": [{ "_id","rotulo","tecnologia","premissas","composicao",
                 "local_ref","instalacao_ref","criado_por","createdAt" }] }
```

### `GET /:id/orcamentos`
```jsonc
{ "projeto_ref": "…", "total": 3, "aprovado_ref": "…|null",
  "orcamentos": [{ "_id","numero","versao","estado","cotacao_ref","baseline_ref",
                   "itens","condicoes",
                   "totais": { "total_material_r","total_servicos_r","total_venda_r" },
                   "emitido_em","aprovado_em","encerrado_em","motivo_encerramento",
                   "historico","createdAt" }] }
```
`totais` é **derivado a cada leitura** (INV-58) — o agregado não os persiste.

### `GET /:id/orcamentos/vigente`
```jsonc
{ "projeto_ref": "…", "orcamento": { /* mesma forma acima */ } | null }
```

### `GET /:id/baseline`
```jsonc
{ "projeto_ref": "…", "integra": true|false|null,
  "baseline": { "_id","orcamento_ref","cotacao_ref","conteudo","hash","algoritmo",
                "congelado_em","congelado_por" } | null }
```
`integra` é calculado **no servidor** — o cliente não tem como recalcular o hash.

### `GET /:id/gate`
```jsonc
{ "projeto_ref": "…", "autoritativo": true, "baseline_ref": "…|null",
  "fases": { "engenharia":  { "liberado","motivo","mensagem" },
             "homologacao": { "liberado","motivo","mensagem" } } }
```

### `GET /:id/fases`
```jsonc
{ "projeto_ref": "…", "total": 2, "ambas_concluidas": null,
  "fases": [{ "chave","rotulo","paralela": true,"liberada","motivo_bloqueio",
              "concluida": null,"agregado": null,"sprint_responsavel": "FV-DOM-006" }] }
```

**Decisão registrada:** `concluida` e `ambas_concluidas` são **`null`, não `false`**. Não existe agregado que registre a conclusão de uma fase (FV-DOM-006). `false` afirmaria que a fase não concluiu; `null` diz que não sabemos — que é a verdade.

---

## 4. Providers atualizados

| Provider | Endpoint | Antes (FV-UX-010) |
|---|---|---|
| `ProjetoProvider` | `GET /:id` | igual |
| `OrcamentosProvider` | `GET /:id/orcamentos` | lia `orcamento_vigente`; `listaCompleta: false` |
| `CotacoesProvider` | `GET /:id/cotacoes` | lista vazia; só `cotacao_ref` |
| `ContratoProvider` | `GET /:id/baseline` + `/gate` | **calculava a decisão no cliente** |
| `FasesProvider` | `GET /:id/fases` | não existia |

Novo utilitário `usarRecurso.js` (43 linhas) centraliza `{dados, carregando, erro, recarregar}` e descarta respostas obsoletas quando o `projetoId` muda no meio do carregamento.

### A mudança mais relevante

`ContratoProvider` **deixou de calcular**. Na FV-UX-010 ele avaliava o congelamento no cliente porque não havia endpoint; agora lê a decisão do servidor:

```diff
- gateAutoritativo: false      // indicação calculada no cliente
- baselineVerificada: false    // hash não verificável
+ gateAutoritativo: true       // decisão do domínio
+ baselineIntegra: true|false  // verificada no servidor
```

---

## 5. Auditoria §5

```
endpointPendente / listaCompleta / ENDPOINTS_PENDENTES:  0 ocorrências
leitura do subdocumento legado:                          0 ocorrências
providers importando a API canônica:                     5/5
```

### Placeholders restantes — e por quê

3 telas ainda usam `EtapaPendente`: **Projeto Executivo, Execução, As-Built**.

Isso é **diferente** do que o §5 pede eliminar. Aqueles placeholders existiam por **falta de endpoint** — foram removidos. Estes existem porque os **agregados não existem** (`ProjetoExecutivo`, `Execucao`, `AsBuilt` são da FV-DOM-006/007), e a sprint proíbe criar agregados. Não há endpoint possível para dados que ninguém persiste.

Os **providers**, que é o que o §5 audita, estão sem placeholder algum.

---

## 6. Compatibilidade (§3)

`GET /api/projetos-fv/:id` **não foi tocado**. Verificado no check que os 5 campos permanecem:

```
✓ campo `orcamento` continua na resposta
✓ campo `orcamento_vigente` continua na resposta
✓ campo `local_resolvido` continua na resposta
✓ campo `arranjos_normalizados` continua na resposta
✓ campo `totais` continua na resposta
✓ nenhum consumidor legado quebrou
```

Nenhuma rota antiga foi removida ou alterada. A UX antiga não foi tocada.

---

## 7. Validação

[`agregadosFv.check.js`](../backend/src/controllers/__checks__/agregadosFv.check.js) — **43/43**:

```bash
node backend/src/controllers/__checks__/agregadosFv.check.js
```

Cobertura: 3 cotações + 3 orçamentos, aprovação real gerando Baseline, rejeição preservada no histórico, gate antes/depois, baseline adulterada fechando o gate com `BASELINE_CORROMPIDA`, M-4 nos 6 endpoints, ID inválido → 400, e a compatibilidade do `GET /:id`.

### Regressão

| Check | Resultado |
|---|---|
| Backend `node --check` + boot | ✓ |
| `fluxoCanonico` · `congelamento` · `legadoOrcamento` · `convergenciaOrcamento` · `estadosFV` · `lme` | ✓ todos |
| `instalacaoRefEtapa` | 5 falhas — pré-existente |
| Build frontend | ✓ 2388 → **2389 módulos** |
| Suíte frontend | **idêntica ao baseline** (25 falhas pré-existentes) |
| Suítes que não coletaram | **0** |
| Arquivos do Core alterados | **0** |

---

## Critério de conclusão

| Exigência | Status |
|---|---|
| API alinhada ao domínio novo | ✅ 6 endpoints, direto dos agregados |
| Providers consumindo só endpoints canônicos | ✅ 5/5 |
| Zero placeholders (nos providers) | ✅ |
| Zero `endpointPendente` | ✅ 0 ocorrências |
| Nenhuma regressão | ✅ |

**Nada commitado.**
