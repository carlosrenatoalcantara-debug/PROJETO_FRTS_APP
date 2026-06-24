# BESS_SIMULATION_MODEL.md

**Sprint:** P1-BESS-DATA-MODEL-SPIKE-01 · READ-ONLY · conceitual

**Princípio transversal:** separar sempre **atributo da bateria/equipamento** (spec do catálogo, imutável)
× **atributo do projeto** (escolha de projeto/design) × **atributo da simulação** (resultado calculado).
Confundir esses três é a causa nº1 de refatoração (risco R-DM-01).

## FASE 4 — DoD / SOC
| Parâmetro | Camada | Notas |
|---|---|---|
| `dod_max` (profundidade máx. recomendada) | **bateria** | LFP ~90-100%, NMC ~80-90% |
| `dod_operacional` (DoD de projeto) | **projeto** | escolha ≤ dod_max; afeta vida e kWh úteis |
| `soc_min` (piso operacional) | **projeto** | = 100% − dod_operacional |
| `soc_max` (teto de carga) | **projeto** | normalmente 100% |
| `soc_reserva_backup` (reserva p/ ilha) | **projeto** | piso extra quando objetivo=backup |
| `soc_curva[]` (SOC ao longo do tempo) | **simulação** | série temporal, resultado |
| `eff_round_trip` | **bateria/PCS** (spec) → **simulação** (efetivo do caminho) | ver AC/DC |

**kWh úteis** = `kwh_nominal × dod_operacional × eff_round_trip` (calculado na simulação).
SOC é **estado de runtime/simulação**, nunca um valor estático persistido no equipamento.

## FASE 5 — C-rate
| Item | Camada |
|---|---|
| `c_rate_carga_max`, `c_rate_descarga_max` (0.5C/1C/2C…) | **bateria** (spec) |
| `c_rate_operacional` (= potência PCS ÷ kWh banco) | **projeto** (derivado da config) |
| `c_rate_instantaneo` (por instante) | **simulação** |
**Modelagem:** C-rate é razão potência/energia. Guardar limites como spec da bateria; o C-rate de
operação é **consequência** da potência do PCS vs kWh do banco — validar `c_rate_operacional ≤ c_rate_max`.

## FASE 6 — Autonomia
**AMBOS (entrada E resultado), conforme o objetivo:**
- Objetivo **backup**: `autonomia_alvo_h` é **entrada** (dimensiona o banco p/ sustentar a carga crítica).
- Sempre: `autonomia_calculada_h` é **resultado** da simulação (dado o banco e a carga reais).
- Objetivo **autoconsumo/arbitragem**: autonomia é só **resultado** (não é o driver).
→ Modelar `autonomia_alvo_h` (projeto, opcional) + `autonomia_calculada_h` (simulação).

## FASE 7 — Ciclos / Degradação / Vida
| Parâmetro | Camada |
|---|---|
| `vida_ciclos` (ex.: 6000 @ 80% DoD), `vida_calendario_anos` | **bateria** (spec) |
| `garantia_anos`, `garantia_ciclos`, `soh_garantido_fim` (ex.: 70%) | **bateria** (spec) |
| `ciclos_por_dia` (do perfil/objetivo) | **simulação** |
| `ciclos_por_ano`, `degradacao_pct_ano`, `soh_curva[]` | **simulação** |
| `vida_util_estimada_anos` = min(limite por ciclos, limite calendário) | **simulação** |
**Regra:** ciclos/dia derivam do objetivo (backup ~0.3-1; autoconsumo ~1; arbitragem ~1-2). SOH e vida
útil são **resultados** calculados a partir da spec da bateria + uso simulado.

## FASE 8 — Objetivos (modelagem + escopo V1)
| Objetivo | Entrada-chave | V1? |
|---|---|---|
| **Backup** | carga crítica + autonomia_alvo_h | **V1** |
| **Autoconsumo** (FV+BESS) | curva FV (do fv_vinculado) + curva de consumo | **V1** |
| Peak Shaving | curva de demanda + limite kW alvo | V2 |
| Demand Charge Reduction | tarifa de demanda + curva | V2 |
| Arbitragem | tarifa horária | V2 |
| Off-grid | dias de autonomia + geração | V2/V3 |
| Microgrid | múltiplas fontes/cargas + EMS avançado | V3 |
Modelar `objetivos[]` como lista de enum (um projeto pode ter mais de um, com prioridade).

## FASE 9 — PCS / Inversor Híbrido
| Atributo | Camada |
|---|---|
| `potencia_kw`, `potencia_kva`, `eficiencia`, `faixa_tensao_dc`, `corrente_max`, `modos_suportados[]`, `anti_ilhamento` | **PCS/híbrido** (spec catálogo) |
| `pcs_selecionado`, `quantidade`, `modo_operacao` | **projeto** |
| `potencia_despachada[]`, `perdas` | **simulação** |
`modos_suportados`: on_grid | off_grid | backup | grid_forming. O modo do projeto deve ⊆ modos do PCS.

## FASE 10 — Banco de baterias
Hierarquia **módulo → rack → banco (→ container)**. Catálogo = **módulo** (ou rack).
Projeto compõe: `banco.kwh_nominal = n_racks × modulos_por_rack × modulo.kwh`.
Modelar `BancoBaterias[]` com `{ modulo_id, modulos_por_rack, n_racks, acoplamento, kwh_calculado }`
— espelha o agregado `arranjo` do FV (arranjo→string→módulo). Container = atributo de porte (V2+).

## FASE 11 — Cargas críticas (entrada do motor backup)
| Campo | Camada |
|---|---|
| `potencia_critica_kw` (soma das cargas a sustentar) | **projeto** |
| `energia_critica_kwh` (= potência × autonomia, ou informada) | **projeto/derivado** |
| `prioridade` (lista priorizada de circuitos) | **projeto** |
| `tempo_sustentacao_h` (= autonomia_alvo) | **projeto** |
Modelar `CargasCriticas[]` com `{ descricao, potencia_kw, prioridade, essencial }` + agregados.
