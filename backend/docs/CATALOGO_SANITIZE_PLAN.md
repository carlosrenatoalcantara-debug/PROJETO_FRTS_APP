# P1-CATALOG-SANITIZE-01 — Plano de Saneamento do Catálogo

> Fonte: **Atlas `cluster0.iva0pph.mongodb.net` / `forte_solar` / `equipamentos`** · 95 documentos reais.
> **Auditoria 100% read-only** — nenhuma alteração no banco, OCR, parsers, SSOT, Atlas. Este é um **plano**, não uma execução.

## FASE 1 — Auditoria de fabricantes

27 fabricantes distintos. Problemas detectados:

### Duplicados por caixa
| Variantes | Qtd | Canônico sugerido |
|---|---|---|
| `Solplanet` (2 inv) + `SOLPLANET` (1 EV) | 3 | **Solplanet** |

### Inválidos (ruído de cadastro/OCR — todos em `carregador_ev`)
| fabricante_atual | qtd | canônico sugerido |
|---|---|---|
| `Página 1 de 1` | 1 | ⚠️ INVÁLIDO — reatribuir manualmente |
| `Fast Wall⇥Fast Wall` (com TAB, token duplicado) | 1 | ⚠️ INVÁLIDO — provável "Fast Wall" |

Demais 24 fabricantes: válidos e consistentes. **Sem correção automática nesta sprint.**

## FASE 2 — Auditoria de modelos

92 modelos distintos. **Modelos vazios: 0 · ruído OCR real: 0.** Duplicados (documento repetido):

| Fabricante | Modelo | Cópias |
|---|---|---|
| Neosolar | NS400W | 2 |
| Neosolar | NS550W | 2 |
| Canadian Solar | CS3K-400MS | 2 |

→ 3 pares de **documentos duplicados** (módulos cadastrados 2×). Candidatos a deduplicação (manter 1, manter o de maior completude).

## FASE 3 — 8 inversores em revisão

| Fabricante | Modelo | Nível | Score | Campos faltantes |
|---|---|---|---|---|
| Goodwe | GW25K-DT | incompleto | 50 | `tensao_partida` |
| Goodwe | GW73KLV-HT | incompleto | 50 | `tensao_partida` |
| Chint | SCA50KTL-T | incompleto | 50 | `tensao_partida` |
| Chint | SCA60KTL-T | suspeito | 40 | `tensao_mppt_min/max`, `tensao_partida` |
| Solplanet | ASW7300-S | inválido | 16 | `n_mppts`, `tensao_partida` |
| Solplanet | ASW12K-LT-G2 | inválido | 26 | `corrente_isc_max`, `tensao_partida` |
| Deye | SUN-23K-G04-LV | inválido | 24 | `n_mppts`, `tensao_partida` |
| Huawei | SUN2000-100KTL | suspeito | 34 | `tensao_max_entrada`, `tensao_mppt_min/max`, `corrente_max_por_mppt`, `tensao_partida` |

**Por que foram classificados como revisão:** o motor de qualidade rebaixa por campos críticos ausentes. **`tensao_partida` falta nos 8 (e em 22/22 = 100% do catálogo)** — é o maior ofensor isolado. 3 deles (Goodwe×2, Chint SCA50) estão completos exceto `tensao_partida`; os demais perdem também MPPT/tensão/corrente.

## FASE 4 — 3 inversores que precisariam de perfil conservador

| Fabricante | Modelo | Campos ausentes | Recuperável? |
|---|---|---|---|
| Solplanet | ASW7300-S | `n_mppts` | **Recuperável** — número de MPPTs consta no datasheet padrão da série ASW; reprocessar o PDF já existente. |
| Deye | SUN-23K-G04-LV | `n_mppts` | **Recuperável** — Deye G04 publica nº de MPPTs; reprocessar datasheet existente. |
| Huawei | SUN2000-100KTL | `tensao_mppt_min/max`, `corrente_max_por_mppt` | **Parcial** — faixa MPPT/corrente costumam estar no datasheet; se o PDF persistido for o resumido, **exige datasheet completo**. |

Conclusão FASE 4: 2 de 3 recuperáveis pelo datasheet já existente; 1 (Huawei 100K) pode exigir datasheet completo. **Não criar perfil conservador** (fora de escopo) — apenas reprocessar/recompletar.

## FASE 5 — Rastreabilidade (`origem.tipo = "desconhecido"` em 100%)

**Causa-raiz (investigação de código, sem alterar):**
- O criador principal `equipamentosController.js:212` faz `new Equipamento({ tipo, fabricante, modelo, especificacoes, ... })` **sem setar `origem`**.
- No hook `pre('save')` → `catalogoQualidade.js:439-441`: `if (!doc.origem?.tipo) doc.origem.tipo = 'desconhecido'`. Ou seja, **o default "desconhecido" sempre vence** quando a origem não foi setada na criação.
- Os ÚNICOS pontos que setam corretamente: `solarmarket/normalizer.js` (`import_solarmarket`) e `catalogoDatasheetEnriquecimento.js` (`datasheet_gemini`). O cadastro manual e a persistência via datasheet-multi **não setam**.

**Quando deixou de preencher:** nunca foi preenchido no caminho manual/principal — é um gap desde a criação desse handler (não uma regressão).

**Impacto:** perda total de rastreabilidade de proveniência — impossível distinguir OCR / assistida / manual / import / legado; degrada auditoria e decisões de recadastro.

**Correção recomendada (CÓDIGO — fora desta sprint read-only):**
- `equipamentosController` (POST manual) → `origem: { tipo: 'manual', em: new Date() }`.
- Persistência via datasheet → `origem.tipo = 'datasheet_pdfparse'` ou `'datasheet_gemini'` conforme `origem_texto`/provider.
- Manter o default `'desconhecido'` apenas como último recurso.

## FASE 6 — Classificação dos fabricantes

| Classe | Critério | Fabricantes |
|---|---|---|
| **ESTRATÉGICO** | ≥5 registros | ZNShine Solar (29), Goodwe (9, 88.9%inv), Risen Energy (7), Huawei (7, 81.5%inv), Trina Solar (6), Renesola (5) |
| **SUPORTADO** | 2–4 registros | Neosolar, Sirius, INTELBRAS, Wallbox, Schneider, Canadian Solar, Solplanet (72.2%inv), Chint (77.8%inv), Solis (88.9%inv) |
| **OCASIONAL** | 1 registro | OSDA, Tesla, BYD, WEG, ChargePoint, Kia, Porsche, SOLPLANET*, Deye (77.8%inv), Fast Station |

\* `SOLPLANET` (ocasional) deve ser **mesclado** em `Solplanet` (suportado). **Nenhum fabricante legítimo é excluído.**

## FASE 7 — Plano de saneamento (ordem, impacto, risco)

| # | Ação | Tipo | Impacto | Risco | Ordem |
|---|---|---|---|---|---|
| 1 | Mesclar `SOLPLANET` → `Solplanet` | update 1 doc | consistência de fabricante | Baixo | 1º |
| 2 | Corrigir 2 fabricantes inválidos (`Página 1 de 1`, `Fast Wall⇥…`) → reatribuir manualmente | update 2 docs (EV) | remove lixo do catálogo | Baixo (revisão humana) | 2º |
| 3 | Deduplicar 3 pares de módulos (Neosolar NS400W/NS550W, Canadian CS3K-400MS) | delete 3 docs | catálogo sem duplicatas | Médio (escolher cópia correta) | 3º |
| 4 | Preencher `origem.tipo` na CRIAÇÃO (fix de código) + backfill controlado dos 95 | código + migration leve | restaura rastreabilidade | Médio | 4º |
| 5 | Reprocessar datasheet existente dos 2 recuperáveis (Solplanet ASW7300-S, Deye 23K) p/ `n_mppts` | reprocesso (sem novo PDF) | tira 2 de "revisão" | Baixo | 5º |
| 6 | Obter datasheet completo p/ Huawei SUN2000-100KTL (faixa MPPT/corrente) | novo datasheet | completa 1 inversor | Baixo | 6º |
| 7 | Decidir sobre `tensao_partida` (ausente 100%): mapear rótulo no parser OU aceitar como não-crítico | decisão de produto | reclassifica 3 "incompleto"→ok | Baixo | 7º |

> **Importante:** ações 1–6 são WRITES no Atlas — **não executadas nesta sprint** (escopo read-only/plano). A ação 7 sobre o parser está **fora de escopo** (proibido alterar parser) — fica como decisão.

## FASE 8 — Prontidão para expansão

1. **Pronto para crescer?** **Sim, com saneamento leve antes.** Estrutura (schema 2.0, SSOT, aprendizados) está sólida; os defeitos são pontuais e localizados.
2. **O que corrigir antes?** Mesclar `SOLPLANET`, reatribuir 2 fabricantes inválidos, deduplicar 3 módulos, e ativar `origem.tipo` na criação (rastreabilidade).
3. **Quantos documentos precisam ajuste?** **~11 docs**: 1 (merge Solplanet) + 2 (fabricantes inválidos) + 3 (dedup módulos) + os 95 se contar o backfill de `origem.tipo`; **inversores a recompletar: 8 em revisão** (sendo 3 só por `tensao_partida`).
4. **Fabricantes que precisam atenção?** Solplanet (dup + 72% completude), Huawei (81%, 1 inversor incompleto), Chint (1 suspeito), Deye (n_mppts), e os 2 fabricantes-lixo de EV.
5. **Próxima sprint após saneamento?** **P1-CATALOG-PROVENANCE-01** (setar `origem.tipo` na origem + backfill) e/ou **P1-CATALOG-DEDUP-01** (merge/dedup controlado com confirmação). Depois, expansão em massa.

### Risco maior identificado
**Divergência ambiente local × produção:** o app local roda `USE_MEMORY_STORAGE=true` (grava em `memory-storage.json`, efêmero) e **não sincroniza com o Atlas** — cadastros locais não chegam ao catálogo real. Isso deve ser resolvido antes de qualquer recadastro em massa, sob risco de gravar na fonte errada.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave fornecida pelo operador e usada de forma transitória (não persistida no repo).

## Revisão: P1-CATALOG-SANITIZE-01 — Plano de Saneamento do Catálogo

A sprint P1-CATALOG-SANITIZE-01, focada em auditoria read-only do catálogo de equipamentos solares, apresenta um plano de saneamento bem estruturado e alinhado com os dados coletados.

**1) Conclusões batem com os dados auditados?**
Sim, as conclusões são consistentes com os dados apresentados. Os exemplos citados (2 fabricantes inválidos, 1 dup de caixa SOLPLANET, 3 módulos duplicados, 8 inversores em revisão por `tensao_partida` ausente, e a causa-raiz de `origem.tipo='desconhecido'`) estão bem documentados e explicados.

**2) Classificação e plano de saneamento são sãos?**
A classificação ESTRATÉGICO/SUPORTADO/OCASIONAL é lógica e baseada em métricas claras (quantidade de registros). O plano de saneamento é bem sequenciado, priorizando ações de menor risco e impacto para a consistência geral do catálogo, como a mesclagem de fabricantes e a correção de dados inválidos. A ordem e o impacto/risco atribuídos a cada ação parecem adequados.

**3) Erro de raciocínio, risco subestimado, ou ação que viola read-only?**
Não foram identificados erros de raciocínio ou riscos subestimados. Todas as ações propostas para a execução futura (Fase 7) são claramente marcadas como *writes* e fora do escopo desta sprint read-only. A menção ao risco de divergência entre ambiente local e produção é um ponto de atenção válido e crucial para futuras execuções.

**4) Veredito final:**

**APROVADO**

O plano é robusto, bem fundamentado nos dados da auditoria e apresenta um caminho claro para o saneamento do catálogo. As ressalvas sobre a execução futura e a necessidade de resolver a sincronização de ambientes são pontos importantes a serem considerados.
