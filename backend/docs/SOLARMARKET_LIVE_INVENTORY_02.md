# P0-SOLARMARKET-LIVE-INVENTORY-02 — Inventário completo do SolarMarket (read-only)

> **100% read-only.** Sem importar/gravar/criar; sem alterar SolarMarket/Atlas. Inventário real
> via API autenticada (credencial de `.env.local`): paginação total de projetos + amostra
> estatística de propostas. **Nenhum número inventado** — tudo medido na API.

## FASE 1 — Projetos (paginação total)

| Métrica | Valor |
|---|---|
| **Total de projetos** | **642** (7 páginas de 100) |
| Ativos | **642** |
| Deletados (`deletedAt`) | **0** |
| Data mais antiga | **2022-03-08** |
| Data mais recente | **2026-06-05** |

Estrutura do projeto: `id, name, description, client{…}, responsible, representative, createdAt,
deletedAt`. → **cliente embutido com id próprio**.

## FASE 2 — Propostas (amostra estatística de 60 projetos)

| Métrica | Amostra (60) | Extrapolado (642) |
|---|---|---|
| Projetos com proposta | **55/60 (92%)** | ~**590 propostas** |
| Itens de `pricingTable` | 493 (~8,2/proposta) | ~5.300 linhas |

`GET /projects/:id/proposals` → `{ pricingTable[], variables[] }` (≈**563 variables** por proposta —
consumo, geração, UC, potência, etc., mapeáveis pelo `variablesNormalizer`).

## FASE 3 — Catálogo embutido (do `pricingTable`)

Item = `{ category, item, qnt, unitCost, totalCost, salesValue }`. Fabricante = 1º token de `item`.

| Classe (amostra 60 proj) | Itens | Únicos |
|---|---|---|
| **Módulo** | 55 | **39** |
| **Inversor** | 56 | **33** |
| **Bateria** | 0 | 0 (BYD aparece, mas sob outras categorias) |
| **Carregador EV** | 0 | 0 |
| KIT (bundle) | 52 | — (não é item único) |
| Serviço/mão de obra/frete | 15 | — |
| Outro (cabo, estrutura, conector, taxa) | 315 | 40 (acessórios, não equipamento-core) |

**Fabricantes reais (~32):** Astronergy, BYD, Canadian, Chint, DAH, Deye, DMEGC, ERA, Goodwe,
Growatt, Hanersun, Helius, Honor, Hoymiles, JA, Jinko, Kehua, Leapton, NEP, OSDA, Ronma, Sirius,
SolarEdge, Solis, Solplanet, Sunova, Tongwei, Trina, TSUN, WEG, ZNShine, AE. (O resto dos "55
tokens" é ruído: CABO, ESTRUTURA, CONECTOR, Imposto, Taxa, Mão de obra…)

## FASE 4 — Clientes (todos os 642 projetos)

| Métrica | Valor |
|---|---|
| **Clientes únicos** (por `client.id`) | **525** |
| Com **CPF/CNPJ** (`cnpjCpf`) | 356 (**68%**) |
| Com **email** | 215 (**41%**) |
| Com **telefone** | 455 (**87%**) |
| Com **endereço** | 499 (**95%**) |

→ Clientes **estruturados** (id, nome, cnpjCpf, email, primaryPhone, zipCode, address). Boa
qualidade para migração direta; email é o campo mais fraco (41%).

## FASE 5 — Equipamentos × Atlas

| Comparação (amostra 72 core únicos vs Atlas 97) | Resultado |
|---|---|
| **Já existe no Atlas** | **6 (~8%)** |
| **Não existe no Atlas** | **66 (~92%)** |

→ O **Atlas cobre ~8%** do que o SM realmente usa (match estrito fabricante+modelo). Exemplos
fora do Atlas: Jinko JKM540M, Growatt MIN 5000TL-X, Sunova SS-555, SolarEdge SE-20.1K, Sirius
Grafeno, Kehua SPI15K-B, Canadian HiKu CS3W-455MS, BYD MLK-36-530. → migrar o catálogo do SM
**adiciona centenas de modelos novos**.

## FASE 6 — Documentos

Sonda read-only (HTTP): `/projects/:id/documents`, `/files`, `/attachments`, `/proposals/pdf`,
`/documents` → **todos HTTP 404**. → **A API NÃO expõe documentos/anexos/PDFs.** Os PDFs de
proposta/memorial existem no SaaS, mas **não são acessíveis via API** desta integração.

## FASE 7 — Estimativa de migração

| Entidade | Volume | Migrabilidade |
|---|---|---|
| **Clientes** | **525** únicos | direta (estruturados; 68% CPF, 95% endereço) — **baixo/médio** |
| **Projetos** | **642** | `variablesNormalizer` (563 vars/proposta) — **médio** |
| **Propostas** | **~590** | junto com projetos (pricingTable+variables) — **médio** |
| **Equipamentos** | ~**300 únicos estimados** (72 em 60 proj; ~92% novos) | pipeline matcher/dedup existe — **médio** |
| **Documentos** | **0 via API** | **não migrável pela API** (exigiria exportação manual do SM) — **alto/bloqueado** |

## FASE 8 — Respostas

1. **Quantos projetos existem?** **642** (medido, paginação total).
2. **Quantos clientes existem?** **525 únicos** (de 642 projetos).
3. **Quantas propostas existem?** **~590** (92% dos projetos têm proposta ativa).
4. **Quantos equipamentos existem?** **72 core únicos** na amostra de 60 projetos (~300 estimados
   no total) + acessórios; **~32 fabricantes reais**.
5. **Quanto já está no Atlas?** **~8%** dos equipamentos (6/72 amostra). Clientes/projetos/
   propostas do SM: **0%** (nunca migrados).
6. **Quanto falta migrar?** Praticamente **tudo**: 525 clientes, 642 projetos, ~590 propostas,
   ~92% dos equipamentos (centenas de modelos novos). **Documentos: 0 migráveis pela API.**
7. **Qual o esforço real da migração?** **~3–4 sprints:** clientes (baixo/médio), catálogo de
   equipamentos (médio — pipeline existe), projetos+propostas (médio — `variablesNormalizer`),
   documentos (**alto/bloqueado** — sem endpoint). Principal risco: **dedup** (equipamentos
   embutidos por texto livre, `hash_unico` mitiga) + **documentos não exportáveis pela API**.
8. **O SolarMarket pode ser aposentado após a migração?** **Para os DADOS, sim** — clientes,
   projetos, propostas e catálogo são **acessíveis e migráveis** via API. **Para os DOCUMENTOS,
   não pela API** — PDFs de proposta/memorial/anexos **não são expostos**; o desligamento total
   exige uma **estratégia separada de exportação documental** (manual/portal SM) antes de aposentar.

### Conclusão
Inventário real concluído: **642 projetos · 525 clientes · ~590 propostas · ~300 equipamentos
únicos (~92% fora do Atlas) · 0 documentos via API**. Os **dados estruturados são totalmente
migráveis** (clientes/projetos/propostas/catálogo); o **único bloqueio ao desligamento é a
documentação** (PDFs não expostos pela API). Esforço ~3–4 sprints. Nada foi importado/gravado
(read-only). **Próxima sprint recomendada:** **P1-SOLARMARKET-CLIENT-IMPORT-01** (importar os 525
clientes — dado mais estruturado e de menor risco) + investigar via SM portal a exportação documental.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P0-SOLARMARKET-LIVE-INVENTORY-02

A revisão da sprint P0-SOLARMARKET-LIVE-INVENTORY-02 foi conduzida com foco na metodologia, precisão dos dados, conclusões e estimativas.

**1. Metodologia:**
A metodologia empregada é **sólida e honesta**. A paginação total para projetos e clientes garante a completude desses dados. O uso de uma amostra estatística para propostas e equipamentos é adequado, dado o volume e a natureza dos dados, e a extrapolação parece razoável. A transparência sobre a amostra e a extrapolação é um ponto positivo.

**2. Separação Ruído vs. Equipamento Real:**
A separação entre ruído (cabo, estrutura, taxa) e equipamento-core (módulos, inversores) parece **correta e bem justificada**. A identificação de fabricantes reais e a desconsideração de itens genéricos como "ruído" demonstram um bom entendimento do domínio.

**3. Comparação com Atlas:**
A comparação estrita com o Atlas, resultando em apenas ~8% de overlap, é **confiável para o critério de "match estrito fabricante+modelo"**. No entanto, é importante notar que isso pode **subestimar a interoperabilidade potencial** se houver variações de modelo ou fabricante que poderiam ser mapeadas. A conclusão de que o SolarMarket adiciona centenas de modelos novos é uma implicação importante.

**4. Conclusão "Migrável Exceto Documentos":**
A conclusão de que os dados estruturados são totalmente migráveis, com a documentação como único bloqueio, é **correta com base nas informações apresentadas**. A API não expõe os documentos, o que é um impedimento direto para a migração automatizada.

**5. Estimativa de Esforço:**
A estimativa de 3-4 sprints parece **realista**, considerando a complexidade da normalização das variáveis das propostas e a necessidade de um pipeline robusto para dedup de equipamentos. O principal risco apontado (dedup e documentos) é pertinente.

**6. Algo Deixado Passar?**
*   **Potencial de Mapeamento Flexível com Atlas:** Embora a comparação seja estrita, seria útil explorar se há alguma flexibilidade ou heurística que poderia aumentar o overlap com o Atlas, mesmo que não seja um match exato.
*   **Impacto do "Ruído":** Embora descartado como equipamento-core, o volume de "ruído" (315 itens na amostra) pode indicar a necessidade de um processo de limpeza ou categorização mais refinado para outros fins, caso surjam.
*   **Estratégia de Exportação Documental:** A conclusão aponta para a necessidade de uma estratégia separada de exportação documental. Seria valioso detalhar um pouco mais os próximos passos ou considerações para essa estratégia (ex: quem seria responsável, qual o prazo estimado para essa tarefa separada).

**7. Veredito:**

**APROVADO COM RESSALVAS**

**Justificativa:** A sprint foi executada com rigor metodológico e os resultados são claros e bem documentados. A principal ressalva reside na necessidade de um plano de ação mais detalhado para a migração dos documentos, que é o único ponto de bloqueio para o desligamento. A comparação com o Atlas, embora tecnicamente correta, pode ser um ponto de atenção para futuras otimizações de interoperabilidade.
