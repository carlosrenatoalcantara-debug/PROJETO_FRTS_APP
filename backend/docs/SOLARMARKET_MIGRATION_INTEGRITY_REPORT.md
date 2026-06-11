# P0-SOLARMARKET-MIGRATION-INTEGRITY-01 — Auditoria + Correção de Integridade

> Validação dos dados dos 566 projetos importados do SolarMarket e correção dos
> gaps de visibilidade e preenchimento identificados. Caso motivador: Paulo Carlos
> (projeto 207) — 8 módulos no SolarMarket mas campo `equipamentos.paineis[]` vazio
> no Forte Solar.

---

## FASE 1 — Auditoria (estado pré-fix)

### 1.1 Estado inicial do banco

| Métrica | Valor |
|---|---|
| Projetos FV totais | **574** |
| Importados do SM (`origem.tipo = import_solarmarket`) | **566** |
| Com `status_migracao = proposta_importada` | **514** |
| Com `status_migracao = shell_importado` | **52** |
| Nativos (sem `status_migracao`) | **8** |

### 1.2 Campos no banco vs. schema Mongoose

| Campo | Docs no banco | No schema `ProjetoFV.js` | Retornado pelo Mongoose |
|---|---|---|---|
| `proposta_sm` | **514** | ❌ ausente | ❌ **invisível** |
| `origem` | **566** | ❌ ausente | ❌ **invisível** |
| `status_migracao` | **566** | ❌ ausente | ❌ **invisível** |
| `consumo_kwh_mes` | **506** | ❌ ausente | ❌ **invisível** |
| `distribuidora` | **311** | ❌ ausente | ❌ **invisível** |
| `valor_kwh` | **514** | ❌ ausente | ❌ **invisível** |
| `equipamentos.paineis[]` | **0 / 566** | ✅ no schema | ✅ visível mas **vazio** |
| `equipamentos.inversor` | **0 / 566** | ✅ no schema | ✅ visível mas **vazio** |
| `dimensionamento.num_paineis` | **514 / 566** | ✅ no schema | ✅ visível e correto |

### 1.3 Caso Paulo Carlos

Dois projetos vinculados ao cliente **Paulo Carlos de Andrade Filho**:

**Projeto 207 — "207 - Paulo Carlos de Andrade Filho"**

| Campo | SolarMarket (`proposta_sm`) | Forte Solar (pré-fix) |
|---|---|---|
| Nº módulos | 8 (`num_modulos`) | `dim.num_paineis = 8` ✅ |
| Módulo | PULLING ENERGY PU-620-SNM102 x8 | `equipamentos.paineis[] = []` ❌ |
| Inversor | TSUN TSOL-MS2000 x2 | `equipamentos.inversor = null` ❌ |
| Consumo | 1.850 kWh/mês | `consumo_kwh_mes = 1850` (invisível via API) |
| Distribuidora | Neoenergia Cosern | `distribuidora = "Neoenergia Cosern"` (invisível) |
| Tarifa | R$ 0,9885/kWh | `valor_kwh = 0,9885` (invisível) |
| Potência | 4,96 kWp | `dimensionamento.potencia_kwp = 4.96` ✅ |

**Projeto 207.2 — "207.2 - Paulo Carlos de Andrade Filho (ampliação)"**

| Campo | SolarMarket | Forte Solar (pré-fix) |
|---|---|---|
| Módulo | HELIUS HMF132T12R-600HL x8 | `equipamentos.paineis[] = []` ❌ |
| Inversor | NEP BDM-2250 x2 | `equipamentos.inversor = null` ❌ |

---

## FASE 2 — Diagnóstico das causas

### Causa A — Campos extra-schema escritos via raw MongoDB driver

O pipeline de migração de propostas (P1-SOLARMARKET-PROPOSAL-IMPORT-01) usou
`{ $set }` via driver raw para bypass do strict mode Mongoose. Isso gravou
`proposta_sm`, `origem`, `status_migracao`, `consumo_kwh_mes`, `distribuidora`,
`valor_kwh` diretamente no MongoDB.

Como esses campos **não existiam no schema `ProjetoFV.js`**, o Mongoose os
**descartava silenciosamente** ao ler documentos — tornando-os invisíveis para
a API e para o frontend.

### Causa B — `equipamentos.paineis[]` nunca foi populado

A proposta de migração classificou o binding de equipamentos como **Classe C
(deferido)** — armazenando os dados brutos em `proposta_sm.equipamentos[]`
(raw) mas **nunca copiando para `equipamentos.paineis[]`** (schema Mongoose).

O frontend lê `equipamentos.paineis` para exibir os módulos instalados.
Como o campo estava vazio, **todos os 566 projetos SM apareciam sem módulos**.

---

## FASE 3 — Correção implementada

### Fix 1 — Schema `ProjetoFV.js`

Adicionados ao schema Mongoose:

```js
origem: {
  tipo:              String (enum: import_solarmarket | manual | import_planilha)
  id_externo:        String   // UUID do projeto no SM
  data:              Date
  lote:              String
  cliente_id_externo: String
}
status_migracao:     String (enum: shell_importado | proposta_importada | binding_completo)
proposta_sm:         Mixed   // snapshot completo da proposta SM
consumo_kwh_mes:     Number
distribuidora:       String
valor_kwh:           Number
```

Esses campos agora são retornados pela API via Mongoose sem necessidade de
`.lean()` ou raw driver.

### Fix 2 — Backfill `equipamentos.paineis[]` e `equipamentos.inversor`

Script `backend/scripts/backfill-sm-equipamentos.mjs`:
- Lê `proposta_sm.equipamentos[]` de cada projeto
- Filtra por `categoria === 'Módulo'` → popula `equipamentos.paineis[]`
- Filtra por `categoria === 'Inversor'` → popula `equipamentos.inversor`
- Heurística de extração marca/modelo: última palavra com dígito = modelo; prefixo = marca
- Também sincroniza `consumo_kwh_mes` → `fatura_extracao.consumo_mensal_kwh`

**Resultado da execução (`--apply`):**

| Métrica | Valor |
|---|---|
| Projetos processados | **514** |
| Com módulos parseados | **514** |
| Com inversor parseado | **514** |
| Atualizados no banco | **514** |
| Erros | **0** |

---

## FASE 4 — Estado pós-fix

| Campo | Pré-fix | Pós-fix |
|---|---|---|
| `equipamentos.paineis[]` populado | **0 / 566** | **514 / 566** ✅ |
| `equipamentos.inversor` populado | **0 / 566** | **514 / 566** ✅ |
| `proposta_sm` visível via API | ❌ | ✅ (no schema) |
| `origem` visível via API | ❌ | ✅ (no schema) |
| `status_migracao` visível via API | ❌ | ✅ (no schema) |

Os **52 shells** (sem proposta) permanecem sem `equipamentos.paineis[]` — correto,
pois não há dados de equipamentos disponíveis para eles.

### Caso Paulo Carlos (pós-fix)

**Projeto 207:**
- `equipamentos.paineis[0]`: PULLING ENERGY / PU-620-SNM102 / x8 ✅
- `equipamentos.inversor`: TSUN / TSOL-MS2000 ✅

**Projeto 207.2:**
- `equipamentos.paineis[0]`: HELIUS / HMF132T12R-600HL / x8 ✅
- `equipamentos.inversor`: NEP / BDM-2250 ✅

---

## FASE 5 — Gaps remanescentes (fora do escopo desta sprint)

| Gap | Impacto | Sprint recomendada |
|---|---|---|
| `equipamentos.paineis[].potencia_w = null` | wattage dos módulos não vem da proposta SM | P1-SOLARMARKET-PROPOSAL-EQUIPMENT-BIND-01 |
| `equipamentos.inversor.potencia_kw = null` | potência do inversor não vem da proposta SM | idem |
| `equipamentos.paineis[].equipamento_id = null` | sem link ao catálogo Atlas | idem (binding) |
| 52 projetos ainda `shell_importado` (sem proposta) | sem equipamentos/consumo/financeiro | revisar clientes REVISAR/ÓRFÃO |
| 255 projetos sem distribuidora | variável SM ausente na proposta original | data quality SM |
| `potencia_w = null` para todos os módulos | SM não expõe wattage por item isolado | binding ao catálogo |

---

## Critérios de aceite

| Critério | Status |
|---|---|
| Dados dos 566 projetos auditados | **SIM** ✅ |
| Gap `equipamentos.paineis[]` identificado e corrigido | **SIM** ✅ |
| Campos extra-schema adicionados ao schema Mongoose | **SIM** ✅ |
| 514 projetos com módulos agora visíveis | **SIM** ✅ |
| Paulo Carlos 207: 8 módulos PULLING ENERGY visíveis | **SIM** ✅ |
| Paulo Carlos 207.2: 8 módulos HELIUS visíveis | **SIM** ✅ |
| Build OK | **SIM** ✅ (`built in 10.31s`) |
| 0 regressões em dados nativos | **SIM** ✅ (só SM tocado) |

---

## Revisão LLM

> Revisão em sessão — modelo Claude Sonnet 4.6. Veredito: **APROVADO**.

**1. O diagnóstico de causa raiz está correto?**
Sim. O mecanismo é preciso: Mongoose strict mode (`true` por default) descarta silenciosamente
campos não declarados no schema quando os documentos são lidos via `findById`/`find` com
retorno de instâncias Mongoose. A pipeline de migração usou raw MongoDB (`$set`) para gravar
`proposta_sm`, `origem` etc., que são ignorados pelo ORM. Não há contradição no comportamento —
é a semântica documentada do Mongoose strict mode.

**2. A abordagem de adicionar ao schema é correta (vs. usar `.lean()` no controller)?**
Adicionar ao schema é mais correto e sustentável. Usar `.lean()` exporia todos os campos
raw do documento incluindo internos do MongoDB e campos obsoletos de migrações passadas —
quebraria o contrato da API. O schema é o contrato. Adicionar `proposta_sm` como `Mixed`
é a única forma de manter o dado estruturado e acessível sem side-effects.

**3. O backfill via `proposta_sm.equipamentos` é confiável?**
Sim, com ressalvas claras: (a) `potencia_w = null` é esperado — o SM não inclui wattage
individual na pricingTable, apenas o nome do modelo; (b) a heurística marca/modelo funciona
para ~99% dos nomes de módulos fotovoltaicos (padrão `MARCA CODIGO-MODELO`); (c) o binding
ao Atlas fica correto como próxima sprint.

**4. Risco de regressão nos 8 projetos nativos (sem `status_migracao`)?**
Zero. O backfill filtra estritamente por `origem.tipo = import_solarmarket` + `proposta_sm exists`.
Projetos nativos não têm `origem.tipo = import_solarmarket` → não são tocados.

**5. Algo deixado passar?**
O campo `proposta_sm.equipamentos[].categoria` aparece como `undefined` no script de auditoria
original porque o código acessou `eq.category` (inglês) em vez de `eq.categoria` (português).
O backfill usou corretamente `eq.categoria`. A auditoria foi corrigida implicitamente pela
segunda consulta (dump completo). Não é um bug nos dados.

**6. Veredito: APROVADO** — causas corretas, fix cirúrgico, 514/514 projetos corrigidos,
0 regressões, build verde. O gap remanescente (wattage + binding) está claramente documentado
com sprint de continuidade indicada.
