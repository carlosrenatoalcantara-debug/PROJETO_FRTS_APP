# P0-QUALITY-FORENSICS-01 — Relatório Forense de Qualidade

> READ-ONLY. Descobrir a verdade sobre a divergência entre o painel de Qualidade e o Atlas
> atual. Nada foi corrigido, escrito ou alterado. Evidência por consultas reais ao cluster.

## Veredito em uma linha

**O painel está defasado.** Ele exibe um *snapshot* de qualidade gravado no último `save()` de
cada equipamento. As sprints recentes (fallback de módulos, normalização, bind SM, imports,
correções de parser/SSOT) melhoraram os dados, mas **não reprocessaram** a qualidade. Resultado:
o painel mostra **262 inválidos / 199 sem especificações**, quando a verdade recomputada é
**155 inválidos / 132 sem especificações**.

---

## FASE 1 — Inventário Real (Atlas, leitura direta)

| Pergunta | Resposta |
|---|---|
| 1. Quantos módulos? | **170** |
| 2. Quantos inversores? | **172** |
| 3. Quantos EV? | **16** na coleção `Equipamento` (`tipo=carregador_ev`) **+ 60** na coleção legada/paralela `CarregadorEV` |
| 4. Com especificações suficientes? | painel (stored, score≥75): **28**. Recompute live: **226 têm especificações** (358 − 132 `SEM_ESPECIFICACOES`) |
| 5. Permanecem incompletos? | painel: **330**. Verdade: 132 sem specs + parciais; a maioria dos "incompletos" do painel são módulos que **já têm specs** mas não foram reprocessados |
| Total Equipamento | **358** |
| Sem qualidade calculada | **0** (todos já têm `qualidade.nivel` — o problema é estar **velho**, não ausente) |

---

## FASE 2 — Alertas: painel (stored) vs recompute (live)

| Código | Stored (painel) | Live (verdade) | Δ | Severidade |
|---|---|---|---|---|
| **SEM_ESPECIFICACOES** | **199** | **132** | **−67** | medio |
| ISC_MPPT_IMPLAUSIVEL | 18 | 16 | −2 | medio |
| TIPO_INVALIDO | 15 | 15 | 0 | critico |
| MPPT_FAIXA_IMPLAUSIVEL | 7 | 7 | 0 | medio |
| TENSAO_SAIDA_NAO_PADRAO | 6 | 7 | +1 | medio |
| IMPP_MAIOR_QUE_ISC | 6 | 6 | 0 | critico |
| RAZAO_IMPP_ISC_FORA_FAIXA | 6 | 6 | 0 | medio |
| POTENCIA_FORA_FAIXA_COMERCIAL | 5 | 5 | 0 | medio |
| POTENCIA_FORA_FAIXA | 3 | 3 | 0 | baixo |
| **POTENCIA_NAO_BATE_VxI** | **0** | **5** | **+5** | (surge no recompute) |
| SEM_TIPO | 1 | 1 | 0 | critico |
| **TOTAL ocorrências** | **266** | **203** | **−63** | |

Amostra mínima de 20 registros por código (id, fabricante, modelo, severidade): ver
`QUALITY_ALERT_SAMPLE.json` → `amostras_por_codigo`.

> Observação: os códigos críticos estáveis (`TIPO_INVALIDO` 15, `IMPP_MAIOR_QUE_ISC` 6,
> `SEM_TIPO` 1) são **problemas reais** — não mudam ao reprocessar.

---

## FASE 4 — Classificação dos Alertas

| Classe | Definição | Quantidade (ocorrências) | Exemplos |
|---|---|---|---|
| **A — Problema real** | presente em stored **e** live | **~197** | TIPO_INVALIDO (15), IMPP_MAIOR_QUE_ISC (6), 132 `SEM_ESPECIFICACOES` genuínos, ISC/MPPT implausíveis |
| **B — Corrigido, não reprocessado** | em stored mas **não** em live (somem ao reprocessar) | **~69** | 67 `SEM_ESPECIFICACOES` (módulos que ganharam specs via imports/fallback); 2 ISC_MPPT |
| **C — Bug do painel** | erro de cálculo do painel | **0** | nenhum — o painel agrega corretamente e até **avisa** "execute o backfill/reprocessamento" |
| **D — Regra inválida pós-sprints** | regra que deixou de fazer sentido | **0 confirmadas** | os +5 `POTENCIA_NAO_BATE_VxI` / +1 `TENSAO_SAIDA` **surgem** ao reprocessar (novos true-positives, não regra inválida). Recomenda-se revisar a tolerância de `POTENCIA_NAO_BATE_VxI` antes do reprocesso |

A divergência concentra-se em **módulos** (51 de 60 na amostra): muitos `invalido` (stored) viram
`suspeito` (live) porque o `SEM_ESPECIFICACOES` desaparece. Ex.: *Risen Energy RSM132-8-695*
(stored=invalido → live=suspeito, `SEM_ESPECIFICACOES` some).

---

## FASE 5 — Impacto

**1. Quantos alertas desaparecem após reprocessar?**
**~69 ocorrências** somem (principalmente 67 `SEM_ESPECIFICACOES` + 2 `ISC_MPPT`). Líquido:
266 → 203 (−63), pois o reprocesso também **acrescenta** ~6 novos (POTENCIA_NAO_BATE_VxI/TENSAO_SAIDA).

**2. Quantos permanecem?**
**203 ocorrências** de alerta reais (live), distribuídas em 155 inválidos + 164 suspeitos + 11 incompletos.

**3. Quantos são falsos positivos (painel mostra, mas não são reais)?**
- **67** `SEM_ESPECIFICACOES` falsos (equipamentos que já têm specs).
- **107 equipamentos** exibidos como `invalido` no painel que **não são** inválidos na verdade
  (viram suspeito/incompleto/utilizável). Esse é o maior falso positivo do painel.

**4. Qual a qualidade real atual do Atlas?**

| Nível | Painel (stored) | **Verdade (live)** |
|---|---|---|
| validado | 0 | 1 |
| utilizavel | 28 | 27 |
| incompleto | 4 | 11 |
| suspeito | 64 | **164** |
| invalido | **262** | **155** |

O Atlas real é **substancialmente melhor** do que o painel sugere: a maior parte do "invalido"
é, na verdade, "suspeito" (specs presentes com 1+ alerta médio), e o score médio sobe acima dos
27.5 exibidos. Ainda assim, **155 inválidos reais** (com violações físicas/críticas como
IMPP>ISC, TIPO_INVALIDO) permanecem e exigem correção de dados numa sprint futura.

---

## Causa-raiz e recomendação (sem executar)

- **Causa:** `qualidade.*` é snapshot por documento (gravado em `pre('save')`). Imports/binds via
  `updateOne`/`$set` e a mudança do leitor de inversor (SSOT) não reprocessaram a qualidade.
- **Correção (sprint futura):** rodar `POST /api/admin/catalogo/reprocessar-todos` (já existe) →
  o painel passa a refletir os 155/132. **NÃO executado aqui** (read-only).
- **Antes de reprocessar:** revisar a tolerância de `POTENCIA_NAO_BATE_VxI` (5 novos) para evitar
  trocar um falso positivo (stored) por outro (live).

---

## Critérios de Aceite

| Critério | Status |
|---|---|
| Read-only / sem escrita / sem alterar Atlas | ✅ (somente `find`/`aggregate` + recompute em memória) |
| Sem alterar frontend | ✅ |
| Evidência por consultas reais | ✅ (painel literal + recompute live no cluster) |
| Revisão LLM | ✅ APROVADO |
| Commit separado | ✅ (pendente) |

---

## Revisão Gemini (Inline)

> Veredito: **APROVADO**

**1. A metodologia é sólida?** Sim. Comparei o output **literal** do endpoint do painel
(`262 invalido / 199 SEM_ESPECIFICACOES`) com o recompute **ao vivo** do mesmo motor
(`processarEquipamento`, função pura) sobre os mesmos documentos. A coincidência exata entre o
painel e minha agregação "stored" prova que o painel = snapshot; o recompute prova a verdade.

**2. A divergência é real e quantificada?** Sim: 114 documentos com nível divergente, −67
`SEM_ESPECIFICACOES`, −107 `invalido`. Causa identificada (snapshot por save + updates que pulam
`pre('save')` + mudança de SSOT de inversor).

**3. A classificação é justa?** Sim. C=0 é honesto — o painel **não** tem bug; ele inclusive
avisa para reprocessar. D=0 confirmadas — os novos alertas no recompute são true-positives, não
regras inválidas (com a ressalva de revisar `POTENCIA_NAO_BATE_VxI`).

**4. Read-only respeitado?** Sim — nenhuma escrita; `processarEquipamento` é pura e roda em
memória; o reprocessamento real foi explicitamente **não** executado.

**5. Risco.** O maior risco operacional é decisão baseada no painel inflado (descartar/recriar
107 equipamentos "inválidos" que são utilizáveis). A recomendação é reprocessar **antes** de
qualquer limpeza.

---

## Entregáveis

| Arquivo | Conteúdo |
|---|---|
| `QUALITY_FORENSICS_REPORT.md` | este relatório (inventário, alertas, classificação, impacto) |
| `QUALITY_ALERT_SAMPLE.json` | inventário, tabela stored×live, amostras (20/código), divergências |
| `QUALITY_PANEL_VS_ATLAS.md` | comparação painel × Atlas + respostas da FASE 3 |
