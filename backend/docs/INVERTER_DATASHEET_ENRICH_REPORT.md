# P1-INVERTER-DATASHEET-ENRICH-01 — Enriquecimento dos inversores incompletos

> - **Data:** 2026-06-14 · **Executor:** Sonnet (Claude Code)
> - **Alvo:** 131 inversores `invalido` / `SEM_ESPECIFICACOES` (saída da P0-QUALITY-REPROCESS-01)
> - **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE
> - **Princípio inegociável respeitado:** *sem fallback inventado* — nenhuma especificação foi fabricada.

## VEREDITO

**FASE 1–3 executadas com dados reais** (inventário, classificação A/B/C, ranking ROI).
**FASE 4–6 estão BLOQUEADAS neste ambiente** porque **não existe fonte de datasheet** para extrair —
e a regra "sem fallback inventado" proíbe preencher specs por adivinhação. Detalhe abaixo. Os
entregáveis trazem o **plano de enriquecimento ROI-priorizado pronto para o pipeline oficial**,
e as métricas refletem honestamente `enriquecidos=0` (executados), com o motivo do bloqueio.

---

## FASE 1 — Inventário (real)

- **Inversores inválidos:** 131
- **Modelos únicos:** **131** (cada modelo ocorre 1×; **não há duplicatas** a consolidar)
- **Origem:** 131/131 SolarMarket · 130/131 com **0 especificações**; 0/131 com datasheet anexado

**Respostas:**
1. **Quantos modelos únicos?** → **131** (1 ocorrência por modelo).
2. **Fabricantes que concentram mais ocorrências:**

| Fabricante | Modelos | Projetos (alcance) |
|---|---|---|
| Deye | 41 | 243 |
| Growatt | 19 | 50 |
| Kehua | 18 | 40 |
| Solaredge | 9 | 35 |
| Goodwe | 8 | 5 |
| Solplanet | 7 | 11 |
| Solis | 6 | 5 |
| Tsun | 5 | 35 |
| Sungrow | 4 | 3 |
| Hoymiles | 3 | 10 |

3. **Quais cobrem mais projetos (top ROI por modelo):**

| # | Fabricante | Modelo | Projetos | Classe |
|---|---|---|---|---|
| 1 | Deye | SUN2000G3-US-220 ⚠️ | 110 | A* |
| 2 | Deye | SUN2000G-US-220 ⚠️ | 36 | A* |
| 3 | Deye | SUN-M225G4-EU-Q0 | 30 | A |
| 4 | Tsun | TSOL-MX2250 | 16 | A |
| 5 | Tsun | TSOL-MP2250 | 16 | A |
| 6 | Growatt | MIN 5000TL-X | 13 | A |
| 7 | Kehua | TECH SPI6000-B2 | 12 | A |
| 8 | Solaredge | SE 27.6K 380/220v | 11 | A |
| 9 | Saj | M2-2.25K-S4 | 9 | A |
| 10 | Solaredge | SE 20.1K 380/220v | 9 | A |

> ⚠️ **Alerta de qualidade de dados:** vários SKUs de alto ROI são **semanticamente sujos** — ex.:
> `Deye SUN2000G3-US-220` e `SUN2000G-US-220`: "SUN2000" é nomenclatura **Huawei**, não Deye, com
> sufixo `-US-220` improvável. São prováveis rótulos incorretos vindos do import SolarMarket. Para
> esses, **não existe datasheet localizável** sob o par fabricante/modelo atual — exigem **limpeza
> de dados antes** de qualquer enriquecimento. (Marcados `A*`.)

---

## FASE 2 — Classificação A/B/C

Heurística sobre identificabilidade (fabricante conhecido + código de modelo válido):

| Classe | Critério | Modelos | Ocorrências |
|---|---|---|---|
| **A** datasheet facilmente localizável | fabricante conhecido + código de modelo | 130 | 130 |
| **B** parcialmente identificado | fabricante ok, modelo fraco | 1 | 1 |
| **C** ambíguo | lixo/sem fabricante | 0 | 0 |

> Ressalva: a classe "A" é sintática (tem cara de código). A análise da FASE 1 mostra que um
> subconjunto "A" é, na verdade, **semanticamente ambíguo** (par fab/modelo inconsistente) — a
> classificação puramente textual superestima a localizabilidade real.

---

## FASE 3 — Priorização ROI

Ordenação por `projetos_beneficiados` desc (ver `INVERTER_DATASHEET_ENRICH_LOTE.json`, 131 itens
em ordem de prioridade). Alcance por modelo (proxy, com possível sobreposição entre modelos):
**top-10 modelos ≈ 262 projetos**, **top-20 ≈ 316**, soma total dos alcances por modelo = 464.
O maior ROI isolado está concentrado em poucos SKUs Deye (mas justamente os mais sujos).

---

## FASE 4 — Localizar datasheets / extrair specs — **BLOQUEADO**

Campos-alvo (canônicos Forte Solar — `CAMPOS_CRITICOS_INVERSOR`): `potencia_kw`,
`tensao_max_entrada`, `tensao_mppt_min`, `tensao_mppt_max`, `corrente_max_por_mppt`, `n_mppts`,
`strings_por_mppt`, `eficiencia_maxima`, `fases`, `garantia_anos`.

**Mecanismo oficial existente:** `scripts/enriquecer-catalogo-datasheets.mjs`
(`npm run catalogo:enriquecer-datasheets -- --dir=<pasta> --apply`). Ele lê **PDFs de datasheet de
uma pasta local**, casa por fabricante/modelo (`encontrarMatch`), extrai via **Gemini Vision**
(`extrairComGemini`) e aplica **incrementalmente** (`montarAtualizacaoIncremental` — nunca
sobrescreve, idempotente).

**Por que não roda agora (evidências):**

| Pré-requisito | Estado | Evidência |
|---|---|---|
| Datasheet anexado ao equipamento | ❌ 0/131 | `datasheet_original.hash` ausente em todos |
| Documento datasheet no equipamento | ❌ 0/131 | `documentos_tecnicos[tipo=datasheet]` ausente |
| Pasta local de datasheets | ❌ não existe | Desktop/OneDrive `datasheets` inexistente |
| Chave de IA (Gemini/Claude) | ❌ não configurada | `.env` sem `GEMINI_API_KEY`; `api-keys.json` vazio; logs "gemini: nao_configurado" |
| Qualidade do par fab/modelo | ⚠️ parcialmente suja | SKUs Deye com nomenclatura Huawei |

→ **Não há material de datasheet para ler.** Extrair specs sem fonte seria **inventar dados** —
proibido pelo critério de aceite e perigoso (alimenta dimensionamento de engenharia).

---

## FASE 5 — Aplicar enriquecimento — **NÃO EXECUTADO (corretamente)**

Nenhuma escrita foi feita no catálogo. Aplicar valores não-rastreáveis violaria os 4 princípios
obrigatórios (nunca sobrescrever real / origem rastreável / idempotente / registrar fonte). O
caminho idempotente correto (`PATCH /equipamento/:id` marcando `fonte_dados.fonte` + reprocesso,
ou o script oficial `--apply`) está **pronto**, faltando apenas a **fonte de datasheet**.

---

## FASE 6 — Métricas (honestas)

| Pergunta | Resposta |
|---|---|
| 1. Quantos inversores enriquecidos? | **0** (executados) — bloqueio de fonte |
| 2. Quantos saíram de inválido? | **0** |
| 3. Quantos projetos beneficiados? | **0** (potencial: ~262 nos top-10 modelos, se executado) |
| 4. Quantos permanecem sem solução? | **131** (até haver datasheets/chave de IA) |

---

## Critério de aceite

| Critério | Status |
|---|---|
| Sem fallback inventado | ✅ nada fabricado |
| Dados oriundos de datasheet | ⛔ não executável (sem datasheet disponível) |
| Origem rastreável | ✅ desenho pronto (não houve escrita) |
| Idempotência | ✅ mecanismo oficial é incremental |
| Revisão Gemini | ⚠️ PENDENTE |
| Commit separado | ⏸️ segurando até decisão do caminho (FASE 4-5) |

## Entregáveis

- `INVERTER_DATASHEET_ENRICH_REPORT.md` (este)
- `INVERTER_DATASHEET_ENRICH_LOTE.json` — 131 modelos em ordem de prioridade ROI, com campos-alvo e status `PENDENTE_DATASHEET`
- `INVERTER_ENRICHMENT_METRICS.json` — métricas reais + potencial + motivos de bloqueio
- Evidência/scripts read-only: `backend/reports/inverter-enrich/`

## O que destrava a execução (decisão do usuário)

1. **Caminho oficial (recomendado):** disponibilizar a **pasta de datasheets** (PDFs) + uma
   **`GEMINI_API_KEY`**, e rodar `npm run catalogo:enriquecer-datasheets -- --dir=… --apply`.
2. **Limpeza primeiro:** sprint de *data-cleaning* dos SKUs sujos (ex.: Deye×SUN2000) antes de
   localizar datasheets — caso contrário o maior ROI (110 + 36 projetos) não é endereçável.
3. **Enriquecimento web manual** de um subconjunto limpo e famoso (Growatt MIN 5000TL-X, Saj
   M2-2.25K-S4, Hoymiles HMS-2000DW-4T, etc.) com **transcrição real do datasheet do fabricante**
   e URL-fonte por campo — mudança de método; menor cobertura; exige aprovação explícita.
