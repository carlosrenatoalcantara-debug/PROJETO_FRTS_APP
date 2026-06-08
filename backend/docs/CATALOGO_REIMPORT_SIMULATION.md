# P1-CATALOG-REIMPORT-SIMULATION-01 — Simulação de reprocesso

> **Simulação 100% read-only.** Zero escrita no Atlas · zero alteração do catálogo.
> Roda o pipeline ATUAL sobre as fixtures reais e compara campo-a-campo com o Atlas.

## FASE 1 — Inventário de fontes

- **PDFs no repositório:** **0** (os datasheets originais ficam fora do repo / OneDrive).
- **Fixtures golden:** 18 (texto/tokens reais já extraídos).
- **Correspondência com o Atlas:** dos 22 inversores, **5 têm match EXATO de modelo** com fixture
  (ex.: GW25K-DT, ASW7300-S, SCA50/60KTL, SUN-23K) e **17 usam proxy de formato** (mesma marca,
  modelo diferente). → comparação de **valor** é confiável só nos 5 exatos; a recuperabilidade
  de campo **uniforme por formato** (ex.: `tensao_partida`) vale para todos.

## FASE 2 — Simulação

Pipeline atual (`extrairSpecsTecnicas` + `montarMatriz`/`montarColunaUnica`) executado sobre
as fixtures; resultado em objeto temporário (`CATALOGO_REIMPORT_SIMULATION.json`). **Nada gravado.**

## FASE 3 — Comparação (campo a campo)

Classificação: **já correto** · **recuperável** (Atlas vazio, pipeline extrai) · **ausente**
(ambos vazios) · **conflitante** (mesmo modelo, valor diferente) · *modelo_diferente* (proxy —
descartado da contagem de conflito).

## FASE 4 — Métricas

| Métrica | Valor |
|---|---|
| Inversores que melhorariam | **21 / 22** |
| Campos vazios recuperáveis | **30** (sendo **`tensao_partida` = 21**) |
| Conflitos (match exato) | **12** |
| Ganho médio de completude | **+9.7 pp** |

**Recuperáveis por campo:** `tensao_partida` 21 · `corrente_max_por_mppt` 2 · `tensao_mppt_min/max` 2/2 ·
`corrente_isc_max` 1 · `tensao_max_entrada` 1 · `dimensoes` 1. → o ganho é **dominado por
`tensao_partida`** (o resultado do P1-PARSER-STARTVOLTAGE-01).

**Conflitos (12) — natureza:** a maioria é **formatação**, não erro de dado:
- `dimensoes`: `516x650x203` vs `516*650*203` (mesmo número, separador) — cosmético.
- `grau_protecao_ip`: `66` vs `IP66` — cosmético.
- **Erros REAIS do Atlas que a re-extração corrige:** Solplanet ASW7300-S `corrente_ac_saida`
  `220`→**40** (220 é tensão gravada como corrente); Goodwe GW20K-DT `potencia_maxima_kw`
  `17`→**20**. ← correções valiosas.

## FASE 5 — Por fabricante (Antes → Depois)

| Fabricante | Inversores | Antes | Depois | Ganho | Recuperáveis | Conflitos |
|---|---|---|---|---|---|---|
| **Chint** | 2 | 85.8% | 100% | **+14.2** | 4 | 0 |
| **Huawei** | 6 | 88.1% | 100% | **+11.9** | 10 | 0 |
| **Solplanet** | 2 | 82.2% | 92.9% | +10.7 | 3 | 3 |
| **Solis** | 2 | 89.3% | 100% | +10.7 | 3 | 0 |
| **Deye** | 1 | 85.7% | 92.9% | +7.2 | 1 | 1 |
| **Goodwe** | 9 | 92.9% | 100% | +7.1 | 9 | 8 |

(ZNShine/Risen/Trina/Renesola/Kehua são **módulos** ou não estão entre os 22 inversores → fora.)

## FASE 6 — Carregadores EV (16)

**Completude média (6 campos críticos): 84.4%.**

| Campo | Presença (de 16) | Classe |
|---|---|---|
| `potencia_kw`, `tensao_entrada_v`, `numero_fases`, `grau_protecao_ip`, `tipo_carregamento`, `tipo_conector` | 16 (100%) | **crítico — ok** |
| `corrente_entrada_a` | **11 (69%)** | **crítico — lacuna** |
| `tipo_carregador`, `temperatura_operacao`, `protocolo_carregamento`, `comunicacao` | 15 | operacional |
| `carregadorEV_id` | 15 | **inútil** (id interno de sync, não é spec) |
| `tipo_conector_saida`, `potencia_maxima`, `tensao_entrada`, `corrente_entrada` (2 cada), `frequencia_hz`/`eficiencia` (1) | 1–2 | **ruído/dialeto** (duplicatas inconsistentes dos campos principais) |

→ EV: campos críticos quase completos; **única lacuna real é `corrente_entrada_a` (5 faltando)**;
há **ruído de dialeto** (campos duplicados em poucos docs) e um campo **inútil** (`carregadorEV_id`).

## FASE 7 — Decisão

**Vale a pena, mas de forma INCREMENTAL e priorizada — não um recadastro em massa urgente.**
- O ganho é **real (+9.7 pp)** mas **dominado por `tensao_partida`**, que **já está mitigado**
  pelo fallback conservador + badge 🟠 → não é urgente.
- O valor extra está nos **erros reais surfados** (Solplanet corrente, Goodwe potência) e na
  normalização de formatação — esses **sim** merecem correção.
- **Bloqueio prático:** os datasheets originais **não estão no Atlas** (não são armazenados) e o
  repo não tem os PDFs → reprocessar exige **re-upload** dos PDFs. Só 5/22 têm match exato em fixture.

## FASE 8 — Respostas

1. **Quantos equipamentos melhorariam?** **21 / 22 inversores**.
2. **Quantos campos seriam recuperados?** **30** (21 = `tensao_partida`).
3. **Quantos conflitos existem?** **12** (match exato) — maioria **formatação**; **2** são erros
   reais do Atlas que a re-extração corrige.
4. **Qual fabricante mais ganharia?** **Chint** (+14.2 pp).
5. **Qual fabricante menos ganharia?** **Goodwe** (+7.1 pp — já em 92.9%).
6. **Vale a pena reprocessar?** **Sim, incremental e priorizado** (erros reais + quando houver
   datasheets), **não** um recadastro em massa — o ganho dominante já é coberto pelo fallback.
7. **Próxima sprint recomendada?** **P1-CATALOG-DATASHEET-RECOVERY-01** — re-upload + reprocesso
   **incremental** dos PDFs, priorizando (a) os 2 inversores com erro real de dado (Solplanet,
   Goodwe) e (b) o preenchimento de `tensao_partida` real; em paralelo, completar `corrente_entrada_a`
   dos 5 carregadores EV.

### Conclusão
O pipeline atual recuperaria **30 campos** (21 = `tensao_partida`) em **21/22** inversores, com
ganho médio **+9.7 pp** e **2 correções reais de dado**. Como o maior ganho já está coberto pelo
fallback, o reprocesso é **recomendado de forma incremental/priorizada**, dependente do re-upload
dos datasheets originais.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P1-CATALOG-REIMPORT-SIMULATION-01

A simulação realizada para o reprocessamento do catálogo de inversores (app solar Node/Mongo) foi executada de forma **honesta e válida**. A metodologia de utilizar fixtures como proxy, distinguindo entre "match exato" e "proxy de formato", e descartando conflitos de modelos diferentes, é apropriada para o objetivo de avaliar o potencial de melhoria do pipeline atual sem alterar os dados no Atlas.

A interpretação dos 12 conflitos é **correta**. A distinção entre a maioria de problemas de formatação (cosméticos) e os dois erros reais de dados (Solplanet e Goodwe) é crucial e bem identificada. Esses erros reais são particularmente valiosos, pois demonstram a capacidade do pipeline de corrigir inconsistências significativas.

A decisão de reprocessar de forma **incremental e priorizada** é **sensata**. O ganho médio de +9.7 pp é relevante, mas a constatação de que o maior contribuinte (`tensao_partida`) já é mitigado por um fallback conservador diminui a urgência de um recadastro em massa. A priorização deve focar nos erros reais de dados e na recuperação de `tensao_partida` quando os datasheets estiverem disponíveis.

**Riscos e Limitações:**
*   **Dependência de Datasheets:** A principal limitação é a ausência dos datasheets originais no Atlas e no repositório. O reprocessamento efetivo dependerá do re-upload desses arquivos.
*   **Cobertura Limitada:** A simulação utilizou apenas 22 inversores, com apenas 5 tendo match exato de modelo. Embora as fixtures sirvam como proxy, a generalização completa para todo o catálogo pode ter nuances.
*   **"Ruído de Dialeto" em EV:** A presença de campos duplicados e inconsistentes nos carregadores EV indica a necessidade de uma limpeza adicional nesse segmento.

### Veredito: APROVADO COM RESSALVAS

**Justificativa:** A simulação demonstrou um ganho real e valioso na completude e correção dos dados do catálogo, especialmente com a identificação de erros reais. A metodologia é sólida e a decisão de reprocessamento incremental é pragmática. As ressalvas se referem à necessidade crítica de recuperação dos datasheets para a implementação completa e à atenção a ser dada ao "ruído de dialeto" nos carregadores EV. A próxima sprint recomendada (P1-CATALOG-DATASHEET-RECOVERY-01) aborda diretamente essa limitação.
