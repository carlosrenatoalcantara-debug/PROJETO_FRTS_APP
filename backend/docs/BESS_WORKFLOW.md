# BESS_WORKFLOW.md

**Sprint:** P0-BESS-FOUNDATION-RCA-01 · READ-ONLY · conceitual

## FASE 5 — Motores de dimensionamento
| Motor | Objetivo | Versão |
|---|---|---|
| **Backup / Autonomia** | dimensiona kWh p/ manter carga crítica por N horas (SOC reserva) | **V1 (obrigatório)** |
| **Autoconsumo FV+BESS** | armazena excedente FV e desloca p/ consumo noturno | **V1 (obrigatório)** |
| Peak Shaving | recorta picos de demanda (kW) | V2 |
| Demand Charge Reduction | reduz componente tarifário de demanda | V2 |
| Arbitragem Tarifária | carrega em ponta barata / descarrega em ponta cara | V2 |
| Off-Grid | dimensiona p/ ilha permanente (dias de autonomia) | V2/V3 |

**V1 obrigatórios:** Backup + Autoconsumo (cobrem residencial e o híbrido FV+BESS, ~maior demanda).
Todos os motores partem de um núcleo comum (kWh úteis = capacidade × DoD × round-trip; ciclos/vida;
SOC mínimo) e divergem só na função-objetivo — projetar esse núcleo compartilhado desde a V1.

## FASE 6 — Workflow ideal (etapas)
```
B1 Cliente            (reuso cadastro)
   ↓
B2 Consumo            (reuso E2 FV — curva/fatura; p/ peak/demand: curva horária)
   ↓
B3 Objetivo do BESS   (NOVO — backup | autoconsumo | peak | demand | arbitragem | off-grid)
   ↓                  (define o motor; pode marcar fv_vinculado_id p/ híbrido)
B4 Equipamentos       (bateria/PCS/híbrido/EMS/STS — reuso do padrão E7: seletor + catálogo)
   ↓
B5 Dimensionamento    (motor por objetivo — kWh úteis, nº de bancos, PCS kW)
   ↓
B6 Simulação          (NOVO p/ BESS — SOC ao longo do dia, ciclos/ano, autonomia, % autoconsumo)
   ↓
B7 Orçamento          (reuso calcularOrcamento + itens BESS)
   ↓
B8 Unifilar           (reuso motor FV + elementos novos)
   ↓
B9 Homologação        (reuso framework + docs BESS)
   ↓
B10 Aprovação/Snapshot (reuso governança/snapshots)
```

## FASE 7 — Integração com FV (sem dependências erradas)
| Ponto FV | Como o BESS conversa | Regra |
|---|---|---|
| **E5 Dimensionamento** | lê potência/energia FV do `fv_vinculado_id` (se híbrido) | por referência; standalone ignora |
| **E7 Equipamentos** | mesmo padrão de seletor + catálogo único (tipos novos) | reusa, não copia |
| **E8 Orçamento** | mesma engine `calcularOrcamento`; BESS adiciona linhas | fonte única por projeto |
| **Unifilar** | reusa primitivas SVG; adiciona elementos | um motor, múltiplos elementos |
| **Homologação** | mesmo framework; templates BESS | estende |
| **Snapshots** | `snapshotEquipamentoSelecao` p/ congelar bateria/PCS | reusa |
| **Governança** | `engenhariaGovernanca` protege projeto BESS congelado | reusa |

**Proibições de acoplamento:** o ProjetoBESS NUNCA escreve dentro de `ProjetoFV.arranjos[]`/
`engenharia_eletrica`; a ligação é **somente leitura por referência** (`fv_vinculado_id`).

## FASE 8 — Orçamento (modelo)
**C. Híbrido (recomendado):** reusar o engine compartilhado `calcularOrcamento` (mesmo que FV/EV),
com um conjunto de **itens de linha BESS** (bateria, PCS/híbrido, EMS, STS, instalação, comissionamento).
Em híbrido FV+BESS, cada módulo mantém seu orçamento por projeto e um **resumo consolidado por
referência** soma os dois (sem fundir os engines). NÃO criar engine separado/incompatível (risco R3).

## FASE 9 — Unifilar (modelo)
- **Reutiliza o motor FV** (`gerarUnifilarSVG` / primitivas) — NÃO criar motor isolado.
- **Novos elementos gráficos:** banco de baterias, PCS, inversor híbrido, STS/ATS, painel de carga
  crítica, fronteira ilha/rede (grid/island), medidor bidirecional, EMS.
- Em FV+BESS, o unifilar do BESS pode **compor** com o do FV pela referência (uma instalação, dois blocos).

## FASE 10 — Homologação
- **Sim, há especificidade.** O fluxo FV é boa base (checklist + documentos + persistência), mas
  insuficiente sozinho. Documentos/itens adicionais prováveis: certificado **anti-ilhamento do PCS/
  híbrido**, datasheet/certificação **INMETRO da bateria**, **diagrama de armazenamento**, **memorial de
  proteções/coordenação**, ART específica, e os anexos de armazenamento da distribuidora (ex.: requisitos
  de sistemas de armazenamento sob a regulação de GD vigente).
- **Estratégia:** reusar o framework de homologação e adicionar **templates/checklist BESS** por
  distribuidora — como o FV faz com topologias de referência por concessionária.
