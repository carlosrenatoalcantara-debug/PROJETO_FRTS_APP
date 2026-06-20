# CATALOG_QUALITY_HARDENING_REPORT.md

**Sprint:** P0-CATALOG-QUALITY-HARDENING-01
**Data:** 2026-06-20
**Modelo:** Claude Opus 4.8
**Tipo:** Correção de integridade do catálogo

---

## ⚠️ GEMINI

Sprint marca **GEMINI: Obrigatória**. Não há ferramenta Gemini neste ambiente. **Revisão Gemini: PENDENTE.**

---

## HONESTIDADE — TIPO DE EVIDÊNCIA

```
VALIDADO EM CÓDIGO:   SIM — build frontend OK, syntax backend OK, gate unit-tested
VALIDADO EM RUNTIME:  SIM — backfill de 382 equipamentos (0 erros) contra Railway/Atlas,
                      verificação por tipo no /engenharia, impacto em projetos
```

---

## RESULTADO

```
APROVADO — utilizavel_em_projeto voltou a ser confiável.
Nenhum equipamento identity-only permanece liberado.
```

---

## FASE 1 — FORENSICS

### Como `utilizavel_em_projeto` era calculado (ANTES)
**Não era.** O motor de qualidade (`catalogoQualidade.js`):
- `processarEquipamento()` calculava `qualidade` (score/nível) + `status_operacional`.
- `aplicarResultadoNoDoc()` (chamado pelo hook `pre('save')` do `Equipamento`) setava `specs_canonicas/identificacao/qualidade/status_operacional` — **nunca** `utilizavel_em_projeto` nem `bloqueio_engenharia`.
- O backfill `POST /reprocessar-todos` também **omitia** esses campos.

A função-gate **`avaliarUtilizavel(tipo, especificacoes)`** (`utilizavelProjeto.js`) existia e estava correta, mas só era chamada em **um** lugar: o `PATCH /admin/catalogo/equipamento/:id` (edição manual). Imports de datasheet, salvamentos automáticos e reprocessamento em lote nunca a aplicavam.

### Quem define o score
`processarEquipamento`: `score_global = completude×0.4 + confianca×0.6` → `nivel` (validado/utilizavel/incompleto/suspeito/invalido/aguardando_revisao). Mas **o nível não controla o seletor** — o seletor `/engenharia` filtra por `utilizavel_em_projeto: { $ne: false }`.

### Quais regras existiam / não funcionavam
- Regra de plausibilidade + completude: funcionavam (alimentam `qualidade`).
- `determinarStatusOperacional`: retorna `pode_ser_selecionado: true` para **todos** os níveis (flag `BLOQUEAR_INVALIDOS_S3=false`) — campo consultivo, não bloqueia.
- **Gate `utilizavel_em_projeto`: NÃO funcionava** — desconectado do motor → ficava no default `true`.

**Conclusão Fase 1:** o gate certo (`avaliarUtilizavel`) existia, mas estava desligado do caminho principal do motor → **BUG-CAT-01/QUAL-01 confirmado**.

---

## FASE 2 — CLASSIFICAÇÃO REAL (Atlas, runtime)

| Tipo | Total | Utilizáveis (antes) | Identity-only / insuficientes |
|---|---|---|---|
| Inversor | 177 | 177 (todos passavam) | 132 sem `numero_mppt` / 39 sem `potencia_kw` |
| Módulo | 189 | 189 (todos passavam) | 3 sem potência, 18 sem Voc, 21 sem Isc |
| Estrutura | 0 | — | — |
| Bateria | 0 | — | — |
| Carregador EV | 16 | 16 | (fora do escopo FV) |

Verificação anti-falso-bloqueio: os 132 inversores sem MPPT têm `especificacoes` vazia ou só `potencia_kw`/`_derivado`; a única chave de contagem no catálogo é `n_mppts` (checada pelo gate). **Sem alias perdido — bloqueios corretos.**

---

## FASE 3 — MATRIZ MÍNIMA (aplicada)

| Tipo | Campos mínimos |
|---|---|
| Inversor | fabricante, modelo, `potencia_kw`, `numero_mppt` |
| Módulo | fabricante, modelo, `potencia_wp`, `voc`, `isc` |
| Estrutura | fabricante, modelo (sem especificacoes mínimas) |
| Bateria | fabricante, modelo, `capacidade_kwh` |

`fabricante`/`modelo` são `required` no schema → sempre presentes. O gate avalia as `especificacoes` do núcleo.

---

## FASE 4 — HARDENING

Causa-raiz corrigida ligando `avaliarUtilizavel` ao motor:
1. `processarEquipamento` agora **computa e retorna** `utilizavel_em_projeto` + `bloqueio_engenharia`.
2. `aplicarResultadoNoDoc` (hook `pre('save')`) **aplica** os dois campos → todo save recalcula o gate.
3. `POST /reprocessar-todos` (backfill) **aplica** os dois campos no `$set`.
4. `utilizavelProjeto.js`: matriz alinhada ao sprint + `estrutura`/`bateria` adicionados; fallback de tipo desconhecido deixa de cair em regras de módulo.

Exemplo de bloqueio:
```json
{ "utilizavel_em_projeto": false, "bloqueio_engenharia": ["potencia_kw", "numero_mppt"] }
```

---

## FASE 5 — UX

- **Seletores E7** (SeletorInversores/SeletorPaineis): **já** bloqueavam itens com `utilizavel_em_projeto === false` (cadeado + "Falta: …") e têm o toggle "Mostrar equipamentos incompletos" (Admin/Diretor). Agora recebem dados corretos.
- **Catálogo** (páginas Inversores e Módulos): adicionado badge **`StatusEngenharia`**:
  - ✅ **Utilizável** (cumpre o mínimo e nível bom)
  - ⚠ **Revisão** (cumpre o mínimo, mas nível incompleto/suspeito)
  - ❌ **Incompleto** (não cumpre o mínimo — mostra os campos faltantes)

---

## FASE 6 — MIGRAÇÃO (BACKFILL EXECUTADO)

`POST /api/admin/catalogo/reprocessar-todos?limite=2000` (Railway/Atlas):

```
total_encontrados: 382
processados:       382
liberados:         229
bloqueados:        153
erros:             0
motivos: numero_mppt=132, potencia_kw=39, isc=21, voc=18, potencia_wp=3
```

| Tipo | Total | Utilizáveis (depois) | Bloqueados |
|---|---|---|---|
| Inversor | 177 | **45** | 132 |
| Módulo | 189 | **168** | 21 |
| Carregador EV | 16 | 16 | 0 (fora do escopo) |

- **Aprovados:** 229 (213 FV + 16 EV)
- **Bloqueados:** 153 (132 inversor + 21 módulo)
- **Revisão necessária:** estado intermediário exibido na UX via `qualidade.nivel` (cumpre mínimo mas specs parciais)

---

## FASE 7 — IMPACTO

1. **Projetos ativos que usam equipamentos bloqueados:** **159 de 577** referenciam um equipamento agora bloqueado.
2. **Risco de regressão:** **nenhuma quebra.** O gate é **filtro de seleção** (read-time no `/engenharia`); não muta projetos. Projetos existentes mantêm o equipamento salvo nos arranjos e continuam renderizando. Efeito esperado: ao **re-editar** o E7 desses 159 projetos, o equipamento antigo (incompleto) não reaparece na lista padrão — recuperável via toggle "Mostrar incompletos" (Admin) ou enriquecimento.
3. **Snapshots afetados:** **0.** Dos 159, **nenhum** está CONGELADO/HOMOLOGADO. Snapshots são cópias congeladas — intocados pelo backfill (que só fez `updateOne` em `Equipamento`).

---

## RESPOSTAS OBRIGATÓRIAS

1. **Como o motor estava funcionando:** calculava `qualidade`+`status_operacional`, mas **nunca** recalculava `utilizavel_em_projeto` (hook e backfill omitiam o gate).
2. **Qual era o bug:** `utilizavel_em_projeto` (campo que o seletor `/engenharia` filtra) ficava no default `true`; a função-gate `avaliarUtilizavel` só era chamada no PATCH manual.
3. **Quantos estavam incorretamente liberados:** **153** equipamentos FV (132 inversores + 21 módulos).
4. **Quantos ficaram bloqueados:** **153**.
5. **Quantos permaneceram utilizáveis:** **229** (213 FV + 16 EV).
6. **Projetos afetados:** **159/577** referenciam equipamento bloqueado; **0** congelados (snapshots intactos); nenhuma quebra.
7. **Regressões encontradas:** nenhuma quebra. Efeito esperado: inversores utilizáveis caem 177→45 (reflete o estado real do catálogo).
8. **Runtime executado?** SIM (backfill + verificação por tipo + impacto, contra Railway/Atlas).
9. **Backfill executado?** SIM — 382 processados, 0 erros.
10. **Commit gerado:** `75299cd` + `a0415f9` (+ docs).

---

## CRITÉRIO DE ACEITAÇÃO

> `utilizavel_em_projeto` deve voltar a ser confiável. Nenhum equipamento identity-only pode permanecer liberado.

**ATENDIDO:** o gate agora é recalculado pelo motor em todo save e foi backfillado para os 382 equipamentos. Identity-only/insuficientes (153) estão bloqueados; apenas os 229 que cumprem a matriz mínima permanecem liberados.

---

## VEREDITO

```
APROVADO — gate confiável, backfill aplicado (0 erros), snapshots intactos, EV preservado.
```
