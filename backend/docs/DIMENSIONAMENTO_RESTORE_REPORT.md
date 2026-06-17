# P0-DIMENSIONAMENTO-ENGINEERING-RESTORE-01 — Restauração do fluxo de engenharia FV

> - **Data:** 2026-06-14 · **Executor:** Sonnet · **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE
> - **Commit:** separado (branch `sprint/p0-dimensionamento-restore`)
> - Escopo: **DIMENSIONAMENTO FV**. Sem alterar arquitetura/modelos/fonte; sem inventar potência;
>   sem mexer em QR/Ativos/Unifilar/Comissionamento/Segurança.

## VALIDAÇÃO DA FORENSE (não assumida)

Confirmado **no código** (não só no relatório): `frontend/src/utils/catalogoEngenhariaAdapter.js`,
`agruparInversores`, linha 98 → `const tipo = 'string'` (literal). Causa-raiz **confirmada**.

## VEREDITO

Regressão **restaurada com 1 fonte única**: `agruparInversores` agora classifica via `tecnologiaInversor`
(reusada de `regrasPlausibilidade.js`, sem duplicar regras). Abas **String/Micro/Otimizador/Híbrido** voltam.
Correções de **leitura** (não de dado) na potência/elétrica. Multiarranjo e quantidade **não tinham regressão**.

## FASE 1 — Auditoria de tecnologia (`TECHNOLOGY_MAPPING_REPORT.md`)

- Onde o tipo é definido: `agruparInversores`. Quem força "string": o literal `const tipo='string'`.
- Quando entrou: **Sprint 8.1 / commit `506979e`**. Componentes dependentes: `SeletorInversores` → `GerenciadorArranjos`/`ConfiguradorArranjoFV`.
- **Classificação (175):** micro **16** · string **149** · otimizador **9** · híbrido **1** · sem classificação **0**.

## FASE 2 — Restaurar classificação

`agruparInversores` substituiu o hard-code por:
```js
const tec = tecnologiaInversor({ fabricante, modelo, voc_max_dc_v, potencia_kw_ca, n_mppts })
const tipo = tec === 'microinversor' ? 'micro' : tec   // micro|string|otimizador|hibrido
```
`tecnologiaInversor` foi **exportada** (antes local) e ganhou detecção de **otimizador** (SolarEdge/HD-Wave) —
extensão da **fonte única**, sem duplicar. *(Sem regressão de qualidade: nas regras, só `microinversor`
muda faixas; `otimizador` usa faixas de string, como já era para o SolarEdge.)*

## FASE 3 — Filtro de marcas (`TECHNOLOGY_FILTER_REPORT.md`)

Hoymiles/TSUN/APsystems → **Micro** (0 em String); SolarEdge → **Otimizador** (0 em String); Deye separado
corretamente por modelo (micro/string/híbrido). ✅

## FASE 4 — Potência

1. **Ainda "?kW":** **122 inversores** — potência **realmente não existe** (SEM_ESPECIFICACOES). **Não inventada.**
2. **Ainda "?W":** **3 módulos** — idem (dado ausente).
3. **Dado existe e não estava sendo lido?** → **SIM** para os dados **elétricos** (Voc/MPPT/corrente) dos
   inversores enriquecidos: `adaptarInversor._eletrico` lia só `voc_max/mppt_min/max` e **perdia** as chaves
   canônicas do enriquecimento (`tensao_max_entrada`, `tensao_mppt_min/max`, `corrente_max_por_mppt`).
   **Corrigido** (leitura). Também `GerenciadorArranjos` (módulo): agora lê `especificacoes.potencia_w/potencia`.
4. **Ou realmente não existe?** → Para os 122 inversores + 3 módulos: **realmente não existe** → permanecem "?"
   até as waves de datasheet (escopo de outra sprint). **Nenhuma potência foi inventada.**

## FASE 5 — Arranjos

Backend (`ProjetoFV.arranjos[]`) · Frontend (`GerenciadorArranjos`+`ConfiguradorArranjoFV`, ADD/SET/REMOVE) ·
Persistência (`salvarEtapa('arranjos')`) · Carregamento (E7 hidrata `SET_ARRANJOS`). 
1. Multiarranjo funcional? **SIM.** 2. Bug? **Não** (no fluxo principal). 3. Regressão? **Não.** 4. Só visual? Em
parte — a degradação vinha do filtro de tipo (FASE 1/2, agora corrigido) e dos "?" de potência. **Nenhuma alteração de código necessária aqui.**

## FASE 6 — Quantidades

- **Automática:** `E5Dimensionamento` (`numPaineis=ceil(kWp·1000/REF_W)`, `numInversores=ceil(kWp/5)`).
- **Manual/editável:** `E7`/`ConfiguradorArranjoFV` (módulos/string, strings paralelo, quantidade alvo).
- E6 (Área) deriva área/capacidade dos panos. Persistência: `quantidade_modulos_por_string`, `quantidade`.
- **Sem regressão** — foi **realocada** de E5→E7 (documentado no cabeçalho do E5). UX: documentar a realocação.

## FASE 7 — Mapa

`MapaTelhado.jsx`: zoom inicial **17 → 19** (config) para visualizar o telhado já ao abrir. `mapTypeId="hybrid"`
(satélite+rótulos), `zoomControl=true`, **sem `maxZoom`** (default do Google — o usuário chega ao limite de tiles
da região). Provedor **não trocado**.

## FASE 8 — Teste end-to-end

- **Núcleo da regressão verificado no browser** (Vite): `agruparInversores` classifica corretamente
  (micro/otimizador/string), import cross-package resolve, 0 erros.
- **Fluxo autenticado completo (Cliente→…→Orçamento) não foi percorrido** ponta-a-ponta (rota atrás de login).
1. **Fluxo voltou a funcionar?** → A **causa-raiz** (só String) está corrigida e verificada; as abas
   Micro/Otimizado/String/Híbrido voltam e cada marca cai na tecnologia certa.
2. **Bugs que permanecem:** "?kW/?W" de **125 equipamentos sem dado** (não-inventável; depende de datasheet).
3. **Fora do escopo:** enriquecimento de datasheet (potência ausente), e2e autenticado em device real.

## Mudanças (apenas dimensionamento, reuso máximo)
| Arquivo | Mudança |
|---|---|
| `backend/src/services/regrasPlausibilidade.js` | exporta `tecnologiaInversor` + detecção `otimizador` + `apsystems/ez1` |
| `frontend/src/utils/catalogoEngenhariaAdapter.js` | `agruparInversores` reusa `tecnologiaInversor`; `_eletrico` lê chaves canônicas |
| `frontend/src/components/fv/GerenciadorArranjos.jsx` | potência de módulo lê `especificacoes.potencia_w/potencia` |
| `frontend/src/components/fv/MapaTelhado.jsx` | `LOCAL_ZOOM` 17 → 19 |

## Critério de aceite
✅ Causa-raiz validada no código · ✅ classificação restaurada (fonte única, sem duplicar) · ✅ filtro por
tecnologia · ✅ leitura de potência/elétrica corrigida (sem inventar) · ✅ arranjos/quantidade confirmados ·
✅ zoom ajustado · ⚠️ e2e autenticado parcial · ⚠️ Revisão Gemini PENDENTE.

## Entregáveis
- `TECHNOLOGY_MAPPING_REPORT.md` · `TECHNOLOGY_FILTER_REPORT.md` · `DIMENSIONAMENTO_RESTORE_REPORT.md` · `DIMENSIONAMENTO_RESTORE_METRICS.json`
