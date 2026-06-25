# EV_CHARGER_TIPO_INVALIDO_FIX_RUNTIME.md

**Sprint:** P0-EV-CATALOG-MODEL-REFORM-01 — etapa 1 (decisão do usuário: "bug do score primeiro, AC/DC depois")
**Modelo:** Claude Opus 4.8 · **Data:** 2026-06-24 · **Commit fix:** `d2ed5bc`

> GEMINI: revisão cruzada PENDENTE (sem ferramenta no ambiente).

## DECLARAÇÃO DE HONESTIDADE
```
VALIDADO EM CÓDIGO:  causa raiz confirmada (especificacoes.tipo_carregador="AC_Tri" vira specs.tipo
                     e sobrescrevia plano.tipo → TIPO_INVALIDO crítico → confianca=0 → score 32).
VALIDADO EM RUNTIME: os 7 carregadores reais reprocessados (via pre('save') hook) — ANTES/DEPOIS abaixo.
ESCOPO DESTA ETAPA:  apenas a correção do bug TIPO_INVALIDO (o usuário optou por adiar a separação
                     AC/DC completa para uma 2ª sprint).
NÃO FEITO AINDA:     tipo_equipamento(AC|DC) master switch, form condicional, OCR classify-first,
                     split de score (Eng/Cat/OCR/Geral) — próxima sprint.
```

## Causa raiz (confirmada)
`catalogoQualidade.normalizar()` montava o `plano` com `tipo: equipamento.tipo` ANTES de
`...specs_canonicas`. Para carregador, `normalizarSpecsCarregador` traz `tipo` =
`pick(esp,['tipo','tipo_carregador'])` = **"AC_Tri"/"AC_Mono"** (o sub-tipo de fase) → o spread
**sobrescrevia** `plano.tipo` com um valor fora de `[modulo,inversor,estrutura,bateria,carregador_ev]`
→ regra `TIPO_INVALIDO` (crítico) disparava → `MULTIPLICADOR_ALERTA.critico=0` zerava a confiança →
`score = completude×0.4 + 0 = 32` e `determinarNivel` forçava `invalido`.

## Correção (1 ponto, universal)
`plano.tipo` passa a ser fixado ao tipo REAL do equipamento **após** o spread:
```js
const plano = { fabricante, modelo, _tem_especificacoes_originais, ...(specs_canonicas||{}), tipo: equipamento.tipo }
```
Mínima e segura: vale para todos os tipos; só remove falsos positivos (tipo realmente inválido
continua detectado via `equipamento.tipo`).

## ANTES → DEPOIS (runtime, catálogo real)
| Carregador | nível | score | confiança | alerta |
|---|---|---|---|---|
| (ANTES — todos os 7) | invalido | 32 | 0 | TIPO_INVALIDO |
| Belenergy CVBE-MO-220V-7 | **incompleto** | **56** | 40 | — |
| EvoWatt KS1207A21 | **incompleto** | **64** | 40 | — |
| Intelbras EVE 0074B/0074C/0110C/0220B | **incompleto** | **56** | 40 | — |
| Solplanet SOL7.4H | **incompleto** | **56** | 40 | — |

**TIPO_INVALIDO: 7/7 → 0/7. invalido: 7/7 → 0/7.** Score +24 a +32 pontos, sem preencher nada manual.

## Teto remanescente (honesto — fora do escopo desta etapa)
1. **confiança = 40** porque `origem.tipo = import_legado` (BASE_POR_ORIGEM=40). Os 7 foram
   cadastrados manualmente com datasheet, mas a proveniência está marcada como import_legado.
   Corrigir a proveniência (ou revisão humana) elevaria a confiança — **não alterado** (não é "gaming").
2. **completude = 80** por 2 campos AC ausentes (`tensao_entrada_v`, `corrente_entrada_a`). **Não
   derivados** porque a tensão de alimentação é **regional** (220/380 V por distribuidora) — derivar
   seria inventar (Regra Fundamental). Melhor resolvido no form/OCR por tipo (próxima sprint) ou
   entrada do usuário.

## RESPOSTAS OBRIGATÓRIAS (estado após esta etapa)
1. Tipo AC/DC controla toda a arquitetura? **Ainda não** — `tipo_equipamento` master switch é a 2ª sprint.
2. Form muda dinamicamente? **Ainda não** (2ª sprint).
3. OCR identifica AC/DC primeiro? **Ainda não** (2ª sprint).
4. Campos DC deixaram de penalizar AC? **Sim — e a RCA provou que NUNCA penalizaram no score** (PESOS_CARREGADOR não tem campo DC). O penalizador real era o TIPO_INVALIDO falso, **corrigido**.
5. Campos AC deixaram de penalizar DC? N/A (sem DC no catálogo); regra por tipo virá na 2ª sprint.
6. Score dividido em Eng/Cat/OCR/Geral? **Ainda não** — mas o killer (crítico zerando confiança) foi corrigido.
7. Campos obrigatórios AC? Hoje: model = tipo/potencia/marca/modelo; score = PESOS AC. Definição formal AC na 2ª sprint.
8. Campos obrigatórios DC? Definição na 2ª sprint.
9. Os 7 passaram na validação? **SIM — saíram de invalido(32) para incompleto(56–64), TIPO_INVALIDO eliminado, 0 alertas.**
10. Commit? **`d2ed5bc`** (fix) + este relatório.

## Compatibilidade (FASE 8)
Mudança isolada ao motor de qualidade (plano.tipo). NÃO toca: projetos EV, dimensionamento NBR5410,
BOM, orçamento, workflow, unifilar, APIs. A correção só pode **remover** TIPO_INVALIDO falso (nunca
adiciona) → zero regressão na detecção de tipo realmente inválido.

## Próxima sprint
`P1-EV-CHARGER-AC-DC-SEPARATION-01` — implementar a arquitetura de `EV_CHARGER_AC_DC_ARCHITECTURE.md`
(tipo_equipamento AC|DC, form condicional, OCR classify-first, split de score Eng/Cat/OCR/Geral).
