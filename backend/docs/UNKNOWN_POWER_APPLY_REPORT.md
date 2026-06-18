# UNKNOWN POWER APPLY — Relatório de Execução

**Sprint:** P1-UNKNOWN-POWER-APPLY-01 · **Modelo:** Sonnet
**Revisão Gemini:** Opcional
**Atlas gravado:** ✅ SIM — 83 inversores enriquecidos com potência

---

## Resultado em resumo

| Fase | Status | Resultado |
|---|---|---|
| 1 — Validação (dry-run) | ✅ COMPLETA | 83 alta / 31 média / 8 não-derivável — alinhado com P0 |
| 2 — Apply alta confiança | ✅ COMPLETA | **83 inversores gravados no Atlas** |
| 3 — Reprocessar qualidade | ✅ COMPLETA | Inline no apply (`processarEquipamento + aplicarResultadoNoDoc`) |
| 4 — Validar Cristiano / GW8000-DT | ⚠️ PENDENTE | GW8000-DT é média confiança → não aplicado |
| 5 — Medir impacto | ✅ COMPLETA | Ver métricas abaixo |

---

## FASE 1 — Validação dry-run

Dry-run conectou ao Atlas e enumerou os 122 inversores sem `especificacoes.potencia_kw`.
A matriz de derivação confirmou os números da sprint P0:

```
candidatos : 122
alta confiança  (regex_kW,    derivavel) : 83
média confiança (regex_watts, parcial)   : 31
não-derivável   (requer datasheet)       :  8
```

**Cross-check perfeito** com `FV_CATALOG_RECAL_METRICS.json` (P0). Nenhuma divergência.

---

## FASE 2 — Apply (apenas alta confiança)

```
modo    : APPLY_ALTA_CONFIANCA
gravados: 83
skipped : 35  (31 parcial + 4 nao_derivavel com tensão derivada mas sem potência)
```

Cada documento gravado recebeu:
- `especificacoes.potencia_kw` — potência em kW (alta confiança, sufixo K explícito no nome)
- `especificacoes.tensao_ac` — tensão AC quando derivável do nome (ex: `@220`, `LV`)
- `especificacoes._derivado` — proveniência: `{ metodo, confianca, tecnologia, em }`
- `origem.tipo` mantida como `import_solarmarket` (identidade preservada)
- Qualidade (`qualidade.*`) recalculada inline pelo motor `catalogoQualidade.js`

**Idempotência confirmada:** segunda corrida dry-run encontrou `candidatos=39`, `alta=0`.

---

## FASE 3 — Qualidade reprocessada

O apply chamou `processarEquipamento(doc)` + `aplicarResultadoNoDoc(doc, resultado)` para cada
documento antes de `doc.save()`. Não foi necessário script de reprocessamento separado.

**Impacto esperado no score** (baseado em calibração P0):
- Antes: `nivel=incompleto`, `score≈39` (empty-spec + confiança base 65)
- Depois: `nivel=utilizavel`, `score≈79` (potencia_kw preenchida eleva completude)

---

## FASE 4 — Cristiano 600kw / Goodwe GW8000-DT

> ⚠️ **GW8000-DT não foi aplicado nesta sprint.**

| Parâmetro | Valor |
|---|---|
| Modelo | Goodwe GW8000-DT |
| Potência estimada | 8 kW (derivado de "8000" no nome) |
| Confiança | **média** (`regex_watts`) |
| Aplicado | ❌ NÃO |
| Motivo | Apenas alta confiança aplicada nesta sprint |
| Projeto afetado | Cristiano 600kw (único projeto com inversor sem potência) |
| Status | PENDENTE — inversor ainda com `potencia_kw=null` no Atlas |

**Ação necessária para resolver:** confirmar 8 kW via datasheet Goodwe GW8000-DT e executar:
```bash
node scripts/aplicar-derivacao-catalogo.mjs --apply --incluir-media
```
Ou aguardar enriquecimento via Gemini Vision na sprint de datasheets.

---

## FASE 5 — Impacto

### Catálogo

| Métrica | Antes | Depois |
|---|---|---|
| Inversores sem potência | 122 / 175 (69.7%) | 39 / 175 (22.3%) |
| Inversores com potência | 53 / 175 (30.3%) | **136 / 175 (77.7%)** |
| Inversores "?kW" → kW conhecido | — | **+83** |
| Score qualidade (alta confiança) | ~39 (incompleto) | ~79 (utilizável) |

### Projetos

- **Impacto imediato:** 0 projetos (o único projeto afetado — Cristiano 600kw — usa GW8000-DT que é média confiança, não aplicado)
- **Impacto futuro:** futuros projetos que usem qualquer um dos 83 inversores enriquecidos encontrarão potência disponível no catálogo
- **Homologação:** snapshots futuros capturarão `potencia_kw`; congelados não retroagem (imutáveis por design)

### Qualidade do catálogo de inversores

```
Cobertura potência: 30.3% → 77.7% (+47.4 pp)
```

---

## Pendências após esta sprint

| Item | Status | Ação |
|---|---|---|
| Goodwe GW8000-DT (Cristiano 600kw) | ⚠️ | Confirmar 8kW via datasheet + `--incluir-media` |
| 31 outros de média confiança | ⚠️ | Revisão humana da lista + `--incluir-media` |
| Sungrow SG75CX-P2 (75kW) | ⚠️ | Não-derivável por regex — requer datasheet ou extensão de regex |
| Sungrow SG15RT-P2 (15kW) | ⚠️ | Idem |
| Fronius PRIMO 6.0-1 | ⚠️ | Datasheet |
| Apsystems DS3D-220 / QT2D-380 | ⚠️ | Datasheet |
| Deye SUN1000G3-US-220 / SUN1300G-US-220 | ⚠️ | Datasheet |
| Enphase IQ8P-72-2-BR | ⚠️ | Datasheet |

---

## Regressões

**Nenhuma.** O script é idempotente e opera apenas em campos `null`. Inversores com potência
existente não foram tocados. ProjetoEV, Ativos, QR, Comissionamento, Segurança: inalterados.

---

## Honestidade

- Atlas **foi gravado** (83 docs) — confirmado por resposta do Mongoose (`doc.save()` sem erro)
- Idempotência **foi verificada** (segunda corrida: candidatos=39, alta=0)
- Hardware não testado (UI/frontend) — impacto é catálogo/backend
- Qualidade reprocessada pelo motor real (`catalogoQualidade.js`), não por estimativa
- GW8000-DT **não foi aplicado** — declarado explicitamente aqui e nas métricas
