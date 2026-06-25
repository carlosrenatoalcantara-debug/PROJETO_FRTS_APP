# EV_CHARGER_AC_DC_ARCHITECTURE.md

**Sprint:** P0-EV-CATALOG-MODEL-REFORM-01 — proposta de arquitetura (pré-implementação)
**Base:** EV_CHARGER_AC_DC_RCA.md · READ-ONLY (nada implementado ainda)

## Princípio
`tipo_equipamento ∈ {AC, DC}` torna-se o **interruptor mestre** que governa form, OCR, validação,
score e exibição. Não inferir de outros campos. Seed inicial a partir do `CarregadorEV.tipo`
(AC_Mono/AC_Tri → AC; DC → DC) — os 7 atuais são todos AC.

## Ordem de correção (prioridade por impacto — guiada pela RCA)
1. **[BUG] Eliminar o TIPO_INVALIDO falso** (maior alavanca): em `catalogoQualidade.normalizar()`,
   não deixar o `tipo` do sub-esquema do carregador sobrescrever `plano.tipo` (que deve permanecer
   `carregador_ev`). Mapear o sub-tipo para um campo separado (`tipo_equipamento`). → confiança
   recupera, score sai de 32.
2. **[FASE 1] Campo `tipo_equipamento` (AC|DC)** explícito no schema do carregador (aditivo) + no
   espelho Equipamento. Master switch.
3. **[FASE 5] Split de score** por tipo, com sub-scores nomeados.
4. **[FASE 2/3] Form condicional** por `tipo_equipamento`.
5. **[FASE 4] OCR classifica AC/DC antes** de extrair.
6. **[FASE 6/7] Remover redundância + validação por tipo.**

## FASE 1 — `tipo_equipamento`
Aditivo (não remove o `tipo` AC_Mono/AC_Tri/DC existente — este vira "subtipo de fase"):
`tipo_equipamento: 'AC' | 'DC'` (obrigatório no cadastro; default derivado do subtipo).

## FASE 2 — Campos AC (quando tipo_equipamento=AC)
Engenharia: potencia_kw, tensao_alimentacao_v, corrente_max_a, numero_fases, tipo_plug, qtd_conectores, ocpp.
Complementares: iec_61851, grau_protecao_ip, temperatura, peso, dimensoes.
**Ocultar/ignorar:** tensao_saida_dc, corrente_saida_dc, faixa_tensao_dc, tempo_carga_rapida, eficiencia, conector_saida_dc.

## FASE 3 — Campos DC (quando tipo_equipamento=DC)
fabricante, modelo, potencia, tensao_entrada_ac, corrente_entrada_ac, tensao_saida_dc, faixa_tensao_dc,
corrente_saida_dc, tipo_conector(CCS2/CHAdeMO/GB-T/NACS), qtd_conectores, ocpp, eficiencia,
tempo_carga_rapida, ip, temperatura, peso, dimensoes.

## FASE 4 — OCR classifica primeiro
`extrairDatasheetEV`: 1) detectar AC vs DC (heurística: presença de saída DC / "DC fast"/"DC charger"/
CCS/CHAdeMO ⇒ DC; caso contrário AC); 2) extrair **apenas** os campos do tipo. Nunca rodar regex DC em AC.
Para AC, **derivar** tensao_alimentacao (220 mono / 380 tri) e corrente (P/(V·fator)) quando ausentes —
sem inventar: derivação física padrão, marcada como `inferido`.

## FASE 5 — Motor de qualidade (split)
- **Score Engenharia** (peso dominante): por tipo.
  - AC: identificacao, potencia_kw, tensao_alimentacao, corrente_max, numero_fases, tipo_plug, qtd_conectores, ocpp.
  - DC: identificacao, potencia, tensao/corrente entrada AC, tensao/corrente saída DC, faixa DC, conector, qtd, ocpp, eficiencia.
- **Score Catálogo** (enriquecimento, peso baixo): peso, dimensoes, temperatura, ip, iec, garantia, fotos, manual. **Não derruba o de engenharia.**
- **Score OCR** (confiança de extração: % campos `encontrado` vs `inferido`).
- **Score Geral** = combinação com **Engenharia dominante** (ex.: Eng 0.7 / Cat 0.2 / OCR 0.1) — a definir.
- Regra: um carregador AC com os campos de engenharia completos atinge alta pontuação **mesmo sem**
  peso/dimensoes/garantia.

## FASE 6 — Redundância potência
`potencia_nominal` vs `potencia_maxima`: para wallbox AC são iguais (EvoWatt: 7.4=7.4). Colapsar em
`potencia_kw` única; só manter as duas se realmente divergirem (não é o caso dos AC).

## FASE 7 — Validação por tipo
Validar **apenas** campos compatíveis com `tipo_equipamento`. Campos do outro tipo: ignorados —
não geram erro, warning, perda de score nem TIPO_INVALIDO. (Regra Fundamental da sprint.)

## FASE 8 — Compatibilidade (NÃO ALTERAR)
Projetos EV, dimensionamento NBR5410, BOM, orçamento, workflow, unifilar, APIs públicas, estrutura
do módulo EV. A reforma é **só no cadastro/catálogo de carregadores** (model + OCR + form + qualidade).
Os campos que o dimensionamento consome (potencia/tensao/corrente/fases/conector/qtd) permanecem.

## ESCOPO de arquivos a tocar (na implementação)
- `backend/src/models/CarregadorEV.js` (aditivo: tipo_equipamento)
- `backend/src/services/catalogoQualidade.js` (bug do tipo + split de score + PESOS por AC/DC)
- `backend/src/ai/camposEquipamento.js` (listas AC e DC separadas)
- `backend/src/controllers/carregadorEVControllerGemini.js` (classify-first + extração por tipo + derivação AC)
- `frontend/src/components/equipamentos/ModalNovoCarregadorEV.jsx` (form condicional)
- (NÃO tocar: regrasPlausibilidade além do necessário ao tipo; dimensionamento/BOM/orçamento/unifilar/APIs.)
