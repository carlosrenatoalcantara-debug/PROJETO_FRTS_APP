# BESS_ARCHITECTURE_OPTIONS.md

**Sprint:** P0-BESS-FOUNDATION-RCA-01 · READ-ONLY

## FASE 1 — Casos de uso (todos suportados pela arquitetura escolhida)
| # | Caso | Classe | Observação |
|---|---|---|---|
| A | BESS Residencial | Topologia | backup + autoconsumo |
| B | BESS Comercial | Topologia | peak shaving / demand charge |
| C | BESS Industrial | Topologia | PCS + container + EMS |
| D | BESS Rural | Topologia | frequentemente off-grid/híbrido |
| E | BESS Off-Grid | Objetivo | ilha permanente |
| F | Backup Emergencial | Objetivo | carga crítica + autonomia |
| G | Peak Shaving | Objetivo | reduz pico de demanda |
| H | Arbitragem Tarifária | Objetivo | carrega barato / descarrega caro |
| I | Autoconsumo | Objetivo | maximiza uso do FV local |
| J | Demand Charge Reduction | Objetivo | reduz componente de demanda (kW) |
| K | FV + BESS | Composição | BESS referencia Projeto FV |
| L | BESS sem FV | Composição | standalone (NÃO pode depender de FV) |
| M | FV + EV + BESS | Composição | três módulos irmãos na mesma instalação |

> Os casos E–J são **objetivos** (drivers do motor de dimensionamento), A–D são **topologias/portes**,
> K–M são **modos de composição**. A arquitetura separa esses três eixos — sem isso, vira hard-code.

## FASE 2 — Modelo de projeto: opções avaliadas

### Opção A — Bateria aninhada no Projeto FV (`Projeto FV └ Bateria`)
- ❌ Quebra os casos **L** (BESS sem FV) e **M**. Acopla o ciclo de vida da bateria ao FV.
- ❌ Força refatoração quando surgir BESS comercial standalone.
- ❌ Contraria o padrão atual (EV NÃO é aninhado em FV).

### Opção B — Projeto unificado com filhos rígidos (`Projeto ├FV ├EV └BESS`)
- ⚠️ Conceitualmente elegante, mas a plataforma **hoje não tem** esse "Projeto" unificado:
  FV e EV são modelos irmãos independentes. Adotar B agora exigiria **refatorar FV e EV** —
  exatamente o que a sprint quer evitar.
- ⚠️ Risco de monólito: acoplar três domínios sob um schema único.

### Opção C (RECOMENDADA) — Módulo irmão + composição por referência
```
ProjetoFV   (existe)
ProjetoEV   (existe)
ProjetoBESS (novo, IRMÃO)  ──opcional──▶ referencia ProjetoFV.id (casos K/M)
        ▲
        └── reusa engines horizontais: Catálogo, calcularOrcamento, Unifilar SVG,
            Homologação, Snapshots, Governança, Gate de Qualidade
```
- ✅ **Expansão futura:** novo objetivo = novo motor, sem tocar FV/EV.
- ✅ **Manutenção:** domínio isolado; bugs de BESS não afetam FV.
- ✅ **Reutilização:** engines compartilhados (não duplica catálogo/orçamento/unifilar).
- ✅ **Homologação/Orçamento/Unifilar:** herdam o framework e estendem por tipo.
- ✅ **Standalone (L) e híbrido (K/M):** mesmos componentes, composição por referência.
- ✅ **Consistente com o que já existe** (EV) → zero refatoração de FV/EV.

**Veredito:** Opção C. (Um agregador futuro "Instalação/Site" para unir FV+EV+BESS pode existir
como camada de **leitura/visão**, NÃO como dono dos dados — adiar para depois da V1; não acoplar agora.)

## Eixo de topologia elétrica (modelar desde a V1, não hard-codar)
- **AC-coupled** (BESS com PCS próprio ao lado do inversor FV) vs **DC-coupled** (inversor híbrido).
- **Inversor híbrido** = uma entidade única (FV-MPPT + bateria), NÃO duas. O modelo de dados precisa
  representar ambos os acoplamentos — decidir no spike de dados, antes do build.
