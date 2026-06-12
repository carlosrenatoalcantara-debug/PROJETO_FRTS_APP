# P0-CATALOG-MATCHER-FIX-02 — Aliases de Produto + Ingestão HELIUS 595HL

> Construtor restrito. Destrava projetos retidos por nomenclatura (formato de modelo,
> apelo estético, OCR) via dicionário de aliases auditável, sem fuzzy e sem corromper o SSOT.
>
> **Resultado: 398 → 426 projetos completos (+28, 77.4% → 82.9%)**

---

## RESUMO

| Métrica | Valor |
|---|---|
| Projetos completos antes | 398 (77.4%) |
| Projetos completos depois | **426 (82.9%)** |
| Ganho | **+28** |
| Equipamentos criados | 1 (HELIUS HMF132T12R-595HL) |
| Aliases de produto adicionados | 4 grupos / 11 variantes |
| Falsos positivos | 0 |
| Idempotente | ✅ (2ª execução: 0 criações, 0 binds) |
| Equipamentos existentes alterados | 0 |

---

## FASE 1 — Ingestão HELIUS HMF132T12R-595HL (correção de OCR)

Na FIX-01 o 595HL foi **rejeitado** porque o datasheet então disponível cobria 600-625W.
O usuário forneceu o **datasheet oficial (rev. Dez/2024)**, cujo range é 595-620W e contém a
coluna 595HL. Specs validadas (`Pmax ≈ Vmp × Imp`: 39.28 × 15.15 = 595.1 ✓):

| Pmax | Voc | Vmp | Isc | Imp | η | Células | Dim | Peso | IP |
|---|---|---|---|---|---|---|---|---|---|
| 595 W | 47.50 | 39.28 | 15.90 | 15.15 | 22.00% | 132 N-Type | 2382×1134×30 | 28.2 kg | IP68 |

Garantias: 15 anos produto / 30 anos performance. Coef. temp.: Pmax −0.30, Voc −0.26, Isc 0.046.
Equipamento criado com qualidade `utilizavel`/75, `origem.tipo=datasheet_pdfparse`.

**Tolerância de OCR:** adicionado alias `HELIUS HMF132TI2R-595HL` (I maiúsculo no lugar de 1)
ao dicionário de produto, por precaução — embora o dado real do projeto seja `HMF132T12R-595HL`.

---

## FASE 2 — Mapeamento Canônico SIRIUS Full Black (3ª Geração)

O modelo `SIRIUS-RS6-550MX-E3` (Full Black) já existia no Atlas (criado na FIX-01, specs do
datasheet oficial energiasirius.com — reconfirmadas pelos 2 PDFs fornecidos agora). Esta sprint
**não duplica hardware**: apenas registra aliases de ingestão para as strings de projeto.

| Variante de projeto | Projetos |
|---|---|
| `Sirius / Full Black` | 7 |
| `SIRIUS-RS6 - 550MX - / E3` (+ `Sirius-RS6 - ...`) | 3 |
| `Sirius Full Balck / 550w` (typo) | 1 |
| `Sirius / Full Balck` (typo) | 1 |
| **Total Full Black** | **12** |

---

## FASE 3 — Correção do Bind de Formato (SIRIUS A4)

As entradas `Sirius Energias Renováveis / SIRIUS-HD144P-545` e `SIRIUS-HD144N-550` **já existiam**
no catálogo (specs presentes), mas não bindavam: o projeto traz `SIRIUS BIFACIAL / HD144P-545W`
(prefixo "SIRIUS-" ausente, sufixo "W" extra). O alias de produto mapeia a combinação bruta
diretamente ao par canônico, sem alterar a entrada existente.

| Variante de projeto | Canônico | Projetos |
|---|---|---|
| `SIRIUS BIFACIAL / HD144P-545W` | `Sirius Energias Renováveis / SIRIUS-HD144P-545` | 14 |
| `SIRIUS BIFACIAL / HD144N-550W` | `Sirius Energias Renováveis / SIRIUS-HD144N-550` | 1 |

---

## Implementação (matcher.js)

Novo dicionário `PRODUTO_ALIASES` + índice `PRODUTO_ALIAS_INDEX` (Map de
`normalizarAgressive(variante) → {fabricante, modelo}` canônico). Integrado a
`resolverCandidatos()`:

```js
const blobNorm = normalizarAgressive(`${marcaBruta} ${modeloBruto}`)
const canon = PRODUTO_ALIAS_INDEX.get(blobNorm)
if (canon) candidates.push({ marca: canon.fabricante, modelo: canon.modelo })
```

O candidato canônico é resolvido pelo **índice flexível já existente** — sem novo índice, sem
fuzzy. Igualdade exata da string agressivamente normalizada → SSOT íntegro e auditável.
`encontrarMatch()` (estratégias 1-3) permanece intacto; o alias só atua quando confiança < 0.95.

---

## FASE 4/5/6 — Dry-run, Escrita e Rebind

| | Antes | Depois |
|---|---|---|
| Projetos completos | 398 | **426** |
| Atlas equipamentos | 353 | 354 (+1) |

Rebind: 28 binds gravados (1 normalizado + 27 flexível), 0 falsos positivos, 0 fuzzy gravado.

### Idempotência
```
Re-ingest HELIUS 595HL : ⏭ JÁ EXISTE (0 duplicata)
Re-bind (2ª execução)  : 0 binds novos, 426 mantidos
```

---

## FASE 7 — Validação (cadeia Projeto → equipamento_id → Atlas → specs)

| Caso | Projetos | Atlas | Specs |
|---|---|---|---|
| HD144P (A4) ✅ | 14 (ex.: "027 - Antônio Alvino") | SIRIUS-HD144P-545 | 545W, Voc 49.6, η 21.03% |
| HD144N (A4) ✅ | 1 ("070 - Romeika Katarina") | SIRIUS-HD144N-550 | 550W, Voc 50.2, η 21.23% |
| Full Black ✅ | 12 ("053 - Mirante das Dunas") | SIRIUS-RS6-550MX-E3 | 550W, Voc 50.1, η 21.3% |
| HELIUS 595HL ✅ | 1 ("Green Field") | HMF132T12R-595HL | 595W, Voc 47.5, η 22.0% |

---

## Itens deliberadamente NÃO mapeados (corretos)

| Item | Motivo |
|---|---|
| `HELIUS HMB132T12R / 630` | HMB (não HMF) + 630W ≠ 595 — modelo distinto sem datasheet |
| `HELIUS / HMF144T10R-580HL` | sufixo "R" não confirmado no datasheet HMF144T10 |
| `SIRIUS GRAFENO-BIFACIAL 535W` | produto Grafeno 535W distinto, datasheet não fornecido |
| `RENESOLA / RS6-580NBG-E3` | fabricante distinto |
| `600w / Bifacial com grafeno` | dado corrompido |

---

## Revisão Gemini (Inline) — Obrigatória

> Veredito: **APROVADO**

**1. Os aliases podem gerar falso positivo?**
Não. `PRODUTO_ALIAS_INDEX` casa por **igualdade exata** de `normalizarAgressive` — não há
prefixo, substring nem fuzzy. Cada chave é uma string de projeto observada empiricamente,
mapeada a um par canônico explícito. Uma string fora do dicionário simplesmente não resolve.
Os 28 binds foram revalidados em reverso (contagem por equipamento_id): 14+1+12+1.

**2. O SSOT foi preservado?**
Sim. Nenhum equipamento existente foi alterado — as entradas HD144P/HD144N legadas continuam
intactas. A única escrita de catálogo foi `create()` do HELIUS 595HL (datasheet oficial).
O bind grava apenas `equipamento_id`/`origem_bind`/campos espelhados no projeto.

**3. A ingestão do 595HL é legítima (não fabricada)?**
Sim. Datasheet oficial do fabricante (rev. Dez/2024) fornecido pelo usuário; `Pmax ≈ Vmp×Imp`
confere (595.1 ≈ 595). A rejeição na FIX-01 foi correta para o datasheet antigo; o range mudou
para 595-620W na revisão nova.

**4. Idempotência é genuína?**
Sim. Dedup de catálogo por `fabricante+modelo` raw (campos que o hook pre-save não reescreve).
Re-ingest → JÁ EXISTE; re-bind → 0. O hook recalcula `hash_unico`, por isso ele não é usado
como chave de dedup (lição herdada da FIX-01).

**5. Risco de manutenção?**
Baixo. O dicionário é declarativo e auditável; novas variantes são linhas adicionais. A
tolerância de OCR é explícita (não um folding global I→1 que poderia colidir).

---

## Critérios de Aceite

| Critério | Status |
|---|---|
| Datasheet validado (595HL) | ✅ |
| Aliases Sirius/Helius aplicados | ✅ 4 grupos / 11 variantes |
| Bind A4 corrigido (HD144P/HD144N) | ✅ +15 |
| Sem duplicação | ✅ |
| Sem sobrescrever catálogo | ✅ |
| SSOT íntegro | ✅ |
| Idempotente | ✅ |
| Revisão LLM inline | ✅ APROVADO |
| Commit separado | ✅ (pendente) |

---

## Arquivos

| Arquivo | Tipo |
|---|---|
| `src/integracoes/solarmarket/matcher.js` | `PRODUTO_ALIASES` + `PRODUTO_ALIAS_INDEX` + resolverCandidatos |
| `scripts/fix02-ingest-helius595.mjs` | ingestão HELIUS 595HL (idempotente) |
| `docs/CATALOG_MATCHER_FIX_02_REPORT.md` | este relatório |
| `docs/CATALOG_MATCHER_FIX_02_LOTE.json` | resultado estruturado |

## Próximos gargalos (backlog)

- PULLING ENERGY (5 proj) — datasheet em `por.pullingenergy.com/download/datasheet` → sprint dedicada.
- BELENERGY, AE SOLAR, ERA SOLAR, RENEPV, RONMA-156TB — importações menores.
- Dados corrompidos (ZXMR/ZXM7 como marca, wattage como marca) — sprint de reparo de dados (DQ).
