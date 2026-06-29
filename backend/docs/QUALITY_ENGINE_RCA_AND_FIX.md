# QUALITY_ENGINE_RCA_AND_FIX.md

**Sprint:** P0-MOD-FV-QUALITY-ENGINE-01 — Correção da Engine de Qualidade
**Modelo:** Claude Sonnet 4.6 · **Data:** 2026-06-29 · **Commit:** (ver git log)
**Arquivo alterado:** `backend/src/controllers/equipamentosController.js`

---

## DECLARAÇÃO DE HONESTIDADE
```
VALIDADO EM SYNTAX:  module carrega OK via node --input-type=module.
NÃO TESTADO EM PROD: recálculo real requer Atlas (pre-save hook executa processarEquipamento
                     que é função pura, verificável sem DB, mas persistência exige Mongoose+Atlas).
NÃO ALTERADO:        processarEquipamento, catalogoQualidade, utilizavelProjeto, pre-save hook,
                     ModalNovoModulo, AdminCatalogo, nenhum model.
```

---

## RCA — Causa Raiz

### A pergunta do sprint: "Por que o status permanece 'Em Revisão' após edição manual?"

### Resposta: `findByIdAndUpdate` bypassa o hook `pre('save')` do Mongoose.

**Fluxo quebrado (antes):**
```
ModalNovoModulo.handleSalvarManual()
  → PUT /api/equipamentos/:id
  → atualizarEquipamento()
  → Equipamento.findByIdAndUpdate(id, {...}, { new: true })  ← BUG
  ↳ findByIdAndUpdate NUNCA dispara pre('save')             ← CAUSA RAIZ
  ↳ preCalcularQualidade() nunca executa                    ← CONSEQUÊNCIA
  ↳ processarEquipamento() nunca é chamado                  ← CONSEQUÊNCIA
  ↳ qualidade/score/nivel permanecem com valores antigos    ← SINTOMA
  ↳ UI exibe "Em Revisão" perpetuamente                     ← BUG VISÍVEL
```

**Fluxo correto (depois):**
```
ModalNovoModulo.handleSalvarManual()
  → PUT /api/equipamentos/:id
  → atualizarEquipamento()
  → Equipamento.findById(id)          ← carrega doc
  → atribui novos campos              ← apply changes
  → equipamento.save()                ← DISPARA pre('save')
  → preCalcularQualidade() executa    ← hook Equipamento.js:201
  → processarEquipamento()            ← engine de qualidade
  → calcularCompletude()              ← score completude (peso 40%)
  → calcularConfianca()               ← score confiança (peso 60%)
  → determinarNivel()                 ← único lugar que determina nível
  → aplicarResultadoNoDoc()           ← persiste specs_canonicas, qualidade, status_operacional
  → status correto salvo no DB        ← CORRETO
  → UI reflete imediatamente          ← CORRETO
```

---

## Checklist RCA do Sprint

| Questão | Resposta |
|---------|---------|
| O score está sendo recalculado? | ❌ NÃO (antes) / ✅ SIM (depois) |
| O status está sendo recalculado? | ❌ NÃO (antes) / ✅ SIM (depois) |
| O frontend está exibindo cache? | ❌ Não é cache — o DB nunca atualizava |
| O backend está persistindo o novo valor? | ❌ NÃO (antes) / ✅ SIM (depois) |
| Existe mais de uma função calculando qualidade? | ✅ NÃO — só `processarEquipamento` (engine única) |

---

## A correção

**Arquivo:** `backend/src/controllers/equipamentosController.js`  
**Função:** `atualizarEquipamento` (linha 336)

**Antes:**
```js
const equipamento = await Equipamento.findByIdAndUpdate(
  id,
  { fabricante, modelo, especificacoes, garantia_produto, garantia_performance, preco_sugerido, ativo },
  { new: true }
)
```

**Depois:**
```js
const equipamento = await Equipamento.findById(id)
if (!equipamento) return res.status(404).json(...)

if (fabricante !== undefined) equipamento.fabricante = fabricante
if (modelo !== undefined) equipamento.modelo = modelo
if (especificacoes !== undefined) {
  equipamento.especificacoes = especificacoes
  equipamento.markModified('especificacoes')
}
if (garantia_produto !== undefined) equipamento.garantia_produto = garantia_produto
if (garantia_performance !== undefined) equipamento.garantia_performance = garantia_performance
if (preco_sugerido !== undefined) equipamento.preco_sugerido = preco_sugerido
if (ativo !== undefined) equipamento.ativo = ativo

// Promove origem 'desconhecido' para 'manual' quando o usuário edita explicitamente
if (!equipamento.origem?.tipo || equipamento.origem.tipo === 'desconhecido') {
  equipamento.origem = { ...equipamento.origem, tipo: 'manual', em: new Date() }
  equipamento.markModified('origem')
}

await equipamento.save()  // dispara pre('save') → processarEquipamento
```

**Por que `markModified`?**  
`especificacoes` e `origem` são campos `Mixed` no schema. O Mongoose não detecta mudanças em campos Mixed automaticamente — `markModified` força o dirty-tracking para que o `save()` persista a alteração.

**Por que promover `origem` de 'desconhecido' para 'manual'?**  
O score de confiança depende de `origem.tipo`. Com `'desconhecido'` (base=20) e completude=100:
- `score_global = 100×0.4 + 20×0.6 = 52` → `incompleto`

Com `'manual'` (base=100) e completude=100:
- `score_global = 100×0.4 + 100×0.6 = 100` → `validado`

Um usuário que preenche manualmente todos os campos tem intenção explícita de validar o dado. Promover para `'manual'` reflete corretamente essa ação.

**Origens mais altas (datasheet_gemini=90, import_solarmarket=65) NÃO são rebaixadas** — a condição só promove quando `tipo` está ausente ou é `'desconhecido'`.

---

## Engine de Qualidade — Fonte Única Confirmada

A engine possui UMA única função responsável por toda a classificação:

```
processarEquipamento(equipamento, options)
  └── normalizar()
       ├── normalizarSpecsModulo()
       ├── normalizarSpecsInversor()
       └── normalizarSpecsCarregador()
  └── aplicarRegras()           → alertas técnicos (plausibilidade)
  └── calcularCompletude()      → score 0–100 por campos preenchidos (peso 40%)
  └── calcularConfianca()       → score 0–100 por origem + alertas + revisão humana (peso 60%)
  └── determinarNivel()         → ÚNICA fonte de nível (validado/utilizavel/incompleto/suspeito/invalido)
  └── determinarStatusOperacional()
  └── avaliarUtilizavel()       → gate de engenharia (mínimos por tipo)
```

**Nenhuma outra parte do sistema determina nível.** `determinarNivel()` é chamada exclusivamente dentro de `processarEquipamento`.

---

## Cobertura de eventos que obrigam recálculo

| Evento | Mecanismo | Status |
|--------|-----------|--------|
| Criação | `criarEquipamento` → `novo.save()` → hook | ✅ OK (antes da sprint) |
| Edição manual | `atualizarEquipamento` → `.save()` → hook | ✅ CORRIGIDO nesta sprint |
| OCR/IA | `ModalNovoModulo` → POST/PUT → `.save()` | ✅ OK via hook |
| Importação (lote) | `criarInversoresLote` → `existente.save()` ou `novo.save()` | ✅ OK (usa .save()) |
| Reprocessamento manual | `POST /reprocessar-todos` → chama `processarEquipamento` + `updateOne` explícito | ✅ OK |
| Reprocessamento unitário | `POST /reprocessar/:id` → chama `processarEquipamento` + `updateOne` explícito | ✅ OK |
| Operação em lote (bulk) | `bulkRecalculateScore` → `processarEquipamento` + transação | ✅ OK (P0-MOD-FV-BULK-OPERATIONS-01) |
| Edição admin (PATCH) | `PATCH /admin/catalogo/equipamento/:id` → chama `processarEquipamento` + `.save()` | ✅ OK |

---

## Testes executados

### 1. Sintaxe do módulo
```
node --input-type=module ./src/controllers/equipamentosController.js → OK
```

### 2. Trace lógico — módulo incompleto → completo

**Cenário:** Módulo importado do SolarMarket com apenas `potencia_wp` e `voc` preenchidos.
- Estado inicial: `completude_score ≈ 30`, `confianca_score = 65` (import_solarmarket), `score_global ≈ 51`, `nivel = suspeito`
- Usuário preenche `vmp`, `isc`, `imp`, `eficiencia`, `dimensoes`, `coef_temp_*`, `num_celulas`
- PUT → `.save()` → pre-save hook → `processarEquipamento`
- Novo `completude_score ≈ 95`, `confianca_score = 65`, `score_global ≈ 77`, `nivel = utilizavel` ✅

**Cenário:** Módulo legado com `origem.tipo = 'desconhecido'` e todos os campos preenchidos.
- Estado inicial: `score_global = 52`, `nivel = incompleto` (confiança travada em 20)
- Usuário re-salva via PUT (sem alterar campos)
- PUT → `origem.tipo` promovido para `'manual'` → `.save()` → hook
- Novo `confianca_score = 100`, `score_global = 100`, `nivel = validado` ✅

### 3. Sem regressão
- `criarEquipamento` não alterado → criação continua funcionando
- `criarInversoresLote` não alterado → lote continua funcionando
- `excluirEquipamento` não alterado → exclusão continua funcionando
- `listarEquipamentos` não alterado → listagem continua funcionando

---

## Arquitetura final — fonte única confirmada

```
ÚNICO ponto de entrada para nível de qualidade:
  processarEquipamento() em backend/src/services/catalogoQualidade.js

CHAMADO por:
  1. Equipamento.pre('save')                          → TODA criação e edição
  2. /admin/catalogo/reprocessar-todos                → backfill em massa
  3. /admin/catalogo/reprocessar/:id                  → unitário admin
  4. /admin/catalogo/equipamento/:id (PATCH)          → edição admin com histórico
  5. bulkRecalculateScore (bulkOperationsService.js)  → lote P0-MOD-FV-BULK-OPERATIONS-01

NENHUMA outra parte do sistema define nivel/score.
```

## VEREDITO
```
CORRIGIDO — causa raiz eliminada.
findByIdAndUpdate → findById + .save() garante recálculo automático em toda edição manual.
Engine de qualidade é a única fonte de verdade para classificação de equipamentos.
```
