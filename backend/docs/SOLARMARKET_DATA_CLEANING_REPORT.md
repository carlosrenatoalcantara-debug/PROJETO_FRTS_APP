# P1-SOLARMARKET-DATA-CLEANING-01 — Auditoria dos 33 projetos causa D (corrompidos)

> **READ ONLY.** Nenhum projeto ou catálogo alterado. Apenas medição.
> - **Data:** 2026-06-14 · **Executor:** Sonnet · **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE
> - Dados: `SOLARMARKET_CORRUPTION_MATRIX.json`

## VEREDITO

Dos 33 projetos causa-D, **25 são recuperáveis só por data-cleaning** (sem outros gaps; correção de
string), **7 exigem revisão manual**, 1 também tem outro gap. A corrupção dominante é **duplicação de
campo** (o modelo foi copiado para `marca` e `modelo`), causada pela **limitação de multiarranjo do
SolarMarket** — confirmada nos 3 casos obrigatórios. ROI estimado: **439 → ~464 (+25, ~90%)**.

---

## FASE 1 — Inventário (33 projetos, 34 itens causa-D)

Padrões observados (amostra):

| Item (marca / modelo) | Tipo | Proj | Padrão |
|---|---|---|---|
| `TRINA SOLAR TALLMAX TSM-DE18` / `550` | módulo | 6 | fab+modelo na marca; modelo=wattage |
| `ZXMR-UPLDD144-600W` / `ZXMR-UPLDD144-600W` | módulo | 3 | marca==modelo (duplicação) |
| `HELIUS HMB132T12R` / `630` | módulo | 2 | fab+modelo na marca; modelo=wattage |
| `ZXMR-UPLDD144` / `ZXMR-UPLDD144` | módulo | 2 | marca==modelo |
| `DHN-SU1K5T-G0` / `DHN-SU1K5T-G0` | inversor | 2 | marca==modelo |
| `600W` / `Bifacial` | módulo | 1 | wattage como marca (insuficiente) |
| `-` / `-` | inversor | 1 | vazio |
| `SUN-M225G4-EU-Q0` / `SUN-M225G4-EU-Q0` | inversor | 1 | marca==modelo (Deye — já no Atlas!) |

Lista completa cliente/projeto/equipamento em `SOLARMARKET_CORRUPTION_MATRIX.json` (`matriz_projetos`).

## FASE 2 — Classificação da causa raiz (por item)

| Cat | Definição | Itens |
|---|---|---|
| **A** | fabricante corrompido/ausente (modelo no campo marca — **duplicação de campo**) | **19** |
| **B** | modelo corrompido (só nome do fabricante, sem modelo: "DAH", "ZNSHINE", "EnergySun") | 3 |
| **C** | fabricante + modelo concatenados (marca="FAB MODELO", modelo=wattage) | 9 |
| **D** | ampliação representada por texto | 0 a nível de item; **presente a nível de projeto** (ver FASE 4) |
| **E** | dados insuficientes (wattage como marca, vazio, modelo genérico) | 3 |
| **F** | outros | 0 |

## FASE 3 — Recuperabilidade (por item)

| Resposta | Qtd | Como |
|---|---|---|
| 1. **Automática** | **6** | modelo já existe no Atlas sob o fabricante inferido → corrigir marca e re-bindar |
| 2. **Regra simples** | **21** | inferir fabricante do prefixo do modelo (ZXM→Znshine, JAM→Ja Solar, SUN-→Deye…) ou da linha KIT do `proposta_sm` |
| 3. **Revisão manual** | **7** | só fabricante sem modelo (B), wattage-only/genérico/vazio (E) |

## FASE 4 — Casos obrigatórios (limitação de multiarranjo confirmada)

| Caso | Projeto(s) | Sinal de multiarranjo / corrupção |
|---|---|---|
| **Paulo Carlos** | `207` + `207.2 (ampliação)` | **Ampliação = projeto separado**. `207` KIT="**26 Honor 590**" mas painel bound = Pulling PU-620 → **2º arranjo (Honor) só no texto do KIT**. Inversor TSUN (causa B). |
| **Fazenda Alice** | `132.1` + `132.2` | **Dividido em .1/.2** (dois arranjos como projetos). `132.2` inversor "KEHUA TECH **TECH** SPI60K-B" (duplicação "TECH TECH"). `132.1` KIT="MFVLE-MO-132-585W" ≠ painel Leapton. |
| **Escola Pinheiro** | `197` | **Duplicação de campo**: inversor "SE 33.3K **SE 33.3K** 380/220v", painel "ZXMR-UPLDD144 **ZXMR-UPLDD144**". KIT="**74 ZNSHINE 600 + Solaredge**" (o "+" funde módulo+inversor). Tem otimizadores S1200 ×37. |

**Conclusão FASE 4:** há **resquícios claros da limitação do SolarMarket (sem multiarranjo)**:
1. **Duplicação de campo** (modelo copiado em marca e modelo) — origem dos "marca==modelo" (cat A).
2. **Ampliação como projeto separado** (sufixo `.1`/`.2`, "(ampliação)").
3. **2º arranjo embutido no KIT como texto** ("26 Honor 590", "74 ZNSHINE 600 + Solaredge").

> A linha `proposta_sm.equipamentos` (KIT/Módulo/Inversor) costuma ter o dado **correto** para
> cross-reference — é a chave da recuperação automática/por-regra.

## FASE 5 — Plano de correção (SEM aplicar)

**Regras propostas (a aprovar):**
- **R1 (duplicação de campo, cat A):** quando `marca == modelo` e o valor é string de modelo → manter
  modelo, derivar `fabricante` do prefixo conhecido **ou** da linha KIT do `proposta_sm`. Re-bindar.
- **R2 (concatenado, cat C):** quando `modelo` é wattage e `marca` = "FAB MODELO" → separar fabricante
  (prefixo conhecido), `modelo` = resto, `potencia` = wattage. Re-bindar.
- **R3 (cross-ref KIT):** usar `proposta_sm.equipamentos[].item` para preencher fab/modelo ausente.
- **Revisão manual (cat B/E):** 7 itens sem modelo recuperável.
- **NÃO** alterar multiarranjo (fora de escopo) — o 2º arranjo no KIT fica para sprint de multiarranjo.

**Respostas:**
1. **Quantos projetos podem ser recuperados?** → **25** só por data-cleaning (auto+regra, sem outros gaps);
   até **~32** se a revisão manual + cross-ref KIT dos 7 restantes for bem-sucedida.
2. **Quantos bindings adicionais?** → **~25** (cada projeto recuperado tem só gaps causa-D → completa ao limpar).
3. **ROI estimado?** → projetos completos **439 → ~464 (+25)** = **~90.3%** de 514 (aproxima do histórico ~458-465).

## Critério de aceite

| Critério | Status |
|---|---|
| Read only | ✅ |
| Sem alterações | ✅ |
| Classificação dos 33 casos | ✅ (matriz A–F + recuperabilidade) |
| Estimativa de recuperação | ✅ (+25, ~464) |
| Revisão Gemini | ⚠️ PENDENTE |

## Entregáveis
- `SOLARMARKET_DATA_CLEANING_REPORT.md` (este)
- `SOLARMARKET_CORRUPTION_MATRIX.json` — 33 projetos, itens causa-D, sub-causa, recuperabilidade, casos obrigatórios
- Script read-only: `backend/reports/sm-cleaning/analyze.mjs`

## Aguardando aprovação antes do APPLY
Recomendo aprovar o APPLY das regras **R1+R2+R3** (25 projetos de baixo risco, cross-ref com `proposta_sm`),
deixando os 7 manuais e o 2º-arranjo (multiarranjo) para sprints próprias. Commit separado no APPLY.
