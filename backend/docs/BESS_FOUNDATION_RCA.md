# BESS_FOUNDATION_RCA.md

**Sprint:** P0-BESS-FOUNDATION-RCA-01 · **Modelo:** Claude Opus 4.8 · **Data:** 2026-06-24
**Tipo:** Arquitetura Fundacional BESS — **READ-ONLY** (sem código, sem tabelas, sem implementação)

> GEMINI: revisão cruzada PENDENTE (sem ferramenta no ambiente).

## DECLARAÇÃO DE HONESTIDADE
```
VALIDADO EM CÓDIGO:  padrões reais da plataforma (ProjetoFV/ProjetoEV siblings; Equipamento.tipo
                     já inclui 'bateria'; calcularOrcamento/unifilar/homologação compartilhados).
NÃO TESTADO:         nada a testar — é definição de arquitetura.
DECISÃO:             ancorada no padrão EV (módulo irmão que reusa engines horizontais).
```

## Achados do terreno (fundamentam a decisão)
- `backend/src/models/` tem **ProjetoFV** e **ProjetoEV** como modelos **irmãos separados** (EV não é aninhado em FV). `ProjetoEV` é `strict:false`, com orcamento/financeiro/diagrama_editado próprios.
- `Equipamento.tipo` (catálogo único) já tem o enum `['modulo','inversor','estrutura','bateria','carregador_ev']` → **'bateria' já existe**; há `pages/Baterias.jsx` e cadastro manual de baterias.
- Engines **horizontais compartilhados**: `calcularOrcamento` (FV e EV usam), unifilar SVG (`gerarUnifilarSVG` / `gerarUnifilarEV`), homologação, snapshots (`snapshotEquipamentoSelecao`), governança (`engenhariaGovernanca`), gate de qualidade do catálogo (`utilizavelProjeto`/`catalogoQualidade`).
- **Lições já pagas** (devem guiar BESS): persistência por whitelist no POST (EV-RDY-01 — campo caía fora); estado volátil em `Map()` (NEW-01); fonte única de agregação (E8) para não recalcular em paralelo.

## Conclusão (resumo)
**BESS = módulo de primeira classe IRMÃO (ProjetoBESS)**, espelhando o EV, **reusando** os engines
horizontais e **compondo com FV por referência opcional** (não por aninhamento). Isto suporta os
casos L (BESS sem FV), K (FV+BESS) e M (FV+EV+BESS) sem acoplar nem forçar refatoração.

Ver: `BESS_ARCHITECTURE_OPTIONS.md`, `BESS_DATA_MODEL.md`, `BESS_WORKFLOW.md`, `BESS_ROADMAP.md`, `BESS_RISKS.json`.

## RESPOSTAS OBRIGATÓRIAS
1. **Melhor arquitetura?** Módulo irmão `ProjetoBESS` reusando engines horizontais + composição opcional por referência a um Projeto FV (Opção C refinada — ver options).
2. **BESS módulo próprio?** SIM (como o EV).
3. **BESS depende do FV?** NÃO. Standalone (caso L) é obrigatório; compõe com FV por referência (K/M).
4. **Motores obrigatórios na V1?** **Backup/Autonomia** + **Autoconsumo (FV+BESS)**. Peak Shaving, Demand Charge, Arbitragem e Off-Grid → V2+.
5. **Workflow ideal?** Cliente → Consumo → Objetivo BESS → Equipamentos → Dimensionamento → Simulação → Orçamento → Unifilar → Homologação → Aprovação.
6. **Integração ao orçamento?** Híbrido: reusar `calcularOrcamento` com itens de linha BESS (bateria/PCS/EMS/instalação). NÃO criar engine separado.
7. **Integração ao unifilar?** Reusar o motor SVG do FV + novos elementos gráficos (banco de baterias, PCS, inversor híbrido, STS/ATS, painel de carga crítica, fronteira ilha/rede).
8. **Integração à homologação?** Reusar o framework FV (checklist + docs) + documentos/itens específicos BESS (cert. anti-ilhamento do PCS, datasheet/cert. da bateria, diagrama de armazenamento, coordenação de proteções).
9. **Maior risco arquitetural?** Acoplar BESS ao FV (aninhar a bateria dentro do arranjo FV) → quebra o BESS standalone e força refatoração futura. (Top 10 em BESS_RISKS.json.)
10. **Próxima sprint recomendada?** `P1-BESS-DATA-MODEL-SPIKE-01` — modelar conceitualmente `ProjetoBESS` + tipos de catálogo aditivos (pcs/ems/sts/inversor_hibrido) e o contrato de composição com FV, ainda sem implementar o wizard.

## CRITÉRIO DE APROVAÇÃO — aferição
✅ Arquitetura definida · ✅ Modelo de projeto definido · ✅ Modelo de dados definido (conceitual) ·
✅ Estratégia de catálogo · ✅ de dimensionamento · ✅ de orçamento · ✅ de unifilar · ✅ Roadmap inicial.
**Sem código, sem implementação, sem tabelas definitivas.**
