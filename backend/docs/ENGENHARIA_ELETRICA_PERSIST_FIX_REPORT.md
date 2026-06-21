# ENGENHARIA_ELETRICA_PERSIST_FIX_REPORT.md

**Sprint:** P0-ENGENHARIA-ELETRICA-PERSIST-FIX-01
**Data:** 2026-06-20
**Modelo:** Claude Opus 4.8
**Tipo:** Correção crítica de persistência da engenharia elétrica

---

## ⚠️ GEMINI

Sprint marca **GEMINI: Obrigatória**. Não há ferramenta Gemini neste ambiente. **Revisão Gemini: PENDENTE.**

---

## HONESTIDADE — TIPO DE EVIDÊNCIA

```
VALIDADO EM CÓDIGO:   SIM — syntax check OK; null-guard + schema aditivo
VALIDADO EM RUNTIME:  SIM — 4 testes contra Railway/Atlas (500→200, mppts[] round-trip, legado abre)
```

---

## RESULTADO

```
APROVADO
```

Projeto novo salva engenharia elétrica sem erro (500 eliminado) e `mppts[]` sobrevive ao ciclo PUT → Mongo → GET.

---

## FASE 1 — FORENSICS (evidências antes da correção)

| Item | Evidência |
|---|---|
| Onde ocorre o 500 | `salvarEtapaProjetoFV` (`backend/src/controllers/projetosFVController.js`), case `engenharia_eletrica` |
| Endpoint | `PUT /api/projetos-fv/:id/etapa` com `{ etapa: 'engenharia_eletrica', dados }` |
| Payload | `dados.arranjo` com `quantidade_*`, `total_modulos`, `num_mppts_usados`, `mppts[]` |
| Trecho que falha | `$set['engenharia_eletrica.arranjo'] = dados.arranjo` (dot-notation) com `engenharia_eletrica` = `null` → Mongo: *"Cannot create field 'arranjo' in element {engenharia_eletrica: null}"* |
| Causa do null | `ProjetoFV.js:883` — `engenharia_eletrica: { type: engenhariaEletricaV3Schema, default: null }` |
| Null-guard existente | só para `workflow` (linha 728); **não havia para `engenharia_eletrica`** |
| Trecho que descarta mppts[] | `engenhariaEletricaV3Schema.arranjo` (linha 272) só tinha `quantidade_modulos_por_string`, `quantidade_strings_paralelo`, `total_modulos` → strict descartava `mppts[]` |

**Runtime pré-correção:** `PUT engenharia_eletrica` em rascunho → **HTTP 500**, `arranjo` persistido vazio.

---

## FASE 2 — NULL GUARD

`projetosFVController.js`, após o guard de `workflow`:
```js
if (etapa === 'engenharia_eletrica') {
  await ProjetoFV.updateOne(
    { _id: id, engenharia_eletrica: null },   // só quando ainda é null
    { $set: { engenharia_eletrica: {} } }     // idempotente, nunca sobrescreve
  )
}
```
Espelha o padrão já usado em `workflow`. O filtro `engenharia_eletrica: null` garante que dados existentes nunca sejam apagados.

---

## FASE 3 — PERSISTÊNCIA MPPT (schema aditivo)

`ProjetoFV.js`, `engenhariaEletricaV3Schema.arranjo` (campos antigos preservados):
```js
num_mppts_usados: { type: Number, default: null },
mppts: {
  type: [new mongoose.Schema({
    mppt: Number, strings_paralelo: Number,
    modulos_por_string: Number, total_modulos: Number,
  }, { _id: false })],
  default: undefined,   // legado sem o campo lê undefined
},
```
**Não** implementa entradas por MPPT nem strings individuais (fora do escopo) — apenas persiste o array de contagem por MPPT que o `ConfiguradorArranjoFV` já produz.

---

## FASE 4 — LEITURA LEGADA

- Projetos sem `engenharia_eletrica` → lêem `null` (Teste 4: HTTP 200, sem erro).
- Projetos com estrutura antiga (só `quantidade_*`/`total_modulos`) → continuam válidos; `mppts` ausente lê `undefined`.
- Snapshots congelados → não tocados (schema aditivo; freeze guard mantém 409 em projeto travado).

---

## FASE 5 — TESTES (runtime real, Railway/Atlas)

| Teste | Esperado | Resultado |
|---|---|---|
| 1. Projeto novo → salvar engenharia elétrica | HTTP 200 | ✅ **200** (era 500) |
| 2. Projeto novo → salvar `mppts[]` | persistido | ✅ HTTP 200 |
| 3. GET projeto → `mppts[]` retornado | mppts presente | ✅ **3 MPPTs** (2×10, 2×10, 1×8), `num_mppts_usados=6`, legado intacto (10/2/120) |
| 4. Projeto antigo | sem erro | ✅ HTTP 200, `engenharia_eletrica` null sem erro |

Evidência do ciclo PUT → Mongo → GET:
```
mppts persistidos: 3 | num_mppts_usados: 6
  MPPT 1: 2 string(s) × 10 mód = 20
  MPPT 2: 2 string(s) × 10 mód = 20
  MPPT 3: 1 string(s) × 8 mód = 8
legado intacto: quantidade_modulos_por_string=10, strings_paralelo=2, total_modulos=120
```

---

## FASE 6 — IMPACTO

1. **Quantos projetos têm `engenharia_eletrica` null:** **578 de 578** (100%) — a gravação estava totalmente quebrada; nenhum projeto jamais persistiu engenharia elétrica.
2. **Necessita migração?** **NÃO.** O null-guard inicializa sob demanda na 1ª gravação; projetos existentes permanecem `null` (estado válido) até serem re-salvos.
3. **Necessita backfill?** **NÃO.** Schema aditivo (`mppts` default undefined); legado lê sem erro.
4. **Snapshots afetados?** **NÃO.** `engenharia_eletrica` não faz parte dos snapshots (`governanca.snapshot_*`). 1 projeto congelado — freeze guard mantém o bloqueio (409) em edições, intocado.
5. **Governança afetada?** **NÃO.** Nenhum código de governança alterado; o freeze guard continua funcionando.

---

## RESPOSTAS OBRIGATÓRIAS

1. **Onde estava o erro:** `salvarEtapaProjetoFV` case `engenharia_eletrica` — `$set` dot-notation com `engenharia_eletrica=null` (default:null) → Mongo 500; e o schema `arranjo` sem `mppts[]` → strict descartava o array.
2. **Como foi corrigido:** (a) null-guard idempotente que inicializa `engenharia_eletrica={}` quando null; (b) schema aditivo `num_mppts_usados` + `mppts[{mppt, strings_paralelo, modulos_por_string, total_modulos}]`.
3. **HTTP 500 eliminado?** **SIM** (Teste 1: 500 → 200).
4. **`mppts[]` persiste?** **SIM** (Teste 2/3: 3 MPPTs sobrevivem ao ciclo PUT→Mongo→GET).
5. **Projetos antigos continuam abrindo?** **SIM** (Teste 4: legado null → HTTP 200).
6. **Necessitou migração?** **NÃO** (null-guard lazy + schema aditivo).
7. **Runtime executado?** **SIM** (4 testes + impacto, Railway/Atlas).
8. **Quantos projetos afetados:** **578/578** tinham `engenharia_eletrica` null (gravação 100% quebrada); agora todos podem salvar.
9. **Regressões encontradas:** nenhuma (syntax OK; legado abre; campos legados preservados; freeze guard intacto; congelado não afetado).
10. **Commit gerado:** `96aef4f` (+ docs).

---

## CRITÉRIO DE ACEITAÇÃO

> Projeto novo deve conseguir salvar engenharia elétrica sem erro. `mppts[]` deve sobreviver a PUT → Mongo → GET.

**ATENDIDO:** Teste 1 (200), Teste 2/3 (mppts[] round-trip com 3 MPPTs).

---

## VEREDITO

```
APROVADO — 500 eliminado, mppts[] persiste, legado intacto, sem migração, sem regressão.
Escopo respeitado: NÃO alterado unifilar/multiarranjo/topologia/entradas/strings/homologação/catálogo/EV.
```
