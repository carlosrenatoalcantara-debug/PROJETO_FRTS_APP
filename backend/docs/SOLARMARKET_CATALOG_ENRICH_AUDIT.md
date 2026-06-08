# P1-SOLARMARKET-CATALOG-ENRICH-AUDIT-01 — Viabilidade de enriquecimento (read-only)

> **100% read-only.** Sem alterar Atlas/catálogo; sem gravar especificações. Mede a viabilidade
> de enriquecer automaticamente os **236 shells** importados do SolarMarket (completude atual 0,33).

## FASE 1 — Inventário dos 236 importados

| Tipo | Qtde | Fabricantes |
|---|---|---|
| **Inversores** | **131** | 16 fabricantes (Deye 41, Growatt 19, Kehua 18, SolarEdge 9, Goodwe 8, Solplanet 7, Solis 6, TSUN 5, Sungrow 4, Hoymiles 3, Chint 2, Sofar 2, APsystems 2, SAJ 1, Fronius 1, Enphase 1, NEP 1, SolaX 1) |
| **Módulos** | **105** | 21 fabricantes (ZNShine 16, DAH 13, Leapton 10, Jinko 9, OSDA 9, Honor 8, Canadian 7, Renesola 6, JA Solar 4, Trina 4, Sunova 3, Hanersun 3, Astronergy 2, Resun 2, Risen 2, Maxeon 2, Tongwei 1, Longi 1, Minasol 1, Topsola 1, DMEGC 1) |

→ **39 fabricantes** no total. Modelos limpos (ex.: `JKM530M-72HL4-TV`, `SUN-5K-G`) — **identidade
boa**, datasheet-pesquisável.

## FASE 2 — Cobertura documental por fabricante (evidência no repo)

| Evidência | Fabricantes |
|---|---|
| **Fixture golden** (parser **já validado**) | Chint, Deye, Goodwe, Hopewind, Hoymiles, Huawei, Kehua, SAJ, SolaX, Solis, Solplanet, Sungrow, TSUN — **todos INVERSOR** |
| **Datasheet no repo** (localizável) | Goodwe, Growatt, Chint, Solplanet, SAJ, Solis, Deye, SolarEdge, Kehua, Sungrow, SolaX, Huawei |
| **Marca Tier-1 com datasheet público** (site oficial) | módulos: Jinko, JA Solar, Trina, Canadian, Longi, ZNShine, DAH, Astronergy, Risen, Maxeon, DMEGC, Leapton, OSDA, Tongwei, Renesola, Sunova, Honor, Hanersun, Resun · inversores: Sofar, APsystems, Enphase, Fronius, NEP |
| **Cobertura fraca / regional** | Minasol, Topsola (marcas menores) |

**Achado-chave:** **as 13 fixtures e quase todos os datasheets do repo são de INVERSOR.** **Nenhum
módulo** tem fixture ou datasheet no repositório → o **parser de módulo não está validado** e os
datasheets de módulo precisam ser **buscados** (existem nos sites oficiais das marcas Tier-1).

## FASE 3 — Amostra (fabricantes representativos)

| Fabricante | Modelo (amostra) | Datasheet | Confiança |
|---|---|---|---|
| **Deye** (inv) | SUN-5K-G, SUN-8K-G03, SUN-75K-G | repo (fixture+PDF) | **alta** |
| **Kehua** (inv) | SPI…-B X2 | repo (4 fixtures + PDFs) | **alta** |
| **Growatt** (inv) | MAC 60KTL3-X LV, MID/MIC | repo (PDFs) | **alta** (parser matricial) |
| **SolarEdge** (inv) | SE 20.1K, SE 27.6K | repo (PDF) | **média-alta** (formato próprio) |
| **Solplanet/Solis/Goodwe/Chint/SAJ/Sungrow/SolaX** | — | repo (fixture+PDF) | **alta** |
| **Jinko/JA/Trina/Canadian/Longi** (mód) | JKM530M-72HL4-TV… | site oficial (não no repo) | **média-alta** (parser de módulo a validar) |
| **Minasol/Topsola** (mód) | — | incerto | **baixa** |

## FASE 4 — Classificação de enriquecibilidade

| Classe | Critério | Qtde estimada |
|---|---|---|
| **A) Automático provável** | Inversor de marca com **fixture/datasheet no repo** (parser pronto) | **~124** (Deye, Growatt, Kehua, SolarEdge, Goodwe, Solplanet, Solis, Sungrow, TSUN, Hoymiles, Chint, SAJ, SolaX) |
| **B) Semiautomático** | **Módulos** (datasheet público, **parser de módulo a validar**) + inversores sem fixture (Sofar, APsystems, Enphase, Fronius, NEP) | **~110** (≈103 módulos + 7 inversores) |
| **C) Revisão manual** | Marcas regionais/obscuras ou modelo ambíguo | **~2** (Minasol, Topsola) |

## FASE 5 — Respostas

1. **Quantos podem ser enriquecidos automaticamente?** **~124** (inversores das marcas com parser
   validado + datasheet) — **condicionado a obter o datasheet do modelo específico** (download do
   site oficial; o repo cobre só uma amostra de modelos).
2. **Quantos exigem revisão?** **~2 manual (C)** + **~110 semiautomático (B)** que exigem
   **sourcing de datasheet** e/ou **validação do parser de módulo** (não é "manual puro", mas não é
   100% automático hoje).
3. **Melhor cobertura documental?** **Deye, Kehua, Goodwe, Growatt, Solplanet, Solis, Sungrow,
   Chint, SAJ, SolaX, SolarEdge** (inversores — fixture/datasheet no repo) e as **Tier-1 de módulo**
   (Jinko, JA Solar, Trina, Canadian, Longi, ZNShine, DAH — datasheets públicos abundantes).
4. **Pior cobertura?** **Minasol, Topsola** (regionais) e, em menor grau, **Honor, OSDA, Hanersun,
   Resun** (datasheets menos padronizados).
5. **Ganho esperado de completude?** De **0,33 campo/registro** para: **inversores ~12–14 campos**
   (potência, MPPT, Vmáx, Isc, corrente, tensão de partida…), **módulos ~8–10 campos** (Pmpp, Voc,
   Isc, Vmp, Imp, eficiência, dimensões, peso). → completude **~3% → ~85–90%** nos Tiers A/B.
6. **Estratégia ideal para enriquecimento:**
   - **(A) Inversores parser-ready** — `P1-SOLARMARKET-CATALOG-ENRICH-EXEC-01`: para cada um dos
     ~124, **baixar o datasheet do modelo** (site oficial) → rodar o **parser existente**
     (matricial/textual) → `$set especificacoes` com proveniência `origem=enriquecimento_datasheet`,
     preservando `_id`/histórico. Começar pelos volumes (Deye 41, Growatt 19, Kehua 18).
   - **(B) Módulos** — usar **Gemini Vision** sobre o datasheet (specs de módulo são simples e
     padronizadas: Pmpp/Voc/Isc/Vmp/Imp/efic/dim/peso) **ou** validar/ajustar um parser de módulo
     com 2–3 fixtures golden (Jinko/Canadian/Trina) antes do lote.
   - **(C) Manuais** — cadastro assistido para Minasol/Topsola.
   - Em todos: **dry-run + revisão** antes da escrita; **idempotência** por `hash_unico`; gravar só
     campos comprovados (como na recuperação P1-CATALOG-DATASHEET-RECOVERY-01).

### Conclusão
Os 236 shells têm **identidade boa** e são **enriquecíveis**: **~124 inversores são automático-
prováveis** (parser já validado + datasheets), **~110 são semiautomáticos** (módulos com datasheet
público mas parser de módulo a validar; + 7 inversores sem fixture) e **~2 manuais**. O gargalo não
é o parser de inversor (pronto), e sim **(a) o sourcing dos datasheets por modelo** e **(b) a
ausência de validação do parser de módulo**. Ganho de completude esperado: **~3% → ~85–90%**.
**Próxima sprint recomendada:** `P1-SOLARMARKET-CATALOG-ENRICH-EXEC-01` (Tier A, inversores
parser-ready, em lote priorizado por volume). Nada foi alterado (read-only).


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P1-SOLARMARKET-CATALOG-ENRICH-AUDIT-01

A análise de viabilidade para enriquecer os 236 equipamentos importados do SolarMarket é **sólida e bem fundamentada**. A metodologia adotada, com inventário detalhado e cruzamento com evidências concretas do repositório, permite uma visão clara do estado atual e dos desafios.

**Avaliação dos pontos:**

1.  **Uso de fixtures/datasheets do repo como evidência de 'datasheet localizável' é metodologia sólida?**
    **Sim, é uma metodologia sólida.** O uso de fixtures validadas e datasheets existentes no repositório como base para determinar a "localizabilidade" é um indicador confiável da existência de parsers prontos e da facilidade de automação. A ressalva de que o repo cobre apenas uma amostra de modelos e que o sourcing por modelo específico é necessário para a automação completa é **honesta e crucial**.

2.  **O achado de que módulos não têm parser validado (gargalo real) é correto e importante?**
    **Sim, o achado é correto e de extrema importância.** A constatação de que nenhum módulo possui fixture ou datasheet validado no repositório aponta diretamente para o principal gargalo técnico. A validação do parser de módulo é, de fato, o ponto crítico para o enriquecimento automático dessa categoria.

3.  **A classificação A/B/C e os ~124/~110/~2 são plausíveis?**
    **Sim, as classificações e estimativas são plausíveis.** A divisão em "Automático provável", "Semiautomático" e "Manual" reflete de forma realista os diferentes níveis de esforço e dependência de validação. As quantidades estimadas para cada categoria parecem bem alinhadas com o inventário e a análise de cobertura documental.

4.  **A ressalva de que 'automático' depende de sourcing por modelo é honesta?**
    **Sim, a ressalva é totalmente honesta e necessária.** A automação depende intrinsecamente da disponibilidade do arquivo de dados específico para cada modelo. A menção explícita dessa dependência demonstra um entendimento realista dos processos e limitações.

5.  **A estratégia (Tier A parser existente, Tier B Vision) é a ideal?**
    **A estratégia proposta é pragmática e bem direcionada.**
    *   **Tier A:** Priorizar o uso de parsers existentes para inversores é a abordagem mais eficiente, aproveitando o trabalho já realizado. O foco em baixar o datasheet do modelo específico é o passo lógico seguinte.
    *   **Tier B:** A sugestão de usar Gemini Vision para módulos é uma solução inteligente, dada a natureza mais padronizada das especificações de módulos. Alternativamente, a validação ou ajuste de um parser de módulo com fixtures golden é igualmente válida.

6.  **Veredito:**
    **APROVADO COM RESSALVAS.**

**Justificativa do Veredito:**

A sprint apresenta uma análise robusta e um plano de ação promissor. A metodologia é sólida, os achados são cruciais e as estimativas são plausíveis. A principal ressalva, e o motivo para não ser um "APROVADO" puro, reside na **dependência do sourcing de datasheets por modelo específico para o Tier A e na necessidade de validação/desenvolvimento do parser de módulo para o Tier B**. Embora a estratégia aborde esses pontos, a execução desses passos pode apresentar desafios e demandar mais esforço do que o inicialmente previsto, impactando a velocidade e a garantia do "automático provável".

A recomendação para a próxima sprint, focando no Tier A, é acertada. No entanto, é fundamental que a equipe esteja preparada para lidar com a variabilidade na disponibilidade e formato dos datasheets, e que o desenvolvimento/validação do parser de módulo seja tratado com a devida prioridade para desbloquear o potencial do Tier B.
