# Sprint P0-FV-CATALOG-QUALITY-RECAL-01 — Relatório

**Data:** 2026-06-18
**Modelo:** Opus
**Revisão Gemini:** OBRIGATÓRIA E PENDENTE
**Branch:** sprint/p0-fv-catalog-quality-recal-01
**Escopo alterado:** Catálogo, Qualidade, Importação. Não tocou ProjetoEV, Ativos, QR, Comissionamento, Segurança.

> **HONESTIDADE:** o **código** de recalibração e derivação está aplicado e foi **executado
> em Node** (motor de qualidade real + 122 modelos da forense). **NENHUM dado foi gravado
> no Atlas** — não há acesso a banco nesta sessão. A persistência depende de rodar
> `aplicar-derivacao-catalogo.mjs --apply` com `MONGODB_URI` (script pronto, **NÃO executado**).

---

## FASE 1 — Auditoria BUG-QUAL-01

| Achado | Estado encontrado |
|--------|-------------------|
| **MPPT_INCOERENTE (I1) estrito** | **JÁ CORRIGIDO** — `regrasPlausibilidade.js:398` usa `max > vocmax` (não `>=`); `MPPT_max == Voc_max_DC` (Growatt 550=550, micros 60=60) **passa**. |
| **Faixas por tecnologia (micro)** | **JÁ CALIBRADO** — `tecnologiaInversor()` + faixas micro em `VOC_MAX_DC_IMPLAUSIVEL` ([16,150]) e `MPPT_FAIXA_IMPLAUSIVEL` ([10,80]/[20,150]). |
| **Tabela de confiança incompleta** | ❌ **BUG ATIVO** — `BASE_POR_ORIGEM` (catalogoQualidade.js) **omitia `import_solarmarket`**, que É um `origem.tipo` válido no schema. Caía em `desconhecido`=20 → `score = completude*0.4 + 20*0.6`, travando em ~52 (< 75 'utilizável') mesmo com completude 95. |

**Conclusão:** a calibração de regras (micro/MPPT) já existia; o gargalo real era a **tabela de confiança**, não as regras de plausibilidade.

### Correção aplicada (Qualidade)
```
BASE_POR_ORIGEM += {
  import_solarmarket: 65,   // era omisso → caía em desconhecido (20)
  derivado_modelo:    45,   // specs inferidas do nome (nova origem)
}
```
- `import_solarmarket=65`: marketplace curado, identidade confiável; um item com completude ≥ 62 passa a alcançar 'utilizável'. **Verificado:** item SolarMarket completo → **utilizavel (score 79)** (antes ~52/incompleto).
- Empty-spec permanece conservador: item sem specs → **suspeito (39)**, não é falsamente promovido.

---

## FASE 2 — Auditoria BUG-CAT-01 (derivável × não derivável)

122 inversores sem `especificacoes`. Aplicando a derivação por nome (executada em Node):

| Categoria | Qtde | Critério |
|-----------|------|----------|
| **Derivável (alta)** | **83** | kW explícito no nome (`SUN-25K-G`, `MID 36KTL3-X`, `SE 20.1K`). |
| **Parcial (média)** | **31** | watts no nome (`MIN 6000TL-X`→6kW, `50000TL3-S`→50kW, `BDM-2250`→2.25kW). |
| **Não derivável** | **8** | nome não codifica potência → datasheet. |

→ **114/122 (93%)** passam a ter potência derivada (vs 87 na forense — a regra de watts recupera +27). **Cross-check vs forense: 87 concordâncias, 0 divergências** nos itens que a forense marcou deriváveis.

**8 não deriváveis (datasheet):** Fronius PRIMO 6.0-1, Apsystems DS3D-220 / QT2D-380, Deye SUN1000G3-US-220 / SUN1300G-US-220, Enphase IQ8P-72-2-BR, Sungrow SG75CX-P2 / SG15RT-P2.

---

## FASE 3 — Auto-enriquecimento

`catalogoDerivacaoModelo.js` (novo, puro, sem I/O):
- **Potência:** Regra A (kW explícito, confiança **alta**) → Regra B (watts 4–6 dígitos /1000, confiança **média**), excluindo voltagens (127/220/380…) e números < 1500.
- **Tecnologia:** reusa `tecnologiaInversor()` (micro/string/otimizador/híbrido) — fonte única.
- **Tensão:** derivada quando explícita no nome (`@220`, `380/220V`, `-LV`).
- **MPPT/Voc:** **NÃO derivados** do nome (não inferíveis) → permanecem nulos (honesto).
- Cada derivação registra `confianca` (alta/média) e `metodo` (`regex_kW` / `regex_watts`).

A aplicação mantém `origem.tipo='import_solarmarket'` e grava a proveniência em `especificacoes._derivado`.

---

## FASE 4 — Goodwe GW8000-DT

`derivarInversorPorModelo({modelo:'GW8000-DT'})` → **`{ potencia_kw: 8, tecnologia: 'string', confianca: 'media', metodo: 'regex_watts' }`** (executado).

**Impacto no projeto "Cristiano 600kw":** o catálogo passa a ter 8 kW para o GW8000-DT, destravando o dimensionamento. **Ressalva honesta:** isto é resultado da derivação em Node; **não foi gravado no Atlas** nem propagado ao projeto nesta sessão (requer `--apply` + DB). Snapshots já congelados do projeto NÃO mudam (imutáveis por design).

---

## FASE 5 — Recálculo de qualidade por tecnologia (executado)

Fixtures com specs realistas de datasheet, motor de qualidade real:

| Tecnologia | Nível | Score | Alertas críticos |
|-----------|-------|-------|------------------|
| string (Growatt MID 25KTL3-X) | validado | 94 | **[]** |
| micro (Hoymiles HMS-2000, MPPT_max==Voc_max=60) | validado | 94 | **[]** |
| otimizador (SolarEdge SE 27.6K) | validado | 94 | **[]** |
| híbrido (Deye SUN-8K-SG01LP1) | validado | 94 | **[]** |

Nenhum falso-positivo crítico em micro (o caso que invalidava na WAVE1). As 4 tecnologias alcançam 'validado'.

---

## FASE 6 — Matriz

| Classe | Qtde | Significado |
|--------|------|-------------|
| **Corrigidos** | 83 | potência de alta confiança (kW no nome) |
| **Parcialmente corrigidos** | 31 | potência de média confiança (watts no nome) — revisar |
| **Dependentes de datasheet** | 8 | nome não codifica potência |

Observação: mesmo os 114 com potência têm **MPPT/Voc ainda dependentes de datasheet** — a derivação resolve a potência (necessidade operacional do dimensionamento), não a ficha completa.

---

## RESPOSTAS DIRETAS

1. **Quantos equipamentos corrigidos:** derivação **executada** para 114/122 (83 alta + 31 média). **Persistência no Atlas NÃO realizada** (sem DB) — script de apply pronto.
2. **Quantos continuam pendentes:** 8 sem potência derivável (datasheet) + MPPT/Voc de todos os 114 + os 31 parciais a revisar.
3. **Impacto em projetos:** Goodwe GW8000-DT → 8 kW (Cristiano 600kw) — em dry-run; aplicar para propagar.
4. **Impacto em snapshots:** snapshots futuros capturariam a potência; **congelados não retroagem** (imutáveis) — correto.
5. **Impacto em homologação:** com a recal, itens completos chegam a 'utilizável'; a homologação (que usa snapshot quando congelado) reflete a potência ao re-congelar; não retroage a já congelados.
6. **Regressões:** `node --check` OK nos 4 arquivos; 4 tecnologias sem falso-positivo crítico; empty-spec permanece 'suspeito' (sem promoção indevida). Nenhuma regressão na execução em Node. **App e Atlas não executados.**
7. **Commit:** ver `FV_CATALOG_RECAL_METRICS.json`.

---

## Limitações honestas

1. **Nada gravado no Atlas.** `aplicar-derivacao-catalogo.mjs` está pronto e guardado por `--apply`, mas **NÃO foi executado** (sem `MONGODB_URI`).
2. Derivação por watts (31 parciais) tem risco residual de falso-positivo — marcada média confiança, requer revisão.
3. `import_solarmarket=65` é um valor de calibração (juízo); pode ser ajustado após validação com dados reais.
4. Contagens partem da forense `UNKNOWN_POWER_INVENTORY.json` (2026-06-17); o catálogo vivo pode ter mudado.
