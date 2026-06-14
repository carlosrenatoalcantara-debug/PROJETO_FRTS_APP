# P0-QUALITY-REPROCESS-01 — Relatório de Reprocessamento Oficial de Qualidade

> Execução do reprocessamento recomendado pela sprint **P0-QUALITY-FORENSICS-01**
> (ver `QUALITY_PANEL_VS_ATLAS.md`), que comprovou que o painel exibia um **snapshot
> defasado** (262 inválidos) em vez da realidade recomputada ao vivo (155 inválidos).

- **Executor:** Sonnet (Claude Code)
- **Data:** 2026-06-14
- **Mecanismo único utilizado:** `POST /api/admin/catalogo/reprocessar-todos` (endpoint oficial existente)
- **Regras de qualidade:** inalteradas · **Arquitetura:** inalterada · **Motor:** não foi criado nada novo
- **Revisão Gemini:** ⚠️ **OBRIGATÓRIA E PENDENTE** (gate de aceite — ver seção final)

---

## Execução

| Item | Valor |
|---|---|
| Endpoint | `POST /api/admin/catalogo/reprocessar-todos?limite=2000` |
| `total_encontrados` | 358 |
| `processados` | 358 |
| `sem_mudanca` | 234 |
| `mudaram (snapshot atualizado)` | 124 |
| `erros` | 0 |
| `processado_em` | 2026-06-14T19:05:27.460Z |

> O endpoint roda `processarEquipamento` (motor oficial) sobre cada documento e persiste
> `qualidade.*`, `specs_canonicas`, `identificacao`, `status_operacional` via `updateOne`.
> Nenhuma regra foi tocada. Cobertura total numa única chamada (358 ≤ limite 2000).

---

## FASE 1 vs FASE 3 — ANTES × DEPOIS (painel oficial `qualidade-relatorio`)

| Métrica | ANTES (stored/defasado) | DEPOIS (reprocessado) | Δ |
|---|---|---|---|
| **inválidos** | **262** | **155** | **−107** |
| suspeitos | 64 | 164 | +100 |
| incompleto | 4 | 11 | +7 |
| utilizável | 28 | 27 | −1 |
| validado | 0 | 1 | +1 |
| **válidos** (validado+utilizável) | 28 | 28 | 0 |
| **score global médio** | **27.5** | **34.3** | **+6.8** |
| completude média | 35.8 | 52.2 | +16.4 |
| confiança média | 22.1 | 22.6 | +0.5 |
| **total de ocorrências de alerta** | **266** | **203** | **−63** |

### Alertas por categoria (ocorrências)

| Código | ANTES | DEPOIS | Δ |
|---|---|---|---|
| SEM_ESPECIFICACOES | 199 | 132 | −67 |
| ISC_MPPT_IMPLAUSIVEL | 18 | 16 | −2 |
| TIPO_INVALIDO | 15 | 15 | 0 |
| MPPT_FAIXA_IMPLAUSIVEL | 7 | 7 | 0 |
| TENSAO_SAIDA_NAO_PADRAO | 6 | 7 | +1 |
| RAZAO_IMPP_ISC_FORA_FAIXA | 6 | 6 | 0 |
| IMPP_MAIOR_QUE_ISC | 6 | 6 | 0 |
| POTENCIA_FORA_FAIXA_COMERCIAL | 5 | 5 | 0 |
| POTENCIA_NAO_BATE_VxI | 0 | 5 | +5 (novo, severidade alto) |
| POTENCIA_FORA_FAIXA | 3 | 3 | 0 |
| SEM_TIPO | 1 | 1 | 0 |

---

## FASE 4 — Respostas

1. **Quantos inválidos havia antes?** → **262**
2. **Quantos inválidos existem depois?** → **155**
3. **Quantos alertas desapareceram?** → **63 ocorrências líquidas** (266 → 203).
   O maior abatimento veio de `SEM_ESPECIFICACOES` (−67). Surgiram 5 ocorrências novas de
   `POTENCIA_NAO_BATE_VxI` (regra que passou a marcar módulos cujos V×I não fecham a potência).
4. **Quantos equipamentos mudaram de inválido para suspeito?** → 107 equipamentos deixaram de
   ser inválidos. Pela conciliação dos deltas de nível: **~100 migraram para suspeito** e **~7
   para incompleto** (o saldo utilizável −1 / validado +1 corresponde a 1 equipamento que subiu
   de utilizável para validado). O padrão é exatamente o previsto na forense: módulos/inversores
   que tinham `SEM_ESPECIFICACOES` no snapshot defasado voltaram a "suspeito" ao reprocessar.
5. **O painel agora reflete a realidade encontrada na forense?** → **SIM, 1:1.**
   - `invalido`: painel **155** = forense live **155** ✅
   - `SEM_ESPECIFICACOES`: painel **132** = forense live **132** ✅
   - score global subiu (níveis migraram para cima), conforme previsto. ✅

---

## FASE 5 — Inválidos reais restantes (155) classificados

Detalhe completo por equipamento em **`QUALITY_INVALIDOS_REAIS.json`**.
Classificação primária (cada equipamento conta 1× na sua categoria dominante; quando há
`SEM_ESPECIFICACOES` ela predomina):

| Categoria | Qtd |
|---|---|
| SEM_ESPECIFICACOES | 132 |
| TIPO_INVALIDO | 15 |
| IMPP_MAIOR_QUE_ISC | 6 |
| ISC_MPPT_IMPLAUSIVEL | 0 *(presente, mas sempre junto de SEM_ESPECIFICACOES)* |
| MPPT_FAIXA_IMPLAUSIVEL | 0 *(idem)* |
| outros | 2 |
| **Total** | **155** |

**Os 2 "outros":**
- `inversor` Deye `MINVDE-MO-220-2.25KW` — score 22, sem código de alerta (inválido por score baixo / specs canônicas insuficientes).
- `carregador_ev` Wallbox `Pulsar Plus` — `SEM_TIPO` (crítico).

**Separação por tipo:**

| Tipo | Inválidos |
|---|---|
| inversor | 131 |
| carregador_ev | 16 |
| modulo | 8 |
| **Total** | **155** |

---

## FASE 6 — Respostas

1. **Quantos inválidos reais restaram?** → **155**
2. **Qual categoria mais impacta?** → **`SEM_ESPECIFICACOES`** com **132** de 155 (**85%**).
   É o vetor dominante e quase totalmente concentrado em inversores.
3. **Quantos são módulos?** → **8**
4. **Quantos são inversores?** → **131** (+ 16 carregadores EV).
5. **Quantos possuem origem SolarMarket?** → **132** (131 inversores + 1 módulo).
   Ou seja, **toda a massa de `SEM_ESPECIFICACOES` é a importação SolarMarket** que entrou sem
   especificações técnicas. Os 16 carregadores EV e os 6 módulos `IMPP_MAIOR_QUE_ISC` **não**
   são de origem SolarMarket.
6. **Próxima sprint de remediação recomendada:**
   - **P1 — Enriquecer especificações dos 131 inversores SolarMarket** (`SEM_ESPECIFICACOES`):
     reprocessar via ingestão de datasheet / `completar-ia` para popular `especificacoes` e
     promover esses equipamentos de inválido → utilizável. É o maior ganho (85% dos inválidos).
   - **P2 — Carregadores EV (16: 15 `TIPO_INVALIDO` + 1 `SEM_TIPO`):** decidir o tratamento de
     `carregador_ev` no motor de qualidade — hoje o tipo é marcado inválido. Requer definição de
     produto (não alterar regras sem aprovação): habilitar regras válidas para EV **ou** mover EV
     para a coleção/fluxo próprio (`CarregadorEV`).
   - **P3 — 6 módulos `IMPP_MAIOR_QUE_ISC` (Neosolar/Canadian):** dado elétrico fisicamente
     impossível (Impp > Isc) — correção de dados de origem, não de motor.

---

## Critério de aceite

| Critério | Status |
|---|---|
| Reprocessamento executado | ✅ 358/358, 0 erros |
| Nenhuma alteração nas regras | ✅ (somente `reprocessar-todos`) |
| Nenhuma alteração arquitetural | ✅ |
| Métricas antes/depois | ✅ (`QUALITY_BEFORE_AFTER.json`) |
| Evidências reais | ✅ (capturas brutas em `reports/quality-reprocess/`) |
| Commit separado | ✅ (commit dedicado a esta sprint) |
| **Revisão Gemini obrigatória** | ⚠️ **PENDENTE — gate antes do merge** |

> **Nota sobre a revisão Gemini:** o executor (Sonnet) **não** se auto-certifica. A revisão
> obrigatória pelo Gemini é um gate de processo e deve ser feita pelo revisor designado sobre
> estes 3 entregáveis antes do merge. Este relatório não declara a revisão como concluída.

## Entregáveis

- `QUALITY_REPROCESS_REPORT.md` (este arquivo)
- `QUALITY_BEFORE_AFTER.json` — métricas antes/depois + deltas + conciliação forense
- `QUALITY_INVALIDOS_REAIS.json` — os 155 inválidos reais, classificados e separados por tipo
- Evidência bruta (não-entregável, para auditoria): `backend/reports/quality-reprocess/`
  (`BEFORE_raw.json`, `AFTER_raw.json`, `REPROCESS_result.json`, gerador read-only).
