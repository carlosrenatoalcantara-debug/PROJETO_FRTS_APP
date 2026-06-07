# P1-CATALOG-SANITIZE-EXEC-01 — Execução de Saneamento (Atlas real)

> Fonte oficial: **Atlas `iva0pph` / `forte_solar` / `equipamentos`** (95 docs).
> Critérios: alterações mínimas · preservar `_id` · preservar histórico. Escrita via
> `$set fabricante` (driver, sem hook) — não recomputa qualidade nem adiciona evento.

## FASE 1 — Fabricantes inválidos (inventário, SEM corrigir)

| `_id` | fabricante (inválido) | modelo | tipo |
|---|---|---|---|
| `6a24630b…9a8a` | `Página 1 de 1` | KW 220V | carregador_ev |
| `6a246322…9a92` | `Fast Wall⇥Fast Wall` (TAB + token duplicado) | AC380V | carregador_ev |

Ambos são ruído de cadastro/OCR de carregadores EV. **Não corrigidos** — o fabricante
real é indeterminável (`Página 1 de 1` é rodapé de PDF; `AC380V` é uma tensão, não modelo).
Requerem **reatribuição manual** (proibido adivinhar). `Fast Wall⇥Fast Wall` → provável
`Fast Wall` (dedupe determinístico), recomendado como correção pontual com confirmação.

## FASE 2 — Normalização de duplicados por caixa (EXECUTADO)

| Grupo | Variantes | Canônico | Ação |
|---|---|---|---|
| SOLPLANET | `SOLPLANET` (1, EV) + `Solplanet` (2, inv) | **Solplanet** | `SOLPLANET` → `Solplanet` |

**Aplicado: 1 registro** (`updateMany $set fabricante`). Verificação pós-escrita:
`total=95` · `SOLPLANET=0` · `Solplanet=3` · `_id` preservado · `validacao.historico`
inalterado (len=1 em todos). **Nenhum outro caso de duplicação por caixa** encontrado
nos 27 fabricantes.

## FASE 3 — Auditoria de `tensao_partida`

| | inversores |
|---|---|
| **Possuem** `tensao_partida` | **0** |
| **Não possuem** | **22 (100%)** |

Por fabricante (ausência): Goodwe 9 · Huawei 6 · Solplanet 2 · Chint 2 · Solis 2 · Deye 1.

**Causa:** o parser de texto **não mapeia o rótulo** de tensão de partida
(`Starting voltage` / `Tensão de partida`). Como é ausência sistêmica (100%), **não é
recuperável por reprocesso isolado** — exige adicionar o rótulo ao parser (fora do escopo).

## FASE 4 — Ranking de completude (pós-normalização)

| # | Fabricante | Inversores | Completude |
|---|---|---|---|
| 1 | **Goodwe** | 9 | **92.3%** |
| 2 | Solis | 2 | 88.5% |
| 3 | Huawei | 6 | 87.2% |
| 4 | Chint | 2 | 84.6% |
| 5 | Deye | 1 | 84.6% |
| 6 | **Solplanet** | 2 | **80.8%** |

## FASE 5 — Plano de recuperação automática (SEM executar)

**Constatação-chave:** os 95 documentos **não armazenam o datasheet de origem**
(`datasheet_original = 0` em 100% — confirmado na P1-CATALOG-PROVENANCE-01). Logo, **não
há datasheet "já existente" embutido** para reprocessar in-place; a recuperação depende
dos **PDFs originais** (pasta de datasheets) ou de novo upload.

Plano (ordem, esforço, dependência):

| # | Lacuna | Estratégia | Pré-requisito |
|---|---|---|---|
| 1 | `tensao_partida` (22/22) | adicionar rótulo `Starting voltage`/`Tensão de partida` ao parser → reprocessar | **sprint de parser** (fora deste escopo) + PDFs |
| 2 | `n_mppts` (Solplanet ASW7300-S, Deye 23K) | reprocessar datasheet existente (campo é extraível) | re-upload do PDF original |
| 3 | faixa MPPT + corrente (Huawei SUN2000-100KTL) | datasheet completo (o resumido não traz) | datasheet completo |
| 4 | 2 fabricantes inválidos de EV | reatribuição manual | decisão humana |

**Não executar** automaticamente: itens 1–3 exigem PDFs/parser; item 4 exige decisão humana.

## Respostas

1. **Quantos registros foram corrigidos?** **1** (`SOLPLANET` → `Solplanet`).
2. **Quantos fabricantes foram normalizados?** **1** (`Solplanet`).
3. **Quantos registros permanecem incompletos?** **22 inversores** sem `tensao_partida` (100%); destes, **8** em revisão por outras lacunas (audit anterior). Além disso, **2** carregadores EV com fabricante inválido pendentes de reatribuição manual.
4. **Melhor cobertura?** **Goodwe — 92.3%** (9 inversores).
5. **Pior cobertura?** **Solplanet — 80.8%** (2 inversores).
6. **Próxima sprint recomendada?** **P1-PARSER-STARTVOLTAGE-01** — mapear o rótulo de tensão de partida no parser (resolve a lacuna de 100%), seguida de **P1-CATALOG-DATASHEET-RECOVERY-01** (re-upload + reprocesso dos PDFs originais, já gravando no Atlas com proveniência). A reatribuição dos 2 fabricantes inválidos de EV pode ir junto, com confirmação.

### Conclusão
Saneamento executado com **alterações mínimas e seguras**: 1 normalização de caixa
(IDs/histórico preservados), 2 inválidos inventariados para decisão humana, e o gap de
`tensao_partida` diagnosticado como **sistêmico do parser** (não recuperável sem sprint de
parser). O catálogo está mais limpo e a próxima evolução de completude é clara.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P1-CATALOG-SANITIZE-EXEC-01

A execução do saneamento no catálogo MongoDB Atlas (95 docs) foi realizada com foco em alterações mínimas e seguras, preservando `_id` e histórico.

1.  **Escrita Única (Normalização de Caixa):** A normalização de `SOLPLANET` para `Solplanet` via `updateMany $set fabricante` foi segura, mínima e correta. A preservação do `_id` e do histórico, sem o uso de hooks, garante a integridade dos dados.

2.  **Decisões de Não Correção:** A decisão de não auto-corrigir os dois fabricantes inválidos de EV (por indeterminabilidade do real) e de não recuperar `tensao_partida` (devido a um gap sistêmico do parser, fora do escopo) é acertada. A proibição de adivinhar e a delimitação do escopo são cruciais para a confiabilidade do processo.

3.  **Ranking de Completude e Plano de Recuperação:** O ranking de completude reflete a situação atual dos dados, e o plano de recuperação, que corretamente identifica a necessidade dos PDFs originais e do parser para preencher lacunas como `tensao_partida`, faz sentido. A constatação de que os documentos não armazenam o datasheet de origem é um ponto chave.

4.  **Riscos:** Os principais riscos residem na dependência de fontes externas (PDFs) e na necessidade de atualizações no parser para resolver lacunas sistêmicas. A reatribuição manual dos fabricantes inválidos de EV também apresenta um risco de erro humano.

5.  **Veredito:** **APROVADO COM RESSALVAS**.

    **Justificativa:** A sprint foi bem executada, com foco em segurança e integridade dos dados. A normalização realizada foi correta e as decisões de não intervir em dados indetermináveis ou com lacunas sistêmicas são prudentes. As ressalvas se referem à necessidade de ações futuras (sprint de parser e recuperação de datasheets) para atingir a completude desejada, e à pendência de reatribuição manual dos fabricantes de EV. O plano de recuperação é claro e direciona os próximos passos de forma lógica.
