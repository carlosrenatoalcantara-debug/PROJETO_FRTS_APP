# DEPLOY_E2E_VALIDATION_REPORT.md

**Sprint:** P6-DEPLOY-E2E-VALIDATION-01
**Modelo:** Sonnet
**Data:** 2026-06-19
**Revisão Gemini:** NÃO

---

## DECLARAÇÃO DE HONESTIDADE

Esta sprint de validação foi executada **EXCLUSIVAMENTE por análise estática de código** (leitura, grep, rastreamento de fluxo). **NÃO houve acesso a nenhum ambiente externo**:

| Ambiente | Status |
|---|---|
| Railway (backend) | ✗ SEM ACESSO |
| Vercel (frontend) | ✗ SEM ACESSO |
| MongoDB Atlas | ✗ SEM ACESSO |
| Android físico | ✗ SEM ACESSO |
| iPhone físico | ✗ SEM ACESSO |
| Browser real | ✗ SEM ACESSO |

**Separação clara:**

- `[CÓDIGO]` = validado por leitura/análise de código
- `[EXEC]` = requer execução real — NÃO testado

---

## OBJETIVO DA VALIDAÇÃO

Auditar o código das sprints P4 e P5 em busca de bugs, regressões e inconsistências:

- P4-GEMEO-DIGITAL-UNIFILAR-ATIVO-01
- P4-GEMEO-DIGITAL-OM-FORENSICS-01
- P5-PROJETO-DOCUMENTOS-EXTERNOS-01
- P5-ATIVO-MEDICOES-01
- P5-GARANTIA-SIMPLES-01

---

## FASE 1 — LOGIN

**Status:** `[EXEC]` — NÃO TESTADO

Requer acesso ao Vercel/Railway/Atlas. Não é possível validar login, refresh ou persistência de sessão por análise de código apenas.

---

## FASE 2 — PROJETOS FV

**Status:** `[EXEC]` — NÃO TESTADO

Carregamento, edição e salvamento de projetos legados/novos/congelados/homologados requer ambiente real.

---

## FASE 3 — DIMENSIONAMENTO FV

**Status:** `[EXEC]` — NÃO TESTADO

---

## FASE 4 — ORÇAMENTO

**Status:** `[EXEC]` — NÃO TESTADO

---

## FASE 5 — GOVERNANÇA

**Status:** `[EXEC]` — NÃO TESTADO

---

## FASE 6 — HOMOLOGAÇÃO

**Status:** `[EXEC]` — NÃO TESTADO

---

## FASE 7 — DOCUMENTOS EXTERNOS (P5)

**Validado por:** `[CÓDIGO]`

| Item | Status | Observação |
|---|---|---|
| Endpoint PATCH `/api/projetos-fv/:id` | ✓ CONFIRMADO | Existe e mapeia para `atualizarProjetoFV` (line 92 de `routes/projetosFV.js`) |
| `findByIdAndUpdate(req.params.id, req.body, {new: true})` | ✓ CONFIRMADO | Recebe `{ documentacao_externa: {...} }` e atualiza subdoc |
| Links abrem em nova aba | ✓ CONFIRMADO | `window.open(url, '_blank', 'noopener,noreferrer')` — correto |
| Form salva payload correto | ✓ CONFIRMADO | `payload` filtrado com `|| null` para campos vazios |
| Projeto legado (documentacao_externa null) | ✓ CONFIRMADO | `const doc = projeto?.documentacao_externa || {}` — coalescido corretamente |
| OneDrive link real | `[EXEC]` | Não testado sem ambiente real |
| Google Drive link real | `[EXEC]` | Não testado sem ambiente real |

---

## FASE 8 — GÊMEO DIGITAL

**Validado por:** `[CÓDIGO]`

### AtivoQR.jsx
| Item | Status | Observação |
|---|---|---|
| Carregamento QR endpoint | ✓ CONFIRMADO | `fetch('/api/ativos/qr/:qr')` — resposta corretamente parseada |
| `dados.ativo._id` usado em MedicoesAtivoCard | ✓ CONFIRMADO | Condicional `dados.ativo?._id &&` correto |
| `dados.equipamento_catalogo.suporte` em GarantiaCard | ✓ CONFIRMADO | Projeção extendida; `GarantiaCard` aceita null |
| `documentacao_externa.pasta_principal` → link pasta | ✓ CONFIRMADO | Campo exposto na resposta QR |

### GarantiaCard.jsx
| Item | Status | Observação |
|---|---|---|
| Render condicional (null se sem dados) | ✓ CONFIRMADO | `if (!temGarantia && !temContato) return null` |
| Status badge (ATIVA/PRÓXIMA/VENCIDA) | ✓ CONFIRMADO | Lógica: >90d verde, ≤90d âmbar, ≤0d vermelho |
| Link portal fabricante (nova aba) | ✓ CONFIRMADO | `target="_blank" rel="noopener noreferrer"` |
| Telefone `tel:` link | ✓ CONFIRMADO | `href={`tel:${suporte.telefone}`}` |
| Email `mailto:` link | ✓ CONFIRMADO | `href={`mailto:${suporte.email}`}` |

### MedicoesAtivoCard.jsx
| Item | Status | Observação |
|---|---|---|
| Fetch `/api/ativos/:id/medicoes` | ✓ CONFIRMADO | URL correta; lista em ordem reversa (backend) |
| Form Nova Medição | ✓ CONFIRMADO | Campos tipo/data/observação/elétricos/link_foto/técnico |
| Editar medição existente | ✓ CONFIRMADO | `editando = med._id` → PUT endpoint |
| `window.confirm` na remoção | ⚠️ BUG-P2 | Ver BUG-P5-MEDICOES-01 abaixo |
| Link foto (nova aba) | ✓ CONFIRMADO | `target="_blank" rel="noopener noreferrer"` |
| Última medição destacada | ✓ CONFIRMADO | `medicoes[0]` (backend retorna reverso) |

### MonitoramentoCard.jsx
| Item | Status | Observação |
|---|---|---|
| Sem alterações P4/P5 | ✓ CONFIRMADO | Não tocado em nenhuma sprint recente |

---

## FASE 9 — UNIFILAR

**Validado por:** `[CÓDIGO]`

### ⚠️ BUG CRÍTICO ENCONTRADO — BUG-P4-UNIFILAR-01

**Descrição:** O fetch de ativos em `UnifilarFV.jsx` nunca popula o array `ativos[]`.

**Root cause:**

```js
// CÓDIGO ATUAL (UnifilarFV.jsx linhas 25-28)
fetch(`/api/ativos/projeto/${projeto._id}`)
  .then(r => r.ok ? r.json() : [])
  .then(data => setAtivos(Array.isArray(data) ? data : []))  // ← BUG AQUI
  .catch(() => {})
```

`listarAtivosProjeto` retorna `{ sucesso: true, total: N, por_tipo: {...}, itens: [...] }`.

`Array.isArray(data)` = `false` → `setAtivos([])` é chamado **sempre**.

**Impacto:**
- `ativos` sempre é `[]`
- `ativoModulo` e `ativoInversor` sempre são `undefined`
- `ativoGAttrs()` sempre retorna `''` (sem atributos)
- Nenhum `<g data-ativo-id="...">` é gerado no SVG
- Click no símbolo do painel/inversor não navega para o ativo
- Badge "N ativos vinculados" nunca exibe

**Correção necessária (próxima sprint):**
```js
.then(r => r.ok ? r.json() : { itens: [] })
.then(data => setAtivos(Array.isArray(data?.itens) ? data.itens : []))
```

**Severidade:** P1 — core feature do P4 é silenciosamente inoperante

| Item | Status | Observação |
|---|---|---|
| Gerar SVG | ✓ CONFIRMADO | SVG gerado corretamente sem ativos |
| Click no painel → AtivoEquipamento | ✗ BUG-P1 | BUG-P4-UNIFILAR-01 |
| Click no inversor → AtivoEquipamento | ✗ BUG-P1 | BUG-P4-UNIFILAR-01 |
| Badge ativos vinculados | ✗ BUG-P1 | Consequência do BUG-P4-UNIFILAR-01 |
| Snapshot congelado (origem explícita) | ✓ CONFIRMADO | `svgCongelado` lido de `governanca.snapshot_unifilar.svg` |
| Link "Gêmeo Digital (unifilar operacional)" | ✓ CONFIRMADO | `<Link to={'/unifilar/${projeto._id}'}` — correto |
| Hover cursor pointer no SVG | ✗ BUG-P1 | Consequência: sem `data-ativo-id`, sem cursor:pointer |

---

## FASE 10 — SCANNER

**Status:** `[EXEC]` — NÃO TESTADO

Requer Android/iPhone físico com câmera.

---

## FASE 11 — ALERTCENTER

**Validado por:** `[CÓDIGO]`

| Item | Status | Observação |
|---|---|---|
| `'garantia'` adicionado a `ORIGENS[]` | ✓ CONFIRMADO | `alertDetectors.js` linha atualizada |
| `detectarAlertasGarantia` function | ✓ CONFIRMADO | Severidades: critico(≤0d), aviso(≤30d), info(≤90d) |
| `agregarAlertas()` inclui detector de garantia | ✓ CONFIRMADO | `...detectarAlertasGarantia(ativos, hoje)` |
| `calcularKPIs()` — `por_origem.garantia` | ✓ CONFIRMADO | Inicializado como 0 |
| `calcularKPIs()` — `garantias_vencidas`, `garantias_vencendo` | ✓ CONFIRMADO | Adicionados a `cards` |
| `alertcenter.js` import `AtivoEquipamento` | ✓ CONFIRMADO | Named import; modelo usa named export |
| Query ativos com `garantia_fim != null` | ✓ CONFIRMADO | Projeção mínima: fabricante, modelo, qr_code, garantia_fim, status |
| `ORIGEM_LABEL.garantia = 'Garantia'` (frontend) | ✓ CONFIRMADO | AlertCenter.jsx atualizado |
| ⚠️ Query inclui ativos substituídos/desativados | ⚠️ BUG-P2 | Ver BUG-P5-ALERTCENTER-01 abaixo |
| Alertas de homologação, RT, catálogo, fatura | ✓ CONFIRMADO | Detectores existentes intocados |

---

## FASE 12 — REGRESSÕES

**Validado por:** `[CÓDIGO]`

| Área | Status |
|---|---|
| ProjetoEV | ✓ INTACTO |
| QR code generation | ✓ INTACTO |
| EtiquetaScanner | ✓ INTACTO |
| Comissionamento | ✓ INTACTO |
| Monitoramento (salvarMonitoramento) | ✓ INTACTO |
| Segurança AES-256-GCM | ✓ INTACTO — `suporte[]` não tem campos sensíveis |
| Snapshot / Governança | ✓ INTACTO |
| Homologação | ✓ INTACTO |
| `MedicaoSchema._id` autogerado | ✓ CONFIRMADO — `.id(medicaoId)` e `findIndex` funcionam |
| `HistoricoSchema` enum extendido | ✓ CONFIRMADO — `'medicao'` adicionado sem quebrar tipos existentes |

---

## BUGS ENCONTRADOS (matriz detalhada em DEPLOY_E2E_BUG_MATRIX.json)

| ID | Prioridade | Sprint | Arquivo | Descrição curta |
|---|---|---|---|---|
| BUG-P4-UNIFILAR-01 | **P1** | P4 | UnifilarFV.jsx:26-27 | Fetch ativos: `data.itens` não extraído → sempre `[]` |
| BUG-P5-ALERTCENTER-01 | P2 | P5 | alertcenter.js | Query inclui ativos substituídos/desativados → alertas espúrios |
| BUG-P5-MEDICOES-01 | P2 | P5 | MedicoesAtivoCard.jsx:122 | `window.confirm()` bloqueado em iOS PWA standalone |
| BUG-P5-GARANTIA-01 | P3 | P5 | ativosController.js | `_autoPreencherGarantia`: sem validação ObjectId antes de `findById` |
| MELHORIA-P5-MEDICOES-02 | P3 | P5 | ativosController.js | Medições não incluídas no payload inicial do QR → 2 fetches |
| MELHORIA-P5-GARANTIA-02 | P3 | P5 | alertDetectors.js | Link AlertCenter `/ativo/QR` — verificar roteamento SPA |

---

## RESPOSTAS ÀS 9 QUESTÕES

1. **Fluxos testados:** 5 áreas por análise de código (Documentos Externos, Gêmeo Digital, Unifilar, AlertCenter, Regressão). 7 fases marcadas como [EXEC] — requerem ambiente real.

2. **Bugs encontrados (total):** 6 (2 bugs reais + 1 UX crítico + 3 melhorias)

3. **P0:** 0

4. **P1:** 1 — BUG-P4-UNIFILAR-01 (core feature P4 inoperante)

5. **P2:** 2 — BUG-P5-ALERTCENTER-01, BUG-P5-MEDICOES-01

6. **P3:** 3 — BUG-P5-GARANTIA-01, MELHORIA-P5-MEDICOES-02, MELHORIA-P5-GARANTIA-02

7. **Regressões encontradas:** Zero em áreas não-alteradas (ProjetoEV, QR, Scanner, Segurança, Homologação, Monitoramento, Comissionamento — todos intactos).

8. **Funcionalidades aprovadas sem ressalva (por análise de código):**
   - DocumentosExternos (P5): PATCH correto, links corretos, projeto legado tratado
   - GarantiaCard (P5): render condicional, status badge, contatos, portal
   - MedicoesAtivoCard (P5): form, lista, destaque última medição, link foto (exceto window.confirm)
   - AlertCenter integração garantia: detector, severidades, KPIs
   - AtivoEquipamento.medicoes schema: subdoc, enum, _id autogerado, retrocompatível
   - Equipamento.suporte schema: todos opcionais, retrocompatível
   - Auto-fill garantia_fim: lógica correta, sem inventar valores

9. **Commit:** NÃO — sprint de validação apenas. Aguardando correção do BUG-P4-UNIFILAR-01 antes de commit.

---

## NÃO CORRIGIDO

Conforme restrições desta sprint: **nenhum código foi alterado**. Todos os bugs documentados aguardam sprint de correção.
