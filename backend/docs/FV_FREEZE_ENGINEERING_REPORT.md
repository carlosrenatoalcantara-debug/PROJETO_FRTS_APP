# Sprint P1-FV-FREEZE-TO-ENGINEERING-01 — Relatório

**Data:** 2026-06-18
**Executor:** Sonnet 4.6
**Revisão Gemini:** OBRIGATÓRIA E PENDENTE
**Branch:** sprint/p1-fv-freeze-to-engineering-01
**Escopo exclusivo:** Projeto FV / Governança / Engenharia. Não tocou ProjetoEV, Ativos, QR, Comissionamento, Segurança.

---

## FASE 1 — Forense

### 1. O que já era congelado

`POST /api/projetos-fv/:id/governanca/congelar` (`congelarProjetoFV`) já gravava, no subdoc `governanca`:
`snapshot_tecnico` (modelo elétrico + geração), `snapshot_catalogo` (módulo + inversor: fabricante/modelo/specs/qtd/score/hash), `snapshot_unifilar` (SVG), `snapshot_memorial`, `snapshot_financeiro`, `snapshot_empresa`, `snapshot_tecnico_identificacao`, `snapshot_responsavel_tecnico`, `snapshot_geoespacial`. Status de freeze: `RASCUNHO | EM_REVISAO | CONGELADO | HOMOLOGADO`. `GET /governanca/divergencia` comparava `snapshot_catalogo` vs catálogo vivo (`Equipamento`).

### 2. O que NÃO era congelado

- **Itens adicionais** do orçamento kit (ampliação, inversor extra, BESS, adequação) — ausentes do `snapshot_catalogo`.
- **Arranjos extra** (blocos multi-MPPT além do primário) — `construirSnapshotCatalogo` só recebia o painel/inversor primário.
- **Status APROVADO** — inexistente. Não havia etapa de aprovação comercial entre RASCUNHO e CONGELADO.

### 3. Quais dados da engenharia dependiam do catálogo vivo

- **Unifilar** (`UnifilarFV.jsx`): **já priorizava** o snapshot congelado (`governanca.snapshot_unifilar.svg`) com rótulo de origem explícito; regenerar usa dados atuais (declarado). ✓ (sem regressão necessária)
- **Homologação / Relatórios**: liam equipamentos do projeto vivo. Faltava um ponto único de priorização do snapshot.

---

## FASE 2 — Snapshot de equipamentos

`construirSnapshotCatalogo` passou a congelar, além de módulos e inversores (que já traziam **potências, quantidades, fabricantes, modelos** via `snapshotEquipamento`):

- **Itens adicionais** (`itens_adicionais[]`): descrição, quantidade, valor, tipo (material/serviço), subtotal.
- **Arranjos extra** (`arranjos_extra[]`): módulo + inversor de cada bloco multi-MPPT secundário.

`construirTodosSnapshots` passou a repassar `orcamentoLocal.itensAdicionais` e `state.arranjos`. Campos aditivos no `snapshot_catalogo` (Mixed) — **sem alteração de schema**.

**Verificado (Node):** subtotal de item material 2×4000 = 8000; tipo serviço preservado; arranjo extra (Trina TSM-550) congelado.

---

## FASE 3 — Congelamento comercial (status)

Adicionado o status **APROVADO** ao ciclo de vida:

```
RASCUNHO → APROVADO → CONGELADO → HOMOLOGADO
```

- **Schema** (`ProjetoFV.governanca.freeze_status`): enum estendido com `APROVADO` (aditivo).
- **Backend** (`alterarStatusGovernanca`): `APROVADO` aceito + **validação de transição** (`TRANSICOES_VALIDAS`, HTTP 422 `TRANSICAO_INVALIDA` em transição ilegal).
- **Frontend** (`GovernancaPainel`): botão **"Aprovar Comercialmente"** (RASCUNHO/EM_REVISAO → APROVADO via `PUT /governanca/status`). O botão **"Congelar Proposta"** fica **desabilitado até APROVADO** (`disabled={!aprovado}`), com aviso "Aprove a proposta para liberar o congelamento."
- **Helper** `transicaoFreezeValida(de, para)` (espelha o backend).

**Verificado (Node):** RASCUNHO→APROVADO, APROVADO→CONGELADO, CONGELADO→HOMOLOGADO válidas; RASCUNHO→CONGELADO e HOMOLOGADO→CONGELADO inválidas.

---

## FASE 4 — Engenharia prioriza o snapshot

- **Unifilar**: já priorizava o snapshot (confirmado, sem mudança).
- **Helper novo** `obterEquipamentosEngenharia(projeto)`: retorna `{ origem: 'snapshot'|'vivo', modulo, inversor, itens_adicionais, arranjos_extra }`. Quando `freeze_status ∈ {CONGELADO, HOMOLOGADO}` e há `snapshot_catalogo`, devolve os equipamentos **congelados**; caso contrário, o catálogo vivo. Ponto único para unifilar/relatórios/homologação consumirem o snapshot.

**Verificado (Node):** projeto CONGELADO retorna `origem='snapshot'` e o módulo congelado (não o vivo); projeto RASCUNHO retorna `origem='vivo'`.

> **Nota honesta:** o helper foi criado e está disponível, mas **não rezetei a homologação/relatórios para consumi-lo nesta sprint** (evitar alterar a homologação além do necessário; o unifilar já prioriza por conta própria). A adoção do helper por Homologacao/relatórios é o passo seguinte recomendado.

---

## FASE 5 — Divergência

- **Backend** (`detectarDivergenciaProjetoFV`): loop guardado para **ignorar chaves não-equipamento** (`criado_em` string, `itens_adicionais`/`arranjos_extra` arrays) — evita falsos "removido_do_catalogo". Itens adicionais são livres (não existem no catálogo), logo não geram divergência de catálogo. Resposta passou a incluir `mensagem`: **"Equipamento divergiu do orçamento aprovado. A engenharia continua usando o snapshot congelado."**
- **Frontend** (`GovernancaPainel`): exibe a `mensagem` em destaque quando divergente. A engenharia permanece no snapshot congelado.

**Verificado (Node):** o guard de divergência seleciona apenas `modulo` e `inversor` (2 entradas), ignorando os arrays e o timestamp.

---

## FASE 6 — Validação

> **HONESTIDADE:** os 5 projetos reais (novo, legado, Fazenda Alice, Paulo Carlos, Escola Pinheiro) **NÃO foram abertos em runtime** — sem acesso ao Atlas/ambiente nesta sessão.

| Validação | Método | Resultado |
|-----------|--------|-----------|
| Build Vite | `npm run build` | ✅ 2322 módulos, 15.59s, 0 erros |
| `node --check` modelo + controller | sintaxe | ✅ MODEL OK / CONTROLLER OK |
| Lógica de snapshot/transição/prioridade | **Node (cópia verbatim das funções puras)** | ✅ 16/16 asserts |
| 5 projetos reais | runtime | ⚠️ NÃO executado |

O módulo `engenhariaGovernanca.js` real não importa em Node puro (imports sem extensão, resolvidos pelo Vite). A validação executável usou cópia verbatim das funções puras — o build Vite valida o módulo real.

---

## RESPOSTAS DIRETAS

1. **O que foi congelado:** módulos, inversores, potências, quantidades, fabricantes, modelos (já existia) **+ itens adicionais + arranjos extra (novo)**, dentro de `snapshot_catalogo`.
2. **O que continuou dinâmico:** o catálogo vivo (`Equipamento`) e os dados do projeto enquanto não congelado; após CONGELADO, a engenharia passa a priorizar o snapshot via `obterEquipamentosEngenharia`.
3. **Quais documentos passaram a usar snapshot:** unifilar já usava (confirmado); criado o ponto único `obterEquipamentosEngenharia` para unifilar/relatórios/homologação. Adoção por homologação/relatórios documentada como próximo passo (não rezeteado nesta sprint).
4. **Divergência detectada:** mecanismo existente reforçado — mensagem "Equipamento divergiu do orçamento aprovado", guard contra falsos positivos de itens/arranjos. Nenhuma divergência real medida (sem runtime).
5. **Regressões encontradas:** nenhuma nas verificações executadas. Mudança de UX deliberada: congelar agora exige APROVADO primeiro.
6. **Commit gerado:** ver hash no `FV_FREEZE_ENGINEERING_METRICS.json`.

---

## Limitações conhecidas

1. Homologação/relatórios ainda não consomem `obterEquipamentosEngenharia` (helper criado, adoção pendente).
2. 5 projetos reais não validados em runtime (sem Atlas/ambiente).
3. Fluxo de freeze agora exige aprovação comercial (APROVADO) antes de congelar — mudança intencional de UX a confirmar com o time.
