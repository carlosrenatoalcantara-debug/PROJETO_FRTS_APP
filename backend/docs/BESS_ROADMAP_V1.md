# BESS_ROADMAP_V1.md

**Sprint:** P1-BESS-DATA-MODEL-SPIKE-01 · READ-ONLY · roadmap técnico (sem implementar)

## Pré-condição fechada por este spike
Modelo de dados conceitual definido (BESS_DATA_MODEL_SPIKE.md): agregados, camadas spec×projeto×
simulação, AC/DC, DoD/SOC/C-rate/autonomia/ciclos, vínculo FV por referência+snapshot.

## Sequência técnica até a V1
| # | Sprint | Entrega | Fecha |
|---|---|---|---|
| 1 | **P1-BESS-CATALOG-TYPES-01** | tipos aditivos no `Equipamento` (pcs/ems/sts/inversor_hibrido) + campos de spec da bateria (DoD/C-rate/ciclos/química/V) + cadastro manual; reusa gate de qualidade | catálogo |
| 2 | **P1-BESS-PROJECT-MODEL-01** | `ProjetoBESS` (modelo irmão, strict controlado, whitelist de POST cobrindo todos os campos — lição EV-RDY-01) + CRUD básico | persistência |
| 3 | **P1-BESS-ENGINE-CORE-01** | núcleo de simulação: kWh úteis, SOC bounds, round-trip efetivo (AC/DC), ciclos→SOH→vida útil | simulação base |
| 4 | **P1-BESS-ENGINE-BACKUP-01** | motor Backup (carga crítica + autonomia_alvo → banco/PCS) | objetivo V1 |
| 5 | **P1-BESS-ENGINE-AUTOCONSUMO-01** | motor Autoconsumo (curva FV do fv_vinculado + consumo → %autoconsumo) | objetivo V1 |
| 6 | **P1-BESS-WIZARD-01** | etapas B1–B6 (Cliente→Consumo→Objetivo→Equipamentos→Dimensionamento→Simulação), persistência sem perda | workflow |
| 7 | **P1-BESS-ORCAMENTO-01** | reusa calcularOrcamento + itens BESS + consolidação FV+BESS por referência | orçamento |
| 8 | **P1-BESS-UNIFILAR-01** | reusa motor SVG + elementos novos (banco/PCS/híbrido/STS/carga crítica/ilha-rede); diagrama_editado persistente | unifilar |
| 9 | **P1-BESS-HOMOLOGACAO-01** | framework FV + templates/documentos BESS por distribuidora | homologação |
| 10 | **P0-BESS-RUNTIME-CERTIFICATION-01** | certificação E2E (casos L standalone e K FV+BESS) | encerramento V1 |

## Pós-V1 (não bloqueia)
Motores Peak Shaving / Demand Charge / Arbitragem / Off-grid / Microgrid; container/HVAC industrial;
camada de leitura "Instalação/Site" unificando FV+EV+BESS (visão, não dono dos dados).

## Definição de pronto da V1
✓ standalone (L) e FV+BESS (K) · ✓ Backup + Autoconsumo · ✓ catálogo bateria/PCS/híbrido ·
✓ simulação (SOC/ciclos/autonomia/SOH) · ✓ orçamento híbrido · ✓ unifilar BESS · ✓ homologação base ·
✓ persistência sem perda (round-trip salvar→reabrir testado).

## Próxima sprint
**`P1-BESS-CATALOG-TYPES-01`** — primeiro toque em produção será no catálogo (aditivo), depois o modelo de projeto.
