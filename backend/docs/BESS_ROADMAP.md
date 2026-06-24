# BESS_ROADMAP.md

**Sprint:** P0-BESS-FOUNDATION-RCA-01 · READ-ONLY · roadmap inicial (sem implementar)

## Princípio
BESS = módulo irmão (como o EV), reusando engines horizontais, compondo com FV por referência.
Cada sprint entrega valor vertical e respeita as lições já pagas (EV-RDY-01, NEW-01, E8 fonte única).

## Sequência recomendada

### Sprint 1 — `P1-BESS-DATA-MODEL-SPIKE-01` (design + 1 tabela de rascunho, sem produção)
- Modelar conceitualmente `ProjetoBESS` (espelho de ProjetoEV) + contrato de composição `fv_vinculado_id`.
- Definir campos obrigatórios da bateria/PCS (DoD, round-trip, C-rate, ciclos, V, anti-ilhamento) — fecha R7.
- Definir eixos topologia × objetivo × composição. Decidir `inversor_hibrido` (tipo novo vs flag) — fecha R6/R8.
- **Saída:** esquema validado + decisão de catálogo. Ainda sem wizard.

### Sprint 2 — `P1-BESS-CATALOG-TYPES-01` (catálogo)
- Estender o ÚNICO `Equipamento` com tipos aditivos (`pcs`, `ems`, `sts`, `transformador`, e híbrido).
- Reusar gate de qualidade + pipeline de datasheet. Cadastro manual de bateria/PCS. — fecha R2.

### Sprint 3 — `P1-BESS-ENGINE-BACKUP-AUTOCONSUMO-01` (dimensionamento V1)
- Núcleo comum (kWh úteis, SOC, ciclos) + motores **Backup** e **Autoconsumo FV+BESS**. — fecha R5 (parcial).

### Sprint 4 — `P1-BESS-WIZARD-01` (workflow B1–B6)
- Etapas Cliente→Consumo→Objetivo→Equipamentos→Dimensionamento→Simulação.
- Persistência por projeto desde o início + teste round-trip salvar→reabrir. — fecha R9/R10.

### Sprint 5 — `P1-BESS-ORCAMENTO-01`
- Reusar `calcularOrcamento` com itens BESS + consolidação por referência (FV+BESS). — fecha R3.

### Sprint 6 — `P1-BESS-UNIFILAR-01`
- Reusar motor SVG + novos elementos (banco, PCS, híbrido, STS, carga crítica, fronteira ilha/rede). — fecha R4.

### Sprint 7 — `P1-BESS-HOMOLOGACAO-01`
- Reusar framework + templates/checklist/documentos BESS por distribuidora.

### Sprint 8 — `P0-BESS-RUNTIME-CERTIFICATION-01`
- Certificação ponta a ponta (espelha a do FV): casos L (standalone) e K (FV+BESS).

### Pós-V1 (não bloqueia)
- Motores Peak Shaving / Demand Charge / Arbitragem / Off-Grid.
- Camada de leitura "Instalação/Site" unificando FV+EV+BESS (visão, não dono dos dados) — adiada (R12).
- Porte industrial: container/HVAC.

## Definição de "V1 do BESS"
✓ standalone (L) e híbrido (K) · ✓ motores Backup + Autoconsumo · ✓ catálogo bateria/PCS/híbrido ·
✓ orçamento híbrido · ✓ unifilar com elementos BESS · ✓ homologação base · ✓ persistência sem perda.

## Próxima sprint
**`P1-BESS-DATA-MODEL-SPIKE-01`** — fechar o modelo de dados (R6/R7/R8) antes de qualquer build.
