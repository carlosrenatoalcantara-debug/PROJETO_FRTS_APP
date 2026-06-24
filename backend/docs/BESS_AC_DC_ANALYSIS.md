# BESS_AC_DC_ANALYSIS.md

**Sprint:** P1-BESS-DATA-MODEL-SPIKE-01 · READ-ONLY

## FASE 2 — AC Coupled vs DC Coupled

### AC Coupled
```
FV → Inversor FV → (barramento AC) → PCS → Bateria
                          ↑
                        Rede / Cargas
```
- **FV e bateria têm conversores próprios.** A bateria conecta no barramento AC via PCS.
- **Vantagens:** ideal para **retrofit** (FV já existe); FV e BESS dimensionados de forma independente;
  PCS e inversor FV de fabricantes diferentes.
- **Limitações:** energia FV→bateria passa por **2 conversões** (DC→AC no inversor FV, AC→DC no PCS) →
  menor eficiência de carga via FV. Mais equipamentos.

### DC Coupled
```
FV → Inversor Híbrido → Bateria
           ↓
        Rede / Cargas
```
- **Um inversor híbrido** faz MPPT do FV e gerencia a bateria no lado DC.
- **Vantagens:** FV→bateria com **1 conversão** → maior eficiência de carga via FV; menos equipamentos;
  melhor para sistemas **novos** (FV+BESS projetados juntos).
- **Limitações:** acoplamento forte FV↔bateria (uma falha afeta ambos); potência do híbrido limita FV+bateria;
  menos flexível para retrofit.

### Impacto no MODELO DE DADOS
| Dimensão | AC-coupled | DC-coupled |
|---|---|---|
| Conversor | `PCS` (entidade) + `inversor` FV (no ProjetoFV vinculado) | `inversor_hibrido` (entidade única) |
| Eficiência FV→bateria | round-trip menor (2 conversões) | round-trip maior (1 conversão) |
| Vínculo FV | referência ao ProjetoFV (inversor FV separado) | o híbrido vive no ProjetoBESS (FV-MPPT embutido) |
| Campo no projeto | `acoplamento = 'ac_coupled'` | `acoplamento = 'dc_coupled'` |

### Podem coexistir? **SIM.**
Uma mesma instalação pode ter um BESS **AC-coupled** (retrofit) e outro **DC-coupled** (novo).
→ Modelar `acoplamento` **no nível do subsistema/banco** (cada banco/PCS tem o seu), com um
**default no projeto**. Na V1 pode-se restringir a um acoplamento por projeto, MAS o modelo de dados
deve permitir por-subsistema desde já, para não refatorar (risco R-DM-04).

### Regra de eficiência (entra na simulação)
`round_trip_efetivo = eff_pcs_ou_hibrido × eff_bateria` — DC-coupled economiza uma conversão na carga
via FV. A eficiência é **atributo do equipamento** (PCS/híbrido/bateria); o round-trip **efetivo do
caminho** é **calculado na simulação** conforme o acoplamento.
