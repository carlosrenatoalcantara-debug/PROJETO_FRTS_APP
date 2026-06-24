# BESS_DOMAIN_MAP.md

**Sprint:** P1-BESS-DATA-MODEL-SPIKE-01 · READ-ONLY · conceitual

## FASE 1 — Conceitos fundamentais

| Conceito | Definição | Papel no modelo |
|---|---|---|
| **ProjetoBESS** | Projeto de armazenamento (irmão de ProjetoFV/ProjetoEV). Dono dos dados de um sistema BESS. | Raiz/agregado |
| **Objetivo** | Driver funcional (backup, autoconsumo, peak shaving…). Define qual motor de dimensionamento roda. | Atributo do projeto (lista) |
| **PCS** (Power Conversion System) | Conversor bidirecional bateria↔rede (AC-coupled). Faz DC↔AC, controla carga/descarga, anti-ilhamento. | Entidade de catálogo + seleção no projeto |
| **Inversor Híbrido** | Equipamento único que combina MPPT FV + conversão de bateria (DC-coupled). NÃO é PCS+inversor separados. | Entidade de catálogo (tipo próprio) |
| **Banco de Baterias** | Agregado lógico de energia: N racks × M módulos. Define kWh nominal, tensão DC, química. | Agregado dentro do projeto |
| **Rack** | Subconjunto físico de módulos (string DC + BMS). Nível intermediário banco→módulo. | Sub-agregado |
| **Módulo de bateria** | Unidade de catálogo: kWh, V, química, DoD, C-rate, ciclos. | Item de catálogo (tipo `bateria`) |
| **EMS** (Energy Management System) | Controlador/estratégia de operação (executa o objetivo: quando carregar/descarregar). | Entidade de catálogo + config do projeto |
| **STS/ATS** | Chave de transferência rede↔ilha (backup). Comuta a carga crítica. | Entidade de catálogo + nó do unifilar |
| **Carga crítica** | Cargas que devem permanecer energizadas na ilha (backup). Potência/energia/prioridade. | Agregado do projeto (entrada do motor backup) |
| **FV vinculado** | ProjetoFV referenciado (casos K/M). Fonte de geração para autoconsumo/híbrido. | Referência (`fv_vinculado_id`), não embed |
| **Transformador** | Elevador/abaixador quando aplicável (comercial/industrial). | Entidade de catálogo (V2+) |
| **Barramento** | Ponto elétrico de conexão (AC/DC) onde PCS, FV, rede e cargas se encontram. | Conceito do unifilar (nó) |

## Hierarquia de energia (espelha arranjo→string→módulo do FV)
```
ProjetoBESS
  └── BancoBaterias[]            (kWh nominal, tensão DC, química)
        └── Rack[]               (N por banco; string DC + BMS)
              └── ModuloBateria  (item de catálogo)
  └── PCS[] | InversorHibrido[]  (conversão; define potência kW/kVA)
  └── EMS                        (estratégia/objetivo)
  └── STS/ATS                    (backup/ilhamento)
  └── CargasCriticas[]           (entrada do motor backup)
  └── fv_vinculado_id            (referência opcional ao ProjetoFV)
```

## Eixos ortogonais (não confundir — separar no modelo)
- **Topologia elétrica:** AC-coupled | DC-coupled | híbrido (atributo por subsistema/banco).
- **Objetivo:** backup | autoconsumo | peak_shaving | demand_charge | arbitragem | off_grid | microgrid.
- **Composição:** standalone | FV+BESS | FV+EV+BESS (via referência).
- **Porte:** residencial | comercial | industrial | rural (afeta container/HVAC/transformador).
