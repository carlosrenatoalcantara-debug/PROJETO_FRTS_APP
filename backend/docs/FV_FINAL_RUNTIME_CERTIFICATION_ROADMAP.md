# FV_FINAL_RUNTIME_CERTIFICATION_ROADMAP.md

**Sprint:** P0-FV-FINAL-RUNTIME-CERTIFICATION-01 · **Data:** 2026-06-23
**Regra:** defeito encontrado → RCA + sprint específica proposta. **Nada corrigido nesta sprint** (read-only).

## Veredito
**APROVADO COM RESSALVAS.** O pipeline de engenharia (agregação fonte única, coerência E7=E8,
quantidade desacoplada do E5, módulos limpos, persistência validada em sprints anteriores) está
íntegro. As 3 falhas são de **completude de dados do catálogo**, não de código.

## Sprints propostas (ordem de prioridade)

### 1. P1-CATALOG-INVERTER-MPPT-ENRICHMENT-01  (resolve RISK-CAT-ENT01 + RISK-CAT-ENV01)
**Objetivo:** completar o envelope elétrico por-MPPT dos inversores no catálogo.
- **Campo `entradas_por_mppt` (strings por MPPT)** ausente em ~13 inversores (incl. Huawei
  SUN2000-50KTL-M0 e 60KTL-M0). Sem ele, o sistema mostra 6 entradas em vez de 12.
  - Datasheet Huawei: 6 MPPT × 2 = 12 entradas DC → `entradas_por_mppt = 2`.
- **Janela MPPT (`tensao_mppt_min`/`tensao_mppt_max`) + `corrente_max_por_mppt`** ausentes num
  subconjunto (ex.: Solplanet ASW12K-LT-G2) → aviso "não mapeados" persiste.
- **Abordagem:** backfill via datasheet (OCR/Gemini já existe no projeto) ou enriquecimento
  manual; depois re-rodar `avaliarUtilizavel`/qualidade. **Não tocar** adaptador nem RCA fix
  (já corretos quando o dado existe).
- **Decisão de produto a confirmar:** quando o envelope MPPT faltar, o configurador deve
  (a) manter o aviso "não mapeados" (atual, honesto) ou (b) degradar com defaults conservadores
  e rótulo "estimado"? Recomendo (a) para não mascarar dado faltante em engenharia.

### 2. P2-CATALOG-COVERAGE-SOLPLANET-01  (resolve RISK-CAT-MODEL01)
**Objetivo:** cobrir modelos Solplanet faltantes (ex.: ASW6000-S-G2) — cadastro + datasheet.

### 3. P2-FV-E2E-UI-REGRESSION-01  (resolve RISK-CERT-COV01)
**Objetivo:** 1 ciclo E2E de UI (criar→salvar→fechar→reabrir) cobrindo T07–T10/T15
(MPPT, arranjos, wizard, homologação, governança) num ambiente com preview/Atlas, para
re-confirmar a persistência que hoje se apoia em evidência de sprints anteriores.

## O que NÃO precisa de sprint (já correto)
- Agregação fonte única e coerência E7=E8 (T01, T02, T11, T12).
- RCA "não mapeados" para módulos e para inversores COM envelope completo (T03/T04 sem aviso, T06).
- Irradiância por município para RN (T13).
- Gate de qualidade do catálogo / utilizavel_em_projeto (T14).
