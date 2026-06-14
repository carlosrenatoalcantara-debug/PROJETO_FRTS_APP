# P0-QUALITY-FORENSICS-01 — Painel de Qualidade × Atlas atual (FASE 3)

> READ-ONLY. Evidência por consultas reais: comparação entre o que o **painel exibe**
> (`GET /api/admin/catalogo/qualidade-relatorio`) e a **verdade recomputada ao vivo**
> (`processarEquipamento` sobre os mesmos documentos do Atlas).

## Como o painel funciona (mecanismo)

`GET /api/admin/catalogo/qualidade-relatorio` agrega **campos `qualidade.*` ARMAZENADOS** em
cada `Equipamento` (`$group` por `qualidade.nivel`, `$unwind` em `qualidade.alertas`). **Não há
cache de request** — ele lê o banco a cada chamada. PORÉM os campos `qualidade.*` são um
**SNAPSHOT** escrito no último `.save()` de cada documento (hook `pre('save')` em `Equipamento.js`).

→ Quando uma sprint atualiza specs via `updateOne`/`$set` (que **não** dispara `pre('save')`) ou
quando o motor/parser/SSOT muda **depois** do último save, o snapshot fica **defasado**. O painel
mostra o snapshot defasado.

## Painel (literal) vs Atlas recomputado (ao vivo)

| Métrica | **PAINEL (stored)** | **ATLAS ao vivo (recompute)** | Δ |
|---|---|---|---|
| `invalido` | **262** | **155** | −107 |
| `suspeito` | 64 | 164 | +100 |
| `incompleto` | 4 | 11 | +7 |
| `utilizavel` | 28 | 27 | −1 |
| `validado` | 0 | 1 | +1 |
| score_global médio | **27.5** | sobe (níveis migram p/ cima) | ↑ |
| SEM_ESPECIFICACOES (ocorrências) | **199** | **132** | −67 |
| Total de ocorrências de alerta | **266** | **203** | −63 |

114 documentos têm **nível divergente** entre stored e live.

## Respostas (FASE 3)

**1. O painel está correto?**
Tecnicamente **sim na agregação** (soma corretamente os campos `qualidade.*`), mas **incorreto na
representação da realidade**: exibe um snapshot defasado. O número "262 inválidos" e "199 sem
especificações" **não refletem o Atlas atual** (verdade: 155 e 132).

**2. Está usando snapshot antigo?**
**Sim.** `qualidade.*` é gravado no último `save()` do documento. Imports/binds/correções
recentes não reprocessaram a qualidade da maioria dos equipamentos legados.

**3. Existe cache?**
**Não há cache de request** (agrega o banco a cada chamada). O "cache" efetivo é o próprio
**snapshot por documento** em `qualidade.*`.

**4. Existe coleção de auditoria não atualizada?**
Não há coleção externa que alimente o painel. O histórico fica em `validacao.historico` por
documento (também só atualizado no save). O painel não depende dele.

**5. Existe necessidade de reprocessamento?**
**Sim — é a causa-raiz.** Já existe o endpoint `POST /api/admin/catalogo/reprocessar-todos`,
que re-roda `processarEquipamento` e persiste a qualidade atual. Após ele, o painel passa a
mostrar a verdade (155 inválidos, 132 sem specs, score maior). **Esta sprint NÃO executa** o
reprocessamento (read-only) — apenas comprova a divergência.

## Evidência

- Painel literal: `top_alertas[0] = {SEM_ESPECIFICACOES, medio, 199}`, `distribuicao_nivel.invalido = 262`.
- Recompute live (mesmos docs): `SEM_ESPECIFICACOES = 132`, `invalido = 155`.
- Amostras e divergências por documento: `QUALITY_ALERT_SAMPLE.json`.
