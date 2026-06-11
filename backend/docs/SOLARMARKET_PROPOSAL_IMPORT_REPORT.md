# P1-SOLARMARKET-PROPOSAL-IMPORT-01 — Migração de propostas (enriquecimento de projetos)

> Enriquece os **projetos já importados** com as propostas SM. **Não recria** projetos/clientes;
> usa os registros migrados, vinculando por `origem.id_externo`. Idempotente. Não toca clientes.

## FASE 1 — Inventário

| Métrica | Valor |
|---|---|
| Propostas (cache, com dados) | **586** |
| Propostas **vinculadas** a projeto importado | **514** |
| Propostas **órfãs** (projeto não importado) | **72** |
| Projetos importados (shells) | 566 |

## FASE 2 — Mapeamento proposta → `ProjetoFV`

| SolarMarket | ProjetoFV | Fonte |
|---|---|---|
| `variables.consumo_mensal` | `consumo_kwh_mes` + `proposta_sm.consumo_mensal_kwh` | variável |
| `variables.tarifa_distribuidora` | `valor_kwh` + `proposta_sm.tarifa_kwh_r` | variável |
| `variables.dis_energia` | `distribuidora` + `proposta_sm.distribuidora` | variável (nem sempre preenchida) |
| `variables.potencia_sistema` | `dimensionamento.potencia_kwp` | variável |
| `variables.geracao_anual_0` / `geracao_mensal` | `dimensionamento.geracao_anual_kwh` / `geracao_mensal_kwh` | variável |
| `Σ pricingTable.salesValue` / `investimento_anual_0` | `financeiro.custo_total_r` + `proposta_sm.investimento_r` | pricingTable/variável |
| `variables.economia_anual_valor_0` | `proposta_sm.economia_anual_r` | variável |
| `pricingTable[]` (Módulo/Inversor/KIT) | `dimensionamento.num_paineis`/`num_inversores` + `proposta_sm.equipamentos[]` | pricingTable |

Bloco **`proposta_sm`** guarda a proposta migrada completa (rastreável por `proposta_de_projeto_externo`).

## FASE 3 — Classificação de migrabilidade

| Classe | Conteúdo | Tratamento |
|---|---|---|
| **A — migrável diretamente** | consumo, tarifa, distribuidora, potência, geração, financeiro (custo/economia ano-0), **lista de equipamentos** (item+qnt+valor) | **migrado** |
| **B — exige transformação** | séries de 12 meses (`s_consumo_mensal`, `geracao_jan..dez`), por-UC | lista de equipamentos **parseada/armazenada raw**; séries **não promovidas** |
| **C — exige sprint futura** | **binding do equipamento ao Atlas** (`pricingTable.item` → `equipamento_id`), projeção financeira de 25 anos, consumo estruturado por UC | **deferido** (dados no cache) |

## FASE 4/5 — Dry-run + importação controlada

Atualiza **apenas** projetos `import_solarmarket` com `status_migracao='shell_importado'`
(driver raw, `$set`). **Idempotente** (re-execução enriquece **0**; passa a `proposta_importada`).
**`origem.id_externo` preservado.**

| Receberia / recebeu | Qtde |
|---|---|
| **Projetos enriquecidos** | **514** |
| com **consumo** | 506 |
| com **distribuidora** | 311 |
| com **financeiro** | 514 |
| com **equipamentos** (lista) | 514 |
| com **potência / geração** | 514 |

## FASE 6 — Validação

| Verificação | Resultado |
|---|---|
| Projetos enriquecidos | **514** |
| Propostas vinculadas | **514** (de 586) |
| Propostas órfãs | **72** (projeto não importado) |
| Projetos total (não recriou) | **574 → 574** ✅ |
| Vínculo proposta↔projeto consistente | **514/514** ✅ (`proposta_de_projeto_externo == origem.id_externo`) |
| Clientes alterados por esta sprint | **0** (escopo = projetos) ✅ |

**Amostra:** ext 5 → 84,6 kWp · 139.011 kWh/ano · R$ 307.597 · 180 módulos · 3 equip. Dados
coerentes.

## Respostas (FASE 6)

1. **Projetos enriquecidos:** **514**.
2. **Propostas vinculadas:** **514** (de 586).
3. **Órfãs:** **72** (propostas cujo projeto não foi importado — clientes em REVISAR/órfãos).
4. **Perda:** **0** nos campos migrados. As séries de 25 anos e o **binding de equipamento ao Atlas**
   ficam **deferidos** (dados **preservados** no cache/`proposta_sm.equipamentos`) — pendência, não perda.
5. **Dependência restante do SolarMarket:** **binding de equipamento** (item → `equipamento_id` do
   Atlas) + **projeção financeira de 25 anos** + consumo estruturado por UC → sprint futura. Mas
   **consumo, distribuidora, financeiro, potência, geração e a lista de equipamentos já estão no
   Forte** (514 projetos).

### Nota — esclarecimentos (ressalvas Gemini)

- **Origem das 72 órfãs:** são propostas cujo **projeto** não foi criado na sprint anterior
  (P1-SOLARMARKET-PROJECT-IMPORT) por **ÓRFÃO (66)** — cliente não importado (estava em REVISAR no
  import de clientes: sem CPF/e-mail/telefone, ou match-telefone ambíguo) — **ou REVISAR (10)** —
  projeto com vínculo de cliente só por telefone, não criado. Sem `ProjetoFV`, não há onde anexar a
  proposta. Resolvem-se ao revisar/importar esses clientes (e seus projetos).
- **`consumo_mensal` (migrado, A) ≠ "consumo estruturado por UC" (deferido, C):** o **consumo médio
  mensal** (`consumo_mensal` → `consumo_kwh_mes`) **foi migrado** (506 projetos). O item C é o nível
  **mais granular** — consumo **por unidade consumidora** (`*_uc1`, `*_uc2`…) e as **séries de 12
  meses** (`s_consumo_mensal`, ponta/fora-ponta) — que exige modelagem multi-UC própria. Não há
  contradição: migrou-se o agregado mensal; o detalhamento por UC fica para a sprint futura.

### Conclusão
**514 projetos enriquecidos** com consumo/distribuidora/financeiro/potência/geração + lista de
equipamentos, **vínculo 514/514 consistente**, **0 recriação**, **0 duplicação** e **idempotência**
comprovada. As 72 propostas órfãs dependem da revisão dos clientes/projetos correspondentes. O
**binding de equipamento ao Atlas** (matching `pricingTable.item` → catálogo) é o último passo do
desligamento do SolarMarket → **`P1-SOLARMARKET-PROPOSAL-EQUIPMENT-BIND-01`**. Lote em
`SOLARMARKET_PROPOSAL_IMPORT_LOTE.json`.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida). Veredito: APROVADO com ressalvas (esclarecidas na Nota acima).

## Revisão da Sprint P1-SOLARMARKET-PROPOSAL-IMPORT-01

A sprint P1-SOLARMARKET-PROPOSAL-IMPORT-01 demonstra um planejamento e execução robustos para o enriquecimento de projetos com dados de propostas SolarMarket. A abordagem de não recriar projetos/clientes e vincular por `origem.id_externo` é fundamental para a integridade dos dados e a eficiência do processo.

**Avaliação das Questões:**

1.  **Enriquecer shells via `$set` preservando `origem.id_externo`:** **Correto**. Esta abordagem garante a atualização in-place dos projetos existentes, mantendo a rastreabilidade e evitando duplicação. A preservação do `origem.id_externo` é crucial para futuras referências e auditorias.

2.  **Bloco `proposta_sm` (proposta completa rastreável) + campos estruturados:** **Boa modelagem**. A inclusão de um bloco dedicado para a proposta completa (`proposta_sm`) com a lista de equipamentos raw garante a rastreabilidade e a preservação dos dados originais. A estruturação em `variables[]` e `pricingTable[]` para os campos mapeados é clara e organizada, facilitando o acesso e a manipulação dos dados.

3.  **Classificação A/B/C coerente:** **Coerente**. A classificação em A (migrado diretamente), B (transformação necessária) e C (deferido para sprint futura) é lógica e alinhada com o princípio de "não improvisar". O deferimento do binding de equipamento ao Atlas e da projeção de 25 anos para uma sprint futura é uma decisão prudente, focando na entrega incremental e na gestão de complexidade.

4.  **Idempotência + vínculo 514/514 + 0 recriação comprovam qualidade:** **Sim, comprovam qualidade**. A idempotência assegura que re-execuções não causem efeitos colaterais indesejados. O vínculo 514/514 consistente e a ausência de recriação de projetos/clientes atestam a precisão e a integridade do processo de migração e enriquecimento.

5.  **72 órfãs e dependência restante bem caracterizadas:** **Sim, bem caracterizadas**. As 72 propostas órfãs são claramente identificadas como aquelas cujos projetos não foram importados, indicando uma pendência na importação de projetos. A dependência restante (binding de equipamento e projeção financeira) é explicitamente mencionada como um item para a próxima fase, com os dados preservados no cache.

6.  **Algo deixado passar?** A caracterização das 72 propostas órfãs é boa, mas seria útil detalhar o que constitui um "cliente em REVISAR/órfãos" para que a equipe entenda a origem dessas propostas. Além disso, a menção de "consumo estruturado por UC" como deferido na FASE 3 (C) parece contradizer a FASE 2 onde `consumo_mensal` é mapeado para `consumo_kwh_mes`. É importante clarificar se o "consumo estruturado por UC" se refere a um nível de detalhe maior que o `consumo_mensal` básico.

7.  **Veredito:** **Aprovado com ressalvas**. A sprint foi executada com sucesso, atingindo seus objetivos principais de enriquecimento e vinculação de dados de forma idempotente e sem duplicação. A modelagem e a classificação são adequadas. As ressalvas referem-se à necessidade de clarificar a origem dos "clientes em REVISAR/órfãos" e o detalhamento do "consumo estruturado por UC" para evitar potenciais ambiguidades. A dependência restante está bem definida para a próxima iteração.
