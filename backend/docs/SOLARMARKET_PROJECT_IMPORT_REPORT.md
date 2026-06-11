# P1-SOLARMARKET-PROJECT-IMPORT-01 — Migração de projetos SolarMarket

> Importação **controlada, idempotente e rastreável** dos projetos SM → `projetofvs`, **vinculando
> ao cliente** já importado via `origem.id_externo`. Não sobrescreve projetos existentes; não toca
> catálogo/parser/OCR/memorial/parecer/clientes.

## FASE 1 — Inventário (confirmação)

| Métrica | Valor | Auditoria |
|---|---|---|
| **Projetos totais** | **642** | 642 ✓ |
| Projetos deletados | **0** | — |
| Projetos sem cliente (órfão na origem) | **0** | — |
| **Propostas** (cache) | **586** | ~590 ✓ |
| Projetos **com** proposta | **586** | — |
| Projetos **sem** proposta | **56** | — |

## FASE 2 — Mapeamento SM `project` → `ProjetoFV`

| SolarMarket | ProjetoFV | Obs |
|---|---|---|
| `project.id` | `origem.id_externo` | rastreabilidade/idempotência |
| `project.name` | `nome` (**required**) | direto |
| `project.client.id` | **`clienteId`** (**required**, ref Cliente) | vínculo via `Cliente.origem.id_externo` |
| `client.address`+`number`+`neighborhood`+`city`+`state` | `endereco_completo` / `cidade` / `estado` | direto |
| `client.zipCode` | `cep` | só dígitos |
| `responsible` / `representative` / `description` | *(sem destino agora)* | metadados comerciais |
| **financeiro / consumo / equipamentos** | *(na PROPOSTA)* | → sprint de propostas |

> `ProjetoFV` exige **`clienteId` + `nome`**. Projeto cujo cliente **não** foi importado = **ÓRFÃO**
> (não criável). Os campos de consumo/dimensionamento/financeiro **não vêm do `project`** — estão na
> **proposta** (FASE 6).

## FASE 3/4 — Vínculo de clientes + dry-run

Vínculo por **`origem.id_externo`** (id do cliente SM) → fallback CPF/e-mail. Match só por telefone
= **REVISAR** (ambíguo).

| Classe | Critério | Qtde |
|---|---|---|
| **VINCULADO** | cliente achado por id_externo/CPF/e-mail | **566** |
| **REVISAR** | vínculo só por telefone (ambíguo) | **10** |
| **ÓRFÃO** | cliente não importado (era REVISAR no import de clientes) | **66** |

## FASE 5/7 — Importação controlada + validação

Criados **só os VINCULADOS** (driver raw): `clienteId` (ObjectId do Cliente) + `nome` +
`endereco_completo`/`cep`/`cidade`/`estado` + `origem{tipo:'import_solarmarket', id_externo, data,
lote, cliente_id_externo}` + `status_migracao:'shell_importado'`. **Idempotência** por
`origem.id_externo` (re-execução cria **0**).

| Verificação | Resultado |
|---|---|
| Projetos importados | **566** |
| Projetos originais (intactos) | **8** |
| **Total final** | **574** |
| Duplicados por `id_externo` | **0** ✅ |
| `clienteId` aponta p/ cliente **real** | **566/566** ✅ |
| Importados sem `clienteId` | **0** ✅ |
| Projetos existentes sobrescritos | **0** ✅ |

## FASE 6 — Propostas (avaliação separada — **não improvisar**)

586 propostas no cache, **todas com `pricingTable` (equipamentos+preços) + `variables` (~563)**
(consumo mensal por UC, distribuidora, subgrupo, financeiro). Classificação de migrabilidade:

| Classe | Conteúdo | Veredito |
|---|---|---|
| **A — migrável agora** | `valor financeiro` (Σ salesValue), `consumo_mensal`, `distribuidora`, `subgrupo` | mapeamento direto a `ProjetoFV` |
| **B — migrável parcial** | potência/geração das `variables` (depende de mapear ~563 nomes de variável) | requer dicionário de variáveis |
| **C — exige nova sprint** | **binding de equipamento** (`pricingTable.item` → `equipamento_id` do Atlas) + dimensionamento estruturado + financeiro detalhado | **`P1-SOLARMARKET-PROPOSAL-IMPORT-01`** |

→ **Decisão:** propostas **NÃO** migradas nesta sprint (escopo = projetos + vínculo). Os dados estão
preservados no cache/SM para a sprint dedicada (sem improviso).

## FASE 8 — Respostas

1. **Projetos migrados:** **566**.
2. **Vinculados:** **566** (100% com `clienteId` apontando para cliente real).
3. **Órfãos:** **66** (cliente não importado — eram REVISAR no import de clientes).
4. **Revisados:** **10** (vínculo só por telefone — ambíguo, não criados).
5. **Perda de informação:** **0** nos campos de projeto migrados. As **propostas** (consumo/
   equipamentos/financeiro) **não** foram migradas (escopo) — **preservadas** no cache/SM p/ a
   próxima sprint (pendência, não perda).
6. **Dependência restante do SolarMarket:** as **586 propostas** (consumo, equipamentos, financeiro)
   ainda não migradas → o Forte depende do SM para os **detalhes das propostas** até a sprint de
   propostas. **Clientes (431) e projetos-shell (566) já operam no Forte.**
7. **Próxima sprint:** **`P1-SOLARMARKET-PROPOSAL-IMPORT-01`** — migrar consumo/distribuidora/
   financeiro das 586 propostas + binding de equipamentos (pricingTable → Atlas), enriquecendo os
   shells criados nesta sprint (via `origem.id_externo`).

### Conclusão
**566 projetos migrados** como shells vinculados, com **vínculo de cliente 566/566 correto**,
**0 duplicação, 0 sobrescrita** e **idempotência** comprovada. Os 66 órfãos dependem da revisão dos
clientes correspondentes; as 586 propostas (ricas em consumo/equipamentos/financeiro) ficam para uma
**sprint dedicada** — sem improviso. Lote em `SOLARMARKET_PROJECT_IMPORT_LOTE.json`.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida). Veredito: sucesso (APROVADO).

## Avaliação da Sprint P1-SOLARMARKET-PROJECT-IMPORT-01

A sprint de migração de projetos do SolarMarket para o ProjetoFV foi executada com um foco louvável em controle, idempotência e rastreabilidade. A abordagem de criar "shells" de projeto vinculados, com os dados essenciais para a criação, é sólida, especialmente considerando que os detalhes de consumo e equipamentos residem nas propostas.

**Análise das Questões:**

1.  **Shells de projeto vinculados:** Sim, a abordagem de criar shells de projeto vinculados (`clienteId` + `nome` + `origem`) é correta. Dado que o consumo/equipamentos estão na proposta, o shell inicial é suficiente para estabelecer a base do projeto no `ProjetoFV`, permitindo a vinculação ao cliente.

2.  **Projeto sem cliente como ÓRFÃO:** Sim, tratar projetos sem cliente importado como "ÓRFÃO" e não criá-los é a abordagem correta. O `clienteId` é um campo obrigatório para a criação de um projeto no `ProjetoFV`, e a falha em vinculá-lo corretamente impede a criação.

3.  **Vínculo por `origem.id_externo` com fallback:** A estratégia de vínculo por `origem.id_externo` com fallback para CPF/e-mail é robusta. O critério de "só-telefone=REVISAR" é prudente, pois o telefone pode ser menos distintivo e levar a falsos positivos. A classificação de 10 projetos para revisão é um bom indicador de que o processo identificou ambiguidades.

4.  **Idempotência + Vínculo válido + 0 duplicação:** Sim, a idempotência comprovada (re-run=0), o vínculo 566/566 válido e a ausência de duplicações por `id_externo` demonstram alta qualidade e confiabilidade na migração.

5.  **NÃO migrar propostas agora:** Sim, a decisão de não migrar as propostas nesta sprint, classificando-as em A/B/C e reservando-as para uma sprint dedicada, respeita o princípio de "não improvisar". Isso garante que a migração das propostas seja tratada com a devida atenção e planejamento, evitando complexidade excessiva na sprint atual.

6.  **Dependência restante caracterizada:** Sim, a dependência restante das 586 propostas está bem caracterizada. Fica claro que o "Forte" dependerá do SolarMarket para os detalhes das propostas até a próxima sprint dedicada, enquanto os clientes e projetos-shell já estão operacionais.

7.  **Veredito:** A sprint foi um sucesso na migração dos projetos como shells vinculados, com alta qualidade nos dados e processos. A gestão das propostas para uma sprint futura é uma decisão acertada. Os 66 órfãos e 10 projetos a revisar representam os próximos passos claros para a consolidação completa.

**Recomendação:** Proceder com a próxima sprint focada na migração das propostas, conforme planejado.
