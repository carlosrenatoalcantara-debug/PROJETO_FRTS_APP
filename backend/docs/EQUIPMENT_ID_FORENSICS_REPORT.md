# Sprint P1-EQUIPMENT-ID-MIGRATION-FORENSICS-01 — Relatório Forense

**Data:** 2026-06-18
**Modelo:** Opus 4.8
**Tipo:** FORENSE · READ ONLY · NÃO ALTERA CÓDIGO · NÃO ALTERA ATLAS · NÃO GERA MIGRAÇÃO
**Revisão Gemini:** OBRIGATÓRIA E PENDENTE

> ## ⚠️ LIMITAÇÃO DE HONESTIDADE — LEIA PRIMEIRO
> Esta sessão **NÃO tem acesso ao Atlas** (`MONGODB_URI` ausente). Portanto:
> - As **contagens reais** de projetos/arranjos/ativos com `equipamento_id` nulo vs. preenchido
>   (FASE 2, FASE 4, FASE 5) **NÃO foram medidas** — elas exigem consulta ao banco.
> - Tudo o que está marcado **`[CONTAGEM PENDENTE]`** depende de rodar as agregações fornecidas
>   na seção "Queries de Medição" contra a produção.
> - O que **FOI medido nesta sessão** é a **estrutura do código** (schemas, fluxos de resolução,
>   pontos de persistência e fallback) — isso é determinístico e verificável por leitura.
> - **Único dado de produção citável** vem de forense anterior que teve acesso ao DB
>   (`INVERTER_IDENTITY_FORENSICS_REPORT.md`, 2026-06-14): **146 projetos fazem bind do inversor
>   SUN2000 por `fabricante=Deye`** (string), evidência direta de que o caminho fabricante+modelo
>   é a via de binding dominante em produção.

---

## SUMÁRIO EXECUTIVO

`equipamento_id` é um **vínculo OPCIONAL** (`default: null`, `ref: 'Equipamento'`) presente em
todos os subdocumentos de equipamento do ProjetoFV (paineis, inversor, arranjos[].paineis,
arranjos[].inversores, arranjos[].baterias), no ProjetoEV (snapshot_carregador) e no AtivoEquipamento.

**A plataforma inteira opera com resolução de DOIS NÍVEIS, em todos os pontos críticos:**

```
1º  equipamento_id (ObjectId)  →  Equipamento.findById()        [quando presente e válido]
2º  fabricante + modelo        →  query/matcher por string       [fallback — sempre disponível]
3º  (nada)                     →  engineeringFallback runtime     [conservador, não grava]
```

**Conclusão central:** `equipamento_id = null` em projetos legados **NÃO quebra nenhum fluxo**,
porque cada consumidor já tem o fallback fabricante+modelo como caminho de primeira classe — e os
**snapshots congelados não usam `equipamento_id` de forma alguma** (são auto-contidos). O risco real
de uma migração é **BAIXO a MÉDIO** e concentrado em conveniência (vínculo ao catálogo vivo), não em
integridade de dados.

---

## FASE 1 — INVENTÁRIO (medido por leitura de código)

### Schemas que DECLARAM o campo (persistência)

| Arquivo | Linha | Contexto | Tipo | Default |
|---|---|---|---|---|
| `backend/src/models/ProjetoFV.js` | 645 | `equipamentos.paineis[]` (arranjo legado único) | ObjectId ref Equipamento | null |
| `backend/src/models/ProjetoFV.js` | 661 | `equipamentos.inversor` (arranjo legado único) | ObjectId ref Equipamento | null |
| `backend/src/models/ProjetoFV.js` | 695 | `arranjos[].paineis[]` (multiarranjo) | ObjectId ref Equipamento | null |
| `backend/src/models/ProjetoFV.js` | 701 | `arranjos[].inversores[]` (multiarranjo) | ObjectId ref Equipamento | null |
| `backend/src/models/ProjetoFV.js` | 707 | `arranjos[].baterias[]` (BESS) | ObjectId ref Equipamento | null |
| `backend/src/models/ProjetoEV.js` | 135 | `snapshot_carregador.equipamento_id` | ObjectId ref Equipamento | null |
| `backend/src/models/AtivoEquipamento.js` | 33 | vínculo do ativo (Gêmeo Digital) | ObjectId ref Equipamento | null |

### Pontos de RESOLUÇÃO / CONSUMO (leitura com fallback)

| Arquivo | Linha(s) | Função | Comportamento |
|---|---|---|---|
| `backend/src/controllers/homologacaoController.js` | 83–91 | `_carregarDepsDocumento` (vivo) | `equipamento_id \|\| id` → `Equipamento.find({_id:$in})`; ObjectId válido apenas |
| `backend/src/controllers/homologacaoController.js` | 30–53 | `_depsDoSnapshot` (congelado) | usa **só** `{tipo,fabricante,modelo,especificacoes}` — **ignora** equipamento_id |
| `backend/src/controllers/projetosFVController.js` | 1117 | `detectarDivergenciaProjetoFV` | `if (!snap.equipamento_id && !(snap.fabricante && snap.modelo)) continue` |
| `backend/src/controllers/projetosFVController.js` | 1121–1124 | idem | findById(equipamento_id) **senão** find por fabricante+modelo |
| `backend/src/services/ativoService.js` | 67,84,101,117 | `montarSpecsAtivos` | `p.equipamento_id \|\| null` (cópia best-effort); chave_origem usa **modelo** |
| `backend/src/services/equipamentoMatcherService.js` | 169–321 | `matchEquipamento` | 5 camadas por fabricante/modelo/potência — **não usa equipamento_id como entrada** |
| `frontend/src/utils/engenharia/engenhariaPayload.js` | 95 | montagem do payload | `equipamento_id: painel._id \|\| null` (preenche a partir da seleção de catálogo) |
| `frontend/src/services/projetoFVApi.js` | — | adaptadores | propaga equipamento_id quando presente |
| `frontend/src/utils/engenhariaGovernanca.js` | 213 | `snapshotItem`/base | `equipamento_id: eq._id \|\| eq.id \|\| null` (registra no snapshot, mas resolvers não dependem) |

### Geração de fallback de identidade (quando AMBOS faltam)

| Arquivo | Papel |
|---|---|
| `backend/src/utils/catalogo/fabricanteModeloFallback.js` | `extrairFabricanteModelo` / `normalizarIdentificacao` — recupera fabricante+modelo de texto bruto via regex (24+ fabricantes BR) |
| `backend/src/utils/fabricanteQuery.js` | `queryFabricante` — monta filtro Mongo `$or` por fabricante bruto/canônico/alias |
| `backend/src/services/engineeringFallback.js` | `aplicarFallbackEngenharia` — preenche specs ausentes em runtime, **sem gravar**, com proveniência `fallback_conservador` |

**Total de superfície:** 7 pontos de persistência, 8 pontos de consumo, 3 camadas de fallback de identidade.

---

## FASE 2 — PROJETOS FV `[CONTAGEM PENDENTE — requer DB]`

**Não mensurável nesta sessão.** Estrutura e queries para medir:

| Pergunta | Como medir | Status |
|---|---|---|
| 1. Projetos com `equipamento_id` preenchido | agregação Q2.1 | `[PENDENTE]` |
| 2. Projetos com `equipamento_id` null | agregação Q2.2 | `[PENDENTE]` |
| 3. Projetos usando fallback fabricante+modelo | Q2.2 ∩ (fabricante≠null ∧ modelo≠null) | `[PENDENTE]` |
| 4. Projetos que misturam os dois modelos | Q2.3 | `[PENDENTE]` |

**Separação novo vs legado:** o discriminador estrutural é **`origem_bind`** (campo presente em todos
os subdocs de equipamento). Projetos "novos" (pós-S2.9) tendem a ter `equipamento_id` preenchido +
`origem_bind` setado pela seleção de catálogo; "legados" têm `equipamento_id: null` e foram criados
antes do binding ao Atlas. **A contagem exige rodar Q2.4.**

> **Sinal de produção (indireto, de forense com DB):** 146 projetos fazem bind do SUN2000 por
> `fabricante=Deye` — ou seja, **o binding por string é comprovadamente o caminho dominante**.
> Isso sugere (mas NÃO prova sem Q2.x) que a maioria dos projetos depende do fallback hoje.

---

## FASE 3 — ARRANJOS (estrutura medida; contagem pendente)

### Onde `equipamento_id` É persistido (campo existe no schema)
- `equipamentos.paineis[].equipamento_id` (arranjo legado único)
- `equipamentos.inversor.equipamento_id`
- `arranjos[].paineis[].equipamento_id` (multiarranjo)
- `arranjos[].inversores[].equipamento_id`
- `arranjos[].baterias[].equipamento_id`

### Onde NÃO é persistido (campo ausente do schema)
- `strings[]` — só geometria elétrica (numero, paineis, potencia_total_w, tensao_voc)
- `equipamentos.estrutura` — só tipo/descricao
- `bess` (objeto raiz legado, distinto de `arranjos[].baterias`) — só marca/capacidade
- `snapshot_unifilar` — topologia elétrica, não vincula catálogo por id
- **`snapshot_catalogo`** — captura `{fabricante, modelo, especificacoes, garantia}`; o `equipamento_id`
  pode ser registrado por `engenhariaGovernanca.js:213` mas **os resolvers de homologação ignoram**
  (ver `_depsDoSnapshot`). Snapshot é **auto-contido por valor**, não por referência.

**Quantos arranjos têm equipamento_id null:** `[CONTAGEM PENDENTE]` — query Q3.1.

---

## FASE 4 — CATÁLOGO `[CONTAGEM PENDENTE — requer DB]`

| Pergunta | Como medir | Status |
|---|---|---|
| 1. Registros com `_id` válido | `Equipamento.countDocuments({})` (todo doc Mongo tem _id) | ~100% por construção |
| 2. Projetos que referenciam esses IDs | Q4.1 (lookup reverso projetos→equipamento_id) | `[PENDENTE]` |
| 3. % do catálogo órfão (sem nenhum projeto apontando) | Q4.2 | `[PENDENTE]` |

**Nota estrutural:** o catálogo unificado tem dois "mundos":
- **`Equipamento` (Atlas/Mongo)** — coleção real, todo registro tem `_id` ObjectId. É o alvo de `ref`.
- **`catalogoPaineis.js` / `catalogoInversores.js` (arquivos estáticos)** — usados pelo
  `equipamentoMatcherService` via `import()`; cada item tem `id` (string), **não** ObjectId.
  O matcher retorna `equipamento_id: eq.id` (string do catálogo estático) — que **não é** o `_id` do
  Atlas. **Isto é uma fonte de ambiguidade documentada:** dependendo do caminho, `equipamento_id`
  pode ser um ObjectId (Atlas) ou um id-string (catálogo estático).

---

## FASE 5 — ATIVOS (Gêmeo Digital)

| Pergunta | Resposta (estrutural) | Evidência |
|---|---|---|
| 1. Ativos dependem de `equipamento_id`? | **NÃO.** Campo é `default: null`, opcional. | `AtivoEquipamento.js:33` |
| 2. Ativos usam fabricante+modelo? | **SIM, como identidade primária.** A `chave_origem` (idempotência) é derivada de **modelo** (`normModelo`), não de equipamento_id. | `ativoService.js:73,90,108,122` |
| 3. Risco de quebra futura? | **BAIXO.** A geração (`montarSpecsAtivos`) funciona idêntica com equipamento_id null — copia `p.equipamento_id \|\| null` e segue. QR e idempotência não dependem do id de catálogo. | `ativoService.js:51–124` |

**Identidade real do ativo** = `numero_serie` + `qr_code` (FORTE-<TIPO3>-<SEQ6>, único e imutável) +
fabricante/modelo. O `equipamento_id` é metadado de rastreabilidade ao catálogo, **não** chave de
funcionamento. **Contagem de ativos com equipamento_id null:** `[PENDENTE]` — query Q5.1.

---

## FASE 6 — SNAPSHOTS

| Pergunta | Resposta | Evidência |
|---|---|---|
| 1. Snapshot usa `equipamento_id`? | **Pode registrar, mas NÃO depende.** `engenhariaGovernanca.js:213` grava `equipamento_id` no item do snapshot, porém os consumidores (`_depsDoSnapshot`) leem **só** fabricante/modelo/especificacoes. | `homologacaoController.js:30–53` |
| 2. Snapshot depende do catálogo vivo? | **NÃO.** Quando CONGELADO, `_carregarDepsDocumento` usa o snapshot e **pula** `Equipamento.find()`. Especificações estão materializadas por valor no snapshot. | `homologacaoController.js:73–80` |
| 3. Snapshot permanece íntegro sem `equipamento_id`? | **SIM, integralmente.** O snapshot é uma cópia por valor de fabricante/modelo/specs/garantia no momento do congelamento. Mesmo se o catálogo mudar ou o equipamento for deletado, o snapshot não muda. | design `snapshot_catalogo` Mixed |

**Veredito FASE 6:** snapshots são **imunes** ao problema de `equipamento_id = null`. São a camada de
maior integridade da plataforma para fins regulatórios.

---

## RESPOSTAS DIRETAS

1. **Quantos projetos afetados:** `[CONTAGEM PENDENTE]` — requer Q2.x no Atlas. Estruturalmente,
   "afetado" = projeto com ≥1 subdoc de equipamento com `equipamento_id: null`. Sinal indireto:
   binding por string é dominante (146 projetos SUN2000/Deye), sugerindo alta prevalência de null.
2. **Quantos arranjos afetados:** `[CONTAGEM PENDENTE]` — Q3.1.
3. **Quantos ativos afetados:** `[CONTAGEM PENDENTE]` — Q5.1. Impacto funcional ≈ zero (ativos não
   dependem de equipamento_id).
4. **Dependência atual do fallback:** **ALTA e por design.** Todo ponto crítico (homologação viva,
   divergência, geração de ativos, matcher) tem fabricante+modelo como caminho de primeira classe.
   A homologação congelada não usa equipamento_id de forma alguma.
5. **Risco real:** **BAIXO–MÉDIO.** Nenhuma quebra de integridade. O custo de null é: (a) perda do
   link clicável projeto→catálogo vivo; (b) re-matching por string em cada leitura (custo de CPU
   marginal); (c) ambiguidade ObjectId-Atlas vs id-string-estático no campo.
6. **Estratégia recomendada:** **D — Híbrido** (ver MIGRATION_OPTIONS). Manter o fallback como
   contrato permanente + backfill best-effort idempotente onde o match for ALTO (score ≥ 0.85),
   deixando null onde o matcher não tem certeza. Nunca forçar bind ambíguo.
7. **Necessidade de migração:** **NÃO é obrigatória para funcionamento.** É **desejável** para
   qualidade de dados e features futuras de O&M/rastreabilidade. Não há urgência operacional.
8. **Estimativa de esforço:** Estratégia D ≈ **1 sprint** (script de backfill idempotente read-mostly
   reusando `equipamentoMatcherService`, com gate de score e dry-run obrigatório) + 1 sprint de
   validação. Estratégia B (migrar tudo) ≈ **3–4 sprints** com risco de bind incorreto.

---

## QUERIES DE MEDIÇÃO (para rodar com DB — NÃO executadas nesta sessão)

> Estas são consultas **read-only** de agregação. Não são migração. Rodar em produção com
> `mongosh` ou script `.mjs` de leitura. Documentadas aqui para que a contagem possa ser feita
> sem reabrir esta forense.

```js
// Q2.1 — projetos com PELO MENOS UM equipamento_id preenchido (arranjo legado OU multiarranjo)
db.projetosfv.countDocuments({ $or: [
  { 'equipamentos.paineis.equipamento_id': { $ne: null } },
  { 'equipamentos.inversor.equipamento_id': { $ne: null } },
  { 'arranjos.paineis.equipamento_id': { $ne: null } },
  { 'arranjos.inversores.equipamento_id': { $ne: null } },
]})

// Q2.2 — projetos SEM nenhum equipamento_id (todos null/ausentes) mas COM fabricante+modelo
db.projetosfv.countDocuments({ $and: [
  { 'equipamentos.paineis.equipamento_id': { $in: [null] } },
  { 'equipamentos.inversor.fabricante': { $ne: null } },
]})

// Q2.3 — projetos que MISTURAM (algum id preenchido E algum null no mesmo doc)
//   → rodar via $project com $anyElementTrue / $allElementsTrue sobre os arrays.

// Q2.4 — separar novo vs legado por origem_bind
db.projetosfv.aggregate([
  { $project: { temId: { $or: [
      { $gt: [ { $size: { $ifNull: [ { $filter: {
        input: '$equipamentos.paineis', cond: { $ne: ['$$this.equipamento_id', null] } } }, [] ] } }, 0 ] },
  ] }, origem: '$equipamentos.inversor.origem_bind' } },
  { $group: { _id: { temId: '$temId', origem: '$origem' }, n: { $sum: 1 } } },
])

// Q4.1/Q4.2 — catálogo órfão: IDs referenciados por projetos vs total do catálogo
const ref = db.projetosfv.distinct('equipamentos.inversor.equipamento_id')
  .concat(db.projetosfv.distinct('arranjos.inversores.equipamento_id'))
  .filter(Boolean)
db.equipamentos.countDocuments({ _id: { $nin: ref } })   // órfãos (aprox.)

// Q3.1 / Q5.1 — arranjos/ativos com equipamento_id null
db.ativos_equipamento.countDocuments({ equipamento_id: null })
```

---

## VERIFICAÇÃO E HONESTIDADE

- **Nenhuma alteração** em código, Atlas, schema ou migração. Apenas leitura e documentação.
- **Estrutura de código:** medida por leitura direta dos arquivos (determinística, verificável).
- **Contagens de produção:** **NÃO medidas** — sem `MONGODB_URI`. Marcadas `[CONTAGEM PENDENTE]`.
- **Único número de produção citado** (146 projetos Deye/SUN2000) vem de forense anterior com DB,
  não foi reconfirmado nesta sessão.
- **Revisão Gemini:** OBRIGATÓRIA e PENDENTE.
