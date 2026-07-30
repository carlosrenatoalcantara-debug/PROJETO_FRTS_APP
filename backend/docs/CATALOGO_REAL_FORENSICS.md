# CATÁLOGO REAL — Auditoria Forense (P0-CATALOG-FORENSICS-04)

> Fonte: **Atlas cluster0.iva0pph.mongodb.net / forte_solar / equipamentos** · gerado 2026-06-06T19:49:53.268Z · **read-only** · total **95** documentos.

## FASE 1 — Inventário real

Por tipo: **modulo: 56** · **carregador_ev: 17** · **inversor: 22**

Fabricantes distintos: **27** · modelos distintos: **92**

### TOP 20 fabricantes
| # | Fabricante | Total | Tipos |
|---|---|---|---|
| 1 | ZNShine Solar | 29 | modulo:29 |
| 2 | Goodwe | 9 | inversor:9 |
| 3 | Risen Energy | 7 | modulo:7 |
| 4 | Huawei | 7 | carregador_ev:1, inversor:6 |
| 5 | Trina Solar | 6 | modulo:6 |
| 6 | Renesola | 5 | modulo:5 |
| 7 | Neosolar | 4 | modulo:4 |
| 8 | Sirius Energias Renováveis | 2 | modulo:2 |
| 9 | INTELBRAS | 2 | carregador_ev:2 |
| 10 | Wallbox | 2 | carregador_ev:2 |
| 11 | Schneider | 2 | carregador_ev:2 |
| 12 | Canadian Solar | 2 | modulo:2 |
| 13 | Solplanet | 2 | inversor:2 |
| 14 | Chint | 2 | inversor:2 |
| 15 | Solis | 2 | inversor:2 |
| 16 | OSDA SOLAR | 1 | modulo:1 |
| 17 | Tesla | 1 | carregador_ev:1 |
| 18 | BYD | 1 | carregador_ev:1 |
| 19 | WEG | 1 | carregador_ev:1 |
| 20 | ChargePoint | 1 | carregador_ev:1 |

## FASE 2 — Completude (inversores)

Média geral (22 inversores): **90%**

| Fabricante | Inversores | Completude |
|---|---|---|
| Goodwe | 9 | 93.3% |
| Chint | 2 | 90% |
| Huawei | 6 | 88.9% |
| Solis | 2 | 86.7% |
| Deye | 1 | 86.7% |
| Solplanet | 2 | 83.4% |

**Campos mais ausentes:** tensao_partida (22/22) · n_mppts (2/22) · strings_por_mppt (2/22) · corrente_max_por_mppt (2/22) · faixa_mppt (2/22) · corrente_isc_max (1/22) · tensao_max_entrada (1/22) · dimensoes (1/22)

## FASE 3 — Aprendizados persistidos

Documentos com TODAS as estruturas: **95/95**
Presença por estrutura: identificacao 100% · origem 100% · qualidade 100% · specs_canonicas 100% · status_operacional 100% · validacao 100%
Versões de schema: 2.0: 95

## FASE 4 — Proveniência

- desconhecido: 100%

## FASE 5 — Inteligência do sistema
| Collection | Registros |
|---|---|
| aliascampos | 138 |
| dicionariocanonicos | 23 |
| datasheet_processamentos | 1 |
| datasheetcaches | 0 |
| auditlogs | 1432 |

## FASE 6 — Qualidade de engenharia

Níveis de qualidade (motor): incompleto: 3 · invalido: 3 · suspeito: 16

Classificação (22 inversores):
- A) apto engenharia (dimensionamento completo): **17**
- B) apto unifilar: **22**
- C) apto parecer: **22**
- D) precisa revisão: **8**
- E) precisaria perfil conservador (sem info de MPPT/strings): **3**

## FASE 7 — Priorização (só dados reais)
| Prioridade | Fabricante | Inversores | Completude |
|---|---|---|---|
| P0 | Goodwe | 9 | 93.3% |
| P1 | Huawei | 6 | 88.9% |
| P2 | Solplanet | 2 | 83.4% |
| P2 | Solis | 2 | 86.7% |
| P2 | Chint | 2 | 90% |
| P3 | Deye | 1 | 86.7% |
