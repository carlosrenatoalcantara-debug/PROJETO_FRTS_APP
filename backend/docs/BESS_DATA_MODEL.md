# BESS_DATA_MODEL.md

**Sprint:** P0-BESS-FOUNDATION-RCA-01 · READ-ONLY · **conceitual — sem tabelas definitivas, sem implementar**

## FASE 3 — Entidades (conceituais)

### Projeto (raiz do módulo)
- **ProjetoBESS** (irmão de ProjetoFV/ProjetoEV) — campos núcleo:
  - cliente, consumo (reuso E2), localização (reuso E3), distribuidora
  - `objetivos[]`: backup | autoconsumo | peak_shaving | demand_charge | arbitragem | off_grid
  - `topologia`: ac_coupled | dc_coupled | hibrido
  - `fv_vinculado_id` (opcional → ProjetoFV; casos K/M) — **referência, não embed**
  - `arquitetura[]` (bancos/PCS configurados), `dimensionamento`, `simulacao`, `orcamento`,
    `financeiro`, `homologacao`, `unifilar`/`diagrama_editado`, `snapshots`
  - espelha o padrão ProjetoEV (strict controlado, whitelist de persistência no POST — lição EV-RDY-01)

### Entidades de engenharia (dentro do projeto, conceituais)
| Entidade | Papel |
|---|---|
| **Banco de Baterias** | agregado de racks/módulos; capacidade kWh, tensão DC, química |
| **Bateria (módulo/rack)** | unidade de catálogo; kWh, V, química (LFP/NMC), DoD, ciclos, C-rate |
| **PCS** (Power Conversion System) | conversor bateria↔rede; kW, kVA, eficiência, anti-ilhamento |
| **Inversor Híbrido** | FV-MPPT + bateria numa entidade (DC-coupled) |
| **EMS** (Energy Mgmt System) | estratégia de operação (qual motor/objetivo) |
| **STS/ATS** | transferência rede↔ilha (backup) |
| **Carga Crítica / Painel de Backup** | o que fica energizado na ilha |
| **Transformador** | quando aplicável (comercial/industrial) |
| **Proteções** | disjuntores DC/AC, DPS, coordenação |
| **Container / HVAC** | porte industrial (térmica, segurança) |

### Parâmetros que o modelo DEVE carregar desde a V1 (senão refatora)
- Bateria: **kWh nominal, DoD (profundidade de descarga), eficiência round-trip, C-rate (carga/descarga),
  vida em ciclos, química, janela de tensão DC**.
- PCS/Híbrido: **kW/kVA, eficiência, faixa de tensão DC da bateria, anti-ilhamento, on/off-grid**.
- Sistema: **SOC mínimo operacional, reserva de backup, autonomia-alvo (h), acoplamento AC/DC**.

> Sem DoD/round-trip/C-rate/ciclos no modelo, o dimensionamento e a simulação ficam errados e exigem
> migração depois. Definir esses campos é o objetivo do **spike de dados** (próxima sprint).

## FASE 4 — Catálogo (estender o ÚNICO catálogo `Equipamento`, NÃO duplicar)
`Equipamento.tipo` hoje: `modulo | inversor | estrutura | bateria | carregador_ev`.
**Aditivos propostos** (aditivo no enum, como BUG-HIST-ENUM-01 ensinou — manter sync schema↔código):

| Tipo de equipamento | Novo `tipo`? | Observação |
|---|---|---|
| Baterias | `bateria` (já existe) | enriquecer especificacoes: kWh, DoD, química, ciclos, C-rate, V |
| PCS | `pcs` (novo) | kW/kVA, eficiência, anti-ilhamento |
| Inversores Híbridos | `inversor_hibrido` (novo) ou flag em `inversor` | decidir no spike — evitar duplicar com 'inversor' |
| EMS | `ems` (novo) | controlador/estratégia |
| STS/ATS | `sts` (novo) | transferência |
| Transformadores | `transformador` (novo) | comercial/industrial |
| Proteções | reusar BOM, não catálogo | disjuntores/DPS via materiais |
| Containers | `container` (novo) | porte industrial (V2+) |
| HVAC | atributo do container | V2+ |

- **Reusar** o gate de qualidade (`utilizavelProjeto`/`catalogoQualidade`), os adaptadores e o pipeline
  de datasheet (OCR/Gemini) — exatamente como FV/EV. NÃO criar catálogo paralelo.
