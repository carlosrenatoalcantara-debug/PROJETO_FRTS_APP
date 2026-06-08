# P1-SOLARMARKET-CATALOG-IMPORT-AUDIT-01 — Auditoria de importação de catálogo (read-only)

> **100% read-only.** Sem importar/gravar/criar. Inventário **completo** do catálogo embutido do
> SolarMarket (todas as 642 propostas) e comparação com o Atlas. Nenhum número inventado.

## FASE 1 — Inventário de equipamentos do SolarMarket

Coleta de **642 projetos → 586 propostas com itens** (91%); **864 itens únicos** (por nome) no
`pricingTable`. Categorias (linhas): `Custo 2811 · Inversor 605 · Módulo 596 · KIT 556 ·
Componente 516 · Projeto/homologação 182 · Otimizador 38 · Cabos/Estruturas/Conectores …`.

**Filtrando para equipamento-core** (módulo/inversor/bateria/EV/otimizador) e deduplicando por
`fabricante+modelo`:

| Tipo | Únicos no SolarMarket |
|---|---|
| **Módulos** | **169** |
| **Inversores** | **162** |
| **Otimizadores** | 6 |
| **Carregadores EV** | 2 |
| **Baterias** | **0** |
| **Total core** | **339** |

→ **Não há categoria "Bateria" nem "Carregador EV" no SM** — baterias = **0** (BYD aparece como
módulo). EV quase ausente (2). O catálogo SM é essencialmente **módulos + inversores**.

## FASE 2 — Comparação com o Atlas (113 equipamentos)

| Classe | Qtde | % |
|---|---|---|
| **Match exato** (fabricante+modelo) | **10** | 3% |
| **Match provável** (fabricante + modelo parcial) | **16** | 5% |
| **Inexistente** (novo) | **313** | **92%** |

→ O Atlas cobre apenas **~8% (26/339)** do catálogo real do SolarMarket.

## FASE 3 — Duplicados, fabricantes alternativos, nomenclatura

- **Duplicados internos:** mínimos após normalização (341 linhas-core → 339 únicos; 2 fundidos).
  Risco residual: mesmo modelo grafado de formas diferentes entre distribuidores.
- **Fabricantes mal-parseados (ruído):** o "fabricante" é o **1º token do nome**; em ~20 casos é um
  **código de modelo** ou termo genérico (ex.: `SL120000`, `LF465M8-72H`, `SI03000`, `PLUGUE`,
  `TAMPA`, `CARREGADOR`, `SINE`) → **gerariam fabricante-lixo** se importados sem limpeza.
- **Diferenças de nomenclatura:** o SM mistura no nome marca + modelo + descrição comercial
  (ex.: `GROWATT MIN 5000TL-X`, `SOLAREDGE SE 20.1K 380/220v`) → exige split fabricante/modelo.

## FASE 4 — Ranking

| Pergunta | Resposta |
|---|---|
| Equipamentos (core) no SolarMarket | **339 únicos** (169 mód + 162 inv + 6 otim + 2 EV) |
| Já existem no Atlas | **26 (~8%)** (10 exato + 16 provável) |
| Novos | **313 (~92%)** |
| Baterias que apareceram | **0** |

## FASE 5 — Impacto e estratégia

1. **Quantos registros seriam criados?** **~313** (todos os inexistentes) — ou **~297** se os 16
   "prováveis" forem tratados como match (não duplicar).
2. **Quantos fabricantes seriam adicionados?** **73 tokens** novos, dos quais **~50 fabricantes
   reais** (ex.: Jinko, Canadian, SolarEdge, Sunova, OSDA, Resun, Longi, Honor, Kehua, Sungrow,
   NEP, ZNShine, Astronergy, JA, TSUN, SAJ, Leapton, Hoymiles) — o restante (~23) é **ruído de
   parsing** a descartar.
3. **Quantas baterias seriam adicionadas?** **0**.
4. **Quantos inversores seriam adicionados?** **151**.
5. **Quantos módulos seriam adicionados?** **154**.
6. **Qual o risco de duplicação?** **Moderado.** O match estrito dá 92% inexistente, mas: (a) os
   16 "prováveis" duplicariam se importados sem checagem; (b) variações de nomenclatura entre
   distribuidores podem criar o mesmo equipamento 2×; (c) fabricantes mal-parseados criariam
   registros-lixo. **Mitigação:** o pipeline existente (`normalizer` → `matcher` por `hash_unico`
   sha256(fabricante_norm+modelo_norm) → `deduplicator`) já resolve a maior parte.
7. **Estratégia ideal de importação:**
   - **(a)** Pré-processar: **split fabricante/modelo** e **descartar tokens-lixo** (códigos de
     modelo como fabricante, termos genéricos) e **acessórios** (cabo/estrutura/kit/custo/serviço).
   - **(b)** Rodar o **pipeline de dedup existente** (matcher por `hash_unico`; confiança ≥0.90
     para evitar duplicar os "prováveis").
   - **(c)** Marcar **`origem=import_solarmarket`** (rastreabilidade — hoje o catálogo é 0% SM).
   - **(d)** **Dry-run + revisão humana** dos ~50 fabricantes novos antes da escrita.
   - **(e)** Importar em **lotes por tipo** (módulos, depois inversores), preservando IDs e histórico.
   - **(f)** **Não** importar baterias/EV (inexistentes/irrelevantes) nem acessórios.

### Conclusão
O SolarMarket tem **339 equipamentos-core únicos**, dos quais **~92% (313) não existem no Atlas**
— a importação adicionaria **~154 módulos + 151 inversores** de **~50 fabricantes novos**, e
**0 baterias**. O risco de duplicação é **moderado e mitigável** pelo pipeline de dedup já
existente, desde que precedido de **limpeza fabricante/modelo** e **dry-run com revisão**. Nada
foi importado/gravado (read-only). **Próxima sprint recomendada:** **P1-SOLARMARKET-CATALOG-IMPORT-
EXEC-01** — dry-run do pipeline (normalizer/matcher/dedup) sobre os 313 inexistentes, com relatório
de "criar vs fundir" antes de qualquer escrita.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P1-SOLARMARKET-CATALOG-IMPORT-AUDIT-01

A auditoria realizada na sprint P1-SOLARMARKET-CATALOG-IMPORT-AUDIT-01 demonstra um trabalho meticuloso e uma metodologia robusta para preparar a importação segura de equipamentos do SolarMarket para o Atlas. A análise abrangeu todos os dados relevantes e identificou os principais desafios e riscos.

**Avaliação dos Pontos:**

1.  **Coleta completa (642) + dedup por fabricante+modelo é metodologia sólida?**
    **Sim, é uma metodologia sólida.** A coleta de todas as propostas e a subsequente deduplicação por `fabricante+modelo` garantem uma visão abrangente e um ponto de partida confiável para identificar equipamentos únicos. A filtragem para "equipamento-core" é crucial para focar nos itens de maior valor e relevância.

2.  **A identificação do ruído de parsing (modelo como fabricante) é correta e o tratamento proposto adequado?**
    **Sim, a identificação é correta e o tratamento proposto é adequado.** A análise aponta com precisão para o problema de tokens de modelo ou termos genéricos sendo erroneamente classificados como fabricantes. A estratégia de "descartar tokens-lixo" e a necessidade de "split fabricante/modelo" são essenciais para a limpeza dos dados antes da importação.

3.  **A comparação exato/provável/inexistente é confiável (92% novo) ou superestima por match estrito?**
    **A métrica de 92% de inexistentes é confiável, mas a superestimação por match estrito é um risco a ser considerado.** O match estrito é um bom ponto de partida, mas a inclusão dos "16 prováveis" na categoria "novo" (se não forem tratados como match) pode inflar o número de novos registros. A estratégia de importação deve abordar explicitamente como lidar com esses "prováveis".

4.  **Bateria=0 e EV=2 são conclusões corretas?**
    **Sim, as conclusões são corretas com base na análise apresentada.** A ausência de uma categoria "Bateria" no SolarMarket e a baixa quantidade de "EV" são observações diretas dos dados coletados. A constatação de que o catálogo SM é predominantemente "módulos + inversores" é um insight valioso.

5.  **A estratégia de importação (dry-run + dedup hash + limpeza) é a ideal?**
    **Sim, a estratégia proposta é a ideal.** A combinação de pré-processamento (split fabricante/modelo, descarte de lixo), o uso do pipeline de dedup existente com um limiar de confiança, a marcação de origem, o dry-run com revisão humana e a importação em lotes é uma abordagem completa e segura.

6.  **O risco de duplicação está bem dimensionado?**
    **Sim, o risco de duplicação está bem dimensionado e as mitigações são adequadas.** O relatório reconhece o risco como "moderado" e detalha as fontes (prováveis, variações de nomenclatura, fabricantes mal-parseados). As mitigações propostas, especialmente o pipeline de dedup e a revisão humana, são eficazes para controlar esse risco.

**Veredito:**

**APROVADO COM RESSALVAS**

**Ressalvas:**

*   **Tratamento dos "Prováveis":** A estratégia deve detalhar como os 16 "prováveis" serão tratados. Serão considerados novos ou tentarão ser fundidos com registros existentes? A confiança ≥0.90 no matcher é um bom indicativo, mas uma regra clara para esses casos é necessária.
*   **Revisão Humana Detalhada:** Embora mencionada, a profundidade e o escopo da revisão humana para os ~50 fabricantes novos precisam ser bem definidos para garantir a qualidade.
*   **Definição de "Acessórios":** A exclusão de "acessórios" é acertada, mas uma lista mais explícita de quais categorias serão descartadas (além de "kit", "custo", "serviço") pode evitar ambiguidades.

No geral, a sprint foi executada com excelência, fornecendo uma base sólida para a próxima fase de importação. As ressalvas são pontos de refinamento que garantirão ainda mais a segurança e a precisão do processo.
