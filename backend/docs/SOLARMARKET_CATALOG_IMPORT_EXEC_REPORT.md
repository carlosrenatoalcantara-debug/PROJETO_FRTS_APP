# P1-SOLARMARKET-CATALOG-IMPORT-EXEC-01 — Importação real do catálogo (CRIAR)

> Primeira **escrita real** no Atlas: importação **aditiva** do catálogo SolarMarket, **somente
> CRIAR de alta confiança**. Nenhum registro existente alterado; nenhum merge; rastreável por
> `origem.tipo='import_solarmarket'`. Sem tocar SSOT/parser/OCR/memorial/parecer.

## FASE 1 — Pré-validação (a partir do cache das 642 propostas)

Pipeline oficial sobre o cache: **5.562 line items → 5.470 aprovados → 608 normalizados únicos**
(dedup por hash: 2.281 duplicatas internas; 2.581 descartados como não-equipamento).

**Filtro ESTRITO adicional (segurança máxima)** sobre os candidatos:
- **Categoria** ∈ {Módulo, Inversor} (bloqueia cabos/estruturas/kits/serviços/custos);
- **Allowlist curada** de fabricantes reais (bloqueia tokens-lixo `Cabo`, `Comissão`, `Estrutura`,
  `Parafuso`, `Transporte`, `Garantia`…);
- **Modelo com código** (contém dígito, 3–40 chars) — bloqueia descrições;
- **Anti-acessório** (regex CONECTOR/CABO/PARAFUSO/MADEIRA/ROSCA/KIT/COMISS…).

→ **252 candidatos estritos → 236 CRIAR** (sem match no Atlas). Validados: fabricante, modelo,
tipo, `hash_unico` — todos presentes (0 com campo crítico vazio).

## FASE 2 — Limpeza

A nomenclatura SM (`MARCA MODELO descrição`) foi **dividida** em fabricante/modelo via allowlist
(ex.: `JA SOLAR JAM72S30-550/MR` → `JA Solar` + `JAM72S30-550/MR`). Pipeline oficial
(`normalizer` → `matcherLote` → `decidirAcao`) aplicado. **Bloqueados: ~372** (acessórios/ruído
não-allowlist + 154 REVISAR por alertas + baixa confiança). **0 fabricante-lixo, 0 modelo
incompleto** no conjunto final.

## FASE 3 — Importação controlada

236 novos `Equipamento` criados via `normalizar()` + `save()` (hook de qualidade roda):
- `origem.tipo='import_solarmarket'`, `origem.fonte='solarmarket_pricingtable'`, `origem.em`=data.
- `identificacao.{hash_unico, fabricante_normalizado, modelo_normalizado, aliases:[nome_SM]}`.
- `historico:[{acao:'import_solarmarket', observacao}]`.
- **Idempotência:** guarda por `hash_unico` (não recria existentes) — 0 pulados (todos inéditos).
- **Preservação:** nenhum `_id`/registro existente tocado; **nenhum merge**.

> ⚠ Nota técnica: o subcampo `origem.lote` foi **removido pelo schema strict** do Mongoose (não
> declarado). A rastreabilidade fica por `origem.tipo='import_solarmarket'` + `origem.em`
> (o catálogo tinha **0** `import_solarmarket` antes → identifica unicamente este lote; reversível).

## FASE 4 — Validação pós-importação

| Métrica | Valor |
|---|---|
| Registros criados | **236** |
| Módulos | **105** |
| Inversores | **131** |
| EV / Baterias | **0** (inexistentes no SM) |
| Fabricantes novos | **31** |
| **Total ANTES** | **113** |
| **Total DEPOIS** | **349** (delta **+236**, exato) |
| Registros NÃO-deste-import (originais) | **113** (intactos ✓) |

**Fabricantes novos (31):** APsystems, Astronergy, Canadian, DAH, DMEGC, Enphase, Fronius,
Hanersun, Honor, Hoymiles, JA Solar, Jinko, Kehua, Leapton, Longi, Maxeon, Minasol, NEP, OSDA,
Resun, Risen, SAJ, Sofar, SolarEdge, Sungrow, Sunova, Tongwei, Topsola, Trina, TSUN, ZNShine.

## FASE 5 — Auditoria de qualidade

| Pergunta | Resposta |
|---|---|
| 1. Quantos criados | **236** (105 módulos + 131 inversores) |
| 2. Quantos bloqueados | **~372** (acessórios/ruído não-allowlist + 154 REVISAR + baixa confiança) |
| 3. Fabricantes novos | **31** |
| 4. Conflitos | **0** (nenhum registro existente alterado) |
| 5. Duplicados detectados | **3 hashes** — **pré-existentes nos 113 originais** (`origem=desconhecido`: Neosolar NS400W/NS550W, Canadian CS3K-400MS). **O import criou 0 duplicados.** |
| 6. Completude média dos novos | **0,33 campo** de especificação — **shells de identidade** (o `pricingTable` não traz specs; enriquecíveis por datasheet depois) |
| 7. Catálogo íntegro | **SIM** — 113 originais preservados, 0 registros sem hash, total exato, nenhum merge |

## FASE 6 — Amostra manual (SM → Atlas)

**Módulos:** JA Solar `JAM72S30-550/MR` · Sunova `SS-550-72MDH` · Honor `HY-M10/144H 550W` ·
Jinko `JKM530M-72HL4-TV` · Canadian `HIKU CS3W-455MS` · Astronergy `ASTROSEMI CHSM72M-HC 555` ·
Leapton `LP182-M-72-NB` · DAH `DHN72X16/FS-585W` (+ Jinko `JKM470M-7RL3-V`, `JKM450M-60HL4-V`).
**Inversores:** Deye `SUN-5K-G`, `SUN-75K-G`, `SUN-35K-G03`, `SUN-8K-G03` · SAJ `M2-2.25K-S4` ·
Growatt `MAC 60KTL3-X LV` · SolarEdge `SE 20.1K`, `SE 27.6K` (+ Deye `SUN2000G-US-220`).
→ **fabricante, modelo e tipo corretos em 20/20** (split marca/modelo fiel ao nome SM).

## FASE 7 — Resposta final

### 🟢 Importação bem-sucedida
**236 registros criados, 0 erros, 0 duplicados criados, 113 originais preservados, 31 fabricantes
novos** — todos equipamentos reais (módulos/inversores) com fabricante/modelo corretos. A
importação foi **conservadora por design**: dos 313 inéditos brutos do dry-run, só os **236 de
alta confiança** entraram; acessórios/ruído/REVISAR foram **bloqueados** (preservando a qualidade).

### Ressalvas honestas (não-bloqueantes)
- **Completude baixa (shells):** os novos têm só identidade (sem specs) — o `pricingTable` não
  fornece especificações. São **âncoras de catálogo** enriquecíveis via datasheet em sprint futura.
- **3 duplicados pré-existentes** nos 113 originais (não deste import) merecem saneamento à parte.

### Conclusão
O catálogo Atlas cresceu **113 → 349 (+209%)** com **segurança máxima**: importação aditiva,
idempotente, rastreável (`origem=import_solarmarket`), sem tocar registros existentes nem o
pipeline de qualidade. **Próxima sprint recomendada:** **P1-SOLARMARKET-CATALOG-ENRICH-01** —
enriquecer os 236 shells com especificações (datasheet/Gemini) e avaliar os ~154 REVISAR.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P1-SOLARMARKET-CATALOG-IMPORT-EXEC-01

A sprint P1-SOLARMARKET-CATALOG-IMPORT-EXEC-01, focada na primeira escrita real no Atlas com importação aditiva do catálogo SolarMarket, demonstra um processo cuidadoso e com foco em qualidade. A abordagem adotada, com filtros estritos e validação rigorosa, é louvável.

**Avaliação dos pontos:**

1.  **Filtro estrito (236) vs. bruto contaminado (313):** A decisão de aplicar um filtro estrito foi **correta e prudente**. Importar dados brutos e contaminados (313 itens) teria gerado um volume significativo de trabalho para limpeza posterior, comprometendo a qualidade e a confiabilidade do catálogo. A abordagem de importar apenas os 236 itens de alta confiança preserva a integridade do Atlas desde o início.

2.  **Importação aditiva idempotente sem merge:** A importação aditiva, combinada com a idempotência por hash e a ausência de merge, **preserva a integridade dos dados existentes**. Ao não alterar registros pré-existentes e garantir que cada item seja importado apenas uma vez, a consistência do catálogo é mantida.

3.  **Distinção dos 3 duplicados como pré-existentes:** A distinção dos 3 hashes duplicados como pré-existentes nos registros originais com `origem=desconhecido` é **correta**. Isso demonstra que o processo de importação não criou duplicados, mas sim identificou itens que já existiam no sistema sob outra origem, o que é crucial para a precisão da auditoria.

4.  **Honestidade na importação de shells de identidade (completude 0.33):** Importar "shells de identidade" com completude baixa (0.33) é **honesto na medida em que a limitação é explicitamente comunicada**. A nota sobre a ausência de especificações no `pricingTable` e a possibilidade de enriquecimento futuro é transparente. No entanto, é importante que o plano para enriquecer esses dados seja priorizado para que o valor desses registros aumente.

5.  **Perda do `origem.lote` e rastreabilidade/reversibilidade:** A perda do `origem.lote` devido ao schema strict do Mongoose é uma **ressalva técnica que compromete parcialmente a rastreabilidade granular**. Embora a rastreabilidade por `origem.tipo='import_solarmarket'` e `origem.em` seja uma alternativa viável, a ausência de um lote específico pode dificultar a identificação exata de subconjuntos de dados importados em cenários mais complexos ou em futuras auditorias detalhadas. A reversibilidade ainda é possível, mas pode exigir um esforço maior para isolar um lote específico.

6.  **Classificação 🟢 é justa:** A classificação **🟢 bem-sucedida é justa**. Apesar da ressalva sobre a perda do `origem.lote`, os objetivos principais da sprint foram alcançados com sucesso: importação aditiva, criação de registros de alta confiança, preservação de dados existentes e ausência de erros.

**Veredito:**

**APROVADO COM RESSALVAS**

**Justificativa:** A sprint foi um sucesso em seus objetivos primordiais de importação segura e aditiva de dados de alta confiança. A prudência na filtragem e a idempotência garantiram a integridade do catálogo. A ressalva principal reside na perda do `origem.lote`, que, embora mitigada pela rastreabilidade alternativa, representa uma diminuição na granularidade da rastreabilidade e reversibilidade. A baixa completude dos dados importados também é um ponto a ser monitorado e resolvido em sprints futuras.

**Recomendações:**

*   Priorizar a sprint **P1-SOLARMARKET-CATALOG-ENRICH-01** para enriquecer os 236 shells de identidade com especificações.
*   Avaliar a possibilidade de futuras iterações do schema para incluir um campo de lote ou identificador similar, caso a granularidade perdida se torne um problema operacional.
*   Continuar o monitoramento dos ~154 itens marcados para REVISAR.
