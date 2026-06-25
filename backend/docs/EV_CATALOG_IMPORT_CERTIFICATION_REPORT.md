# EV_CATALOG_IMPORT_CERTIFICATION_REPORT.md

**Sprint:** P0-EV-CATALOG-IMPORT-CERTIFICATION-01 · **Modelo:** Claude Opus 4.8 · **Data:** 2026-06-24
**Tipo:** Certificação do fluxo de importação EV — **READ-ONLY (nada corrigido)**

> GEMINI: revisão cruzada PENDENTE (sem ferramenta no ambiente).

## DECLARAÇÃO DE HONESTIDADE
```
VALIDADO EM RUNTIME:  estado do catálogo (vazio) confirmado em 3 fontes; sem fantasmas.
VALIDADO EM CÓDIGO:   pipeline PDF→OCR→persistência→qualidade→dimensionamento traçado linha a linha.
AMOSTRA EMPÍRICA:     os 7 carregadores AC da sprint anterior (dados reais capturados antes da limpeza).
NÃO TESTADO:          UI no navegador; nova importação real (evitada — mutaria o catálogo vazio).
NÃO ALTERADO:         nenhuma linha de código/score/OCR/schema/frontend/backend.
```

## FASE 1 — Mapa do fluxo (onde cada informação é perdida)
```
PDF → OCR(extrairDatasheetEV, regex) → objeto carregador → CarregadorEV.save()
                                                          → Equipamento mirror.save()  ← PROJEÇÃO LOSSY
                                                          → pre('save') → catalogoQualidade → qualidade
Equipamento(carregador_ev) → /engenharia → frontend/edição → dimensionamento(NBR5410EV) → orçamento → unifilar
```
Pontos de perda comprovados:
- **OCR→objeto:** tensao_entrada (whitelist rígido) e corrente_entrada (regex) → null; peso_kg → null hardcoded; qtd_conectores/ocpp → nunca extraídos.
- **CarregadorEV→Equipamento mirror:** qtd_conectores, ocpp, peso, dimensoes, DC, frequencia, fator_potencia, tempo_carga, eficiencia **não copiados** (carregadoresEV.js:411-423).
- **objeto→qualidade:** `normalizarSpecsCarregador` lê só 5 campos → conector/qtd/ocpp não contam no score.
- **persistência→qualidade:** `origem='import_legado'` hardcoded → confiança capada em 40.

## FASE 2 — Tabela campo-a-campo
Ver `EV_CATALOG_IMPORT_CERTIFICATION_MATRIX.json` (16 campos × no_pdf/ocr/persistiu/edição/dimensionamento/score/necessário).

## FASE 3 — Classificação
- **Engenharia crítica:** fabricante, modelo, potencia_kw, tensao_entrada_v, corrente_entrada_a, numero_fases, tipo_conector, qtd_conectores.
- **Engenharia importante:** ocpp.
- **Comercial:** grau_protecao_ip, temperatura, peso_kg, garantia.
- **Marketing:** dimensoes_mm.
- **Nunca deveria existir (em AC):** tensao_saida_dc, corrente_saida_dc, faixa_tensao_dc, tempo_carga_rapida, eficiencia, conector_saida_dc.

## FASE 4 — Aptidão (amostra dos 7 AC)
☑ Orçamento · ☑ Unifilar · ☑ Catálogo (nível incompleto) · ☐ Dimensionamento (PARCIAL) · ☐ Projeto (PARCIAL).
**Motivo da parcialidade:** tensao_entrada/corrente_entrada vazios (OCR) e qtd_conectores fora do mirror —
campos críticos chegam vazios por OCR/persistência, **não por ausência no equipamento**.

## FASE 5 — Auditoria do motor de qualidade
- **Por que perdeu pontos:** (a) alerta crítico TIPO_INVALIDO zerava a confiança → score 32 — **JÁ CORRIGIDO** (commit d2ed5bc); (b) `origem=import_legado` → confiança 40 (teto); (c) completude 80 por tensao_entrada/corrente_entrada nulos.
- **Regra CORRETA:** penalizar ausência de tensao_entrada/corrente_entrada (relevantes p/ cabo/disjuntor); cap de confiança por origem fraca.
- **Regra ERRADA (aplicação):** marcar cadastro manual com datasheet como `import_legado` (deveria ser `datasheet_*`); ignorar conector/qtd/ocpp no `normalizarSpecsCarregador`/`PESOS_CARREGADOR`.

## FASE 6 — OCR errou OU arquitetura exige campo inexistente?
- **OCR ERROU (campo existe no PDF, OCR não pegou):** tensao_entrada_v, corrente_entrada_a (whitelist/regex), peso_kg (null hardcoded), qtd_conectores/ocpp (não extraídos).
- **ARQUITETURA EXIGE CAMPO INEXISTENTE (em AC):** tensao_saida_dc, corrente_saida_dc, tempo_carga_rapida, eficiencia — pedidos/exibidos para wallbox AC, onde não existem.

## FASE 7 — Lista única por categoria
Ver `EV_CATALOG_IMPORT_CERTIFICATION_PROBLEMS.json`: **OCR(5) · Persistência(3) · Arquitetura(3) · Qualidade(3) · UI(1) · Engenharia(1) · já corrigidos(1)**.

## RESPOSTAS OBRIGATÓRIAS
1. **Catálogo vazio?** SIM — Equipamento(carregador_ev)=0, CarregadorEV=0, /api/carregadores-ev=0.
2. **Equipamento fantasma?** NÃO.
3. **Inconsistência Mongo↔frontend?** Agora NÃO (ambos 0). Porém há inconsistência **estrutural** (mirror lossy) que se manifesta quando há dados.
4. **OCR perdendo informação?** SIM — tensao/corrente de entrada, peso, qtd_conectores, ocpp.
5. **Banco perdendo informação?** SIM — mirror Equipamento descarta qtd_conectores/ocpp/peso/dimensoes/DC/frequencia/fator_potencia.
6. **UI escondendo informação?** Não esconde; **mostra demais** (campos DC em AC). Não exercida em runtime de navegador.
7. **Qualidade penalizando corretamente?** PARCIAL — regras de tensao/corrente corretas; cap por origem aplicado à origem errada; conector/qtd/ocpp ignorados.
8. **Problemas de OCR?** 5.
9. **Problemas de arquitetura?** 3 (+1 já corrigido).
10. **Próxima sprint recomendada:** `P1-EV-CHARGER-AC-DC-SEPARATION-01` (já desenhada em EV_CHARGER_AC_DC_ARCHITECTURE.md) — engloba OCR classify-first, form/validação/score por tipo — **incluindo** corrigir `origem` (PER-2), o mirror lossy (PER-1) e a cobertura de score (ARQ-3/QUA-2).

## CRITÉRIO DE ACEITAÇÃO
Diagnóstico completo do processo de importação produzido (onde entra, onde se perde, onde é ignorado,
onde é usado, o que importa p/ engenharia). **Nenhuma correção feita.** Aprovado como certificação.
