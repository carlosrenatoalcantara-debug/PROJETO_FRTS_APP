# EV_CHARGER_AC_DC_RCA.md

**Sprint:** P0-EV-CATALOG-MODEL-REFORM-01 — **FASE 0 (RCA, READ-ONLY, sem alterar código)**
**Modelo:** Claude Opus 4.8 · **Data:** 2026-06-24

> GEMINI: revisão cruzada PENDENTE (sem ferramenta no ambiente).

## DECLARAÇÃO DE HONESTIDADE
```
VALIDADO EM CÓDIGO:   schema, OCR, motor de qualidade, validação e score localizados e lidos.
VALIDADO EM RUNTIME:  os 7 carregadores reais (produção) inspecionados — ANTES capturado.
ACHADO HONESTO:       a causa real diverge parcialmente da hipótese da sprint (ver abaixo).
NÃO ALTERADO:         nenhuma linha de código (FASE 0 é read-only).
```

## ⚠️ Correção de premissa (honestidade técnica)
A sprint parte de "campos DC derrubam o score dos AC". **Isto NÃO se confirma no código de score.**
`PESOS_CARREGADOR` (catalogoQualidade.js:208) = `{ identificacao:30, potencia_kw:30, tipo:20,
tensao_entrada_v:10, corrente_entrada_a:10 }` — **nenhum campo DC**. Campos DC vazios **não reduzem**
o score. O sintoma real ("válidos como inválidos / score baixo") tem **outra causa**, comprovada em runtime.

## ANTES (runtime — os 7 carregadores, todos AC)
| Carregador | eq.tipo | spec.tipo | nível | score | completude | confiança | alerta | faltantes |
|---|---|---|---|---|---|---|---|---|
| Belenergy CVBE-MO-220V-7 | carregador_ev | **undefined** | invalido | 32 | 80 | 0 | TIPO_INVALIDO | tensao/corr_entrada |
| EvoWatt KS1207A21 | carregador_ev | undefined | invalido | 32 | 80 | 0 | TIPO_INVALIDO | idem |
| Intelbras EVE 0074B/0074C/0110C/0220B | carregador_ev | undefined | invalido | 32 | 80 | 0 | TIPO_INVALIDO | idem |
| Solplanet SOL7.4H | carregador_ev | undefined | invalido | 32 | 80 | 0 | TIPO_INVALIDO | idem |

(Na collection `CarregadorEV`, o `tipo` está correto: AC_Mono/AC_Tri. No espelho `Equipamento`,
`especificacoes.tipo` está **ausente**.)

## CAUSA RAIZ (real, em 2 camadas)
1. **Killer do score — alerta crítico `TIPO_INVALIDO` falso.** Todos os 7 disparam TIPO_INVALIDO
   (severidade `critico`). Isso **zera a confiança** (`confianca=0`). Como
   `score_global = completude×0.4 + confianca×0.6 = 80×0.4 + 0 = 32` → cai para `nivel=invalido`.
   - Origem provável (a confirmar na correção): em `catalogoQualidade.normalizar()` o `plano` recebe
     `tipo: equipamento.tipo` (='carregador_ev', válido) **mas** depois faz `...specs_canonicas`, e
     `normalizarSpecsCarregador` devolve um `tipo` (sub-tipo do carregador, aqui `undefined`) que
     **sobrescreve** `plano.tipo`. Com o `tipo` corrompido/ausente, as regras estruturais de tipo
     (`regrasPlausibilidade.js`: SEM_TIPO/TIPO_INVALIDO) acusam o carregador como tipo inválido.
   - **Resultado:** carregador AC perfeitamente válido → `invalido`. (Confirma o relato do usuário.)
2. **Completude 80 — 2 campos AC ausentes.** `tensao_entrada_v` e `corrente_entrada_a` estão `null`
   (não vieram no cadastro/OCR). Pesam 10+10 → completude 80. Para wallbox AC esses valores são
   **deriváveis** (220 V mono / 380 V tri; I = P/(V·fator)) — hoje não há derivação.

## A unificação AC/DC É real (diagnóstico arquitetural do usuário — correto na direção)
- **Schema:** `CarregadorEV` (model) e o espelho `Equipamento` carregam campos DC inline
  (`tensao_saida_dc_v`, `corrente_saida_dc_a`, `tempo_carga_rapida_min`, `eficiencia_pct`) para todo carregador.
- **OCR:** `carregadorEVControllerGemini.extrairDatasheetEV` é regex-plano e **sempre** roda extratores
  DC (linhas 175-204), sem classificar AC/DC antes → "procura informação inexistente" em AC.
- **Form:** `ModalNovoCarregadorEV.jsx` é único (mostra campos DC para AC).
- **Campos esperados:** `camposEquipamento.carregador_ev` é uma lista única e plana.
> Ou seja: a UNIFICAÇÃO existe no form/OCR/model (UX e extração), mas **o penalizador de score real
> é o bug de tipo (TIPO_INVALIDO) + 2 campos AC ausentes**, não os campos DC.

## RESPOSTAS OBRIGATÓRIAS (FASE 0)
1. **Onde o tipo é determinado:** catálogo → `Equipamento.tipo` via `normalizarTipo` (tipoEquipamento.js) = 'carregador_ev'; sub-tipo → `CarregadorEV.tipo` enum `['AC_Mono','AC_Tri','DC']` (CarregadorEV.js:4-8). O sub-tipo existe mas **não** governa form/OCR/score.
2. **Onde o OCR decide os campos:** `carregadorEVControllerGemini.extrairDatasheetEV` (regex plano, sempre AC+DC) + esquema `camposEquipamento.carregador_ev` (lista única).
3. **Onde o score é calculado:** `catalogoQualidade.js` — `calcularCompletude` (PESOS_CARREGADOR) + `calcularConfianca` (origem/alertas); `score_global = completude×0.4 + confianca×0.6`; `determinarNivel`.
4. **Campos obrigatórios hoje:** model `CarregadorEV`: tipo, potencia_kw, marca, modelo. `camposEquipamento`: só `potencia_kw` obrigatório. `avaliarUtilizavel(carregador_ev) = []` (sem regra de bloqueio).
5. **Onde ocorre TIPO_INVALIDO:** `regrasPlausibilidade.js:667` (severidade crítica). Dispara nos 7 por `plano.tipo` corrompido pelo spread de `normalizarSpecsCarregador` (sobrescreve com o sub-tipo ausente).
6. **Campos que reduzem score:** os de `PESOS_CARREGADOR` ausentes (tensao_entrada/corrente_entrada). **Nenhum campo DC reduz o score.** O colapso a 32/invalido vem do **alerta crítico** zerar a confiança.
7. **Campos que alimentam o dimensionamento elétrico:** (calculosNBR5410EV) `potencia_kw`, `tensao_entrada_v`, `corrente_entrada_a`, `numero_fases`, `tipo_conector`, `qtd_conectores` → cabo/disjuntor/DR/DPS/BOM/orçamento/unifilar. Campos DC de saída **não** alimentam o dimensionamento dos AC.

## CONCLUSÃO DA RCA
A reforma AC/DC pedida é válida e correta como arquitetura, **mas a maior alavanca de score é corrigir
o bug de tipo (TIPO_INVALIDO falso)** + tratar os 2 campos AC. A arquitetura proposta está em
`EV_CHARGER_AC_DC_ARCHITECTURE.md`. **Implementação só após decisão do modelo (próximo passo).**
